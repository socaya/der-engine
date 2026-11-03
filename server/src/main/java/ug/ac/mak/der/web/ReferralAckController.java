package ug.ac.mak.der.web;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.observability.DerMetrics;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/**
 * Phase 10.3 — ADR-0027 D-RHO-4 referral delivery receipt.
 *
 * <p>The destination edge POSTs here once it has ingested a referred
 * record so the origin edge can stamp
 * {@link OperationJournalRepository#markReferralDelivered} and
 * surface "DELIVERED to ou-XYZ" instead of a bare "ACCEPTED" state
 * in the admin UI.</p>
 *
 * <p>Keeps the atomicity semantics simple: a journal row only
 * transitions once from "undelivered" to "delivered" — subsequent
 * acks are no-ops (idempotent). Each successful transition appends
 * a {@code REFERRAL_DELIVERED} audit event; each no-op appends a
 * {@code REFERRAL_ACK_DUPLICATE} audit event so operators can
 * grep "central replayed an ack" from the usual "ack arrived
 * once" case without reading the whole feed.</p>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/referrals",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class ReferralAckController {

    private static final Logger LOG = LoggerFactory.getLogger(ReferralAckController.class);

    private final OperationJournalRepository journal;
    private final SecurityAuditRepository audit;
    private final Clock clock;
    private final DerMetrics metrics;

    public ReferralAckController(final OperationJournalRepository journal,
                                   final SecurityAuditRepository audit,
                                   final Clock clock,
                                   final DerMetrics metrics) {
        this.journal = Objects.requireNonNull(journal, "journal");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.metrics = Objects.requireNonNull(metrics, "metrics");
    }

    @PostMapping(path = "/ack", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> ack(final Authentication authentication,
                                                     @RequestBody final AckRequest body,
                                                     final HttpServletRequest http) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.operationId() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "REFERRAL_ACK_INVALID",
                    "message", "operationId is required"));
        }
        final Instant now = Instant.now(clock);
        final String destOu = body.destinationOrgUnit() == null
                ? null : body.destinationOrgUnit().trim();
        /* Phase 14.2 — hop-aware ack. When the destination edge
         * supplies destinationOrgUnit we require it to match the
         * origin's next_hop_org_unit_uid. Mismatches never flip
         * referral_delivered_at. */
        final int updated = journal.markReferralDelivered(body.operationId(),
                body.receiptId(), now,
                destOu == null || destOu.isBlank() ? null : destOu);
        final Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("operationId", body.operationId().toString());
        if (body.receiptId() != null && !body.receiptId().isBlank()) {
            detail.put("receiptId", body.receiptId().trim());
        }
        if (destOu != null && !destOu.isBlank()) {
            detail.put("destinationOrgUnit", destOu);
        }
        if (updated == 1) {
            audit.append(new AuditEvent(
                    "REFERRAL_DELIVERED",
                    AuditEvent.Outcome.SUCCESS,
                    principal.userId(), null,
                    http.getRemoteAddr(), http.getHeader("User-Agent"),
                    detail), now);
            metrics.referralDelivered();
            return ResponseEntity.ok(Map.of(
                    "operationId", body.operationId().toString(),
                    "deliveredAt", now.toString(),
                    "duplicate", false));
        }
        /* Phase 14.2 — updated=0 covers three cases now:
         *   (1) row doesn't exist, OR row isn't a referral — misroute
         *   (2) row IS a referral but hop mismatches destinationOrgUnit
         *       — potential compromise; log + 403
         *   (3) row IS a referral AND hop matches but it's already
         *       delivered — idempotent replay
         * Case (2) gets a dedicated REFERRAL_ACK_MISROUTE audit so
         * a security-aware operator can grep for it. */
        if (destOu != null && !destOu.isBlank()) {
            final var state = journal.findReferralHopState(body.operationId());
            if (state != null && state.nextHopOrgUnitUid() != null
                    && !state.nextHopOrgUnitUid().equals(destOu)
                    && !state.alreadyDelivered()) {
                detail.put("expectedNextHop", state.nextHopOrgUnitUid());
                audit.append(new AuditEvent(
                        "REFERRAL_ACK_MISROUTE",
                        AuditEvent.Outcome.DENIED,
                        principal.userId(), null,
                        http.getRemoteAddr(), http.getHeader("User-Agent"),
                        detail), now);
                return ResponseEntity.status(403).body(Map.of(
                        "code", "REFERRAL_ACK_MISROUTE",
                        "message", "destinationOrgUnit does not match the origin's next_hop"));
            }
        }
        audit.append(new AuditEvent(
                "REFERRAL_ACK_DUPLICATE",
                AuditEvent.Outcome.SUCCESS,
                principal.userId(), null,
                http.getRemoteAddr(), http.getHeader("User-Agent"),
                detail), now);
        return ResponseEntity.ok(Map.of(
                "operationId", body.operationId().toString(),
                "deliveredAt", now.toString(),
                "duplicate", true));
    }

    public record AckRequest(
            @JsonProperty("operationId") UUID operationId,
            @JsonProperty("receiptId") String receiptId,
            @JsonProperty("destinationOrgUnit") String destinationOrgUnit
    ) { }
}
