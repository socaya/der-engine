package ug.ac.mak.der.dhis2.compatibility;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Resolved DHIS2 capability flags served by {@link Dhis2CompatibilityEngine}.
 *
 * <p>Immutable snapshot that every DER code path consults when it needs to
 * know "which Web API dialect does the central speak today?" — see ADR-0006
 * for the probe + profile overlay rules.</p>
 */
public record CapabilityFlags(
        TrackerApi trackerApi,
        ImportSummaryShape importSummaryShape,
        boolean supportsCategoryOptionCombosEndpoint,
        boolean supportsProgramRulesEndpoint,
        boolean supportsMetadataBulkEndpoint,
        boolean supportsPatchDataElements,
        Set<PeriodType> supportedPeriodTypes,
        Map<MetadataEntityType, List<String>> metadataFields,
        WebMessageShape webMessageShape,
        AuditSurface auditSurface,
        Set<SupportedProgramType> supportedProgramTypes,
        Map<EndpointId, EndpointPolicy> endpointPolicies,
        Map<String, Object> extras
) {

    public CapabilityFlags {
        Objects.requireNonNull(trackerApi, "trackerApi");
        Objects.requireNonNull(importSummaryShape, "importSummaryShape");
        Objects.requireNonNull(webMessageShape, "webMessageShape");
        auditSurface = auditSurface == null ? AuditSurface.LEGACY_AUDITS : auditSurface;
        supportedPeriodTypes = supportedPeriodTypes == null
                ? Collections.unmodifiableSet(new LinkedHashSet<>())
                : Collections.unmodifiableSet(new LinkedHashSet<>(supportedPeriodTypes));
        metadataFields = metadataFields == null
                ? Collections.unmodifiableMap(new LinkedHashMap<>())
                : Collections.unmodifiableMap(new LinkedHashMap<>(metadataFields));
        supportedProgramTypes = supportedProgramTypes == null
                ? Collections.unmodifiableSet(new LinkedHashSet<>())
                : Collections.unmodifiableSet(new LinkedHashSet<>(supportedProgramTypes));
        endpointPolicies = endpointPolicies == null
                ? Collections.unmodifiableMap(new LinkedHashMap<>())
                : Collections.unmodifiableMap(new LinkedHashMap<>(endpointPolicies));
        extras = extras == null
                ? Collections.unmodifiableMap(new LinkedHashMap<>())
                : Collections.unmodifiableMap(new LinkedHashMap<>(extras));
    }

    /** Looks up a known endpoint by {@link EndpointId}; returns {@link EndpointPolicy.Status#NOT_APPLICABLE} if unknown. */
    public EndpointPolicy endpointPolicy(final EndpointId id) {
        final EndpointPolicy p = endpointPolicies.get(id);
        return p == null
                ? new EndpointPolicy("", EndpointPolicy.Status.NOT_APPLICABLE, null, null, null, null)
                : p;
    }

    public enum TrackerApi {
        /** No tracker endpoints reachable; refuse tracker writes. */
        NONE,
        /** Both {@code /api/tracker/*} and legacy {@code /api/trackedEntityInstances} answer. */
        BOTH,
        /** Only the modern {@code /api/tracker/*}. */
        TRACKER_ONLY,
        /** Only the legacy {@code /api/trackedEntityInstances} + {@code /api/events}. */
        LEGACY_ONLY
    }

    public enum ImportSummaryShape {
        /** DHIS2 2.41 shape: {@code ImportSummary} + {@code importCount}. */
        CLASSIC,
        /** DHIS2 2.42+ shape: {@code TrackerImportReport} with validation reports. */
        TRACKER_IMPORT_REPORT
    }

    public enum WebMessageShape {
        DHIS2_2_41,
        DHIS2_2_44
    }

    public enum MetadataEntityType {
        ORGANISATION_UNIT,
        DATA_ELEMENT,
        DATA_SET,
        PROGRAM,
        TRACKED_ENTITY_TYPE,
        CATEGORY_OPTION_COMBO,
        PROGRAM_STAGE,
        TRACKED_ENTITY_ATTRIBUTE,
        PROGRAM_RULE
    }

    /**
     * Where DER expects to find audit / change-history data on the central.
     * ADR-0006 overlays this onto DER's own change-log API shape.
     */
    public enum AuditSurface {
        /** 2.41/2.42 shape: {@code /api/audits/*} subresources. */
        LEGACY_AUDITS,
        /** 2.43+ shape: {@code /api/tracker/trackedEntities/{tei}/changeLogs} etc. */
        CHANGELOG_API,
        /** Both still present (deprecated-legacy); accept either on read. */
        BOTH
    }

    /** DHIS2 program types DER's write path understands. */
    public enum SupportedProgramType {
        /** {@code programType=WITH_REGISTRATION}: tracker programs with TEI + enrollment. */
        TRACKER,
        /** {@code programType=WITHOUT_REGISTRATION}: single-event programs. */
        EVENT
    }

    public enum PeriodType {
        YEARLY, QUARTERLY, MONTHLY, WEEKLY, DAILY,
        BIMONTHLY, SIXMONTHLY, SIXMONTHLYAPRIL,
        FINANCIALOCT, FINANCIALJULY, FINANCIALAPRIL,
        BIWEEKLY
    }

    /** Mutable builder used by profiles + probe overlays. */
    public static final class Builder {
        private TrackerApi trackerApi = TrackerApi.NONE;
        private ImportSummaryShape importSummaryShape = ImportSummaryShape.CLASSIC;
        private boolean supportsCategoryOptionCombosEndpoint;
        private boolean supportsProgramRulesEndpoint;
        private boolean supportsMetadataBulkEndpoint;
        private boolean supportsPatchDataElements;
        private final Set<PeriodType> supportedPeriodTypes = new LinkedHashSet<>();
        private final Map<MetadataEntityType, List<String>> metadataFields = new LinkedHashMap<>();
        private WebMessageShape webMessageShape = WebMessageShape.DHIS2_2_41;
        private AuditSurface auditSurface = AuditSurface.LEGACY_AUDITS;
        private final Set<SupportedProgramType> supportedProgramTypes = new LinkedHashSet<>();
        private final Map<EndpointId, EndpointPolicy> endpointPolicies = new LinkedHashMap<>();
        private final Map<String, Object> extras = new LinkedHashMap<>();

        public Builder trackerApi(final TrackerApi value) {
            this.trackerApi = value;
            return this;
        }

        public Builder importSummaryShape(final ImportSummaryShape v) {
            this.importSummaryShape = v;
            return this;
        }

        public Builder supportsCategoryOptionCombosEndpoint(final boolean v) {
            this.supportsCategoryOptionCombosEndpoint = v;
            return this;
        }

        public Builder supportsProgramRulesEndpoint(final boolean v) {
            this.supportsProgramRulesEndpoint = v;
            return this;
        }

        public Builder supportsMetadataBulkEndpoint(final boolean v) {
            this.supportsMetadataBulkEndpoint = v;
            return this;
        }

        public Builder supportsPatchDataElements(final boolean v) {
            this.supportsPatchDataElements = v;
            return this;
        }

        public Builder webMessageShape(final WebMessageShape v) {
            this.webMessageShape = v;
            return this;
        }

        public Builder auditSurface(final AuditSurface v) {
            this.auditSurface = v;
            return this;
        }

        public Builder addSupportedProgramType(final SupportedProgramType pt) {
            supportedProgramTypes.add(Objects.requireNonNull(pt));
            return this;
        }

        public Builder endpoint(final EndpointId id, final EndpointPolicy policy) {
            endpointPolicies.put(Objects.requireNonNull(id), Objects.requireNonNull(policy));
            return this;
        }

        public Builder addPeriodType(final PeriodType pt) {
            supportedPeriodTypes.add(Objects.requireNonNull(pt));
            return this;
        }

        public Builder addPeriodTypes(final PeriodType... types) {
            for (final PeriodType pt : types) {
                supportedPeriodTypes.add(Objects.requireNonNull(pt));
            }
            return this;
        }

        public Builder metadataFields(final MetadataEntityType et, final List<String> fields) {
            metadataFields.put(Objects.requireNonNull(et), List.copyOf(fields));
            return this;
        }

        public Builder extra(final String key, final Object value) {
            extras.put(Objects.requireNonNull(key), value);
            return this;
        }

        public CapabilityFlags build() {
            return new CapabilityFlags(
                    trackerApi, importSummaryShape,
                    supportsCategoryOptionCombosEndpoint,
                    supportsProgramRulesEndpoint,
                    supportsMetadataBulkEndpoint,
                    supportsPatchDataElements,
                    supportedPeriodTypes,
                    metadataFields,
                    webMessageShape,
                    auditSurface,
                    supportedProgramTypes,
                    endpointPolicies,
                    extras
            );
        }
    }
}
