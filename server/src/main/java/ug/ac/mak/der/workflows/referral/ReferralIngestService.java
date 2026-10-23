package ug.ac.mak.der.workflows.referral;

import java.io.IOException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.workflows.aggregate.AggregateDataValueService;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValueService.DataValueInput;
import ug.ac.mak.der.workflows.events.Event;
import ug.ac.mak.der.workflows.events.EventService;

/**
 * ADR-0027 alpha.6/7. Translates a stored referral payload into a
 * local write via the normal aggregate / event pipeline. Alpha.6
 * handled aggregate; alpha.7 adds EVENT. ENROLLMENT / TRACKED_ENTITY
 * remain non-goals.
 */
@Service
@ConditionalOnBean(AggregateDataValueService.class)
public class ReferralIngestService {

    private static final Logger LOG = LoggerFactory.getLogger(ReferralIngestService.class);

    private final AggregateDataValueService aggregate;
    private final ObjectProvider<EventService> events;
    private final ObjectMapper mapper;

    public ReferralIngestService(final AggregateDataValueService aggregate,
                                   final ObjectProvider<EventService> events,
                                   final ObjectMapper mapper) {
        this.aggregate = Objects.requireNonNull(aggregate, "aggregate");
        this.events = Objects.requireNonNull(events, "events");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    public boolean ingest(final ReferralInboxEntry entry, final UUID actor,
                            final String ip, final String userAgent) {
        Objects.requireNonNull(entry, "entry");
        final JsonNode root = parsePayload(entry);
        if (root == null) {
            return false;
        }
        return switch (entry.kind()) {
            case AGGREGATE_DATA_VALUE -> ingestAggregate(entry, root, actor, ip, userAgent);
            case EVENT -> ingestEvent(entry, root, actor, ip, userAgent);
            case ENROLLMENT, TRACKED_ENTITY -> {
                LOG.info("referral accept: {} entry {} not yet ingested; marking only",
                        entry.kind(), entry.inboxId());
                yield false;
            }
        };
    }

    private JsonNode parsePayload(final ReferralInboxEntry entry) {
        try {
            final JsonNode root = mapper.readTree(entry.payloadJson());
            if (root == null || !root.isObject()) {
                LOG.warn("referral accept: payload for {} is not an object",
                        entry.inboxId());
                return null;
            }
            return root;
        } catch (IOException ex) {
            LOG.warn("referral accept: payload parse failed for {}: {}",
                    entry.inboxId(), ex.getMessage());
            return null;
        }
    }

    private boolean ingestAggregate(final ReferralInboxEntry entry, final JsonNode root,
                                      final UUID actor, final String ip, final String userAgent) {
        final DataValueInput input = new DataValueInput(
                text(root, "dataElement"),
                entry.boundOrgUnit(),
                text(root, "period"),
                text(root, "categoryOptionCombo"),
                text(root, "attributeOptionCombo"),
                text(root, "value"),
                text(root, "comment"));
        aggregate.submit(List.of(input), actor, ip, userAgent);
        return true;
    }

    private boolean ingestEvent(final ReferralInboxEntry entry, final JsonNode root,
                                  final UUID actor, final String ip, final String userAgent) {
        final EventService svc = events.getIfAvailable();
        if (svc == null) {
            LOG.warn("referral accept: EventService unavailable; event {} marked only",
                    entry.inboxId());
            return false;
        }
        final String program = text(root, "program");
        final String programStage = text(root, "programStage");
        if (program == null || programStage == null) {
            LOG.warn("referral accept: event {} missing program/programStage",
                    entry.inboxId());
            return false;
        }
        final UUID eventId = textOrNewUuid(root, "event");
        final JsonNode enrollment = root.get("enrollment");
        final UUID enrollmentId = enrollment != null && enrollment.isTextual()
                ? parseUuid(enrollment.asText()) : null;
        final Instant occurredAt = parseInstant(text(root, "occurredAt"));
        final Event.Status status = parseStatus(text(root, "status"));
        final Map<String, String> values = new LinkedHashMap<>();
        final JsonNode dvs = root.get("dataValues");
        if (dvs != null && dvs.isArray()) {
            for (final JsonNode dv : dvs) {
                final String de = text(dv, "dataElement");
                final String val = text(dv, "value");
                if (de != null && val != null) {
                    values.put(de, val);
                }
            }
        }
        final EventService.EventInput input = new EventService.EventInput(
                eventId, enrollmentId, program, programStage,
                entry.boundOrgUnit(), occurredAt, status,
                text(root, "attributeOptionCombo"), values);
        svc.submit(List.of(input), actor, ip, userAgent);
        return true;
    }

    private static String text(final JsonNode root, final String field) {
        final JsonNode node = root.get(field);
        return node == null || !node.isTextual() ? null : node.asText();
    }

    private static UUID textOrNewUuid(final JsonNode root, final String field) {
        final String s = text(root, field);
        if (s == null) {
            return UUID.randomUUID();
        }
        final UUID parsed = parseUuid(s);
        return parsed == null ? UUID.randomUUID() : parsed;
    }

    private static UUID parseUuid(final String s) {
        try {
            return UUID.fromString(s);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static Instant parseInstant(final String s) {
        if (s == null) {
            return Instant.now();
        }
        try {
            return Instant.parse(s);
        } catch (RuntimeException ex) {
            return Instant.now();
        }
    }

    private static Event.Status parseStatus(final String s) {
        if (s == null) {
            return Event.Status.ACTIVE;
        }
        try {
            return Event.Status.valueOf(s);
        } catch (IllegalArgumentException ex) {
            return Event.Status.ACTIVE;
        }
    }
}
