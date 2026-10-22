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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags;
import ug.ac.mak.der.dhis2.compatibility.Dhis2CompatibilityEngine;
import ug.ac.mak.der.security.EdgeUserPrincipal;
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
    private final Clock clock;

    public EventsController(final EventService service,
                             final Dhis2CompatibilityEngine engine,
                             final Clock clock) {
        this.service = service;
        this.engine = engine;
        this.clock = clock;
    }

    @PostMapping(path = "/api/events", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> postEvents(@RequestBody final EventsRequest body,
                                                           final Authentication authentication,
                                                           final HttpServletRequest http) {
        return handle(body == null ? List.of() : body.events(), authentication, http,
                CapabilityFlags.ImportSummaryShape.CLASSIC);
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
        final List<EventService.EventInput> inputs = new ArrayList<>(rows.size());
        for (final EventRow row : rows) {
            inputs.add(toInput(row));
        }
        final EventService.EventImportResult result = service.submit(inputs, principal.userId(),
                http.getRemoteAddr(), http.getHeader(HttpHeaders.USER_AGENT));
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
