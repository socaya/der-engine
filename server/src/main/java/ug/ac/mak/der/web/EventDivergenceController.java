package ug.ac.mak.der.web;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.events.EventDivergenceClass;

/**
 * FR-07-08 — admin diagnostic listing the most-recent
 * {@code EVENT_DIVERGENCE_*} audits.
 *
 * <p>Classifications come from
 * {@link ug.ac.mak.der.workflows.pull.EventPuller} (emitted on
 * overwrite and during the deletion sweep). The UI surfaces this
 * so operators can distinguish "central edited this event after
 * us" from "central deleted an event we previously published."</p>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/events/divergence",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class EventDivergenceController {

    private final SecurityAuditRepository audit;

    public EventDivergenceController(final SecurityAuditRepository audit) {
        this.audit = Objects.requireNonNull(audit, "audit");
    }

    @GetMapping("/recent")
    public ResponseEntity<Map<String, Object>> recent(
            final Authentication authentication,
            @RequestParam(value = "klass", required = false) final String klass,
            @RequestParam(value = "limit", defaultValue = "100") final int limit) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final String eventType = klass == null || klass.isBlank()
                ? null : "EVENT_DIVERGENCE_" + klass.toUpperCase();
        if (eventType != null && !isKnownKlass(klass)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "UNKNOWN_CLASS",
                    "message", "klass must be one of "
                            + java.util.Arrays.toString(EventDivergenceClass.values())));
        }
        final List<SecurityAuditRepository.Row> rows =
                audit.findRecent(eventType, null, Math.max(1, Math.min(limit, 500)));
        final List<Map<String, Object>> items = rows.stream()
                .filter(r -> r.eventType() != null
                        && r.eventType().startsWith("EVENT_DIVERGENCE_"))
                .map(EventDivergenceController::toJson)
                .toList();
        return ResponseEntity.ok(Map.of(
                "count", items.size(),
                "items", items));
    }

    private static boolean isKnownKlass(final String raw) {
        for (final var k : EventDivergenceClass.values()) {
            if (k.name().equalsIgnoreCase(raw)) {
                return true;
            }
        }
        return false;
    }

    private static Map<String, Object> toJson(final SecurityAuditRepository.Row r) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("auditId", r.auditId());
        m.put("klass", r.eventType().substring("EVENT_DIVERGENCE_".length()));
        m.put("observedAt", r.observedAt().toString());
        m.put("outcome", r.outcome());
        m.put("detailJson", r.detailJson());
        return m;
    }
}
