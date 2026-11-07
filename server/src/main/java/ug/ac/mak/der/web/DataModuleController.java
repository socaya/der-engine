package ug.ac.mak.der.web;

import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonProperty;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

import ug.ac.mak.der.dhis2.Dhis2ReferenceClient;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.util.DhisPeriodCodes;
import ug.ac.mak.der.workflows.aggregate.CentralDownloadService;

/**
 * §2.3.81 — Admin-facing read surface for the DER local data store.
 *
 * <p>The DER edge *is* the facility's local DHIS2 for day-to-day
 * capture: every write first lands in a local domain table
 * ({@code aggregate_data_value}, {@code event}, …), is journalled
 * atomically into {@code operation_journal}, then drained by the
 * sync worker.</p>
 *
 * <p>Until now the admin UI did not expose any of that locally-stored
 * data — the Data module screens just launched the DHIS2 web apps.
 * This controller surfaces the local rows + the per-row sync state so
 * admins can see what's stored, what's in the outbox, and what's
 * already made it to Central.</p>
 *
 * <p>This release ships <b>aggregate</b> only. Events / enrolments /
 * TEIs follow in later R-C releases.</p>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/data",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class DataModuleController {

    private final JdbcTemplate jdbc;
    private final CentralDownloadService centralDownload;

    public DataModuleController(final JdbcTemplate jdbc,
                                  final CentralDownloadService centralDownload) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.centralDownload = Objects.requireNonNull(centralDownload, "centralDownload");
    }

    /** Pipeline strip + per-row browse for aggregate data values.
     *
     *  Query params (all optional):
     *   - {@code orgUnit}   — orgUnit UID filter
     *   - {@code period}    — ISO period filter (e.g. 202411)
     *   - {@code dataElement} — dataElement UID filter
     *   - {@code limit}     — row cap (default 100, max 500)
     */
    @GetMapping("/aggregate")
    public ResponseEntity<Map<String, Object>> aggregate(
            @RequestParam(required = false) final String orgUnit,
            @RequestParam(required = false) final String period,
            @RequestParam(required = false) final String dataElement,
            @RequestParam(required = false) final String dataSet,
            @RequestParam(required = false) final String workflowRunId,
            @RequestParam(required = false) final String workflowId,
            @RequestParam(required = false, defaultValue = "100") final int limit) {

        // §2.3.100 R-J — reject malformed DHIS2 period codes fast
        // (hand-crafted request bypassing the PeriodPicker). Keeps
        // operators from being puzzled by a "working" filter that
        // silently returns 0 rows.
        if (period != null && !period.isBlank() && !DhisPeriodCodes.isValid(period)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "PERIOD_INVALID",
                    "message", "period '" + period + "' is not a valid DHIS2 period code"));
        }
        final int capped = Math.max(1, Math.min(limit, 500));

        // Rows: aggregate_data_value LEFT JOIN latest matching journal
        // entry so each row carries its outbox state. AggregateDataValueService
        // coalesces per form bucket on submit, so entity_ref matches
        // FormKey.toCompoundKey(): "dataSet:orgUnit:period:aoc".
        // Every value in the same form shares the envelope's latest state.
        final String keyExpr =
                "(av.data_set_uid || ':' || av.org_unit_uid || ':' "
              + " || av.period_iso || ':' || av.attribute_option_combo_uid)";
        final StringBuilder sql = new StringBuilder(
                "SELECT av.value_id, av.data_element_uid, av.org_unit_uid, "
              + "       av.period_iso, av.category_option_combo_uid, "
              + "       av.attribute_option_combo_uid, av.value_text, "
              + "       av.comment, av.submitted_by, av.submitted_at, "
              + "       av.value_version, av.data_set_uid, "
              + "       av.workflow_run_id, "
              + "       ds.display_name AS data_set_name, "
              + "       wf.display_name AS workflow_name, "
              + "       cwr.business_key AS workflow_business_key, "
              + "       wf.kind AS workflow_kind, "
              + "       (SELECT state FROM der.operation_journal oj "
              + "          WHERE oj.entity_type = 'AGGREGATE_DATA_VALUE' "
              + "            AND oj.entity_ref = " + keyExpr + " "
              + "          ORDER BY oj.created_at DESC LIMIT 1) AS sync_state, "
              + "       (SELECT operation_id FROM der.operation_journal oj "
              + "          WHERE oj.entity_type = 'AGGREGATE_DATA_VALUE' "
              + "            AND oj.entity_ref = " + keyExpr + " "
              + "          ORDER BY oj.created_at DESC LIMIT 1) AS operation_id "
              + "FROM der.aggregate_data_value av "
              + "LEFT JOIN der.metadata_data_set ds "
              + "       ON ds.dhis2_uid = av.data_set_uid "
              + "LEFT JOIN der.capture_workflow_run cwr "
              + "       ON cwr.run_id = av.workflow_run_id "
              + "LEFT JOIN der.capture_workflow wf "
              + "       ON wf.workflow_id = cwr.workflow_id "
              + "WHERE 1 = 1 ");
        final List<Object> args = new ArrayList<>();
        if (orgUnit != null && !orgUnit.isBlank()) {
            sql.append(" AND av.org_unit_uid = ?");
            args.add(orgUnit);
        }
        if (period != null && !period.isBlank()) {
            sql.append(" AND av.period_iso = ?");
            args.add(period);
        }
        if (dataElement != null && !dataElement.isBlank()) {
            sql.append(" AND av.data_element_uid = ?");
            args.add(dataElement);
        }
        if (dataSet != null && !dataSet.isBlank()) {
            sql.append(" AND av.data_set_uid = ?");
            args.add(dataSet);
        }
        if (workflowRunId != null && !workflowRunId.isBlank()) {
            sql.append(" AND av.workflow_run_id = ?::uuid");
            args.add(workflowRunId);
        }
        if (workflowId != null && !workflowId.isBlank()) {
            // §2.3.97 R-E — rows whose capture run belongs to this workflow
            // definition (matches any run of this workflow, not a specific one).
            sql.append(" AND cwr.workflow_id = ?::uuid");
            args.add(workflowId);
        }
        sql.append(" ORDER BY av.submitted_at DESC NULLS LAST LIMIT ?");
        args.add(capped);

        final List<Map<String, Object>> rows =
                jdbc.query(sql.toString(), rowMapper(), args.toArray());

        // Pipeline summary — counts across the whole store, not the
        // filtered page, so admins see the facility picture at a glance.
        final Map<String, Object> pipeline = new LinkedHashMap<>();
        pipeline.put("captured", countAll());
        pipeline.put("inJournal",   countJournalIn(List.of("PENDING", "IN_FLIGHT", "RETRYABLE")));
        pipeline.put("pendingPush", countJournalIn(List.of("PENDING", "RETRYABLE")));
        pipeline.put("synced",      countJournalIn(List.of("CENTRAL_ACCEPTED")));
        pipeline.put("attention",   countJournalIn(List.of("CONFLICT_REVIEW", "CENTRAL_REJECTED")));

        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("rows", rows);
        body.put("limit", capped);
        body.put("pipeline", pipeline);
        return ResponseEntity.ok(body);
    }

    private int countAll() {
        final Integer n = jdbc.queryForObject(
                "SELECT COUNT(*)::int FROM der.aggregate_data_value", Integer.class);
        return n == null ? 0 : n;
    }

    /** §2.3.89 R-C/3 — Admin browse for locally-stored tracker rows.
     *
     *  <p>The "tracker" surface combines three local tables because
     *  operators think of them as one capture: TEIs
     *  ({@code tracked_entity}), enrolments ({@code edge_enrollment})
     *  and tracker stage events ({@code edge_tracker_event}). Each
     *  row carries its workflow lineage + a resolved display name
     *  for program / TE type / workflow kind.</p>
     *
     *  Query params (all optional):
     *   - {@code kind}           — TEI | ENROLLMENT | EVENT; default = all
     *   - {@code program}        — program UID filter (enrolment + event)
     *   - {@code orgUnit}        — orgUnit UID filter
     *   - {@code teiUid}         — scope to a single TEI's enrolments + events
     *   - {@code workflowRunId}  — scope by capture workflow run
     *   - {@code limit}          — row cap (default 100, max 500)
     */
    @GetMapping("/tracker")
    public ResponseEntity<Map<String, Object>> tracker(
            @RequestParam(required = false) final String kind,
            @RequestParam(required = false) final String program,
            @RequestParam(required = false) final String orgUnit,
            @RequestParam(required = false) final String teiUid,
            @RequestParam(required = false) final String workflowRunId,
            @RequestParam(required = false) final String workflowId,
            @RequestParam(required = false) final String occurredFrom,
            @RequestParam(required = false) final String occurredTo,
            @RequestParam(required = false, defaultValue = "100") final int limit) {
        final int capped = Math.max(1, Math.min(limit, 500));
        final String want = kind == null ? "" : kind.toUpperCase();
        final List<Map<String, Object>> rows = new ArrayList<>();
        if (want.isEmpty() || want.equals("TEI")) {
            // TEIs don't have an occurred date — the date range only
            // narrows enrolment + event hits. TEI rows are included
            // unfiltered on purpose so the ?teiUid= zoom still works
            // when combined with a range.
            rows.addAll(fetchTeis(orgUnit, teiUid, workflowRunId, workflowId, capped));
        }
        if (want.isEmpty() || want.equals("ENROLLMENT")) {
            rows.addAll(fetchEnrolments(program, orgUnit, teiUid, workflowRunId, workflowId,
                                         occurredFrom, occurredTo, capped));
        }
        if (want.isEmpty() || want.equals("EVENT")) {
            rows.addAll(fetchTrackerEvents(program, orgUnit, teiUid, workflowRunId, workflowId,
                                            occurredFrom, occurredTo, capped));
        }
        // Sort combined set by sortTs desc so TEIs / enrolments / events
        // interleave by time in the admin table.
        rows.sort((a, b) -> {
            final String ta = (String) a.get("sortTs");
            final String tb = (String) b.get("sortTs");
            if (ta == null) {
                return tb == null ? 0 : 1;
            }
            if (tb == null) {
                return -1;
            }
            return tb.compareTo(ta);
        });
        final List<Map<String, Object>> capped2 = rows.size() > capped
                ? rows.subList(0, capped) : rows;
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("rows", capped2);
        body.put("limit", capped);
        return ResponseEntity.ok(body);
    }

    private List<Map<String, Object>> fetchTeis(final String orgUnit, final String teiUid,
                                                   final String workflowRunId,
                                                   final String workflowId, final int limit) {
        final StringBuilder sql = new StringBuilder(
                "SELECT te.tei_uid, te.tracked_entity_type, te.org_unit_uid, "
              + "       te.created_at, te.updated_at, te.tei_version, "
              + "       te.workflow_run_id, mtet.display_name AS te_type_name, "
              + "       wf.display_name AS workflow_name, "
              + "       cwr.business_key AS workflow_business_key, "
              + "       wf.kind AS workflow_kind, "
              + "       (SELECT state FROM der.operation_journal oj "
              + "          WHERE oj.entity_type = 'TRACKED_ENTITY' "
              + "            AND oj.entity_ref = te.tei_uid "
              + "          ORDER BY oj.created_at DESC LIMIT 1) AS sync_state, "
              + "       (SELECT operation_id FROM der.operation_journal oj "
              + "          WHERE oj.entity_type = 'TRACKED_ENTITY' "
              + "            AND oj.entity_ref = te.tei_uid "
              + "          ORDER BY oj.created_at DESC LIMIT 1) AS operation_id "
              + "FROM der.tracked_entity te "
              + "LEFT JOIN der.metadata_tracked_entity_type mtet "
              + "       ON mtet.dhis2_uid = te.tracked_entity_type "
              + "LEFT JOIN der.capture_workflow_run cwr "
              + "       ON cwr.run_id = te.workflow_run_id "
              + "LEFT JOIN der.capture_workflow wf "
              + "       ON wf.workflow_id = cwr.workflow_id "
              + "WHERE 1 = 1 ");
        final java.util.List<Object> args = new java.util.ArrayList<>();
        if (orgUnit != null && !orgUnit.isBlank()) {
            sql.append(" AND te.org_unit_uid = ?");
            args.add(orgUnit);
        }
        if (teiUid != null && !teiUid.isBlank()) {
            sql.append(" AND te.tei_uid = ?");
            args.add(teiUid);
        }
        if (workflowRunId != null && !workflowRunId.isBlank()) {
            sql.append(" AND te.workflow_run_id = ?::uuid");
            args.add(workflowRunId);
        }
        if (workflowId != null && !workflowId.isBlank()) {
            sql.append(" AND cwr.workflow_id = ?::uuid");
            args.add(workflowId);
        }
        sql.append(" ORDER BY te.updated_at DESC LIMIT ?");
        args.add(limit);
        return jdbc.query(sql.toString(), (ResultSet rs, int i) -> {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("kind", "TEI");
            m.put("rowId", rs.getString("tei_uid"));
            m.put("teiUid", rs.getString("tei_uid"));
            m.put("teType", rs.getString("tracked_entity_type"));
            m.put("teTypeName", rs.getString("te_type_name"));
            m.put("orgUnitUid", rs.getString("org_unit_uid"));
            m.put("version", rs.getInt("tei_version"));
            m.put("createdAt", rs.getTimestamp("created_at") == null ? null
                    : rs.getTimestamp("created_at").toInstant().toString());
            m.put("sortTs", rs.getTimestamp("updated_at") == null ? null
                    : rs.getTimestamp("updated_at").toInstant().toString());
            m.put("workflowRunId", rs.getString("workflow_run_id"));
            m.put("workflowName", rs.getString("workflow_name"));
            m.put("workflowBusinessKey", rs.getString("workflow_business_key"));
            m.put("workflowKind", rs.getString("workflow_kind"));
            m.put("syncState", rs.getString("sync_state"));
            m.put("operationId", rs.getString("operation_id"));
            return m;
        }, args.toArray());
    }

    private List<Map<String, Object>> fetchEnrolments(final String program,
                                                        final String orgUnit,
                                                        final String teiUid,
                                                        final String workflowRunId,
                                                        final String workflowId,
                                                        final String occurredFrom,
                                                        final String occurredTo,
                                                        final int limit) {
        final StringBuilder sql = new StringBuilder(
                "SELECT en.enrollment_uid, en.tei_uid, en.program_uid, "
              + "       en.org_unit_uid, en.status, en.enrollment_date, "
              + "       en.updated_at, en.version, en.workflow_run_id, "
              + "       mp.display_name AS program_name, "
              + "       wf.display_name AS workflow_name, "
              + "       cwr.business_key AS workflow_business_key, "
              + "       wf.kind AS workflow_kind, "
              + "       (SELECT state FROM der.operation_journal oj "
              + "          WHERE oj.entity_type = 'ENROLLMENT' "
              + "            AND oj.entity_ref = en.enrollment_uid "
              + "          ORDER BY oj.created_at DESC LIMIT 1) AS sync_state, "
              + "       (SELECT operation_id FROM der.operation_journal oj "
              + "          WHERE oj.entity_type = 'ENROLLMENT' "
              + "            AND oj.entity_ref = en.enrollment_uid "
              + "          ORDER BY oj.created_at DESC LIMIT 1) AS operation_id "
              + "FROM der.edge_enrollment en "
              + "LEFT JOIN der.metadata_program mp "
              + "       ON mp.dhis2_uid = en.program_uid "
              + "LEFT JOIN der.capture_workflow_run cwr "
              + "       ON cwr.run_id = en.workflow_run_id "
              + "LEFT JOIN der.capture_workflow wf "
              + "       ON wf.workflow_id = cwr.workflow_id "
              + "WHERE 1 = 1 ");
        final java.util.List<Object> args = new java.util.ArrayList<>();
        if (program != null && !program.isBlank()) {
            sql.append(" AND en.program_uid = ?");
            args.add(program);
        }
        if (orgUnit != null && !orgUnit.isBlank()) {
            sql.append(" AND en.org_unit_uid = ?");
            args.add(orgUnit);
        }
        if (teiUid != null && !teiUid.isBlank()) {
            sql.append(" AND en.tei_uid = ?");
            args.add(teiUid);
        }
        if (workflowRunId != null && !workflowRunId.isBlank()) {
            sql.append(" AND en.workflow_run_id = ?::uuid");
            args.add(workflowRunId);
        }
        if (workflowId != null && !workflowId.isBlank()) {
            sql.append(" AND cwr.workflow_id = ?::uuid");
            args.add(workflowId);
        }
        if (occurredFrom != null && !occurredFrom.isBlank()) {
            sql.append(" AND en.enrollment_date >= ?::date");
            args.add(occurredFrom);
        }
        if (occurredTo != null && !occurredTo.isBlank()) {
            sql.append(" AND en.enrollment_date <= ?::date");
            args.add(occurredTo);
        }
        sql.append(" ORDER BY en.updated_at DESC LIMIT ?");
        args.add(limit);
        return jdbc.query(sql.toString(), (ResultSet rs, int i) -> {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("kind", "ENROLLMENT");
            m.put("rowId", rs.getString("enrollment_uid"));
            m.put("enrollmentUid", rs.getString("enrollment_uid"));
            m.put("teiUid", rs.getString("tei_uid"));
            m.put("programUid", rs.getString("program_uid"));
            m.put("programName", rs.getString("program_name"));
            m.put("orgUnitUid", rs.getString("org_unit_uid"));
            m.put("status", rs.getString("status"));
            m.put("enrollmentDate", rs.getDate("enrollment_date") == null ? null
                    : rs.getDate("enrollment_date").toString());
            m.put("version", rs.getInt("version"));
            m.put("sortTs", rs.getTimestamp("updated_at") == null ? null
                    : rs.getTimestamp("updated_at").toInstant().toString());
            m.put("workflowRunId", rs.getString("workflow_run_id"));
            m.put("workflowName", rs.getString("workflow_name"));
            m.put("workflowBusinessKey", rs.getString("workflow_business_key"));
            m.put("workflowKind", rs.getString("workflow_kind"));
            m.put("syncState", rs.getString("sync_state"));
            m.put("operationId", rs.getString("operation_id"));
            return m;
        }, args.toArray());
    }

    private List<Map<String, Object>> fetchTrackerEvents(final String program,
                                                           final String orgUnit,
                                                           final String teiUid,
                                                           final String workflowRunId,
                                                           final String workflowId,
                                                           final String occurredFrom,
                                                           final String occurredTo,
                                                           final int limit) {
        final StringBuilder sql = new StringBuilder(
                "SELECT ev.event_uid, ev.enrollment_uid, en.tei_uid, "
              + "       ev.program_uid, ev.program_stage_uid, ev.org_unit_uid, "
              + "       ev.status, ev.occurred_date, ev.updated_at, ev.version, "
              + "       ev.workflow_run_id, "
              + "       mp.display_name AS program_name, "
              + "       mps.display_name AS program_stage_name, "
              + "       wf.display_name AS workflow_name, "
              + "       cwr.business_key AS workflow_business_key, "
              + "       wf.kind AS workflow_kind, "
              + "       (SELECT state FROM der.operation_journal oj "
              + "          WHERE oj.entity_type = 'PROGRAM_STAGE_EVENT' "
              + "            AND oj.entity_ref = ev.event_uid "
              + "          ORDER BY oj.created_at DESC LIMIT 1) AS sync_state, "
              + "       (SELECT operation_id FROM der.operation_journal oj "
              + "          WHERE oj.entity_type = 'PROGRAM_STAGE_EVENT' "
              + "            AND oj.entity_ref = ev.event_uid "
              + "          ORDER BY oj.created_at DESC LIMIT 1) AS operation_id "
              + "FROM der.edge_tracker_event ev "
              + "LEFT JOIN der.edge_enrollment en "
              + "       ON en.enrollment_uid = ev.enrollment_uid "
              + "LEFT JOIN der.metadata_program mp "
              + "       ON mp.dhis2_uid = ev.program_uid "
              + "LEFT JOIN der.metadata_program_stage mps "
              + "       ON mps.dhis2_uid = ev.program_stage_uid "
              + "LEFT JOIN der.capture_workflow_run cwr "
              + "       ON cwr.run_id = ev.workflow_run_id "
              + "LEFT JOIN der.capture_workflow wf "
              + "       ON wf.workflow_id = cwr.workflow_id "
              + "WHERE 1 = 1 ");
        final java.util.List<Object> args = new java.util.ArrayList<>();
        if (program != null && !program.isBlank()) {
            sql.append(" AND ev.program_uid = ?");
            args.add(program);
        }
        if (orgUnit != null && !orgUnit.isBlank()) {
            sql.append(" AND ev.org_unit_uid = ?");
            args.add(orgUnit);
        }
        if (teiUid != null && !teiUid.isBlank()) {
            sql.append(" AND en.tei_uid = ?");
            args.add(teiUid);
        }
        if (workflowRunId != null && !workflowRunId.isBlank()) {
            sql.append(" AND ev.workflow_run_id = ?::uuid");
            args.add(workflowRunId);
        }
        if (workflowId != null && !workflowId.isBlank()) {
            sql.append(" AND cwr.workflow_id = ?::uuid");
            args.add(workflowId);
        }
        if (occurredFrom != null && !occurredFrom.isBlank()) {
            sql.append(" AND ev.occurred_date >= ?::date");
            args.add(occurredFrom);
        }
        if (occurredTo != null && !occurredTo.isBlank()) {
            sql.append(" AND ev.occurred_date <= ?::date");
            args.add(occurredTo);
        }
        sql.append(" ORDER BY ev.updated_at DESC LIMIT ?");
        args.add(limit);
        return jdbc.query(sql.toString(), (ResultSet rs, int i) -> {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("kind", "EVENT");
            m.put("rowId", rs.getString("event_uid"));
            m.put("eventUid", rs.getString("event_uid"));
            m.put("enrollmentUid", rs.getString("enrollment_uid"));
            m.put("teiUid", rs.getString("tei_uid"));
            m.put("programUid", rs.getString("program_uid"));
            m.put("programName", rs.getString("program_name"));
            m.put("programStageUid", rs.getString("program_stage_uid"));
            m.put("programStageName", rs.getString("program_stage_name"));
            m.put("orgUnitUid", rs.getString("org_unit_uid"));
            m.put("status", rs.getString("status"));
            m.put("occurredDate", rs.getDate("occurred_date") == null ? null
                    : rs.getDate("occurred_date").toString());
            m.put("version", rs.getInt("version"));
            m.put("sortTs", rs.getTimestamp("updated_at") == null ? null
                    : rs.getTimestamp("updated_at").toInstant().toString());
            m.put("workflowRunId", rs.getString("workflow_run_id"));
            m.put("workflowName", rs.getString("workflow_name"));
            m.put("workflowBusinessKey", rs.getString("workflow_business_key"));
            m.put("workflowKind", rs.getString("workflow_kind"));
            m.put("syncState", rs.getString("sync_state"));
            m.put("operationId", rs.getString("operation_id"));
            return m;
        }, args.toArray());
    }

    /** §2.3.87 R-C/2 — Admin browse for locally-stored events.
     *
     *  Query params (all optional):
     *   - {@code program}        — program UID
     *   - {@code programStage}   — program-stage UID
     *   - {@code orgUnit}        — orgUnit UID
     *   - {@code status}         — event status enum
     *   - {@code workflowRunId}  — scope by capture workflow run
     *   - {@code limit}          — row cap (default 100, max 500)
     */
    @GetMapping("/events")
    public ResponseEntity<Map<String, Object>> events(
            @RequestParam(required = false) final String program,
            @RequestParam(required = false) final String programStage,
            @RequestParam(required = false) final String orgUnit,
            @RequestParam(required = false) final String status,
            @RequestParam(required = false) final String workflowRunId,
            @RequestParam(required = false) final String workflowId,
            @RequestParam(required = false) final String occurredFrom,
            @RequestParam(required = false) final String occurredTo,
            @RequestParam(required = false, defaultValue = "100") final int limit) {
        final int capped = Math.max(1, Math.min(limit, 500));
        final StringBuilder sql = new StringBuilder(
                "SELECT ev.event_id, ev.enrollment_id, ev.program_uid, "
              + "       ev.program_stage_uid, ev.org_unit_uid, ev.occurred_at, "
              + "       ev.status, ev.attribute_option_combo_uid, ev.created_by, "
              + "       ev.event_version, ev.workflow_run_id, "
              + "       mp.display_name AS program_name, "
              + "       ms.display_name AS program_stage_name, "
              + "       wf.display_name AS workflow_name, "
              + "       cwr.business_key AS workflow_business_key, "
              + "       wf.kind AS workflow_kind, "
              + "       (SELECT state FROM der.operation_journal oj "
              + "          WHERE oj.entity_type = 'EVENT' "
              + "            AND oj.entity_ref = ev.event_id::text "
              + "          ORDER BY oj.created_at DESC LIMIT 1) AS sync_state, "
              + "       (SELECT operation_id FROM der.operation_journal oj "
              + "          WHERE oj.entity_type = 'EVENT' "
              + "            AND oj.entity_ref = ev.event_id::text "
              + "          ORDER BY oj.created_at DESC LIMIT 1) AS operation_id, "
              + "       (SELECT COUNT(*)::int FROM der.event_data_value edv "
              + "          WHERE edv.event_id = ev.event_id) AS data_value_count "
              + "FROM der.event ev "
              + "LEFT JOIN der.metadata_program mp "
              + "       ON mp.dhis2_uid = ev.program_uid "
              + "LEFT JOIN der.metadata_program_stage ms "
              + "       ON ms.dhis2_uid = ev.program_stage_uid "
              + "LEFT JOIN der.capture_workflow_run cwr "
              + "       ON cwr.run_id = ev.workflow_run_id "
              + "LEFT JOIN der.capture_workflow wf "
              + "       ON wf.workflow_id = cwr.workflow_id "
              + "WHERE 1 = 1 ");
        final java.util.List<Object> args = new java.util.ArrayList<>();
        if (program != null && !program.isBlank()) {
            sql.append(" AND ev.program_uid = ?");
            args.add(program);
        }
        if (programStage != null && !programStage.isBlank()) {
            sql.append(" AND ev.program_stage_uid = ?");
            args.add(programStage);
        }
        if (orgUnit != null && !orgUnit.isBlank()) {
            sql.append(" AND ev.org_unit_uid = ?");
            args.add(orgUnit);
        }
        if (status != null && !status.isBlank()) {
            sql.append(" AND ev.status = ?");
            args.add(status);
        }
        if (workflowRunId != null && !workflowRunId.isBlank()) {
            sql.append(" AND ev.workflow_run_id = ?::uuid");
            args.add(workflowRunId);
        }
        if (workflowId != null && !workflowId.isBlank()) {
            sql.append(" AND cwr.workflow_id = ?::uuid");
            args.add(workflowId);
        }
        // §2.3.102 R-P — occurred-at date range (inclusive).
        if (occurredFrom != null && !occurredFrom.isBlank()) {
            sql.append(" AND ev.occurred_at >= ?::date");
            args.add(occurredFrom);
        }
        if (occurredTo != null && !occurredTo.isBlank()) {
            sql.append(" AND ev.occurred_at < (?::date + INTERVAL '1 day')");
            args.add(occurredTo);
        }
        sql.append(" ORDER BY ev.occurred_at DESC NULLS LAST LIMIT ?");
        args.add(capped);

        final List<Map<String, Object>> rows = jdbc.query(sql.toString(),
                (ResultSet rs, int i) -> {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("eventId",              rs.getString("event_id"));
            m.put("enrollmentId",         rs.getString("enrollment_id"));
            m.put("programUid",           rs.getString("program_uid"));
            m.put("programName",          rs.getString("program_name"));
            m.put("programStageUid",      rs.getString("program_stage_uid"));
            m.put("programStageName",     rs.getString("program_stage_name"));
            m.put("orgUnitUid",           rs.getString("org_unit_uid"));
            m.put("occurredAt", rs.getTimestamp("occurred_at") == null ? null
                                 : rs.getTimestamp("occurred_at").toInstant().toString());
            m.put("status",               rs.getString("status"));
            m.put("eventVersion",         rs.getInt("event_version"));
            m.put("dataValueCount",       rs.getInt("data_value_count"));
            m.put("workflowRunId",        rs.getString("workflow_run_id"));
            m.put("workflowName",         rs.getString("workflow_name"));
            m.put("workflowBusinessKey",  rs.getString("workflow_business_key"));
            m.put("workflowKind",         rs.getString("workflow_kind"));
            m.put("syncState",            rs.getString("sync_state"));
            m.put("operationId",          rs.getString("operation_id"));
            return m;
        }, args.toArray());

        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("rows", rows);
        body.put("limit", capped);
        return ResponseEntity.ok(body);
    }

    /** §2.3.92 R-C/2.2 — Admin row-detail for a single aggregate
     *  value. Returns the row (with resolved dataset / data element /
     *  workflow names) + its outbox journal history + any sync
     *  attention/conflict rows. Used by the `/data/aggregate/:valueId`
     *  admin page. */
    @GetMapping("/aggregate/{valueId}")
    public ResponseEntity<Map<String, Object>> aggregateDetail(
            @org.springframework.web.bind.annotation.PathVariable final String valueId) {
        if (valueId == null || valueId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "valueId required"));
        }
        final List<Map<String, Object>> rows = jdbc.query(
                "SELECT av.value_id, av.data_element_uid, av.org_unit_uid, "
              + "       av.period_iso, av.category_option_combo_uid, "
              + "       av.attribute_option_combo_uid, av.value_text, "
              + "       av.comment, av.submitted_by, av.submitted_at, "
              + "       av.value_version, av.data_set_uid, av.workflow_run_id, "
              + "       mde.display_name AS data_element_name, "
              + "       ds.display_name AS data_set_name, "
              + "       mou.display_name AS org_unit_name, "
              + "       wf.display_name AS workflow_name, "
              + "       cwr.business_key AS workflow_business_key, "
              + "       wf.kind AS workflow_kind, "
              + "       eu.username AS submitted_by_username "
              + "FROM der.aggregate_data_value av "
              + "LEFT JOIN der.metadata_data_set ds "
              + "       ON ds.dhis2_uid = av.data_set_uid "
              + "LEFT JOIN der.metadata_data_element mde "
              + "       ON mde.dhis2_uid = av.data_element_uid "
              + "LEFT JOIN der.metadata_organisation_unit mou "
              + "       ON mou.dhis2_uid = av.org_unit_uid "
              + "LEFT JOIN der.capture_workflow_run cwr "
              + "       ON cwr.run_id = av.workflow_run_id "
              + "LEFT JOIN der.capture_workflow wf "
              + "       ON wf.workflow_id = cwr.workflow_id "
              + "LEFT JOIN der.edge_user eu "
              + "       ON eu.user_id = av.submitted_by "
              + "WHERE av.value_id = ?::uuid",
                (ResultSet rs, int i) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("valueId",                rs.getString("value_id"));
                    m.put("dataElementUid",         rs.getString("data_element_uid"));
                    m.put("dataElementName",        rs.getString("data_element_name"));
                    m.put("orgUnitUid",             rs.getString("org_unit_uid"));
                    m.put("orgUnitName",            rs.getString("org_unit_name"));
                    m.put("periodIso",              rs.getString("period_iso"));
                    m.put("categoryOptionComboUid", rs.getString("category_option_combo_uid"));
                    m.put("attributeOptionComboUid", rs.getString("attribute_option_combo_uid"));
                    m.put("valueText",              rs.getString("value_text"));
                    m.put("comment",                rs.getString("comment"));
                    m.put("submittedBy",            rs.getString("submitted_by"));
                    m.put("submittedByUsername",    rs.getString("submitted_by_username"));
                    m.put("submittedAt", rs.getTimestamp("submitted_at") == null ? null
                                            : rs.getTimestamp("submitted_at").toInstant().toString());
                    m.put("valueVersion",           rs.getInt("value_version"));
                    m.put("dataSetUid",             rs.getString("data_set_uid"));
                    m.put("dataSetName",            rs.getString("data_set_name"));
                    m.put("workflowRunId",          rs.getString("workflow_run_id"));
                    m.put("workflowName",           rs.getString("workflow_name"));
                    m.put("workflowBusinessKey",    rs.getString("workflow_business_key"));
                    m.put("workflowKind",           rs.getString("workflow_kind"));
                    return m;
                }, valueId);
        if (rows.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final Map<String, Object> row = rows.get(0);
        // Compound key matches AggregateDataValueService FormKey.toCompoundKey()
        // — dataSet:orgUnit:period:aoc — because the journal coalesces one
        // envelope per form bucket, not per cell.
        final String key = row.get("dataSetUid") + ":" + row.get("orgUnitUid")
                + ":" + row.get("periodIso")
                + ":" + row.get("attributeOptionComboUid");
        final List<Map<String, Object>> journal = journalFor(
                "AGGREGATE_DATA_VALUE", key);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("row", row);
        body.put("journal", journal);
        return ResponseEntity.ok(body);
    }

    /**
     * Form-level sync state for the (dataSet, orgUnit, period, aoc) tuple.
     * Used by the data-entry app's cell-details strip to light up the
     * "saved to Central" logo once the drain worker publishes the form.
     * Journal entity_ref is the FormKey compound string, so a single
     * lookup returns the latest envelope state shared by every cell.
     */
    @GetMapping("/aggregate-form-sync-state")
    public ResponseEntity<Map<String, Object>> aggregateFormSyncState(
            @RequestParam final String dataSet,
            @RequestParam final String orgUnit,
            @RequestParam final String period,
            @RequestParam(required = false, defaultValue = "HllvX50cXC0") final String aoc) {
        if (dataSet.isBlank() || orgUnit.isBlank() || period.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "MISSING_PARAM",
                    "message", "dataSet, orgUnit, period are required"));
        }
        final String key = dataSet + ":" + orgUnit + ":" + period + ":" + aoc;
        final List<Map<String, Object>> rows = jdbc.query(
                "SELECT operation_id, state, updated_at, created_at, attempt_count "
              + "FROM der.operation_journal "
              + "WHERE entity_type = 'AGGREGATE_DATA_VALUE' AND entity_ref = ? "
              + "ORDER BY created_at DESC LIMIT 1",
                (ResultSet rs, int i) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("operationId",  rs.getString("operation_id"));
                    m.put("state",        rs.getString("state"));
                    m.put("updatedAt", rs.getTimestamp("updated_at") == null ? null
                            : rs.getTimestamp("updated_at").toInstant().toString());
                    m.put("createdAt", rs.getTimestamp("created_at") == null ? null
                            : rs.getTimestamp("created_at").toInstant().toString());
                    m.put("attemptCount", rs.getInt("attempt_count"));
                    return m;
                }, key);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("formKey", key);
        if (rows.isEmpty()) {
            body.put("state", null);
        } else {
            body.putAll(rows.get(0));
        }
        return ResponseEntity.ok(body);
    }

    /** §2.3.92 R-C/2.2 — Admin row-detail for a single event. */
    @GetMapping("/events/{eventId}")
    public ResponseEntity<Map<String, Object>> eventDetail(
            @org.springframework.web.bind.annotation.PathVariable final String eventId) {
        if (eventId == null || eventId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "eventId required"));
        }
        final List<Map<String, Object>> rows = jdbc.query(
                "SELECT ev.event_id, ev.enrollment_id, ev.program_uid, "
              + "       ev.program_stage_uid, ev.org_unit_uid, ev.occurred_at, "
              + "       ev.status, ev.attribute_option_combo_uid, ev.created_by, "
              + "       ev.event_version, ev.workflow_run_id, "
              + "       mp.display_name AS program_name, "
              + "       ms.display_name AS program_stage_name, "
              + "       mou.display_name AS org_unit_name, "
              + "       wf.display_name AS workflow_name, "
              + "       cwr.business_key AS workflow_business_key, "
              + "       wf.kind AS workflow_kind, "
              + "       eu.username AS created_by_username "
              + "FROM der.event ev "
              + "LEFT JOIN der.metadata_program mp "
              + "       ON mp.dhis2_uid = ev.program_uid "
              + "LEFT JOIN der.metadata_program_stage ms "
              + "       ON ms.dhis2_uid = ev.program_stage_uid "
              + "LEFT JOIN der.metadata_organisation_unit mou "
              + "       ON mou.dhis2_uid = ev.org_unit_uid "
              + "LEFT JOIN der.capture_workflow_run cwr "
              + "       ON cwr.run_id = ev.workflow_run_id "
              + "LEFT JOIN der.capture_workflow wf "
              + "       ON wf.workflow_id = cwr.workflow_id "
              + "LEFT JOIN der.edge_user eu "
              + "       ON eu.user_id = ev.created_by "
              + "WHERE ev.event_id = ?::uuid",
                (ResultSet rs, int i) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("eventId",             rs.getString("event_id"));
                    m.put("enrollmentId",        rs.getString("enrollment_id"));
                    m.put("programUid",          rs.getString("program_uid"));
                    m.put("programName",         rs.getString("program_name"));
                    m.put("programStageUid",     rs.getString("program_stage_uid"));
                    m.put("programStageName",    rs.getString("program_stage_name"));
                    m.put("orgUnitUid",          rs.getString("org_unit_uid"));
                    m.put("orgUnitName",         rs.getString("org_unit_name"));
                    m.put("occurredAt", rs.getTimestamp("occurred_at") == null ? null
                                         : rs.getTimestamp("occurred_at").toInstant().toString());
                    m.put("status",              rs.getString("status"));
                    m.put("eventVersion",        rs.getInt("event_version"));
                    m.put("createdBy",           rs.getString("created_by"));
                    m.put("createdByUsername",   rs.getString("created_by_username"));
                    m.put("workflowRunId",       rs.getString("workflow_run_id"));
                    m.put("workflowName",        rs.getString("workflow_name"));
                    m.put("workflowBusinessKey", rs.getString("workflow_business_key"));
                    m.put("workflowKind",        rs.getString("workflow_kind"));
                    return m;
                }, eventId);
        if (rows.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final Map<String, Object> row = rows.get(0);
        // Child table: data values.
        final List<Map<String, Object>> dataValues = jdbc.query(
                "SELECT edv.data_element_uid, mde.display_name AS data_element_name, "
              + "       edv.value_text "
              + "FROM der.event_data_value edv "
              + "LEFT JOIN der.metadata_data_element mde "
              + "       ON mde.dhis2_uid = edv.data_element_uid "
              + "WHERE edv.event_id = ?::uuid "
              + "ORDER BY edv.data_element_uid",
                (ResultSet rs, int i) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("dataElementUid",  rs.getString("data_element_uid"));
                    m.put("dataElementName", rs.getString("data_element_name"));
                    m.put("valueText",       rs.getString("value_text"));
                    return m;
                }, eventId);
        final List<Map<String, Object>> journal = journalFor("EVENT", eventId);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("row", row);
        body.put("dataValues", dataValues);
        body.put("journal", journal);
        return ResponseEntity.ok(body);
    }

    /** §2.3.92 R-C/2.2 — Admin row-detail for a single tracked
     *  entity: TEI header + attributes + all enrolments + all events
     *  from each enrolment. Used by the Tracker browse "zoom on
     *  TEI" row click. */
    @GetMapping("/tracker/tei/{teiUid}")
    public ResponseEntity<Map<String, Object>> teiDetail(
            @org.springframework.web.bind.annotation.PathVariable final String teiUid) {
        if (teiUid == null || teiUid.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "teiUid required"));
        }
        final List<Map<String, Object>> teiRows = jdbc.query(
                "SELECT te.tei_uid, te.tracked_entity_type, te.org_unit_uid, "
              + "       te.attributes::text AS attributes, te.created_at, "
              + "       te.updated_at, te.tei_version, te.workflow_run_id, "
              + "       mtet.display_name AS te_type_name, "
              + "       mou.display_name AS org_unit_name, "
              + "       wf.display_name AS workflow_name, "
              + "       cwr.business_key AS workflow_business_key, "
              + "       wf.kind AS workflow_kind "
              + "FROM der.tracked_entity te "
              + "LEFT JOIN der.metadata_tracked_entity_type mtet "
              + "       ON mtet.dhis2_uid = te.tracked_entity_type "
              + "LEFT JOIN der.metadata_organisation_unit mou "
              + "       ON mou.dhis2_uid = te.org_unit_uid "
              + "LEFT JOIN der.capture_workflow_run cwr "
              + "       ON cwr.run_id = te.workflow_run_id "
              + "LEFT JOIN der.capture_workflow wf "
              + "       ON wf.workflow_id = cwr.workflow_id "
              + "WHERE te.tei_uid = ?",
                (ResultSet rs, int i) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("teiUid",              rs.getString("tei_uid"));
                    m.put("teType",              rs.getString("tracked_entity_type"));
                    m.put("teTypeName",          rs.getString("te_type_name"));
                    m.put("orgUnitUid",          rs.getString("org_unit_uid"));
                    m.put("orgUnitName",         rs.getString("org_unit_name"));
                    m.put("attributes",          rs.getString("attributes"));
                    m.put("createdAt", rs.getTimestamp("created_at") == null ? null
                                         : rs.getTimestamp("created_at").toInstant().toString());
                    m.put("updatedAt", rs.getTimestamp("updated_at") == null ? null
                                         : rs.getTimestamp("updated_at").toInstant().toString());
                    m.put("version",             rs.getInt("tei_version"));
                    m.put("workflowRunId",       rs.getString("workflow_run_id"));
                    m.put("workflowName",        rs.getString("workflow_name"));
                    m.put("workflowBusinessKey", rs.getString("workflow_business_key"));
                    m.put("workflowKind",        rs.getString("workflow_kind"));
                    return m;
                }, teiUid);
        if (teiRows.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        // All enrolments for this TEI.
        final List<Map<String, Object>> enrolments = jdbc.query(
                "SELECT en.enrollment_uid, en.program_uid, en.org_unit_uid, "
              + "       en.status, en.enrollment_date, en.incident_date, "
              + "       en.updated_at, en.version, en.workflow_run_id, "
              + "       mp.display_name AS program_name, "
              + "       wf.display_name AS workflow_name, "
              + "       wf.kind AS workflow_kind "
              + "FROM der.edge_enrollment en "
              + "LEFT JOIN der.metadata_program mp "
              + "       ON mp.dhis2_uid = en.program_uid "
              + "LEFT JOIN der.capture_workflow_run cwr "
              + "       ON cwr.run_id = en.workflow_run_id "
              + "LEFT JOIN der.capture_workflow wf "
              + "       ON wf.workflow_id = cwr.workflow_id "
              + "WHERE en.tei_uid = ? "
              + "ORDER BY en.enrollment_date DESC",
                (ResultSet rs, int i) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("enrollmentUid", rs.getString("enrollment_uid"));
                    m.put("programUid",    rs.getString("program_uid"));
                    m.put("programName",   rs.getString("program_name"));
                    m.put("orgUnitUid",    rs.getString("org_unit_uid"));
                    m.put("status",        rs.getString("status"));
                    m.put("enrollmentDate",
                        rs.getDate("enrollment_date") == null ? null
                            : rs.getDate("enrollment_date").toString());
                    m.put("incidentDate",
                        rs.getDate("incident_date") == null ? null
                            : rs.getDate("incident_date").toString());
                    m.put("updatedAt",
                        rs.getTimestamp("updated_at") == null ? null
                            : rs.getTimestamp("updated_at").toInstant().toString());
                    m.put("version",       rs.getInt("version"));
                    m.put("workflowRunId", rs.getString("workflow_run_id"));
                    m.put("workflowName",  rs.getString("workflow_name"));
                    m.put("workflowKind",  rs.getString("workflow_kind"));
                    return m;
                }, teiUid);
        // All tracker-stage events for this TEI (via enrolments).
        final List<Map<String, Object>> trackerEvents = jdbc.query(
                "SELECT ev.event_uid, ev.enrollment_uid, ev.program_uid, "
              + "       ev.program_stage_uid, ev.org_unit_uid, "
              + "       ev.status, ev.occurred_date, ev.updated_at, ev.version, "
              + "       mp.display_name AS program_name, "
              + "       mps.display_name AS program_stage_name "
              + "FROM der.edge_tracker_event ev "
              + "JOIN der.edge_enrollment en "
              + "  ON en.enrollment_uid = ev.enrollment_uid "
              + "LEFT JOIN der.metadata_program mp "
              + "       ON mp.dhis2_uid = ev.program_uid "
              + "LEFT JOIN der.metadata_program_stage mps "
              + "       ON mps.dhis2_uid = ev.program_stage_uid "
              + "WHERE en.tei_uid = ? "
              + "ORDER BY ev.occurred_date DESC",
                (ResultSet rs, int i) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("eventUid",         rs.getString("event_uid"));
                    m.put("enrollmentUid",    rs.getString("enrollment_uid"));
                    m.put("programUid",       rs.getString("program_uid"));
                    m.put("programName",      rs.getString("program_name"));
                    m.put("programStageUid",  rs.getString("program_stage_uid"));
                    m.put("programStageName", rs.getString("program_stage_name"));
                    m.put("orgUnitUid",       rs.getString("org_unit_uid"));
                    m.put("status",           rs.getString("status"));
                    m.put("occurredDate",
                        rs.getDate("occurred_date") == null ? null
                            : rs.getDate("occurred_date").toString());
                    m.put("updatedAt",
                        rs.getTimestamp("updated_at") == null ? null
                            : rs.getTimestamp("updated_at").toInstant().toString());
                    m.put("version",          rs.getInt("version"));
                    return m;
                }, teiUid);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("tei", teiRows.get(0));
        body.put("enrolments", enrolments);
        body.put("trackerEvents", trackerEvents);
        return ResponseEntity.ok(body);
    }

    /** Shared helper — returns the operation_journal history for a
     *  given entity_type + entity_ref, newest first, projecting each
     *  row into the admin row-detail shape (state / timestamps /
     *  attempt count / last error / next hop). */
    private List<Map<String, Object>> journalFor(final String entityType,
                                                    final String entityRef) {
        return jdbc.query(
                "SELECT operation_id, state, attempt_count, last_error, "
              + "       created_at, updated_at, next_hop_org_unit_uid "
              + "FROM der.operation_journal "
              + "WHERE entity_type = ? AND entity_ref = ? "
              + "ORDER BY created_at DESC LIMIT 20",
                (ResultSet rs, int i) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("operationId",       rs.getString("operation_id"));
                    m.put("state",             rs.getString("state"));
                    m.put("attemptCount",      rs.getInt("attempt_count"));
                    m.put("lastError",         rs.getString("last_error"));
                    m.put("createdAt",
                        rs.getTimestamp("created_at") == null ? null
                            : rs.getTimestamp("created_at").toInstant().toString());
                    m.put("updatedAt",
                        rs.getTimestamp("updated_at") == null ? null
                            : rs.getTimestamp("updated_at").toInstant().toString());
                    m.put("nextHopOrgUnitUid", rs.getString("next_hop_org_unit_uid"));
                    return m;
                }, entityType, entityRef);
    }

    /** §2.3.86 — Pull existing aggregate values from Central DHIS2
     *  into the local store. Returns the system workflow run id so
     *  the client can deep-link to the resulting run page. */
    @PostMapping("/aggregate/pull-from-central")
    public ResponseEntity<Map<String, Object>> pullAggregateFromCentral(
            final Authentication authentication,
            @RequestBody final PullRequest body,
            final HttpServletRequest http) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.dataSet() == null || body.dataSet().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "dataSet is required"));
        }
        if (body.orgUnit() == null || body.orgUnit().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "orgUnit is required"));
        }
        if (body.period() == null || body.period().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "period is required"));
        }
        try {
            final CentralDownloadService.PullResult r = centralDownload.pullAggregate(
                    body.dataSet(), body.orgUnit(), body.period(),
                    principal.userId(),
                    http.getRemoteAddr(),
                    http.getHeader("User-Agent"));
            final Map<String, Object> out = new LinkedHashMap<>();
            out.put("runId", r.runId().toString());
            out.put("imported", r.imported());
            out.put("ignored", r.ignored());
            out.put("errors", r.errors());
            return ResponseEntity.ok(out);
        } catch (Dhis2ReferenceClient.Dhis2UnreachableException ex) {
            return ResponseEntity.status(503).body(Map.of(
                    "error", "Central DHIS2 unreachable",
                    "detail", ex.getMessage()));
        } catch (Dhis2ReferenceClient.Dhis2ResponseException ex) {
            return ResponseEntity.status(502).body(Map.of(
                    "error", "Central DHIS2 returned an unexpected payload",
                    "detail", ex.getMessage()));
        }
    }

    public record PullRequest(
            @JsonProperty("dataSet") String dataSet,
            @JsonProperty("orgUnit") String orgUnit,
            @JsonProperty("period") String period
    ) { }

    /** §2.3.91 R-C/2.1 — Pull existing events from Central DHIS2 into
     *  the local store. Returns the system workflow run id so the
     *  client can deep-link to the resulting run page. */
    @PostMapping("/events/pull-from-central")
    public ResponseEntity<Map<String, Object>> pullEventsFromCentral(
            final Authentication authentication,
            @RequestBody final PullEventsRequest body,
            final HttpServletRequest http) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.program() == null || body.program().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "program is required"));
        }
        if (body.orgUnit() == null || body.orgUnit().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "orgUnit is required"));
        }
        try {
            final ug.ac.mak.der.workflows.aggregate.CentralDownloadService.PullResult r
                    = centralDownload.pullEvents(
                        body.program(), body.programStage(),
                        body.orgUnit(), body.startDate(), body.endDate(),
                        principal.userId(),
                        http.getRemoteAddr(),
                        http.getHeader("User-Agent"));
            final Map<String, Object> out = new LinkedHashMap<>();
            out.put("runId", r.runId().toString());
            out.put("imported", r.imported());
            out.put("ignored", r.ignored());
            out.put("errors", r.errors());
            return ResponseEntity.ok(out);
        } catch (Dhis2ReferenceClient.Dhis2UnreachableException ex) {
            return ResponseEntity.status(503).body(Map.of(
                    "error", "Central DHIS2 unreachable",
                    "detail", ex.getMessage()));
        } catch (Dhis2ReferenceClient.Dhis2ResponseException ex) {
            return ResponseEntity.status(502).body(Map.of(
                    "error", "Central DHIS2 returned an unexpected payload",
                    "detail", ex.getMessage()));
        }
    }

    public record PullEventsRequest(
            @JsonProperty("program") String program,
            @JsonProperty("programStage") String programStage,
            @JsonProperty("orgUnit") String orgUnit,
            @JsonProperty("startDate") String startDate,
            @JsonProperty("endDate") String endDate
    ) { }

    /** §2.3.93 R-C/3.1 — Pull tracked entities + enrolments + events
     *  cascaded from Central DHIS2 into the local tracker tables. */
    @PostMapping("/tracker/pull-from-central")
    public ResponseEntity<Map<String, Object>> pullTrackerFromCentral(
            final Authentication authentication,
            @RequestBody final PullTrackerRequest body,
            final HttpServletRequest http) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.program() == null || body.program().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "program is required"));
        }
        if (body.orgUnit() == null || body.orgUnit().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "orgUnit is required"));
        }
        try {
            final ug.ac.mak.der.workflows.aggregate.CentralDownloadService.TrackerPullResult r
                    = centralDownload.pullTracker(
                        body.program(), body.orgUnit(),
                        principal.userId(),
                        http.getRemoteAddr(),
                        http.getHeader("User-Agent"));
            final Map<String, Object> out = new LinkedHashMap<>();
            out.put("runId", r.runId().toString());
            out.put("teis", r.teis());
            out.put("enrolments", r.enrolments());
            out.put("events", r.events());
            out.put("errors", r.errors());
            out.put("errorDetails", r.errorDetails());
            return ResponseEntity.ok(out);
        } catch (Dhis2ReferenceClient.Dhis2UnreachableException ex) {
            return ResponseEntity.status(503).body(Map.of(
                    "error", "Central DHIS2 unreachable",
                    "detail", ex.getMessage()));
        } catch (Dhis2ReferenceClient.Dhis2ResponseException ex) {
            return ResponseEntity.status(502).body(Map.of(
                    "error", "Central DHIS2 returned an unexpected payload",
                    "detail", ex.getMessage()));
        }
    }

    public record PullTrackerRequest(
            @JsonProperty("program") String program,
            @JsonProperty("orgUnit") String orgUnit
    ) { }

    private int countJournalIn(final List<String> states) {
        if (states.isEmpty()) {
            return 0;
        }
        final String in = String.join(",", states.stream().map(s -> "?").toList());
        final Integer n = jdbc.queryForObject(
                "SELECT COUNT(*)::int FROM der.operation_journal "
              + "WHERE entity_type = 'AGGREGATE_DATA_VALUE' AND state IN (" + in + ")",
                Integer.class, states.toArray());
        return n == null ? 0 : n;
    }

    private static RowMapper<Map<String, Object>> rowMapper() {
        return (ResultSet rs, int i) -> {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("valueId",                   rs.getString("value_id"));
            m.put("dataElementUid",            rs.getString("data_element_uid"));
            m.put("orgUnitUid",                rs.getString("org_unit_uid"));
            m.put("periodIso",                 rs.getString("period_iso"));
            m.put("categoryOptionComboUid",    rs.getString("category_option_combo_uid"));
            m.put("attributeOptionComboUid",   rs.getString("attribute_option_combo_uid"));
            m.put("valueText",                 rs.getString("value_text"));
            m.put("comment",                   rs.getString("comment"));
            m.put("submittedBy",               rs.getString("submitted_by"));
            m.put("submittedAt", rs.getTimestamp("submitted_at") == null ? null
                                    : rs.getTimestamp("submitted_at").toInstant().toString());
            m.put("valueVersion",              rs.getInt("value_version"));
            m.put("dataSetUid",                rs.getString("data_set_uid"));
            m.put("dataSetName",               rs.getString("data_set_name"));
            m.put("workflowRunId",             rs.getString("workflow_run_id"));
            m.put("workflowName",              rs.getString("workflow_name"));
            m.put("workflowBusinessKey",       rs.getString("workflow_business_key"));
            m.put("workflowKind",              rs.getString("workflow_kind"));
            m.put("syncState",                 rs.getString("sync_state"));
            m.put("operationId",               rs.getString("operation_id"));
            return m;
        };
    }

    // -----------------------------------------------------------------
    // §2.3.97 R-E — "Ready for Central" payload previews.
    //
    // Each endpoint compiles the workflow-captured rows into the exact
    // DHIS2 2.44 envelope that the sync worker will POST — scoped to a
    // workflow definition (and optionally one of its runs). Only rows
    // whose latest journal state is unset / PENDING / RETRYABLE are
    // included — i.e. the admin sees "what's going to Central next".
    // -----------------------------------------------------------------

    /** Clause that keeps only rows ready to be pushed (not yet synced,
     *  not held in conflict). An empty latest-state (never journalled)
     *  also qualifies as ready, so pre-journal rows show up too. */
    private static final String READY_SYNC_STATE =
            " AND (latest.state IS NULL "
          + "      OR latest.state IN ('PENDING', 'RETRYABLE')) ";

    /** DHIS2 DataValueSet envelope scoped to a workflow definition. */
    @GetMapping("/aggregate/payload")
    public ResponseEntity<Map<String, Object>> aggregatePayload(
            @RequestParam(required = false) final String workflowId,
            @RequestParam(required = false) final String workflowRunId,
            @RequestParam(required = false, defaultValue = "500") final int limit) {
        if ((workflowId == null || workflowId.isBlank())
                && (workflowRunId == null || workflowRunId.isBlank())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "WORKFLOW_SCOPE_REQUIRED",
                    "message", "workflowId or workflowRunId required"));
        }
        final int capped = Math.max(1, Math.min(limit, 5000));
        final String keyExpr =
                "(av.data_element_uid || '|' || av.org_unit_uid || '|' "
              + " || av.period_iso || '|' || av.category_option_combo_uid "
              + " || '|' || av.attribute_option_combo_uid)";
        final StringBuilder sql = new StringBuilder(
                "SELECT av.data_element_uid, av.org_unit_uid, av.period_iso, "
              + "       av.category_option_combo_uid, av.attribute_option_combo_uid, "
              + "       av.value_text, av.comment "
              + "FROM der.aggregate_data_value av "
              + "LEFT JOIN der.capture_workflow_run cwr "
              + "       ON cwr.run_id = av.workflow_run_id "
              + "LEFT JOIN LATERAL ("
              + "   SELECT state FROM der.operation_journal oj "
              + "    WHERE oj.entity_type = 'AGGREGATE_DATA_VALUE' "
              + "      AND oj.entity_ref = " + keyExpr + " "
              + "    ORDER BY oj.created_at DESC LIMIT 1"
              + ") latest ON TRUE "
              + "WHERE 1 = 1 ");
        final List<Object> args = new ArrayList<>();
        if (workflowId != null && !workflowId.isBlank()) {
            sql.append(" AND cwr.workflow_id = ?::uuid");
            args.add(workflowId);
        }
        if (workflowRunId != null && !workflowRunId.isBlank()) {
            sql.append(" AND av.workflow_run_id = ?::uuid");
            args.add(workflowRunId);
        }
        sql.append(READY_SYNC_STATE);
        sql.append(" ORDER BY av.submitted_at ASC NULLS LAST LIMIT ?");
        args.add(capped);
        final List<Map<String, Object>> dataValues = jdbc.query(sql.toString(),
                (ResultSet rs, int i) -> {
            final Map<String, Object> dv = new LinkedHashMap<>();
            dv.put("dataElement",          rs.getString("data_element_uid"));
            dv.put("orgUnit",              rs.getString("org_unit_uid"));
            dv.put("period",               rs.getString("period_iso"));
            dv.put("categoryOptionCombo",  rs.getString("category_option_combo_uid"));
            dv.put("attributeOptionCombo", rs.getString("attribute_option_combo_uid"));
            dv.put("value",                rs.getString("value_text"));
            final String comment = rs.getString("comment");
            if (comment != null && !comment.isBlank()) {
                dv.put("comment", comment);
            }
            return dv;
        }, args.toArray());
        final Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("dataValues", dataValues);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("endpoint", "/api/dataValueSets");
        body.put("httpMethod", "POST");
        body.put("count", dataValues.size());
        body.put("payload", envelope);
        return ResponseEntity.ok(body);
    }

    /** DHIS2 events envelope — single-events + tracker-events combined
     *  into one {@code {"events":[…]}} payload, matching what the sync
     *  worker POSTs to {@code /api/events} today. */
    @GetMapping("/events/payload")
    public ResponseEntity<Map<String, Object>> eventsPayload(
            @RequestParam(required = false) final String workflowId,
            @RequestParam(required = false) final String workflowRunId,
            @RequestParam(required = false, defaultValue = "500") final int limit) {
        if ((workflowId == null || workflowId.isBlank())
                && (workflowRunId == null || workflowRunId.isBlank())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "WORKFLOW_SCOPE_REQUIRED",
                    "message", "workflowId or workflowRunId required"));
        }
        final int capped = Math.max(1, Math.min(limit, 5000));
        final StringBuilder sql = new StringBuilder(
                "SELECT ev.event_id, ev.enrollment_id, ev.program_uid, "
              + "       ev.program_stage_uid, ev.org_unit_uid, "
              + "       ev.occurred_at, ev.status, ev.attribute_option_combo_uid "
              + "FROM der.event ev "
              + "LEFT JOIN der.capture_workflow_run cwr "
              + "       ON cwr.run_id = ev.workflow_run_id "
              + "LEFT JOIN LATERAL ("
              + "   SELECT state FROM der.operation_journal oj "
              + "    WHERE oj.entity_type = 'EVENT' "
              + "      AND oj.entity_ref = ev.event_id::text "
              + "    ORDER BY oj.created_at DESC LIMIT 1"
              + ") latest ON TRUE "
              + "WHERE 1 = 1 ");
        final List<Object> args = new ArrayList<>();
        if (workflowId != null && !workflowId.isBlank()) {
            sql.append(" AND cwr.workflow_id = ?::uuid");
            args.add(workflowId);
        }
        if (workflowRunId != null && !workflowRunId.isBlank()) {
            sql.append(" AND ev.workflow_run_id = ?::uuid");
            args.add(workflowRunId);
        }
        sql.append(READY_SYNC_STATE);
        sql.append(" ORDER BY ev.occurred_at ASC NULLS LAST LIMIT ?");
        args.add(capped);
        final List<Map<String, Object>> events = jdbc.query(sql.toString(),
                (ResultSet rs, int i) -> {
            final String eventId = rs.getString("event_id");
            final Map<String, Object> dvMap = new LinkedHashMap<>();
            final List<Map<String, Object>> dvs = jdbc.query(
                    "SELECT data_element_uid, value_text FROM der.event_data_value "
                  + "WHERE event_id = ?::uuid",
                    (ResultSet r2, int j) -> Map.of(
                            "dataElement", (Object) r2.getString("data_element_uid"),
                            "value",       (Object) r2.getString("value_text")),
                    eventId);
            dvMap.put("dataValues", dvs);
            final Map<String, Object> e = new LinkedHashMap<>();
            e.put("event",         eventId);
            e.put("program",       rs.getString("program_uid"));
            e.put("programStage",  rs.getString("program_stage_uid"));
            e.put("orgUnit",       rs.getString("org_unit_uid"));
            final String enr = rs.getString("enrollment_id");
            if (enr != null) {
                e.put("enrollment", enr);
            }
            e.put("status",        rs.getString("status"));
            e.put("occurredAt",    rs.getTimestamp("occurred_at") == null ? null
                                    : rs.getTimestamp("occurred_at").toInstant().toString());
            e.put("attributeOptionCombo", rs.getString("attribute_option_combo_uid"));
            e.put("dataValues",    dvs);
            return e;
        }, args.toArray());
        final Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("events", events);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("endpoint", "/api/events");
        body.put("httpMethod", "POST");
        body.put("count", events.size());
        body.put("payload", envelope);
        return ResponseEntity.ok(body);
    }

    /** DHIS2 2.44 tracker envelope — merges TEIs, enrolments and
     *  tracker-stage events into one atomic {@code /api/tracker}
     *  payload. Matches the two-phase async-import flow shipped in
     *  2.3.96 R-D/tracker-async. */
    @GetMapping("/tracker/payload")
    public ResponseEntity<Map<String, Object>> trackerPayload(
            @RequestParam(required = false) final String workflowId,
            @RequestParam(required = false) final String workflowRunId,
            @RequestParam(required = false, defaultValue = "500") final int limit) {
        if ((workflowId == null || workflowId.isBlank())
                && (workflowRunId == null || workflowRunId.isBlank())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "WORKFLOW_SCOPE_REQUIRED",
                    "message", "workflowId or workflowRunId required"));
        }
        final int capped = Math.max(1, Math.min(limit, 5000));
        // §2.3.98 R-F/tracker-fidelity — enriched to full DHIS2 2.44
        // wire shape: TEIs carry attributes[], enrolments carry
        // enrolledAt + occurredAt (incident_date), events carry
        // dataValues[]. Matches ReferralPayloadEncoder output exactly.
        final List<Map<String, Object>> teis = selectReady(
                "SELECT te.tei_uid, te.tracked_entity_type, te.org_unit_uid, "
              + "       te.attributes "
              + "FROM der.tracked_entity te "
              + "LEFT JOIN der.capture_workflow_run cwr "
              + "       ON cwr.run_id = te.workflow_run_id "
              + "LEFT JOIN LATERAL ("
              + "   SELECT state FROM der.operation_journal oj "
              + "    WHERE oj.entity_type = 'TRACKED_ENTITY' "
              + "      AND oj.entity_ref = te.tei_uid "
              + "    ORDER BY oj.created_at DESC LIMIT 1"
              + ") latest ON TRUE "
              + "WHERE 1 = 1 ",
                " ORDER BY te.updated_at ASC",
                workflowId, workflowRunId, capped,
                (ResultSet rs) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("trackedEntity",     rs.getString("tei_uid"));
                    m.put("trackedEntityType", rs.getString("tracked_entity_type"));
                    m.put("orgUnit",           rs.getString("org_unit_uid"));
                    m.put("attributes",        jsonbToAttrArray(rs.getString("attributes")));
                    return m;
                },
                "te.workflow_run_id");
        final List<Map<String, Object>> enrollments = selectReady(
                "SELECT en.enrollment_uid, en.tei_uid, en.program_uid, "
              + "       en.org_unit_uid, en.status, en.enrollment_date, "
              + "       en.incident_date "
              + "FROM der.edge_enrollment en "
              + "LEFT JOIN der.capture_workflow_run cwr "
              + "       ON cwr.run_id = en.workflow_run_id "
              + "LEFT JOIN LATERAL ("
              + "   SELECT state FROM der.operation_journal oj "
              + "    WHERE oj.entity_type = 'ENROLLMENT' "
              + "      AND oj.entity_ref = en.enrollment_uid "
              + "    ORDER BY oj.created_at DESC LIMIT 1"
              + ") latest ON TRUE "
              + "WHERE 1 = 1 ",
                " ORDER BY en.updated_at ASC",
                workflowId, workflowRunId, capped,
                (ResultSet rs) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("enrollment",    rs.getString("enrollment_uid"));
                    m.put("trackedEntity", rs.getString("tei_uid"));
                    m.put("program",       rs.getString("program_uid"));
                    m.put("orgUnit",       rs.getString("org_unit_uid"));
                    m.put("status",        rs.getString("status"));
                    m.put("enrolledAt", rs.getDate("enrollment_date") == null ? null
                                            : rs.getDate("enrollment_date").toString());
                    final java.sql.Date incident = rs.getDate("incident_date");
                    if (incident != null) {
                        m.put("occurredAt", incident.toString());
                    }
                    return m;
                },
                "en.workflow_run_id");
        final List<Map<String, Object>> trackerEvents = selectReady(
                "SELECT ev.event_uid, ev.enrollment_uid, ev.program_uid, "
              + "       ev.program_stage_uid, ev.org_unit_uid, ev.status, "
              + "       ev.occurred_date, ev.data_values "
              + "FROM der.edge_tracker_event ev "
              + "LEFT JOIN der.capture_workflow_run cwr "
              + "       ON cwr.run_id = ev.workflow_run_id "
              + "LEFT JOIN LATERAL ("
              + "   SELECT state FROM der.operation_journal oj "
              + "    WHERE oj.entity_type = 'PROGRAM_STAGE_EVENT' "
              + "      AND oj.entity_ref = ev.event_uid "
              + "    ORDER BY oj.created_at DESC LIMIT 1"
              + ") latest ON TRUE "
              + "WHERE 1 = 1 ",
                " ORDER BY ev.updated_at ASC",
                workflowId, workflowRunId, capped,
                (ResultSet rs) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("event",        rs.getString("event_uid"));
                    m.put("enrollment",   rs.getString("enrollment_uid"));
                    m.put("program",      rs.getString("program_uid"));
                    m.put("programStage", rs.getString("program_stage_uid"));
                    m.put("orgUnit",      rs.getString("org_unit_uid"));
                    m.put("status",       rs.getString("status"));
                    m.put("occurredAt", rs.getDate("occurred_date") == null ? null
                                           : rs.getDate("occurred_date").toString());
                    m.put("dataValues",   jsonbToDvArray(rs.getString("data_values")));
                    return m;
                },
                "ev.workflow_run_id");
        final Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("trackedEntities", teis);
        envelope.put("enrollments",     enrollments);
        envelope.put("events",          trackerEvents);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("endpoint", "/api/tracker");
        body.put("httpMethod", "POST");
        body.put("count", teis.size() + enrollments.size() + trackerEvents.size());
        body.put("counts", Map.of(
                "trackedEntities", teis.size(),
                "enrollments",     enrollments.size(),
                "events",          trackerEvents.size()));
        body.put("payload", envelope);
        return ResponseEntity.ok(body);
    }

    /** JSONB map {uid: value} → `[{"attribute":uid,"value":value}, …]`
     *  (matches ReferralPayloadEncoder.attrMapToArray — same wire shape
     *  Central's /api/tracker accepts). */
    private List<Map<String, Object>> jsonbToAttrArray(final String json) {
        return jsonbToKvArray(json, "attribute");
    }

    /** JSONB map {uid: value} → `[{"dataElement":uid,"value":value}, …]`
     *  (matches ReferralPayloadEncoder.dvMapToArray). */
    private List<Map<String, Object>> jsonbToDvArray(final String json) {
        return jsonbToKvArray(json, "dataElement");
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> jsonbToKvArray(final String json, final String keyName) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            final Map<String, Object> parsed = new com.fasterxml.jackson.databind.ObjectMapper()
                    .readValue(json, Map.class);
            final List<Map<String, Object>> out = new ArrayList<>(parsed.size());
            for (final Map.Entry<String, Object> e : parsed.entrySet()) {
                final Map<String, Object> row = new LinkedHashMap<>();
                row.put(keyName, e.getKey());
                row.put("value",  e.getValue());
                out.add(row);
            }
            return out;
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            // Malformed JSONB — shouldn't happen but we'd rather emit [] than 500.
            return List.of();
        }
    }

    @FunctionalInterface
    private interface RsMapper { Map<String, Object> map(ResultSet rs) throws java.sql.SQLException; }

    /** Shared helper for the tracker payload: appends workflow/run/ready
     *  clauses to a prefix, then maps rows via the caller's mapper. */
    private List<Map<String, Object>> selectReady(final String prefix,
                                                   final String orderBy,
                                                   final String workflowId,
                                                   final String workflowRunId,
                                                   final int limit,
                                                   final RsMapper mapper,
                                                   final String runIdCol) {
        final StringBuilder sql = new StringBuilder(prefix);
        final List<Object> args = new ArrayList<>();
        if (workflowId != null && !workflowId.isBlank()) {
            sql.append(" AND cwr.workflow_id = ?::uuid");
            args.add(workflowId);
        }
        if (workflowRunId != null && !workflowRunId.isBlank()) {
            sql.append(" AND " + runIdCol + " = ?::uuid");
            args.add(workflowRunId);
        }
        sql.append(READY_SYNC_STATE);
        sql.append(orderBy);
        sql.append(" LIMIT ?");
        args.add(limit);
        return jdbc.query(sql.toString(),
                (ResultSet rs, int i) -> mapper.map(rs), args.toArray());
    }

    // -----------------------------------------------------------------
    // §2.3.101 R-K — Per-row payload lineage.
    //
    // Returns the single-row DHIS2 envelope + journal history for one
    // entity_ref so the admin UI can show "what Central will see for
    // THIS row + what already happened to it" in a drawer, without
    // having to pull the whole workflow-run bundle.
    // -----------------------------------------------------------------

    /** Single-row DHIS2 DataValueSet envelope + journal history. */
    @GetMapping("/aggregate/{valueId}/payload")
    public ResponseEntity<Map<String, Object>> aggregateRowPayload(
            @org.springframework.web.bind.annotation.PathVariable final String valueId) {
        if (valueId == null || valueId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "valueId required"));
        }
        final List<Map<String, Object>> rows = jdbc.query(
                "SELECT av.data_element_uid, av.org_unit_uid, av.period_iso, "
              + "       av.category_option_combo_uid, av.attribute_option_combo_uid, "
              + "       av.value_text, av.comment "
              + "FROM der.aggregate_data_value av "
              + "WHERE av.value_id = ?::uuid",
                (ResultSet rs, int i) -> {
                    final Map<String, Object> dv = new LinkedHashMap<>();
                    dv.put("dataElement",          rs.getString("data_element_uid"));
                    dv.put("orgUnit",              rs.getString("org_unit_uid"));
                    dv.put("period",               rs.getString("period_iso"));
                    dv.put("categoryOptionCombo",  rs.getString("category_option_combo_uid"));
                    dv.put("attributeOptionCombo", rs.getString("attribute_option_combo_uid"));
                    dv.put("value",                rs.getString("value_text"));
                    final String c = rs.getString("comment");
                    if (c != null && !c.isBlank()) {
                        dv.put("comment", c);
                    }
                    return dv;
                }, valueId);
        if (rows.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final Map<String, Object> dv = rows.get(0);
        final String key = dv.get("dataElement") + "|" + dv.get("orgUnit")
                + "|" + dv.get("period") + "|" + dv.get("categoryOptionCombo")
                + "|" + dv.get("attributeOptionCombo");
        final List<Map<String, Object>> journal = journalFor("AGGREGATE_DATA_VALUE", key);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("endpoint", "/api/dataValueSets");
        body.put("httpMethod", "POST");
        body.put("payload", Map.of("dataValues", List.of(dv)));
        body.put("journal", journal);
        // §2.3.105 R-Z — single-stream grouping so the drawer renders
        // a labelled heading consistent with the TEI drawer.
        body.put("journalByStream", Map.of("dataValues", journal));
        return ResponseEntity.ok(body);
    }

    /** Single-event DHIS2 events envelope + journal history. */
    @GetMapping("/events/{eventId}/payload")
    public ResponseEntity<Map<String, Object>> eventRowPayload(
            @org.springframework.web.bind.annotation.PathVariable final String eventId) {
        if (eventId == null || eventId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "eventId required"));
        }
        final List<Map<String, Object>> rows = jdbc.query(
                "SELECT ev.event_id, ev.enrollment_id, ev.program_uid, "
              + "       ev.program_stage_uid, ev.org_unit_uid, ev.occurred_at, "
              + "       ev.status, ev.attribute_option_combo_uid "
              + "FROM der.event ev "
              + "WHERE ev.event_id = ?::uuid",
                (ResultSet rs, int i) -> {
                    final List<Map<String, Object>> dvs = jdbc.query(
                            "SELECT data_element_uid, value_text "
                          + "FROM der.event_data_value "
                          + "WHERE event_id = ?::uuid",
                            (ResultSet r2, int j) -> Map.of(
                                    "dataElement", (Object) r2.getString("data_element_uid"),
                                    "value",       (Object) r2.getString("value_text")),
                            eventId);
                    final Map<String, Object> e = new LinkedHashMap<>();
                    e.put("event",         rs.getString("event_id"));
                    e.put("program",       rs.getString("program_uid"));
                    e.put("programStage",  rs.getString("program_stage_uid"));
                    e.put("orgUnit",       rs.getString("org_unit_uid"));
                    final String enr = rs.getString("enrollment_id");
                    if (enr != null) {
                        e.put("enrollment", enr);
                    }
                    e.put("status",        rs.getString("status"));
                    e.put("occurredAt",    rs.getTimestamp("occurred_at") == null ? null
                                            : rs.getTimestamp("occurred_at").toInstant().toString());
                    e.put("attributeOptionCombo", rs.getString("attribute_option_combo_uid"));
                    e.put("dataValues",    dvs);
                    return e;
                }, eventId);
        if (rows.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final List<Map<String, Object>> journal = journalFor("EVENT", eventId);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("endpoint", "/api/events");
        body.put("httpMethod", "POST");
        body.put("payload", Map.of("events", List.of(rows.get(0))));
        body.put("journal", journal);
        body.put("journalByStream", Map.of("events", journal));
        return ResponseEntity.ok(body);
    }

    /** Single-TEI DHIS2 tracker envelope + per-stream journal history
     *  (TEI + all enrolments + all events of this TEI). */
    @GetMapping("/tracker/tei/{teiUid}/payload")
    public ResponseEntity<Map<String, Object>> teiRowPayload(
            @org.springframework.web.bind.annotation.PathVariable final String teiUid) {
        if (teiUid == null || teiUid.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "teiUid required"));
        }
        final List<Map<String, Object>> teis = jdbc.query(
                "SELECT te.tei_uid, te.tracked_entity_type, te.org_unit_uid, te.attributes "
              + "FROM der.tracked_entity te WHERE te.tei_uid = ?",
                (ResultSet rs, int i) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("trackedEntity",     rs.getString("tei_uid"));
                    m.put("trackedEntityType", rs.getString("tracked_entity_type"));
                    m.put("orgUnit",           rs.getString("org_unit_uid"));
                    m.put("attributes",        jsonbToAttrArray(rs.getString("attributes")));
                    return m;
                }, teiUid);
        if (teis.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final List<Map<String, Object>> enrollments = jdbc.query(
                "SELECT en.enrollment_uid, en.tei_uid, en.program_uid, en.org_unit_uid, "
              + "       en.status, en.enrollment_date, en.incident_date "
              + "FROM der.edge_enrollment en WHERE en.tei_uid = ? "
              + "ORDER BY en.enrollment_date DESC",
                (ResultSet rs, int i) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("enrollment",    rs.getString("enrollment_uid"));
                    m.put("trackedEntity", rs.getString("tei_uid"));
                    m.put("program",       rs.getString("program_uid"));
                    m.put("orgUnit",       rs.getString("org_unit_uid"));
                    m.put("status",        rs.getString("status"));
                    m.put("enrolledAt",    rs.getDate("enrollment_date") == null ? null
                                            : rs.getDate("enrollment_date").toString());
                    final java.sql.Date inc = rs.getDate("incident_date");
                    if (inc != null) {
                        m.put("occurredAt", inc.toString());
                    }
                    return m;
                }, teiUid);
        final List<Map<String, Object>> events = jdbc.query(
                "SELECT ev.event_uid, ev.enrollment_uid, ev.program_uid, "
              + "       ev.program_stage_uid, ev.org_unit_uid, ev.status, "
              + "       ev.occurred_date, ev.data_values "
              + "FROM der.edge_tracker_event ev "
              + "LEFT JOIN der.edge_enrollment en "
              + "       ON en.enrollment_uid = ev.enrollment_uid "
              + "WHERE en.tei_uid = ? "
              + "ORDER BY ev.occurred_date DESC",
                (ResultSet rs, int i) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("event",        rs.getString("event_uid"));
                    m.put("enrollment",   rs.getString("enrollment_uid"));
                    m.put("program",      rs.getString("program_uid"));
                    m.put("programStage", rs.getString("program_stage_uid"));
                    m.put("orgUnit",      rs.getString("org_unit_uid"));
                    m.put("status",       rs.getString("status"));
                    m.put("occurredAt",   rs.getDate("occurred_date") == null ? null
                                            : rs.getDate("occurred_date").toString());
                    m.put("dataValues",   jsonbToDvArray(rs.getString("data_values")));
                    return m;
                }, teiUid);
        // §2.3.103 R-R — split journal by stream so the drawer can
        // group each row's history under its parent entity type.
        // {@code journalAll} is retained for backward-compatible
        // clients that don't yet read the per-stream object.
        final List<Map<String, Object>> journalTei = journalFor("TRACKED_ENTITY", teiUid);
        final List<Map<String, Object>> journalEnrol = new ArrayList<>();
        for (final Map<String, Object> en : enrollments) {
            journalEnrol.addAll(journalFor("ENROLLMENT", (String) en.get("enrollment")));
        }
        final List<Map<String, Object>> journalEvt = new ArrayList<>();
        for (final Map<String, Object> ev : events) {
            journalEvt.addAll(journalFor("PROGRAM_STAGE_EVENT", (String) ev.get("event")));
        }
        final List<Map<String, Object>> journalAll = new ArrayList<>();
        journalAll.addAll(journalTei);
        journalAll.addAll(journalEnrol);
        journalAll.addAll(journalEvt);
        final Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("trackedEntities", teis);
        payload.put("enrollments",     enrollments);
        payload.put("events",          events);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("endpoint", "/api/tracker");
        body.put("httpMethod", "POST");
        body.put("counts", Map.of(
                "trackedEntities", teis.size(),
                "enrollments",     enrollments.size(),
                "events",          events.size()));
        body.put("payload", payload);
        body.put("journal", journalAll);
        body.put("journalByStream", Map.of(
                "trackedEntity", journalTei,
                "enrollments",   journalEnrol,
                "events",        journalEvt));
        return ResponseEntity.ok(body);
    }

    /** §2.3.102 R-O — Enrolment-only payload lineage. Carries the one
     *  enrolment envelope plus its TEI stub (so Central has enough to
     *  thread the enrolment onto an existing TEI) plus the single
     *  enrolment's journal history. */
    @GetMapping("/tracker/enrollment/{enrollmentUid}/payload")
    public ResponseEntity<Map<String, Object>> enrollmentRowPayload(
            @org.springframework.web.bind.annotation.PathVariable
                final String enrollmentUid) {
        if (enrollmentUid == null || enrollmentUid.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "enrollmentUid required"));
        }
        final List<Map<String, Object>> enrolments = jdbc.query(
                "SELECT en.enrollment_uid, en.tei_uid, en.program_uid, en.org_unit_uid, "
              + "       en.status, en.enrollment_date, en.incident_date "
              + "FROM der.edge_enrollment en WHERE en.enrollment_uid = ?",
                (ResultSet rs, int i) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("enrollment",    rs.getString("enrollment_uid"));
                    m.put("trackedEntity", rs.getString("tei_uid"));
                    m.put("program",       rs.getString("program_uid"));
                    m.put("orgUnit",       rs.getString("org_unit_uid"));
                    m.put("status",        rs.getString("status"));
                    m.put("enrolledAt",    rs.getDate("enrollment_date") == null ? null
                                            : rs.getDate("enrollment_date").toString());
                    final java.sql.Date inc = rs.getDate("incident_date");
                    if (inc != null) {
                        m.put("occurredAt", inc.toString());
                    }
                    return m;
                }, enrollmentUid);
        if (enrolments.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("enrollments", enrolments);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("endpoint", "/api/tracker");
        body.put("httpMethod", "POST");
        body.put("counts", Map.of(
                "trackedEntities", 0,
                "enrollments",     enrolments.size(),
                "events",          0));
        final List<Map<String, Object>> enrolJournal = journalFor("ENROLLMENT", enrollmentUid);
        body.put("payload", payload);
        body.put("journal", enrolJournal);
        body.put("journalByStream", Map.of("enrollments", enrolJournal));
        return ResponseEntity.ok(body);
    }

    /** §2.3.102 R-O — Stage-event-only payload lineage. Returns the
     *  one event envelope (with dataValues from the JSONB column) and
     *  its single-event journal history. */
    @GetMapping("/tracker/event/{eventUid}/payload")
    public ResponseEntity<Map<String, Object>> trackerEventRowPayload(
            @org.springframework.web.bind.annotation.PathVariable
                final String eventUid) {
        if (eventUid == null || eventUid.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "eventUid required"));
        }
        final List<Map<String, Object>> events = jdbc.query(
                "SELECT ev.event_uid, ev.enrollment_uid, ev.program_uid, "
              + "       ev.program_stage_uid, ev.org_unit_uid, ev.status, "
              + "       ev.occurred_date, ev.data_values "
              + "FROM der.edge_tracker_event ev WHERE ev.event_uid = ?",
                (ResultSet rs, int i) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("event",        rs.getString("event_uid"));
                    m.put("enrollment",   rs.getString("enrollment_uid"));
                    m.put("program",      rs.getString("program_uid"));
                    m.put("programStage", rs.getString("program_stage_uid"));
                    m.put("orgUnit",      rs.getString("org_unit_uid"));
                    m.put("status",       rs.getString("status"));
                    m.put("occurredAt",   rs.getDate("occurred_date") == null ? null
                                            : rs.getDate("occurred_date").toString());
                    m.put("dataValues",   jsonbToDvArray(rs.getString("data_values")));
                    return m;
                }, eventUid);
        if (events.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("events", events);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("endpoint", "/api/tracker");
        body.put("httpMethod", "POST");
        body.put("counts", Map.of(
                "trackedEntities", 0,
                "enrollments",     0,
                "events",          events.size()));
        final List<Map<String, Object>> evJournal = journalFor("PROGRAM_STAGE_EVENT", eventUid);
        body.put("payload", payload);
        body.put("journal", evJournal);
        body.put("journalByStream", Map.of("events", evJournal));
        return ResponseEntity.ok(body);
    }
}
