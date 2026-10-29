package ug.ac.mak.der.web;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.messaging.DeviceMessageService;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/** Phase N5 — DER-MSG v1 REST surface.
 *
 *  <p>Device-facing: publish / recent / ack / subscribe / unsubscribe.
 *  Admin-facing: stats + full recent across every channel.</p> */
@RestController
@RequestMapping(path = "/edge-api/v1/messaging", produces = MediaType.APPLICATION_JSON_VALUE)
public class DeviceMessageController {

    private final DeviceMessageService svc;

    public DeviceMessageController(final DeviceMessageService svc) {
        this.svc = Objects.requireNonNull(svc, "svc");
    }

    /* ─── Device-facing ───────────────────────────────────────── */

    @PostMapping(path = "/publish", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> publish(final Authentication auth,
                                                        @RequestBody final PublishBody body) {
        if (body == null || body.channel == null || body.messageType == null
                || body.fromDeviceId == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "FIELDS_REQUIRED",
                "message", "channel + messageType + fromDeviceId required"));
        }
        final UUID uid = auth instanceof EdgeUserPrincipal p ? p.userId() : null;
        final Duration ttl = body.ttlSeconds == null ? null : Duration.ofSeconds(body.ttlSeconds);
        final UUID id = svc.publish(body.channel, body.fromDeviceId, uid,
                                     body.messageType, body.payload, body.replyTo, ttl);
        return ResponseEntity.status(201).body(Map.of("messageId", id.toString()));
    }

    /** Pull messages addressed to this device (and any role / broadcast
     *  channels it subscribes to) since {@code since}. Devices call this
     *  every few seconds — effectively long-poll substitute. */
    @GetMapping("/recent")
    public ResponseEntity<Map<String, Object>> recent(
            @RequestParam(value = "deviceId") final String deviceId,
            @RequestParam(value = "since", required = false) final String since,
            @RequestParam(value = "limit", defaultValue = "50") final int limit) {
        if (deviceId == null || deviceId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "DEVICE_ID_REQUIRED",
                "message", "deviceId required"));
        }
        final Instant t;
        try {
            t = since == null ? Instant.EPOCH : Instant.parse(since);
        } catch (final Exception ex) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "BAD_SINCE", "message", "since must be ISO-8601"));
        }
        return ResponseEntity.ok(Map.of(
            "messages", svc.recentForDevice(deviceId, t, limit)));
    }

    @PostMapping("/ack/{messageId}")
    public ResponseEntity<Map<String, Object>> ack(final Authentication auth,
                                                    @PathVariable final UUID messageId,
                                                    @RequestParam final String deviceId) {
        if (deviceId == null || deviceId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "DEVICE_ID_REQUIRED", "message", "deviceId required"));
        }
        return ResponseEntity.ok(Map.of("acked", svc.ack(messageId, deviceId)));
    }

    @PostMapping("/subscribe")
    public ResponseEntity<Map<String, Object>> subscribe(final Authentication auth,
                                                          @RequestBody final SubscribeBody body) {
        if (body == null || body.deviceId == null || body.channel == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "FIELDS_REQUIRED", "message", "deviceId + channel required"));
        }
        svc.subscribe(body.deviceId, body.channel);
        return ResponseEntity.ok(Map.of("subscribed", true));
    }

    @DeleteMapping("/subscribe")
    public ResponseEntity<Map<String, Object>> unsubscribe(
            @RequestParam final String deviceId,
            @RequestParam final String channel) {
        return ResponseEntity.ok(Map.of("removed",
            svc.unsubscribe(deviceId, channel)));
    }

    @PostMapping(path = "/cursor", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> cursor(@RequestBody final CursorBody body) {
        if (body == null || body.deviceId == null || body.channel == null || body.cursor == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "FIELDS_REQUIRED",
                "message", "deviceId + channel + cursor required"));
        }
        svc.updateCursor(body.deviceId, body.channel, Instant.parse(body.cursor));
        return ResponseEntity.ok(Map.of("updated", true));
    }

    /* ─── Admin-facing ────────────────────────────────────────── */

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> stats() {
        return ResponseEntity.ok(svc.stats());
    }

    @GetMapping("/log")
    public ResponseEntity<Map<String, Object>> log(
            @RequestParam(value = "limit", defaultValue = "100") final int limit) {
        return ResponseEntity.ok(Map.of("messages", svc.recentAcrossChannels(limit)));
    }

    @GetMapping("/subscriptions")
    public ResponseEntity<Map<String, Object>> subscriptions() {
        return ResponseEntity.ok(Map.of("subscriptions", svc.subscriptions()));
    }

    /* ─── Bodies ──────────────────────────────────────────────── */

    public static final class PublishBody {
        public String channel;
        public String fromDeviceId;
        public String messageType;
        public Map<String, Object> payload;
        public UUID replyTo;
        public Integer ttlSeconds;
    }

    public static final class SubscribeBody {
        public String deviceId;
        public String channel;
    }

    public static final class CursorBody {
        public String deviceId;
        public String channel;
        public String cursor;
    }
}
