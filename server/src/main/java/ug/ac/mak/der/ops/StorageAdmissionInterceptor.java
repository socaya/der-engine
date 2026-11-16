package ug.ac.mak.der.ops;

import java.io.IOException;
import java.util.Objects;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * FR-14-09: write admission guard. Rejects mutating requests with
 * HTTP 507 Insufficient Storage when the storage probe reports
 * {@link StorageHealthProbe.Status#REJECT}. Read-only methods are
 * always allowed so operators can diagnose while the alarm is active.
 *
 * <p>Not a {@code @Component} — registered as a bean by
 * {@link StorageWebConfig} which is gated on {@link StorageHealthProbe}
 * presence so slice-tests ({@code @WebMvcTest}) do not require the
 * probe in their context.</p>
 */
public class StorageAdmissionInterceptor implements HandlerInterceptor {

    private static final Set<String> WRITE_METHODS =
            Set.of("POST", "PUT", "PATCH", "DELETE");

    private final StorageHealthProbe probe;

    public StorageAdmissionInterceptor(final StorageHealthProbe probe) {
        this.probe = Objects.requireNonNull(probe, "probe");
    }

    @Override
    public boolean preHandle(final HttpServletRequest request,
                              final HttpServletResponse response,
                              final Object handler) throws IOException {
        if (!WRITE_METHODS.contains(request.getMethod())) {
            return true;
        }
        final String path = request.getRequestURI();
        if (path == null) {
            return true;
        }
        // NFR-30 — also gate the DHIS2-emulated write surfaces
        // (/api/dataValueSets, /api/events, /api/tracker). These
        // are the hot paths that persist to operation_journal; if
        // storage is below the reject threshold, acknowledging
        // them would violate "never report false success."
        if (!path.startsWith("/edge-api/") && !path.startsWith("/api/")) {
            return true;
        }
        if (path.startsWith("/edge-api/v1/auth/")
                || path.startsWith("/edge-api/v1/admin/ops/")) {
            return true;
        }
        // DHIS2 /api/* exemptions: auth-adjacent + settings
        // writes that just update a kv row. Keep the heavy
        // mutation paths (dataValueSets, events, tracker) gated.
        if (path.equals("/api/me")
                || path.startsWith("/api/userSettings")
                || path.startsWith("/api/systemSettings")) {
            return true;
        }
        final StorageHealthProbe.Snapshot s = probe.sample();
        if (s.status() != StorageHealthProbe.Status.REJECT) {
            return true;
        }
        response.setStatus(HttpStatus.INSUFFICIENT_STORAGE.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(
                "{\"code\":\"STORAGE_FULL_REJECT\",\"message\":"
                        + "\"Local durable storage is below operator-set reject threshold; "
                        + "new write operations are temporarily blocked.\",\"usableBytes\":"
                        + s.usableBytes() + ",\"rejectBytes\":" + s.rejectBytes() + "}");
        return false;
    }
}
