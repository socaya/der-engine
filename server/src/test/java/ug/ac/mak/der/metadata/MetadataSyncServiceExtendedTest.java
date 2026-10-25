package ug.ac.mak.der.metadata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.dhis2.Dhis2Properties;
import ug.ac.mak.der.dhis2.Dhis2ReferenceClient;

class MetadataSyncServiceExtendedTest {

    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-10-22T12:00:00Z"), ZoneOffset.UTC);
    private final ObjectMapper mapper = new ObjectMapper();

    private Dhis2Properties props() {
        return new Dhis2Properties(
                new Dhis2Properties.Central("http://x/dhis", "u", "p", 1000),
                Dhis2Properties.Compatibility.legacy("2.44", false));
    }

    private JsonNode tree(final String s) throws Exception {
        return mapper.readTree(s);
    }

    private MetadataSyncService service(final Dhis2ReferenceClient client) {
        return new MetadataSyncService(client, props(),
                mock(MetadataMirrorRepository.class), mock(ExtendedMirrorRepository.class),
                mock(MetadataCatalogRepository.class),
                mock(MetadataSnapshotRepository.class), CLOCK);
    }

    @Test
    void readCategoryOptionCombosHandlesHit() throws Exception {
        final Dhis2ReferenceClient c = mock(Dhis2ReferenceClient.class);
        when(c.fetchJson(MetadataSyncService.CATEGORY_OPTION_COMBO_PATH)).thenReturn(tree(
                "{\"categoryOptionCombos\":[{\"id\":\"c1\",\"displayName\":\"default\","
                        + "\"categoryCombo\":{\"id\":\"cc1\"}}]}"));
        final List<MirroredCategoryOptionCombo> out = service(c).readCategoryOptionCombos();
        assertThat(out).hasSize(1);
        assertThat(out.get(0).categoryComboUid()).isEqualTo("cc1");
    }

    @Test
    void readCategoryOptionCombosHandlesNullBody() throws Exception {
        final Dhis2ReferenceClient c = mock(Dhis2ReferenceClient.class);
        when(c.fetchJson(MetadataSyncService.CATEGORY_OPTION_COMBO_PATH)).thenReturn(null);
        assertThat(service(c).readCategoryOptionCombos()).isEmpty();
    }

    @Test
    void readProgramStagesHandlesHit() throws Exception {
        final Dhis2ReferenceClient c = mock(Dhis2ReferenceClient.class);
        when(c.fetchJson(MetadataSyncService.PROGRAM_STAGE_PATH)).thenReturn(tree(
                "{\"programStages\":[{"
                        + "\"id\":\"ps1\",\"displayName\":\"visit\","
                        + "\"program\":{\"id\":\"p1\"},\"repeatable\":true,"
                        + "\"programStageDataElements\":["
                        + "{\"dataElement\":{\"id\":\"de1\"},\"compulsory\":true,\"sortOrder\":1},"
                        + "{\"compulsory\":false}]}"
                        + "]}"));
        final var out = service(c).readProgramStages();
        assertThat(out).hasSize(1);
        assertThat(out.get(0).dataElements()).hasSize(1);
    }

    @Test
    void readProgramStagesHandlesNullBody() throws Exception {
        final Dhis2ReferenceClient c = mock(Dhis2ReferenceClient.class);
        when(c.fetchJson(MetadataSyncService.PROGRAM_STAGE_PATH)).thenReturn(null);
        assertThat(service(c).readProgramStages()).isEmpty();
    }

    @Test
    void readTrackedEntityAttributesHandlesHit() throws Exception {
        final Dhis2ReferenceClient c = mock(Dhis2ReferenceClient.class);
        when(c.fetchJson(MetadataSyncService.TRACKED_ENTITY_ATTRIBUTE_PATH)).thenReturn(tree(
                "{\"trackedEntityAttributes\":[{"
                        + "\"id\":\"tea1\",\"displayName\":\"Name\",\"valueType\":\"TEXT\","
                        + "\"unique\":true}]}"));
        final var out = service(c).readTrackedEntityAttributes();
        assertThat(out).hasSize(1);
        assertThat(out.get(0).uniqueAttribute()).isTrue();
    }

    @Test
    void readTrackedEntityAttributesHandlesNullBody() throws Exception {
        final Dhis2ReferenceClient c = mock(Dhis2ReferenceClient.class);
        when(c.fetchJson(MetadataSyncService.TRACKED_ENTITY_ATTRIBUTE_PATH)).thenReturn(null);
        assertThat(service(c).readTrackedEntityAttributes()).isEmpty();
    }

    @Test
    void readProgramRulesHandlesHitWithActions() throws Exception {
        final Dhis2ReferenceClient c = mock(Dhis2ReferenceClient.class);
        when(c.fetchJson(MetadataSyncService.PROGRAM_RULE_PATH)).thenReturn(tree(
                "{\"programRules\":[{"
                        + "\"id\":\"r1\",\"displayName\":\"rule\","
                        + "\"program\":{\"id\":\"p1\"},\"priority\":10,"
                        + "\"condition\":\"true\","
                        + "\"programRuleActions\":["
                        + "{\"id\":\"a1\",\"programRuleActionType\":\"ASSIGN\","
                        + "\"dataElement\":{\"id\":\"de\"},\"data\":\"1\"}]}"
                        + "]}"));
        final var out = service(c).readProgramRules();
        assertThat(out).hasSize(1);
        assertThat(out.get(0).actions()).hasSize(1);
    }

    @Test
    void readProgramRulesHandlesNullBody() throws Exception {
        final Dhis2ReferenceClient c = mock(Dhis2ReferenceClient.class);
        when(c.fetchJson(MetadataSyncService.PROGRAM_RULE_PATH)).thenReturn(null);
        assertThat(service(c).readProgramRules()).isEmpty();
    }

    @Test
    void readProgramRulesHandlesNoActions() throws Exception {
        final Dhis2ReferenceClient c = mock(Dhis2ReferenceClient.class);
        when(c.fetchJson(MetadataSyncService.PROGRAM_RULE_PATH)).thenReturn(tree(
                "{\"programRules\":[{\"id\":\"r1\",\"displayName\":\"rule\","
                        + "\"program\":{\"id\":\"p1\"},\"condition\":\"true\"}]}"));
        final var out = service(c).readProgramRules();
        assertThat(out.get(0).actions()).isEmpty();
    }

    @Test
    void readProgramStageWithoutProgramIdThrowsRequireText() throws Exception {
        final Dhis2ReferenceClient c = mock(Dhis2ReferenceClient.class);
        when(c.fetchJson(MetadataSyncService.PROGRAM_STAGE_PATH)).thenReturn(tree(
                "{\"programStages\":[{\"id\":\"ps\",\"displayName\":\"n\"}]}"));
        // nestedIdOrNull returns null → fallback requireText throws
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service(c).readProgramStages())
                .isInstanceOf(IllegalStateException.class);
    }
}
