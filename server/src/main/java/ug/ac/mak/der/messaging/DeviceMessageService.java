package ug.ac.mak.der.messaging;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Phase N5 — DER-MSG v1 service layer.
 *
 *  <p>Routing rules (based on channel prefix, chosen by sender):</p>
 *  <ul>
 *    <li>{@code device:<deviceId>} — direct delivery to one device</li>
 *    <li>{@code role:<roleName>}   — fan out to every device whose
 *        subscriptions include this role channel</li>
 *    <li>{@code broadcast}         — every device subscribed to broadcast</li>
 *  </ul>
 *
 *  <p>DER itself stores the authoritative log; devices poll
 *  {@link #recentForDevice(String, Instant, int)} every few seconds with
 *  the cursor they last saw. At-least-once delivery is guaranteed by
 *  the cursor advancing only when the device records the new value via
 *  {@link #updateCursor(String, String, Instant)}.</p>
 */
@Service
public class DeviceMessageService {

    private static final Logger LOG = LoggerFactory.getLogger(DeviceMessageService.class);

    private final DeviceMessageRepository repo;
    private final ObjectMapper mapper;

    public DeviceMessageService(final DeviceMessageRepository repo,
                                  final ObjectMapper mapper) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    @Transactional
    public UUID publish(final String channel, final String fromDevice, final UUID fromUser,
                         final String type, final Map<String, Object> payload,
                         final UUID replyTo, final Duration ttl) {
        if (channel == null || channel.isBlank()) {
            throw new IllegalArgumentException("channel required");
        }
        if (type == null || type.isBlank()) {
            throw new IllegalArgumentException("type required");
        }
        final String payloadJson;
        try {
            payloadJson = mapper.writeValueAsString(payload == null ? Map.of() : payload);
        } catch (final Exception ex) {
            throw new IllegalArgumentException("could not serialise payload", ex);
        }
        final Instant expiresAt = ttl == null ? null : Instant.now().plus(ttl);
        return repo.insertMessage(channel, fromDevice, fromUser, type,
                                   payloadJson, replyTo, expiresAt);
    }

    @Transactional
    public List<Map<String, Object>> recentForDevice(final String deviceId,
                                                       final Instant since,
                                                       final int limit) {
        if (deviceId == null || deviceId.isBlank()) {
            return List.of();
        }
        final Set<String> channels = new LinkedHashSet<>();
        // Direct channel is implicit — devices always receive messages
        // addressed to them even without a subscription row.
        channels.add("device:" + deviceId);
        channels.addAll(repo.channelsFor(deviceId));
        return repo.channelScan(List.copyOf(channels), since, limit);
    }

    public List<Map<String, Object>> recentAcrossChannels(final int limit) {
        return repo.recentAcrossChannels(limit);
    }

    public Map<String, Object> stats() {
        final Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.putAll(repo.stats());
        m.put("topChannels", repo.channelLeaderboard());
        return m;
    }

    public List<Map<String, Object>> subscriptions() {
        return repo.subscriptions();
    }

    public void subscribe(final String deviceId, final String channel) {
        repo.upsertSubscription(deviceId, channel);
    }
    public int unsubscribe(final String deviceId, final String channel) {
        return repo.deleteSubscription(deviceId, channel);
    }

    public void updateCursor(final String deviceId, final String channel, final Instant cursor) {
        repo.updateCursor(deviceId, channel, cursor);
    }

    public int ack(final UUID messageId, final String deviceId) {
        return repo.ack(messageId, deviceId);
    }

    /** Reap expired messages every 5 minutes so stale STOCK_ALERT /
     *  PATIENT_HANDOFF entries don't accumulate. */
    @Scheduled(fixedDelayString = "${der.messaging.reaper.interval:300000}",
               initialDelayString = "${der.messaging.reaper.initialDelay:60000}")
    public void reapExpired() {
        try {
            final int n = repo.deleteExpired();
            if (n > 0) {
                LOG.info("DER-MSG reaper removed {} expired messages", n);
            }
        } catch (final Exception ex) {
            LOG.warn("DER-MSG reaper failed", ex);
        }
    }
}
