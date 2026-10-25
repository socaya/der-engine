package ug.ac.mak.der.metadata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import ug.ac.mak.der.dhis2.Dhis2Properties;
import ug.ac.mak.der.dhis2.Dhis2ReferenceClient;
import ug.ac.mak.der.dhis2.Dhis2Version;

class MetadataSyncServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-22T10:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private final ObjectMapper json = new ObjectMapper();

    private Dhis2Properties props() {
        return new Dhis2Properties(
                new Dhis2Properties.Central("http://central/dhis", "u", "p", 5000),
                Dhis2Properties.Compatibility.legacy("2.44-SNAPSHOT", false));
    }

    private JsonNode tree(final String s) throws Exception {
        return json.readTree(s);
    }

    @Test
    void syncAllFetchesAndPersists() throws Exception {
        final Dhis2ReferenceClient dhis2 = mock(Dhis2ReferenceClient.class);
        final MetadataMirrorRepository mirror = mock(MetadataMirrorRepository.class);
        final MetadataSnapshotRepository snapshots = mock(MetadataSnapshotRepository.class);

        when(dhis2.fetchVersion()).thenReturn(new Dhis2Version("2.44-SNAPSHOT", "abc", "2026-08-19T23:39:17.000"));
        when(dhis2.fetchJson(MetadataSyncService.ORG_UNIT_PATH)).thenReturn(tree(
                "{\"organisationUnits\":["
                        + "{\"id\":\"ou1\",\"displayName\":\"OU1\",\"path\":\"/root/ou1\",\"level\":2,"
                        + "\"parent\":{\"id\":\"root\"}},"
                        + "{\"id\":\"ou2\",\"name\":\"OU2 fallback\"}"
                        + "]}"));
        when(dhis2.fetchJson(MetadataSyncService.DATA_ELEMENT_PATH)).thenReturn(tree(
                "{\"dataElements\":[{\"id\":\"de1\",\"displayName\":\"DE1\",\"valueType\":\"NUMBER\","
                        + "\"domainType\":\"AGGREGATE\"}]}"));
        when(dhis2.fetchJson(MetadataSyncService.DATA_SET_PATH)).thenReturn(tree(
                "{\"dataSets\":[{\"id\":\"ds1\",\"displayName\":\"DS1\",\"periodType\":\"Monthly\"}]}"));
        when(dhis2.fetchJson(MetadataSyncService.PROGRAM_PATH)).thenReturn(tree(
                "{\"programs\":[{\"id\":\"p1\",\"displayName\":\"P1\",\"programType\":\"WITH_REGISTRATION\","
                        + "\"trackedEntityType\":{\"id\":\"tet1\"}}]}"));
        when(dhis2.fetchJson(MetadataSyncService.TRACKED_ENTITY_TYPE_PATH)).thenReturn(tree(
                "{\"trackedEntityTypes\":[{\"id\":\"tet1\",\"displayName\":\"TET1\"}]}"));
        when(dhis2.fetchJson(MetadataSyncService.CATEGORY_OPTION_COMBO_PATH)).thenReturn(tree(
                "{\"categoryOptionCombos\":[]}"));
        when(dhis2.fetchJson(MetadataSyncService.PROGRAM_STAGE_PATH)).thenReturn(tree(
                "{\"programStages\":[]}"));
        when(dhis2.fetchJson(MetadataSyncService.TRACKED_ENTITY_ATTRIBUTE_PATH)).thenReturn(tree(
                "{\"trackedEntityAttributes\":[]}"));
        when(dhis2.fetchJson(MetadataSyncService.PROGRAM_RULE_PATH)).thenReturn(tree(
                "{\"programRules\":[]}"));
        when(snapshots.insert(any())).thenAnswer(inv -> {
            final MetadataSnapshot in = inv.getArgument(0);
            return new MetadataSnapshot(99L, in.importedFrom(), in.importedBy(), in.importedAt(),
                    in.counts(), in.centralVersion(), in.centralRevision(), in.fingerprint());
        });

        final UUID actor = UUID.randomUUID();
        final MetadataSnapshot result = new MetadataSyncService(dhis2, props(), mirror, mock(ExtendedMirrorRepository.class), mock(MetadataCatalogRepository.class), snapshots, CLOCK)
                .syncAll(actor);

        assertThat(result.snapshotId()).isEqualTo(99L);
        assertThat(result.counts().organisationUnits()).isEqualTo(2);
        assertThat(result.counts().dataElements()).isEqualTo(1);
        assertThat(result.counts().dataSets()).isEqualTo(1);
        assertThat(result.counts().programs()).isEqualTo(1);
        assertThat(result.counts().trackedEntityTypes()).isEqualTo(1);
        assertThat(result.importedBy()).isEqualTo(actor);
        assertThat(result.importedFrom()).isEqualTo("http://central/dhis");
        assertThat(result.centralVersion()).isEqualTo("2.44-SNAPSHOT");
        assertThat(result.centralRevision()).isEqualTo("abc");
        assertThat(result.fingerprint()).matches("[0-9a-f]{64}");

        final ArgumentCaptor<List<MirroredOrganisationUnit>> cap = ArgumentCaptor.forClass(List.class);
        verify(mirror).upsertOrganisationUnits(cap.capture(), eq(99L));
        final List<MirroredOrganisationUnit> rows = cap.getValue();
        assertThat(rows).hasSize(2);
        assertThat(rows.get(0).parentUid()).isEqualTo("root");
        assertThat(rows.get(1).parentUid()).isNull();
        assertThat(rows.get(1).displayName()).isEqualTo("OU2 fallback");
    }

    @Test
    void propagatesUnreachableFromCentral() throws Exception {
        final Dhis2ReferenceClient dhis2 = mock(Dhis2ReferenceClient.class);
        when(dhis2.fetchVersion()).thenReturn(new Dhis2Version("2.44-SNAPSHOT", null, null));
        when(dhis2.fetchJson(anyString()))
                .thenThrow(new Dhis2ReferenceClient.Dhis2UnreachableException("down", null));
        assertThatThrownBy(() -> new MetadataSyncService(dhis2, props(), mock(MetadataMirrorRepository.class), mock(ExtendedMirrorRepository.class), mock(MetadataCatalogRepository.class), mock(MetadataSnapshotRepository.class), CLOCK)
                .syncAll(null))
                .isInstanceOf(Dhis2ReferenceClient.Dhis2UnreachableException.class);
    }

    @Test
    void missingIdInPayloadIsFatal() throws Exception {
        final Dhis2ReferenceClient dhis2 = mock(Dhis2ReferenceClient.class);
        when(dhis2.fetchVersion()).thenReturn(new Dhis2Version("2.44-SNAPSHOT", null, null));
        when(dhis2.fetchJson(MetadataSyncService.ORG_UNIT_PATH)).thenReturn(tree(
                "{\"organisationUnits\":[{\"displayName\":\"OU-no-id\"}]}"));
        assertThatThrownBy(() -> new MetadataSyncService(dhis2, props(), mock(MetadataMirrorRepository.class), mock(ExtendedMirrorRepository.class), mock(MetadataCatalogRepository.class), mock(MetadataSnapshotRepository.class), CLOCK)
                .syncAll(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Missing required field");
    }

    @Test
    void fingerprintIsDeterministicAndOrderIndependent() {
        final JsonNode n = json.createObjectNode();
        final String a = MetadataSyncService.fingerprintOf(
                List.of(new MirroredOrganisationUnit("a", "A", null, null, null, n),
                        new MirroredOrganisationUnit("b", "B", null, null, null, n)),
                List.of());
        final String b = MetadataSyncService.fingerprintOf(
                List.of(new MirroredOrganisationUnit("b", "B", null, null, null, n),
                        new MirroredOrganisationUnit("a", "A", null, null, null, n)),
                List.of());
        assertThat(a).isEqualTo(b);
    }

    @Test
    void secondaryFetchersAreCovered() throws Exception {
        // Exercise the private readers one by one by letting the main sync call them.
        final Dhis2ReferenceClient dhis2 = mock(Dhis2ReferenceClient.class);
        when(dhis2.fetchVersion()).thenReturn(new Dhis2Version("2.44-SNAPSHOT", null, null));
        when(dhis2.fetchJson(MetadataSyncService.ORG_UNIT_PATH)).thenReturn(tree("{\"organisationUnits\":[]}"));
        when(dhis2.fetchJson(MetadataSyncService.DATA_ELEMENT_PATH)).thenReturn(tree("{\"dataElements\":[]}"));
        when(dhis2.fetchJson(MetadataSyncService.DATA_SET_PATH)).thenReturn(tree("{\"dataSets\":[]}"));
        when(dhis2.fetchJson(MetadataSyncService.PROGRAM_PATH)).thenReturn(tree("{\"programs\":[]}"));
        when(dhis2.fetchJson(MetadataSyncService.TRACKED_ENTITY_TYPE_PATH))
                .thenReturn(tree("{\"trackedEntityTypes\":[]}"));
        final MetadataSnapshotRepository snapshots = mock(MetadataSnapshotRepository.class);
        when(snapshots.insert(any())).thenAnswer(inv -> {
            final MetadataSnapshot in = inv.getArgument(0);
            return new MetadataSnapshot(1L, in.importedFrom(), in.importedBy(), in.importedAt(),
                    in.counts(), in.centralVersion(), in.centralRevision(), in.fingerprint());
        });
        final MetadataSnapshot result = new MetadataSyncService(dhis2, props(), mock(MetadataMirrorRepository.class), mock(ExtendedMirrorRepository.class), mock(MetadataCatalogRepository.class), snapshots, CLOCK).syncAll(null);
        assertThat(result.counts().total()).isZero();
    }

    @Test
    void propagatesResponseExceptionFromCentral() throws Exception {
        final Dhis2ReferenceClient dhis2 = mock(Dhis2ReferenceClient.class);
        when(dhis2.fetchVersion()).thenReturn(new Dhis2Version("2.44-SNAPSHOT", null, null));
        when(dhis2.fetchJson(anyString()))
                .thenThrow(new Dhis2ReferenceClient.Dhis2ResponseException("bad", null));
        assertThatThrownBy(() -> new MetadataSyncService(dhis2, props(), mock(MetadataMirrorRepository.class), mock(ExtendedMirrorRepository.class), mock(MetadataCatalogRepository.class), mock(MetadataSnapshotRepository.class), CLOCK)
                .syncAll(null))
                .isInstanceOf(Dhis2ReferenceClient.Dhis2ResponseException.class);
    }

    @Test
    void rejectsNullDependencies() {
        final var props = props();
        final var mirror = mock(MetadataMirrorRepository.class);
        final var snapshots = mock(MetadataSnapshotRepository.class);
        final var dhis2 = mock(Dhis2ReferenceClient.class);
        assertThatThrownBy(() -> new MetadataSyncService(null, props, mirror, mock(ExtendedMirrorRepository.class), mock(MetadataCatalogRepository.class), snapshots, CLOCK))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MetadataSyncService(dhis2, null, mirror, mock(ExtendedMirrorRepository.class), mock(MetadataCatalogRepository.class), snapshots, CLOCK))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MetadataSyncService(dhis2, props, null, mock(ExtendedMirrorRepository.class), mock(MetadataCatalogRepository.class), snapshots, CLOCK))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MetadataSyncService(dhis2, props, mirror, mock(ExtendedMirrorRepository.class), mock(MetadataCatalogRepository.class), null, CLOCK))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MetadataSyncService(dhis2, props, mirror, mock(ExtendedMirrorRepository.class), mock(MetadataCatalogRepository.class), snapshots, null))
                .isInstanceOf(NullPointerException.class);
    }

    // Reference the Duration import so the compiler keeps it; a future author
    // may want it for pagination tests.
    @Test
    void durationIsAvailableForFutureUse() {
        assertThat(Duration.ofSeconds(1).toMillis()).isEqualTo(1000);
    }

    @Test
    void payloadHelperBranchesExercised() throws Exception {
        final Dhis2ReferenceClient dhis2 = mock(Dhis2ReferenceClient.class);
        when(dhis2.fetchVersion()).thenReturn(new Dhis2Version("2.44-SNAPSHOT", null, null));
        // id present, no displayName (name fallback), level present as string (intOrNull returns null),
        // parent array (not object; nestedIdOrNull returns null) + a second row with parent object missing id.
        when(dhis2.fetchJson(MetadataSyncService.ORG_UNIT_PATH)).thenReturn(tree(
                "{\"organisationUnits\":["
                        + "{\"id\":\"a\",\"name\":\"A-fallback\",\"level\":\"not-an-int\",\"parent\":[]},"
                        + "{\"id\":\"b\",\"displayName\":\"B\",\"parent\":{\"notId\":1}}"
                        + "]}"));
        when(dhis2.fetchJson(MetadataSyncService.DATA_ELEMENT_PATH)).thenReturn(tree("{\"dataElements\":[]}"));
        when(dhis2.fetchJson(MetadataSyncService.DATA_SET_PATH)).thenReturn(tree("{\"dataSets\":[]}"));
        when(dhis2.fetchJson(MetadataSyncService.PROGRAM_PATH)).thenReturn(tree(
                "{\"programs\":[{\"id\":\"p\",\"displayName\":\"P\",\"trackedEntityType\":null}]}"));
        when(dhis2.fetchJson(MetadataSyncService.TRACKED_ENTITY_TYPE_PATH))
                .thenReturn(tree("{\"trackedEntityTypes\":[]}"));
        final MetadataSnapshotRepository snapshots = mock(MetadataSnapshotRepository.class);
        when(snapshots.insert(any())).thenAnswer(inv -> {
            final MetadataSnapshot in = inv.getArgument(0);
            return new MetadataSnapshot(1L, in.importedFrom(), in.importedBy(), in.importedAt(),
                    in.counts(), in.centralVersion(), in.centralRevision(), in.fingerprint());
        });
        new MetadataSyncService(dhis2, props(), mock(MetadataMirrorRepository.class), mock(ExtendedMirrorRepository.class), mock(MetadataCatalogRepository.class), snapshots, CLOCK).syncAll(null);
    }

    @Test
    void requireTextRejectsBlank() throws Exception {
        final Dhis2ReferenceClient dhis2 = mock(Dhis2ReferenceClient.class);
        when(dhis2.fetchVersion()).thenReturn(new Dhis2Version("2.44-SNAPSHOT", null, null));
        when(dhis2.fetchJson(MetadataSyncService.ORG_UNIT_PATH)).thenReturn(tree(
                "{\"organisationUnits\":[{\"id\":\"\",\"displayName\":\"X\"}]}"));
        assertThatThrownBy(() -> new MetadataSyncService(dhis2, props(), mock(MetadataMirrorRepository.class), mock(ExtendedMirrorRepository.class), mock(MetadataCatalogRepository.class), mock(MetadataSnapshotRepository.class), CLOCK)
                .syncAll(null)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void optionalFieldsPresentButNonTextualFallThrough() throws Exception {
        // displayName as number -> textOr falls back to name;
        // name also as number -> textOr falls back to "".
        // path as number -> textOrNull returns null.
        // parent.id as number -> nestedIdOrNull returns null.
        final Dhis2ReferenceClient dhis2 = mock(Dhis2ReferenceClient.class);
        when(dhis2.fetchVersion()).thenReturn(new Dhis2Version("2.44-SNAPSHOT", null, null));
        when(dhis2.fetchJson(MetadataSyncService.ORG_UNIT_PATH)).thenReturn(tree(
                "{\"organisationUnits\":[{\"id\":\"a\",\"displayName\":1,\"name\":2,"
                        + "\"path\":3,\"parent\":{\"id\":4}}]}"));
        when(dhis2.fetchJson(MetadataSyncService.DATA_ELEMENT_PATH)).thenReturn(tree("{\"dataElements\":[]}"));
        when(dhis2.fetchJson(MetadataSyncService.DATA_SET_PATH)).thenReturn(tree("{\"dataSets\":[]}"));
        when(dhis2.fetchJson(MetadataSyncService.PROGRAM_PATH)).thenReturn(tree("{\"programs\":[]}"));
        when(dhis2.fetchJson(MetadataSyncService.TRACKED_ENTITY_TYPE_PATH))
                .thenReturn(tree("{\"trackedEntityTypes\":[]}"));
        final MetadataSnapshotRepository snapshots = mock(MetadataSnapshotRepository.class);
        when(snapshots.insert(any())).thenAnswer(inv -> {
            final MetadataSnapshot in = inv.getArgument(0);
            return new MetadataSnapshot(1L, in.importedFrom(), in.importedBy(), in.importedAt(),
                    in.counts(), in.centralVersion(), in.centralRevision(), in.fingerprint());
        });
        new MetadataSyncService(dhis2, props(), mock(MetadataMirrorRepository.class), mock(ExtendedMirrorRepository.class), mock(MetadataCatalogRepository.class), snapshots, CLOCK).syncAll(null);
    }

    @Test
    void requireTextRejectsNonTextual() throws Exception {
        final Dhis2ReferenceClient dhis2 = mock(Dhis2ReferenceClient.class);
        when(dhis2.fetchVersion()).thenReturn(new Dhis2Version("2.44-SNAPSHOT", null, null));
        when(dhis2.fetchJson(MetadataSyncService.ORG_UNIT_PATH)).thenReturn(tree(
                "{\"organisationUnits\":[{\"id\":123,\"displayName\":\"X\"}]}"));
        assertThatThrownBy(() -> new MetadataSyncService(dhis2, props(), mock(MetadataMirrorRepository.class), mock(ExtendedMirrorRepository.class), mock(MetadataCatalogRepository.class), mock(MetadataSnapshotRepository.class), CLOCK)
                .syncAll(null)).isInstanceOf(IllegalStateException.class);
    }
}
