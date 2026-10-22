package ug.ac.mak.der.web;

import java.util.Objects;
import java.util.Optional;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.sync.drift.DriftDetectionService;
import ug.ac.mak.der.sync.drift.DriftSnapshot;

/** ADR-0008 admin surface for the drift detector. */
@RestController
@RequestMapping(path = "/edge-api/v1/sync/drift", produces = MediaType.APPLICATION_JSON_VALUE)
public class DriftController {

    private final DriftDetectionService drift;

    public DriftController(final DriftDetectionService drift) {
        this.drift = Objects.requireNonNull(drift, "drift");
    }

    @GetMapping
    public ResponseEntity<Object> latest(final Authentication authentication,
                                          @RequestParam(name = "refresh", defaultValue = "false")
                                          final boolean refresh) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (refresh) {
            final var report = drift.recordLatestDelta("ADMIN_REQUEST");
            return ResponseEntity.ok(report);
        }
        final Optional<DriftSnapshot> latest = drift.latest();
        if (latest.isEmpty()) {
            return ResponseEntity.ok(java.util.Map.of(
                    "status", "NO_SNAPSHOT",
                    "message", "no metadata snapshots have been compared yet"));
        }
        return ResponseEntity.ok(latest.get());
    }
}
