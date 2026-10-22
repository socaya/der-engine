package ug.ac.mak.der.workflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.BufferedReader;
import java.io.StringReader;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;

class CaptureWorkflowContributionIngestTest {

    private static final Instant NOW = Instant.parse("2026-10-22T00:00:00Z");

    private CaptureWorkflowContributionIngest newIngest(
            final CaptureWorkflowService svc,
            final CaptureWorkflowContributionRepository repo) {
        return new CaptureWorkflowContributionIngest(svc, repo, new ObjectMapper(),
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private HttpServletRequest req(final String path, final String method, final String body,
                                     final String runHeader, final String stepHeader,
                                     final String deviceHeader) throws Exception {
        final HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn(path);
        when(req.getMethod()).thenReturn(method);
        when(req.getReader()).thenReturn(new BufferedReader(new StringReader(body == null ? "" : body)));
        when(req.getHeader("X-DER-Workflow-Run")).thenReturn(runHeader);
        when(req.getHeader("X-DER-Workflow-Step")).thenReturn(stepHeader);
        when(req.getHeader("X-DER-Device-Id")).thenReturn(deviceHeader);
        return req;
    }

    private HttpServletResponse resp(final int status) {
        final HttpServletResponse resp = mock(HttpServletResponse.class);
        when(resp.getStatus()).thenReturn(status);
        return resp;
    }

    private CaptureWorkflow workflow() {
        final UUID id = UUID.randomUUID();
        return new CaptureWorkflow(id, "wf", CaptureWorkflow.BindingKind.DATA_SET, "ds1",
                true, 1, NOW, NOW, null,
                List.of(new CaptureWorkflowStep(UUID.randomUUID(), id, 0, "s0",
                        CaptureWorkflowStep.OwnerRole.OPERATOR, null,
                        CaptureWorkflowStep.StepKind.CAPTURE, List.of())),
                List.of());
    }

    @Test
    void skipsOnNon2xx() throws Exception {
        final CaptureWorkflowService svc = mock(CaptureWorkflowService.class);
        final CaptureWorkflowContributionRepository repo =
                mock(CaptureWorkflowContributionRepository.class);
        newIngest(svc, repo).afterCompletion(
                req("/api/dataValueSets", "POST", "{}", "run-1", "0", null),
                resp(500), new Object(), null);
        verify(repo, never()).upsert(any());
    }

    @Test
    void skipsOnException() throws Exception {
        final CaptureWorkflowContributionRepository repo =
                mock(CaptureWorkflowContributionRepository.class);
        newIngest(mock(CaptureWorkflowService.class), repo).afterCompletion(
                req("/api/dataValueSets", "POST", "{}", "run-1", "0", null),
                resp(200), new Object(), new RuntimeException("fail"));
        verify(repo, never()).upsert(any());
    }

    @Test
    void skipsOnNonIngestPath() throws Exception {
        final CaptureWorkflowContributionRepository repo =
                mock(CaptureWorkflowContributionRepository.class);
        newIngest(mock(CaptureWorkflowService.class), repo).afterCompletion(
                req("/api/events", "POST", "{}", "run-1", "0", null),
                resp(200), new Object(), null);
        verify(repo, never()).upsert(any());
    }

    @Test
    void skipsWithoutHeaders() throws Exception {
        final CaptureWorkflowContributionRepository repo =
                mock(CaptureWorkflowContributionRepository.class);
        newIngest(mock(CaptureWorkflowService.class), repo).afterCompletion(
                req("/api/dataValueSets", "POST", "{\"dataSet\":\"ds1\"}", null, null, null),
                resp(200), new Object(), null);
        verify(repo, never()).upsert(any());
    }

    @Test
    void skipsOnMalformedStepHeader() throws Exception {
        final CaptureWorkflowContributionRepository repo =
                mock(CaptureWorkflowContributionRepository.class);
        newIngest(mock(CaptureWorkflowService.class), repo).afterCompletion(
                req("/api/dataValueSets", "POST", "{\"dataSet\":\"ds1\"}",
                        "run-1", "not-a-number", null),
                resp(200), new Object(), null);
        verify(repo, never()).upsert(any());
    }

    @Test
    void skipsWhenPayloadHasNoDataSet() throws Exception {
        final CaptureWorkflowContributionRepository repo =
                mock(CaptureWorkflowContributionRepository.class);
        newIngest(mock(CaptureWorkflowService.class), repo).afterCompletion(
                req("/api/dataValueSets", "POST", "{}", "run-1", "0", null),
                resp(200), new Object(), null);
        verify(repo, never()).upsert(any());
    }

    @Test
    void skipsWhenNoWorkflow() throws Exception {
        final CaptureWorkflowService svc = mock(CaptureWorkflowService.class);
        when(svc.resolveForDataSet("ds1")).thenReturn(Optional.empty());
        final CaptureWorkflowContributionRepository repo =
                mock(CaptureWorkflowContributionRepository.class);
        newIngest(svc, repo).afterCompletion(
                req("/api/dataValueSets", "POST", "{\"dataSet\":\"ds1\"}",
                        "run-1", "0", null),
                resp(200), new Object(), null);
        verify(repo, never()).upsert(any());
    }

    @Test
    void skipsOnUnknownOrdinal() throws Exception {
        final CaptureWorkflowService svc = mock(CaptureWorkflowService.class);
        when(svc.resolveForDataSet("ds1")).thenReturn(Optional.of(workflow()));
        final CaptureWorkflowContributionRepository repo =
                mock(CaptureWorkflowContributionRepository.class);
        newIngest(svc, repo).afterCompletion(
                req("/api/dataValueSets", "POST", "{\"dataSet\":\"ds1\"}",
                        "run-1", "99", null),
                resp(200), new Object(), null);
        verify(repo, never()).upsert(any());
    }

    @Test
    void persistsOnSuccess() throws Exception {
        final CaptureWorkflow w = workflow();
        final CaptureWorkflowService svc = mock(CaptureWorkflowService.class);
        when(svc.resolveForDataSet("ds1")).thenReturn(Optional.of(w));
        when(svc.startRun(any(UUID.class), any(String.class), any()))
                .thenReturn(new CaptureWorkflowRun(UUID.randomUUID(), w.workflowId(), 1,
                        "run-1", w.steps().get(0).stepId(),
                        CaptureWorkflowRun.State.OPEN, NOW, NOW, null));
        final CaptureWorkflowContributionRepository repo =
                mock(CaptureWorkflowContributionRepository.class);
        newIngest(svc, repo).afterCompletion(
                req("/api/dataValueSets", "POST", "{\"dataSet\":\"ds1\"}",
                        "run-1", "0", UUID.randomUUID().toString()),
                resp(200), new Object(), null);
        verify(repo).upsert(any(CaptureWorkflowContribution.class));
    }

    @Test
    void persistsOnSuccessWithMalformedDeviceHeader() throws Exception {
        final CaptureWorkflow w = workflow();
        final CaptureWorkflowService svc = mock(CaptureWorkflowService.class);
        when(svc.resolveForDataSet("ds1")).thenReturn(Optional.of(w));
        when(svc.startRun(any(UUID.class), any(String.class), any()))
                .thenReturn(new CaptureWorkflowRun(UUID.randomUUID(), w.workflowId(), 1,
                        "run-1", w.steps().get(0).stepId(),
                        CaptureWorkflowRun.State.OPEN, NOW, NOW, null));
        final CaptureWorkflowContributionRepository repo =
                mock(CaptureWorkflowContributionRepository.class);
        newIngest(svc, repo).afterCompletion(
                req("/api/dataValueSets", "POST", "{\"dataSet\":\"ds1\"}",
                        "run-1", "0", "bad-uuid"),
                resp(200), new Object(), null);
        verify(repo).upsert(any(CaptureWorkflowContribution.class));
    }

    @Test
    void failOpenOnRuntimeException() throws Exception {
        final CaptureWorkflowService svc = mock(CaptureWorkflowService.class);
        when(svc.resolveForDataSet("ds1")).thenThrow(new RuntimeException("db down"));
        final CaptureWorkflowContributionRepository repo =
                mock(CaptureWorkflowContributionRepository.class);
        // Should not propagate the exception; the handler is afterCompletion.
        newIngest(svc, repo).afterCompletion(
                req("/api/dataValueSets", "POST", "{\"dataSet\":\"ds1\"}",
                        "run-1", "0", null),
                resp(200), new Object(), null);
        verify(repo, never()).upsert(any());
    }

    @Test
    void failOpenOnRepoFailure() throws Exception {
        final CaptureWorkflow w = workflow();
        final CaptureWorkflowService svc = mock(CaptureWorkflowService.class);
        when(svc.resolveForDataSet("ds1")).thenReturn(Optional.of(w));
        when(svc.startRun(any(UUID.class), any(String.class), any()))
                .thenReturn(new CaptureWorkflowRun(UUID.randomUUID(), w.workflowId(), 1,
                        "run-1", w.steps().get(0).stepId(),
                        CaptureWorkflowRun.State.OPEN, NOW, NOW, null));
        final CaptureWorkflowContributionRepository repo =
                mock(CaptureWorkflowContributionRepository.class);
        doThrow(new RuntimeException("boom")).when(repo).upsert(any());
        newIngest(svc, repo).afterCompletion(
                req("/api/dataValueSets", "POST", "{\"dataSet\":\"ds1\"}",
                        "run-1", "0", null),
                resp(200), new Object(), null);
    }

    @Test
    void failOpenOnBodyIoError() throws Exception {
        final CaptureWorkflowService svc = mock(CaptureWorkflowService.class);
        final CaptureWorkflowContributionRepository repo =
                mock(CaptureWorkflowContributionRepository.class);
        final HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn("/api/dataValueSets");
        when(req.getMethod()).thenReturn("POST");
        when(req.getHeader("X-DER-Workflow-Run")).thenReturn("run-1");
        when(req.getHeader("X-DER-Workflow-Step")).thenReturn("0");
        when(req.getReader()).thenThrow(new java.io.IOException("io"));
        newIngest(svc, repo).afterCompletion(req, resp(200), new Object(), null);
        verify(repo, never()).upsert(any());
    }

    @Test
    void shouldIngestGuards() {
        assertThat(CaptureWorkflowContributionIngest.shouldIngest(null, "POST")).isFalse();
        assertThat(CaptureWorkflowContributionIngest.shouldIngest("/x", null)).isFalse();
        assertThat(CaptureWorkflowContributionIngest.shouldIngest("/api/dataValueSets", "GET"))
                .isFalse();
        assertThat(CaptureWorkflowContributionIngest.shouldIngest("/api/dataValueSets", "POST"))
                .isTrue();
        assertThat(CaptureWorkflowContributionIngest.shouldIngest("/api/events", "POST"))
                .isFalse();
    }
}
