"""Shared pytest fixtures.

Integration tests depend on a Postgres database reachable via TEST_DATABASE_URL
(pre-migrated to the current schema). When the URL isn't set, integration
tests are skipped. Unit tests never require a DB.

Local setup:
  createdb pats_e2_test
  MIGRATOR_DATABASE_URL='postgresql://$(whoami)@localhost:5432/pats_e2_test' pnpm db:migrate
  export TEST_DATABASE_URL='postgresql://$(whoami)@localhost:5432/pats_e2_test'
"""

from __future__ import annotations

import os
from collections.abc import Generator

import psycopg
import pytest


@pytest.fixture(scope="session")
def test_database_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL not set — skipping integration tests")
    return url


@pytest.fixture()
def db_conn(test_database_url: str) -> Generator[psycopg.Connection, None, None]:
    """Per-test connection. Wraps every test in a transaction that's rolled
    back on teardown — no fixture data leaks between tests."""
    conn = psycopg.connect(test_database_url, autocommit=False)
    try:
        yield conn
    finally:
        conn.rollback()
        conn.close()
