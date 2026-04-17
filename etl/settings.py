"""ETL runtime settings — parallel to lib/env.ts on the Node side."""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class EtlSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=True)

    # Writer role for DML. Set per environment (prod/dev/preview) via secrets.
    etl_database_url: str = Field(..., alias="ETL_DATABASE_URL")

    # Observability. Optional — the ETL still runs without Sentry, just without
    # check-ins and error capture.
    sentry_dsn_etl: str | None = Field(default=None, alias="SENTRY_DSN_ETL")
    sentry_monitor_slug: str = Field(default="etl-weekly", alias="SENTRY_MONITOR_SLUG")
