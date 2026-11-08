package ug.ac.mak.der.dhis2emulator;

import java.time.Clock;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags;
import ug.ac.mak.der.dhis2.compatibility.Dhis2CompatibilityEngine;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflow.SystemWorkflowService;
import ug.ac.mak.der.workflows.events.Event;
import ug.ac.mak.der.workflows.events.EventService;

/**
 * DER's emulation of the DHIS2 event write endpoints.
 *
 * <p>Accepts both the legacy flat {@code POST /api/events} envelope and the
 * modern {@code POST /api/tracker} envelope with an {@code events} array. The
 * compatibility engine's
 * {@link CapabilityFlags.ImportSummaryShape} decides which response shape to
 * emit; the write pipeline is the same for both.</p>
 */
@RestController
@RequestMapping(produces = MediaType.APPLICATION_JSON_VALUE)
public class EventsController {

    private final EventService service;
    private final Dhis2CompatibilityEngine engine;
    private final SystemWorkflowService systemWorkflows;
    private final Clock clock;

    public EventsController(final EventService service,
                             final Dhis2CompatibilityEngine engine,
                             final SystemWorkflowService systemWorkflows,
                             final Clock clock) {
        this.service = service;
        this.engine = engine;
        this.systemWorkflows = systemWorkflows;
        this.clock = clock;
    }

    @PostMapping(path = "/api/events", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> postEvents(@RequestBody final EventsRequest body,
                                                           final Authentication authentication,
                                                           final HttpServletRequest http) {
        return handle(body == null ? List.of() : body.events(), authentication, http,
                CapabilityFlags.ImportSummaryShape.CLASSIC);
    }

    /** DHIS2-parity {@code DELETE /api/events/{eventId}}. Removes
     *  the event row + its data values from the edge mirror. The
     *  central-sync side still needs a follow-up tracker DELETE
     *  job when the operator is online; that's a future slice —
     *  for now a deleted edge event stops appearing in the
     *  Capture working list immediately. */
    @DeleteMapping(path = "/api/events/{eventId}")
    public ResponseEntity<Map<String, Object>> deleteEvent(
            @PathVariable("eventId") final String eventId,
            final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final UUID uid;
        try {
            uid = UUID.fromString(eventId);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "EVENT_UID_INVALID",
                    "message", "event id must be a UUID"));
        }
        final boolean deleted = service.deleteEvent(uid);
        return deleted
                ? ResponseEntity.ok(Map.of("deleted", true,
                        "eventId", eventId))
                : ResponseEntity.notFound().build();
    }

    @PostMapping(path = "/api/tracker", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> postTracker(@RequestBody final TrackerRequest body,
                                                            final Authentication authentication,
                                                            final HttpServletRequest http) {
        final CapabilityFlags.ImportSummaryShape shape = resolveShape();
        return handle(body == null ? List.of() : body.events(), authentication, http, shape);
    }

    private CapabilityFlags.ImportSummaryShape resolveShape() {
        try {
            return engine.capabilities().importSummaryShape();
        } catch (RuntimeException ex) {
            return CapabilityFlags.ImportSummaryShape.TRACKER_IMPORT_REPORT;
        }
    }

    private ResponseEntity<Map<String, Object>> handle(final List<EventRow> rows,
                                                        final Authentication authentication,
                                                        final HttpServletRequest http,
                                                        final CapabilityFlags.ImportSummaryShape shape) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (rows == null || rows.isEmpty()) {
            return ResponseEntity.badRequest().body(summary(0, 0,
                    List.of(Map.of("object", "root", "value", "events array is required")), shape));
        }
        // §2.3.87 R-C/2 — passthrough events get wrapped in a per
        // (program, programStage, orgUnit, submitter) EVENT_CAPTURE
        // system run so each input carries workflow lineage. We derive
        // the scope from the first well-formed row; mixed-scope batches
        // all share one run (operators rarely post across multiple
        // forms in one call).
        UUID eventRunId = null;
        for (final EventRow row : rows) {
            if (row != null
                    && row.program() != null && !row.program().isBlank()
                    && row.programStage() != null && !row.programStage().isBlank()
                    && row.orgUnit() != null && !row.orgUnit().isBlank()) {
                eventRunId = systemWorkflows.ensureEventCaptureRun(
                        row.program(), row.programStage(), row.orgUnit(),
                        principal.userId());
                break;
            }
        }
        final UUID runId = eventRunId;
        final List<EventService.EventInput> inputs = new ArrayList<>(rows.size());
        for (final EventRow row : rows) {
            inputs.add(toInputWithRun(row, runId));
        }
        final EventService.EventImportResult result = service.submit(inputs, principal.userId(),
                http.getRemoteAddr(), http.getHeader(HttpHeaders.USER_AGENT),
                http.getHeader("X-DER-Referral-Next-Hop"));
        final List<Map<String, Object>> conflicts = new ArrayList<>();
        for (final EventService.Conflict c : result.conflicts()) {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("object", c.reference());
            m.put("value", c.reason());
            conflicts.add(m);
        }
        return ResponseEntity.ok(summary(result.imported().size(), conflicts.size(), conflicts, shape));
    }

    private EventService.EventInput toInput(final EventRow row) {
        UUID eventId;
        try {
            eventId = row.event() == null ? UUID.randomUUID() : UUID.fromString(row.event());
        } catch (IllegalArgumentException ex) {
            eventId = UUID.randomUUID();
        }
        UUID enrollmentId = null;
        if (row.enrollment() != null && !row.enrollment().isBlank()) {
            try {
                enrollmentId = UUID.fromString(row.enrollment());
            } catch (IllegalArgumentException ex) {
                enrollmentId = null;
            }
        }
        final Instant occurred;
        try {
            occurred = row.occurredAt() == null
                    ? Instant.now(clock) : Instant.parse(row.occurredAt());
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException("event.occurredAt must be an ISO instant", ex);
        }
        final Event.Status status = row.status() == null
                ? Event.Status.ACTIVE : Event.Status.valueOf(row.status());
        final Map<String, String> values = new LinkedHashMap<>();
        if (row.dataValues() != null) {
            for (final DataValueRow dv : row.dataValues()) {
                if (dv.dataElement() == null) {
                    continue;
                }
                values.put(dv.dataElement(), dv.value() == null ? "" : dv.value());
            }
        }
        return new EventService.EventInput(eventId, enrollmentId, row.program(), row.programStage(),
                row.orgUnit(), occurred, status, row.attributeOptionCombo(), values);
    }

    private EventService.EventInput toInputWithRun(final EventRow row,
                                                     final UUID workflowRunId) {
        final EventService.EventInput base = toInput(row);
        return new EventService.EventInput(
                base.eventId(), base.enrollmentId(),
                base.programUid(), base.programStageUid(),
                base.orgUnitUid(), base.occurredAt(), base.status(),
                base.attributeOptionComboUid(), base.dataValues(),
                base.expectedVersion(), workflowRunId);
    }

    private Map<String, Object> summary(final int imported, final int ignored,
                                         final List<Map<String, Object>> conflicts,
                                         final CapabilityFlags.ImportSummaryShape shape) {
        final Map<String, Object> importCount = new LinkedHashMap<>();
        importCount.put("imported", imported);
        importCount.put("updated", 0);
        importCount.put("ignored", ignored);
        importCount.put("deleted", 0);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", conflicts.isEmpty() ? "OK" : "WARNING");
        body.put("responseType", shape == CapabilityFlags.ImportSummaryShape.TRACKER_IMPORT_REPORT
                ? "TrackerImportReport" : "ImportSummary");
        body.put("importCount", importCount);
        body.put("conflicts", conflicts);
        body.put("validationReport", Map.of("errorReports", conflicts, "warningReports", List.of()));
        body.put("derServerDate", Instant.now(clock).toString());
        return body;
    }

    public record EventsRequest(@JsonProperty("events") List<EventRow> events) { }

    public record TrackerRequest(@JsonProperty("events") List<EventRow> events) { }

    public record EventRow(
            @JsonProperty("event") String event,
            @JsonProperty("enrollment") String enrollment,
            @JsonProperty("program") String program,
            @JsonProperty("programStage") String programStage,
            @JsonProperty("orgUnit") String orgUnit,
            @JsonProperty("occurredAt") String occurredAt,
            @JsonProperty("status") String status,
            @JsonProperty("attributeOptionCombo") String attributeOptionCombo,
            @JsonProperty("dataValues") List<DataValueRow> dataValues
    ) { }

    public record DataValueRow(
            @JsonProperty("dataElement") String dataElement,
            @JsonProperty("value") String value
    ) { }
}
