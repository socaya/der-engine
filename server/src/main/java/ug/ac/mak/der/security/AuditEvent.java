package ug.ac.mak.der.security;

import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Phase 02 audit record. Writes go to {@code security_audit}.
 *
 * @param eventType     canonical event name, upper-snake-case (e.g. {@code SIGN_IN_SUCCESS})
 * @param outcome       {@link Outcome#SUCCESS}, {@link Outcome#DENIED}, {@link Outcome#ERROR}
 * @param actorUserId   the user performing the action (null for anonymous)
 * @param subjectUserId the user being acted upon (null if not applicable)
 * @param clientIp      the client IP as seen by DER
 * @param userAgent     client user-agent header
 * @param detail        structured sidecar; MUST NOT include secrets or password material
 */
public record AuditEvent(
        String eventType,
        Outcome outcome,
        UUID actorUserId,
        UUID subjectUserId,
        String clientIp,
        String userAgent,
        Map<String, Object> detail
) {

    public AuditEvent {
        Objects.requireNonNull(eventType, "eventType");
        Objects.requireNonNull(outcome, "outcome");
        detail = detail == null ? Map.of() : Map.copyOf(detail);
    }

    public enum Outcome {
        SUCCESS,
        DENIED,
        ERROR
    }
}
