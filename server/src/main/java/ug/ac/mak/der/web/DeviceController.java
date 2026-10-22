package ug.ac.mak.der.web;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.device.DeviceService;
import ug.ac.mak.der.device.EdgeDevice;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/** ADR-0019 device-management REST surface. */
@RestController
@RequestMapping(path = "/edge-api/v1/devices", produces = MediaType.APPLICATION_JSON_VALUE)
public class DeviceController {

    private final DeviceService svc;

    public DeviceController(final DeviceService svc) {
        this.svc = Objects.requireNonNull(svc, "svc");
    }

    @PostMapping(path = "/enroll", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> enrol(final Authentication authentication,
                                                       @RequestBody final EnrolRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.deviceId() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "DEVICE_ID_REQUIRED",
                    "message", "deviceId is required"));
        }
        final DeviceService.EnrolResult res = svc.enrol(body.deviceId(),
                principal.userId(), body.userAgent());
        final Map<String, Object> m = toJson(res.device());
        // The one-shot token is returned on the enrol response only.
        m.put("enrolmentToken", res.enrolmentToken());
        return ResponseEntity.status(201).body(m);
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list() {
        return ResponseEntity.ok(Map.of("devices",
                svc.list().stream().map(DeviceController::toJson).toList()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable("id") final UUID id) {
        return svc.get(id)
                .<ResponseEntity<Map<String, Object>>>map(d -> ResponseEntity.ok(toJson(d)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<Map<String, Object>> approve(final Authentication authentication,
                                                         @PathVariable("id") final UUID id) {
        return decide(authentication, svc::approve, id);
    }

    @PostMapping("/{id}/suspend")
    public ResponseEntity<Map<String, Object>> suspend(final Authentication authentication,
                                                         @PathVariable("id") final UUID id) {
        return decide(authentication, svc::suspend, id);
    }

    @PostMapping("/{id}/revoke")
    public ResponseEntity<Map<String, Object>> revoke(final Authentication authentication,
                                                        @PathVariable("id") final UUID id) {
        return decide(authentication, svc::revoke, id);
    }

    @PostMapping("/{id}/heartbeat")
    public ResponseEntity<Map<String, Object>> heartbeat(final Authentication authentication,
                                                           @PathVariable("id") final UUID id) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return switch (svc.heartbeat(id)) {
            case OK -> ResponseEntity.ok(Map.of("outcome", "OK"));
            case NOT_FOUND -> ResponseEntity.notFound().build();
            case REVOKED -> ResponseEntity.status(403).body(Map.of(
                    "code", "DEVICE_REVOKED",
                    "message", "device " + id + " has been revoked"));
        };
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable("id") final UUID id) {
        return svc.delete(id) == 0 ? ResponseEntity.notFound().build()
                : ResponseEntity.noContent().build();
    }

    private ResponseEntity<Map<String, Object>> decide(final Authentication authentication,
                                                         final java.util.function.BiFunction<UUID, UUID,
                                                                 DeviceService.Outcome> op,
                                                         final UUID id) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        return switch (op.apply(id, principal.userId())) {
            case OK -> ResponseEntity.ok(Map.of("outcome", "OK"));
            case NOT_FOUND -> ResponseEntity.notFound().build();
            case REVOKED_IS_TERMINAL -> ResponseEntity.status(409).body(Map.of(
                    "code", "DEVICE_REVOKED",
                    "message", "revoked devices cannot be re-approved; delete and re-enrol"));
        };
    }

    private static Map<String, Object> toJson(final EdgeDevice d) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("deviceId", d.deviceId().toString());
        m.put("assignedUserId", d.assignedUserId() == null ? null : d.assignedUserId().toString());
        m.put("enrolledAt", d.enrolledAt().toString());
        m.put("approvedBy", d.approvedBy() == null ? null : d.approvedBy().toString());
        m.put("approvedAt", d.approvedAt() == null ? null : d.approvedAt().toString());
        m.put("lastSeenAt", d.lastSeenAt() == null ? null : d.lastSeenAt().toString());
        m.put("userAgent", d.userAgent());
        m.put("firmwareVersion", d.firmwareVersion());
        m.put("status", d.status().name());
        return m;
    }

    public record EnrolRequest(
            @JsonProperty("deviceId") UUID deviceId,
            @JsonProperty("userAgent") String userAgent) { }
}
