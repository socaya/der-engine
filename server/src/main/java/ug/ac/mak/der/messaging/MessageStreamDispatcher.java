package ug.ac.mak.der.messaging;

import java.io.IOException;
import java.time.Duration;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Fan-out hub for DER-MSG v2 SSE push.
 *
 *  <p>Devices connect via {@code GET /messaging/stream?deviceId=X},
 *  getting an {@link SseEmitter}. On publish, {@link #dispatch} is
 *  called and we push the message to every emitter whose
 *  deviceId matches the message's effective recipient set (direct
 *  channel or any subscribed role/broadcast channel).</p>
 *
 *  <p>Thread-safe: a {@link ConcurrentHashMap} of deviceId → list of
 *  live emitters. Dead emitters are removed on IOException.</p>
 */
@Component
public class MessageStreamDispatcher {

    private static final Logger LOG = LoggerFactory.getLogger(MessageStreamDispatcher.class);
    private static final Duration DEFAULT_TIMEOUT = Duration.ofMinutes(30);

    private final Map<String, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

    public SseEmitter register(final String deviceId) {
        final SseEmitter em = new SseEmitter(DEFAULT_TIMEOUT.toMillis());
        emitters.computeIfAbsent(deviceId, k -> new CopyOnWriteArrayList<>()).add(em);
        em.onCompletion(() -> drop(deviceId, em));
        em.onTimeout(() -> drop(deviceId, em));
        em.onError(t -> drop(deviceId, em));
        try {
            em.send(SseEmitter.event()
                              .name("hello")
                              .data(Map.of("deviceId", deviceId,
                                            "protocol", "der-msg",
                                            "version", "2.0")));
        } catch (final IOException ex) {
            drop(deviceId, em);
        }
        return em;
    }

    /** Called by DeviceMessageService.publish after a successful insert.
     *  Sends the message as an SSE "message" event to every emitter
     *  whose device would see this message via the normal recent-poll
     *  path. Resolution is cheap because we only fan out to connected
     *  streams. */
    public void dispatch(final Map<String, Object> message,
                           final Collection<String> targetDeviceIds) {
        if (message == null || targetDeviceIds == null || targetDeviceIds.isEmpty()) {
            return;
        }
        for (final String deviceId : targetDeviceIds) {
            final List<SseEmitter> live = emitters.get(deviceId);
            if (live == null || live.isEmpty()) {
                continue;
            }
            for (final SseEmitter em : live) {
                try {
                    em.send(SseEmitter.event()
                                      .name("message")
                                      .data(message));
                } catch (final IOException ex) {
                    drop(deviceId, em);
                }
            }
        }
    }

    public int liveStreams() {
        int n = 0;
        for (final List<SseEmitter> l : emitters.values()) {
            n += l.size();
        }
        return n;
    }

    public int liveDevices() {
        int n = 0;
        for (final List<SseEmitter> l : emitters.values()) {
            if (!l.isEmpty()) {
                n++;
            }
        }
        return n;
    }

    private void drop(final String deviceId, final SseEmitter em) {
        final List<SseEmitter> l = emitters.get(deviceId);
        if (l != null) {
            l.remove(em);
            if (l.isEmpty()) {
                emitters.remove(deviceId);
            }
        }
        LOG.debug("SSE emitter dropped for {}", deviceId);
    }
}
