-- E3-16: rename phase_enum value `overall_offense` → `overall` to match
-- SPEC §3.2 #12 ("Overall — team EPA differential"). The aggregation is
-- also redefined in etl/transform/phases.py; after this migration applies,
-- re-run `uv run --project etl python -m etl.main --full` to rebuild
-- team_phase_weekly + team_phase_season with the new semantics.
--
-- Postgres supports ALTER TYPE … RENAME VALUE inside a transaction (since
-- PG 12). No COMMIT gymnastics required.

ALTER TYPE "public"."phase_enum" RENAME VALUE 'overall_offense' TO 'overall';
