-- Phase 11 / der-1.2.0-alpha.5 (ADR-0021): hash-chain `security_audit`.
--
-- Each row commits to the previous row's row_hash via a BEFORE INSERT
-- trigger. Backfill walks pre-existing rows ordered by
-- (observed_at, audit_id). Centralising the chain in Postgres means the
-- Java path and the verifier use the same canonical bytes.

SET search_path = der, public;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE security_audit
    ADD COLUMN IF NOT EXISTS prev_hash BYTEA,
    ADD COLUMN IF NOT EXISTS row_hash  BYTEA;

-- Canonical body: UTF-8 bytes of the fields joined by 0x1f.
--   detail is serialised via detail::text (Postgres canonical jsonb).
--   observed_at is UTC ISO-8601 with microseconds.
CREATE OR REPLACE FUNCTION security_audit_canonical_body(
        p_event_type      TEXT,
        p_actor_user_id   UUID,
        p_subject_user_id UUID,
        p_client_ip       INET,
        p_user_agent      TEXT,
        p_outcome         TEXT,
        p_detail          JSONB,
        p_observed_at     TIMESTAMPTZ
) RETURNS BYTEA
LANGUAGE SQL IMMUTABLE AS $$
    SELECT convert_to(p_event_type, 'UTF8')                            || decode('1f', 'hex') ||
           convert_to(coalesce(p_actor_user_id::text, ''), 'UTF8')     || decode('1f', 'hex') ||
           convert_to(coalesce(p_subject_user_id::text, ''), 'UTF8')   || decode('1f', 'hex') ||
           convert_to(coalesce(host(p_client_ip), ''), 'UTF8')         || decode('1f', 'hex') ||
           convert_to(coalesce(p_user_agent, ''), 'UTF8')              || decode('1f', 'hex') ||
           convert_to(p_outcome, 'UTF8')                               || decode('1f', 'hex') ||
           convert_to(coalesce(p_detail::text, '{}'), 'UTF8')          || decode('1f', 'hex') ||
           convert_to(to_char(p_observed_at AT TIME ZONE 'UTC',
                       'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'UTF8');
$$;

CREATE OR REPLACE FUNCTION security_audit_chain_trigger() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_prev BYTEA;
    v_body BYTEA;
BEGIN
    PERFORM pg_advisory_xact_lock(1145918529, 1430668372); -- 'DERA' 'UDIT'
    SELECT row_hash INTO v_prev
      FROM der.security_audit
     ORDER BY audit_id DESC
     LIMIT 1;
    IF v_prev IS NULL THEN
        v_prev := decode(repeat('00', 32), 'hex');
    END IF;
    v_body := der.security_audit_canonical_body(
        NEW.event_type, NEW.actor_user_id, NEW.subject_user_id,
        NEW.client_ip, NEW.user_agent, NEW.outcome, NEW.detail, NEW.observed_at);
    NEW.prev_hash := v_prev;
    NEW.row_hash  := digest(v_prev || v_body, 'sha256');
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_security_audit_chain ON security_audit;
CREATE TRIGGER trg_security_audit_chain
    BEFORE INSERT ON security_audit
    FOR EACH ROW EXECUTE FUNCTION security_audit_chain_trigger();

-- Backfill any pre-existing rows (no-op on clean installs).
DO $$
DECLARE
    r      RECORD;
    v_prev BYTEA := decode(repeat('00', 32), 'hex');
    v_body BYTEA;
BEGIN
    FOR r IN
        SELECT audit_id, event_type, actor_user_id, subject_user_id,
               client_ip, user_agent, outcome, detail, observed_at
          FROM der.security_audit
         ORDER BY observed_at, audit_id
    LOOP
        v_body := der.security_audit_canonical_body(
            r.event_type, r.actor_user_id, r.subject_user_id,
            r.client_ip, r.user_agent, r.outcome, r.detail, r.observed_at);
        UPDATE der.security_audit
           SET prev_hash = v_prev,
               row_hash  = digest(v_prev || v_body, 'sha256')
         WHERE audit_id = r.audit_id;
        SELECT row_hash INTO v_prev FROM der.security_audit WHERE audit_id = r.audit_id;
    END LOOP;
END $$;

ALTER TABLE security_audit
    ALTER COLUMN row_hash SET NOT NULL;

CREATE INDEX IF NOT EXISTS ix_security_audit_chain
    ON security_audit (audit_id, observed_at);
