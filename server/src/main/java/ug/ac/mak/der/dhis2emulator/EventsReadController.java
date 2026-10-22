package ug.ac.mak.der.dhis2emulator;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.events.Event;
import ug.ac.mak.der.workflows.events.EventRepository;

/**
 * Local-only read-back of events the edge has stored.
 *
 * <p>DHIS2 clients hit {@code GET /api/events} or {@code GET /api/tracker/events}
 * with {@code program} + {@code orgUnit} filters. DER answers from
 * {@code der.event}; no round-trip to central (ADR-0004).</p>
 */
@RestController
@RequestMapping(produces = MediaType.APPLICATION_JSON_VALUE)
public class EventsReadController {

    private final EventRepository events;

    public EventsReadController(final EventRepository events) {
        this.events = Objects.requireNonNull(events, "events");
    }

    @GetMapping("/api/events")
    public ResponseEntity<Map<String, Object>> legacyList(
            final Authentication authentication,
            @RequestParam(name = "program", required = false) final String program,
            @RequestParam(name = "orgUnit", required = false) final String orgUnit,
            @RequestParam(name = "pageSize", defaultValue = "100") final int pageSize) {
        return list(authentication, program, orgUnit, pageSize, false);
    }

    @GetMapping("/api/tracker/events")
    public ResponseEntity<Map<String, Object>> trackerList(
            final Authentication authentication,
            @RequestParam(name = "program", required = false) final String program,
            @RequestParam(name = "orgUnit", required = false) final String orgUnit,
            @RequestParam(name = "pageSize", defaultValue = "100") final int pageSize) {
        return list(authentication, program, orgUnit, pageSize, true);
    }

    private ResponseEntity<Map<String, Object>> list(final Authentication authentication,
                                                      final String program,
                                                      final String orgUnit,
                                                      final int pageSize,
                                                      final boolean trackerShape) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (program == null || program.isBlank() || orgUnit == null || orgUnit.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "httpStatusCode", 400,
                    "message", "program and orgUnit query parameters are required (E1003)"));
        }
        final List<Event> rows = events.findByProgramAndOrgUnit(program, orgUnit, pageSize);
        final List<Map<String, Object>> items = new ArrayList<>(rows.size());
        for (final Event e : rows) {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("event", e.eventId().toString());
            m.put("program", e.programUid());
            m.put("programStage", e.programStageUid());
            m.put("orgUnit", e.orgUnitUid());
            m.put("occurredAt", e.occurredAt().toString());
            m.put("status", e.status().name());
            m.put("attributeOptionCombo", e.attributeOptionComboUid());
            if (e.enrollmentId() != null) {
                m.put("enrollment", e.enrollmentId().toString());
            }
            final List<Map<String, Object>> dvs = new ArrayList<>();
            for (final var dv : e.dataValues().entrySet()) {
                final Map<String, Object> row = new LinkedHashMap<>();
                row.put("dataElement", dv.getKey());
                row.put("value", dv.getValue());
                dvs.add(row);
            }
            m.put("dataValues", dvs);
            items.add(m);
        }
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put(trackerShape ? "instances" : "events", items);
        body.put("page", 1);
        body.put("pageSize", pageSize);
        body.put("total", items.size());
        return ResponseEntity.ok(body);
    }
}
