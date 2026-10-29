package ug.ac.mak.der.web;

import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.SecurityHardeningService;

/** §6 — Admin surface for hardening status probes. */
@RestController
@RequestMapping(path = "/edge-api/v1/security/hardening",
                 produces = MediaType.APPLICATION_JSON_VALUE)
public class SecurityHardeningController {

    private final SecurityHardeningService svc;

    public SecurityHardeningController(final SecurityHardeningService svc) {
        this.svc = Objects.requireNonNull(svc, "svc");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> summary() {
        return ResponseEntity.ok(svc.summary());
    }

    @GetMapping("/apparmor")
    public ResponseEntity<Map<String, Object>> apparmor() {
        return ResponseEntity.ok(svc.apparmorStatus());
    }

    @GetMapping("/fail2ban")
    public ResponseEntity<Map<String, Object>> fail2ban() {
        return ResponseEntity.ok(svc.fail2banStatus());
    }

    @GetMapping("/vault")
    public ResponseEntity<Map<String, Object>> vault() {
        return ResponseEntity.ok(svc.vaultStatus());
    }

    @GetMapping("/vault/{key}")
    public ResponseEntity<Map<String, Object>> fetchSecret(@PathVariable final String key) {
        return svc.secret(key)
            .<ResponseEntity<Map<String, Object>>>map(v -> ResponseEntity.ok(Map.of(
                "key", key, "value", v, "source", "vault-or-env")))
            .orElseGet(() -> ResponseEntity.status(404).body(Map.of(
                "code", "SECRET_NOT_FOUND", "message", "no vault entry or env var for " + key)));
    }

    @GetMapping("/fips")
    public ResponseEntity<Map<String, Object>> fips() {
        return ResponseEntity.ok(svc.fipsStatus());
    }
}
