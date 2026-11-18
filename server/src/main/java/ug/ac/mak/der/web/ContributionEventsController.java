package ug.ac.mak.der.web;

import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflow.ContributionEventPublisher;

/**
 * SSE stream of {@code contribution.completed} events. Consumed by
 * the browser-side DPP.4 subscriber which converts each event into a
 * {@code workflow.run-advance} DPP/1 frame fanned out over the mesh.
 *
 * <p>Separate controller from {@link CaptureWorkflowController} so
 * the SSE surface stays dependency-trimmed and the long-lived
 * emitter lifecycle is isolated from the transactional capture
 * endpoints.</p>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/workflows/runs/events")
public class ContributionEventsController {

    private final ContributionEventPublisher pub;

    public ContributionEventsController(final ContributionEventPublisher pub) {
        this.pub = Objects.requireNonNull(pub, "pub");
    }

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            final SseEmitter em = new SseEmitter(0L);
            em.completeWithError(new SecurityException("unauthenticated"));
            return em;
        }
        return pub.subscribe();
    }
}
