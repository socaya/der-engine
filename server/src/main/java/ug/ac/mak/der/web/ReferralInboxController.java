package ug.ac.mak.der.web;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.workflows.referral.ReferralInboxEntry;
import ug.ac.mak.der.workflows.referral.ReferralInboxRepository;

/** ADR-0027 alpha.4. Read-only inbox listing; resolve actions land in alpha.5. */
@RestController
@RequestMapping(path = "/edge-api/v1/referral/inbox", produces = MediaType.APPLICATION_JSON_VALUE)
public class ReferralInboxController {

    private final ReferralInboxRepository repo;

    public ReferralInboxController(final ReferralInboxRepository repo) {
        this.repo = Objects.requireNonNull(repo, "repo");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(name = "limit", defaultValue = "100") final int limit) {
        final List<Map<String, Object>> rows = repo.findPending(limit).stream()
                .map(ReferralInboxController::toJson).toList();
        return ResponseEntity.ok(Map.of("entries", rows));
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
