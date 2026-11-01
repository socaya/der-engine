package ug.ac.mak.der.workflow;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * §2.3.41 — SSE fan-out for the import inbox. Operators subscribed to
 * {@code GET /edge-api/v1/workflows/import-inbox/stream} receive an
 * {@code inbox.updated} event whenever a push lands or a decision
 * is made. The UI treats it as a re-fetch cue.
 *
 * Mirrors {@link WorkflowQueueStream} (§2.3.24) exactly — no event-bus
 * plumbing needed, the controller calls {@link #notifyUpdate} inline.
 */
@Component
public class WorkflowInboxStream {

    private static final Logger LOG = LoggerFactory.getLogger(WorkflowInboxStream.class);
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
                    .data(Map.of("stream", "workflow-inbox",
                                  "subscribers", emitters.size())));
        } catch (IOException ex) {
            emitters.remove(em);
        }
        return em;
    }

    public void notifyUpdate(final String cause) {
        final Map<String, Object> payload = Map.of(
            "cause", cause,
            "at", Instant.now().toString());
        for (final SseEmitter em : emitters) {
            try {
                em.send(SseEmitter.event().name("inbox.updated").data(payload));
            } catch (IOException ex) {
                LOG.debug("drop dead inbox-stream emitter: {}", ex.getMessage());
                emitters.remove(em);
            }
        }
    }

    public int liveSubscribers() {
        return emitters.size();
    }
}
