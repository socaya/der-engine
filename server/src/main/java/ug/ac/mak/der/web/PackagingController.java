package ug.ac.mak.der.web;

import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.packaging.PackagingService;

/** §10 Packaging — appliance artefact registry. */
@RestController
@RequestMapping(path = "/edge-api/v1/packaging", produces = MediaType.APPLICATION_JSON_VALUE)
public class PackagingController {

    private final PackagingService svc;

    public PackagingController(final PackagingService svc) {
        this.svc = Objects.requireNonNull(svc, "svc");
    }

    @GetMapping({"", "/"})
    public ResponseEntity<Map<String, Object>> index() {
        return ResponseEntity.ok(Map.of(
            "summary",   svc.summary(),
            "artifacts", svc.artifacts(50)));
    }

    @GetMapping("/artifacts")
    public ResponseEntity<Object> artifacts(
            @RequestParam(name = "limit", defaultValue = "50") final int limit) {
        return ResponseEntity.ok(svc.artifacts(limit));
    }

    @PostMapping("/artifacts")
    public ResponseEntity<Map<String, Object>> record(
            @RequestBody final Map<String, Object> body, final Authentication auth) {
        return ResponseEntity.ok(svc.record(body, auth == null ? "system" : auth.getName()));
    }
}
