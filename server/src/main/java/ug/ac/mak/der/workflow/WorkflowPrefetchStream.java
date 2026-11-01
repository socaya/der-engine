package ug.ac.mak.der.workflow;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * §2.3.60 — device-scoped SSE fan-out for prefetch coordination.
 *
 * <p>When a step completes, {@link WorkflowPrefetchCoordinator}
 * computes the downstream steps that became READY and the device
 * that owns each. It then calls {@link #push(UUID, UUID, UUID)}
 * which fans an event only to subscribers registered against that
 * target device.
 *
 * <p>The client UI treats each event as a cue to warm its cache for
 * the upstream run / step (fetch program context, prior-step
 * contributions, etc.) and POST a prefetch-ack when the warm is
 * complete.
 */
@Component
public class WorkflowPrefetchStream {

    private static final Logger LOG = LoggerFactory.getLogger(WorkflowPrefetchStream.class);
    private static final Duration TIMEOUT = Duration.ofMinutes(30);

    private final List<Subscription> subs = new CopyOnWriteArrayList<>();

    public SseEmitter register(final UUID deviceId) {
        Objects.requireNonNull(deviceId, "deviceId");
        final SseEmitter em = new SseEmitter(TIMEOUT.toMillis());
        final Subscription sub = new Subscription(deviceId, em);
        subs.add(sub);
        em.onCompletion(() -> subs.remove(sub));
        em.onTimeout(() -> subs.remove(sub));
        em.onError(t -> subs.remove(sub));
        try {
            em.send(SseEmitter.event().name("hello")
                    .data(Map.of("stream", "workflow-prefetch",
                                  "deviceId", deviceId.toString())));
        } catch (final IOException ex) {
            subs.remove(sub);
        }
        return em;
    }

    /** Fan a prefetch cue to every live subscriber for the target
     *  device. Multiple subscriptions (operator opens the admin app
     *  on two tabs on the same device) each receive the event. */
    public void push(final UUID targetDeviceId, final UUID runId, final UUID stepId) {
        final Map<String, Object> payload = Map.of(
            "runId", runId.toString(),
            "stepId", stepId.toString(),
            "at", java.time.Instant.now().toString());
        for (final Subscription sub : subs) {
            if (!sub.deviceId.equals(targetDeviceId)) {
                continue;
            }
            try {
                sub.emitter.send(SseEmitter.event()
                        .name("prefetch").data(payload));
            } catch (final IOException ex) {
                LOG.debug("drop dead prefetch emitter: {}", ex.getMessage());
                subs.remove(sub);
            }
        }
    }

    public int liveSubscribers() {
        return subs.size();
    }

    private record Subscription(UUID deviceId, SseEmitter emitter) { }
}
