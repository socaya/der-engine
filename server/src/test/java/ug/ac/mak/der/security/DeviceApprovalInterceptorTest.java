package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import ug.ac.mak.der.network.NetworkEntities;
import ug.ac.mak.der.network.NetworkEntities.ClientLink;
import ug.ac.mak.der.network.NetworkEntities.ClientTrust;
import ug.ac.mak.der.network.NetworkEntities.NetworkClient;
import ug.ac.mak.der.network.NetworkRepository;

class DeviceApprovalInterceptorTest {

    private static final Clock CLOCK = Clock.fixed(
            Instant.parse("2026-11-14T10:00:00Z"), ZoneOffset.UTC);

    private NetworkClient client(final String id, final ClientTrust trust) {
        return new NetworkClient(id, UUID.randomUUID(), "owner", "host",
                "10.0.0.5", "mac", ClientLink.wifi, -50,
                trust, "fp", 0L, 0L,
                Instant.now(CLOCK), Instant.now(CLOCK),
                null, trust == ClientTrust.APPROVED ? Instant.now(CLOCK) : null, null,
                null, null);
    }

    private DeviceApprovalPolicy policy(final boolean required) {
        final DeviceApprovalPolicy p = mock(DeviceApprovalPolicy.class);
        when(p.required()).thenReturn(required);
        return p;
    }

    private DeviceApprovalInterceptor interceptor(
            final boolean required,
            final NetworkRepository repo,
            final SecurityAuditRepository audit) {
        return new DeviceApprovalInterceptor(
                repo, policy(required), audit, new ObjectMapper(), CLOCK);
    }

    private MockHttpServletRequest req(final String path) {
        final MockHttpServletRequest r = new MockHttpServletRequest();
        r.setRequestURI(path);
        r.setMethod("GET");
        return r;
    }

    @Test
    void permissiveModeAllowsEverything() throws Exception {
        final NetworkRepository repo = mock(NetworkRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final DeviceApprovalInterceptor i = interceptor(false, repo, audit);
        final HttpServletResponse resp = new MockHttpServletResponse();
        assertThat(i.preHandle(req("/edge-api/v1/apps"), resp, new Object())).isTrue();
        verify(repo, never()).findClient(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void strictModeAllowsApprovedDevice() throws Exception {
        final NetworkRepository repo = mock(NetworkRepository.class);
        when(repo.findClient("d1")).thenReturn(Optional.of(
                client("d1", ClientTrust.APPROVED)));
        final DeviceApprovalInterceptor i = interceptor(true, repo,
                mock(SecurityAuditRepository.class));
        final MockHttpServletRequest r = req("/edge-api/v1/apps");
        r.addHeader("X-DER-Device-Id", "d1");
        assertThat(i.preHandle(r, new MockHttpServletResponse(), new Object()))
                .isTrue();
    }

    @Test
    void strictModeRejectsPendingDevice() throws Exception {
        final NetworkRepository repo = mock(NetworkRepository.class);
        when(repo.findClient("d1")).thenReturn(Optional.of(
                client("d1", ClientTrust.PENDING)));
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final DeviceApprovalInterceptor i = interceptor(true, repo, audit);
        final MockHttpServletRequest r = req("/edge-api/v1/apps");
        r.addHeader("X-DER-Device-Id", "d1");
        final MockHttpServletResponse resp = new MockHttpServletResponse();
        assertThat(i.preHandle(r, resp, new Object())).isFalse();
        assertThat(resp.getStatus()).isEqualTo(403);
        assertThat(resp.getContentAsString()).contains("DEVICE_NOT_APPROVED");
        verify(audit).append(org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(Instant.class));
    }

    @Test
    void strictModeRejectsRevokedDevice() throws Exception {
        final NetworkRepository repo = mock(NetworkRepository.class);
        when(repo.findClient("d1")).thenReturn(Optional.of(
                client("d1", ClientTrust.REVOKED)));
        final DeviceApprovalInterceptor i = interceptor(true, repo,
                mock(SecurityAuditRepository.class));
        final MockHttpServletRequest r = req("/edge-api/v1/apps");
        r.addHeader("X-DER-Device-Id", "d1");
        final MockHttpServletResponse resp = new MockHttpServletResponse();
        assertThat(i.preHandle(r, resp, new Object())).isFalse();
        assertThat(resp.getStatus()).isEqualTo(403);
        assertThat(resp.getContentAsString()).contains("REVOKED");
    }

    @Test
    void strictModeRejectsUnenrolledDevice() throws Exception {
        final NetworkRepository repo = mock(NetworkRepository.class);
        when(repo.findClient("d-unknown")).thenReturn(Optional.empty());
        final DeviceApprovalInterceptor i = interceptor(true, repo,
                mock(SecurityAuditRepository.class));
        final MockHttpServletRequest r = req("/edge-api/v1/apps");
        r.addHeader("X-DER-Device-Id", "d-unknown");
        final MockHttpServletResponse resp = new MockHttpServletResponse();
        assertThat(i.preHandle(r, resp, new Object())).isFalse();
        assertThat(resp.getStatus()).isEqualTo(403);
        assertThat(resp.getContentAsString()).contains("UNENROLLED");
    }

    @Test
    void strictModeRejectsRequestWithoutDeviceHeader() throws Exception {
        final NetworkRepository repo = mock(NetworkRepository.class);
        final DeviceApprovalInterceptor i = interceptor(true, repo,
                mock(SecurityAuditRepository.class));
        final MockHttpServletResponse resp = new MockHttpServletResponse();
        assertThat(i.preHandle(req("/edge-api/v1/apps"), resp, new Object()))
                .isFalse();
        assertThat(resp.getStatus()).isEqualTo(403);
        assertThat(resp.getContentAsString()).contains("DEVICE_HEADER_REQUIRED");
        verify(repo, never()).findClient(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void exemptPathBypassesCheckEvenInStrictMode() throws Exception {
        final NetworkRepository repo = mock(NetworkRepository.class);
        final DeviceApprovalInterceptor i = interceptor(true, repo,
                mock(SecurityAuditRepository.class));
        for (final String exempt : new String[] {
                "/edge-api/v1/auth/sign-in",
                "/edge-api/v1/apps/signing-key",
                "/edge-api/v1/devices/enrol",
                "/edge-api/v1/system/health",
                "/api/system/info",
                "/api/me"}) {
            assertThat(i.preHandle(req(exempt),
                    new MockHttpServletResponse(), new Object()))
                    .as("path %s should be exempt", exempt)
                    .isTrue();
        }
        verify(repo, never()).findClient(org.mockito.ArgumentMatchers.anyString());
    }
}
