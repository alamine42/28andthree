---
title: "GitHub Actions + `python -m pkg.module` fails with ModuleNotFoundError when working-directory is the package itself"
category: "integration-issues"
date: "2026-04-17"
tags: [github-actions, python, uv, etl, module-resolution]
files: [.github/workflows/etl.yml, etl/main.py]
---

# GitHub Actions + `python -m pkg.module` fails when `working-directory` is the package

## Problem

The E1-09 ETL workflow failed on first run with:

```
/home/runner/.../etl/.venv/bin/python3: Error while finding module specification for
'etl.main' (ModuleNotFoundError: No module named 'etl')
```

The workflow was structured like this (the pattern most people reach for when packaging a subdirectory-scoped Python project):

```yaml
jobs:
  etl:
    defaults:
      run:
        working-directory: etl
    steps:
      - run: uv sync --frozen
      - run: uv run python -m etl.main --heartbeat
```

## Root Cause

When `working-directory: etl` is set, every `run` step is `cd etl/` before executing. `python -m etl.main` then looks for `etl/etl/main.py` — a sibling `etl` package inside the current dir — and doesn't find it. The actual package files (`etl/main.py`, `etl/__init__.py`) are at the *current* directory, not beneath it.

`uv run` honours the same CWD, so `--directory etl` does not help either — same shape.

## Solution

Drop the job-level `working-directory` override. Run from repo root and point `uv` at the project dir explicitly:

```yaml
jobs:
  etl:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version-file: .python-version
      - uses: astral-sh/setup-uv@v5
      - name: Install deps
        working-directory: etl
        run: uv sync --frozen
      - name: Heartbeat
        run: uv run --project etl python -m etl.main --heartbeat
```

Key mechanics:
- `uv sync` still has `working-directory: etl` — it's a one-shot that reads `pyproject.toml` from CWD.
- `uv run --project etl` tells uv which project's venv to use (so it finds the installed deps).
- CWD stays at repo root → `PYTHONPATH=.` → `etl.main` resolves to `./etl/main.py`.

## Prevention

- Default to running Python `-m pkg.module` from the **repo root**, not from inside the package directory.
- If you see a `ModuleNotFoundError` for a module whose files clearly exist, check CWD first before anything else.
- When wiring new Python subprojects: mirror the working E1-09 pattern in `.github/workflows/etl.yml`.

## Related

- `.github/workflows/etl.yml` — fix applied here
- commit `1b14631` — "E1-09 fix: ETL workflow — run from repo root, add issues:write perm"
- adversarial-review finding #2 noted that Bun/uv novelty compounds; this is a concrete instance of that risk landing.
