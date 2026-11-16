package ug.ac.mak.der.dhis2emulator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;

class AppDataStoreControllerTest {

    private static EdgeUserPrincipal principal() {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op",
                EdgeUser.Origin.DHIS2, "x", false,
                EnumSet.of(EdgeRole.OPERATOR), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h",
                now, now, now.plusSeconds(3600), null, null, null);
        return new EdgeUserPrincipal(u, s);
    }

    @Test
    void readEmitsRawJsonFromRepo() {
        final var repo = mock(AppDataStoreRepository.class);
        when(repo.findValue("eregisters", "ui-config"))
                .thenReturn(Optional.of("{\"theme\":\"light\"}"));
        final var r = new AppDataStoreController(repo)
                .read(principal(), "eregisters", "ui-config");
        assertThat(r.getStatusCode().value()).isEqualTo(200);
        assertThat(r.getBody()).isEqualTo("{\"theme\":\"light\"}");
    }

    @Test
    void readMissingReturnsDhis2ShapedNotFound() {
        final var repo = mock(AppDataStoreRepository.class);
        when(repo.findValue("eregisters", "missing"))
                .thenReturn(Optional.empty());
        final var r = new AppDataStoreController(repo)
                .read(principal(), "eregisters", "missing");
        assertThat(r.getStatusCode().value()).isEqualTo(404);
        // Pin the DHIS2-shaped error body so the app's error
        // surface shows a readable message instead of "unknown
        // error" (same posture as MetadataListController#single).
        assertThat(String.valueOf(r.getBody()))
                .contains("NotFound")
                .contains("eregisters/missing")
                .contains("does not exist on this edge");
    }

    @Test
    void createReturns201AndUpserts() {
        final var repo = mock(AppDataStoreRepository.class);
        when(repo.exists("eregisters", "ui-config")).thenReturn(false);
        when(repo.upsert(anyString(), anyString(), anyString(), any()))
                .thenReturn(1);
        final var r = new AppDataStoreController(repo).create(
                principal(), "eregisters", "ui-config", "{\"v\":1}");
        assertThat(r.getStatusCode().value()).isEqualTo(201);
        verify(repo).upsert(eq("eregisters"), eq("ui-config"),
                eq("{\"v\":1}"), any());
    }

    @Test
    void createOnExistingKeyReturns409() {
        final var repo = mock(AppDataStoreRepository.class);
        when(repo.exists("eregisters", "ui-config")).thenReturn(true);
        final var r = new AppDataStoreController(repo).create(
                principal(), "eregisters", "ui-config", "{}");
        assertThat(r.getStatusCode().value()).isEqualTo(409);
    }

    @Test
    void putReplacesExistingValue() {
        final var repo = mock(AppDataStoreRepository.class);
        when(repo.exists("eregisters", "ui-config")).thenReturn(true);
        when(repo.upsert(anyString(), anyString(), anyString(), any()))
                .thenReturn(1);
        final var r = new AppDataStoreController(repo).update(
                principal(), "eregisters", "ui-config", "{\"v\":2}");
        assertThat(r.getStatusCode().value()).isEqualTo(200);
        verify(repo).upsert(eq("eregisters"), eq("ui-config"),
                eq("{\"v\":2}"), any());
    }

    @Test
    void putOnMissingKeyReturns404() {
        final var repo = mock(AppDataStoreRepository.class);
        when(repo.exists("eregisters", "missing")).thenReturn(false);
        final var r = new AppDataStoreController(repo).update(
                principal(), "eregisters", "missing", "{}");
        assertThat(r.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void deleteRemovesAndReturns200() {
        final var repo = mock(AppDataStoreRepository.class);
        when(repo.delete("eregisters", "ui-config")).thenReturn(1);
        final var r = new AppDataStoreController(repo).delete(
                principal(), "eregisters", "ui-config");
        assertThat(r.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void anonymousIsRejectedOnEveryMethod() {
        final var repo = mock(AppDataStoreRepository.class);
        final var c = new AppDataStoreController(repo);
        assertThat(c.listNamespaces(null).getStatusCode().value()).isEqualTo(401);
        assertThat(c.listKeys(null, "ns").getStatusCode().value()).isEqualTo(401);
        assertThat(c.read(null, "ns", "k").getStatusCode().value()).isEqualTo(401);
        assertThat(c.readMetadata(null, "ns", "k").getStatusCode().value()).isEqualTo(401);
        assertThat(c.create(null, "ns", "k", "{}").getStatusCode().value()).isEqualTo(401);
        assertThat(c.update(null, "ns", "k", "{}").getStatusCode().value()).isEqualTo(401);
        assertThat(c.delete(null, "ns", "k").getStatusCode().value()).isEqualTo(401);
        assertThat(c.deleteNamespace(null, "ns").getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void listKeysReturnsRepoOrder() {
        final var repo = mock(AppDataStoreRepository.class);
        when(repo.listKeys("eregisters")).thenReturn(List.of("ui-config", "stage-hierarchy"));
        final var r = new AppDataStoreController(repo)
                .listKeys(principal(), "eregisters");
        assertThat(r.getStatusCode().value()).isEqualTo(200);
        assertThat(r.getBody()).isEqualTo(List.of("ui-config", "stage-hierarchy"));
    }
}
