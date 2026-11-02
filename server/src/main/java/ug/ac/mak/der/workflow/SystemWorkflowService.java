package ug.ac.mak.der.workflow;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * §2.3.85 — Lineage tags for writes that aren't operator-driven.
 *
 * <p>Every row in a DER data table carries a {@code workflow_run_id}
 * so admins can trace a value back to the run that produced it.
 * Operator-driven writes come from the capture workflow coordinator
 * and already carry a run id. Server-managed write paths (DHIS2 Data
 * Entry web app passthrough, referral ingest, central-DHIS2
 * download) do not — this service manufactures a <b>system
 * workflow run</b> per scope so every write gets attributed.</p>
 *
 * <p>The two SYSTEM workflow definitions are seeded by V073 with
 * deterministic UUIDs; a service-ensured run row is upserted on
 * {@code (workflow_id, workflow_version, business_key)} so parallel
 * writes for the same scope collapse to one run and we never
 * accidentally fan out to a run-per-write.</p>
 */
@Service
public class SystemWorkflowService {

    /** DHIS2 Data Entry web app passthrough. One run per
     *  {@code (dataSet, orgUnit, period, submitter)}. */
    public static final UUID WEB_APP_CAPTURE_WORKFLOW_ID
        = UUID.fromString("00000000-0000-0000-0000-000000000001");

    /** Referral ingest. One run per inbox entry. */
    public static final UUID REFERRAL_INGEST_WORKFLOW_ID
        = UUID.fromString("00000000-0000-0000-0000-000000000002");

    /** Central-DHIS2 download. One run per pull batch, scoped by
     *  {@code (dataSet, orgUnit, period, submitter)} so repeated
     *  pulls for the same scope collapse to one trackable run. */
    public static final UUID CENTRAL_DOWNLOAD_WORKFLOW_ID
        = UUID.fromString("00000000-0000-0000-0000-000000000003");

    /** DHIS2 Event / Tracker capture app passthrough. One run per
     *  {@code (program, programStage, orgUnit, submitter)} so an
     *  operator's series of event captures in one form shares one
     *  run. */
    public static final UUID EVENT_CAPTURE_WORKFLOW_ID
        = UUID.fromString("00000000-0000-0000-0000-000000000004");

    /** DHIS2 Tracker Capture passthrough — TEI + enrollment + tracker
     *  stage events. One run per {@code (program, orgUnit, submitter)}
     *  so an operator's full tracker registration (register +
     *  enrol + initial visit) shares one trackable run. */
    public static final UUID TRACKER_CAPTURE_WORKFLOW_ID
        = UUID.fromString("00000000-0000-0000-0000-000000000005");

    private final JdbcTemplate jdbc;
    private final Clock clock;

    public SystemWorkflowService(final JdbcTemplate jdbc, final Clock clock) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    /** Returns the open system run for a web-app aggregate submission,
     *  creating one if necessary. Business key = dataSet / orgUnit /
     *  period / submitter so parallel captures by the same user for
     *  the same cell collapse to one run instead of a run-per-POST. */
    @Transactional
    public UUID ensureWebAppCaptureRun(final String dataSetUid,
                                        final String orgUnitUid,
                                        final String periodIso,
                                        final UUID actor) {
        Objects.requireNonNull(dataSetUid, "dataSetUid");
        Objects.requireNonNull(orgUnitUid, "orgUnitUid");
        Objects.requireNonNull(periodIso, "periodIso");
        Objects.requireNonNull(actor, "actor");
        final String bk = dataSetUid + '|' + orgUnitUid + '|' + periodIso + '|' + actor;
        return ensureRun(WEB_APP_CAPTURE_WORKFLOW_ID, bk, actor);
    }

    /** Returns the system run for a referral ingest entry, creating
     *  one if necessary. Business key = inbox id. */
    @Transactional
    public UUID ensureReferralIngestRun(final String inboxId, final UUID actor) {
        Objects.requireNonNull(inboxId, "inboxId");
        Objects.requireNonNull(actor, "actor");
        return ensureRun(REFERRAL_INGEST_WORKFLOW_ID, inboxId, actor);
    }

    /** Returns the system run for the DHIS2 Event / Tracker capture
     *  app passthrough, creating one if necessary. Business key =
     *  {@code program|programStage|orgUnit|submitter}. */
    @Transactional
    public UUID ensureEventCaptureRun(final String programUid,
                                        final String programStageUid,
                                        final String orgUnitUid,
                                        final UUID actor) {
        Objects.requireNonNull(programUid, "programUid");
        Objects.requireNonNull(programStageUid, "programStageUid");
        Objects.requireNonNull(orgUnitUid, "orgUnitUid");
        Objects.requireNonNull(actor, "actor");
        final String bk = programUid + '|' + programStageUid + '|' + orgUnitUid + '|' + actor;
        return ensureRun(EVENT_CAPTURE_WORKFLOW_ID, bk, actor);
    }

    /** Returns the system run for a DHIS2 Tracker Capture
     *  passthrough, creating one if necessary. Business key =
     *  {@code program|orgUnit|submitter}. Enrolment, TEI, and
     *  tracker events captured in one session share the same run. */
    @Transactional
    public UUID ensureTrackerCaptureRun(final String programUid,
                                          final String orgUnitUid,
                                          final UUID actor) {
        Objects.requireNonNull(programUid, "programUid");
        Objects.requireNonNull(orgUnitUid, "orgUnitUid");
        Objects.requireNonNull(actor, "actor");
        final String bk = programUid + '|' + orgUnitUid + '|' + actor;
        return ensureRun(TRACKER_CAPTURE_WORKFLOW_ID, bk, actor);
    }

    /** Returns the system run for a central-DHIS2 pull batch, creating
     *  one if necessary. Business key =
     *  {@code dataSet|orgUnit|period|submitter} so repeated pulls for
     *  the same scope collapse to one run. */
    @Transactional
    public UUID ensureCentralDownloadRun(final String dataSetUid,
                                           final String orgUnitUid,
                                           final String periodIso,
                                           final UUID actor) {
        Objects.requireNonNull(dataSetUid, "dataSetUid");
        Objects.requireNonNull(orgUnitUid, "orgUnitUid");
        Objects.requireNonNull(periodIso, "periodIso");
        Objects.requireNonNull(actor, "actor");
        final String bk = dataSetUid + '|' + orgUnitUid + '|' + periodIso + '|' + actor;
        return ensureRun(CENTRAL_DOWNLOAD_WORKFLOW_ID, bk, actor);
    }

    private UUID ensureRun(final UUID workflowId, final String businessKey, final UUID actor) {
        final Instant now = Instant.now(clock);
        // Upsert on the (workflow_id, workflow_version, business_key)
        // unique constraint so parallel inserts collapse to one row.
        // RETURNING run_id gives us the surviving row's id whether
        // it was newly inserted or already present.
        final UUID runId = jdbc.queryForObject(
                "INSERT INTO der.capture_workflow_run "
              + "(run_id, workflow_id, workflow_version, business_key, "
              + " state, created_at, updated_at, created_by) "
              + "VALUES (?, ?, 1, ?, 'OPEN', ?, ?, ?) "
              + "ON CONFLICT (workflow_id, workflow_version, business_key) "
              + "DO UPDATE SET updated_at = EXCLUDED.updated_at "
              + "RETURNING run_id",
                UUID.class,
                UUID.randomUUID(), workflowId, businessKey,
                Timestamp.from(now), Timestamp.from(now), actor);
        return Objects.requireNonNull(runId, "ensureRun must return a run_id");
    }
}
