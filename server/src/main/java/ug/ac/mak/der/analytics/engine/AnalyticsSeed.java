package ug.ac.mak.der.analytics.engine;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Seeds the built-in analytics definitions so the server has a
 * meaningful catalogue the first time it starts.
 *
 * <p>Phase 2 ships two seeded metrics:</p>
 * <ul>
 *   <li>{@code DER_EVENT_COUNT} — monthly count of tracker events by
 *       orgUnit. Backed by the ingestion job over
 *       {@code der.edge_tracker_event}.</li>
 *   <li>{@code DER_ENROLLMENT_COUNT} — monthly count of enrollments
 *       by orgUnit. Backed by the ingestion job over
 *       {@code der.edge_enrollment}.</li>
 * </ul>
 *
 * <p>Both are {@code DER_EXTENDED} — not direct DHIS2 program
 * indicators. Once the expression engine lands in Phase 3, operators
 * can ingest their own DHIS2-defined program indicators and these
 * built-ins serve as the sanity-check baseline.</p>
 */
@Component
public class AnalyticsSeed {

    public static final String EVENT_COUNT_CODE = "DER_EVENT_COUNT";
    public static final String ENROLLMENT_COUNT_CODE = "DER_ENROLLMENT_COUNT";

    private final AnalyticsEngineRepository repo;

    public AnalyticsSeed(final AnalyticsEngineRepository repo) {
        this.repo = Objects.requireNonNull(repo, "repo");
    }

    @EventListener(ApplicationReadyEvent.class)
    public void seed() {
        seedIfAbsent(EVENT_COUNT_CODE,
                "Tracker events — count by month", "EVENT", "COUNT",
                "EVENT_DATE", "EVENT_ORG_UNIT",
                "Built-in: counts every COMMITTED row in "
              + "der.edge_tracker_event, bucketed by occurred_date → "
              + "monthly and org_unit_uid. Soft-deleted / quarantined "
              + "events are excluded via the ingestion source_state "
              + "filter.");
        seedIfAbsent(ENROLLMENT_COUNT_CODE,
                "Tracker enrollments — count by month",
                "ENROLLMENT", "COUNT",
                "ENROLLMENT_DATE", "ENROLLMENT_ORG_UNIT",
                "Built-in: counts every COMMITTED row in "
              + "der.edge_enrollment bucketed by enrolled_date → "
              + "monthly and org_unit_uid.");
    }

    public Optional<AnalyticsDefinition> definition(final String code) {
        return repo.findDefinitionByCode(code);
    }

    private void seedIfAbsent(final String code, final String displayName,
                                final String analyticsType,
                                final String aggregationType,
                                final String dateAnchor,
                                final String orgUnitAnchor,
                                final String description) {
        if (repo.findDefinitionByCode(code).isPresent()) {
            return;
        }
        final AnalyticsDefinition d = new AnalyticsDefinition(
                UUID.randomUUID(),
                null,
                code,
                displayName,
                1,
                "built-in-v1",
                analyticsType,
                aggregationType,
                null,
                List.of(),
                dateAnchor,
                orgUnitAnchor,
                "READY",
                null,
                Instant.now(),
                Instant.now(),
                Instant.now());
        repo.insertDefinition(d, null,
                "{\"builtIn\":true,\"description\":\""
              + description.replace("\"", "'") + "\"}");
    }
}
