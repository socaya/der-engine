package ug.ac.mak.der.web;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflow.CaptureWorkflowPrefetchRepository;
import ug.ac.mak.der.workflow.CaptureWorkflowPrefetchRepository.PendingRow;
import ug.ac.mak.der.workflow.WorkflowPrefetchStream;

/**
 * §2.3.60 — client-facing prefetch endpoints.
 *
 * <ul>
 *   <li>{@code GET /prefetch/stream?deviceId=…} — SSE channel; the
 *       client subscribes once per boot and receives a
 *       {@code prefetch} event each time an upstream step completes
 *       and this device becomes the target.</li>
 *   <li>{@code GET /prefetch/pending?deviceId=…} — catch-up for rows
 *       that fired while the client was offline.</li>
 *   <li>{@code POST /prefetch/{stepId}/acked?deviceId=…} — client
 *       confirms it has warmed its cache. Admin monitoring reads
 *       unacked rows older than a threshold as "device failing to
 *       warm".</li>
 * </ul>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/workflows/prefetch")
public class WorkflowPrefetchController {

    private final WorkflowPrefetchStream stream;
    private final CaptureWorkflowPrefetchRepository repo;

    public WorkflowPrefetchController(final WorkflowPrefetchStream stream,
                                        final CaptureWorkflowPrefetchRepository repo) {
        this.stream = Objects.requireNonNull(stream, "stream");
        this.repo = Objects.requireNonNull(repo, "repo");
    }

    @GetMapping(path = "/stream", produces = "text/event-stream")
    public SseEmitter stream(final Authentication auth,
                              @org.springframework.web.bind.annotation.RequestParam("deviceId")
                              final UUID deviceId) {
        requireAuth(auth);
        return stream.register(deviceId);
    }

    @GetMapping(path = "/pending", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> pending(final Authentication auth,
            @org.springframework.web.bind.annotation.RequestParam("deviceId") final UUID deviceId) {
        requireAuth(auth);
        final List<PendingRow> rows = repo.pendingForDevice(deviceId);
        final List<Map<String, Object>> out = new java.util.ArrayList<>();
        for (final PendingRow r : rows) {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("runId", r.runId().toString());
            m.put("stepId", r.stepId().toString());
            m.put("notifiedAt", r.notifiedAt().toString());
            out.add(m);
        }
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("deviceId", deviceId.toString());
        body.put("rows", out);
        return ResponseEntity.ok(body);
    }

    @PostMapping(path = "/{stepId}/acked",
                  produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> ack(final Authentication auth,
            @PathVariable final UUID stepId,
            @org.springframework.web.bind.annotation.RequestParam("deviceId") final UUID deviceId) {
        requireAuth(auth);
        final int updated = repo.ack(stepId, deviceId);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("acked", updated);
        return ResponseEntity.ok(body);
    }

    private static void requireAuth(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            throw new org.springframework.security.access.AccessDeniedException("not authenticated");
        }
    }
}
