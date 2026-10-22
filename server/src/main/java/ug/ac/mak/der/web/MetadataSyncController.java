package ug.ac.mak.der.web;

import java.util.Map;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.dhis2.Dhis2ReferenceClient;
import ug.ac.mak.der.metadata.MetadataSnapshot;
import ug.ac.mak.der.metadata.MetadataSyncService;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityAuditRepository;

/**
 * Phase 03b admin endpoint {@code POST /edge-api/v1/sync/metadata}. Triggers
 * the metadata sync and returns the resulting snapshot summary.
 *
 * <p>Returns {@code 503} when the central is unreachable so the client's
 * SyncStatus chrome can distinguish "central down" from "no data yet". The
 * route is also recorded in {@code security_audit} on success and failure.</p>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/sync", produces = MediaType.APPLICATION_JSON_VALUE)
public class MetadataSyncController {

    private static final Logger LOG = LoggerFactory.getLogger(MetadataSyncController.class);

    private final MetadataSyncService sync;
    private final SecurityAuditRepository audit;
    private final java.time.Clock clock;

    public MetadataSyncController(final MetadataSyncService sync,
                                   final SecurityAuditRepository audit,
                                   final java.time.Clock clock) {
        this.sync = sync;
        this.audit = audit;
        this.clock = clock;
    }

    @PostMapping("/metadata")
    public ResponseEntity<SyncResponse> runMetadataSync(final Authentication authentication,
                                                        final HttpServletRequest http) {
        if (!(authentication instanceof EdgeUserPrincipal admin)) {
            return ResponseEntity.status(401).build();
        }
        final java.time.Instant now = java.time.Instant.now(clock);
        try {
            final MetadataSnapshot snapshot = sync.syncAll(admin.userId());
            audit.append(new AuditEvent(
                    "METADATA_SYNC_SUCCESS",
                    AuditEvent.Outcome.SUCCESS,
                    admin.userId(), null,
                    http.getRemoteAddr(), http.getHeader(HttpHeaders.USER_AGENT),
                    Map.of(
                            "snapshotId", snapshot.snapshotId(),
                            "total", snapshot.counts().total(),
                            "centralVersion", snapshot.centralVersion() == null ? "" : snapshot.centralVersion()
                    )
            ), now);
            return ResponseEntity.ok(SyncResponse.of(snapshot));
        } catch (Dhis2ReferenceClient.Dhis2UnreachableException ex) {
            LOG.warn("Metadata sync aborted: central unreachable", ex);
            audit.append(new AuditEvent(
                    "METADATA_SYNC_UNREACHABLE",
                    AuditEvent.Outcome.ERROR,
                    admin.userId(), null,
                    http.getRemoteAddr(), http.getHeader(HttpHeaders.USER_AGENT),
                    Map.of("message", ex.getMessage())
            ), now);
            return ResponseEntity.status(503).body(new SyncResponse("UNREACHABLE", 0L, 0, 0, 0, 0, 0, 0,
                    null, null, null, ex.getMessage()));
        } catch (Dhis2ReferenceClient.Dhis2ResponseException ex) {
            LOG.warn("Metadata sync aborted: central responded badly", ex);
            audit.append(new AuditEvent(
                    "METADATA_SYNC_BAD_RESPONSE",
                    AuditEvent.Outcome.ERROR,
                    admin.userId(), null,
                    http.getRemoteAddr(), http.getHeader(HttpHeaders.USER_AGENT),
                    Map.of("message", ex.getMessage())
            ), now);
            return ResponseEntity.status(502).body(new SyncResponse("BAD_RESPONSE", 0L, 0, 0, 0, 0, 0, 0,
                    null, null, null, ex.getMessage()));
        }
    }

    public record SyncResponse(
            @JsonProperty("status") String status,
            @JsonProperty("snapshotId") long snapshotId,
            @JsonProperty("total") int total,
            @JsonProperty("organisationUnits") int organisationUnits,
            @JsonProperty("dataElements") int dataElements,
            @JsonProperty("dataSets") int dataSets,
            @JsonProperty("programs") int programs,
            @JsonProperty("trackedEntityTypes") int trackedEntityTypes,
            @JsonProperty("centralVersion") String centralVersion,
            @JsonProperty("centralRevision") String centralRevision,
            @JsonProperty("fingerprint") String fingerprint,
            @JsonProperty("message") String message
    ) {
        public static SyncResponse of(final MetadataSnapshot s) {
            return new SyncResponse(
                    "OK",
                    s.snapshotId(),
                    s.counts().total(),
                    s.counts().organisationUnits(),
                    s.counts().dataElements(),
                    s.counts().dataSets(),
                    s.counts().programs(),
                    s.counts().trackedEntityTypes(),
                    s.centralVersion(),
                    s.centralRevision(),
                    s.fingerprint(),
                    null
            );
        }
    }
}
