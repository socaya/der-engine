package ug.ac.mak.der.analytics.reconciliation;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Pure classifier for a single local-vs-central cell comparison per
 * spec §12 taxonomy. Order matters — the first condition that
 * applies wins, matching the spec's "most-specific explanation
 * first" semantics so a user never sees a generic REAL_MISMATCH
 * when a structural reason (metadata drift, formula
 * incompatibility, pending sync) applies.
 *
 * <p>Spec §12 is explicit: a parity test is valid only when the
 * upstream DHIS2 has acknowledged the relevant source revisions,
 * the analytics refresh is complete, and the compared indicator
 * and dimension semantics match. Every other case is a
 * <em>classified</em> divergence, not a mismatch.</p>
 */
public final class ReconciliationClassifier {

    private ReconciliationClassifier() {
    }

    /** Numeric equality tolerance — a rounding delta inside this
     *  band is treated as IN_AGREEMENT. Value chosen to accommodate
     *  DHIS2 central's double-precision rounding on ratio indicators
     *  without masking a real one-unit count divergence. */
    private static final BigDecimal DEFAULT_TOLERANCE =
            new BigDecimal("0.0001");

    public record Input(
            BigDecimal localValue,
            BigDecimal centralValue,
            int localDefinitionVersion,
            Integer centralDefinitionVersion,
            Instant centralRefreshAt,
            Instant lastLocalPublishAt,
            boolean metricFormulaCompatibleWithCentral,
            boolean sameOrgUnitAnchor,
            boolean sameDateAnchor,
            boolean sameDedupPolicy,
            boolean hasRejectedTrackerUpdate,
            boolean localHasUnpublishedSources,
            boolean lateDataAfterRefresh) {
    }

    public enum Classification {
        IN_AGREEMENT,
        LOCAL_PENDING_SYNC,
        CENTRAL_ANALYTICS_NOT_REFRESHED,
        METADATA_VERSION_DRIFT,
        INCOMPATIBLE_FORMULA,
        ORGUNIT_ATTRIBUTION,
        DATE_ANCHOR,
        DEDUP_POLICY,
        LATE_DATA,
        REJECTED_TRACKER_UPDATE,
        REAL_MISMATCH
    }

    public record Verdict(Classification classification,
                            String explanation) {
    }

    /** Classify a single cell comparison. Uses {@link #DEFAULT_TOLERANCE}. */
    public static Verdict classify(final Input in) {
        return classify(in, DEFAULT_TOLERANCE);
    }

    /** Classify with a caller-supplied tolerance band. */
    public static Verdict classify(final Input in,
                                     final BigDecimal tolerance) {
        if (in == null) {
            throw new IllegalArgumentException("input");
        }
        // A missing central value is almost always "central hasn't
        // caught up yet" — distinguish pending sync from stale
        // analytics refresh using the local publish cursor.
        if (in.centralValue() == null) {
            if (in.localHasUnpublishedSources()) {
                return new Verdict(Classification.LOCAL_PENDING_SYNC,
                        "local holds sources not yet published to central");
            }
            return new Verdict(
                    Classification.CENTRAL_ANALYTICS_NOT_REFRESHED,
                    "central did not return a value for this cell");
        }
        // Structural reasons preempt a numeric comparison — if the
        // definitions aren't like-for-like, a numeric delta tells
        // the operator nothing useful.
        if (in.centralDefinitionVersion() != null
                && in.centralDefinitionVersion() != in.localDefinitionVersion()) {
            return new Verdict(Classification.METADATA_VERSION_DRIFT,
                    "local definition v" + in.localDefinitionVersion()
                  + " vs central v" + in.centralDefinitionVersion());
        }
        if (!in.metricFormulaCompatibleWithCentral()) {
            return new Verdict(Classification.INCOMPATIBLE_FORMULA,
                    "metric uses functions outside central's support matrix");
        }
        if (!in.sameOrgUnitAnchor()) {
            return new Verdict(Classification.ORGUNIT_ATTRIBUTION,
                    "org-unit anchor differs between DER and central");
        }
        if (!in.sameDateAnchor()) {
            return new Verdict(Classification.DATE_ANCHOR,
                    "date anchor differs between DER and central");
        }
        if (!in.sameDedupPolicy()) {
            return new Verdict(Classification.DEDUP_POLICY,
                    "distinct-count dedup scope differs");
        }
        if (in.hasRejectedTrackerUpdate()) {
            return new Verdict(Classification.REJECTED_TRACKER_UPDATE,
                    "a referenced tracker write was rejected centrally");
        }
        if (in.localHasUnpublishedSources()) {
            return new Verdict(Classification.LOCAL_PENDING_SYNC,
                    "local holds sources not yet published to central");
        }
        if (in.lateDataAfterRefresh()) {
            return new Verdict(Classification.LATE_DATA,
                    "data arrived locally after central's analytics refresh");
        }
        if (in.centralRefreshAt() != null
                && in.lastLocalPublishAt() != null
                && in.centralRefreshAt().isBefore(in.lastLocalPublishAt())) {
            return new Verdict(
                    Classification.CENTRAL_ANALYTICS_NOT_REFRESHED,
                    "central analytics refresh predates the most recent "
                  + "local publish");
        }

        // Now a like-for-like numeric compare is meaningful.
        final BigDecimal local = in.localValue() == null
                ? BigDecimal.ZERO : in.localValue();
        final BigDecimal delta = local.subtract(in.centralValue()).abs();
        if (delta.compareTo(tolerance == null
                ? DEFAULT_TOLERANCE : tolerance) <= 0) {
            return new Verdict(Classification.IN_AGREEMENT,
                    "within tolerance " + (tolerance == null
                            ? DEFAULT_TOLERANCE : tolerance));
        }
        return new Verdict(Classification.REAL_MISMATCH,
                "like-for-like delta " + delta.toPlainString()
              + " exceeds tolerance");
    }
}
