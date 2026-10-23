package ug.ac.mak.der.web;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.referral.ReferralInboxEntry;
import ug.ac.mak.der.workflows.referral.ReferralInboxRepository;

/** ADR-0027 alpha.5 adds resolve actions (accept + dismiss). */
@RestController
@RequestMapping(path = "/edge-api/v1/referral/inbox", produces = MediaType.APPLICATION_JSON_VALUE)
public class ReferralInboxController {

    private final ReferralInboxRepository repo;
    private final Clock clock;

    public ReferralInboxController(final ReferralInboxRepository repo, final Clock clock) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(name = "limit", defaultValue = "100") final int limit) {
        final List<Map<String, Object>> rows = repo.findPending(limit).stream()
                .map(ReferralInboxController::toJson).toList();
        return ResponseEntity.ok(Map.of("entries", rows));
    }

    @PostMapping("/{inboxId}/accept")
    public ResponseEntity<Map<String, Object>> accept(final Authentication authentication,
                                                        @PathVariable("inboxId") final UUID inboxId) {
        return resolve(authentication, inboxId, ReferralInboxEntry.Status.ACCEPTED);
    }

    @PostMapping("/{inboxId}/dismiss")
    public ResponseEntity<Map<String, Object>> dismiss(final Authentication authentication,
                                                         @PathVariable("inboxId") final UUID inboxId) {
        return resolve(authentication, inboxId, ReferralInboxEntry.Status.DISMISSED);
    }

    private ResponseEntity<Map<String, Object>> resolve(final Authentication authentication,
                                                          final UUID inboxId,
                                                          final ReferralInboxEntry.Status status) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final int rows = repo.markResolved(inboxId, status, principal.userId(), Instant.now(clock));
        if (rows == 0) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("inboxId", inboxId.toString(),
                "status", status.name()));
    }

    private static Map<String, Object> toJson(final ReferralInboxEntry e) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("inboxId", e.inboxId().toString());
        m.put("kind", e.kind().name());
        m.put("sourceRef", e.sourceRef());
        m.put("boundOrgUnit", e.boundOrgUnit());
        m.put("discoveredAt", e.discoveredAt().toString());
        m.put("status", e.status().name());
        return m;
    }
}
