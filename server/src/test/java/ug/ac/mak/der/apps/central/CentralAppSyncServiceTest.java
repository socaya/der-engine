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
    private CentralSyncPolicyService policies;
    private CentralSigningVerifier verifier;
    private ug.ac.mak.der.dhis2emulator.SystemSettingsRepository systemSettings;

    @BeforeEach
    void setUp() {
        client = mock(CentralAppClient.class);
        catalogue = mock(AppCatalogueController.class);
        installedApps = mock(InstalledAppRepository.class);
        runs = mock(CentralAppSyncRunRepository.class);
        audit = mock(SecurityAuditRepository.class);
        policies = mock(CentralSyncPolicyService.class);
        verifier = mock(CentralSigningVerifier.class);
        systemSettings = mock(ug.ac.mak.der.dhis2emulator.SystemSettingsRepository.class);
        when(runs.insertStarted(anyBoolean(), any())).thenReturn(UUID.randomUUID());
        when(policies.read()).thenReturn(CentralSyncPolicy.allowAll());
        // Default: no pinned key → FR-SYNC-008 falls through to legacy
        // behaviour so existing tests keep their semantics.
        when(verifier.pinnedKeyConfigured()).thenReturn(false);
    }

    private CentralAppSyncService service(final boolean enabled) {
        return new CentralAppSyncService(client, catalogue, installedApps,
                runs, audit, policies, verifier, systemSettings, enabled);
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
                new CentralApp("new-app", "New App", "1.0", "url", null, null),
                new CentralApp("existing", "Existing", "2.0", "url", null, null),
                new CentralApp("same", "Same", "3.0", "url", null, null)));
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
                new CentralApp("new-app", "New App", "1.0", "/download/new-app", null, null)));
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
                new CentralApp("good", "Good", "1.0", "/g", null, null),
                new CentralApp("bad", "Bad", "1.0", "/b", null, null)));
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
    void allowListPolicyFiltersOutUnlistedApps() throws Exception {
        when(client.centralConfigured()).thenReturn(true);
        when(client.listApps()).thenReturn(List.of(
                new CentralApp("blessed", "Blessed", "1.0", "/b", null, null),
                new CentralApp("random", "Random", "1.0", "/r", null, null)));
        when(installedApps.findByKey(any())).thenReturn(Optional.empty());
        when(policies.read()).thenReturn(new CentralSyncPolicy(
                CentralSyncPolicy.Mode.ALLOW_LIST, List.of("blessed")));
        when(client.fetchBundle("/b")).thenReturn(new byte[]{1});
        when(catalogue.installZipBytesForSync(any(), eq("blessed"), any()))
                .thenReturn(Map.of("version", "1.0"));

        final var r = service(true).sync(false, UUID.randomUUID());
        assertThat(r.counters().installed()).isEqualTo(1);
        assertThat(r.counters().skipped()).isEqualTo(1);
        verify(catalogue, never()).installZipBytesForSync(any(),
                eq("random"), any());
        assertThat(r.details().stream().anyMatch(d ->
                "random".equals(d.key()) && "not in allow-list".equals(d.reason())))
                .isTrue();
    }

    @Test
    void denyListPolicyBlocksListedApps() throws Exception {
        when(client.centralConfigured()).thenReturn(true);
        when(client.listApps()).thenReturn(List.of(
                new CentralApp("blocked", "Blocked", "1.0", "/b", null, null),
                new CentralApp("ok", "OK", "1.0", "/o", null, null)));
        when(installedApps.findByKey(any())).thenReturn(Optional.empty());
        when(policies.read()).thenReturn(new CentralSyncPolicy(
                CentralSyncPolicy.Mode.DENY_LIST, List.of("blocked")));
        when(client.fetchBundle("/o")).thenReturn(new byte[]{1});
        when(catalogue.installZipBytesForSync(any(), eq("ok"), any()))
                .thenReturn(Map.of("version", "1.0"));

        final var r = service(true).sync(false, UUID.randomUUID());
        assertThat(r.counters().installed()).isEqualTo(1);
        assertThat(r.counters().skipped()).isEqualTo(1);
        verify(catalogue, never()).installZipBytesForSync(any(),
                eq("blocked"), any());
        assertThat(r.details().stream().anyMatch(d ->
                "blocked".equals(d.key()) && "on deny-list".equals(d.reason())))
                .isTrue();
    }

    @Test
    void candidateWithNullDownloadUrlIsCountedAsFailedNotCrash() throws Exception {
        when(client.centralConfigured()).thenReturn(true);
        when(client.listApps()).thenReturn(List.of(
                new CentralApp("no-url", "No URL", "1.0", null, null, null)));
        when(installedApps.findByKey("no-url")).thenReturn(Optional.empty());
        final var r = service(true).sync(false, UUID.randomUUID());
        assertThat(r.outcome()).isEqualTo("FAILED");
        assertThat(r.counters().failed()).isEqualTo(1);
    }

    @Test
    void pinnedKeyRejectsUnsignedByDefault() throws Exception {
        when(client.centralConfigured()).thenReturn(true);
        when(verifier.pinnedKeyConfigured()).thenReturn(true);
        when(client.listApps()).thenReturn(List.of(
                new CentralApp("no-sig", "No Sig", "1.0", "/u", null, null)));
        when(installedApps.findByKey("no-sig")).thenReturn(Optional.empty());
        when(client.fetchBundle("/u")).thenReturn(new byte[]{1, 2, 3});
        when(systemSettings.read(CentralAppSyncService.SETTING_ALLOW_UNSIGNED))
                .thenReturn(null);
        final var r = service(true).sync(false, UUID.randomUUID());
        assertThat(r.outcome()).isEqualTo("FAILED");
        assertThat(r.counters().failed()).isEqualTo(1);
        assertThat(r.details().get(0).reason()).contains("allow-unsigned-central is false");
        verify(catalogue, never()).installZipBytesForSync(any(), any(), any());
    }

    @Test
    void pinnedKeyAcceptsUnsignedWhenOverrideOnAndEmitsAudit() throws Exception {
        when(client.centralConfigured()).thenReturn(true);
        when(verifier.pinnedKeyConfigured()).thenReturn(true);
        when(client.listApps()).thenReturn(List.of(
                new CentralApp("override", "O", "1.0", "/u", null, null)));
        when(installedApps.findByKey("override")).thenReturn(Optional.empty());
        when(client.fetchBundle("/u")).thenReturn(new byte[]{1});
        when(systemSettings.read(CentralAppSyncService.SETTING_ALLOW_UNSIGNED))
                .thenReturn("true");
        when(catalogue.installZipBytesForSync(any(), eq("override"), any()))
                .thenReturn(Map.of("version", "1.0"));
        final UUID actor = UUID.randomUUID();
        final var r = service(true).sync(false, actor);
        assertThat(r.outcome()).isEqualTo("OK");
        verify(audit).append(argThat((AuditEvent e) ->
                "APP_UNSIGNED_CENTRAL_ACCEPTED".equals(e.eventType())
                        && actor.equals(e.actorUserId())), any());
        verify(audit).append(argThat((AuditEvent e) ->
                "APP_INSTALLED_FROM_CENTRAL".equals(e.eventType())), any());
    }

    @Test
    void pinnedKeyRejectsBadSignature() throws Exception {
        when(client.centralConfigured()).thenReturn(true);
        when(verifier.pinnedKeyConfigured()).thenReturn(true);
        when(client.listApps()).thenReturn(List.of(
                new CentralApp("bad-sig", "B", "1.0", "/b", null, "badsig")));
        when(installedApps.findByKey("bad-sig")).thenReturn(Optional.empty());
        when(client.fetchBundle("/b")).thenReturn(new byte[]{1});
        when(verifier.verify(any(), eq("badsig"))).thenReturn(false);
        final var r = service(true).sync(false, UUID.randomUUID());
        assertThat(r.outcome()).isEqualTo("FAILED");
        assertThat(r.details().get(0).reason()).contains("did not verify");
        verify(catalogue, never()).installZipBytesForSync(any(), any(), any());
    }

    @Test
    void pinnedKeyAcceptsValidSignature() throws Exception {
        when(client.centralConfigured()).thenReturn(true);
        when(verifier.pinnedKeyConfigured()).thenReturn(true);
        when(client.listApps()).thenReturn(List.of(
                new CentralApp("good-sig", "G", "1.0", "/g", null, "goodsig")));
        when(installedApps.findByKey("good-sig")).thenReturn(Optional.empty());
        when(client.fetchBundle("/g")).thenReturn(new byte[]{1, 2, 3});
        when(verifier.verify(any(), eq("goodsig"))).thenReturn(true);
        when(catalogue.installZipBytesForSync(any(), eq("good-sig"), any()))
                .thenReturn(Map.of("version", "1.0"));
        final var r = service(true).sync(false, UUID.randomUUID());
        assertThat(r.outcome()).isEqualTo("OK");
        assertThat(r.counters().installed()).isEqualTo(1);
        verify(audit, never()).append(argThat((AuditEvent e) ->
                "APP_UNSIGNED_CENTRAL_ACCEPTED".equals(e.eventType())), any());
    }

    @Test
    void scheduledRunNoopsWhenDisabled() {
        service(false).runOnSchedule();
        verify(runs, never()).insertStarted(anyBoolean(), any());
    }

    @Test
    void appHubSourceDispatchesToHubClient() throws Exception {
        final AppHubClient hub = mock(AppHubClient.class);
        when(policies.read()).thenReturn(new CentralSyncPolicy(
                CentralSyncPolicy.Mode.ALLOW_ALL, List.of(),
                CentralSyncPolicy.Source.APP_HUB));
        when(hub.listApps()).thenReturn(List.of(
                new CentralApp("capture", "Capture", "100.18.0",
                        "https://apps.dhis2.org/download/capture-100.18.0.zip",
                        null, null)));
        when(installedApps.findByKey("capture")).thenReturn(Optional.empty());
        when(hub.fetchBundle(any())).thenReturn(new byte[]{1, 2, 3});
        when(catalogue.installZipBytesForSync(any(), eq("capture"), any()))
                .thenReturn(Map.of("version", "100.18.0"));
        @SuppressWarnings("unchecked")
        final org.springframework.beans.factory.ObjectProvider<AppHubClient> p =
                mock(org.springframework.beans.factory.ObjectProvider.class);
        when(p.getIfAvailable()).thenReturn(hub);
        final CentralAppSyncService svc = new CentralAppSyncService(client, p,
                catalogue, installedApps, runs, audit, policies, verifier,
                systemSettings, true);
        final var r = svc.sync(false, UUID.randomUUID());
        assertThat(r.outcome()).isEqualTo("OK");
        assertThat(r.counters().installed()).isEqualTo(1);
        verify(hub).listApps();
        verify(hub).fetchBundle(any());
        // The CENTRAL client is NOT exercised for a HUB-sourced run.
        verify(client, never()).listApps();
        verify(client, never()).fetchBundle(any());
    }

    @Test
    void appHubSourceFailsGracefullyWhenNoHubBean() {
        // Null ObjectProvider — no hub bean registered. Falls back to
        // CENTRAL semantics so the service doesn't hard-crash when
        // the plan mis-configures APP_HUB without wiring the client.
        when(policies.read()).thenReturn(new CentralSyncPolicy(
                CentralSyncPolicy.Mode.ALLOW_ALL, List.of(),
                CentralSyncPolicy.Source.APP_HUB));
        when(client.centralConfigured()).thenReturn(false);
        final CentralAppSyncService svc = new CentralAppSyncService(client, null,
                catalogue, installedApps, runs, audit, policies, verifier,
                systemSettings, true);
        final var r = svc.sync(false, UUID.randomUUID());
        assertThat(r.outcome()).isEqualTo("SKIPPED");
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
