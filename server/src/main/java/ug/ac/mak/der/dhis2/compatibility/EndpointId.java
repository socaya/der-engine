package ug.ac.mak.der.dhis2.compatibility;

/**
 * Stable identifier for each DHIS2 Web API endpoint DER cares about.
 *
 * <p>DER code consults {@link CapabilityFlags#endpointPolicy(EndpointId)}
 * before issuing a request so a per-minor difference in path or availability
 * never leaks past the compatibility layer. The matrix of endpoint-by-version
 * states lives in {@code docs/verification/compatibility/version-endpoint-matrix.csv}.</p>
 */
public enum EndpointId {
    SYSTEM_INFO,
    SYSTEM_PING,
    ME,

    // Metadata read
    METADATA_BULK,
    ORGANISATION_UNITS,
    DATA_ELEMENTS,
    DATA_SETS,
    PROGRAMS,
    PROGRAM_STAGES,
    TRACKED_ENTITY_TYPES,
    TRACKED_ENTITY_ATTRIBUTES,
    CATEGORY_OPTION_COMBOS,
    PROGRAM_RULES,
    PROGRAM_RULE_ACTIONS,
    PROGRAM_RULE_VARIABLES,

    // Aggregate data
    DATA_VALUE_SETS,

    // Legacy tracker (2.41-2.42; deprecated 2.43; removed 2.44+)
    LEGACY_TEI_LIST,
    LEGACY_TEI_READ,
    LEGACY_EVENTS_LIST,
    LEGACY_EVENTS_READ,
    LEGACY_ENROLLMENTS,

    // Modern tracker (2.42+)
    TRACKER_IMPORT,
    TRACKER_TRACKED_ENTITIES,
    TRACKER_ENROLLMENTS,
    TRACKER_EVENTS,
    TRACKER_RELATIONSHIPS,

    // Audit / changelog surface
    LEGACY_AUDITS_DATA_VALUE,
    LEGACY_AUDITS_TRACKED_ENTITY_DATA_VALUE,
    LEGACY_AUDITS_TRACKED_ENTITY_ATTRIBUTE_VALUE,
    CHANGELOG_TRACKED_ENTITY,
    CHANGELOG_EVENT,
    CHANGELOG_DATA_VALUES
}
