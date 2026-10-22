-- DER pilot Postgres bootstrap (ADR-0014).
--
-- Idempotent — safe to re-run. Replace the placeholder password BEFORE
-- running; the installer substitutes it from DER_DB_PASSWORD at build time.
--
-- Run as the Postgres superuser:
--   sudo -u postgres psql -f bootstrap.sql

DO $do$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'der') THEN
        CREATE ROLE der WITH LOGIN PASSWORD '__DER_DB_PASSWORD__';
    END IF;
END
$do$;

-- Database is only created if missing; CREATE DATABASE cannot run inside
-- a DO block, so wrap in a \gexec dispatch.
SELECT 'CREATE DATABASE der OWNER der'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'der')\gexec

GRANT ALL PRIVILEGES ON DATABASE der TO der;
ALTER DATABASE der SET search_path = der, public;
