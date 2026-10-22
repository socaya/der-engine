package ug.ac.mak.der.dhis2.compatibility.profiles;

import java.util.List;

import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags;
import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags.AuditSurface;
import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags.MetadataEntityType;
import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags.PeriodType;
import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags.SupportedProgramType;
import ug.ac.mak.der.dhis2.compatibility.Dhis2VersionProfile;
import ug.ac.mak.der.dhis2.compatibility.EndpointId;
import ug.ac.mak.der.dhis2.compatibility.EndpointPolicy;

/**
 * DHIS2 2.41 defaults.
 *
 * <p>Reference release notes: dhis2-releases v2.41.x; see
 * {@code docs/verification/compatibility/version-endpoint-matrix.csv}.</p>
 *
 * <p>Highlights relevant to DER:</p>
 * <ul>
 *   <li>Legacy tracker endpoints ({@code /api/trackedEntityInstances},
 *       {@code /api/events}, {@code /api/enrollments}) are still primary.</li>
 *   <li>The modern {@code /api/tracker/*} endpoints are present but not yet the only path.</li>
 *   <li>Audit surface is the legacy {@code /api/audits/*} subtree.</li>
 *   <li>Both tracker programs ({@code WITH_REGISTRATION}) and single-event programs
 *       ({@code WITHOUT_REGISTRATION}) exist, with distinct metadata but the same
 *       write endpoints.</li>
 * </ul>
 */
public final class V241Profile implements Dhis2VersionProfile {

    @Override
    public String minorKey() {
        return "V2_41";
    }

    @Override
    public String label() {
        return "2.41";
    }

    @Override
    public void apply(final CapabilityFlags.Builder b) {
        b.trackerApi(CapabilityFlags.TrackerApi.LEGACY_ONLY)
         .importSummaryShape(CapabilityFlags.ImportSummaryShape.CLASSIC)
         .webMessageShape(CapabilityFlags.WebMessageShape.DHIS2_2_41)
         .auditSurface(AuditSurface.LEGACY_AUDITS)
         .supportsCategoryOptionCombosEndpoint(true)
         .supportsProgramRulesEndpoint(true)
         .supportsMetadataBulkEndpoint(true)
         .supportsPatchDataElements(false)
         .addSupportedProgramType(SupportedProgramType.TRACKER)
         .addSupportedProgramType(SupportedProgramType.EVENT)
         .addPeriodTypes(
                 PeriodType.YEARLY, PeriodType.QUARTERLY, PeriodType.MONTHLY,
                 PeriodType.WEEKLY, PeriodType.DAILY, PeriodType.BIMONTHLY,
                 PeriodType.SIXMONTHLY, PeriodType.SIXMONTHLYAPRIL,
                 PeriodType.FINANCIALOCT, PeriodType.FINANCIALJULY, PeriodType.FINANCIALAPRIL
         );
        applyFields(b);
        applyEndpoints(b);
    }

    static void applyFields(final CapabilityFlags.Builder b) {
        b.metadataFields(MetadataEntityType.ORGANISATION_UNIT,
                List.of("id", "displayName", "path", "level", "parent[id]"));
        b.metadataFields(MetadataEntityType.DATA_ELEMENT,
                List.of("id", "displayName", "valueType", "aggregationType",
                        "domainType", "optionSet[id]"));
        b.metadataFields(MetadataEntityType.DATA_SET,
                List.of("id", "displayName", "periodType"));
        b.metadataFields(MetadataEntityType.PROGRAM,
                List.of("id", "displayName", "programType", "trackedEntityType[id]"));
        b.metadataFields(MetadataEntityType.TRACKED_ENTITY_TYPE,
                List.of("id", "displayName"));
        b.metadataFields(MetadataEntityType.CATEGORY_OPTION_COMBO,
                List.of("id", "displayName", "categoryCombo[id]"));
        b.metadataFields(MetadataEntityType.PROGRAM_STAGE,
                List.of("id", "displayName", "program[id]", "repeatable",
                        "programStageDataElements[dataElement[id],compulsory,sortOrder]"));
        b.metadataFields(MetadataEntityType.TRACKED_ENTITY_ATTRIBUTE,
                List.of("id", "displayName", "valueType", "unique"));
        b.metadataFields(MetadataEntityType.PROGRAM_RULE,
                List.of("id", "displayName", "program[id]", "priority", "condition",
                        "programRuleActions[id,programRuleActionType,dataElement[id],"
                                + "trackedEntityAttribute[id],data,content]"));
    }

    static void applyEndpoints(final CapabilityFlags.Builder b) {
        b.endpoint(EndpointId.SYSTEM_INFO, EndpointPolicy.present("/api/system/info", 41));
        b.endpoint(EndpointId.SYSTEM_PING, EndpointPolicy.present("/api/system/ping", 41));
        b.endpoint(EndpointId.ME, EndpointPolicy.present("/api/me", 41));

        b.endpoint(EndpointId.METADATA_BULK, EndpointPolicy.present("/api/metadata", 41));
        b.endpoint(EndpointId.ORGANISATION_UNITS, EndpointPolicy.present("/api/organisationUnits", 41));
        b.endpoint(EndpointId.DATA_ELEMENTS, EndpointPolicy.present("/api/dataElements", 41));
        b.endpoint(EndpointId.DATA_SETS, EndpointPolicy.present("/api/dataSets", 41));
        b.endpoint(EndpointId.PROGRAMS, EndpointPolicy.present("/api/programs", 41));
        b.endpoint(EndpointId.PROGRAM_STAGES, EndpointPolicy.present("/api/programStages", 41));
        b.endpoint(EndpointId.TRACKED_ENTITY_TYPES, EndpointPolicy.present("/api/trackedEntityTypes", 41));
        b.endpoint(EndpointId.TRACKED_ENTITY_ATTRIBUTES,
                EndpointPolicy.present("/api/trackedEntityAttributes", 41));
        b.endpoint(EndpointId.CATEGORY_OPTION_COMBOS,
                EndpointPolicy.present("/api/categoryOptionCombos", 41));
        b.endpoint(EndpointId.PROGRAM_RULES, EndpointPolicy.present("/api/programRules", 41));
        b.endpoint(EndpointId.PROGRAM_RULE_ACTIONS,
                EndpointPolicy.present("/api/programRuleActions", 41));
        b.endpoint(EndpointId.PROGRAM_RULE_VARIABLES,
                EndpointPolicy.present("/api/programRuleVariables", 41));

        b.endpoint(EndpointId.DATA_VALUE_SETS, EndpointPolicy.present("/api/dataValueSets", 41));

        b.endpoint(EndpointId.LEGACY_TEI_LIST,
                EndpointPolicy.present("/api/trackedEntityInstances", 41));
        b.endpoint(EndpointId.LEGACY_TEI_READ,
                EndpointPolicy.present("/api/trackedEntityInstances/{id}", 41));
        b.endpoint(EndpointId.LEGACY_EVENTS_LIST, EndpointPolicy.present("/api/events", 41));
        b.endpoint(EndpointId.LEGACY_EVENTS_READ, EndpointPolicy.present("/api/events/{id}", 41));
        b.endpoint(EndpointId.LEGACY_ENROLLMENTS, EndpointPolicy.present("/api/enrollments", 41));

        b.endpoint(EndpointId.TRACKER_IMPORT, EndpointPolicy.present("/api/tracker", 41));
        b.endpoint(EndpointId.TRACKER_TRACKED_ENTITIES,
                EndpointPolicy.present("/api/tracker/trackedEntities", 41));
        b.endpoint(EndpointId.TRACKER_ENROLLMENTS,
                EndpointPolicy.present("/api/tracker/enrollments", 41));
        b.endpoint(EndpointId.TRACKER_EVENTS, EndpointPolicy.present("/api/tracker/events", 41));
        b.endpoint(EndpointId.TRACKER_RELATIONSHIPS,
                EndpointPolicy.present("/api/tracker/relationships", 41));

        b.endpoint(EndpointId.LEGACY_AUDITS_DATA_VALUE,
                EndpointPolicy.present("/api/audits/dataValue", 41));
        b.endpoint(EndpointId.LEGACY_AUDITS_TRACKED_ENTITY_DATA_VALUE,
                EndpointPolicy.present("/api/audits/trackedEntityDataValue", 41));
        b.endpoint(EndpointId.LEGACY_AUDITS_TRACKED_ENTITY_ATTRIBUTE_VALUE,
                EndpointPolicy.present("/api/audits/trackedEntityAttributeValue", 41));
        b.endpoint(EndpointId.CHANGELOG_TRACKED_ENTITY, notApplicable("changelog surface introduced in 2.43"));
        b.endpoint(EndpointId.CHANGELOG_EVENT, notApplicable("changelog surface introduced in 2.43"));
        b.endpoint(EndpointId.CHANGELOG_DATA_VALUES, notApplicable("changelog surface introduced in 2.43"));
    }

    static EndpointPolicy notApplicable(final String reason) {
        return new EndpointPolicy("", EndpointPolicy.Status.NOT_APPLICABLE, null, null, null, reason);
    }
}
