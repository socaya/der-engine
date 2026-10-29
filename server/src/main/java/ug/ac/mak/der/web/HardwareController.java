package ug.ac.mak.der.web;

import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.hardware.HardwareService;

/** §4 Hardware integration — admin surface for watchdog state,
 *  thermal / UPS sensors, status LEDs, and TPM-sealed secrets. */
@RestController
@RequestMapping(path = "/edge-api/v1/system/hardware",
                 produces = MediaType.APPLICATION_JSON_VALUE)
public class HardwareController {

    private final HardwareService svc;

    public HardwareController(final HardwareService svc) {
        this.svc = Objects.requireNonNull(svc, "svc");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> summary() {
        return ResponseEntity.ok(svc.summary());
    }

    @GetMapping("/watchdog")
    public ResponseEntity<Map<String, Object>> watchdog() {
        return ResponseEntity.ok(svc.watchdogState());
    }

    @GetMapping("/thermal")
    public ResponseEntity<Map<String, Object>> thermal(
            @RequestParam(value = "history", defaultValue = "false") final boolean history,
            @RequestParam(value = "limit", defaultValue = "120") final int limit) {
        return ResponseEntity.ok(history
            ? Map.of("samples", svc.thermalRecent(limit))
            : svc.thermalSummary());
    }

    @GetMapping("/ups")
    public ResponseEntity<Map<String, Object>> ups() {
        return ResponseEntity.ok(svc.upsStatus());
    }

    @GetMapping("/leds")
    public ResponseEntity<Map<String, Object>> leds() {
        return ResponseEntity.ok(Map.of("zones", svc.ledState()));
    }

    @PostMapping(path = "/leds/{zone}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> setLed(@PathVariable final String zone,
                                                        @RequestBody final LedBody body) {
        if (body == null || body.color == null || body.pattern == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "COLOR_PATTERN_REQUIRED",
                "message", "color + pattern required"));
        }
        final int n = svc.setLedState(zone, body.color, body.pattern,
                                        body.periodMs, body.label);
        return n > 0
            ? ResponseEntity.ok(Map.of("updated", true))
            : ResponseEntity.status(404).body(Map.of(
                "code", "ZONE_NOT_FOUND", "message", zone));
    }

    @GetMapping("/sealed")
    public ResponseEntity<Map<String, Object>> sealed() {
        return ResponseEntity.ok(Map.of("secrets", svc.sealedSecrets()));
    }

    @PostMapping(path = "/sealed", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> seal(@RequestBody final SealBody body) {
        if (body == null || body.secretId == null || body.plaintext == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "FIELDS_REQUIRED",
                "message", "secretId + plaintext required"));
        }
        return ResponseEntity.ok(svc.sealSecret(body.secretId,
                                                   body.description,
                                                   body.plaintext));
    }

    @GetMapping("/sealed/{secretId}")
    public ResponseEntity<Map<String, Object>> unseal(@PathVariable final String secretId) {
        return svc.unseal(secretId)
            .<ResponseEntity<Map<String, Object>>>map(plain -> ResponseEntity.ok(Map.of(
                "secretId", secretId, "plaintext", plain)))
            .orElseGet(() -> ResponseEntity.status(404).body(Map.of(
                "code", "SEALED_NOT_FOUND", "message", secretId)));
    }

    public static final class LedBody {
        public String color;
        public String pattern;
        public Integer periodMs;
        public String label;
    }
    public static final class SealBody {
        public String secretId;
        public String description;
        public String plaintext;
    }
}
