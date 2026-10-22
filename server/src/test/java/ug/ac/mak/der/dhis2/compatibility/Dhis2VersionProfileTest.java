package ug.ac.mak.der.dhis2.compatibility;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags.ImportSummaryShape;
import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags.PeriodType;
import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags.TrackerApi;
import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags.WebMessageShape;
import ug.ac.mak.der.dhis2.compatibility.profiles.V241Profile;
import ug.ac.mak.der.dhis2.compatibility.profiles.V242Profile;
import ug.ac.mak.der.dhis2.compatibility.profiles.V243Profile;
import ug.ac.mak.der.dhis2.compatibility.profiles.V244Profile;

class Dhis2VersionProfileTest {

    @Test
    void v241IsLegacyOnlyClassicShape() {
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        new V241Profile().apply(b);
        final CapabilityFlags caps = b.build();
        assertThat(caps.trackerApi()).isEqualTo(TrackerApi.LEGACY_ONLY);
        assertThat(caps.importSummaryShape()).isEqualTo(ImportSummaryShape.CLASSIC);
        assertThat(caps.webMessageShape()).isEqualTo(WebMessageShape.DHIS2_2_41);
        assertThat(caps.supportsPatchDataElements()).isFalse();
        assertThat(caps.supportedPeriodTypes()).contains(PeriodType.YEARLY, PeriodType.FINANCIALOCT);
        assertThat(caps.supportedPeriodTypes()).doesNotContain(PeriodType.BIWEEKLY);
    }

    @Test
    void v242AddsBiweeklyAndSwitchesShape() {
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        new V242Profile().apply(b);
        final CapabilityFlags caps = b.build();
        assertThat(caps.trackerApi()).isEqualTo(TrackerApi.BOTH);
        assertThat(caps.importSummaryShape()).isEqualTo(ImportSummaryShape.TRACKER_IMPORT_REPORT);
        assertThat(caps.supportedPeriodTypes()).contains(PeriodType.BIWEEKLY);
    }

    @Test
    void v243TurnsOnPatchDataElements() {
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        new V243Profile().apply(b);
        final CapabilityFlags caps = b.build();
        assertThat(caps.supportsPatchDataElements()).isTrue();
        assertThat(caps.trackerApi()).isEqualTo(TrackerApi.BOTH);
    }

    @Test
    void v244GoesTrackerOnlyAndSwitchesWebMessageShape() {
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        new V244Profile().apply(b);
        final CapabilityFlags caps = b.build();
        assertThat(caps.trackerApi()).isEqualTo(TrackerApi.TRACKER_ONLY);
        assertThat(caps.webMessageShape()).isEqualTo(WebMessageShape.DHIS2_2_44);
    }
}
