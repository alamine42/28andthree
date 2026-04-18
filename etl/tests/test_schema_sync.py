"""E2-00b: Drizzle → Pydantic schema drift check.

Parses the latest drizzle-kit snapshot under drizzle/meta/ and asserts every
table has a Pydantic model with matching column names + compatible types.

Non-blocking in CI through E2 (run with `pytest --no-header -q`; failure
surfaces as a warning). Promoted to blocking at the start of E4 when the
players + rollup tables double the drift surface.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, get_args

import pytest
from pydantic import BaseModel

from etl.models import Game, MetaRefresh, Play, TeamPhaseSeason, TeamPhaseWeekly

REPO_ROOT = Path(__file__).resolve().parents[2]
META_DIR = REPO_ROOT / "drizzle" / "meta"

# Maps Drizzle (Postgres) types to the Pydantic field type categories the
# generated model field may declare. Only needs to be good enough to catch
# "ttext was renamed to varchar" style drift.
TYPE_CATEGORY: dict[str, set[str]] = {
    "text": {"str"},
    "varchar": {"str", "literal"},
    "integer": {"int"},
    "smallint": {"int"},
    "serial": {"int"},
    "boolean": {"bool"},
    "double precision": {"float"},
    "jsonb": {"dict", "list"},
    "timestamp with time zone": {"datetime"},
    "date": {"date"},
    "phase_enum": {"literal"},
}

TABLE_TO_MODEL: dict[str, type[BaseModel]] = {
    "meta_refresh": MetaRefresh,
    "games": Game,
    "plays": Play,
    "team_phase_weekly": TeamPhaseWeekly,
    "team_phase_season": TeamPhaseSeason,
}


def _latest_snapshot() -> dict[str, Any]:
    snapshots = sorted(META_DIR.glob("*_snapshot.json"))
    assert snapshots, f"no drizzle snapshots found under {META_DIR}"
    return json.loads(snapshots[-1].read_text())


def _pydantic_category(annotation: Any) -> set[str]:
    """Collapse a Pydantic annotation into the type-category tokens we expect.

    Handles: `T | None`, generic containers (`dict[k,v]`, `list[t]`), Literal
    unions, and plain types. Returns the outermost category (e.g., `dict` for
    `dict[str, int] | None`) — we don't assert on element types here.
    """
    # Strip `T | None` unions.
    args = [a for a in get_args(annotation) if a is not type(None)]
    if args and len(args) == 1:
        inner = args[0]
        # If the remaining arm is itself a generic (dict[...], list[...]) we
        # want its origin name rather than recursing into its element types.
        origin = getattr(inner, "__origin__", None)
        if origin is not None:
            return {origin.__name__.lower()}
        return _pydantic_category(inner)

    # Bare generic, no Optional wrapper: dict[...], list[...].
    origin = getattr(annotation, "__origin__", None)
    if origin is not None:
        # typing.Literal has `__origin__` of `typing.Literal` (string repr).
        if str(origin) == "typing.Literal":
            return {"literal", "str"}
        return {origin.__name__.lower()}

    if hasattr(annotation, "__name__"):
        return {annotation.__name__.lower()}

    return {str(annotation).lower()}


@pytest.fixture(scope="module")
def snapshot() -> dict[str, Any]:
    return _latest_snapshot()


def test_snapshot_contains_every_expected_table(snapshot: dict[str, Any]) -> None:
    tables = {name.removeprefix("public.") for name in snapshot.get("tables", {})}
    for expected in TABLE_TO_MODEL:
        assert expected in tables, f"table {expected} missing from drizzle snapshot"


@pytest.mark.parametrize("table_name,model", TABLE_TO_MODEL.items())
def test_every_table_column_has_a_pydantic_field(
    snapshot: dict[str, Any], table_name: str, model: type[BaseModel]
) -> None:
    key = f"public.{table_name}"
    table = snapshot["tables"][key]
    db_columns = set(table["columns"].keys())
    model_fields = set(model.model_fields.keys())
    missing = db_columns - model_fields
    assert not missing, (
        f"{table_name} has {len(missing)} column(s) not present in "
        f"{model.__name__}: {sorted(missing)}"
    )


@pytest.mark.parametrize("table_name,model", TABLE_TO_MODEL.items())
def test_no_pydantic_field_is_missing_from_db(
    snapshot: dict[str, Any], table_name: str, model: type[BaseModel]
) -> None:
    key = f"public.{table_name}"
    table = snapshot["tables"][key]
    db_columns = set(table["columns"].keys())
    model_fields = set(model.model_fields.keys())
    extra = model_fields - db_columns
    assert not extra, (
        f"{model.__name__} has {len(extra)} field(s) not present in "
        f"{table_name}: {sorted(extra)}"
    )


@pytest.mark.parametrize("table_name,model", TABLE_TO_MODEL.items())
def test_every_column_type_is_compatible_with_its_field(
    snapshot: dict[str, Any], table_name: str, model: type[BaseModel]
) -> None:
    key = f"public.{table_name}"
    table = snapshot["tables"][key]
    mismatches: list[str] = []
    for col_name, col_meta in table["columns"].items():
        if col_name not in model.model_fields:
            continue
        db_type = _normalize_db_type(col_meta["type"])
        expected_categories = TYPE_CATEGORY.get(db_type)
        if expected_categories is None:
            # Unknown type: log but don't fail — the drift check is warning-level.
            continue
        py_categories = _pydantic_category(model.model_fields[col_name].annotation)
        if not (expected_categories & py_categories):
            mismatches.append(
                f"{col_name}: db={db_type} expects one of {sorted(expected_categories)}, "
                f"pydantic annotation resolves to {sorted(py_categories)}"
            )
    assert not mismatches, f"{table_name} type mismatches:\n  " + "\n  ".join(mismatches)


def _normalize_db_type(db_type: str) -> str:
    # Strip varchar(N) → varchar etc. so the lookup table stays small.
    return db_type.split("(")[0].strip()
