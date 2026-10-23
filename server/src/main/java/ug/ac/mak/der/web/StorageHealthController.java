package ug.ac.mak.der.web;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.ops.StorageHealthProbe;

/**
 * FR-14-09: durable storage alarm readback. Operator UIs and health
 * checks consume this to decide whether to admit new write operations.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/system", produces = MediaType.APPLICATION_JSON_VALUE)
public class StorageHealthController {

    private final StorageHealthProbe probe;

    public StorageHealthController(final StorageHealthProbe probe) {
        this.probe = Objects.requireNonNull(probe, "probe");
    }

    @GetMapping("/storage")
    public ResponseEntity<Map<String, Object>> storage() {
        final StorageHealthProbe.Snapshot s = probe.sample();
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("root", s.root());
        body.put("usableBytes", s.usableBytes());
        body.put("totalBytes", s.totalBytes());
        body.put("warnBytes", s.warnBytes());
        body.put("rejectBytes", s.rejectBytes());
        body.put("status", s.status().name());
        body.put("usable", s.formattedUsable());
        body.put("admitsWrites", s.status() != StorageHealthProbe.Status.REJECT);
        return ResponseEntity.ok(body);
    }
}
