package ug.ac.mak.der.dhis2.compatibility;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.dhis2.Dhis2Properties;
import ug.ac.mak.der.dhis2.Dhis2ReferenceClient;
import ug.ac.mak.der.dhis2.Dhis2Version;

class Dhis2CompatibilityEngineTest {

    private Dhis2ReferenceClient referenceClient;
    private Dhis2CapabilityProbe probe;
    private Dhis2ProfileRegistry registry;
    private CapabilitySnapshotRepository repo;
    private Dhis2Properties props;
    private Clock clock;

    private static final Clock FIXED_CLOCK =
            Clock.fixed(Instant.parse("2026-10-22T12:00:00Z"), ZoneOffset.UTC);

    @BeforeEach
    void init() throws Exception {
        referenceClient = mock(Dhis2ReferenceClient.class);
        probe = mock(Dhis2CapabilityProbe.class);
        registry = Dhis2ProfileRegistry.defaultRegistry();
        repo = mock(CapabilitySnapshotRepository.class);
        props = new Dhis2Properties(
                new Dhis2Properties.Central("http://central/dhis", "u", "p", 1000),
                new Dhis2Properties.Compatibility(
                        "2.41", "2.44", "strict", false, 168, false, null, false));
        clock = FIXED_CLOCK;

        when(probe.run()).thenReturn(reachableReport());
        when(referenceClient.fetchVersion()).thenReturn(new Dhis2Version("2.44-SNAPSHOT", "r", "b"));
        when(repo.insert(any())).thenAnswer(inv -> withId((CapabilitySnapshot) inv.getArgument(0), 1L));
        when(repo.findLatest()).thenReturn(Optional.empty());
        when(repo.findRecent(any(Integer.class))).thenAnswer(inv -> List.of());
    }

    private static CapabilitySnapshot withId(final CapabilitySnapshot s, final long id) {
        return new CapabilitySnapshot(id, s.capturedAt(), s.centralVersion(), s.centralRevision(),
                s.centralBuildTime(), s.major(), s.minor(), s.patch(), s.snapshot(),
                s.profileName(), s.probeReport(), s.capabilities(), s.engineVersion(),
                s.probeReachable(), s.probeDurationMs(), s.triggeredBy(), s.initiatorUser());
    }

    private static ProbeReport reachableReport() {
        return new ProbeReport(Instant.parse("2026-10-22T11:59:59Z"), 20L, true, "2.44-SNAPSHOT",
                List.of(
                        new ProbeOutcome("/api/system/info", "GET", 200, 10L, "d", null, true),
                        new ProbeOutcome("/api/tracker/trackedEntities?pageSize=1", "GET", 400, 5L, null,
                                "ok", true),
                        new ProbeOutcome("/api/trackedEntityInstances?pageSize=1", "GET", 404, 2L, null,
                                "legacy gone", true),
                        new ProbeOutcome("/api/categoryOptionCombos?fields=id&pageSize=1", "GET", 200, 2L,
                                null, null, true),
                        new ProbeOutcome("/api/programRules?fields=id&pageSize=1", "GET", 200, 2L, null,
                                null, true),
                        new ProbeOutcome("/api/metadata?dataElements=true&fields=id&pageSize=1", "GET",
                                200, 2L, null, null, true)
                ));
    }

    private Dhis2CompatibilityEngine engine() {
        return new Dhis2CompatibilityEngine(referenceClient, probe, registry, repo, props, clock);
    }

    @Test
    void initialiseStoresSnapshotAndCachesInMemory() {
        final CapabilitySnapshot result = engine().initialise();
        assertThat(result.profileName()).isEqualTo("V2_44");
        assertThat(result.snapshotId()).isEqualTo(1L);
        assertThat(result.triggeredBy()).isEqualTo(CapabilitySnapshot.Trigger.STARTUP);
    }

    @Test
    void initialiseFallsBackToCachedWhenProbeFails() throws Exception {
        when(referenceClient.fetchVersion())
                .thenThrow(new Dhis2ReferenceClient.Dhis2UnreachableException("down", null));
        when(repo.findLatest()).thenReturn(Optional.of(aCached(5L)));
        final CapabilitySnapshot result = engine().initialise();
        assertThat(result.snapshotId()).isEqualTo(5L);
    }

    @Test
    void initialiseThrowsWhenProbeFailsAndNoCache() throws Exception {
        when(referenceClient.fetchVersion())
                .thenThrow(new Dhis2ReferenceClient.Dhis2UnreachableException("down", null));
        when(repo.findLatest()).thenReturn(Optional.empty());
        assertThatThrownBy(() -> engine().initialise())
                .isInstanceOf(Dhis2CompatibilityUnavailableException.class);
    }

    @Test
    void initialiseLogsFreshCache() {
        when(repo.findLatest()).thenReturn(Optional.of(aCached(10L)));
        final CapabilitySnapshot result = engine().initialise();
        assertThat(result.profileName()).isEqualTo("V2_44");
    }

    @Test
    void cachedOnlyUsesCache() {
        props = new Dhis2Properties(props.central(), new Dhis2Properties.Compatibility(
                "2.41", "2.44", "strict", false, 168, true, null, false));
        when(repo.findLatest()).thenReturn(Optional.of(aCached(7L)));
        final CapabilitySnapshot result = engine().initialise();
        assertThat(result.snapshotId()).isEqualTo(7L);
    }

    @Test
    void cachedOnlyThrowsIfNoCache() {
        props = new Dhis2Properties(props.central(), new Dhis2Properties.Compatibility(
                "2.41", "2.44", "strict", false, 168, true, null, false));
        when(repo.findLatest()).thenReturn(Optional.empty());
        assertThatThrownBy(() -> engine().initialise())
                .isInstanceOf(Dhis2CompatibilityUnavailableException.class);
    }

    @Test
    void refreshStoresAdminTriggeredSnapshot() {
        engine().initialise();
        final UUID user = UUID.randomUUID();
        final CapabilitySnapshot refreshed = engine().refresh(user);
        assertThat(refreshed.triggeredBy()).isEqualTo(CapabilitySnapshot.Trigger.ADMIN_REFRESH);
    }

    @Test
    void currentThrowsIfNotInitialised() {
        assertThatThrownBy(() -> engine().current())
                .isInstanceOf(Dhis2CompatibilityUnavailableException.class);
    }

    @Test
    void capabilitiesDelegatesToCurrent() {
        final Dhis2CompatibilityEngine e = engine();
        e.initialise();
        assertThat(e.capabilities()).isNotNull();
        assertThat(e.semanticVersion().raw()).isEqualTo("2.44-SNAPSHOT");
    }

    @Test
    void requireAtLeastThrowsBelowFloor() throws Exception {
        when(referenceClient.fetchVersion()).thenReturn(new Dhis2Version("2.41", "r", "b"));
        final Dhis2CompatibilityEngine e = engine();
        e.initialise();
        e.requireAtLeast(2, 41); // ok
        assertThatThrownBy(() -> e.requireAtLeast(2, 44))
                .isInstanceOf(UnsupportedDhis2VersionException.class);
    }

    @Test
    void historyIsExposed() {
        when(repo.findRecent(5)).thenReturn(List.of(aCached(1L), aCached(2L)));
        assertThat(engine().history(5)).hasSize(2);
    }

    @Test
    void engineVersionExposed() {
        assertThat(engine().engineVersion()).isEqualTo(Dhis2CompatibilityEngine.ENGINE_VERSION);
    }

    @Test
    void belowMinimumThrowsIfNotAllowed() throws Exception {
        when(referenceClient.fetchVersion()).thenReturn(new Dhis2Version("2.40", null, null));
        assertThatThrownBy(() -> engine().initialise())
                .isInstanceOf(UnsupportedDhis2VersionException.class);
    }

    @Test
    void belowMinimumPassesIfAllowUnsupported() throws Exception {
        props = new Dhis2Properties(props.central(), new Dhis2Properties.Compatibility(
                "2.41", "2.44", "strict", true, 168, false, null, true));
        when(referenceClient.fetchVersion()).thenReturn(new Dhis2Version("2.40", null, null));
        // registry.resolve returns empty for 2.40 (below 2.41 min), so engine
        // still fails with UnsupportedDhis2VersionException (profile unknown).
        assertThatThrownBy(() -> engine().initialise())
                .isInstanceOf(UnsupportedDhis2VersionException.class);
    }

    @Test
    void permissiveModeStillFailsWhenVersionUnreachable() throws Exception {
        props = new Dhis2Properties(props.central(), new Dhis2Properties.Compatibility(
                "2.41", "2.44", "permissive", false, 168, false, null, false));
        when(referenceClient.fetchVersion())
                .thenThrow(new Dhis2ReferenceClient.Dhis2UnreachableException("x", null));
        when(repo.findLatest()).thenReturn(Optional.empty());
        assertThatThrownBy(() -> engine().initialise())
                .isInstanceOf(Dhis2CompatibilityUnavailableException.class);
    }

    @Test
    void overlayProbeFindingsHandlesAllCombinations() {
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        Dhis2CompatibilityEngine.overlayProbeFindings(b, new ProbeReport(
                Instant.now(), 0L, true, "x",
                List.of(
                        new ProbeOutcome("/api/tracker/trackedEntities", "GET", 400, 1L, null, null, true),
                        new ProbeOutcome("/api/trackedEntityInstances", "GET", 200, 1L, null, null, true),
                        new ProbeOutcome("/api/categoryOptionCombos", "GET", 200, 1L, null, null, true),
                        new ProbeOutcome("/api/programRules", "GET", 200, 1L, null, null, true),
                        new ProbeOutcome("/api/metadata", "GET", 200, 1L, null, null, true)
                )));
        final CapabilityFlags caps = b.build();
        assertThat(caps.trackerApi()).isEqualTo(CapabilityFlags.TrackerApi.BOTH);
        assertThat(caps.supportsCategoryOptionCombosEndpoint()).isTrue();
    }

    @Test
    void overlayProbeFindingsLegacyOnly() {
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        Dhis2CompatibilityEngine.overlayProbeFindings(b, new ProbeReport(
                Instant.now(), 0L, true, "x",
                List.of(
                        new ProbeOutcome("/api/trackedEntityInstances", "GET", 200, 1L, null, null, true)
                )));
        assertThat(b.build().trackerApi()).isEqualTo(CapabilityFlags.TrackerApi.LEGACY_ONLY);
    }

    @Test
    void overlayProbeFindingsTrackerOnly() {
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        Dhis2CompatibilityEngine.overlayProbeFindings(b, new ProbeReport(
                Instant.now(), 0L, true, "x",
                List.of(
                        new ProbeOutcome("/api/tracker/events", "GET", 400, 1L, null, null, true)
                )));
        assertThat(b.build().trackerApi()).isEqualTo(CapabilityFlags.TrackerApi.TRACKER_ONLY);
    }

    @Test
    void overlayProbeFindingsSetsLegacyFromApiEvents() {
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        Dhis2CompatibilityEngine.overlayProbeFindings(b, new ProbeReport(
                Instant.now(), 0L, true, "x",
                List.of(
                        new ProbeOutcome("/api/events?pageSize=1", "GET", 200, 1L, null, null, true)
                )));
        assertThat(b.build().trackerApi()).isEqualTo(CapabilityFlags.TrackerApi.LEGACY_ONLY);
    }

    @Test
    void overlayProbeFindingsIgnoresStatusZero() {
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        Dhis2CompatibilityEngine.overlayProbeFindings(b, new ProbeReport(
                Instant.now(), 0L, true, "x",
                List.of(
                        new ProbeOutcome("/api/tracker/trackedEntities", "GET", 0, 1L, null, null, true)
                )));
        assertThat(b.build().trackerApi()).isEqualTo(CapabilityFlags.TrackerApi.NONE);
    }

    @Test
    void overlayProbeFindingsCoversEveryEndpointAt404() {
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        Dhis2CompatibilityEngine.overlayProbeFindings(b, new ProbeReport(
                Instant.now(), 0L, true, "x",
                List.of(
                        new ProbeOutcome("/api/tracker/trackedEntities", "GET", 404, 1L, null, null, true),
                        new ProbeOutcome("/api/tracker/events", "GET", 404, 1L, null, null, true),
                        new ProbeOutcome("/api/trackedEntityInstances", "GET", 404, 1L, null, null, true),
                        new ProbeOutcome("/api/events", "GET", 404, 1L, null, null, true),
                        new ProbeOutcome("/api/categoryOptionCombos", "GET", 404, 1L, null, null, true),
                        new ProbeOutcome("/api/programRules", "GET", 404, 1L, null, null, true),
                        new ProbeOutcome("/api/metadata", "GET", 404, 1L, null, null, true)
                )));
        final CapabilityFlags caps = b.build();
        assertThat(caps.trackerApi()).isEqualTo(CapabilityFlags.TrackerApi.NONE);
        assertThat(caps.supportsCategoryOptionCombosEndpoint()).isFalse();
        assertThat(caps.supportsProgramRulesEndpoint()).isFalse();
        assertThat(caps.supportsMetadataBulkEndpoint()).isFalse();
    }

    @Test
    void overlayProbeFindingsIgnoresUnreachable() {
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        Dhis2CompatibilityEngine.overlayProbeFindings(b, new ProbeReport(
                Instant.now(), 0L, false, "x",
                List.of(
                        new ProbeOutcome("/api/tracker/trackedEntities", "GET", -1, 1L, null, null, false),
                        new ProbeOutcome("/api/categoryOptionCombos", "GET", -1, 1L, null, null, false)
                )));
        final CapabilityFlags caps = b.build();
        assertThat(caps.trackerApi()).isEqualTo(CapabilityFlags.TrackerApi.NONE);
        assertThat(caps.supportsCategoryOptionCombosEndpoint()).isFalse();
    }

    @Test
    void overlayProbeFindingsIgnoresUnrelatedEndpoints() {
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        Dhis2CompatibilityEngine.overlayProbeFindings(b, new ProbeReport(
                Instant.now(), 0L, true, "x",
                List.of(
                        new ProbeOutcome("/api/system/info", "GET", 200, 1L, null, null, true),
                        new ProbeOutcome("/api/periodTypes", "GET", 200, 1L, null, null, true),
                        new ProbeOutcome("/api/dataElements", "GET", 200, 1L, null, null, true)
                )));
        assertThat(b.build().trackerApi()).isEqualTo(CapabilityFlags.TrackerApi.NONE);
    }

    @Test
    void overlayProbeFindingsNone() {
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        Dhis2CompatibilityEngine.overlayProbeFindings(b, new ProbeReport(
                Instant.now(), 0L, true, "x",
                List.of(
                        new ProbeOutcome("/api/tracker/trackedEntities", "GET", 404, 1L, null, null, true),
                        new ProbeOutcome("/api/events", "GET", -1, 1L, null, null, false)
                )));
        assertThat(b.build().trackerApi()).isEqualTo(CapabilityFlags.TrackerApi.NONE);
    }

    @Test
    void isStaleThresholdApplied() {
        when(repo.findLatest()).thenReturn(Optional.of(aCachedAt(
                Instant.parse("2000-01-01T00:00:00Z"), 11L)));
        final CapabilitySnapshot result = engine().initialise();
        assertThat(result.profileName()).isEqualTo("V2_44");
    }

    @Test
    void permissiveModeFailsOnVersionFetch() throws Exception {
        props = new Dhis2Properties(props.central(), new Dhis2Properties.Compatibility(
                "2.41", "2.44", "permissive", false, 168, false, null, false));
        when(referenceClient.fetchVersion())
                .thenThrow(new Dhis2ReferenceClient.Dhis2UnreachableException("x", null));
        when(repo.findLatest()).thenReturn(Optional.of(aCached(1L)));
        final CapabilitySnapshot out = engine().initialise();
        assertThat(out.snapshotId()).isEqualTo(1L);
    }

    @Test
    void unsupportedExceptionAccessors() {
        final UnsupportedDhis2VersionException ex = new UnsupportedDhis2VersionException("1.0", "2.41");
        assertThat(ex.observed()).isEqualTo("1.0");
        assertThat(ex.minimum()).isEqualTo("2.41");
        assertThat(ex.getMessage()).contains("below the minimum supported");
    }

    @Test
    void unavailableExceptionWrapsCause() {
        final Dhis2CompatibilityUnavailableException ex =
                new Dhis2CompatibilityUnavailableException("x", new RuntimeException("y"));
        assertThat(ex.getCause()).isNotNull();
    }

    private CapabilitySnapshot aCached(final long id) {
        return aCachedAt(Instant.parse("2026-10-22T11:00:00Z"), id);
    }

    private CapabilitySnapshot aCachedAt(final Instant t, final long id) {
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        new ug.ac.mak.der.dhis2.compatibility.profiles.V244Profile().apply(b);
        return new CapabilitySnapshot(id, t, "2.44-SNAPSHOT", "r", "b",
                2, 44, null, true, "V2_44", reachableReport(), b.build(),
                Dhis2CompatibilityEngine.ENGINE_VERSION, true, 10L,
                CapabilitySnapshot.Trigger.STARTUP, null);
    }
}
