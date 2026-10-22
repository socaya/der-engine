package ug.ac.mak.der.dhis2emulator;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.metadata.MetadataMirrorRepository;
import ug.ac.mak.der.metadata.MirroredEntity;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DER's emulation of the DHIS2 Web API metadata list endpoints:
 *
 * <ul>
 *   <li>{@code GET /api/organisationUnits}</li>
 *   <li>{@code GET /api/dataElements}</li>
 *   <li>{@code GET /api/dataSets}</li>
 *   <li>{@code GET /api/programs}</li>
 *   <li>{@code GET /api/trackedEntityTypes}</li>
 *   <li>{@code GET /api/{resource}/{uid}} for each of the above</li>
 * </ul>
 *
 * <p>Each list response is DHIS2-shape-compatible: a top-level array keyed by
 * the resource name plus a {@code pager}. Fields are projected from the
 * mirrored JSONB payload so clients receive the full DHIS2 object. Phase 03b
 * does not implement field-filtering (DHIS2's {@code fields=} parameter) —
 * the stored payload is returned as-is.</p>
 */
@RestController
@RequestMapping(path = "/api", produces = MediaType.APPLICATION_JSON_VALUE)
public class MetadataListController {

    private final MetadataMirrorRepository mirror;

    public MetadataListController(final MetadataMirrorRepository mirror) {
        this.mirror = mirror;
    }

    @GetMapping("/organisationUnits")
    public ResponseEntity<Map<String, Object>> organisationUnits(
            final Authentication auth,
            @RequestParam(name = "pageSize", defaultValue = "50") final int pageSize,
            @RequestParam(name = "page", defaultValue = "1") final int page) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(buildList("organisationUnits", mirror.findAllOrganisationUnits(), page, pageSize));
    }

    @GetMapping("/organisationUnits/{uid}")
    public ResponseEntity<JsonNode> organisationUnit(final Authentication auth, @PathVariable final String uid) {
        return single(auth, mirror.findOrganisationUnit(uid).map(MirroredEntity::payload));
    }

    @GetMapping("/dataElements")
    public ResponseEntity<Map<String, Object>> dataElements(
            final Authentication auth,
            @RequestParam(name = "pageSize", defaultValue = "50") final int pageSize,
            @RequestParam(name = "page", defaultValue = "1") final int page) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(buildList("dataElements", mirror.findAllDataElements(), page, pageSize));
    }

    @GetMapping("/dataElements/{uid}")
    public ResponseEntity<JsonNode> dataElement(final Authentication auth, @PathVariable final String uid) {
        return single(auth, mirror.findDataElement(uid).map(MirroredEntity::payload));
    }

    @GetMapping("/dataSets")
    public ResponseEntity<Map<String, Object>> dataSets(
            final Authentication auth,
            @RequestParam(name = "pageSize", defaultValue = "50") final int pageSize,
            @RequestParam(name = "page", defaultValue = "1") final int page) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(buildList("dataSets", mirror.findAllDataSets(), page, pageSize));
    }

    @GetMapping("/dataSets/{uid}")
    public ResponseEntity<JsonNode> dataSet(final Authentication auth, @PathVariable final String uid) {
        return single(auth, mirror.findDataSet(uid).map(MirroredEntity::payload));
    }

    @GetMapping("/programs")
    public ResponseEntity<Map<String, Object>> programs(
            final Authentication auth,
            @RequestParam(name = "pageSize", defaultValue = "50") final int pageSize,
            @RequestParam(name = "page", defaultValue = "1") final int page) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(buildList("programs", mirror.findAllPrograms(), page, pageSize));
    }

    @GetMapping("/programs/{uid}")
    public ResponseEntity<JsonNode> program(final Authentication auth, @PathVariable final String uid) {
        return single(auth, mirror.findProgram(uid).map(MirroredEntity::payload));
    }

    @GetMapping("/trackedEntityTypes")
    public ResponseEntity<Map<String, Object>> trackedEntityTypes(
            final Authentication auth,
            @RequestParam(name = "pageSize", defaultValue = "50") final int pageSize,
            @RequestParam(name = "page", defaultValue = "1") final int page) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(buildList("trackedEntityTypes", mirror.findAllTrackedEntityTypes(), page, pageSize));
    }

    @GetMapping("/trackedEntityTypes/{uid}")
    public ResponseEntity<JsonNode> trackedEntityType(final Authentication auth, @PathVariable final String uid) {
        return single(auth, mirror.findTrackedEntityType(uid).map(MirroredEntity::payload));
    }

    private static ResponseEntity<JsonNode> single(final Authentication auth,
                                                    final java.util.Optional<JsonNode> payload) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return payload.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    private static Map<String, Object> buildList(final String key,
                                                  final List<? extends MirroredEntity> rows,
                                                  final int page,
                                                  final int pageSize) {
        final int safeSize = Math.max(1, Math.min(pageSize, 500));
        final int safePage = Math.max(1, page);
        final int total = rows.size();
        final int from = Math.min((safePage - 1) * safeSize, total);
        final int to = Math.min(from + safeSize, total);
        final List<JsonNode> payloads = new ArrayList<>(to - from);
        for (int i = from; i < to; i++) {
            payloads.add(rows.get(i).payload());
        }
        final Map<String, Object> pager = new LinkedHashMap<>();
        pager.put("page", safePage);
        pager.put("pageSize", safeSize);
        pager.put("total", total);
        pager.put("pageCount", (int) Math.ceil(total / (double) safeSize));
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("pager", pager);
        body.put(key, payloads);
        return body;
    }
}
