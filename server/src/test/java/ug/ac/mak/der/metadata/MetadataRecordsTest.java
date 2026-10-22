package ug.ac.mak.der.metadata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.junit.jupiter.api.Test;

/**
 * One file covers the five mirror records and the metadata snapshot record so
 * every branch of the validators + accessors is exercised.
 */
class MetadataRecordsTest {

    private static final JsonNode EMPTY = new ObjectMapper().createObjectNode();

    @Test
    void organisationUnitAcceptsOptionalFields() {
        final MirroredOrganisationUnit ou = new MirroredOrganisationUnit(
                "a", "A", "/root", 2, "parent", EMPTY);
        assertThat(ou.path()).isEqualTo("/root");
        assertThat(ou.level()).isEqualTo(2);
        assertThat(ou.parentUid()).isEqualTo("parent");
    }

    @Test
    void organisationUnitRejectsNulls() {
        assertThatThrownBy(() -> new MirroredOrganisationUnit(null, "A", null, null, null, EMPTY))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredOrganisationUnit("a", null, null, null, null, EMPTY))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredOrganisationUnit("a", "A", null, null, null, null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void dataElementExposesTypes() {
        final MirroredDataElement de = new MirroredDataElement("a", "A", "NUMBER", "AGGREGATE", EMPTY);
        assertThat(de.valueType()).isEqualTo("NUMBER");
        assertThat(de.domainType()).isEqualTo("AGGREGATE");
    }

    @Test
    void dataElementRejectsNulls() {
        assertThatThrownBy(() -> new MirroredDataElement(null, "A", "", "", EMPTY))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredDataElement("a", null, "", "", EMPTY))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredDataElement("a", "A", "", "", null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void dataSetAcceptsOptionalPeriodType() {
        final MirroredDataSet ds = new MirroredDataSet("a", "A", "Monthly", EMPTY);
        assertThat(ds.periodType()).isEqualTo("Monthly");
    }

    @Test
    void dataSetRejectsNulls() {
        assertThatThrownBy(() -> new MirroredDataSet(null, "A", "", EMPTY))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredDataSet("a", null, "", EMPTY))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredDataSet("a", "A", "", null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void programExposesTypes() {
        final MirroredProgram p = new MirroredProgram("a", "A", "WITH_REGISTRATION", "tet-id", EMPTY);
        assertThat(p.programType()).isEqualTo("WITH_REGISTRATION");
        assertThat(p.trackedEntityTypeUid()).isEqualTo("tet-id");
    }

    @Test
    void programRejectsNulls() {
        assertThatThrownBy(() -> new MirroredProgram(null, "A", "", "", EMPTY))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredProgram("a", null, "", "", EMPTY))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredProgram("a", "A", "", "", null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void trackedEntityTypeAcceptsRequiredFields() {
        final MirroredTrackedEntityType tet = new MirroredTrackedEntityType("a", "A", EMPTY);
        assertThat(tet.dhis2Uid()).isEqualTo("a");
    }

    @Test
    void trackedEntityTypeRejectsNulls() {
        assertThatThrownBy(() -> new MirroredTrackedEntityType(null, "A", EMPTY))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredTrackedEntityType("a", null, EMPTY))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredTrackedEntityType("a", "A", null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void requirePayloadDoesNotWrapNonNullOutput() {
        final JsonNode node = JsonNodeFactory.instance.textNode("x");
        assertThat(MirroredEntity.requirePayload(node)).isSameAs(node);
    }

    @Test
    void snapshotCountsSumToTotal() {
        final MetadataSnapshot.Counts c = new MetadataSnapshot.Counts(1, 2, 3, 4, 5);
        assertThat(c.total()).isEqualTo(15);
    }

    @Test
    void snapshotRejectsNulls() {
        final Instant now = Instant.now();
        final MetadataSnapshot.Counts counts = new MetadataSnapshot.Counts(0, 0, 0, 0, 0);
        assertThatThrownBy(() -> new MetadataSnapshot(1L, null, UUID.randomUUID(), now, counts, "", "", ""))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MetadataSnapshot(1L, "url", UUID.randomUUID(), null, counts, "", "", ""))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MetadataSnapshot(1L, "url", UUID.randomUUID(), now, null, "", "", ""))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void snapshotAllowsNullImportedByAndNullFingerprint() {
        final MetadataSnapshot s = new MetadataSnapshot(
                7L, "url", null,
                Instant.parse("2026-10-22T10:00:00Z"),
                new MetadataSnapshot.Counts(0, 0, 0, 0, 0), null, null, null);
        assertThat(s.importedBy()).isNull();
        assertThat(s.fingerprint()).isNull();
    }
}
