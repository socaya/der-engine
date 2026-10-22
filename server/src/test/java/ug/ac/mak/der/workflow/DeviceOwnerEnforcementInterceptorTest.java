package ug.ac.mak.der.workflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.BufferedReader;
import java.io.PrintWriter;
import java.io.StringReader;
import java.io.StringWriter;
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

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;

class DeviceOwnerEnforcementInterceptorTest {

    private static final Instant NOW = Instant.parse("2026-10-22T00:00:00Z");

    private DeviceOwnerEnforcementInterceptor newInterceptor(final CaptureWorkflowService svc,
                                                              final SecurityAuditRepository audit) {
        return new DeviceOwnerEnforcementInterceptor(svc, audit, new ObjectMapper(),
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private HttpServletRequest req(final String path, final String method, final String body,
                                     final String deviceHeader) throws Exception {
        final HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn(path);
        when(req.getMethod()).thenReturn(method);
        when(req.getReader()).thenReturn(new BufferedReader(new StringReader(body == null ? "" : body)));
        when(req.getHeader("X-DER-Device-Id")).thenReturn(deviceHeader);
        when(req.getHeader("User-Agent")).thenReturn("ua");
        when(req.getRemoteAddr()).thenReturn("127.0.0.1");
        return req;
    }

    private HttpServletResponse resp(final StringWriter out) throws Exception {
        final HttpServletResponse resp = mock(HttpServletResponse.class);
        when(resp.getWriter()).thenReturn(new PrintWriter(out));
        return resp;
    }

    private CaptureWorkflow workflow(final UUID stepDevice) {
        final UUID id = UUID.randomUUID();
        return new CaptureWorkflow(id, "wf", CaptureWorkflow.BindingKind.DATA_SET, "ds1",
                true, 1, NOW, NOW, null,
                List.of(new CaptureWorkflowStep(UUID.randomUUID(), id, 0, "s0",
                        CaptureWorkflowStep.OwnerRole.OPERATOR, stepDevice,
                        CaptureWorkflowStep.StepKind.CAPTURE, List.of())),
                List.of());
    }

    @Test
    void allowsNonPost() throws Exception {
        final CaptureWorkflowService svc = mock(CaptureWorkflowService.class);
        final DeviceOwnerEnforcementInterceptor i = newInterceptor(svc,
                mock(SecurityAuditRepository.class));
        assertThat(i.preHandle(req("/api/dataValueSets", "GET", "", null),
                mock(HttpServletResponse.class), new Object())).isTrue();
    }

    @Test
    void allowsNonGuardedPath() throws Exception {
        final DeviceOwnerEnforcementInterceptor i = newInterceptor(
                mock(CaptureWorkflowService.class), mock(SecurityAuditRepository.class));
        assertThat(i.preHandle(req("/api/events", "POST", "{}", null),
                mock(HttpServletResponse.class), new Object())).isTrue();
    }

    @Test
    void allowsNullPath() {
        assertThat(DeviceOwnerEnforcementInterceptor.shouldGuard(null)).isFalse();
    }

    @Test
    void allowsRequestWithoutDataSet() throws Exception {
        final DeviceOwnerEnforcementInterceptor i = newInterceptor(
                mock(CaptureWorkflowService.class), mock(SecurityAuditRepository.class));
        assertThat(i.preHandle(req("/api/dataValueSets", "POST", "{\"foo\":1}", null),
                mock(HttpServletResponse.class), new Object())).isTrue();
    }

    @Test
    void allowsRequestWhenNoWorkflowApplies() throws Exception {
        final CaptureWorkflowService svc = mock(CaptureWorkflowService.class);
        when(svc.resolveForDataSet("ds1")).thenReturn(Optional.empty());
        final DeviceOwnerEnforcementInterceptor i = newInterceptor(svc,
                mock(SecurityAuditRepository.class));
        assertThat(i.preHandle(req("/api/dataValueSets", "POST", "{\"dataSet\":\"ds1\"}", null),
                mock(HttpServletResponse.class), new Object())).isTrue();
    }

    @Test
    void allowsWorkflowWithoutDeviceOwnedStep() throws Exception {
        final CaptureWorkflowService svc = mock(CaptureWorkflowService.class);
        when(svc.resolveForDataSet("ds1")).thenReturn(Optional.of(workflow(null)));
        final DeviceOwnerEnforcementInterceptor i = newInterceptor(svc,
                mock(SecurityAuditRepository.class));
        assertThat(i.preHandle(req("/api/dataValueSets", "POST", "{\"dataSet\":\"ds1\"}", null),
                mock(HttpServletResponse.class), new Object())).isTrue();
    }

    @Test
    void failsOpenWhenLookupThrows() throws Exception {
        final CaptureWorkflowService svc = mock(CaptureWorkflowService.class);
        when(svc.resolveForDataSet("ds1")).thenThrow(new RuntimeException("db down"));
        final DeviceOwnerEnforcementInterceptor i = newInterceptor(svc,
                mock(SecurityAuditRepository.class));
        assertThat(i.preHandle(req("/api/dataValueSets", "POST", "{\"dataSet\":\"ds1\"}", null),
                mock(HttpServletResponse.class), new Object())).isTrue();
    }

    @Test
    void rejectsMissingHeader() throws Exception {
        final CaptureWorkflowService svc = mock(CaptureWorkflowService.class);
        when(svc.resolveForDataSet("ds1")).thenReturn(Optional.of(workflow(UUID.randomUUID())));
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final DeviceOwnerEnforcementInterceptor i = newInterceptor(svc, audit);
        final StringWriter out = new StringWriter();
        assertThat(i.preHandle(req("/api/dataValueSets", "POST", "{\"dataSet\":\"ds1\"}", null),
                resp(out), new Object())).isFalse();
        verify(audit).append(any(AuditEvent.class), any(Instant.class));
        assertThat(out.toString()).contains("MISSING_DEVICE_HEADER");
    }

    @Test
    void rejectsMalformedHeader() throws Exception {
        final CaptureWorkflowService svc = mock(CaptureWorkflowService.class);
        when(svc.resolveForDataSet("ds1")).thenReturn(Optional.of(workflow(UUID.randomUUID())));
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final DeviceOwnerEnforcementInterceptor i = newInterceptor(svc, audit);
        final StringWriter out = new StringWriter();
        assertThat(i.preHandle(req("/api/dataValueSets", "POST",
                "{\"dataSet\":\"ds1\"}", "not-a-uuid"), resp(out), new Object())).isFalse();
        assertThat(out.toString()).contains("DEVICE_OWNER_MISMATCH");
    }

    @Test
    void rejectsNonOwnerDevice() throws Exception {
        final UUID owner = UUID.randomUUID();
        final UUID other = UUID.randomUUID();
        final CaptureWorkflowService svc = mock(CaptureWorkflowService.class);
        when(svc.resolveForDataSet("ds1")).thenReturn(Optional.of(workflow(owner)));
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final DeviceOwnerEnforcementInterceptor i = newInterceptor(svc, audit);
        final StringWriter out = new StringWriter();
        assertThat(i.preHandle(req("/api/dataValueSets", "POST",
                "{\"dataSet\":\"ds1\"}", other.toString()), resp(out), new Object())).isFalse();
        assertThat(out.toString()).contains("DEVICE_OWNER_MISMATCH");
    }

    @Test
    void allowsOwnerDevice() throws Exception {
        final UUID owner = UUID.randomUUID();
        final CaptureWorkflowService svc = mock(CaptureWorkflowService.class);
        when(svc.resolveForDataSet("ds1")).thenReturn(Optional.of(workflow(owner)));
        final DeviceOwnerEnforcementInterceptor i = newInterceptor(svc,
                mock(SecurityAuditRepository.class));
        assertThat(i.preHandle(req("/api/dataValueSets", "POST",
                "{\"dataSet\":\"ds1\"}", owner.toString()),
                mock(HttpServletResponse.class), new Object())).isTrue();
    }

    @Test
    void auditAppendFailureIsSwallowed() throws Exception {
        final CaptureWorkflowService svc = mock(CaptureWorkflowService.class);
        when(svc.resolveForDataSet("ds1")).thenReturn(Optional.of(workflow(UUID.randomUUID())));
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        doThrow(new RuntimeException("audit down")).when(audit)
                .append(any(AuditEvent.class), any(Instant.class));
        final DeviceOwnerEnforcementInterceptor i = newInterceptor(svc, audit);
        final StringWriter out = new StringWriter();
        assertThat(i.preHandle(req("/api/dataValueSets", "POST",
                "{\"dataSet\":\"ds1\"}", null), resp(out), new Object())).isFalse();
    }

    @Test
    void sniffsProgramStageBeforeProgram() throws Exception {
        final UUID owner = UUID.randomUUID();
        final CaptureWorkflowService svc = mock(CaptureWorkflowService.class);
        when(svc.resolveForProgramStage("ps1")).thenReturn(Optional.of(workflow(owner)));
        final DeviceOwnerEnforcementInterceptor i = newInterceptor(svc,
                mock(SecurityAuditRepository.class));
        assertThat(i.preHandle(req("/api/events", "POST",
                "{\"programStage\":\"ps1\",\"program\":\"p1\"}", owner.toString()),
                mock(HttpServletResponse.class), new Object())).isTrue();
    }

    @Test
    void sniffsProgramWhenNoStageMatches() throws Exception {
        final UUID owner = UUID.randomUUID();
        final CaptureWorkflowService svc = mock(CaptureWorkflowService.class);
        when(svc.resolveForProgramStage("ps1")).thenReturn(Optional.empty());
        when(svc.resolveForProgram("p1")).thenReturn(Optional.of(workflow(owner)));
        final DeviceOwnerEnforcementInterceptor i = newInterceptor(svc,
                mock(SecurityAuditRepository.class));
        assertThat(i.preHandle(req("/api/events", "POST",
                "{\"programStage\":\"ps1\",\"program\":\"p1\"}", owner.toString()),
                mock(HttpServletResponse.class), new Object())).isTrue();
    }

    @Test
    void guardsTrackerEvents() {
        assertThat(DeviceOwnerEnforcementInterceptor.shouldGuard("/api/tracker/events")).isTrue();
        assertThat(DeviceOwnerEnforcementInterceptor.shouldGuard("/api/tracker/enrollments"))
                .isTrue();
        assertThat(DeviceOwnerEnforcementInterceptor.shouldGuard("/api/events")).isTrue();
    }

    @Test
    void malformedBodyIsNoOp() throws Exception {
        final CaptureWorkflowService svc = mock(CaptureWorkflowService.class);
        final DeviceOwnerEnforcementInterceptor i = newInterceptor(svc,
                mock(SecurityAuditRepository.class));
        final HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn("/api/dataValueSets");
        when(req.getMethod()).thenReturn("POST");
        when(req.getReader()).thenThrow(new java.io.IOException("io"));
        assertThat(i.preHandle(req, mock(HttpServletResponse.class), new Object())).isTrue();
    }
}
