package ug.ac.mak.der.workflows.pull;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.dhis2.Dhis2ReferenceClient;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValue;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValueRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/**
 * ADR-0034 — inbound puller for the aggregate data value stream.
 *
 * <p>Pulls every dataValueSet central knows about for the given
 * org-unit subtree since the stored {@code last_pulled_at}
 * watermark, then applies the three-way merge semantics:</p>
 * <ul>
 *   <li>Row not present locally → insert; stamp
 *     {@code submitted_by=null} (system origin) + {@code version=1}.</li>
 *   <li>Local terminal (CENTRAL_ACCEPTED / CENTRAL_REJECTED) →
 *     overwrite; bump {@code value_version}; audit as
 *     {@code DATA_PULL_OVERWRITE}.</li>
 *   <li>Local non-terminal (PENDING / IN_FLIGHT / RETRYABLE /
 *     UNKNOWN_OUTCOME) → raise a {@code CONFLICT_REVIEW} journal
 *     entry; keep the operator's local edit untouched so their
 *     work isn't lost.</li>
 *   <li>Local already in CONFLICT_REVIEW → no-op (the operator
 *     already has an attention queue item; stacking more would
 *     just add noise).</li>
 * </ul>
 *
 * <p>The HTTP fetcher is pluggable via {@link #setFetcher(Fetcher)}
 * so tests exercise the merge logic without needing a running
 * central. The default implementation goes through
 * {@link Dhis2ReferenceClient}.</p>
 */
@Service
public class AggregatePuller {

    private static final Logger LOG = LoggerFactory.getLogger(AggregatePuller.class);

    /** Pluggable fetcher so tests can supply a canned JSON response. */
    @FunctionalInterface
    public interface Fetcher {
        JsonNode fetch(String orgUnitUid, Instant since) throws Exception;
    }

    private final AggregateDataValueRepository values;
    private final OperationJournalRepository journal;
    private final SecurityAuditRepository audit;
    private final Dhis2ReferenceClient dhis2;
    private final ObjectMapper mapper;
    private final Clock clock;
    private volatile Fetcher fetcher;

    public AggregatePuller(final AggregateDataValueRepository values,
                             final OperationJournalRepository journal,
                             final SecurityAuditRepository audit,
                             final Dhis2ReferenceClient dhis2,
                             final ObjectMapper mapper,
                             final Clock clock) {
        this.values = Objects.requireNonNull(values, "values");
        this.journal = Objects.requireNonNull(journal, "journal");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.dhis2 = Objects.requireNonNull(dhis2, "dhis2");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.fetcher = this::defaultFetch;
    }

    /** Test seam. */
    public void setFetcher(final Fetcher fetcher) {
        this.fetcher = Objects.requireNonNull(fetcher, "fetcher");
    }

    public DataPullService.PullerResult pull(final String orgUnitUid, final Instant since) {
        final JsonNode response;
        try {
            response = fetcher.fetch(orgUnitUid, since);
        } catch (Exception ex) {
            throw new RuntimeException("aggregate pull failed: " + ex.getMessage(), ex);
        }
        int rowsPulled = 0;
        int conflicts = 0;
        Instant maxLastUpdated = null;
        final JsonNode dvs = response == null ? null : response.path("dataValues");
        if (dvs != null && dvs.isArray()) {
            for (final JsonNode dv : dvs) {
                final MergeOutcome o = mergeOne(dv);
                switch (o.action()) {
                    case INSERTED, OVERWRITTEN -> rowsPulled++;
                    case CONFLICT -> conflicts++;
                    case NOOP -> { /* already in conflict queue — skip */ }
                }
                if (o.lastUpdated() != null
                        && (maxLastUpdated == null || o.lastUpdated().isAfter(maxLastUpdated))) {
                    maxLastUpdated = o.lastUpdated();
                }
            }
        }
        /* Watermark preference: max lastUpdated central returned
         * (so the next tick's lastUpdated filter picks up only
         * truly-new rows); fall back to the input watermark if
         * central's envelope omitted lastUpdated; fall back to now
         * if the cursor was null and central returned nothing. */
        final Instant watermark = maxLastUpdated != null ? maxLastUpdated
                : since != null ? since : Instant.now(clock);
        return new DataPullService.PullerResult(rowsPulled, conflicts, watermark, null);
    }

    private MergeOutcome mergeOne(final JsonNode dv) {
        final String de  = textOrNull(dv, "dataElement");
        final String ou  = textOrNull(dv, "orgUnit");
        final String per = textOrNull(dv, "period");
        final String coc = textOrNull(dv, "categoryOptionCombo");
        final String aoc = textOrNull(dv, "attributeOptionCombo");
        final String val = textOrNull(dv, "value");
        final String com = textOrNull(dv, "comment");
        final String lu  = textOrNull(dv, "lastUpdated");
        if (de == null || ou == null || per == null || coc == null || aoc == null) {
            LOG.warn("central dataValue missing required key(s); skipped: {}", dv);
            return new MergeOutcome(Action.NOOP, null);
        }
        final String compoundKey = de + '|' + ou + '|' + per + '|' + coc + '|' + aoc;
        final Optional<OperationJournalEntry> journalRow = journal.findLatestByEntityRef(
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE, compoundKey);
        final Instant watermark = lu == null ? null : parseInstant(lu);

        if (journalRow.isPresent()
                && journalRow.get().state() == OperationJournalEntry.State.CONFLICT_REVIEW) {
            return new MergeOutcome(Action.NOOP, watermark);
        }
        if (journalRow.isPresent() && !isTerminal(journalRow.get().state())) {
            raiseConflict(compoundKey, dv);
            return new MergeOutcome(Action.CONFLICT, watermark);
        }
        /* ADR-0035 — pull/write interlock. Before we overwrite the
         * aggregate value row, probe whether the drain worker is
         * currently publishing this row. If yes, defer to the next
         * tick — avoids the drift scenario where we overwrite the
         * mirror while the drain is mid-POST with the operator's
         * value. */
        if (journalRow.isPresent()
                && !journal.tryLockRowForPublish(journalRow.get().operationId())) {
            LOG.info("deferring aggregate overwrite for {} — drain holds the lock",
                    compoundKey);
            return new MergeOutcome(Action.NOOP, watermark);
        }
        // Terminal OR not-yet-journalled: upsert central's version
        // locally. upsert() handles both the first-insert case (no
        // existing row -> version=1) and the overwrite case (bumps
        // value_version).
        final Optional<AggregateDataValue> existing = values.findByCompoundKey(
                de, ou, per, coc, aoc);
        final boolean wasOverwrite = existing.isPresent();
        /* submittedBy carries the "SYSTEM origin" sentinel so audit
         * trails and `submitted_by = ?` filters can distinguish
         * central-pulled rows from operator writes. The
         * AggregateDataValue record requires non-null, so we use
         * the all-zeros UUID instead of null — downstream code
         * must treat UUID(0,0) as "SYSTEM pull". */
        final UUID sysUser = new UUID(0L, 0L);
        /* dataSetUid is non-null on the record; we don't learn
         * central's dataSet from a plain dataValues array — reuse
         * the existing row's dataSet when overwriting, otherwise
         * stamp "SYSTEM" so the row is clearly external-origin. */
        final String dsUid = existing.map(AggregateDataValue::dataSetUid)
                .filter(s -> s != null && !s.isBlank())
                .orElse("SYSTEM");
        values.upsert(new AggregateDataValue(
                existing.map(AggregateDataValue::valueId).orElseGet(UUID::randomUUID),
                de, ou, per, coc, aoc, val, com == null ? "" : com,
                sysUser,
                watermark == null ? Instant.now(clock) : watermark,
                /* version param is a seed only; ON CONFLICT path uses +1 */
                1,
                dsUid,
                /* workflowRun unknown on central-side pull */ null));
        if (wasOverwrite) {
            audit.append(new AuditEvent(
                    "DATA_PULL_OVERWRITE",
                    AuditEvent.Outcome.SUCCESS,
                    null, null, null, null,
                    java.util.Map.of(
                            "entityType", "AGGREGATE_DATA_VALUE",
                            "compoundKey", compoundKey,
                            "value", val == null ? "" : val)),
                    Instant.now(clock));
        }
        return new MergeOutcome(wasOverwrite ? Action.OVERWRITTEN : Action.INSERTED, watermark);
    }

    private void raiseConflict(final String compoundKey, final JsonNode dv) {
        /* We don't flip the EXISTING journal row to CONFLICT_REVIEW
         * (that would discard the operator's PENDING push); instead
         * we insert a fresh conflict row carrying central's version
         * as the payload, so the operator sees both sides in the
         * attention queue. The /journal/conflicts/{id}/resolve
         * endpoint already handles accept/reject. */
        final JsonNode centralPayload;
        try {
            centralPayload = mapper.readTree(mapper.writeValueAsString(
                    java.util.Map.of("centralDataValue", dv)));
        } catch (Exception ex) {
            throw new IllegalStateException("failed to serialise conflict payload", ex);
        }
        journal.insert(new OperationJournalEntry(
                UUID.randomUUID(),
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE,
                compoundKey,
                centralPayload,
                OperationJournalEntry.State.CONFLICT_REVIEW,
                0, "central-pull collision — operator-pending local edit",
                null,
                Instant.now(clock), Instant.now(clock),
                null, null));
    }

    private static boolean isTerminal(final OperationJournalEntry.State s) {
        return s == OperationJournalEntry.State.CENTRAL_ACCEPTED
                || s == OperationJournalEntry.State.CENTRAL_REJECTED;
    }

    private JsonNode defaultFetch(final String orgUnitUid, final Instant since) throws Exception {
        final String lu = since == null ? "" : "&lastUpdated=" + since.toString();
        return dhis2.fetchJson("/api/dataValueSets?orgUnit=" + orgUnitUid
                + "&children=true" + lu);
    }

    private static String textOrNull(final JsonNode n, final String field) {
        final JsonNode v = n == null ? null : n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static Instant parseInstant(final String s) {
        try {
            return Instant.parse(s);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    enum Action { INSERTED, OVERWRITTEN, CONFLICT, NOOP }
    private record MergeOutcome(Action action, Instant lastUpdated) { }
}
