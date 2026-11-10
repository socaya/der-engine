package ug.ac.mak.der.analytics.publication;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicLong;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import ug.ac.mak.der.dhis2.Dhis2Properties;

/**
 * Drains APPROVED analytics publication proposals to DHIS2 central by
 * grouping into {@code POST /api/dataValueSets} batches, one per
 * (dataset, period). Flips each proposal to {@code PUBLISHED} on
 * {@code 2xx + importCount.imported > 0}; otherwise leaves it as
 * APPROVED for the next tick or flags {@code DIVERGED} on a persistent
 * reject (spec §4.5 / §8).
 *
 * <p>Idempotency: DHIS2 treats repeated submissions as updates. A
 * rolled-back local flip (e.g. transient failure in the status update
 * after a successful POST) just causes the next tick to re-submit the
 * same value — DHIS2's importCount reports {@code updated} rather than
 * {@code imported} but the worker still terminates the proposal.</p>
 */
@Component
public class PublicationDrainWorker {

    private static final Logger LOG =
            LoggerFactory.getLogger(PublicationDrainWorker.class);

    private final PublicationRepository repo;
    private final Dhis2Properties props;
    private final PublicationProperties properties;
    private final HttpClient http;
    private final ObjectMapper json;

    private final AtomicLong published = new AtomicLong();
    private final AtomicLong failed = new AtomicLong();
    private final AtomicLong lastRunAt = new AtomicLong();
    private final AtomicLong lastPublishedAt = new AtomicLong();

    public PublicationDrainWorker(final PublicationRepository repo,
                                    final Dhis2Properties props,
                                    final PublicationProperties properties,
                                    final HttpClient http,
                                    final ObjectMapper json) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.props = Objects.requireNonNull(props, "props");
        this.properties = properties == null
                ? new PublicationProperties(null, 0L, 0, true)
                : properties;
        this.http = Objects.requireNonNull(http, "http");
        this.json = Objects.requireNonNull(json, "json");
    }

    /** Tick the worker. Public for admin-ui "drain now" and tests;
     *  the scheduler invokes it on {@code fixedDelay}. Returns the
     *  number of proposals successfully flipped to PUBLISHED. */
    @Scheduled(
            fixedDelayString = "${der.analytics.publication.drain-interval-millis:30000}",
            initialDelayString = "${der.analytics.publication.drain-initial-delay:5000}")
    public int tick() {
        lastRunAt.set(System.currentTimeMillis());
        if (!properties.drainEnabled()) {
            return 0;
        }
        if (props.central().baseUrl() == null
                || props.central().baseUrl().isBlank()) {
            return 0;
        }
        final List<PublicationProposal> approved = repo.listProposals(null,
                PublicationProposal.State.APPROVED.name());
        if (approved.isEmpty()) {
            return 0;
        }
        final int batch = Math.max(1, properties.drainBatchSize());
        final List<PublicationProposal> slice = approved.size() <= batch
                ? approved
                : approved.subList(0, batch);

        // One POST per (dataset, period). DHIS2's dataValueSets payload
        // carries dataValues for many orgUnit/CoC tuples under a
        // single (dataSet, period) header so this grouping keeps the
        // wire chatter proportional to distinct dataset/period pairs.
        final Map<DatasetPeriod, List<PublicationProposal>> grouped =
                new LinkedHashMap<>();
        for (final PublicationProposal p : slice) {
            grouped.computeIfAbsent(
                    new DatasetPeriod(p.datasetUid(), p.periodKey()),
                    k -> new ArrayList<>()).add(p);
        }
        int winCount = 0;
        for (final var entry : grouped.entrySet()) {
            winCount += publishBatch(entry.getKey(), entry.getValue());
        }
        return winCount;
    }

    private int publishBatch(final DatasetPeriod key,
                               final List<PublicationProposal> rows) {
        final String payload;
        try {
            payload = buildDataValueSetsPayload(key, rows);
        } catch (JsonProcessingException ex) {
            LOG.warn("drain: failed to serialise dataValueSets payload: {}",
                    ex.getMessage());
            failed.addAndGet(rows.size());
            return 0;
        }
        final URI uri = URI.create(props.central().baseUrl()
                + "/api/dataValueSets");
        final HttpRequest.Builder req = HttpRequest.newBuilder()
                .uri(uri)
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(
                        payload, StandardCharsets.UTF_8));
        if (props.central().username() != null
                && !props.central().username().isBlank()) {
            final String token = props.central().username() + ":"
                    + (props.central().password() == null ? ""
                            : props.central().password());
            req.header("Authorization", "Basic " + Base64.getEncoder()
                    .encodeToString(token.getBytes(StandardCharsets.UTF_8)));
        }
        final HttpResponse<String> resp;
        try {
            resp = http.send(req.build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            LOG.warn("drain: interrupted mid-POST for {}/{}", key.datasetUid(),
                    key.periodKey());
            failed.addAndGet(rows.size());
            return 0;
        } catch (IOException ex) {
            LOG.warn("drain: I/O failure POSTing {}/{}: {}",
                    key.datasetUid(), key.periodKey(), ex.getMessage());
            failed.addAndGet(rows.size());
            return 0;
        }
        return applyResponse(resp, rows);
    }

    private int applyResponse(final HttpResponse<String> resp,
                                 final List<PublicationProposal> rows) {
        final int code = resp.statusCode();
        if (code / 100 != 2) {
            LOG.warn("drain: central returned {} — leaving {} proposals as "
                    + "APPROVED for the next tick", code, rows.size());
            failed.addAndGet(rows.size());
            return 0;
        }
        // Parse importCount to distinguish success vs "central silently
        // dropped everything". A 2xx with {ignored:N, imported:0} is
        // the DHIS2 idiom for "schema mismatch, nothing applied" — we
        // treat that as a persistent reject and move the proposals to
        // DIVERGED so an operator sees them.
        boolean dropped = false;
        try {
            final JsonNode body = json.readTree(resp.body());
            final JsonNode counts = body.path("importCount");
            if (counts.isObject()) {
                final int imported = counts.path("imported").asInt(0);
                final int updated = counts.path("updated").asInt(0);
                final int ignored = counts.path("ignored").asInt(0);
                final int deleted = counts.path("deleted").asInt(0);
                dropped = imported + updated + deleted == 0 && ignored > 0;
            }
        } catch (RuntimeException | IOException ex) {
            // Non-JSON 2xx — DHIS2 occasionally returns HTML on auth
            // misroute. Treat as success-shaped failure and bail with
            // DIVERGED to force operator attention.
            dropped = true;
        }
        int ok = 0;
        for (final PublicationProposal p : rows) {
            final PublicationProposal.State next = dropped
                    ? PublicationProposal.State.DIVERGED
                    : PublicationProposal.State.PUBLISHED;
            repo.review(p.proposalId(), next,
                    p.reviewedValue() == null
                            ? p.proposedValue() : p.reviewedValue(),
                    dropped ? "central ignored row — review divergence"
                            : "published to central",
                    p.reviewedBy());
            if (!dropped) {
                ok++;
                published.incrementAndGet();
                lastPublishedAt.set(System.currentTimeMillis());
            } else {
                failed.incrementAndGet();
            }
        }
        return ok;
    }

    private String buildDataValueSetsPayload(
            final DatasetPeriod key,
            final List<PublicationProposal> rows)
            throws JsonProcessingException {
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("dataSet", key.datasetUid());
        body.put("period", key.periodKey());
        // orgUnit is required at the dataValue level when values span
        // multiple orgUnits — omit the header-level orgUnit entirely
        // and let each dataValue carry its own.
        final List<Map<String, Object>> values = new ArrayList<>(rows.size());
        for (final PublicationProposal p : rows) {
            final Map<String, Object> v = new LinkedHashMap<>();
            v.put("dataElement", p.dataElementUid());
            v.put("categoryOptionCombo", p.categoryOptionComboUid());
            v.put("attributeOptionCombo", p.attributeOptionComboUid());
            v.put("orgUnit", p.orgUnitUid());
            v.put("period", p.periodKey());
            final java.math.BigDecimal value = p.reviewedValue() == null
                    ? p.proposedValue() : p.reviewedValue();
            v.put("value", value == null ? null : value.toPlainString());
            values.add(v);
        }
        body.put("dataValues", values);
        return json.writeValueAsString(body);
    }

    private record DatasetPeriod(String datasetUid, String periodKey) { }

    /** Snapshot for the admin UI + /quality endpoints. */
    public DrainStats stats() {
        return new DrainStats(published.get(), failed.get(),
                lastRunAt.get(), lastPublishedAt.get(),
                repo.countByState(PublicationProposal.State.APPROVED),
                repo.countByState(PublicationProposal.State.PUBLISHED),
                repo.countByState(PublicationProposal.State.DIVERGED));
    }

    public record DrainStats(long published, long failed,
                               long lastRunAt, long lastPublishedAt,
                               int queuedApproved, int totalPublished,
                               int totalDiverged) { }

    /** Force one drain tick on demand — exposed for the admin UI
     *  "Drain now" button and for tests that need deterministic
     *  timing. Thin alias of {@link #tick()}. */
    public int runNow() {
        return tick();
    }
}
