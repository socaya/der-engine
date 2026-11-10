package ug.ac.mak.der.analytics.engine;

import java.time.LocalDate;
import java.util.Objects;

/**
 * Spring application event fired after a tracker event or enrollment
 * has been durably committed.
 *
 * <p>The analytics engine listens for this via {@link
 * AnalyticsLiveIngester} to apply the contribution in real time
 * (spec §15 Phase 2b). Publishing is best-effort: capture writes
 * stay independent of analytics bookkeeping — a failing listener
 * logs and moves on without rolling back the source write.</p>
 *
 * @param sourceType  EVENT or ENROLLMENT — maps to the built-in
 *                    metric the live ingester updates.
 * @param sourceKey   stable UID of the record (event_uid /
 *                    enrollment_uid).
 * @param sourceVersion the record's `version` column after the
 *                    upsert. Carried so the ingester can skip
 *                    out-of-order replays.
 * @param occurredOn  the canonical date of the record — event
 *                    occurred_date or enrollment_date. Used to
 *                    resolve the monthly period bucket.
 * @param orgUnitUid  the record's orgUnit_uid.
 * @param status      the record's status after the upsert
 *                    (ACTIVE / COMPLETED / CANCELLED / SKIPPED …).
 */
public record AnalyticsSourceEvent(
        SourceType sourceType,
        String sourceKey,
        int sourceVersion,
        LocalDate occurredOn,
        String orgUnitUid,
        String status) {

    public AnalyticsSourceEvent {
        Objects.requireNonNull(sourceType, "sourceType");
        Objects.requireNonNull(sourceKey, "sourceKey");
        Objects.requireNonNull(occurredOn, "occurredOn");
        Objects.requireNonNull(orgUnitUid, "orgUnitUid");
        Objects.requireNonNull(status, "status");
    }

    public enum SourceType {
        /** der.edge_tracker_event — DER_EVENT_COUNT. */
        EVENT,
        /** der.edge_enrollment — DER_ENROLLMENT_COUNT. */
        ENROLLMENT
    }
}
