package ug.ac.mak.der.web;

import java.util.Map;
import java.util.Objects;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.testing.TestingHarnessService;

/** §9 Testing — operator-triggered chaos / load / soak runs. */
@RestController
@RequestMapping(path = "/edge-api/v1/testing", produces = MediaType.APPLICATION_JSON_VALUE)
public class TestingController {

    private final TestingHarnessService svc;

    public TestingController(final TestingHarnessService svc) {
        this.svc = Objects.requireNonNull(svc, "svc");
    }

    @GetMapping({"", "/"})
    public ResponseEntity<Map<String, Object>> index() {
        return ResponseEntity.ok(Map.of(
            "summary", svc.summary(),
            "runs",    svc.history(50)
        ));
    }

    @GetMapping("/runs")
    public ResponseEntity<Object> runs(@RequestParam(name = "limit", defaultValue = "50") final int limit) {
        return ResponseEntity.ok(svc.history(limit));
    }

    @PostMapping("/load")
    public ResponseEntity<Map<String, Object>> load(
            @RequestParam(name = "concurrency", defaultValue = "8") final int concurrency,
            @RequestParam(name = "durationSec", defaultValue = "5") final int durationSec,
            final HttpServletRequest req, final Authentication auth) {
        return ResponseEntity.ok(svc.runLoad(concurrency, durationSec, baseUrl(req), user(auth)));
    }

    @PostMapping("/soak")
    public ResponseEntity<Map<String, Object>> soak(
            @RequestParam(name = "concurrency", defaultValue = "2") final int concurrency,
            @RequestParam(name = "durationSec", defaultValue = "20") final int durationSec,
            final HttpServletRequest req, final Authentication auth) {
        return ResponseEntity.ok(svc.runSoak(concurrency, durationSec, baseUrl(req), user(auth)));
    }

    @PostMapping("/chaos")
    public ResponseEntity<Map<String, Object>> chaos(
            @RequestParam(name = "scenario", defaultValue = "pool-saturation") final String scenario,
            final HttpServletRequest req, final Authentication auth) {
        return ResponseEntity.ok(svc.runChaos(scenario, baseUrl(req), user(auth)));
    }

    @PostMapping("/runs")
    public ResponseEntity<Map<String, Object>> recordRun(
            @RequestBody final Map<String, Object> body, final Authentication auth) {
        return ResponseEntity.ok(svc.recordRun(body, user(auth)));
    }

    private static String baseUrl(final HttpServletRequest req) {
        final String scheme = req.getScheme();
        final String host = req.getServerName();
        final int port = req.getServerPort();
        return scheme + "://" + host + ":" + port;
    }

    private static String user(final Authentication auth) {
        return auth == null ? "system" : auth.getName();
    }
}
