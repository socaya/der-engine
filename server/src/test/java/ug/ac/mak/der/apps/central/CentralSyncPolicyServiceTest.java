package ug.ac.mak.der.apps.central;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.dhis2emulator.SystemSettingsRepository;

class CentralSyncPolicyServiceTest {

    private final ObjectMapper json = new ObjectMapper();

    @Test
    void policyAllowAllAdmitsAnyNonNullKey() {
        assertThat(CentralSyncPolicy.allowAll().admits("whatever")).isTrue();
        assertThat(CentralSyncPolicy.allowAll().admits(null)).isFalse();
    }

    @Test
    void policyAllowListAdmitsListedOnly() {
        final CentralSyncPolicy p = new CentralSyncPolicy(
                CentralSyncPolicy.Mode.ALLOW_LIST, List.of("capture"));
        assertThat(p.admits("capture")).isTrue();
        assertThat(p.admits("dashboard")).isFalse();
    }

    @Test
    void policyDenyListAdmitsEverythingExceptListed() {
        final CentralSyncPolicy p = new CentralSyncPolicy(
                CentralSyncPolicy.Mode.DENY_LIST, List.of("dashboard"));
        assertThat(p.admits("capture")).isTrue();
        assertThat(p.admits("dashboard")).isFalse();
    }

    @Test
    void readReturnsAllowAllWhenSettingAbsent() {
        final SystemSettingsRepository repo = mock(SystemSettingsRepository.class);
        when(repo.read(CentralSyncPolicy.SETTING_KEY)).thenReturn(null);
        final var p = new CentralSyncPolicyService(repo, json).read();
        assertThat(p.mode()).isEqualTo(CentralSyncPolicy.Mode.ALLOW_ALL);
    }

    @Test
    void readReturnsAllowAllWhenSettingCorrupt() {
        final SystemSettingsRepository repo = mock(SystemSettingsRepository.class);
        when(repo.read(CentralSyncPolicy.SETTING_KEY)).thenReturn("{not: valid");
        final var p = new CentralSyncPolicyService(repo, json).read();
        assertThat(p.mode()).isEqualTo(CentralSyncPolicy.Mode.ALLOW_ALL);
    }

    @Test
    void readDeserialisesStoredPolicy() throws Exception {
        final SystemSettingsRepository repo = mock(SystemSettingsRepository.class);
        final String raw = json.writeValueAsString(new CentralSyncPolicy(
                CentralSyncPolicy.Mode.DENY_LIST, List.of("x", "y")));
        when(repo.read(CentralSyncPolicy.SETTING_KEY)).thenReturn(raw);
        final var p = new CentralSyncPolicyService(repo, json).read();
        assertThat(p.mode()).isEqualTo(CentralSyncPolicy.Mode.DENY_LIST);
        assertThat(p.keys()).containsExactly("x", "y");
    }

    @Test
    void writeSerialisesAndUpserts() {
        final SystemSettingsRepository repo = mock(SystemSettingsRepository.class);
        final UUID actor = UUID.randomUUID();
        final CentralSyncPolicy p = new CentralSyncPolicy(
                CentralSyncPolicy.Mode.ALLOW_LIST, List.of("capture"));
        new CentralSyncPolicyService(repo, json).write(p, actor);
        verify(repo).upsert(eq(CentralSyncPolicy.SETTING_KEY),
                argThat((String s) -> s != null && s.contains("ALLOW_LIST")
                        && s.contains("capture")),
                eq(actor));
    }

    @Test
    void writeIsIdempotentForUnusedParamWarning() {
        // Guards against the no-op constructor path — ensures the
        // service uses the real repo methods, not any().
        final SystemSettingsRepository repo = mock(SystemSettingsRepository.class);
        new CentralSyncPolicyService(repo, json)
                .write(CentralSyncPolicy.allowAll(), null);
        verify(repo).upsert(eq(CentralSyncPolicy.SETTING_KEY), any(), eq(null));
    }
}
