package ug.ac.mak.der.analytics.engine;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import ug.ac.mak.der.analytics.expression.ExpressionCompiler;

/**
 * Compile + persist + lifecycle for operator-authored analytics
 * metric definitions.
 *
 * <p>Spec §4.1 — this is the enforcement point for AN-FR-003 to
 * AN-FR-008: every inserted definition carries the compiled AST
 * version it ships with, its support state, and the exact source
 * the operator wrote. Definitions that refer to unsupported DHIS2
 * functions land in the catalogue as {@code UNSUPPORTED} rather
 * than silently returning zero.</p>
 */
@Service
public class AnalyticsDefinitionService {

    public enum CreateOutcome { CREATED, UNSUPPORTED, PARSE_ERROR,
            CODE_TAKEN, VALIDATION_ERROR }

    public record CreateRequest(
            String code,
            String displayName,
            String analyticsType,
            String aggregationType,
            String programUid,
            List<String> stageUids,
            String dateAnchor,
            String orgUnitAnchor,
            String expression,
            List<AnalyticsDimension> dimensions,
            String filterExpression,
            String numeratorExpression,
            String denominatorExpression,
            java.math.BigDecimal factor) {

        public CreateRequest {
            dimensions = dimensions == null ? List.of()
                    : List.copyOf(dimensions);
        }

        /** 9-field convenience for the Phase-3 shape. */
        public CreateRequest(final String code, final String displayName,
                              final String analyticsType,
                              final String aggregationType,
                              final String programUid,
                              final List<String> stageUids,
                              final String dateAnchor,
                              final String orgUnitAnchor,
                              final String expression) {
            this(code, displayName, analyticsType, aggregationType,
                    programUid, stageUids, dateAnchor, orgUnitAnchor,
                    expression, List.of(), null, null, null, null);
        }

        /** 10-field convenience for Phase-4a — dimensions but no
         *  filter expression. */
        public CreateRequest(final String code, final String displayName,
                              final String analyticsType,
                              final String aggregationType,
                              final String programUid,
                              final List<String> stageUids,
                              final String dateAnchor,
                              final String orgUnitAnchor,
                              final String expression,
                              final List<AnalyticsDimension> dimensions) {
            this(code, displayName, analyticsType, aggregationType,
                    programUid, stageUids, dateAnchor, orgUnitAnchor,
                    expression, dimensions, null, null, null, null);
        }

        /** 11-field convenience for Phase-4c — dimensions + filter but
         *  no ratio expressions. */
        public CreateRequest(final String code, final String displayName,
                              final String analyticsType,
                              final String aggregationType,
                              final String programUid,
                              final List<String> stageUids,
                              final String dateAnchor,
                              final String orgUnitAnchor,
                              final String expression,
                              final List<AnalyticsDimension> dimensions,
                              final String filterExpression) {
            this(code, displayName, analyticsType, aggregationType,
                    programUid, stageUids, dateAnchor, orgUnitAnchor,
                    expression, dimensions, filterExpression, null, null,
                    null);
        }

        /** 13-field convenience for pre-factor ratio indicators —
         *  legacy callers that supplied num/den without the DHIS2
         *  aggregate-indicator factor. Equivalent to factor = 1. */
        public CreateRequest(final String code, final String displayName,
                              final String analyticsType,
                              final String aggregationType,
                              final String programUid,
                              final List<String> stageUids,
                              final String dateAnchor,
                              final String orgUnitAnchor,
                              final String expression,
                              final List<AnalyticsDimension> dimensions,
                              final String filterExpression,
                              final String numeratorExpression,
                              final String denominatorExpression) {
            this(code, displayName, analyticsType, aggregationType,
                    programUid, stageUids, dateAnchor, orgUnitAnchor,
                    expression, dimensions, filterExpression,
                    numeratorExpression, denominatorExpression, null);
        }
    }

    public record CreateResult(
            CreateOutcome outcome,
            AnalyticsDefinition definition,
            ExpressionCompiler.CompileResult compile,
            List<String> validationErrors) {
    }

    private static final List<String> VALID_ANALYTICS_TYPES = List.of(
            "EVENT", "ENROLLMENT", "AGGREGATE", "DERIVED");
    private static final List<String> VALID_AGG_TYPES = List.of(
            "SUM", "AVERAGE", "COUNT", "STDDEV", "VARIANCE",
            "MIN", "MAX", "COUNT_DISTINCT", "CUSTOM", "NONE");
    private static final List<String> VALID_DATE_ANCHORS = List.of(
            "EVENT_DATE", "ENROLLMENT_DATE", "INCIDENT_DATE",
            "DISCHARGE_DATE", "SUBMISSION_DATE");
    private static final List<String> VALID_ORGUNIT_ANCHORS = List.of(
            "EVENT_ORG_UNIT", "ENROLLMENT_ORG_UNIT",
            "REGISTRATION_ORG_UNIT", "TRACKED_ENTITY_ORG_UNIT");

    /** Prevents operators overriding the built-in metrics the engine
     *  auto-seeds. Deleting / renaming the built-ins happens through
     *  a migration, not the admin endpoint. */
    private static final List<String> RESERVED_CODES = List.of(
            AnalyticsSeed.EVENT_COUNT_CODE,
            AnalyticsSeed.ENROLLMENT_COUNT_CODE);

    private final AnalyticsEngineRepository repo;
    private final ExpressionCompiler compiler;
    private final ObjectMapper json;

    public AnalyticsDefinitionService(final AnalyticsEngineRepository repo,
                                        final ExpressionCompiler compiler,
                                        final ObjectMapper json) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.compiler = Objects.requireNonNull(compiler, "compiler");
        this.json = Objects.requireNonNull(json, "json");
    }

    @Transactional
    public CreateResult create(final CreateRequest req) {
        Objects.requireNonNull(req, "request");
        final List<String> errors = validate(req);
        if (!errors.isEmpty()) {
            return new CreateResult(CreateOutcome.VALIDATION_ERROR,
                    null, null, errors);
        }
        if (RESERVED_CODES.contains(req.code())) {
            return new CreateResult(CreateOutcome.CODE_TAKEN, null, null,
                    List.of("code '" + req.code()
                            + "' is reserved for a built-in metric"));
        }
        if (repo.findDefinitionByCode(req.code()).isPresent()) {
            return new CreateResult(CreateOutcome.CODE_TAKEN, null, null,
                    List.of("code '" + req.code() + "' already exists; "
                            + "update bumps definition_version in a "
                            + "future slice"));
        }

        final ExpressionCompiler.CompileResult compiled =
                compiler.compile(req.expression());
        if (compiled.supportState()
                == ExpressionCompiler.SupportState.PARSE_ERROR) {
            return new CreateResult(CreateOutcome.PARSE_ERROR,
                    null, compiled, List.of());
        }
        // Phase 4c — filter expression compiles separately. If the
        // filter parses but references an unsupported function, the
        // whole definition lands UNSUPPORTED so operators see the
        // specific blocker (matches AN-FR-004).
        ExpressionCompiler.CompileResult filterCompiled = null;
        final boolean hasFilter = req.filterExpression() != null
                && !req.filterExpression().isBlank();
        if (hasFilter) {
            filterCompiled = compiler.compile(req.filterExpression());
            if (filterCompiled.supportState()
                    == ExpressionCompiler.SupportState.PARSE_ERROR) {
                return new CreateResult(CreateOutcome.PARSE_ERROR,
                        null, filterCompiled, List.of());
            }
        }
        // Ratio indicators — spec §6.1. Both numerator and
        // denominator must be supplied together; a lone half is a
        // VALIDATION_ERROR (spec forbids an implicit "assume the
        // other is the main expression").
        final boolean hasNum = req.numeratorExpression() != null
                && !req.numeratorExpression().isBlank();
        final boolean hasDen = req.denominatorExpression() != null
                && !req.denominatorExpression().isBlank();
        if (hasNum != hasDen) {
            return new CreateResult(CreateOutcome.VALIDATION_ERROR,
                    null, null, List.of(
                            "numeratorExpression and denominatorExpression "
                          + "must be supplied together"));
        }
        ExpressionCompiler.CompileResult numCompiled = null;
        ExpressionCompiler.CompileResult denCompiled = null;
        if (hasNum) {
            numCompiled = compiler.compile(req.numeratorExpression());
            denCompiled = compiler.compile(req.denominatorExpression());
            if (numCompiled.supportState()
                    == ExpressionCompiler.SupportState.PARSE_ERROR) {
                return new CreateResult(CreateOutcome.PARSE_ERROR,
                        null, numCompiled, List.of());
            }
            if (denCompiled.supportState()
                    == ExpressionCompiler.SupportState.PARSE_ERROR) {
                return new CreateResult(CreateOutcome.PARSE_ERROR,
                        null, denCompiled, List.of());
            }
        }
        final boolean ready = compiled.supportState()
                == ExpressionCompiler.SupportState.READY
                && (!hasFilter || filterCompiled.supportState()
                        == ExpressionCompiler.SupportState.READY)
                && (!hasNum || numCompiled.supportState()
                        == ExpressionCompiler.SupportState.READY)
                && (!hasDen || denCompiled.supportState()
                        == ExpressionCompiler.SupportState.READY);
        final String supportState = ready ? "READY" : "UNSUPPORTED";
        final StringBuilder reasonBuilder = new StringBuilder();
        if (compiled.supportState()
                != ExpressionCompiler.SupportState.READY) {
            reasonBuilder.append(String.join("; ", compiled.diagnostics()));
        }
        if (hasFilter && filterCompiled.supportState()
                != ExpressionCompiler.SupportState.READY) {
            if (reasonBuilder.length() > 0) {
                reasonBuilder.append("; ");
            }
            reasonBuilder.append("filter: ")
                    .append(String.join("; ", filterCompiled.diagnostics()));
        }
        if (hasNum && numCompiled.supportState()
                != ExpressionCompiler.SupportState.READY) {
            if (reasonBuilder.length() > 0) {
                reasonBuilder.append("; ");
            }
            reasonBuilder.append("numerator: ")
                    .append(String.join("; ", numCompiled.diagnostics()));
        }
        if (hasDen && denCompiled.supportState()
                != ExpressionCompiler.SupportState.READY) {
            if (reasonBuilder.length() > 0) {
                reasonBuilder.append("; ");
            }
            reasonBuilder.append("denominator: ")
                    .append(String.join("; ", denCompiled.diagnostics()));
        }
        final String unsupportedReason = ready ? null
                : reasonBuilder.toString();

        final UUID id = UUID.randomUUID();
        final AnalyticsDefinition d = new AnalyticsDefinition(
                id, null, req.code(), req.displayName(), 1,
                hashFor(req), req.analyticsType(), req.aggregationType(),
                req.programUid(),
                req.stageUids() == null ? List.of() : req.stageUids(),
                req.dateAnchor(), req.orgUnitAnchor(),
                supportState, unsupportedReason,
                Instant.now(), Instant.now(), Instant.now());

        final String definitionJson = serialiseDefinitionBody(req, compiled);
        repo.insertDefinition(d, null, definitionJson);

        final AnalyticsDefinition persisted = repo.findDefinition(id)
                .orElseThrow(() -> new IllegalStateException(
                        "definition " + id + " vanished after insert"));
        return new CreateResult(ready
                ? CreateOutcome.CREATED : CreateOutcome.UNSUPPORTED,
                persisted, compiled, List.of());
    }

    private static List<String> validate(final CreateRequest req) {
        final java.util.ArrayList<String> errs = new java.util.ArrayList<>();
        if (req.code() == null || req.code().isBlank()) {
            errs.add("code is required");
        }
        if (req.displayName() == null || req.displayName().isBlank()) {
            errs.add("displayName is required");
        }
        if (req.expression() == null || req.expression().isBlank()) {
            errs.add("expression is required");
        }
        if (req.analyticsType() == null
                || !VALID_ANALYTICS_TYPES.contains(req.analyticsType())) {
            errs.add("analyticsType must be one of " + VALID_ANALYTICS_TYPES);
        }
        if (req.aggregationType() == null
                || !VALID_AGG_TYPES.contains(req.aggregationType())) {
            errs.add("aggregationType must be one of " + VALID_AGG_TYPES);
        }
        if (req.dateAnchor() == null
                || !VALID_DATE_ANCHORS.contains(req.dateAnchor())) {
            errs.add("dateAnchor must be one of " + VALID_DATE_ANCHORS);
        }
        if (req.orgUnitAnchor() == null
                || !VALID_ORGUNIT_ANCHORS.contains(req.orgUnitAnchor())) {
            errs.add("orgUnitAnchor must be one of " + VALID_ORGUNIT_ANCHORS);
        }
        return errs;
    }

    private String serialiseDefinitionBody(
            final CreateRequest req,
            final ExpressionCompiler.CompileResult compiled) {
        final java.util.Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("expression", req.expression());
        body.put("compiled", java.util.Map.of(
                "supportState", compiled.supportState().name(),
                "diagnostics", compiled.diagnostics(),
                "referencedDataElements", compiled.referencedDataElements(),
                "referencedAttributes", compiled.referencedAttributes(),
                "referencedVariables", compiled.referencedVariables(),
                "referencedConstants", compiled.referencedConstants(),
                "referencedFunctions", compiled.referencedFunctions()));
        if (req.programUid() != null) {
            body.put("programUid", req.programUid());
        }
        if (req.stageUids() != null && !req.stageUids().isEmpty()) {
            body.put("stageUids", req.stageUids());
        }
        if (req.dimensions() != null && !req.dimensions().isEmpty()) {
            body.put("dimensions", req.dimensions().stream()
                    .map(AnalyticsDefinitionService::dimensionJson)
                    .toList());
        }
        if (req.filterExpression() != null
                && !req.filterExpression().isBlank()) {
            body.put("filterExpression", req.filterExpression());
        }
        if (req.numeratorExpression() != null
                && !req.numeratorExpression().isBlank()) {
            body.put("numeratorExpression", req.numeratorExpression());
        }
        if (req.denominatorExpression() != null
                && !req.denominatorExpression().isBlank()) {
            body.put("denominatorExpression", req.denominatorExpression());
        }
        if (req.factor() != null) {
            body.put("factor", req.factor().toPlainString());
        }
        try {
            return json.writeValueAsString(body);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException(
                    "failed to serialise definition body", ex);
        }
    }

    /** Serialise one dimension to its JSONB shape. Exported so the
     *  ingestion layer can round-trip it back on load. */
    static java.util.Map<String, Object> dimensionJson(
            final AnalyticsDimension d) {
        final java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("name", d.name());
        m.put("kind", d.kind().name());
        m.put("sourceUid", d.sourceUid());
        if (d.optionSetUid() != null && !d.optionSetUid().isBlank()) {
            m.put("optionSetUid", d.optionSetUid());
        }
        if (!d.buckets().isEmpty()) {
            m.put("buckets", d.buckets().stream().map(b -> {
                final java.util.Map<String, Object> bm = new java.util.LinkedHashMap<>();
                bm.put("label", b.label());
                if (b.min() != null) {
                    bm.put("min", b.min().toPlainString());
                }
                if (b.max() != null) {
                    bm.put("max", b.max().toPlainString());
                }
                return bm;
            }).toList());
        }
        return m;
    }

    /** Shared textual-field extractor for optional expression
     *  slots stored on the definition JSON body. */
    public static String parseOptionalExpression(
            final ObjectMapper mapper, final String definitionJson,
            final String fieldName) {
        if (definitionJson == null || definitionJson.isBlank()) {
            return null;
        }
        try {
            final com.fasterxml.jackson.databind.JsonNode root =
                    mapper.readTree(definitionJson);
            final com.fasterxml.jackson.databind.JsonNode n =
                    root.get(fieldName);
            if (n == null || n.isNull()) {
                return null;
            }
            final String v = n.asText(null);
            return v == null || v.isBlank() ? null : v;
        } catch (RuntimeException | java.io.IOException ex) {
            return null;
        }
    }

    public static String parseNumeratorExpression(
            final ObjectMapper mapper, final String definitionJson) {
        return parseOptionalExpression(mapper, definitionJson,
                "numeratorExpression");
    }

    public static String parseDenominatorExpression(
            final ObjectMapper mapper, final String definitionJson) {
        return parseOptionalExpression(mapper, definitionJson,
                "denominatorExpression");
    }

    /** Extract the aggregate-indicator factor (e.g. 100, 1000) from a
     *  stored definition body. Returns {@link java.math.BigDecimal#ONE}
     *  if absent — matches DHIS2 default of 1 (raw ratio). */
    public static java.math.BigDecimal parseFactor(
            final ObjectMapper mapper, final String definitionJson) {
        if (definitionJson == null || definitionJson.isBlank()) {
            return java.math.BigDecimal.ONE;
        }
        try {
            final com.fasterxml.jackson.databind.JsonNode root =
                    mapper.readTree(definitionJson);
            final com.fasterxml.jackson.databind.JsonNode n = root.get("factor");
            if (n == null || n.isNull()) {
                return java.math.BigDecimal.ONE;
            }
            return new java.math.BigDecimal(n.asText("1").trim());
        } catch (RuntimeException | java.io.IOException ex) {
            return java.math.BigDecimal.ONE;
        }
    }

    /** Extract the filter expression from a stored definition body.
     *  Returns null if absent. */
    public static String parseFilterExpression(
            final ObjectMapper mapper, final String definitionJson) {
        if (definitionJson == null || definitionJson.isBlank()) {
            return null;
        }
        try {
            final com.fasterxml.jackson.databind.JsonNode root =
                    mapper.readTree(definitionJson);
            final com.fasterxml.jackson.databind.JsonNode n =
                    root.get("filterExpression");
            if (n == null || n.isNull()) {
                return null;
            }
            final String v = n.asText(null);
            return v == null || v.isBlank() ? null : v;
        } catch (RuntimeException | java.io.IOException ex) {
            return null;
        }
    }

    /** Parse the dimensions array out of a stored definition JSON
     *  body. Returns empty list if none declared or parsing fails. */
    public static List<AnalyticsDimension> parseDimensions(
            final ObjectMapper mapper, final String definitionJson) {
        if (definitionJson == null || definitionJson.isBlank()) {
            return List.of();
        }
        try {
            final com.fasterxml.jackson.databind.JsonNode root =
                    mapper.readTree(definitionJson);
            final com.fasterxml.jackson.databind.JsonNode dims =
                    root.get("dimensions");
            if (dims == null || !dims.isArray()) {
                return List.of();
            }
            final List<AnalyticsDimension> out = new java.util.ArrayList<>();
            for (final com.fasterxml.jackson.databind.JsonNode dn : dims) {
                final String name = text(dn, "name");
                final String kindName = text(dn, "kind");
                final String uid = text(dn, "sourceUid");
                if (name == null || kindName == null || uid == null) {
                    continue;
                }
                final AnalyticsDimension.Kind kind;
                try {
                    kind = AnalyticsDimension.Kind.valueOf(kindName);
                } catch (IllegalArgumentException ex) {
                    continue;
                }
                final List<AnalyticsDimension.Bucket> buckets =
                        new java.util.ArrayList<>();
                final com.fasterxml.jackson.databind.JsonNode bs =
                        dn.get("buckets");
                if (bs != null && bs.isArray()) {
                    for (final com.fasterxml.jackson.databind.JsonNode bn : bs) {
                        final String label = text(bn, "label");
                        if (label == null) {
                            continue;
                        }
                        buckets.add(new AnalyticsDimension.Bucket(
                                label,
                                decimal(bn, "min"),
                                decimal(bn, "max")));
                    }
                }
                final String optionSet = text(dn, "optionSetUid");
                out.add(new AnalyticsDimension(name, kind, uid, buckets,
                        optionSet));
            }
            return out;
        } catch (RuntimeException | java.io.IOException ex) {
            return List.of();
        }
    }

    private static String text(
            final com.fasterxml.jackson.databind.JsonNode n,
            final String key) {
        final com.fasterxml.jackson.databind.JsonNode v = n.get(key);
        return v == null || v.isNull() ? null : v.asText(null);
    }

    private static java.math.BigDecimal decimal(
            final com.fasterxml.jackson.databind.JsonNode n,
            final String key) {
        final com.fasterxml.jackson.databind.JsonNode v = n.get(key);
        if (v == null || v.isNull()) {
            return null;
        }
        try {
            return new java.math.BigDecimal(v.asText().trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String hashFor(final CreateRequest req) {
        return Integer.toHexString(java.util.Objects.hash(
                req.code(), req.expression(), req.analyticsType(),
                req.aggregationType(), req.dateAnchor(),
                req.orgUnitAnchor()));
    }

    @Transactional
    public boolean deprecate(final UUID id) {
        final var opt = repo.findDefinition(id);
        if (opt.isEmpty()) {
            return false;
        }
        final AnalyticsDefinition existing = opt.get();
        if (RESERVED_CODES.contains(existing.code())) {
            throw new IllegalStateException(
                    "cannot deprecate built-in metric '"
                            + existing.code() + "'");
        }
        repo.updateSupportState(id, "DEPRECATED",
                "deprecated by admin at " + Instant.now());
        return true;
    }
}
