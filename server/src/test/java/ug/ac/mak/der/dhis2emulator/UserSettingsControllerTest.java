package ug.ac.mak.der.dhis2emulator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;

class UserSettingsControllerTest {

    private static EdgeUserPrincipal principal() {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "alice", "Alice",
                EdgeUser.Origin.DHIS2, "x", false,
                EnumSet.of(EdgeRole.OPERATOR), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h",
                now, now, now.plusSeconds(3600), null, null, null);
        return new EdgeUserPrincipal(u, s);
    }

    @Test
    void readAllReturnsMap() {
        final UserSettingsRepository repo = mock(UserSettingsRepository.class);
        final Map<String, String> settings = new LinkedHashMap<>();
        settings.put("keyFavourites", "a,b,c");
        when(repo.readAll(eq(principal().user().userId()))).thenReturn(Map.of());
        final var p = principal();
        when(repo.readAll(p.user().userId())).thenReturn(settings);
        final var res = new UserSettingsController(repo).readAll(p);
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(res.getBody()).containsEntry("keyFavourites", "a,b,c");
    }

    @Test
    void readAllIs401WhenUnauthenticated() {
        final ResponseEntity<Map<String, String>> res =
                new UserSettingsController(mock(UserSettingsRepository.class))
                        .readAll(null);
        assertThat(res.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void readSingleReturnsValue() {
        final UserSettingsRepository repo = mock(UserSettingsRepository.class);
        final var p = principal();
        when(repo.read(p.user().userId(), "keyDateFormat")).thenReturn("yyyy-MM-dd");
        final var res = new UserSettingsController(repo).read(p, "keyDateFormat");
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(res.getBody()).isEqualTo("yyyy-MM-dd");
    }

    @Test
    void readSingleReturns200WithEmptyBodyForUnknownAbsentKey() {
        // DHIS2 central returns 200 with the system-level default
        // when a per-user key isn't set. Our emulator mirrors that
        // contract — DHIS2 custom apps (eregisters, Capture) call
        // GET /api/userSettings/<key> on bootstrap and treat a
        // non-200 as "Failed to fetch user locale". Unknown keys
        // fall through to empty body, 200.
        final UserSettingsRepository repo = mock(UserSettingsRepository.class);
        final var p = principal();
        when(repo.read(p.user().userId(), "absent")).thenReturn(null);
        final var res = new UserSettingsController(repo).read(p, "absent");
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(res.getBody()).isEmpty();
    }

    @Test
    void readSingleFallsBackToDhis2DefaultForKnownLocaleKeys() {
        // The eregisters / Capture app-runtime treats a 404 on
        // /api/userSettings/keyUiLocale as a hard "Failed to fetch
        // user locale" error. Return DHIS2's documented default.
        final UserSettingsRepository repo = mock(UserSettingsRepository.class);
        final var p = principal();
        when(repo.read(p.user().userId(), "keyUiLocale")).thenReturn(null);
        final var res = new UserSettingsController(repo).read(p, "keyUiLocale");
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(res.getBody()).isEqualTo("en");
    }

    @Test
    void upsertAcceptsQueryValue() {
        final UserSettingsRepository repo = mock(UserSettingsRepository.class);
        final var p = principal();
        new UserSettingsController(repo).upsert(p, "keyTheme", "dark", null);
        verify(repo).upsert(p.user().userId(), "keyTheme", "dark");
    }

    @Test
    void upsertAcceptsBodyWhenQueryValueAbsent() {
        final UserSettingsRepository repo = mock(UserSettingsRepository.class);
        final var p = principal();
        new UserSettingsController(repo).upsert(p, "keyTheme", null, "light");
        verify(repo).upsert(p.user().userId(), "keyTheme", "light");
    }

    @Test
    void deleteCallsRepository() {
        final UserSettingsRepository repo = mock(UserSettingsRepository.class);
        final var p = principal();
        new UserSettingsController(repo).delete(p, "keyTheme");
        verify(repo).delete(p.user().userId(), "keyTheme");
    }
}
