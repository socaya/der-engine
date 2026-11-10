-- UI-10 — extend sync_policy.scope to cover scheduled sync jobs
-- (metadata pull, data pull, compat probe, drift, referrals, …) in
-- addition to the per-entity-type write scopes added in V106.
--
-- Before this, sync_policy only controlled the outbound write
-- stream. Admins who paused the global policy saw central writes
-- stop, but metadata pulls, drift snapshots, data pulls, and the
-- referral jobs kept running — the policy didn't actually apply to
-- "all DER ↔ DHIS2 sync objects" as operators expected. The
-- server-side Quartz jobs will consult sync_policy before each
-- tick so a paused scope truly means paused.

SET search_path = der, public;

ALTER TABLE sync_policy
    DROP CONSTRAINT IF EXISTS sync_policy_scope_check;
ALTER TABLE sync_policy
    ADD CONSTRAINT sync_policy_scope_check
    CHECK (scope = 'GLOBAL' OR scope = ANY (ARRAY[
        -- Write-side (/edge-api/v1 → DHIS2 central POST paths)
        'AGGREGATE_DATA_VALUE'::text,
        'AGGREGATE_DATASET_COMPLETION'::text,
        'EVENT'::text,
        'TRACKED_ENTITY'::text,
        'ENROLLMENT'::text,
        'PROGRAM_STAGE_EVENT'::text,
        'RELATIONSHIP'::text,
        'ENROLMENT_NOTE'::text,
        -- Pull-side + background jobs
        'METADATA_SYNC'::text,
        'DATA_PULL'::text,
        'COMPAT_REFRESH'::text,
        'DRIFT_SNAPSHOT'::text,
        'ANALYTICS_REFRESH'::text,
        'REFERRAL_INBOX'::text,
        'REFERRAL_ESCALATION'::text,
        'BACKUP_DRAIN'::text
    ]));
