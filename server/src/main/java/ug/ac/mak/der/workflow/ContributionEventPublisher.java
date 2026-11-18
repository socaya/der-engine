package ug.ac.mak.der.workflow;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * SSE fan-out of {@link ContributionCompletedEvent}. The browser-side
 * DPP.4 listener subscribes via
 * {@code GET /edge-api/v1/workflows/runs/events/stream}, decodes each
 * {@code contribution.completed} event, and fires a
 * {@code workflow.run-advance} DPP/1 frame through the mesh so the
 * next-step owner's device picks up the baton automatically.
 *
 * <p>Fan-out is best-effort: subscribers that throw are quietly
 * dropped from the list. Stale browser tabs can't keep the publisher
 * wedged.</p>
 */
@Component
public class ContributionEventPublisher {

    private static final Logger LOG = LoggerFactory.getLogger(ContributionEventPublisher.class);

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe() {
        final SseEmitter em = new SseEmitter(0L);
        emitters.add(em);
        em.onCompletion(() -> emitters.remove(em));
        em.onTimeout(() -> emitters.remove(em));
        em.onError((ex) -> emitters.remove(em));
        try {
            em.send(SseEmitter.event().name("ready").data("ok"));
        } catch (IOException ex) {
            emitters.remove(em);
        }
        return em;
    }

    @EventListener
    public void onContribution(final ContributionCompletedEvent ev) {
        final Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("runId", ev.runId().toString());
        payload.put("workflowId", ev.workflowId().toString());
        payload.put("completedStep", ev.completedStep().toString());
        payload.put("nextStep", ev.nextStep() == null ? null : ev.nextStep().toString());
        payload.put("nextOwner", ev.nextOwner() == null ? null : ev.nextOwner().toString());
        payload.put("businessKey", ev.businessKey());
        payload.put("contributedBy", ev.contributedBy() == null
                ? null : ev.contributedBy().toString());
        payload.put("submittedDeviceId", ev.submittedDeviceId() == null
                ? null : ev.submittedDeviceId().toString());
        for (final SseEmitter em : emitters) {
            try {
                em.send(SseEmitter.event()
                        .name("contribution.completed")
                        .data(payload));
            } catch (IOException | IllegalStateException ex) {
                LOG.debug("SSE subscriber drop: {}", ex.getMessage());
                emitters.remove(em);
            }
        }
    }

    public int subscriberCount() {
        return emitters.size();
    }
}
