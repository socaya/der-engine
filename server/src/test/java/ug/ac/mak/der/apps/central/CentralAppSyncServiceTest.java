package ug.ac.mak.der.apps.central;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.apps.AppCatalogueController;
import ug.ac.mak.der.apps.InstalledApp;
import ug.ac.mak.der.apps.InstalledAppRepository;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;

class CentralAppSyncServiceTest {

    private CentralAppClient client;
    private AppCatalogueController catalogue;
    private InstalledAppRepository installedApps;
    private CentralAppSyncRunRepository runs;
    private SecurityAuditRepository audit;

    @BeforeEach
    void setUp() {
        client = mock(CentralAppClient.class);
        catalogue = mock(AppCatalogueController.class);
        installedApps = mock(InstalledAppRepository.class);
        runs = mock(CentralAppSyncRunRepository.class);
        audit = mock(SecurityAuditRepository.class);
        when(runs.insertStarted(anyBoolean(), any())).thenReturn(UUID.randomUUID());
    }

    private CentralAppSyncService service(final boolean enabled) {
        return new CentralAppSyncService(client, catalogue, installedApps,
                runs, audit, enabled);
    }

    private static InstalledApp local(final String key, final String version) {
        return new InstalledApp(UUID.randomUUID(), key, version, key,
                "{}", "db://" + key,
                UUID.randomUUID(), Instant.now(), true,
                InstalledApp.HostKind.DER_ESM,
                InstalledApp.Source.MANUAL_UPLOAD,
                InstalledApp.TrustLevel.SIGNED,
                null, null);
    }

    @Test
    void returnsSkippedWhenCentralNotConfigured() {
        when(client.centralConfigured()).thenReturn(false);
        final var r = service(true).sync(false, UUID.randomUUID());
        assertThat(r.outcome()).isEqualTo("SKIPPED");
        assertThat(r.message()).contains("not configured");
    }

    @Test
    void returnsFailedWhenListAppsThrows() throws IOException {
        when(client.centralConfigured()).thenReturn(true);
        when(client.listApps()).thenThrow(new IOException("boom"));
        final var r = service(true).sync(false, UUID.randomUUID());
        assertThat(r.outcome()).isEqualTo("FAILED");
    }

    @Test
    void dryRunCountsCandidatesWithoutInstalling() throws Exception {
        when(client.centralConfigured()).thenReturn(true);
        when(client.listApps()).thenReturn(List.of(
                new CentralApp("new-app", "New App", "1.0", "url", null),
                new CentralApp("existing", "Existing", "2.0", "url", null),
                new CentralApp("same", "Same", "3.0", "url", null)));
        when(installedApps.findByKey("new-app")).thenReturn(Optional.empty());
        when(installedApps.findByKey("existing")).thenReturn(Optional.of(local("existing", "1.0")));
        when(installedApps.findByKey("same")).thenReturn(Optional.of(local("same", "3.0")));

        final var r = service(true).sync(true, UUID.randomUUID());
        assertThat(r.outcome()).isEqualTo("OK");
        assertThat(r.counters().discovered()).isEqualTo(3);
        assertThat(r.counters().installed()).isEqualTo(1);
        assertThat(r.counters().updated()).isEqualTo(1);
        assertThat(r.counters().skipped()).isEqualTo(1);
        verify(catalogue, never()).installZipBytesForSync(any(), any(), any());
        verify(audit, never()).append(any(), any());
    }

    @Test
    void liveRunInstallsNewAppAndAudits() throws Exception {
        when(client.centralConfigured()).thenReturn(true);
        when(client.listApps()).thenReturn(List.of(
                new CentralApp("new-app", "New App", "1.0", "/download/new-app", null)));
        when(installedApps.findByKey("new-app")).thenReturn(Optional.empty());
        when(client.fetchBundle("/download/new-app")).thenReturn(new byte[]{1, 2, 3});
        when(catalogue.installZipBytesForSync(any(), eq("new-app"), any()))
                .thenReturn(Map.of("version", "1.0"));

        final UUID actor = UUID.randomUUID();
        final var r = service(true).sync(false, actor);
        assertThat(r.outcome()).isEqualTo("OK");
        assertThat(r.counters().installed()).isEqualTo(1);
        verify(audit).append(
                argThat((AuditEvent e) ->
                        "APP_INSTALLED_FROM_CENTRAL".equals(e.eventType())
                                && e.outcome() == AuditEvent.Outcome.SUCCESS
                                && actor.equals(e.actorUserId())
                                && "new-app".equals(e.detail().get("centralAppId"))),
                any());
    }

    @Test
    void failedInstallRecordsFailurePartialOutcome() throws Exception {
        when(client.centralConfigured()).thenReturn(true);
        when(client.listApps()).thenReturn(List.of(
                new CentralApp("good", "Good", "1.0", "/g", null),
                new CentralApp("bad", "Bad", "1.0", "/b", null)));
        when(installedApps.findByKey("good")).thenReturn(Optional.empty());
        when(installedApps.findByKey("bad")).thenReturn(Optional.empty());
        when(client.fetchBundle("/g")).thenReturn(new byte[]{1});
        when(client.fetchBundle("/b")).thenThrow(new IOException("504"));
        when(catalogue.installZipBytesForSync(any(), eq("good"), any()))
                .thenReturn(Map.of("version", "1.0"));

        final var r = service(true).sync(false, UUID.randomUUID());
        assertThat(r.outcome()).isEqualTo("PARTIAL");
        assertThat(r.counters().installed()).isEqualTo(1);
        assertThat(r.counters().failed()).isEqualTo(1);
    }

    @Test
    void candidateWithNullDownloadUrlIsCountedAsFailedNotCrash() throws Exception {
        when(client.centralConfigured()).thenReturn(true);
        when(client.listApps()).thenReturn(List.of(
                new CentralApp("no-url", "No URL", "1.0", null, null)));
        when(installedApps.findByKey("no-url")).thenReturn(Optional.empty());
        final var r = service(true).sync(false, UUID.randomUUID());
        assertThat(r.outcome()).isEqualTo("FAILED");
        assertThat(r.counters().failed()).isEqualTo(1);
    }

    @Test
    void scheduledRunNoopsWhenDisabled() {
        service(false).runOnSchedule();
        verify(runs, never()).insertStarted(anyBoolean(), any());
    }

    @Test
    void scheduledRunExecutesWhenEnabled() {
        when(client.centralConfigured()).thenReturn(true);
        try {
            when(client.listApps()).thenReturn(List.of());
        } catch (IOException ex) {
            throw new IllegalStateException(ex);
        }
        service(true).runOnSchedule();
        verify(runs).insertStarted(eq(false), eq(null));
    }
}
