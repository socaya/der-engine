package ug.ac.mak.der.analytics.column.sink;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

class AnalyticsColumnarVerifierTest {

    private AnalyticsEngineRepository engineRepo;
    private final ObjectMapper json = new ObjectMapper();

    @TempDir Path tmp;

    @BeforeEach
    void setUp() {
        engineRepo = mock(AnalyticsEngineRepository.class);
    }

    private AnalyticsColumnarProperties props() {
        return new AnalyticsColumnarProperties(true, tmp.toString(),
                100_000);
    }

    private AnalyticsCell cell(final UUID metric, final String period,
                                  final String ou, final long count,
                                  final BigDecimal value) {
        return new AnalyticsCell(metric, 1, period, ou, "",
                count, value, value, null, null, Instant.now(),
                "VERIFIED");
    }

    @Test
    void verifyWithoutManifestReturnsEmpty() throws IOException {
        final AnalyticsColumnarVerifier v = new AnalyticsColumnarVerifier(
                engineRepo, props(), json);
        final var r = v.verify();
        assertThat(r.generation()).isEqualTo(-1L);
        assertThat(r.segmentsChecked()).isZero();
    }

    @Test
    void verifyMatchingStoresReportsZeroDrift() throws IOException {
        final UUID metric = UUID.randomUUID();
        final List<AnalyticsCell> rows = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            rows.add(cell(metric, "202611", "OU-" + i, i,
                    new BigDecimal(i)));
        }
        when(engineRepo.queryCells(any())).thenReturn(rows);

        // Flush then verify — both see the same row-store snapshot.
        final AnalyticsColumnarSink sink = new AnalyticsColumnarSink(
                engineRepo, props(), json);
        sink.flush();

        final AnalyticsColumnarVerifier verifier =
                new AnalyticsColumnarVerifier(engineRepo, props(), json);
        final var r = verifier.verify();

        assertThat(r.rowsChecked()).isEqualTo(10);
        assertThat(r.rowsOk()).isEqualTo(10);
        assertThat(r.rowsDrifted()).isZero();
    }

    @Test
    void verifyDetectsDriftWhenRowStoreChangesAfterFlush()
            throws IOException {
        final UUID metric = UUID.randomUUID();

        // Flush with original values.
        when(engineRepo.queryCells(any())).thenReturn(List.of(
                cell(metric, "202611", "OU-A", 5, new BigDecimal("5"))));
        new AnalyticsColumnarSink(engineRepo, props(), json).flush();

        // Mutate the row-store between flush and verify — value
        // shifts from 5 to 42. Columnar segment still carries 5,
        // row-store now says 42: that's drift.
        when(engineRepo.queryCells(any())).thenReturn(List.of(
                cell(metric, "202611", "OU-A", 5, new BigDecimal("42"))));
        final var r = new AnalyticsColumnarVerifier(engineRepo,
                props(), json).verify();

        assertThat(r.rowsChecked()).isEqualTo(1);
        assertThat(r.rowsDrifted()).isEqualTo(1);
        // Either sum or value diverges first — both are valid
        // signals that the stores disagree.
        assertThat(r.drifts().get(0).reason())
                .containsAnyOf("value", "sum", "count");
    }

    @Test
    void verifyDetectsMissingRowStoreCell() throws IOException {
        final UUID metric = UUID.randomUUID();

        when(engineRepo.queryCells(any())).thenReturn(List.of(
                cell(metric, "202611", "OU-A", 5, new BigDecimal("5"))));
        new AnalyticsColumnarSink(engineRepo, props(), json).flush();

        // Row-store now reports no cells — but the segment still
        // carries the old row.
        when(engineRepo.queryCells(any())).thenReturn(List.of());
        final var r = new AnalyticsColumnarVerifier(engineRepo,
                props(), json).verify();

        assertThat(r.rowsDrifted()).isEqualTo(1);
        assertThat(r.drifts().get(0).reason())
                .contains("row-store does not");
    }
}
