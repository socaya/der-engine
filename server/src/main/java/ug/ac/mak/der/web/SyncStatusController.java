package ug.ac.mak.der.web;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.SyncStatusService;

/**
 * Phase 03 per-record sync-status probe for the device-client chrome.
 *
 * <p>At Phase 03 this always returns {@link SyncStatusService.SyncStatus#UNKNOWN}
 * because DER has not yet taken ownership of change capture. Phase 04 wires
 * the real journal and this controller starts returning the full spectrum.</p>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/records", produces = MediaType.APPLICATION_JSON_VALUE)
public class SyncStatusController {

    private final SyncStatusService service;

    public SyncStatusController(final SyncStatusService service) {
        this.service = service;
    }

    @GetMapping("/{entityType}/{entityId}/sync-status")
    public ResponseEntity<SyncStatusResponse> status(
            @PathVariable
            @NotBlank
            @Pattern(regexp = "^[A-Za-z][A-Za-z0-9_-]{0,63}$",
                    message = "entityType must be alphanumeric")
            final String entityType,
            @PathVariable
            @NotBlank
            @Pattern(regexp = "^[A-Za-z0-9._-]{1,64}$",
                    message = "entityId must be a DHIS2-style UID or stable identifier")
            final String entityId,
            final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final SyncStatusService.SyncStatusResponse r = service.statusFor(entityType, entityId);
        return ResponseEntity.ok(new SyncStatusResponse(r.entityType(), r.entityId(), r.status().name(), r.note()));
    }

    public record SyncStatusResponse(
            @JsonProperty("entityType") String entityType,
            @JsonProperty("entityId") String entityId,
            @JsonProperty("status") String status,
            @JsonProperty("note") String note
    ) { }
}
