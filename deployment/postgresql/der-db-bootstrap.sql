-- deployment/postgresql/der-db-bootstrap.sql — Phase 01 bootstrap for the DER
-- coordination database. Idempotent: safe to re-run.
--
-- Preconditions: PostgreSQL 17 running on localhost:5432 with a 'postgres'
-- superuser. The password set below is a Phase-01 development placeholder;
-- Phase 02 will rotate it and store the real credential outside this file.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'der') THEN
    CREATE ROLE der LOGIN PASSWORD 'der_phase01_devonly';
  END IF;
END $$;

-- CREATE DATABASE must be run outside a transaction block, so we emit a NOTICE
-- when it already exists rather than wrapping in a DO block.
SELECT 'DATABASE der already exists; skipping CREATE' AS note
WHERE EXISTS (SELECT 1 FROM pg_database WHERE datname = 'der');

-- The next line is a no-op when the database exists (psql reports the error
-- but keeps going; wrap with `\set ON_ERROR_STOP off` in your psql session,
-- or just skip this script after the first run).
CREATE DATABASE der OWNER der;
