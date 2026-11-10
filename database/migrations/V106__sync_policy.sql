-- SM-2a — first-class sync policy model.
--
-- Before this, sync behaviour was a binary: the journal worker was
-- either enabled or paused (AtomicBoolean, in-memory only, lost on
-- restart). Admins asked for three semantic modes — INSTANT (fire on
-- every write when central is reachable), SCHEDULED (Quartz cron,
-- the existing behaviour), PAUSED (hold writes locally until the
-- admin resumes). Policy can apply to the GLOBAL scope or to a
-- specific entity type so operators can e.g. keep TEI sync flowing
-- while pausing problematic Event writes.
--
-- Rows with scope = 'GLOBAL' are the fallback; per-entity rows
-- override the global for their entity type. If a per-entity row is
-- absent the worker inherits GLOBAL. A seed GLOBAL row with
-- mode=SCHEDULED + the historical drain cron keeps behaviour
-- identical for installs that never touch the policy UI.

SET search_path = der, public;

CREATE TABLE IF NOT EXISTS sync_policy (
    scope           TEXT PRIMARY KEY,
    mode            TEXT NOT NULL,
    schedule_cron   TEXT,
    paused_reason   TEXT,
    updated_by      UUID REFERENCES edge_user(user_id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT sync_policy_mode_check
        CHECK (mode = ANY (ARRAY['INSTANT'::text,
                                 'SCHEDULED'::text,
                                 'PAUSED'::text])),
    CONSTRAINT sync_policy_scope_check
        CHECK (scope = 'GLOBAL' OR scope = ANY (ARRAY[
            'AGGREGATE_DATA_VALUE'::text,
            'AGGREGATE_DATASET_COMPLETION'::text,
            'EVENT'::text,
            'TRACKED_ENTITY'::text,
            'ENROLLMENT'::text,
            'PROGRAM_STAGE_EVENT'::text,
            'RELATIONSHIP'::text,
            'ENROLMENT_NOTE'::text
        ])),
    CONSTRAINT sync_policy_cron_required_when_scheduled
        CHECK (mode <> 'SCHEDULED' OR schedule_cron IS NOT NULL),
    CONSTRAINT sync_policy_reason_required_when_paused
        CHECK (mode <> 'PAUSED' OR paused_reason IS NOT NULL)
);

-- Seed GLOBAL = SCHEDULED matching the historical drain cron (every
-- minute). Idempotent: no-op on re-apply.
INSERT INTO sync_policy (scope, mode, schedule_cron, paused_reason)
VALUES ('GLOBAL', 'SCHEDULED', '0 * * * * ?', NULL)
ON CONFLICT (scope) DO NOTHING;
