package ug.ac.mak.der.device;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.security.PasswordHasher;

class DeviceServiceTest {

    private final Instant NOW = Instant.parse("2026-10-22T00:00:00Z");

    private EdgeDevice device(final UUID id, final EdgeDevice.Status status) {
        return new EdgeDevice(id, null, "h", NOW, null, null, NOW, "ua", null, status);
    }

    @Test
    void listDelegates() {
        final EdgeDeviceRepository repo = mock(EdgeDeviceRepository.class);
        when(repo.findAll()).thenReturn(List.of());
        assertThat(new DeviceService(repo, mock(PasswordHasher.class)).list()).isEmpty();
    }

    @Test
    void getDelegates() {
        final EdgeDeviceRepository repo = mock(EdgeDeviceRepository.class);
        final UUID id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.of(device(id, EdgeDevice.Status.PENDING)));
        assertThat(new DeviceService(repo, mock(PasswordHasher.class)).get(id)).isPresent();
    }

    @Test
    void enrolHashesToken() {
        final EdgeDeviceRepository repo = mock(EdgeDeviceRepository.class);
        final PasswordHasher hasher = mock(PasswordHasher.class);
        when(hasher.hash(anyString())).thenReturn("hashed");
        final UUID id = UUID.randomUUID();
        when(repo.upsertEnrol(eq(id), any(), anyString(), eq("hashed")))
                .thenReturn(device(id, EdgeDevice.Status.PENDING));
        final DeviceService.EnrolResult r = new DeviceService(repo, hasher)
                .enrol(id, UUID.randomUUID(), "chrome");
        assertThat(r.device().deviceId()).isEqualTo(id);
        assertThat(r.enrolmentToken()).isNotBlank();
        verify(hasher).hash(anyString());
    }

    @Test
    void approveHappy() {
        final EdgeDeviceRepository repo = mock(EdgeDeviceRepository.class);
        final UUID id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.of(device(id, EdgeDevice.Status.PENDING)));
        when(repo.updateStatus(eq(id), eq(EdgeDevice.Status.APPROVED), any())).thenReturn(1);
        assertThat(new DeviceService(repo, mock(PasswordHasher.class))
                .approve(id, UUID.randomUUID())).isEqualTo(DeviceService.Outcome.OK);
    }

    @Test
    void approveRejectedWhenRevoked() {
        final EdgeDeviceRepository repo = mock(EdgeDeviceRepository.class);
        final UUID id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.of(device(id, EdgeDevice.Status.REVOKED)));
        assertThat(new DeviceService(repo, mock(PasswordHasher.class))
                .approve(id, UUID.randomUUID()))
                .isEqualTo(DeviceService.Outcome.REVOKED_IS_TERMINAL);
    }

    @Test
    void approveNotFound() {
        final EdgeDeviceRepository repo = mock(EdgeDeviceRepository.class);
        when(repo.findById(any())).thenReturn(Optional.empty());
        assertThat(new DeviceService(repo, mock(PasswordHasher.class))
                .approve(UUID.randomUUID(), UUID.randomUUID()))
                .isEqualTo(DeviceService.Outcome.NOT_FOUND);
    }

    @Test
    void suspendUsesSameTransitionGuard() {
        final EdgeDeviceRepository repo = mock(EdgeDeviceRepository.class);
        final UUID id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.of(device(id, EdgeDevice.Status.REVOKED)));
        assertThat(new DeviceService(repo, mock(PasswordHasher.class))
                .suspend(id, UUID.randomUUID()))
                .isEqualTo(DeviceService.Outcome.REVOKED_IS_TERMINAL);
    }

    @Test
    void revokeAllowedFromAnyState() {
        final EdgeDeviceRepository repo = mock(EdgeDeviceRepository.class);
        final UUID id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.of(device(id, EdgeDevice.Status.APPROVED)));
        when(repo.updateStatus(eq(id), eq(EdgeDevice.Status.REVOKED), any())).thenReturn(1);
        assertThat(new DeviceService(repo, mock(PasswordHasher.class))
                .revoke(id, UUID.randomUUID())).isEqualTo(DeviceService.Outcome.OK);
    }

    @Test
    void transitionReturnsNotFoundWhenUpdateAffectsZero() {
        final EdgeDeviceRepository repo = mock(EdgeDeviceRepository.class);
        final UUID id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.of(device(id, EdgeDevice.Status.PENDING)));
        when(repo.updateStatus(eq(id), eq(EdgeDevice.Status.APPROVED), any())).thenReturn(0);
        assertThat(new DeviceService(repo, mock(PasswordHasher.class))
                .approve(id, UUID.randomUUID())).isEqualTo(DeviceService.Outcome.NOT_FOUND);
    }

    @Test
    void heartbeatOk() {
        final EdgeDeviceRepository repo = mock(EdgeDeviceRepository.class);
        final UUID id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.of(device(id, EdgeDevice.Status.APPROVED)));
        when(repo.heartbeat(id)).thenReturn(1);
        assertThat(new DeviceService(repo, mock(PasswordHasher.class)).heartbeat(id))
                .isEqualTo(DeviceService.HeartbeatOutcome.OK);
    }

    @Test
    void heartbeatRevoked() {
        final EdgeDeviceRepository repo = mock(EdgeDeviceRepository.class);
        final UUID id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.of(device(id, EdgeDevice.Status.REVOKED)));
        assertThat(new DeviceService(repo, mock(PasswordHasher.class)).heartbeat(id))
                .isEqualTo(DeviceService.HeartbeatOutcome.REVOKED);
    }

    @Test
    void heartbeatNotFound() {
        final EdgeDeviceRepository repo = mock(EdgeDeviceRepository.class);
        when(repo.findById(any())).thenReturn(Optional.empty());
        assertThat(new DeviceService(repo, mock(PasswordHasher.class))
                .heartbeat(UUID.randomUUID()))
                .isEqualTo(DeviceService.HeartbeatOutcome.NOT_FOUND);
    }

    @Test
    void deleteDelegates() {
        final EdgeDeviceRepository repo = mock(EdgeDeviceRepository.class);
        when(repo.delete(any())).thenReturn(1);
        assertThat(new DeviceService(repo, mock(PasswordHasher.class))
                .delete(UUID.randomUUID())).isEqualTo(1);
    }
}
