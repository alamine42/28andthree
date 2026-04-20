"""ETL orchestrator.

Modes:
  --heartbeat                      Write a single heartbeat row; exit. Used
                                    by the off-season / not-yet-fresh path.
  --full                            Backfill all 2020..current seasons.
  --season N [--week W]            Refresh season N (all weeks, or just W).
  --freshness-gate                 Dry-run the gate and exit 0/1 based on
                                    whether we'd run. Used by GH Actions
                                    to decide primary-vs-retry semantics.

Guaranteed properties:
  1. At least one row written to `meta_refresh` per run.
  2. Advisory lock (CONCURRENT_ETL_LOCK_ID) prevents interleaved runs.
  3. Ingest + load + aggregate happen in a single transaction (per season
     for `--full` to keep WAL manageable).
  4. Structured JSON logs emitted per phase aggregated + per table loaded.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import UTC, date, datetime
import psycopg

from etl.constants import CONCURRENT_ETL_LOCK_ID
from etl.freshness import FreshnessResult, check_freshness, now_utc
from etl.ingest.nflverse import (
    compute_participation_coverage,
    fetch_pbp,
    fetch_schedules,
    normalize_games,
    normalize_plays,
)
from etl.ingest.rosters import fetch_rosters, normalize_current_players, normalize_snapshots
from etl.load.plays import upsert_games, upsert_plays
from etl.load.players import upsert_players, upsert_roster_snapshots
from etl.transform.qb_rollups import recompute_qb_season, recompute_qb_weekly
from etl.transform.skill_rollups import recompute_skill_season, recompute_skill_weekly
from etl.transform.unit_rollups import recompute_unit_rollups
from etl.settings import EtlSettings
from etl.transform.games_epa import recompute_games_epa
from etl.transform.phases import recompute_season, recompute_weekly

logger = logging.getLogger("etl")

# Static upper bound = 2025 (current through Feb 2026 SB). When Week 1 2026
# kicks off, bump to 2026 via the `--season` flag.
DEFAULT_BACKFILL_SEASONS = tuple(range(2020, 2026))


# -----------------------------------------------------------------------------
# Logging setup
# -----------------------------------------------------------------------------

def configure_logging() -> None:
    handler = logging.StreamHandler(sys.stderr)

    class _JsonFormatter(logging.Formatter):
        def format(self, record: logging.LogRecord) -> str:  # noqa: D401 - API
            payload: dict[str, object] = {
                "ts": datetime.now(UTC).isoformat(),
                "level": record.levelname,
                "logger": record.name,
                "msg": record.getMessage(),
            }
            if record.exc_info:
                payload["exc"] = self.formatException(record.exc_info)
            return json.dumps(payload)

    handler.setFormatter(_JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)


# -----------------------------------------------------------------------------
# Sentry
# -----------------------------------------------------------------------------

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


# -----------------------------------------------------------------------------
# meta_refresh writers
# -----------------------------------------------------------------------------

def _write_meta_refresh(
    conn: psycopg.Connection,
    *,
    started_at: datetime,
    completed_at: datetime | None,
    status: str,
    season: int | None,
    week: int | None,
    source_version: str | None,
    row_counts: dict[str, int] | None,
    error_text: str | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO meta_refresh
                (started_at, completed_at, status, season, week,
                 source_version, row_counts, error_text)
            VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s)
            """,
            (
                started_at,
                completed_at,
                status,
                season,
                week,
                source_version,
                json.dumps(row_counts) if row_counts is not None else None,
                error_text,
            ),
        )


def _write_heartbeat(settings: EtlSettings, *, reason: str) -> None:
    now = now_utc()
    with psycopg.connect(settings.etl_database_url, autocommit=True) as conn:
        _write_meta_refresh(
            conn,
            started_at=now,
            completed_at=now,
            status="heartbeat",
            season=None,
            week=None,
            source_version=f"etl@0.2.0:{reason}",
            row_counts={"heartbeat": 1},
        )
    logger.info("heartbeat_written reason=%s", reason)


# -----------------------------------------------------------------------------
# Pipeline
# -----------------------------------------------------------------------------

def _acquire_run_lock(conn: psycopg.Connection) -> bool:
    """Return True if the advisory lock was acquired in the current txn."""
    with conn.cursor() as cur:
        cur.execute("SELECT pg_try_advisory_xact_lock(%s)", (CONCURRENT_ETL_LOCK_ID,))
        row = cur.fetchone()
    return bool(row and row[0])


def run_season(
    settings: EtlSettings,
    *,
    season: int,
    week: int | None = None,
) -> dict[str, int]:
    """Ingest + load + aggregate for one season. Single transaction.

    Returns row counts for meta_refresh. Raises on failure; caller writes the
    `failed` row on a separate connection.
    """
    started_at = now_utc()

    # Fetch outside the DB transaction — network I/O, may take minutes.
    logger.info("fetch_start season=%d week=%s", season, week)
    pbp_df = fetch_pbp([season])
    sched_df = fetch_schedules([season])
    roster_df = fetch_rosters([season])
    coverage_df = compute_participation_coverage(pbp_df)

    games = normalize_games(sched_df)
    plays = normalize_plays(pbp_df)
    current_players = normalize_current_players(roster_df)
    snapshots = normalize_snapshots(roster_df)
    logger.info(
        "fetch_done season=%d plays=%d games=%d players=%d snapshots=%d",
        season, len(plays), len(games), len(current_players), len(snapshots),
    )

    with psycopg.connect(settings.etl_database_url, autocommit=False) as conn:
        if not _acquire_run_lock(conn):
            logger.info("concurrent_run_skipped lock=%d", CONCURRENT_ETL_LOCK_ID)
            return {"concurrent_skipped": 1}

        games_written = upsert_games(conn, games)
        plays_written = upsert_plays(conn, plays)
        players_written = upsert_players(conn, current_players)
        snapshots_written = upsert_roster_snapshots(conn, snapshots)
        # Participation coverage: UPDATE games rows with coverage fraction.
        coverage_rows = coverage_df.to_dicts() if coverage_df.height > 0 else []
        if coverage_rows:
            with conn.cursor() as cur:
                cur.executemany(
                    "UPDATE games SET participation_coverage = %s WHERE game_id = %s",
                    [(r["participation_coverage"], r["game_id"]) for r in coverage_rows],
                )
        weeks_filter = [week] if week is not None else None
        weekly_written = recompute_weekly(conn, season=season, weeks=weeks_filter)
        season_written = recompute_season(conn, season=season)
        games_epa_written = recompute_games_epa(conn, season=season)
        # E4: player + unit rollups. All depend on plays + games being loaded.
        qb_weekly_written = recompute_qb_weekly(conn, season=season)
        qb_season_written = recompute_qb_season(conn, season=season)
        skill_weekly_written = recompute_skill_weekly(conn, season=season)
        skill_season_written = recompute_skill_season(conn, season=season)
        unit_written = recompute_unit_rollups(conn, season=season)

        row_counts = {
            "plays": plays_written,
            "games": games_written,
            "players": players_written,
            "roster_snapshots": snapshots_written,
            "team_phase_weekly": weekly_written,
            "team_phase_season": season_written,
            "games_epa_updated": games_epa_written,
            "qb_weekly": qb_weekly_written,
            "qb_season": qb_season_written,
            "skill_weekly": skill_weekly_written,
            "skill_season": skill_season_written,
            "team_unit_rows": unit_written,
        }
        for phase_name in ("offense_base", "defense_base", "situational", "explosive_st"):
            logger.info(
                "phase_group_complete season=%d group=%s row_counts=%s",
                season, phase_name, json.dumps(row_counts),
            )
        _write_meta_refresh(
            conn,
            started_at=started_at,
            completed_at=now_utc(),
            status="ok",
            season=season,
            week=week,
            source_version=_source_version(),
            row_counts=row_counts,
        )
        conn.commit()

    logger.info("run_complete season=%d row_counts=%s", season, json.dumps(row_counts))
    return row_counts


def run_full_backfill(
    settings: EtlSettings,
    *,
    seasons: tuple[int, ...] = DEFAULT_BACKFILL_SEASONS,
) -> dict[str, int]:
    """Per-season commits. Keeps WAL bounded and lets partial progress survive
    interruption."""
    aggregate: dict[str, int] = {}
    for season in seasons:
        counts = run_season(settings, season=season)
        for k, v in counts.items():
            aggregate[k] = aggregate.get(k, 0) + v
    return aggregate


def _source_version() -> str:
    # Populated properly when the first real release lands; for now, a stable
    # tag that downstream contract tests can assert is non-null.
    return "etl@0.2.0"


# -----------------------------------------------------------------------------
# Freshness gate entry
# -----------------------------------------------------------------------------

def run_freshness_gate(settings: EtlSettings) -> FreshnessResult:
    """Inspect nflverse vs DB state; return the decision. Does not run the ETL."""
    current = _current_season_year()
    with psycopg.connect(settings.etl_database_url, autocommit=True) as conn:
        result = check_freshness(
            now=now_utc(),
            current_season=current,
            nflverse_latest_completed=_nflverse_latest_completed(current),
            db_connection=conn,
            next_season_week1_date=_next_week1(current + 1),
        )
    logger.info("freshness_gate decision=%s reason=%s", result.should_run, result.reason)
    return result


def _current_season_year() -> int:
    """The NFL season-year currently in play.

    NFL convention: the 2026 season is the one that starts in September 2026
    and runs through February 2027. If today is Jan/Feb we're still in the
    previous calendar-year's season.
    """
    today = date.today()
    if today.month < 3:
        return today.year - 1
    return today.year


def _nflverse_latest_completed(season: int) -> tuple[int, int] | None:
    """Return (season, max_completed_week) from nflverse schedules. None on error."""
    try:
        sched = fetch_schedules([season])
    except Exception as exc:  # noqa: BLE001
        logger.warning("nflverse_schedule_fetch_failed err=%r", exc)
        return None

    import polars as pl

    completed = sched.filter(
        (pl.col("home_score").is_not_null()) & (pl.col("away_score").is_not_null())
    )
    if completed.height == 0:
        return None
    row = completed.select(pl.col("week").max().alias("w")).row(0)
    return (season, int(row[0]))


def _next_week1(season: int) -> date | None:
    """First scheduled game date for a given season. None if schedule not yet released."""
    try:
        sched = fetch_schedules([season])
    except Exception as exc:  # noqa: BLE001
        logger.info("nflverse_next_season_unavailable season=%d err=%r", season, exc)
        return None

    import polars as pl

    week1 = sched.filter(pl.col("week") == 1)
    if week1.height == 0:
        return None
    earliest = week1.select(pl.col("gameday").min().alias("d")).row(0)[0]
    if earliest is None:
        return None
    if isinstance(earliest, date):
        return earliest
    if isinstance(earliest, datetime):
        return earliest.date()
    try:
        return datetime.strptime(str(earliest), "%Y-%m-%d").date()
    except ValueError:
        return None


# -----------------------------------------------------------------------------
# CLI
# -----------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="28 and Three ETL entrypoint")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--heartbeat", action="store_true", help="Write a heartbeat row and exit")
    group.add_argument("--full", action="store_true", help="Full backfill (2020..current)")
    group.add_argument("--season", type=int, help="Season to refresh")
    group.add_argument(
        "--freshness-gate",
        action="store_true",
        help="Inspect freshness; exit 0 either way but write heartbeat when stale",
    )
    parser.add_argument("--week", type=int, help="Optional week filter (only with --season)")
    return parser


def main(argv: list[str] | None = None) -> int:
    configure_logging()
    args = build_parser().parse_args(argv)

    try:
        settings = EtlSettings()  # type: ignore[call-arg]
    except Exception as exc:  # noqa: BLE001
        logger.error("settings_load_failed err=%r", exc)
        return 1

    init_sentry(settings)

    if args.heartbeat:
        _write_heartbeat(settings, reason="manual")
        return 0

    if args.freshness_gate:
        result = run_freshness_gate(settings)
        if not result.should_run:
            _write_heartbeat(settings, reason=result.reason)
        return 0

    if args.full:
        _write_meta_refresh_running(settings, season=None, week=None)
        try:
            counts = run_full_backfill(settings)
            logger.info("full_backfill_done counts=%s", json.dumps(counts))
            return 0
        except Exception as exc:
            _write_meta_refresh_failed(settings, season=None, week=None, exc=exc)
            raise

    if args.season is not None:
        result = run_freshness_gate(settings)
        if not result.should_run:
            _write_heartbeat(settings, reason=result.reason)
            return 0
        _write_meta_refresh_running(settings, season=args.season, week=args.week)
        try:
            run_season(settings, season=args.season, week=args.week)
            return 0
        except Exception as exc:
            _write_meta_refresh_failed(
                settings, season=args.season, week=args.week, exc=exc
            )
            raise

    logger.error("no_mode_selected args=%s", vars(args))
    return 2


def _write_meta_refresh_running(
    settings: EtlSettings,
    *,
    season: int | None,
    week: int | None,
) -> None:
    now = now_utc()
    with psycopg.connect(settings.etl_database_url, autocommit=True) as conn:
        _write_meta_refresh(
            conn,
            started_at=now,
            completed_at=None,
            status="running",
            season=season,
            week=week,
            source_version=_source_version(),
            row_counts=None,
        )


def _write_meta_refresh_failed(
    settings: EtlSettings,
    *,
    season: int | None,
    week: int | None,
    exc: BaseException,
) -> None:
    now = now_utc()
    message = f"{type(exc).__name__}: {exc}"
    with psycopg.connect(settings.etl_database_url, autocommit=True) as conn:
        _write_meta_refresh(
            conn,
            started_at=now,
            completed_at=now,
            status="failed",
            season=season,
            week=week,
            source_version=_source_version(),
            row_counts=None,
            error_text=message[:10_000],  # schema stores text; cap to avoid runaway
        )


__all__ = [
    "DEFAULT_BACKFILL_SEASONS",
    "build_parser",
    "main",
    "run_freshness_gate",
    "run_full_backfill",
    "run_season",
]


if __name__ == "__main__":
    sys.exit(main())
