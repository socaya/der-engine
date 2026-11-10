package ug.ac.mak.der.web;

import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.tracker.TrackedEntityUidMigrationService;
import ug.ac.mak.der.workflows.tracker.TrackedEntityUidMigrationService.MigrationResult;

/** SM-3a — admin endpoint for migrating a legacy UUID-shaped TEI
 *  to a DHIS2-compliant 11-char UID. Call after central has rejected
 *  a tracker write with "UID must be an alphanumeric string of 11
 *  characters starting with a letter". */
@RestController
@RequestMapping(path = "/edge-api/v1/admin/tei",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class TrackedEntityUidMigrationController {

    private final TrackedEntityUidMigrationService service;

    public TrackedEntityUidMigrationController(
            final TrackedEntityUidMigrationService service) {
        this.service = Objects.requireNonNull(service, "service");
    }

    @PostMapping(path = "/{uid}/migrate-uid",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> migrate(
            final Authentication authentication,
            @PathVariable("uid") final String oldUid,
            @RequestBody(required = false) final MigrateBody body) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        try {
            final MigrationResult r = service.migrate(oldUid,
                    body == null ? null : body.newUid());
            return ResponseEntity.ok(Map.of(
                    "oldUid", r.oldUid(),
                    "newUid", r.newUid(),
                    "affected", r.affected()));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "TEI_MIGRATE_INVALID",
                    "message", ex.getMessage()));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(409).body(Map.of(
                    "code", "TEI_MIGRATE_CONFLICT",
                    "message", ex.getMessage()));
        }
    }

    public record MigrateBody(@JsonProperty("newUid") String newUid) { }
}
