package ug.ac.mak.der.web;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.security.SecurityAuditRepository.Row;

/** C2: audit event timeline for the admin UI. */
@RestController
@RequestMapping(path = "/edge-api/v1/security/audit/events",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class SecurityAuditEventsController {

    private final SecurityAuditRepository repo;

    public SecurityAuditEventsController(final SecurityAuditRepository repo) {
        this.repo = Objects.requireNonNull(repo, "repo");
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> list(
            final Authentication authentication,
            @RequestParam(value = "eventType", required = false) final String eventType,
            @RequestParam(value = "actorUserId", required = false) final UUID actorUserId,
            @RequestParam(value = "limit", defaultValue = "100") final int limit) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final List<Row> rows = repo.findRecent(eventType, actorUserId, limit);
        return ResponseEntity.ok(Map.of(
                "count", rows.size(),
                "events", rows.stream().map(SecurityAuditEventsController::toJson).toList()));
    }

    private static Map<String, Object> toJson(final Row r) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("eventType", r.eventType());
        m.put("actorUserId", r.actorUserId() == null ? null : r.actorUserId().toString());
        m.put("subjectUserId", r.subjectUserId() == null ? null : r.subjectUserId().toString());
        m.put("clientIp", r.clientIp());
        m.put("userAgent", r.userAgent());
        m.put("outcome", r.outcome());
        m.put("detail", r.detailJson());
        m.put("observedAt", r.observedAt().toString());
        return m;
    }
}
