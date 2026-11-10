package ug.ac.mak.der.analytics.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.analytics.expression.ExpressionCompiler;

class AnalyticsDefinitionServiceTest {

    private AnalyticsEngineRepository repo;
    private ExpressionCompiler compiler;
    private AnalyticsDefinitionService service;

    private AnalyticsDefinitionService.CreateRequest baseReq(
            final String code, final String expr) {
        return new AnalyticsDefinitionService.CreateRequest(
                code, "Display " + code, "EVENT", "COUNT",
                null, null, "EVENT_DATE", "EVENT_ORG_UNIT", expr);
    }

    @BeforeEach
    void setUp() {
        repo = mock(AnalyticsEngineRepository.class);
        compiler = new ExpressionCompiler();
        service = new AnalyticsDefinitionService(repo, compiler,
                new ObjectMapper());
    }

    @Test
    void createReadyDefinitionPersistsRow() {
        when(repo.findDefinitionByCode(eq("MY_METRIC")))
                .thenReturn(Optional.empty());
        when(repo.findDefinition(any(UUID.class))).thenAnswer(inv ->
                Optional.of(new AnalyticsDefinition(
                        inv.getArgument(0), null, "MY_METRIC",
                        "Display MY_METRIC", 1, "h", "EVENT", "COUNT",
                        null, List.of(), "EVENT_DATE",
                        "EVENT_ORG_UNIT", "READY", null,
                        null, null, null)));
        final var r = service.create(baseReq("MY_METRIC",
                "d2:count(#{DE1})"));
        assertThat(r.outcome()).isEqualTo(
                AnalyticsDefinitionService.CreateOutcome.CREATED);
        assertThat(r.definition().supportState()).isEqualTo("READY");
        assertThat(r.compile().referencedFunctions())
                .contains("d2:count");
        verify(repo).insertDefinition(any(), any(), any());
    }

    @Test
    void createUnsupportedDefinitionStillPersistsWithUnsupportedState() {
        when(repo.findDefinitionByCode(eq("MY_METRIC")))
                .thenReturn(Optional.empty());
        when(repo.findDefinition(any(UUID.class))).thenAnswer(inv ->
                Optional.of(new AnalyticsDefinition(
                        inv.getArgument(0), null, "MY_METRIC",
                        "Display MY_METRIC", 1, "h", "EVENT", "COUNT",
                        null, List.of(), "EVENT_DATE",
                        "EVENT_ORG_UNIT", "UNSUPPORTED",
                        "unsupported function 'd2:unknown'",
                        null, null, null)));
        final var r = service.create(baseReq("MY_METRIC",
                "d2:unknown(#{DE1})"));
        assertThat(r.outcome()).isEqualTo(
                AnalyticsDefinitionService.CreateOutcome.UNSUPPORTED);
        assertThat(r.definition().supportState())
                .isEqualTo("UNSUPPORTED");
        assertThat(r.definition().unsupportedReason())
                .contains("d2:unknown");
        verify(repo).insertDefinition(any(), any(), any());
    }

    @Test
    void parseErrorIsRejectedAndNothingIsPersisted() {
        when(repo.findDefinitionByCode(eq("MY_METRIC")))
                .thenReturn(Optional.empty());
        final var r = service.create(baseReq("MY_METRIC", "1 +"));
        assertThat(r.outcome()).isEqualTo(
                AnalyticsDefinitionService.CreateOutcome.PARSE_ERROR);
        assertThat(r.definition()).isNull();
        verify(repo, org.mockito.Mockito.never())
                .insertDefinition(any(), any(), any());
    }

    @Test
    void reservedCodeRejected() {
        final var r = service.create(baseReq(
                AnalyticsSeed.EVENT_COUNT_CODE, "d2:count(#{DE1})"));
        assertThat(r.outcome()).isEqualTo(
                AnalyticsDefinitionService.CreateOutcome.CODE_TAKEN);
        assertThat(r.validationErrors().get(0))
                .contains("reserved for a built-in");
    }

    @Test
    void duplicateCodeRejected() {
        when(repo.findDefinitionByCode(eq("DUP"))).thenReturn(Optional.of(
                new AnalyticsDefinition(UUID.randomUUID(), null, "DUP",
                        "x", 1, "h", "EVENT", "COUNT", null, List.of(),
                        "EVENT_DATE", "EVENT_ORG_UNIT", "READY", null,
                        null, null, null)));
        final var r = service.create(baseReq("DUP", "d2:count(#{DE1})"));
        assertThat(r.outcome()).isEqualTo(
                AnalyticsDefinitionService.CreateOutcome.CODE_TAKEN);
    }

    @Test
    void validationCollectsAllFieldErrors() {
        final var r = service.create(new AnalyticsDefinitionService
                .CreateRequest(null, null, "FOO", "BAR",
                null, null, "BAD_ANCHOR", "BAD_OU", ""));
        assertThat(r.outcome()).isEqualTo(
                AnalyticsDefinitionService.CreateOutcome.VALIDATION_ERROR);
        assertThat(r.validationErrors()).hasSize(7);
    }

    @Test
    void deprecateMissingReturnsFalse() {
        when(repo.findDefinition(any(UUID.class))).thenReturn(Optional.empty());
        assertThat(service.deprecate(UUID.randomUUID())).isFalse();
    }

    @Test
    void deprecateExistingUpdatesState() {
        final UUID id = UUID.randomUUID();
        when(repo.findDefinition(id)).thenReturn(Optional.of(
                new AnalyticsDefinition(id, null, "OK", "ok", 1, "h",
                        "EVENT", "COUNT", null, List.of(),
                        "EVENT_DATE", "EVENT_ORG_UNIT", "READY", null,
                        null, null, null)));
        assertThat(service.deprecate(id)).isTrue();
        verify(repo).updateSupportState(eq(id), eq("DEPRECATED"), any());
    }

    @Test
    void deprecateBuiltInRejected() {
        final UUID id = UUID.randomUUID();
        when(repo.findDefinition(id)).thenReturn(Optional.of(
                new AnalyticsDefinition(id, null,
                        AnalyticsSeed.EVENT_COUNT_CODE, "built-in",
                        1, "h", "EVENT", "COUNT", null, List.of(),
                        "EVENT_DATE", "EVENT_ORG_UNIT", "READY", null,
                        null, null, null)));
        assertThatThrownBy(() -> service.deprecate(id))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("built-in");
    }
}
