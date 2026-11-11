package ug.ac.mak.der.analytics.reconciliation;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;

import org.junit.jupiter.api.Test;

class ReconciliationClassifierTest {

    private ReconciliationClassifier.Input happyPath(
            final BigDecimal localValue, final BigDecimal centralValue) {
        return new ReconciliationClassifier.Input(
                localValue, centralValue,
                1, 1,
                Instant.parse("2026-11-10T00:00:00Z"),
                Instant.parse("2026-11-09T00:00:00Z"),
                true, true, true, true,
                false, false, false);
    }

    @Test
    void inAgreementWhenValuesMatch() {
        final var v = ReconciliationClassifier.classify(
                happyPath(new BigDecimal("42"), new BigDecimal("42")));
        assertThat(v.classification())
                .isEqualTo(ReconciliationClassifier.Classification.IN_AGREEMENT);
    }

    @Test
    void realMismatchWhenValuesDifferBeyondTolerance() {
        final var v = ReconciliationClassifier.classify(
                happyPath(new BigDecimal("42"), new BigDecimal("40")));
        assertThat(v.classification())
                .isEqualTo(ReconciliationClassifier.Classification.REAL_MISMATCH);
        assertThat(v.explanation()).contains("2");
    }

    @Test
    void withinToleranceCountsAsAgreement() {
        final var v = ReconciliationClassifier.classify(
                happyPath(new BigDecimal("42.00001"), new BigDecimal("42")));
        assertThat(v.classification())
                .isEqualTo(ReconciliationClassifier.Classification.IN_AGREEMENT);
    }

    @Test
    void metadataVersionDriftPreemptsNumericCompare() {
        final var v = ReconciliationClassifier.classify(
                new ReconciliationClassifier.Input(
                        new BigDecimal("42"), new BigDecimal("40"),
                        2, 1, Instant.now(), Instant.now(),
                        true, true, true, true,
                        false, false, false));
        assertThat(v.classification())
                .isEqualTo(ReconciliationClassifier.Classification.METADATA_VERSION_DRIFT);
    }

    @Test
    void incompatibleFormulaPreemptsNumericCompare() {
        final var v = ReconciliationClassifier.classify(
                new ReconciliationClassifier.Input(
                        new BigDecimal("42"), new BigDecimal("40"),
                        1, 1, Instant.now(), Instant.now(),
                        false, true, true, true,
                        false, false, false));
        assertThat(v.classification())
                .isEqualTo(ReconciliationClassifier.Classification.INCOMPATIBLE_FORMULA);
    }

    @Test
    void orgUnitAttributionDifference() {
        final var v = ReconciliationClassifier.classify(
                new ReconciliationClassifier.Input(
                        new BigDecimal("42"), new BigDecimal("42"),
                        1, 1, Instant.now(), Instant.now(),
                        true, false, true, true,
                        false, false, false));
        assertThat(v.classification())
                .isEqualTo(ReconciliationClassifier.Classification.ORGUNIT_ATTRIBUTION);
    }

    @Test
    void dateAnchorDifference() {
        final var v = ReconciliationClassifier.classify(
                new ReconciliationClassifier.Input(
                        new BigDecimal("42"), new BigDecimal("42"),
                        1, 1, Instant.now(), Instant.now(),
                        true, true, false, true,
                        false, false, false));
        assertThat(v.classification())
                .isEqualTo(ReconciliationClassifier.Classification.DATE_ANCHOR);
    }

    @Test
    void dedupPolicyDifference() {
        final var v = ReconciliationClassifier.classify(
                new ReconciliationClassifier.Input(
                        new BigDecimal("42"), new BigDecimal("42"),
                        1, 1, Instant.now(), Instant.now(),
                        true, true, true, false,
                        false, false, false));
        assertThat(v.classification())
                .isEqualTo(ReconciliationClassifier.Classification.DEDUP_POLICY);
    }

    @Test
    void rejectedTrackerUpdateClassification() {
        final var v = ReconciliationClassifier.classify(
                new ReconciliationClassifier.Input(
                        new BigDecimal("42"), new BigDecimal("40"),
                        1, 1, Instant.now(), Instant.now(),
                        true, true, true, true,
                        true, false, false));
        assertThat(v.classification())
                .isEqualTo(ReconciliationClassifier.Classification.REJECTED_TRACKER_UPDATE);
    }

    @Test
    void localPendingSyncWhenCentralValueMissing() {
        final var v = ReconciliationClassifier.classify(
                new ReconciliationClassifier.Input(
                        new BigDecimal("42"), null,
                        1, 1, Instant.now(), Instant.now(),
                        true, true, true, true,
                        false, true, false));
        assertThat(v.classification())
                .isEqualTo(ReconciliationClassifier.Classification.LOCAL_PENDING_SYNC);
    }

    @Test
    void centralAnalyticsNotRefreshedWhenCentralMissingAndNoLocalPending() {
        final var v = ReconciliationClassifier.classify(
                new ReconciliationClassifier.Input(
                        new BigDecimal("42"), null,
                        1, 1, Instant.now(), Instant.now(),
                        true, true, true, true,
                        false, false, false));
        assertThat(v.classification())
                .isEqualTo(ReconciliationClassifier.Classification.CENTRAL_ANALYTICS_NOT_REFRESHED);
    }

    @Test
    void lateDataAfterRefresh() {
        final var v = ReconciliationClassifier.classify(
                new ReconciliationClassifier.Input(
                        new BigDecimal("42"), new BigDecimal("40"),
                        1, 1, Instant.now(), Instant.now(),
                        true, true, true, true,
                        false, false, true));
        assertThat(v.classification())
                .isEqualTo(ReconciliationClassifier.Classification.LATE_DATA);
    }

    @Test
    void centralRefreshStalerThanLastPublishClassifiesAsNotRefreshed() {
        final var v = ReconciliationClassifier.classify(
                new ReconciliationClassifier.Input(
                        new BigDecimal("42"), new BigDecimal("40"),
                        1, 1,
                        Instant.parse("2026-11-01T00:00:00Z"),
                        Instant.parse("2026-11-10T00:00:00Z"),
                        true, true, true, true,
                        false, false, false));
        assertThat(v.classification())
                .isEqualTo(ReconciliationClassifier.Classification
                        .CENTRAL_ANALYTICS_NOT_REFRESHED);
    }

    @Test
    void customToleranceBandIsRespected() {
        final var v = ReconciliationClassifier.classify(
                happyPath(new BigDecimal("42.5"), new BigDecimal("42")),
                new BigDecimal("1"));
        assertThat(v.classification())
                .isEqualTo(ReconciliationClassifier.Classification.IN_AGREEMENT);
    }
}
