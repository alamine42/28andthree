"""CLI contract for `python -m etl.main`. No database: the entrypoint's
collaborators are stubbed so these run in the unit tier."""

from __future__ import annotations

import pytest

from etl import main as main_mod
from etl.freshness import FreshnessResult


def test_force_without_season_is_rejected() -> None:
    with pytest.raises(SystemExit) as exc:
        main_mod.main(["--full", "--force"])
    assert exc.value.code == 2


def _stub_entrypoint(monkeypatch: pytest.MonkeyPatch) -> dict[str, list]:
    calls: dict[str, list] = {"gate": [], "heartbeat": [], "running": [], "season": []}
    monkeypatch.setattr(main_mod, "EtlSettings", lambda: object())
    monkeypatch.setattr(main_mod, "init_sentry", lambda settings: None)
    monkeypatch.setattr(
        main_mod,
        "run_freshness_gate",
        lambda settings, target_season=None: (
            calls["gate"].append(target_season),
            FreshnessResult(should_run=False, reason="already_loaded"),
        )[1],
    )
    monkeypatch.setattr(
        main_mod, "_write_heartbeat", lambda settings, reason: calls["heartbeat"].append(reason)
    )
    monkeypatch.setattr(
        main_mod,
        "_write_meta_refresh_running",
        lambda settings, season, week: calls["running"].append((season, week)),
    )
    monkeypatch.setattr(
        main_mod,
        "run_season",
        lambda settings, season, week=None: calls["season"].append((season, week)),
    )
    return calls


def test_season_without_force_honours_the_gate(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _stub_entrypoint(monkeypatch)
    assert main_mod.main(["--season", "2026"]) == 0
    assert calls["gate"] == [2026]
    assert calls["heartbeat"] == ["already_loaded"]
    assert calls["season"] == []


def test_season_with_force_skips_the_gate(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _stub_entrypoint(monkeypatch)
    assert main_mod.main(["--season", "2026", "--week", "3", "--force"]) == 0
    assert calls["gate"] == []
    assert calls["heartbeat"] == []
    assert calls["running"] == [(2026, 3)]
    assert calls["season"] == [(2026, 3)]
