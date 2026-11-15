package ug.ac.mak.der.dhis2emulator;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * DER-APPS-DHIS2-001 FR-EMU-006 — static registry of DHIS2 metadata
 * schemas DER advertises through {@code /api/schemas}.
 *
 * <p>Scope is deliberately tight: the four types the FR calls out
 * explicitly — dataElement, program, organisationUnit, categoryCombo —
 * plus the others DER actually mirrors with real data
 * ({@link MetadataListController}). DHIS2 central's full schema
 * surface has 100+ types, most of which DER never needs to serve.
 * Unmirrored types land on the {@code EMULATOR_NOT_IMPLEMENTED}
 * fallback so the admin miss log surfaces real demand.</p>
 *
 * <p>Property shape follows DHIS2's Jackson-rendered form: {@code name},
 * {@code fieldName}, {@code type}, {@code simple}, {@code writable},
 * {@code unique}, {@code required}, {@code length}. Apps that read
 * properties typically care about:
 * <ul>
 *   <li>{@code name}/{@code fieldName} — the JSON key.</li>
 *   <li>{@code type} — primitive vs reference vs collection.</li>
 *   <li>{@code required}/{@code unique} — for form validation.</li>
 * </ul>
 * so we populate those and leave the deeper annotation metadata
 * (constants, i18n keys, etc.) off the response.</p>
 */
public final class SchemaDefinitions {

    private static final Map<String, Schema> REGISTRY = buildRegistry();

    private SchemaDefinitions() { }

    public static List<Schema> all() {
        return List.copyOf(REGISTRY.values());
    }

    public static Optional<Schema> bySingular(final String singular) {
        if (singular == null || singular.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(REGISTRY.get(singular));
    }

    public static Set<String> singulars() {
        return Collections.unmodifiableSet(new LinkedHashSet<>(REGISTRY.keySet()));
    }

    // ---- types -----------------------------------------------------

    /** One schema entry. Mirrors DHIS2's {@code /api/schemas} shape. */
    public record Schema(String klass,
                          String singular,
                          String plural,
                          boolean metadata,
                          boolean identifiableObject,
                          boolean nameableObject,
                          boolean persisted,
                          List<Property> properties) {
        public Schema {
            properties = properties == null
                    ? List.of()
                    : List.copyOf(properties);
        }
    }

    /** One property on a schema. */
    public record Property(String name,
                            String fieldName,
                            String propertyType,
                            boolean simple,
                            boolean writable,
                            boolean required,
                            boolean unique,
                            Integer length) {
        public Property {
            if (fieldName == null) {
                fieldName = name;
            }
            if (propertyType == null) {
                propertyType = "TEXT";
            }
        }

        /** Convenience: non-required, not-unique, writable, simple prop
         *  of the given type. Covers the common property shape. */
        public static Property simple(final String name, final String type) {
            return new Property(name, name, type, true, true,
                    false, false, null);
        }

        /** Required-not-unique variant for fields like displayName. */
        public static Property required(final String name, final String type) {
            return new Property(name, name, type, true, true,
                    true, false, null);
        }

        /** The identifiable-object identity field. DHIS2 serialises it
         *  as {@code id} in the JSON while the DB column is {@code uid}. */
        public static Property identity() {
            return new Property("id", "uid", "IDENTIFIER", true, false,
                    true, true, 11);
        }

        /** Reference (foreign-key) property. */
        public static Property reference(final String name) {
            return new Property(name, name, "REFERENCE", false, true,
                    false, false, null);
        }

        /** Collection property (OneToMany, ManyToMany). */
        public static Property collection(final String name) {
            return new Property(name, name, "COLLECTION", false, true,
                    false, false, null);
        }
    }

    // ---- registry --------------------------------------------------

    private static Map<String, Schema> buildRegistry() {
        final Map<String, Schema> m = new LinkedHashMap<>();
        m.put("dataElement", dataElementSchema());
        m.put("program", programSchema());
        m.put("organisationUnit", organisationUnitSchema());
        m.put("categoryCombo", categoryComboSchema());
        m.put("dataSet", dataSetSchema());
        m.put("trackedEntityType", trackedEntityTypeSchema());
        m.put("trackedEntityAttribute", trackedEntityAttributeSchema());
        m.put("programStage", programStageSchema());
        m.put("categoryOption", categoryOptionSchema());
        m.put("categoryOptionCombo", categoryOptionComboSchema());
        return Collections.unmodifiableMap(m);
    }

    private static List<Property> identifiableBase() {
        return List.of(
                Property.identity(),
                Property.required("name", "TEXT"),
                Property.simple("displayName", "TEXT"),
                Property.simple("shortName", "TEXT"),
                Property.simple("code", "TEXT"),
                Property.simple("description", "TEXT"),
                Property.simple("created", "DATE"),
                Property.simple("lastUpdated", "DATE"),
                Property.simple("href", "URL"));
    }

    private static List<Property> withExtras(final Property... extras) {
        final java.util.ArrayList<Property> out =
                new java.util.ArrayList<>(identifiableBase());
        Collections.addAll(out, extras);
        return out;
    }

    private static Schema dataElementSchema() {
        return new Schema(
                "org.hisp.dhis.dataelement.DataElement",
                "dataElement", "dataElements",
                true, true, true, true,
                withExtras(
                        Property.required("valueType", "CONSTANT"),
                        Property.simple("aggregationType", "CONSTANT"),
                        Property.simple("domainType", "CONSTANT"),
                        Property.simple("formName", "TEXT"),
                        Property.simple("zeroIsSignificant", "BOOLEAN"),
                        Property.reference("categoryCombo"),
                        Property.reference("optionSet"),
                        Property.reference("commentOptionSet")));
    }

    private static Schema programSchema() {
        return new Schema(
                "org.hisp.dhis.program.Program",
                "program", "programs",
                true, true, true, true,
                withExtras(
                        Property.required("programType", "CONSTANT"),
                        Property.simple("version", "INTEGER"),
                        Property.simple("displayFrontPageList", "BOOLEAN"),
                        Property.simple("ignoreOverdueEvents", "BOOLEAN"),
                        Property.reference("trackedEntityType"),
                        Property.reference("categoryCombo"),
                        Property.collection("programStages"),
                        Property.collection("organisationUnits"),
                        Property.collection("programTrackedEntityAttributes")));
    }

    private static Schema organisationUnitSchema() {
        return new Schema(
                "org.hisp.dhis.organisationunit.OrganisationUnit",
                "organisationUnit", "organisationUnits",
                true, true, true, true,
                withExtras(
                        Property.simple("level", "INTEGER"),
                        Property.simple("path", "TEXT"),
                        Property.simple("openingDate", "DATE"),
                        Property.simple("closedDate", "DATE"),
                        Property.simple("comment", "TEXT"),
                        Property.simple("url", "URL"),
                        Property.simple("contactPerson", "TEXT"),
                        Property.simple("address", "TEXT"),
                        Property.simple("email", "EMAIL"),
                        Property.simple("phoneNumber", "PHONENUMBER"),
                        Property.reference("parent"),
                        Property.collection("children"),
                        Property.collection("organisationUnitGroups")));
    }

    private static Schema categoryComboSchema() {
        return new Schema(
                "org.hisp.dhis.category.CategoryCombo",
                "categoryCombo", "categoryCombos",
                true, true, false, true,
                withExtras(
                        Property.simple("dataDimensionType", "CONSTANT"),
                        Property.simple("skipTotal", "BOOLEAN"),
                        Property.collection("categories"),
                        Property.collection("categoryOptionCombos")));
    }

    private static Schema dataSetSchema() {
        return new Schema(
                "org.hisp.dhis.dataset.DataSet",
                "dataSet", "dataSets",
                true, true, true, true,
                withExtras(
                        Property.required("periodType", "CONSTANT"),
                        Property.simple("version", "INTEGER"),
                        Property.simple("timelyDays", "INTEGER"),
                        Property.simple("openFuturePeriods", "INTEGER"),
                        Property.simple("expiryDays", "INTEGER"),
                        Property.reference("categoryCombo"),
                        Property.collection("dataSetElements"),
                        Property.collection("organisationUnits"),
                        Property.collection("indicators")));
    }

    private static Schema trackedEntityTypeSchema() {
        return new Schema(
                "org.hisp.dhis.trackedentity.TrackedEntityType",
                "trackedEntityType", "trackedEntityTypes",
                true, true, true, true,
                withExtras(
                        Property.simple("formName", "TEXT"),
                        Property.simple("minAttributesRequiredToSearch", "INTEGER"),
                        Property.simple("allowAuditLog", "BOOLEAN"),
                        Property.collection("trackedEntityTypeAttributes")));
    }

    private static Schema trackedEntityAttributeSchema() {
        return new Schema(
                "org.hisp.dhis.trackedentity.TrackedEntityAttribute",
                "trackedEntityAttribute", "trackedEntityAttributes",
                true, true, true, true,
                withExtras(
                        Property.required("valueType", "CONSTANT"),
                        Property.simple("unique", "BOOLEAN"),
                        Property.simple("generated", "BOOLEAN"),
                        Property.simple("pattern", "TEXT"),
                        Property.simple("confidential", "BOOLEAN"),
                        Property.simple("inherit", "BOOLEAN"),
                        Property.reference("optionSet")));
    }

    private static Schema programStageSchema() {
        return new Schema(
                "org.hisp.dhis.program.ProgramStage",
                "programStage", "programStages",
                true, true, true, true,
                withExtras(
                        Property.simple("repeatable", "BOOLEAN"),
                        Property.simple("sortOrder", "INTEGER"),
                        Property.simple("minDaysFromStart", "INTEGER"),
                        Property.simple("standardInterval", "INTEGER"),
                        Property.simple("autoGenerateEvent", "BOOLEAN"),
                        Property.reference("program"),
                        Property.collection("programStageDataElements"),
                        Property.collection("programStageSections")));
    }

    private static Schema categoryOptionSchema() {
        return new Schema(
                "org.hisp.dhis.category.CategoryOption",
                "categoryOption", "categoryOptions",
                true, true, true, true,
                withExtras(
                        Property.simple("startDate", "DATE"),
                        Property.simple("endDate", "DATE"),
                        Property.simple("formName", "TEXT"),
                        Property.collection("categories"),
                        Property.collection("organisationUnits")));
    }

    private static Schema categoryOptionComboSchema() {
        return new Schema(
                "org.hisp.dhis.category.CategoryOptionCombo",
                "categoryOptionCombo", "categoryOptionCombos",
                true, true, true, true,
                withExtras(
                        Property.simple("ignoreApproval", "BOOLEAN"),
                        Property.reference("categoryCombo"),
                        Property.collection("categoryOptions")));
    }

}
