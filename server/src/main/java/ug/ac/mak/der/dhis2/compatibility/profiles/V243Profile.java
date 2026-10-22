package ug.ac.mak.der.dhis2.compatibility.profiles;

import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags;
import ug.ac.mak.der.dhis2.compatibility.Dhis2VersionProfile;
import ug.ac.mak.der.dhis2.compatibility.EndpointId;
import ug.ac.mak.der.dhis2.compatibility.EndpointPolicy;

/**
 * DHIS2 2.43 defaults.
 *
 * <p>Reference release notes: dhis2-releases v2.43.x (incl. 2.43.2 patch).
 * Highlights for DER:</p>
 * <ul>
 *   <li>Tracker programs cleanly split: {@code WITH_REGISTRATION} (tracker)
 *       vs {@code WITHOUT_REGISTRATION} (single-event). Metadata exposes the
 *       distinction via {@code programType}; DER must route event writes
 *       accordingly (single-event bypasses enrollment, tracker programs
 *       require TEI + enrollment).</li>
 *   <li>Audit surface switches to the per-entity change-log API:
 *       <code>/api/tracker/trackedEntities/{tei}/changeLogs</code>,
 *       <code>/api/tracker/events/{event}/changeLogs</code>,
 *       {@code /api/tracker/dataValues/changeLogs}. Legacy
 *       {@code /api/audits/*} still answer but are deprecated.</li>
 *   <li><code>PATCH /api/dataElements/{id}</code> supported.</li>
 *   <li>Legacy tracker endpoints remain deprecated.</li>
 * </ul>
 */
public final class V243Profile implements Dhis2VersionProfile {

    private final V242Profile base = new V242Profile();

    @Override
    public String minorKey() {
        return "V2_43";
    }

    @Override
    public String label() {
        return "2.43";
    }

    @Override
    public void apply(final CapabilityFlags.Builder b) {
        base.apply(b);
        b.trackerApi(CapabilityFlags.TrackerApi.BOTH)
         .supportsPatchDataElements(true)
         .auditSurface(CapabilityFlags.AuditSurface.BOTH)
         .extra("program-type-split", "2.43.2 clarified single-event vs tracker-program metadata");

        // Changelog API is live from 2.43.
        b.endpoint(EndpointId.CHANGELOG_TRACKED_ENTITY,
                EndpointPolicy.present("/api/tracker/trackedEntities/{tei}/changeLogs", 43));
        b.endpoint(EndpointId.CHANGELOG_EVENT,
                EndpointPolicy.present("/api/tracker/events/{event}/changeLogs", 43));
        b.endpoint(EndpointId.CHANGELOG_DATA_VALUES,
                EndpointPolicy.present("/api/tracker/dataValues/changeLogs", 43));

        // Legacy audits deprecated.
        b.endpoint(EndpointId.LEGACY_AUDITS_DATA_VALUE,
                EndpointPolicy.deprecated("/api/audits/dataValue", 41,
                        EndpointId.CHANGELOG_DATA_VALUES, "2.43 changelog API replaces /api/audits/*"));
        b.endpoint(EndpointId.LEGACY_AUDITS_TRACKED_ENTITY_DATA_VALUE,
                EndpointPolicy.deprecated("/api/audits/trackedEntityDataValue", 41,
                        EndpointId.CHANGELOG_EVENT, "2.43 changelog API replaces /api/audits/*"));
        b.endpoint(EndpointId.LEGACY_AUDITS_TRACKED_ENTITY_ATTRIBUTE_VALUE,
                EndpointPolicy.deprecated("/api/audits/trackedEntityAttributeValue", 41,
                        EndpointId.CHANGELOG_TRACKED_ENTITY,
                        "2.43 changelog API replaces /api/audits/*"));
    }
}
