---
title: "nfl_data_py 0.3.3 won't install on Python 3.12 (pandas 1.5.3 build failure)"
category: "build-errors"
date: "2026-04-17"
tags: [python, nflverse, nfl_data_py, pandas, uv, dependency-hell]
files: [etl/pyproject.toml]
---

# `nfl_data_py` 0.3.3 + Python 3.12 = pandas build failure

## Problem

`uv sync` against `etl/pyproject.toml` fails when `nfl_data_py>=0.3.3` is a dependency on Python 3.12:

```
ModuleNotFoundError: No module named 'pkg_resources'
File ".../build_meta.py", line 317, in run_setup
    exec(code, locals())
  File "<string>", line 19, in <module>
help: `pandas` (v1.5.3) was included because `etl` (v0.1.0) depends on
      `nfl-data-py` (v0.3.3) which depends on `pandas`
```

## Root Cause

Two compounding issues:

1. `nfl_data_py 0.3.3` (latest as of 2026-04) pins `pandas <2.0, >=1.0`. Upstream `nfl_data_py` has been inactive.
2. `pandas 1.5.3` (the newest version matching `<2.0`) relies on `pkg_resources` at build time but does not declare it as a build dependency. `pkg_resources` was removed from the stdlib-install path in modern setuptools, so the build fails on Python 3.12.

No version of `nfl_data_py` currently on PyPI builds cleanly on Python 3.12 out of the box.

## Solution

Two paths, in order of preference:

**For E1** (heartbeat-only, no PBP ingest yet): drop `nfl_data_py` from the dependency list entirely. The ETL only needs `psycopg` + `pydantic` + `sentry-sdk` for now.

**For E2** (real ingest): pick ONE of:

1. **Use `nflreadpy`** (newer Python wrapper, maintained):
   ```toml
   dependencies = ["nflreadpy", "pyarrow", "polars"]
   ```
   Built on polars + direct parquet fetch from `nflverse-data` GitHub releases. Faster, no pandas pin, actively maintained.

2. **Bypass the wrapper entirely**: fetch parquet files directly from `https://github.com/nflverse/nflverse-data/releases`. The wrapper is thin — a few `pd.read_parquet(url)` calls.

3. **Last resort**: pin `nfl_data_py` with a build-dep workaround:
   ```toml
   [tool.uv.extra-build-dependencies]
   pandas = ["pkg_resources"]
   ```
   Fragile, pandas 1.5.3 is ancient, and upstream may break further.

## Prevention

- When vetting a pypi dep, check the last release date AND the latest transitive pins. `requires_dist` on `pypi.org/pypi/<pkg>/json` shows this.
- For the E2 ingest task (E2-04 in beads), use `nflreadpy` by default and document the choice. Add a decision record if we pick something else.

## Related

- `etl/pyproject.toml` — current deps (post-E1 heartbeat scope)
- `IMPLEMENTATION.md` §3 E2-04 — future nflverse ingest task
- commit `91302ed` — E1 build, where nfl_data_py was dropped from the E1 install surface
