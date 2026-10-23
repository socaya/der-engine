package ug.ac.mak.der.web;

import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.metadata.MetadataSyncService;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * ADR-0029 D-EA-3: receives a webhook from the Edge Agent naming the
 * metadata objects that changed on central and schedules an immediate
 * metadata sync. Idempotent — the sync service already de-dupes via
 * DHIS2's {@code lastUpdated} version.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/sync/notify", produces = MediaType.APPLICATION_JSON_VALUE)
public class SyncNotifyController {

    private static final Logger LOG = LoggerFactory.getLogger(SyncNotifyController.class);

    private final MetadataSyncService sync;

    public SyncNotifyController(final MetadataSyncService sync) {
        this.sync = Objects.requireNonNull(sync, "sync");
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> notify(final Authentication authentication,
                                                        @RequestBody final NotifyRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final List<String> objects = body == null || body.objects() == null
                ? List.of() : body.objects();
        LOG.info("sync notify received from Agent: {} object(s)", objects.size());
        try {
            sync.syncAll(principal.userId());
        } catch (Exception ex) {
            LOG.warn("sync notify triggered sync failed: {}", ex.getMessage());
            return ResponseEntity.status(503).body(Map.of(
                    "code", "SYNC_NOTIFY_FAILED",
                    "message", String.valueOf(ex.getMessage())));
        }
        return ResponseEntity.ok(Map.of(
                "acknowledged", true,
                "objects", objects.size()));
    }

    public record NotifyRequest(
            @JsonProperty("objects") List<String> objects,
            @JsonProperty("kinds") List<String> kinds) { }
}
