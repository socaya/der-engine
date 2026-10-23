package ug.ac.mak.der.metadata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;

class MetadataDriftDetectorTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private static OperationJournalEntry entry(final OperationJournalEntry.EntityType type,
                                                 final JsonNode payload) {
        return new OperationJournalEntry(UUID.randomUUID(), type, "ref", payload,
                OperationJournalEntry.State.PENDING, 0, null, null,
                Instant.now(), Instant.now(), null);
    }

    @Test
    void noDriftWhenAllRefsResolve() throws Exception {
        final MetadataMirrorRepository mirror = mock(MetadataMirrorRepository.class);
        when(mirror.findDataSet("ds1")).thenReturn(Optional.of(mock(MirroredDataSet.class)));
        when(mirror.findOrganisationUnit("ou1")).thenReturn(Optional.of(mock(MirroredOrganisationUnit.class)));
        when(mirror.findDataElement("de1")).thenReturn(Optional.of(mock(MirroredDataElement.class)));
        final MetadataDriftDetector d = new MetadataDriftDetector(mirror);
        final JsonNode payload = mapper.readTree(
                "{\"dataSet\":\"ds1\",\"orgUnit\":\"ou1\","
                        + "\"dataValues\":[{\"dataElement\":\"de1\",\"value\":\"1\"}]}");
        assertThat(d.evaluate(entry(
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE, payload))
                .hasDrift()).isFalse();
    }

    @Test
    void detectsMissingDataElement() throws Exception {
        final MetadataMirrorRepository mirror = mock(MetadataMirrorRepository.class);
        when(mirror.findDataSet("ds1")).thenReturn(Optional.of(mock(MirroredDataSet.class)));
        when(mirror.findOrganisationUnit("ou1")).thenReturn(Optional.of(mock(MirroredOrganisationUnit.class)));
        when(mirror.findDataElement("missing")).thenReturn(Optional.empty());
        final MetadataDriftDetector d = new MetadataDriftDetector(mirror);
        final JsonNode payload = mapper.readTree(
                "{\"dataSet\":\"ds1\",\"orgUnit\":\"ou1\","
                        + "\"dataValues\":[{\"dataElement\":\"missing\",\"value\":\"1\"}]}");
        final MetadataDriftDetector.DriftReport r = d.evaluate(entry(
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE, payload));
        assertThat(r.hasDrift()).isTrue();
        assertThat(r.missing()).hasSize(1);
        assertThat(r.missing().get(0).kind()).isEqualTo("DATA_ELEMENT");
        assertThat(r.missing().get(0).uid()).isEqualTo("missing");
        assertThat(r.summary()).contains("DATA_ELEMENT=1");
    }

    @Test
    void detectsEventProgramMissing() throws Exception {
        final MetadataMirrorRepository mirror = mock(MetadataMirrorRepository.class);
        when(mirror.findProgram("gone")).thenReturn(Optional.empty());
        when(mirror.findOrganisationUnit("ou1")).thenReturn(Optional.of(mock(MirroredOrganisationUnit.class)));
        final MetadataDriftDetector d = new MetadataDriftDetector(mirror);
        final JsonNode payload = mapper.readTree(
                "{\"program\":\"gone\",\"programStage\":\"ps1\",\"orgUnit\":\"ou1\"}");
        final MetadataDriftDetector.DriftReport r = d.evaluate(entry(
                OperationJournalEntry.EntityType.EVENT, payload));
        assertThat(r.hasDrift()).isTrue();
        assertThat(r.missing()).extracting("kind").contains("PROGRAM");
    }

    @Test
    void detectsEnrollmentProgramMissing() throws Exception {
        final MetadataMirrorRepository mirror = mock(MetadataMirrorRepository.class);
        when(mirror.findProgram("gone")).thenReturn(Optional.empty());
        when(mirror.findOrganisationUnit("ou1")).thenReturn(Optional.of(mock(MirroredOrganisationUnit.class)));
        final MetadataDriftDetector d = new MetadataDriftDetector(mirror);
        final JsonNode payload = mapper.readTree("{\"program\":\"gone\",\"orgUnit\":\"ou1\"}");
        assertThat(d.evaluate(entry(OperationJournalEntry.EntityType.ENROLLMENT, payload))
                .hasDrift()).isTrue();
    }

    @Test
    void detectsTeiTypeMissing() throws Exception {
        final MetadataMirrorRepository mirror = mock(MetadataMirrorRepository.class);
        when(mirror.findTrackedEntityType("gone")).thenReturn(Optional.empty());
        when(mirror.findOrganisationUnit("ou1")).thenReturn(Optional.of(mock(MirroredOrganisationUnit.class)));
        final MetadataDriftDetector d = new MetadataDriftDetector(mirror);
        final JsonNode payload = mapper.readTree(
                "{\"trackedEntityType\":\"gone\",\"orgUnit\":\"ou1\"}");
        final MetadataDriftDetector.DriftReport r = d.evaluate(entry(
                OperationJournalEntry.EntityType.TRACKED_ENTITY, payload));
        assertThat(r.hasDrift()).isTrue();
        assertThat(r.missing().get(0).kind()).isEqualTo("TRACKED_ENTITY_TYPE");
    }

    @Test
    void nullPayloadIsNoDrift() {
        final MetadataDriftDetector d = new MetadataDriftDetector(
                mock(MetadataMirrorRepository.class));
        final OperationJournalEntry e = new OperationJournalEntry(
                UUID.randomUUID(), OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE,
                "ref", mapper.createObjectNode(),
                OperationJournalEntry.State.PENDING, 0, null, null,
                Instant.now(), Instant.now(), null);
        assertThat(d.evaluate(e).hasDrift()).isFalse();
    }

    @Test
    void summaryIsEmptyWhenNoDrift() {
        final MetadataDriftDetector d = new MetadataDriftDetector(
                mock(MetadataMirrorRepository.class));
        final OperationJournalEntry e = new OperationJournalEntry(
                UUID.randomUUID(), OperationJournalEntry.EntityType.ENROLLMENT, "ref",
                mapper.createObjectNode(),
                OperationJournalEntry.State.PENDING, 0, null, null,
                Instant.now(), Instant.now(), null);
        final MetadataDriftDetector.DriftReport r = d.evaluate(e);
        assertThat(r.summary()).isEqualTo("no-drift");
    }
}
