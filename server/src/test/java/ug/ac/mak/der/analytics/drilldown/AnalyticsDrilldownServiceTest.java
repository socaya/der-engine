package ug.ac.mak.der.analytics.drilldown;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsDefinition;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;
import ug.ac.mak.der.security.EdgeRole;

class AnalyticsDrilldownServiceTest {

    private AnalyticsEngineRepository engineRepo;
    private JdbcTemplate jdbc;
    private AnalyticsDrilldownAuditRepository audit;
    private AnalyticsDrilldownService service;

    private final UUID metricId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        engineRepo = mock(AnalyticsEngineRepository.class);
        jdbc = mock(JdbcTemplate.class);
        audit = mock(AnalyticsDrilldownAuditRepository.class);
        when(audit.insert(any())).thenAnswer(inv -> UUID.randomUUID());
        service = new AnalyticsDrilldownService(engineRepo, jdbc, audit);
    }

    private AnalyticsDefinition eventDef() {
        return new AnalyticsDefinition(metricId, null, "DER_EVENT_COUNT",
                "Event count", 1, "h", "EVENT", "COUNT",
                null, List.of(), "EVENT_DATE", "EVENT_ORG_UNIT",
                "READY", null, null, null, null);
    }

    private AnalyticsCell cellWithCount(final long count) {
        return new AnalyticsCell(metricId, 1, "202611", "OU-A", "",
                count, new BigDecimal(count), new BigDecimal(count),
                null, null, Instant.now(), "VERIFIED");
    }

    private AnalyticsDrilldownService.Request request() {
        return new AnalyticsDrilldownService.Request(metricId, "202611",
                "OU-A", "", "research", 100);
    }

    @Test
    void operatorRoleIsForbidden() {
        final var caller = new AnalyticsDrilldownService.Caller(
                userId, EdgeRole.OPERATOR, "127.0.0.1");

        final var result = service.drilldown(caller, request());

        assertThat(result.outcome())
                .isEqualTo(AnalyticsDrilldownService.DrilldownOutcome.UNAUTHORISED);
        assertThat(result.rows()).isEmpty();
        verify(audit).insert(any()); // audited even on deny
        verify(jdbc, never()).query(anyString(), any(org.springframework.jdbc.core.RowMapper.class),
                any(Object[].class));
    }

    @Test
    void metricNotFoundReturnsStructuredOutcome() {
        when(engineRepo.findDefinition(metricId)).thenReturn(Optional.empty());
        final var caller = new AnalyticsDrilldownService.Caller(
                userId, EdgeRole.REVIEWER, "127.0.0.1");

        final var result = service.drilldown(caller, request());

        assertThat(result.outcome())
                .isEqualTo(AnalyticsDrilldownService.DrilldownOutcome.METRIC_NOT_FOUND);
        verify(audit).insert(any());
    }

    @Test
    void suppressedCellReturnsNoRowsAndMarksAudit() {
        when(engineRepo.findDefinition(metricId))
                .thenReturn(Optional.of(eventDef()));
        when(engineRepo.findCell(eq(metricId), eq(1),
                eq("202611"), eq("OU-A"), eq("")))
                .thenReturn(Optional.of(cellWithCount(2L)));
        ReflectionTestUtils.setField(service, "minCellSize", 5);
        final var caller = new AnalyticsDrilldownService.Caller(
                userId, EdgeRole.REVIEWER, "127.0.0.1");

        final var result = service.drilldown(caller, request());

        assertThat(result.outcome())
                .isEqualTo(AnalyticsDrilldownService.DrilldownOutcome.SUPPRESSED);
        assertThat(result.suppressed()).isTrue();
        assertThat(result.rows()).isEmpty();
        verify(jdbc, never()).query(anyString(),
                any(org.springframework.jdbc.core.RowMapper.class),
                any(Object[].class));
    }

    @Test
    void happyPathReturnsMaskedRowsAndAudits() {
        when(engineRepo.findDefinition(metricId))
                .thenReturn(Optional.of(eventDef()));
        when(engineRepo.findCell(any(), anyInt(), anyString(),
                anyString(), anyString()))
                .thenReturn(Optional.of(cellWithCount(10L)));
        final var fakeRow = new AnalyticsDrilldownService.SourceRow(
                "ev-1", "EVENT", java.time.LocalDate.of(2026, 11, 3),
                "COMPLETED", "OU-A", "PS-UID",
                AnalyticsDrilldownService.mask("TEI-ABCD1234567"));
        when(jdbc.query(anyString(),
                any(org.springframework.jdbc.core.RowMapper.class),
                any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(fakeRow));
        final var caller = new AnalyticsDrilldownService.Caller(
                userId, EdgeRole.ADMIN, "127.0.0.1");

        final var result = service.drilldown(caller, request());

        assertThat(result.outcome())
                .isEqualTo(AnalyticsDrilldownService.DrilldownOutcome.OK);
        assertThat(result.rowCount()).isEqualTo(1);
        assertThat(result.rows().get(0).maskedSubjectId()).startsWith("pt-");
        verify(audit).insert(any());
    }

    @Test
    void cellNotFoundReturnsStructuredOutcome() {
        when(engineRepo.findDefinition(metricId))
                .thenReturn(Optional.of(eventDef()));
        when(engineRepo.findCell(any(), anyInt(), anyString(),
                anyString(), anyString()))
                .thenReturn(Optional.empty());
        final var caller = new AnalyticsDrilldownService.Caller(
                userId, EdgeRole.ADMIN, "127.0.0.1");

        final var result = service.drilldown(caller, request());

        assertThat(result.outcome())
                .isEqualTo(AnalyticsDrilldownService.DrilldownOutcome.CELL_NOT_FOUND);
        verify(audit).insert(any());
    }

    @Test
    void maskHashesTeiUidStably() {
        final String a = AnalyticsDrilldownService.mask("TEI-ABC1234567");
        final String b = AnalyticsDrilldownService.mask("TEI-ABC1234567");
        assertThat(a).isEqualTo(b).startsWith("pt-");
        assertThat(AnalyticsDrilldownService.mask(null)).isNull();
        assertThat(AnalyticsDrilldownService.mask("")).isNull();
    }
}
