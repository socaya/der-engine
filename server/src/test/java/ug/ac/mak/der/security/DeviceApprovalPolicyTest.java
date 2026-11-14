package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.ops.AdminSettingRepository;

class DeviceApprovalPolicyTest {

    private SecurityProperties props(final boolean fallback) {
        return new SecurityProperties(
                new SecurityProperties.Session(Duration.ofHours(1),
                        "DER_SESSION", false, "Strict", "s"),
                new SecurityProperties.SignIn(30, 10),
                new SecurityProperties.Bootstrap("", ""),
                new SecurityProperties.DeviceApproval(fallback));
    }

    private AdminSettingRepository.Entry entry(final String value) {
        return new AdminSettingRepository.Entry(
                "security.device-approval-required",
                value, UUID.randomUUID(), Instant.now());
    }

    @Test
    void initialisesFromFallbackWhenNoOverride() {
        final AdminSettingRepository repo = mock(AdminSettingRepository.class);
        when(repo.read(DeviceApprovalPolicy.SETTING_KEY))
                .thenReturn(Optional.empty());
        final DeviceApprovalPolicy p = new DeviceApprovalPolicy(repo, props(true));
        assertThat(p.required()).isTrue();
    }

    @Test
    void overrideTrueBeatsFalseFallback() {
        final AdminSettingRepository repo = mock(AdminSettingRepository.class);
        when(repo.read(DeviceApprovalPolicy.SETTING_KEY))
                .thenReturn(Optional.of(entry("true")));
        final DeviceApprovalPolicy p = new DeviceApprovalPolicy(repo, props(false));
        assertThat(p.required()).isTrue();
    }

    @Test
    void overrideFalseBeatsTrueFallback() {
        final AdminSettingRepository repo = mock(AdminSettingRepository.class);
        when(repo.read(DeviceApprovalPolicy.SETTING_KEY))
                .thenReturn(Optional.of(entry("false")));
        final DeviceApprovalPolicy p = new DeviceApprovalPolicy(repo, props(true));
        assertThat(p.required()).isFalse();
    }

    @Test
    void unparseableValueFallsBackToBaseline() {
        final AdminSettingRepository repo = mock(AdminSettingRepository.class);
        when(repo.read(DeviceApprovalPolicy.SETTING_KEY))
                .thenReturn(Optional.of(entry("maybe")));
        final DeviceApprovalPolicy p = new DeviceApprovalPolicy(repo, props(true));
        assertThat(p.required()).isTrue();
    }

    @Test
    void setPersistsAndUpdatesCache() {
        final AdminSettingRepository repo = mock(AdminSettingRepository.class);
        when(repo.read(DeviceApprovalPolicy.SETTING_KEY))
                .thenReturn(Optional.empty());
        final DeviceApprovalPolicy p = new DeviceApprovalPolicy(repo, props(true));
        final UUID adminId = UUID.randomUUID();
        p.set(false, adminId);
        assertThat(p.required()).isFalse();
        verify(repo).upsert(DeviceApprovalPolicy.SETTING_KEY, "false", adminId);
    }

    @Test
    void reloadPicksUpExternalChange() {
        final AdminSettingRepository repo = mock(AdminSettingRepository.class);
        when(repo.read(DeviceApprovalPolicy.SETTING_KEY))
                .thenReturn(Optional.of(entry("true")));
        final DeviceApprovalPolicy p = new DeviceApprovalPolicy(repo, props(true));
        assertThat(p.required()).isTrue();
        when(repo.read(DeviceApprovalPolicy.SETTING_KEY))
                .thenReturn(Optional.of(entry("false")));
        p.reload();
        assertThat(p.required()).isFalse();
    }
}
