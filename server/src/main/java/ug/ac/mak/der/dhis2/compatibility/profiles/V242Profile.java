package ug.ac.mak.der.dhis2.compatibility.profiles;

import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags;
import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags.PeriodType;
import ug.ac.mak.der.dhis2.compatibility.Dhis2VersionProfile;
import ug.ac.mak.der.dhis2.compatibility.EndpointId;
import ug.ac.mak.der.dhis2.compatibility.EndpointPolicy;

/**
 * DHIS2 2.42 defaults.
 *
 * <p>Reference release notes: dhis2-releases v2.42.x. Highlights for DER:</p>
 * <ul>
 *   <li>Modern {@code /api/tracker/*} is the preferred write path; the
 *       {@code TrackerImportReport} response shape fully replaces the
 *       classic {@code ImportSummary} for tracker writes.</li>
 *   <li>Legacy tracker endpoints ({@code /api/trackedEntityInstances},
 *       {@code /api/events}, {@code /api/enrollments}) are marked DEPRECATED
 *       but still answer.</li>
 *   <li>Biweekly period type added.</li>
 *   <li>Audit surface still uses {@code /api/audits/*}.</li>
 * </ul>
 */
public final class V242Profile implements Dhis2VersionProfile {

    private final V241Profile base = new V241Profile();

    @Override
    public String minorKey() {
        return "V2_42";
    }

    @Override
    public String label() {
        return "2.42";
    }

    @Override
    public void apply(final CapabilityFlags.Builder b) {
        base.apply(b);
        b.trackerApi(CapabilityFlags.TrackerApi.BOTH)
         .importSummaryShape(CapabilityFlags.ImportSummaryShape.TRACKER_IMPORT_REPORT)
         .addPeriodType(PeriodType.BIWEEKLY);

        // Mark legacy tracker endpoints as deprecated on 2.42.
        b.endpoint(EndpointId.LEGACY_TEI_LIST,
                EndpointPolicy.deprecated("/api/trackedEntityInstances", 41,
                        EndpointId.TRACKER_TRACKED_ENTITIES, "2.42 deprecation notice"));
        b.endpoint(EndpointId.LEGACY_TEI_READ,
                EndpointPolicy.deprecated("/api/trackedEntityInstances/{id}", 41,
                        EndpointId.TRACKER_TRACKED_ENTITIES, "2.42 deprecation notice"));
        b.endpoint(EndpointId.LEGACY_EVENTS_LIST,
                EndpointPolicy.deprecated("/api/events", 41,
                        EndpointId.TRACKER_EVENTS, "2.42 deprecation notice"));
        b.endpoint(EndpointId.LEGACY_EVENTS_READ,
                EndpointPolicy.deprecated("/api/events/{id}", 41,
                        EndpointId.TRACKER_EVENTS, "2.42 deprecation notice"));
        b.endpoint(EndpointId.LEGACY_ENROLLMENTS,
                EndpointPolicy.deprecated("/api/enrollments", 41,
                        EndpointId.TRACKER_ENROLLMENTS, "2.42 deprecation notice"));
    }
}
