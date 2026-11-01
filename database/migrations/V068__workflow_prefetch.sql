-- V068: Prefetch coordination for service-point handover.
--
-- When a step completes, downstream steps whose BLOCKED→READY
-- transition it triggers get a prefetch row inserted here, one per
-- (run, step, device) tuple. The server's SSE stream pushes a
-- notification to the target device so the client can warm its
-- cache (DHIS2 program / dataset context, prior-step contributions)
-- *before* the operator opens the step.
--
-- Device acks the warm cache by POSTing to
-- /edge-api/v1/workflows/prefetch/{stepId}/acked which sets
-- acked_at. Admin monitoring reads unacked rows older than N minutes
-- as "device offline / failing to warm" signals.

SET search_path = der, public;

CREATE TABLE capture_workflow_prefetch (
    run_id         UUID NOT NULL REFERENCES capture_workflow_run(run_id)
                        ON DELETE CASCADE,
    step_id        UUID NOT NULL REFERENCES capture_workflow_step(step_id)
                        ON DELETE CASCADE,
    device_id      UUID NOT NULL REFERENCES edge_device(device_id)
                        ON DELETE CASCADE,
    notified_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acked_at       TIMESTAMPTZ,
    PRIMARY KEY (run_id, step_id, device_id)
);

CREATE INDEX ix_capture_workflow_prefetch_device_pending
    ON capture_workflow_prefetch (device_id, notified_at)
    WHERE acked_at IS NULL;
CREATE INDEX ix_capture_workflow_prefetch_notified_at
    ON capture_workflow_prefetch (notified_at);
