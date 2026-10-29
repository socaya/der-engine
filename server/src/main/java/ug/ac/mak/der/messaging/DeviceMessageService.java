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
    private final MessagingV2Repository v2repo;
    private final MessageStreamDispatcher dispatcher;
    private final EdgeMessageForwarder forwarder;
    private final ObjectMapper mapper;

    public DeviceMessageService(final DeviceMessageRepository repo,
                                  final MessagingV2Repository v2repo,
                                  final MessageStreamDispatcher dispatcher,
                                  final EdgeMessageForwarder forwarder,
                                  final ObjectMapper mapper) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.v2repo = Objects.requireNonNull(v2repo, "v2repo");
        this.dispatcher = Objects.requireNonNull(dispatcher, "dispatcher");
        this.forwarder  = Objects.requireNonNull(forwarder, "forwarder");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    @Transactional
    public UUID publish(final String channel, final String fromDevice, final UUID fromUser,
                         final String type, final Map<String, Object> payload,
                         final UUID replyTo, final Duration ttl) {
        return publish(channel, fromDevice, fromUser, type, payload, replyTo, ttl,
                        false, null, null, null, null);
    }

    /** v2 publish with optional end-to-end encryption fields. When
     *  {@code encrypted = true} the {@code payload} is treated as a
     *  single-key object {@code { "ciphertext": "…base64…" }} and
     *  stored opaquely; recipient/ephemeral key/nonce metadata is
     *  stored alongside for the receiver's decrypt step. */
    @Transactional
    public UUID publish(final String channel, final String fromDevice, final UUID fromUser,
                         final String type, final Map<String, Object> payload,
                         final UUID replyTo, final Duration ttl,
                         final boolean encrypted, final String recipientDeviceId,
                         final String senderEphemeralPubkey, final String nonce,
                         final String ciphertextOverride) {
        if (channel == null || channel.isBlank()) {
            throw new IllegalArgumentException("channel required");
        }
        if (type == null || type.isBlank()) {
            throw new IllegalArgumentException("type required");
        }
        final String payloadJson;
        try {
            if (encrypted) {
                if (ciphertextOverride == null || ciphertextOverride.isBlank()) {
                    throw new IllegalArgumentException("ciphertext required for encrypted messages");
                }
                payloadJson = mapper.writeValueAsString(Map.of("ciphertext", ciphertextOverride));
            } else {
                payloadJson = mapper.writeValueAsString(payload == null ? Map.of() : payload);
            }
        } catch (final Exception ex) {
            throw new IllegalArgumentException("could not serialise payload", ex);
        }
        final Instant expiresAt = ttl == null ? null : Instant.now().plus(ttl);
        final UUID id = repo.insertMessage(channel, fromDevice, fromUser, type,
                                            payloadJson, replyTo, expiresAt,
                                            encrypted, recipientDeviceId,
                                            senderEphemeralPubkey, nonce);
        // v2 side-effects: SSE fan-out + CRDT doc tracking + edge forward.
        afterInsert(id, channel, fromDevice, type, payloadJson, encrypted,
                     recipientDeviceId, senderEphemeralPubkey, nonce, expiresAt);
        return id;
    }

    private void afterInsert(final UUID id, final String channel, final String fromDevice,
                               final String type, final String payloadJson,
                               final boolean encrypted, final String recipientDeviceId,
                               final String senderEphemeralPubkey, final String nonce,
                               final Instant expiresAt) {
        final Map<String, Object> rendered = new java.util.LinkedHashMap<>();
        rendered.put("messageId", id.toString());
        rendered.put("channel", channel);
        rendered.put("fromDeviceId", fromDevice);
        rendered.put("messageType", type);
        rendered.put("payload", payloadJson);
        rendered.put("encrypted", encrypted);
        rendered.put("recipientDeviceId", recipientDeviceId);
        rendered.put("senderEphemeralPubkey", senderEphemeralPubkey);
        rendered.put("nonce", nonce);
        rendered.put("createdAt", Instant.now().toString());
        rendered.put("expiresAt", expiresAt == null ? null : expiresAt.toString());

        // SSE fan-out — pick target devices by channel kind.
        final java.util.Set<String> targets = resolveSseTargets(channel);
        dispatcher.dispatch(rendered, targets);

        // CRDT: when channel starts with crdt: track the doc.
        if (channel.startsWith("crdt:")) {
            final String docId = channel.substring("crdt:".length());
            v2repo.upsertDocument(docId, "LWW_MAP", fromDevice, null);
            v2repo.recordOp(docId);
        }

        // Edge-to-edge: forward if the channel is edge:<fp>:<sub>.
        if (channel.startsWith("edge:")) {
            forwarder.forward(id, channel, rendered);
        }
    }

    private java.util.Set<String> resolveSseTargets(final String channel) {
        final java.util.Set<String> out = new java.util.LinkedHashSet<>();
        if (channel.startsWith("device:")) {
            out.add(channel.substring("device:".length()));
            return out;
        }
        // broadcast or role: — fan out to every subscription row for
        // that channel. (Cheap even at O(N) because we don't send to
        // offline devices; SSE fan-out touches only live emitters.)
        for (final Map<String, Object> s : repo.subscriptions()) {
            if (channel.equals(s.get("channel"))) {
                out.add((String) s.get("deviceId"));
            }
        }
        return out;
    }

    /** Edge-to-edge relay inbound — receives a batch of messages
     *  from a peer edge and inserts them locally. Channel on each
     *  entry is already rewritten to the subchannel by the sender. */
    @Transactional
    public int ingestRelay(final java.util.List<Map<String, Object>> entries) {
        int accepted = 0;
        for (final Map<String, Object> e : entries) {
            if (e == null) {
                continue;
            }
            final String ch = (String) e.get("channel");
            final String from = (String) e.get("fromDeviceId");
            final String type = (String) e.getOrDefault("messageType", "RELAYED");
            final String payload = (String) e.getOrDefault("payload", "{}");
            if (ch == null || from == null) {
                continue;
            }
            final UUID id = repo.insertMessage(ch, from, null, type,
                                                payload, null, null);
            accepted++;
            dispatcher.dispatch(e, resolveSseTargets(ch));
        }
        return accepted;
    }

    public MessageStreamDispatcher dispatcher() {
        return dispatcher;
    }

    public MessagingV2Repository v2() {
        return v2repo;
    }

    public EdgeMessageForwarder forwarder() {
        return forwarder;
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
