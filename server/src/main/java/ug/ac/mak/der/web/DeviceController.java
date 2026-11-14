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
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.device.DeviceAdjacencyService;
import ug.ac.mak.der.device.DeviceService;
import ug.ac.mak.der.device.EdgeDevice;
import ug.ac.mak.der.device.UnifiedDeviceService;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/** ADR-0019 device-management REST surface. */
@RestController
@RequestMapping(path = "/edge-api/v1/devices", produces = MediaType.APPLICATION_JSON_VALUE)
public class DeviceController {

    private final DeviceService svc;
    private final DeviceAdjacencyService adjacency;
    private final UnifiedDeviceService unified;

    public DeviceController(final DeviceService svc,
                             final DeviceAdjacencyService adjacency,
                             final UnifiedDeviceService unified) {
        this.svc = Objects.requireNonNull(svc, "svc");
        this.adjacency = Objects.requireNonNull(adjacency, "adjacency");
        this.unified = Objects.requireNonNull(unified, "unified");
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

    /** UI-1 — merged view across the DHIS2 fleet registry
     *  ({@code edge_device}) and the local-LAN mesh registry
     *  ({@code network_client}). Each returned entry carries a
     *  {@code sources} array naming the registries it was observed
     *  in so the admin UI can render one truth for device identity
     *  without hiding PENDING sessions or LAN-only clients. */
    @GetMapping("/unified")
    public ResponseEntity<Map<String, Object>> listUnified() {
        return ResponseEntity.ok(Map.of("devices",
                unified.list().stream()
                        .map(UnifiedDeviceService.UnifiedDevice::toJson)
                        .toList()));
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
                                                           @PathVariable("id") final UUID id,
                                                           final jakarta.servlet.http.HttpServletRequest request) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final String ip = request == null ? null : request.getRemoteAddr();
        final String autoLabel = originLabel(request);
        return switch (svc.heartbeat(id, ip, autoLabel)) {
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

    /** V043 — rename + form-factor edit. */
    @PatchMapping(path = "/{id}/profile", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> updateProfile(
            final Authentication authentication,
            @PathVariable("id") final UUID id,
            @RequestBody final ProfileRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "BODY_REQUIRED",
                    "message", "profile body is required"));
        }
        final EdgeDevice.FormFactor ff;
        try {
            ff = body.formFactor() == null ? EdgeDevice.FormFactor.UNKNOWN
                    : EdgeDevice.FormFactor.valueOf(body.formFactor().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "FORM_FACTOR_INVALID",
                    "message", "form factor must be WORKSTATION / LAPTOP / TABLET / MOBILE / UNKNOWN"));
        }
        return switch (svc.renameProfile(id, body.displayName(), ff)) {
            case OK -> svc.get(id)
                    .<ResponseEntity<Map<String, Object>>>map(d -> ResponseEntity.ok(toJson(d)))
                    .orElseGet(() -> ResponseEntity.notFound().build());
            case NOT_FOUND -> ResponseEntity.notFound().build();
            case REVOKED_IS_TERMINAL -> ResponseEntity.status(409).body(Map.of(
                    "code", "DEVICE_REVOKED",
                    "message", "revoked devices cannot be edited"));
        };
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
        m.put("displayName", d.displayName());
        m.put("formFactor", d.formFactor().name());
        return m;
    }

    /** List every adjacency row this edge knows about. */
    @GetMapping("/adjacencies")
    public ResponseEntity<Map<String, Object>> listAdjacencies() {
        return ResponseEntity.ok(Map.of("adjacencies", adjacency.list()));
    }

    /** Adjacencies involving a specific device. */
    @GetMapping("/{id}/adjacencies")
    public ResponseEntity<Map<String, Object>> listDeviceAdjacencies(
            @PathVariable("id") final UUID id) {
        return ResponseEntity.ok(Map.of("adjacencies", adjacency.listFor(id)));
    }

    /** Report (or re-report) a P2P link from device {id} to peerDeviceId. */
    @PostMapping(path = "/{id}/adjacencies", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> postAdjacency(
            final Authentication authentication,
            @PathVariable("id") final UUID id,
            @RequestBody final AdjacencyRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.peerDeviceId() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "PEER_DEVICE_ID_REQUIRED",
                    "message", "peerDeviceId is required"));
        }
        try {
            final DeviceAdjacencyService.LinkType lt = body.linkType() == null
                    ? DeviceAdjacencyService.LinkType.P2P
                    : DeviceAdjacencyService.LinkType.valueOf(
                            body.linkType().toUpperCase().replace('-', '_'));
            final DeviceAdjacencyService.State st = body.state() == null
                    ? DeviceAdjacencyService.State.ACTIVE
                    : DeviceAdjacencyService.State.valueOf(body.state().toUpperCase());
            return ResponseEntity.ok(adjacency.upsert(id, body.peerDeviceId(),
                    lt, st, principal.userId()));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "ADJACENCY_INVALID",
                    "message", ex.getMessage()));
        }
    }

    /** Clear a reported adjacency. */
    @DeleteMapping("/{id}/adjacencies/{peerId}")
    public ResponseEntity<Void> deleteAdjacency(
            @PathVariable("id") final UUID id,
            @PathVariable("peerId") final UUID peerId) {
        return adjacency.delete(id, peerId) == 0
                ? ResponseEntity.notFound().build()
                : ResponseEntity.noContent().build();
    }

    public record EnrolRequest(
            @JsonProperty("deviceId") UUID deviceId,
            @JsonProperty("userAgent") String userAgent) { }

    public record ProfileRequest(
            @JsonProperty("displayName") String displayName,
            @JsonProperty("formFactor") String formFactor) { }

    public record AdjacencyRequest(
            @JsonProperty("peerDeviceId") UUID peerDeviceId,
            @JsonProperty("linkType") String linkType,
            @JsonProperty("state") String state) { }

    /** Derive a human-friendly label from the browser session's Origin
     *  (or Referer) header. Loopback dev sessions share 127.0.0.1 so
     *  only the port distinguishes them — the resulting label is
     *  {@code "Client 5174"} for the client dev server, {@code "Client 5173"}
     *  for admin-ui, etc. Returns null when no meaningful port can be
     *  extracted so the caller falls back to the existing name. */
    static String originLabel(final jakarta.servlet.http.HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        final String origin = firstNonBlank(
                request.getHeader("Origin"), request.getHeader("Referer"));
        if (origin == null) {
            return null;
        }
        try {
            final java.net.URI uri = java.net.URI.create(origin);
            final int port = uri.getPort();
            if (port > 0) {
                return "Client " + port;
            }
        } catch (IllegalArgumentException ex) {
            // fall through
        }
        return null;
    }

    private static String firstNonBlank(final String a, final String b) {
        if (a != null && !a.isBlank()) {
            return a;
        }
        if (b != null && !b.isBlank()) {
            return b;
        }
        return null;
    }
}
