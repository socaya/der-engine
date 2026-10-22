package ug.ac.mak.der.metadata;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.Generated;
import ug.ac.mak.der.dhis2.Dhis2Properties;
import ug.ac.mak.der.dhis2.Dhis2ReferenceClient;
import ug.ac.mak.der.dhis2.Dhis2Version;

/**
 * Phase 03b metadata sync.
 *
 * <p>Pulls five metadata resources from the configured central DHIS2 and
 * writes them to the DER mirror. The pull is read-only; central state is
 * never modified. A new {@link MetadataSnapshot} is written for every sync
 * and its id is stamped on every mirror row the sync touched, so Phase 05
 * drift detection can distinguish "touched in this snapshot" from "last
 * seen in an older snapshot".</p>
 *
 * <p>Field selection: each endpoint is called with {@code ?fields=:all&paging=false}
 * so DER receives the complete DHIS2 object for passthrough projection. The
 * mirror tables are an append-plus-upsert; nothing is deleted even if the
 * central no longer has a row, so Phase 05 can quarantine affected
 * operations without losing provenance (DER-ENG-001 §5.1 FR-05-11).</p>
 */
@Service
public class MetadataSyncService {

    private static final Logger LOG = LoggerFactory.getLogger(MetadataSyncService.class);

    static final String FIELDS_ALL = "?fields=:all&paging=false";
    static final String ORG_UNIT_PATH = "/api/organisationUnits" + FIELDS_ALL;
    static final String DATA_ELEMENT_PATH = "/api/dataElements" + FIELDS_ALL;
    static final String DATA_SET_PATH = "/api/dataSets" + FIELDS_ALL;
    static final String PROGRAM_PATH = "/api/programs" + FIELDS_ALL;
    static final String TRACKED_ENTITY_TYPE_PATH = "/api/trackedEntityTypes" + FIELDS_ALL;
    static final String CATEGORY_OPTION_COMBO_PATH = "/api/categoryOptionCombos" + FIELDS_ALL;
    static final String PROGRAM_STAGE_PATH = "/api/programStages" + FIELDS_ALL;
    static final String TRACKED_ENTITY_ATTRIBUTE_PATH = "/api/trackedEntityAttributes" + FIELDS_ALL;
    static final String PROGRAM_RULE_PATH = "/api/programRules" + FIELDS_ALL;

    private final Dhis2ReferenceClient dhis2;
    private final Dhis2Properties props;
    private final MetadataMirrorRepository mirror;
    private final ExtendedMirrorRepository extended;
    private final MetadataSnapshotRepository snapshots;
    private final Clock clock;

    public MetadataSyncService(final Dhis2ReferenceClient dhis2,
                                final Dhis2Properties props,
                                final MetadataMirrorRepository mirror,
                                final ExtendedMirrorRepository extended,
                                final MetadataSnapshotRepository snapshots,
                                final Clock clock) {
        this.dhis2 = Objects.requireNonNull(dhis2, "dhis2");
        this.props = Objects.requireNonNull(props, "props");
        this.mirror = Objects.requireNonNull(mirror, "mirror");
        this.extended = Objects.requireNonNull(extended, "extended");
        this.snapshots = Objects.requireNonNull(snapshots, "snapshots");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    /**
     * Perform one full metadata sync. Caller must have ADMIN authority.
     *
     * @param triggeredBy the acting administrator; may be {@code null} for
     *                    scheduler-initiated syncs
     * @throws Dhis2ReferenceClient.Dhis2UnreachableException the central did
     *         not answer, or any of the five entity endpoints returned non-2xx
     * @throws Dhis2ReferenceClient.Dhis2ResponseException   the central answered
     *         with malformed JSON
     */
    public MetadataSnapshot syncAll(final UUID triggeredBy)
            throws Dhis2ReferenceClient.Dhis2UnreachableException,
                   Dhis2ReferenceClient.Dhis2ResponseException {

        final Dhis2Version version = dhis2.fetchVersion();
        LOG.info("Phase 03 metadata sync starting against DHIS2 version={} revision={}",
                version.version(), version.revision());

        final List<MirroredOrganisationUnit> ous = readOrganisationUnits();
        final List<MirroredDataElement> des = readDataElements();
        final List<MirroredDataSet> dss = readDataSets();
        final List<MirroredProgram> prgs = readPrograms();
        final List<MirroredTrackedEntityType> tets = readTrackedEntityTypes();
        final List<MirroredCategoryOptionCombo> cocs = readCategoryOptionCombos();
        final List<MirroredProgramStage> pss = readProgramStages();
        final List<MirroredTrackedEntityAttribute> teas = readTrackedEntityAttributes();
        final List<MirroredProgramRule> rules = readProgramRules();

        final String fingerprint = fingerprintOf(ous, des, dss, prgs, tets, cocs, pss, teas, rules);
        final MetadataSnapshot pending = new MetadataSnapshot(
                0L,
                props.central().baseUrl(),
                triggeredBy,
                Instant.now(clock),
                new MetadataSnapshot.Counts(ous.size(), des.size(), dss.size(), prgs.size(), tets.size()),
                version.version(),
                version.revision(),
                fingerprint
        );
        final MetadataSnapshot persisted = snapshots.insert(pending);

        mirror.upsertOrganisationUnits(ous, persisted.snapshotId());
        mirror.upsertDataElements(des, persisted.snapshotId());
        mirror.upsertDataSets(dss, persisted.snapshotId());
        mirror.upsertPrograms(prgs, persisted.snapshotId());
        mirror.upsertTrackedEntityTypes(tets, persisted.snapshotId());
        extended.upsertCategoryOptionCombos(cocs, persisted.snapshotId());
        extended.upsertProgramStages(pss, persisted.snapshotId());
        extended.upsertTrackedEntityAttributes(teas, persisted.snapshotId());
        extended.upsertProgramRules(rules, persisted.snapshotId());

        LOG.info("Phase 03/05 metadata sync complete, snapshot={} total={} coc={} ps={} tea={} rules={}",
                persisted.snapshotId(), persisted.counts().total(),
                cocs.size(), pss.size(), teas.size(), rules.size());
        return persisted;
    }

    List<MirroredCategoryOptionCombo> readCategoryOptionCombos()
            throws Dhis2ReferenceClient.Dhis2UnreachableException,
                   Dhis2ReferenceClient.Dhis2ResponseException {
        final JsonNode body = dhis2.fetchJson(CATEGORY_OPTION_COMBO_PATH);
        final List<MirroredCategoryOptionCombo> out = new ArrayList<>();
        if (body == null) {
            return out;
        }
        for (final JsonNode node : body.withArray("categoryOptionCombos")) {
            out.add(new MirroredCategoryOptionCombo(
                    requireText(node, "id"),
                    textOr(node, "displayName", textOr(node, "name", "")),
                    nestedIdOrNull(node, "categoryCombo"),
                    node));
        }
        return out;
    }

    List<MirroredProgramStage> readProgramStages()
            throws Dhis2ReferenceClient.Dhis2UnreachableException,
                   Dhis2ReferenceClient.Dhis2ResponseException {
        final JsonNode body = dhis2.fetchJson(PROGRAM_STAGE_PATH);
        final List<MirroredProgramStage> out = new ArrayList<>();
        if (body == null) {
            return out;
        }
        for (final JsonNode node : body.withArray("programStages")) {
            final List<MirroredProgramStage.ProgramStageDataElement> psdes = new ArrayList<>();
            final JsonNode psdeNode = node.get("programStageDataElements");
            if (psdeNode != null && psdeNode.isArray()) {
                for (final JsonNode psde : psdeNode) {
                    final String deId = nestedIdOrNull(psde, "dataElement");
                    if (deId == null) {
                        continue;
                    }
                    psdes.add(new MirroredProgramStage.ProgramStageDataElement(
                            deId,
                            psde.has("compulsory") && psde.get("compulsory").asBoolean(false),
                            intOrNull(psde, "sortOrder")));
                }
            }
            out.add(new MirroredProgramStage(
                    requireText(node, "id"),
                    nestedIdOrNull(node, "program") == null
                            ? requireText(node, "program") : nestedIdOrNull(node, "program"),
                    textOr(node, "displayName", textOr(node, "name", "")),
                    node.has("repeatable") && node.get("repeatable").asBoolean(false),
                    psdes,
                    node));
        }
        return out;
    }

    List<MirroredTrackedEntityAttribute> readTrackedEntityAttributes()
            throws Dhis2ReferenceClient.Dhis2UnreachableException,
                   Dhis2ReferenceClient.Dhis2ResponseException {
        final JsonNode body = dhis2.fetchJson(TRACKED_ENTITY_ATTRIBUTE_PATH);
        final List<MirroredTrackedEntityAttribute> out = new ArrayList<>();
        if (body == null) {
            return out;
        }
        for (final JsonNode node : body.withArray("trackedEntityAttributes")) {
            out.add(new MirroredTrackedEntityAttribute(
                    requireText(node, "id"),
                    textOr(node, "displayName", textOr(node, "name", "")),
                    textOr(node, "valueType", "TEXT"),
                    node.has("unique") && node.get("unique").asBoolean(false),
                    node));
        }
        return out;
    }

    List<MirroredProgramRule> readProgramRules()
            throws Dhis2ReferenceClient.Dhis2UnreachableException,
                   Dhis2ReferenceClient.Dhis2ResponseException {
        final JsonNode body = dhis2.fetchJson(PROGRAM_RULE_PATH);
        final List<MirroredProgramRule> out = new ArrayList<>();
        if (body == null) {
            return out;
        }
        for (final JsonNode node : body.withArray("programRules")) {
            final String ruleId = requireText(node, "id");
            final List<MirroredProgramRuleAction> actions = new ArrayList<>();
            final JsonNode actionsNode = node.get("programRuleActions");
            if (actionsNode != null && actionsNode.isArray()) {
                for (final JsonNode a : actionsNode) {
                    actions.add(new MirroredProgramRuleAction(
                            requireText(a, "id"),
                            ruleId,
                            textOr(a, "programRuleActionType", "UNKNOWN"),
                            nestedIdOrNull(a, "dataElement"),
                            nestedIdOrNull(a, "trackedEntityAttribute"),
                            textOrNull(a, "data"),
                            textOrNull(a, "content"),
                            a));
                }
            }
            out.add(new MirroredProgramRule(
                    ruleId,
                    nestedIdOrNull(node, "program") == null ? "" : nestedIdOrNull(node, "program"),
                    textOr(node, "displayName", textOr(node, "name", "")),
                    intOrNull(node, "priority"),
                    textOr(node, "condition", "false"),
                    actions,
                    node));
        }
        return out;
    }

    // ---- fetchers -----------------------------------------------------------

    List<MirroredOrganisationUnit> readOrganisationUnits()
            throws Dhis2ReferenceClient.Dhis2UnreachableException,
                   Dhis2ReferenceClient.Dhis2ResponseException {
        final JsonNode body = dhis2.fetchJson(ORG_UNIT_PATH);
        final List<MirroredOrganisationUnit> out = new ArrayList<>();
        for (final JsonNode node : body.withArray("organisationUnits")) {
            out.add(new MirroredOrganisationUnit(
                    requireText(node, "id"),
                    textOr(node, "displayName", textOr(node, "name", "")),
                    textOrNull(node, "path"),
                    intOrNull(node, "level"),
                    nestedIdOrNull(node, "parent"),
                    node
            ));
        }
        return out;
    }

    List<MirroredDataElement> readDataElements()
            throws Dhis2ReferenceClient.Dhis2UnreachableException,
                   Dhis2ReferenceClient.Dhis2ResponseException {
        final JsonNode body = dhis2.fetchJson(DATA_ELEMENT_PATH);
        final List<MirroredDataElement> out = new ArrayList<>();
        for (final JsonNode node : body.withArray("dataElements")) {
            out.add(new MirroredDataElement(
                    requireText(node, "id"),
                    textOr(node, "displayName", textOr(node, "name", "")),
                    textOrNull(node, "valueType"),
                    textOrNull(node, "domainType"),
                    node
            ));
        }
        return out;
    }

    List<MirroredDataSet> readDataSets()
            throws Dhis2ReferenceClient.Dhis2UnreachableException,
                   Dhis2ReferenceClient.Dhis2ResponseException {
        final JsonNode body = dhis2.fetchJson(DATA_SET_PATH);
        final List<MirroredDataSet> out = new ArrayList<>();
        for (final JsonNode node : body.withArray("dataSets")) {
            out.add(new MirroredDataSet(
                    requireText(node, "id"),
                    textOr(node, "displayName", textOr(node, "name", "")),
                    textOrNull(node, "periodType"),
                    node
            ));
        }
        return out;
    }

    List<MirroredProgram> readPrograms()
            throws Dhis2ReferenceClient.Dhis2UnreachableException,
                   Dhis2ReferenceClient.Dhis2ResponseException {
        final JsonNode body = dhis2.fetchJson(PROGRAM_PATH);
        final List<MirroredProgram> out = new ArrayList<>();
        for (final JsonNode node : body.withArray("programs")) {
            out.add(new MirroredProgram(
                    requireText(node, "id"),
                    textOr(node, "displayName", textOr(node, "name", "")),
                    textOrNull(node, "programType"),
                    nestedIdOrNull(node, "trackedEntityType"),
                    node
            ));
        }
        return out;
    }

    List<MirroredTrackedEntityType> readTrackedEntityTypes()
            throws Dhis2ReferenceClient.Dhis2UnreachableException,
                   Dhis2ReferenceClient.Dhis2ResponseException {
        final JsonNode body = dhis2.fetchJson(TRACKED_ENTITY_TYPE_PATH);
        final List<MirroredTrackedEntityType> out = new ArrayList<>();
        for (final JsonNode node : body.withArray("trackedEntityTypes")) {
            out.add(new MirroredTrackedEntityType(
                    requireText(node, "id"),
                    textOr(node, "displayName", textOr(node, "name", "")),
                    node
            ));
        }
        return out;
    }

    // ---- payload accessors --------------------------------------------------

    private static String requireText(final JsonNode node, final String field) {
        final JsonNode child = node.get(field);
        if (child == null || !child.isTextual() || child.asText().isBlank()) {
            throw new IllegalStateException("Missing required field '" + field + "' in central response: " + node);
        }
        return child.asText();
    }

    private static String textOr(final JsonNode node, final String field, final String fallback) {
        final JsonNode child = node.get(field);
        return child != null && child.isTextual() ? child.asText() : fallback;
    }

    private static String textOrNull(final JsonNode node, final String field) {
        final JsonNode child = node.get(field);
        return child != null && child.isTextual() ? child.asText() : null;
    }

    private static Integer intOrNull(final JsonNode node, final String field) {
        final JsonNode child = node.get(field);
        return child != null && child.isInt() ? child.asInt() : null;
    }

    private static String nestedIdOrNull(final JsonNode node, final String field) {
        final JsonNode child = node.get(field);
        if (child == null || !child.isObject()) {
            return null;
        }
        final JsonNode id = child.get("id");
        return id != null && id.isTextual() ? id.asText() : null;
    }

    // ---- fingerprint --------------------------------------------------------

    @SafeVarargs
    static String fingerprintOf(final List<? extends MirroredEntity>... groups) {
        final List<String> all = new ArrayList<>();
        for (final List<? extends MirroredEntity> group : groups) {
            for (final MirroredEntity e : group) {
                all.add(e.dhis2Uid());
            }
        }
        Collections.sort(all);
        return sha256(String.join("\n", all));
    }

    /**
     * JaCoCo-excluded via {@link Generated}: the JRE spec guarantees SHA-256
     * availability (JEP 439); the catch is defensive.
     */
    @Generated("JRE-spec defensive branch — SHA-256 is always available")
    private static String sha256(final String input) {
        try {
            final MessageDigest md = MessageDigest.getInstance("SHA-256");
            final byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            final StringBuilder hex = new StringBuilder(digest.length * 2);
            for (final byte b : digest) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is required by the JRE", ex);
        }
    }
}
