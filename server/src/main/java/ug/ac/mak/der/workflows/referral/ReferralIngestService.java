package ug.ac.mak.der.workflows.referral;

import java.io.IOException;
import java.util.List;
import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.workflows.aggregate.AggregateDataValueService;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValueService.DataValueInput;

/**
 * ADR-0027 alpha.6. Translates a stored referral payload into a local
 * write via the normal aggregate pipeline. Alpha.6 handles aggregate
 * only; event + tracker ingest ships in alpha.7.
 */
@Service
@ConditionalOnBean(AggregateDataValueService.class)
public class ReferralIngestService {

    private static final Logger LOG = LoggerFactory.getLogger(ReferralIngestService.class);

    private final AggregateDataValueService aggregate;
    private final ObjectMapper mapper;

    public ReferralIngestService(final AggregateDataValueService aggregate,
                                   final ObjectMapper mapper) {
        this.aggregate = Objects.requireNonNull(aggregate, "aggregate");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    /**
     * @return {@code true} iff the entry was successfully ingested
     *     into the local store. Unsupported entry kinds (events,
     *     tracker) return {@code false} without error.
     */
    public boolean ingest(final ReferralInboxEntry entry,
                            final java.util.UUID actor,
                            final String ip, final String userAgent) {
        Objects.requireNonNull(entry, "entry");
        if (entry.kind() != ReferralInboxEntry.Kind.AGGREGATE_DATA_VALUE) {
            LOG.info("referral accept: skipping non-aggregate entry {} ({})",
                    entry.inboxId(), entry.kind());
            return false;
        }
        final JsonNode root;
        try {
            root = mapper.readTree(entry.payloadJson());
        } catch (IOException ex) {
            LOG.warn("referral accept: payload parse failed for {}: {}",
                    entry.inboxId(), ex.getMessage());
            return false;
        }
        if (root == null || !root.isObject()) {
            LOG.warn("referral accept: payload for {} is not a dataValue object",
                    entry.inboxId());
            return false;
        }
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

    private static String text(final JsonNode root, final String field) {
        final JsonNode node = root.get(field);
        return node == null || !node.isTextual() ? null : node.asText();
    }
}
