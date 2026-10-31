package ug.ac.mak.der.workflow;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * §2.3.24 — SSE fan-out for the operator queue. Any subscriber to
 * {@code GET /edge-api/v1/workflows/queue/stream} receives a
 * {@code queue.invalidate} event whenever a workflow run moves
 * (step readiness changes, run completes, run opens). The UI treats
 * the event as a cue to re-fetch {@code GET /workflows/queue}.
 *
 * This replaces the 15 s polling loop with a reactive stream that
 * costs nothing when no runs are in flight.
 */
@Component
public class WorkflowQueueStream {

    private static final Logger LOG = LoggerFactory.getLogger(WorkflowQueueStream.class);
    private static final Duration TIMEOUT = Duration.ofMinutes(30);

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter register() {
        final SseEmitter em = new SseEmitter(TIMEOUT.toMillis());
        emitters.add(em);
        em.onCompletion(() -> emitters.remove(em));
        em.onTimeout(() -> emitters.remove(em));
        em.onError(t -> emitters.remove(em));
        try {
            em.send(SseEmitter.event().name("hello")
                    .data(Map.of("stream", "workflow-queue",
                                  "subscribers", emitters.size())));
        } catch (final IOException ex) {
            emitters.remove(em);
        }
        return em;
    }

    @EventListener
    public void onStepReady(final WorkflowRunCoordinator.WorkflowStepReadyEvent e) {
        broadcast(Objects.requireNonNull(e, "e"));
    }

    @EventListener
    public void onRunCompleted(final WorkflowRunCoordinator.WorkflowRunCompletedEvent e) {
        broadcast(Objects.requireNonNull(e, "e"));
    }

    public int liveSubscribers() {
        return emitters.size();
    }

    private void broadcast(final Object cause) {
        final Map<String, Object> payload = Map.of(
            "cause", cause.getClass().getSimpleName(),
            "at",    java.time.Instant.now().toString());
        for (final SseEmitter em : emitters) {
            try {
                em.send(SseEmitter.event().name("queue.invalidate").data(payload));
            } catch (final IOException ex) {
                LOG.debug("drop dead queue-stream emitter: {}", ex.getMessage());
                emitters.remove(em);
            }
        }
    }
}
