package ug.ac.mak.der.web;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/**
 * ADR-0027 D-RHO-4. ADMIN-only endpoint for tagging an existing
 * journal entry with a {@code next_hop_org_unit_uid}. Audits each
 * tag through the hash-chain (D-RHO-6).
 */
@RestController
@RequestMapping(path = "/edge-api/v1/journal", produces = MediaType.APPLICATION_JSON_VALUE)
public class JournalReferralController {

    private static final Logger LOG = LoggerFactory.getLogger(JournalReferralController.class);

    private final OperationJournalRepository journal;
    private final SecurityAuditRepository audit;
    private final Clock clock;

    public JournalReferralController(final OperationJournalRepository journal,
                                       final SecurityAuditRepository audit,
                                       final Clock clock) {
        this.journal = Objects.requireNonNull(journal, "journal");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @PostMapping(path = "/{operationId}/next-hop", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> setNextHop(
            final Authentication authentication,
            @PathVariable("operationId") final UUID operationId,
            @RequestBody final NextHopRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.orgUnitUid() == null || body.orgUnitUid().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "NEXT_HOP_INVALID",
                    "message", "orgUnitUid required"));
        }
        if (journal.findById(operationId).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final String ou = body.orgUnitUid().trim();
        journal.markNextHop(operationId, ou);
        try {
            audit.append(new AuditEvent(
                    "JOURNAL_NEXT_HOP_SET",
                    AuditEvent.Outcome.SUCCESS,
                    principal.userId(), null, null, null,
                    Map.of("operationId", operationId.toString(),
                            "orgUnitUid", ou)),
                    Instant.now(clock));
        } catch (RuntimeException ex) {
            LOG.warn("audit append for JOURNAL_NEXT_HOP_SET failed: {}", ex.getMessage());
        }
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("operationId", operationId.toString());
        out.put("nextHopOrgUnitUid", ou);
        return ResponseEntity.ok(out);
    }

    public record NextHopRequest(@JsonProperty("orgUnitUid") String orgUnitUid) { }
}
