"""Pydantic models for ETL row shapes.

Hand-written for E1 (single table). E2-00b will introduce Drizzle→Pydantic
codegen once the schema grows to plays/games/team_phase_* and drift risk
becomes real. Until then, this file is the single source of Python-side truth
and MUST be kept in sync with db/schema.ts by eye (covered by the PR checklist).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Status = Literal["running", "ok", "failed", "heartbeat"]


class MetaRefresh(BaseModel):
    """Mirror of db/schema.ts `meta_refresh`."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    id: int | None = None
    started_at: datetime
    completed_at: datetime | None = None
    status: Status
    season: int | None = None
    week: int | None = None
    source_version: str | None = Field(default=None, max_length=40)
    row_counts: dict[str, int] | None = None
    error_text: str | None = None
