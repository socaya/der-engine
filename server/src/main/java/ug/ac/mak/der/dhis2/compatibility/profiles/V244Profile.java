package ug.ac.mak.der.dhis2.compatibility.profiles;

import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags;
import ug.ac.mak.der.dhis2.compatibility.Dhis2VersionProfile;
import ug.ac.mak.der.dhis2.compatibility.EndpointId;
import ug.ac.mak.der.dhis2.compatibility.EndpointPolicy;

/**
 * DHIS2 2.44 defaults.
 *
 * <p>Reference release notes: dhis2-releases v2.44.x. Highlights for DER:</p>
 * <ul>
 *   <li>Legacy tracker endpoints ({@code /api/trackedEntityInstances},
 *       {@code /api/events}, {@code /api/enrollments}) are REMOVED. All
 *       tracker writes must use {@code /api/tracker/*}.</li>
 *   <li>Audit surface is the per-entity tracker changeLogs API only; legacy
 *       <code>/api/audits</code> is REMOVED.</li>
 *   <li>WebMessage shape evolves to the 2.44 variant used by stock DHIS2 clients.</li>
 * </ul>
 */
public final class V244Profile implements Dhis2VersionProfile {

    private final V243Profile base = new V243Profile();

    @Override
    public String minorKey() {
        return "V2_44";
    }

    @Override
    public String label() {
        return "2.44";
    }

    @Override
    public void apply(final CapabilityFlags.Builder b) {
        base.apply(b);
        b.trackerApi(CapabilityFlags.TrackerApi.TRACKER_ONLY)
         .webMessageShape(CapabilityFlags.WebMessageShape.DHIS2_2_44)
         .auditSurface(CapabilityFlags.AuditSurface.CHANGELOG_API);

        b.endpoint(EndpointId.LEGACY_TEI_LIST,
                EndpointPolicy.removed("/api/trackedEntityInstances", 41, 44,
                        EndpointId.TRACKER_TRACKED_ENTITIES, "removed in 2.44"));
        b.endpoint(EndpointId.LEGACY_TEI_READ,
                EndpointPolicy.removed("/api/trackedEntityInstances/{id}", 41, 44,
                        EndpointId.TRACKER_TRACKED_ENTITIES, "removed in 2.44"));
        b.endpoint(EndpointId.LEGACY_EVENTS_LIST,
                EndpointPolicy.removed("/api/events", 41, 44,
                        EndpointId.TRACKER_EVENTS, "removed in 2.44"));
        b.endpoint(EndpointId.LEGACY_EVENTS_READ,
                EndpointPolicy.removed("/api/events/{id}", 41, 44,
                        EndpointId.TRACKER_EVENTS, "removed in 2.44"));
        b.endpoint(EndpointId.LEGACY_ENROLLMENTS,
                EndpointPolicy.removed("/api/enrollments", 41, 44,
                        EndpointId.TRACKER_ENROLLMENTS, "removed in 2.44"));

        b.endpoint(EndpointId.LEGACY_AUDITS_DATA_VALUE,
                EndpointPolicy.removed("/api/audits/dataValue", 41, 44,
                        EndpointId.CHANGELOG_DATA_VALUES, "removed in 2.44"));
        b.endpoint(EndpointId.LEGACY_AUDITS_TRACKED_ENTITY_DATA_VALUE,
                EndpointPolicy.removed("/api/audits/trackedEntityDataValue", 41, 44,
                        EndpointId.CHANGELOG_EVENT, "removed in 2.44"));
        b.endpoint(EndpointId.LEGACY_AUDITS_TRACKED_ENTITY_ATTRIBUTE_VALUE,
                EndpointPolicy.removed("/api/audits/trackedEntityAttributeValue", 41, 44,
                        EndpointId.CHANGELOG_TRACKED_ENTITY, "removed in 2.44"));
    }
}
