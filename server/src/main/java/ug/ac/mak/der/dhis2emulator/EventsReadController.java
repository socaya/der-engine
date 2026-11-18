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
 * <p>DHIS2 clients hit {@code GET /api/events} (legacy) or
 * {@code GET /api/tracker/events} (new tracker API) with any of
 * these shapes:
 *
 * <ul>
 *   <li>{@code orgUnit=<uid>} — singular, legacy. One OU.</li>
 *   <li>{@code orgUnits=<uid>,<uid>} — plural CSV, new tracker API.
 *       Multiple OUs.</li>
 *   <li>{@code ouMode=SELECTED|DESCENDANTS|ACCESSIBLE} — tracker API
 *       tree-walk hint. DESCENDANTS means "this OU and every child";
 *       DER's event store is already scoped per-OU so we treat it as
 *       "match exactly the provided OUs" for now — a future batch can
 *       walk {@code metadata_organisation_unit} to expand.</li>
 * </ul></p>
 *
 * <p>Response shape matches the new tracker API: <pre>
 *   { events: [...], page, pageSize, total }
 * </pre> (previously returned {@code instances} which only
 * {@code /tracker/trackedEntities} uses.)</p>
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
            @RequestParam(name = "orgUnits", required = false) final String orgUnits,
            @RequestParam(name = "pageSize", defaultValue = "100") final int pageSize) {
        return list(authentication, program,
                firstOrgUnit(orgUnit, orgUnits), pageSize, false);
    }

    @GetMapping("/api/tracker/events")
    public ResponseEntity<Map<String, Object>> trackerList(
            final Authentication authentication,
            @RequestParam(name = "program", required = false) final String program,
            @RequestParam(name = "orgUnit", required = false) final String orgUnit,
            @RequestParam(name = "orgUnits", required = false) final String orgUnits,
            @RequestParam(name = "ouMode", required = false) final String ouMode,
            @RequestParam(name = "pageSize", defaultValue = "100") final int pageSize) {
        // ouMode is advisory — DER's event store already carries the
        // exact OU per event, so DESCENDANTS vs SELECTED is a no-op
        // for the single-OU case today. Captured here so the
        // signature docs stay honest for a future hierarchy walk.
        final String ou = firstOrgUnit(orgUnit, orgUnits);
        if (program == null || program.isBlank() || ou == null || ou.isBlank()) {
            // Return the empty tracker-shape body on a missing-param
            // query instead of 400. The App iterates {events} right
            // after the fetch and crashes on undefined when we 400,
            // observed in EventProgramList.tsx:119. Empty-but-valid
            // satisfies .map(...) and lets the operator pick the
            // actual program / OU via the picker without seeing a
            // toast error on first render.
            return ResponseEntity.ok(emptyBody(pageSize, true));
        }
        return list(authentication, program, ou, pageSize, true);
    }

    private static String firstOrgUnit(final String singular, final String plural) {
        if (singular != null && !singular.isBlank()) {
            return singular;
        }
        if (plural != null && !plural.isBlank()) {
            final int comma = plural.indexOf(',');
            return comma < 0 ? plural : plural.substring(0, comma);
        }
        return null;
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
            // Legacy /api/events shape keeps the 400 contract (scripts
            // that rely on error signalling would miss an empty 200).
            if (!trackerShape) {
                return ResponseEntity.badRequest().body(Map.of(
                        "httpStatusCode", 400,
                        "message", "program and orgUnit query parameters are required (E1003)"));
            }
            return ResponseEntity.ok(emptyBody(pageSize, true));
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
        // Both legacy + new tracker use the "events" key for this
        // endpoint. The old "instances" key here was wrong (that key
        // is reserved for /api/tracker/trackedEntities).
        body.put("events", items);
        body.put("page", 1);
        body.put("pageSize", pageSize);
        body.put("total", items.size());
        return ResponseEntity.ok(body);
    }

    private static Map<String, Object> emptyBody(final int pageSize, final boolean trackerShape) {
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("events", List.of());
        body.put("page", 1);
        body.put("pageSize", pageSize);
        body.put("total", 0);
        return body;
    }
}
