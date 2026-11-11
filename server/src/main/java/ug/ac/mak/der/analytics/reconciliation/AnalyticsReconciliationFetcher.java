package ug.ac.mak.der.analytics.reconciliation;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsDefinition;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;
import ug.ac.mak.der.analytics.publication.PublicationProposal;
import ug.ac.mak.der.analytics.publication.PublicationRepository;
import ug.ac.mak.der.dhis2.Dhis2Properties;

/**
 * Central-side half of reconciliation (spec §12, AN-FR-039). On a
 * fixed-delay tick, polls DHIS2 {@code /api/analytics.json} for
 * every cell DER has recently PUBLISHED, builds a batch of
 * {@link AnalyticsReconciliationService.CentralSample} rows, and
 * dispatches to {@link AnalyticsReconciliationService#compare}
 * so each pair lands with a specific classification instead of a
 * bare numeric delta.
 *
 * <p>Scope — this worker intentionally only reconciles cells we
 * published ourselves. That's the one direction where DER has a
 * clean metadata-stable mapping (DataElement + CoC + AoC + period
 * + orgUnit). Reconciling against DHIS2-side program indicators
 * is a later slice because it requires a separate PI-to-metric
 * mapping that the publication side doesn't carry.</p>
 */
@Component
public class AnalyticsReconciliationFetcher {

    private static final Logger LOG =
            LoggerFactory.getLogger(AnalyticsReconciliationFetcher.class);

    private final PublicationRepository publications;
    private final AnalyticsReconciliationService reconciliation;
    private final Dhis2Properties dhis2;
    private final ReconciliationFetchProperties properties;
    private final HttpClient http;
    private final ObjectMapper json;
    /** Nullable — older constructor path left this off. Only the
     *  PI reconciliation pass needs it; the publication-mapped
     *  pass still works without it. */
    private AnalyticsEngineRepository engineRepo;

    private final AtomicLong sampled = new AtomicLong();
    private final AtomicLong fetchFailed = new AtomicLong();
    private final AtomicLong lastRunAt = new AtomicLong();

    public AnalyticsReconciliationFetcher(
            final PublicationRepository publications,
            final AnalyticsReconciliationService reconciliation,
            final Dhis2Properties dhis2,
            final ReconciliationFetchProperties properties,
            final HttpClient http,
            final ObjectMapper json) {
        this.publications = Objects.requireNonNull(publications, "publications");
        this.reconciliation = Objects.requireNonNull(reconciliation,
                "reconciliation");
        this.dhis2 = Objects.requireNonNull(dhis2, "dhis2");
        this.properties = properties == null
                ? new ReconciliationFetchProperties(0L, 0, 0, true)
                : properties;
        this.http = Objects.requireNonNull(http, "http");
        this.json = Objects.requireNonNull(json, "json");
    }

    /** Spring setter-injection for the engine repo. Kept optional
     *  so the 6-arg constructor stays valid for pre-PI tests;
     *  without this, {@link #reconcilePiMetrics()} is a no-op. */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setEngineRepo(final AnalyticsEngineRepository repo) {
        this.engineRepo = repo;
    }

    public record FetchStats(long sampled, long fetchFailed,
                               long lastRunAt) { }

    public FetchStats stats() {
        return new FetchStats(sampled.get(), fetchFailed.get(),
                lastRunAt.get());
    }

    /** Scheduled tick. Public so admin tooling and tests can force
     *  a run on demand. Returns the number of samples compared. */
    @Scheduled(
            fixedDelayString = "${der.analytics.reconciliation.fetch-interval-millis:300000}",
            initialDelayString = "${der.analytics.reconciliation.fetch-initial-delay:15000}")
    public int tick() {
        lastRunAt.set(System.currentTimeMillis());
        if (!properties.fetchEnabled()) {
            return 0;
        }
        if (dhis2.central().baseUrl() == null
                || dhis2.central().baseUrl().isBlank()) {
            return 0;
        }
        final List<PublicationProposal> published = publications
                .listProposals(null,
                        PublicationProposal.State.PUBLISHED.name());
        if (published.isEmpty()) {
            return 0;
        }
        final int batch = Math.max(1, properties.batchSize());
        final List<PublicationProposal> slice = published.size() <= batch
                ? published
                : published.subList(0, batch);

        final List<AnalyticsReconciliationService.CentralSample> samples =
                new ArrayList<>();
        for (final PublicationProposal p : slice) {
            final BigDecimal central = fetchCentralValue(p);
            if (central == null) {
                // Value missing is itself a reconciliation signal —
                // emit a sample with null centralValue so the
                // classifier can distinguish LOCAL_PENDING_SYNC vs
                // CENTRAL_ANALYTICS_NOT_REFRESHED via the publish
                // cursor comparison.
                samples.add(sampleFor(p, null));
                continue;
            }
            samples.add(sampleFor(p, central));
            sampled.incrementAndGet();
        }
        int upserts = 0;
        if (!samples.isEmpty()) {
            upserts += reconciliation.compare(samples).rowsUpserted();
        }
        // Second direction — compare DER's local evaluation of each
        // imported DHIS2 PI against DHIS2's own evaluation. This
        // closes the loop for metrics DER never published (spec §12
        // like-for-like comparison).
        upserts += reconcilePiMetrics();
        return upserts;
    }

    /** Spec §12 PI-side reconciliation pass. For every metric
     *  imported from a DHIS2 program indicator (source_uid
     *  non-null), find the materialised cells and fetch DHIS2's
     *  own PI evaluation for each (period, orgUnit). A difference
     *  between "DER-evaluates-the-PI-locally" and
     *  "DHIS2-evaluates-the-PI-centrally" is a genuine reconciliation
     *  signal — the formula is the same on both sides, so divergence
     *  usually means late-arriving data or a refresh-timing gap.
     *
     *  <p>Returns the number of reconciliation rows upserted this
     *  pass. Returns 0 when the engine repo wasn't injected (pre-
     *  PI construction path).</p> */
    public int reconcilePiMetrics() {
        if (engineRepo == null) {
            return 0;
        }
        final List<AnalyticsDefinition> defs = engineRepo
                .listPiBackedMetrics(properties.batchSize());
        if (defs.isEmpty()) {
            return 0;
        }
        final List<AnalyticsReconciliationService.CentralSample> samples =
                new ArrayList<>();
        for (final AnalyticsDefinition def : defs) {
            final AnalyticsEngineRepository.CellQuery q =
                    new AnalyticsEngineRepository.CellQuery(
                            List.of(def.id()), List.of(), List.of(),
                            java.util.Map.of(),
                            Math.max(1, properties.batchSize()), 0);
            for (final AnalyticsCell cell : engineRepo.queryCells(q)) {
                final BigDecimal central = fetchPiCentralValue(
                        def.sourceUid(), cell.periodKey(),
                        cell.orgUnitUid());
                if (central != null) {
                    sampled.incrementAndGet();
                }
                samples.add(piSampleFor(def.id(), cell.periodKey(),
                        cell.orgUnitUid(), cell.dimensionKey(),
                        central));
            }
        }
        if (samples.isEmpty()) {
            return 0;
        }
        return reconciliation.compare(samples).rowsUpserted();
    }

    private BigDecimal fetchPiCentralValue(final String piUid,
                                             final String periodKey,
                                             final String orgUnitUid) {
        final String base = dhis2.central().baseUrl();
        if (base == null || base.isBlank() || piUid == null) {
            return null;
        }
        final String url = base + "/api/analytics.json?"
                + "dimension=" + encode("dx:" + piUid)
                + "&dimension=" + encode("pe:" + periodKey)
                + "&dimension=" + encode("ou:" + orgUnitUid)
                + "&skipMeta=true";
        final HttpRequest.Builder req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(20))
                .header("Accept", "application/json")
                .GET();
        if (dhis2.central().username() != null
                && !dhis2.central().username().isBlank()) {
            final String token = dhis2.central().username() + ":"
                    + (dhis2.central().password() == null ? ""
                            : dhis2.central().password());
            req.header("Authorization", "Basic " + Base64.getEncoder()
                    .encodeToString(token.getBytes(StandardCharsets.UTF_8)));
        }
        final HttpResponse<String> resp;
        try {
            resp = http.send(req.build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            fetchFailed.incrementAndGet();
            return null;
        } catch (IOException ex) {
            fetchFailed.incrementAndGet();
            return null;
        }
        if (resp.statusCode() / 100 != 2) {
            fetchFailed.incrementAndGet();
            return null;
        }
        return parseValue(resp.body());
    }

    private AnalyticsReconciliationService.CentralSample piSampleFor(
            final UUID metricId, final String periodKey,
            final String orgUnitUid, final String dimensionKey,
            final BigDecimal centralValue) {
        return new AnalyticsReconciliationService.CentralSample(
                metricId, periodKey, orgUnitUid,
                dimensionKey == null ? "" : dimensionKey,
                centralValue,
                /* centralDefinitionVersion */ null,
                /* centralRefreshAt */ Instant.now(),
                // DHIS2 evaluated its own PI, so by construction the
                // formula side is compatible. If the operator later
                // rewrites the DER metric's expression that'd bump
                // definition_version — the classifier catches that
                // before the numeric compare.
                /* metricFormulaCompatibleWithCentral */ true,
                /* sameOrgUnitAnchor */ true,
                /* sameDateAnchor */ true,
                /* sameDedupPolicy */ true,
                /* hasRejectedTrackerUpdate */ false,
                /* localHasUnpublishedSources */ false,
                /* lateDataAfterRefresh */ false,
                /* lastLocalPublishAt */ null);
    }

    /** Fetch one {@code /api/analytics.json} cell value. Returns
     *  null on any non-2xx or shape-mismatched response — the
     *  classifier treats null as "central didn't return a value". */
    private BigDecimal fetchCentralValue(final PublicationProposal p) {
        final String base = dhis2.central().baseUrl();
        final String url = base + "/api/analytics.json?"
                + "dimension=" + encode("dx:" + p.dataElementUid())
                + "&dimension=" + encode("pe:" + p.periodKey())
                + "&dimension=" + encode("ou:" + p.orgUnitUid())
                + "&skipMeta=true";
        final HttpRequest.Builder req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(20))
                .header("Accept", "application/json")
                .GET();
        if (dhis2.central().username() != null
                && !dhis2.central().username().isBlank()) {
            final String token = dhis2.central().username() + ":"
                    + (dhis2.central().password() == null ? ""
                            : dhis2.central().password());
            req.header("Authorization", "Basic " + Base64.getEncoder()
                    .encodeToString(token.getBytes(StandardCharsets.UTF_8)));
        }
        final HttpResponse<String> resp;
        try {
            resp = http.send(req.build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            fetchFailed.incrementAndGet();
            return null;
        } catch (IOException ex) {
            LOG.warn("reconciliation fetch I/O failure for {}: {}",
                    p.proposalId(), ex.getMessage());
            fetchFailed.incrementAndGet();
            return null;
        }
        if (resp.statusCode() / 100 != 2) {
            fetchFailed.incrementAndGet();
            return null;
        }
        return parseValue(resp.body());
    }

    /** Parse the first cell value from {@code /api/analytics.json}
     *  shape {@code {rows: [[dx, pe, ou, value]]}}. */
    BigDecimal parseValue(final String body) {
        if (body == null || body.isBlank()) {
            return null;
        }
        try {
            final JsonNode root = json.readTree(body);
            final JsonNode rows = root.path("rows");
            if (!rows.isArray() || rows.isEmpty()) {
                return null;
            }
            final JsonNode first = rows.get(0);
            if (!first.isArray() || first.isEmpty()) {
                return null;
            }
            final String raw = first.get(first.size() - 1).asText(null);
            if (raw == null || raw.isBlank()) {
                return null;
            }
            return new BigDecimal(raw.trim());
        } catch (RuntimeException | IOException ex) {
            return null;
        }
    }

    private static String encode(final String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    private AnalyticsReconciliationService.CentralSample sampleFor(
            final PublicationProposal p,
            final BigDecimal centralValue) {
        return new AnalyticsReconciliationService.CentralSample(
                p.metricId(), p.periodKey(), p.orgUnitUid(), "",
                centralValue,
                /* centralDefinitionVersion */ null,
                /* centralRefreshAt */ Instant.now(),
                /* metricFormulaCompatibleWithCentral */ true,
                /* sameOrgUnitAnchor */ true,
                /* sameDateAnchor */ true,
                /* sameDedupPolicy */ true,
                /* hasRejectedTrackerUpdate */ false,
                /* localHasUnpublishedSources */ false,
                /* lateDataAfterRefresh */ false,
                /* lastLocalPublishAt */ p.reviewedAt() == null
                        ? p.updatedAt() : p.reviewedAt());
    }

    /** On-demand runner for the admin "Reconcile now" button. */
    public int runNow() {
        return tick();
    }

    /** Exposed so tests can reach into the publication id pipeline
     *  when asserting fetched metric targets. */
    @SuppressWarnings("unused")
    private static UUID typeAnchor() {
        return UUID.randomUUID();
    }
}
