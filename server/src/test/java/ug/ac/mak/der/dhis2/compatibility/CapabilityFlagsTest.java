package ug.ac.mak.der.dhis2.compatibility;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags.ImportSummaryShape;
import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags.MetadataEntityType;
import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags.PeriodType;
import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags.TrackerApi;
import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags.WebMessageShape;

class CapabilityFlagsTest {

    @Test
    void builderPopulatesEveryField() {
        final CapabilityFlags caps = new CapabilityFlags.Builder()
                .trackerApi(TrackerApi.TRACKER_ONLY)
                .importSummaryShape(ImportSummaryShape.TRACKER_IMPORT_REPORT)
                .webMessageShape(WebMessageShape.DHIS2_2_44)
                .auditSurface(CapabilityFlags.AuditSurface.CHANGELOG_API)
                .supportsCategoryOptionCombosEndpoint(true)
                .supportsProgramRulesEndpoint(true)
                .supportsMetadataBulkEndpoint(true)
                .supportsPatchDataElements(true)
                .addPeriodType(PeriodType.YEARLY)
                .addPeriodTypes(PeriodType.MONTHLY, PeriodType.DAILY)
                .metadataFields(MetadataEntityType.DATA_ELEMENT, List.of("id", "valueType"))
                .addSupportedProgramType(CapabilityFlags.SupportedProgramType.TRACKER)
                .addSupportedProgramType(CapabilityFlags.SupportedProgramType.EVENT)
                .endpoint(ug.ac.mak.der.dhis2.compatibility.EndpointId.TRACKER_EVENTS,
                        ug.ac.mak.der.dhis2.compatibility.EndpointPolicy.present("/api/tracker/events", 41))
                .extra("x", 1)
                .build();
        assertThat(caps.trackerApi()).isEqualTo(TrackerApi.TRACKER_ONLY);
        assertThat(caps.importSummaryShape()).isEqualTo(ImportSummaryShape.TRACKER_IMPORT_REPORT);
        assertThat(caps.webMessageShape()).isEqualTo(WebMessageShape.DHIS2_2_44);
        assertThat(caps.supportsCategoryOptionCombosEndpoint()).isTrue();
        assertThat(caps.supportsProgramRulesEndpoint()).isTrue();
        assertThat(caps.supportsMetadataBulkEndpoint()).isTrue();
        assertThat(caps.supportsPatchDataElements()).isTrue();
        assertThat(caps.supportedPeriodTypes()).containsExactly(
                PeriodType.YEARLY, PeriodType.MONTHLY, PeriodType.DAILY);
        assertThat(caps.metadataFields().get(MetadataEntityType.DATA_ELEMENT))
                .containsExactly("id", "valueType");
        assertThat(caps.extras()).containsEntry("x", 1);
        assertThat(caps.auditSurface()).isEqualTo(CapabilityFlags.AuditSurface.CHANGELOG_API);
        assertThat(caps.supportedProgramTypes())
                .containsExactly(CapabilityFlags.SupportedProgramType.TRACKER,
                        CapabilityFlags.SupportedProgramType.EVENT);
        assertThat(caps.endpointPolicy(ug.ac.mak.der.dhis2.compatibility.EndpointId.TRACKER_EVENTS)
                .status()).isEqualTo(ug.ac.mak.der.dhis2.compatibility.EndpointPolicy.Status.PRESENT);
    }

    @Test
    void endpointPolicyReturnsNotApplicableWhenUnknown() {
        final CapabilityFlags caps = new CapabilityFlags.Builder().build();
        assertThat(caps.endpointPolicy(ug.ac.mak.der.dhis2.compatibility.EndpointId.TRACKER_IMPORT)
                .status())
                .isEqualTo(ug.ac.mak.der.dhis2.compatibility.EndpointPolicy.Status.NOT_APPLICABLE);
    }

    @Test
    void collectionsAreImmutable() {
        final CapabilityFlags caps = new CapabilityFlags.Builder().build();
        assertThatThrownBy(() -> caps.supportedPeriodTypes().add(PeriodType.YEARLY))
                .isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> caps.metadataFields().put(MetadataEntityType.PROGRAM, List.of()))
                .isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> caps.extras().put("y", 2))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void canonicalConstructorAcceptsNulls() {
        final CapabilityFlags caps = new CapabilityFlags(
                TrackerApi.NONE, ImportSummaryShape.CLASSIC,
                false, false, false, false,
                null, null, WebMessageShape.DHIS2_2_41, null, null, null, null);
        assertThat(caps.supportedPeriodTypes()).isEmpty();
        assertThat(caps.metadataFields()).isEmpty();
        assertThat(caps.extras()).isEmpty();
    }

    @Test
    void probeReportHandlesNullOutcomes() {
        final ProbeReport r = new ProbeReport(java.time.Instant.now(), 0L, false, null, null);
        assertThat(r.outcomes()).isEmpty();
    }

    @Test
    void canonicalConstructorRejectsNullEnums() {
        assertThatThrownBy(() -> new CapabilityFlags(
                null, ImportSummaryShape.CLASSIC, false, false, false, false,
                null, null, WebMessageShape.DHIS2_2_41, null, null, null, null))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new CapabilityFlags(
                TrackerApi.NONE, null, false, false, false, false,
                null, null, WebMessageShape.DHIS2_2_41, null, null, null, null))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new CapabilityFlags(
                TrackerApi.NONE, ImportSummaryShape.CLASSIC, false, false, false, false,
                null, null, null, null, null, null, null))
                .isInstanceOf(NullPointerException.class);
    }
}
