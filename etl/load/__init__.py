"""ETL load layer: COPY bulk + idempotent UPSERT against Postgres.

Separated from ingest so loaders don't depend on nflreadpy. The loaders
take Pydantic model instances and execute parameterized SQL.
"""
