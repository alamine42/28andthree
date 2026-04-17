"""ETL entrypoint. E1 ships a heartbeat-only implementation.

Real PBP ingest + phase aggregation arrives in E2 (see IMPLEMENTATION.md §3).
This module guarantees:
  - every run writes exactly one row to `meta_refresh`
  - Sentry cron check-ins wrap the run when SENTRY_DSN_ETL is set
  - structured JSON logs are emitted for GH Actions visibility

Usage:
  uv run python -m etl.main --heartbeat
  uv run python -m etl.main --season 2025 --week 14
  uv run python -m etl.main --full
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import UTC, datetime

import psycopg

from .models import MetaRefresh
from .settings import EtlSettings

logger = logging.getLogger("etl")


def configure_logging() -> None:
    handler = logging.StreamHandler(sys.stderr)

    class _JsonFormatter(logging.Formatter):
        def format(self, record: logging.LogRecord) -> str:  # noqa: D401 - logging API
            payload: dict[str, object] = {
                "ts": datetime.now(UTC).isoformat(),
                "level": record.levelname,
                "msg": record.getMessage(),
            }
            if record.exc_info:
                payload["exc"] = self.formatException(record.exc_info)
            return json.dumps(payload)

    handler.setFormatter(_JsonFormatter())
    logger.handlers = [handler]
    logger.setLevel(logging.INFO)


def init_sentry(settings: EtlSettings) -> None:
    if not settings.sentry_dsn_etl:
        logger.info("sentry_disabled dsn_not_set")
        return
    import sentry_sdk

    sentry_sdk.init(
        dsn=settings.sentry_dsn_etl,
        traces_sample_rate=0.1,
        send_default_pii=False,
    )
    logger.info("sentry_enabled monitor_slug=%s", settings.sentry_monitor_slug)


def write_heartbeat(settings: EtlSettings) -> MetaRefresh:
    """Insert a heartbeat row so /status has something to render end-to-end."""
    row = MetaRefresh(
        started_at=datetime.now(UTC),
        completed_at=datetime.now(UTC),
        status="heartbeat",
        source_version="etl@0.1.0",
        row_counts={"heartbeat": 1},
    )
    with psycopg.connect(settings.etl_database_url, autocommit=False) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO meta_refresh
                    (started_at, completed_at, status, source_version, row_counts)
                VALUES (%s, %s, %s, %s, %s::jsonb)
                RETURNING id, started_at, completed_at, status,
                          season, week, source_version, row_counts, error_text
                """,
                (
                    row.started_at,
                    row.completed_at,
                    row.status,
                    row.source_version,
                    json.dumps(row.row_counts),
                ),
            )
            result = cur.fetchone()
            assert result is not None
            conn.commit()
    logger.info("heartbeat_written id=%s", result[0])
    return MetaRefresh(
        id=result[0],
        started_at=result[1],
        completed_at=result[2],
        status=result[3],
        season=result[4],
        week=result[5],
        source_version=result[6],
        row_counts=result[7],
        error_text=result[8],
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="28 and Three ETL entrypoint")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--heartbeat", action="store_true", help="Write a heartbeat row and exit")
    group.add_argument("--full", action="store_true", help="Full backfill (E2)")
    group.add_argument("--season", type=int, help="Season to refresh (E2)")
    parser.add_argument("--week", type=int, help="Optional week filter (E2)")
    return parser


def main(argv: list[str] | None = None) -> int:
    configure_logging()
    args = build_parser().parse_args(argv)

    try:
        settings = EtlSettings()  # type: ignore[call-arg]  # pydantic-settings reads env
    except Exception as e:  # noqa: BLE001
        logger.error("settings_load_failed err=%r", e)
        return 1

    init_sentry(settings)

    if args.heartbeat:
        write_heartbeat(settings)
        return 0

    logger.error("not_yet_implemented flag=%s (E2 ships real ingest)", vars(args))
    return 2


if __name__ == "__main__":
    sys.exit(main())
