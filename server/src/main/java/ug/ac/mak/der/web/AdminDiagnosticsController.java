package ug.ac.mak.der.web;

import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * G1: thin wrapper over {@link EdgeSystemInfoController#info} so the
 * admin UI's {@code /diagnostics} screen has a stable endpoint
 * ({@code /edge-api/v1/admin/diagnostics}) matching the client-side
 * {@code edgeApi.diagnostics()} call. Returns the same payload shape.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/admin/diagnostics",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class AdminDiagnosticsController {

    private final EdgeSystemInfoController sysInfo;

    public AdminDiagnosticsController(final EdgeSystemInfoController sysInfo) {
        this.sysInfo = Objects.requireNonNull(sysInfo, "sysInfo");
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> get(final Authentication authentication) {
        return sysInfo.info(authentication);
    }
}
