package ug.ac.mak.der.dhis2emulator;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository.TrackedEntity;

/**
 * DHIS2 {@code /api/tracker/trackedEntities} list emulator.
 *
 * <p>DHIS2 custom apps (eregisters' metadata pull, Capture's
 * working-list) hit this endpoint during bootstrap with
 * {@code program} / {@code orgUnit} / {@code trackedEntityType}
 * / {@code page} / {@code pageSize} / {@code updatedAfter}
 * filters. Backs onto the real {@link TrackedEntityRepository}
 * so results reflect what the appliance actually persisted —
 * not a stub.</p>
 *
 * <p>Response shape matches DHIS2 central 2.44's:
 * {@code {instances:[], page, pageSize, total?}} wrapper. Each
 * instance carries {@code trackedEntity}, {@code
 * trackedEntityType}, {@code orgUnit}, {@code createdAt},
 * {@code updatedAt}, and the attributes array in the shape the
 * d2 app-runtime expects.</p>
 */
@RestController
@RequestMapping(path = "/api/tracker/trackedEntities",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class TrackerListController {

    private final TrackedEntityRepository teis;
    private final ObjectMapper mapper;

    public TrackerListController(final TrackedEntityRepository teis,
                                    final ObjectMapper mapper) {
        this.teis = Objects.requireNonNull(teis, "teis");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            final Authentication auth,
            @RequestParam(name = "program", required = false) final String programUid,
            @RequestParam(name = "orgUnit", required = false) final String orgUnit,
            @RequestParam(name = "trackedEntityType", required = false)
                final String trackedEntityType,
            @RequestParam(name = "page", defaultValue = "1") final int page,
            @RequestParam(name = "pageSize", defaultValue = "50") final int pageSize,
            @RequestParam(name = "updatedAfter", required = false)
                final String updatedAfter) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final int safePage = Math.max(1, page);
        final int safeSize = Math.max(1, Math.min(pageSize, 200));
        final int fetch = safePage * safeSize;
        final List<TrackedEntity> rows = teis.search(
                trackedEntityType, orgUnit, Map.of(), fetch, programUid);
        // In-memory slice — safer than per-page SQL until the repo
        // grows an offset-aware query. Pilot facilities carry
        // hundreds to low thousands of TEIs per program; page
        // slicing on O(1000) rows is unnoticeable.
        final int from = Math.min((safePage - 1) * safeSize, rows.size());
        final int to = Math.min(from + safeSize, rows.size());
        final List<Map<String, Object>> instances = new ArrayList<>(to - from);
        for (int i = from; i < to; i++) {
            instances.add(toDhis2Shape(rows.get(i), updatedAfter));
        }
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("instances", instances);
        body.put("page", safePage);
        body.put("pageSize", safeSize);
        body.put("pageCount", (int) Math.ceil(rows.size() / (double) safeSize));
        body.put("total", rows.size());
        return ResponseEntity.ok(body);
    }

    private Map<String, Object> toDhis2Shape(final TrackedEntity tei,
                                                 final String updatedAfterFilter) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("trackedEntity", tei.teiUid());
        m.put("trackedEntityType", tei.trackedEntityType());
        m.put("orgUnit", tei.orgUnitUid());
        m.put("createdAt", tei.createdAt() == null ? null
                : tei.createdAt().toString());
        m.put("updatedAt", tei.updatedAt() == null ? null
                : tei.updatedAt().toString());
        // Attributes as an array of {attribute, value} rows — the
        // DHIS2 shape custom apps bind against.
        final List<Map<String, Object>> attrs = new ArrayList<>();
        if (tei.attributes() != null) {
            tei.attributes().forEach((k, v) -> {
                final Map<String, Object> a = new LinkedHashMap<>();
                a.put("attribute", k);
                a.put("value", v);
                attrs.add(a);
            });
        }
        m.put("attributes", attrs);
        return m;
    }
}
