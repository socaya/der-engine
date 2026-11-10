package ug.ac.mak.der.analytics.engine;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Imports DHIS2 program indicator definitions into the analytics
 * catalogue.
 *
 * <p>Spec §4.1 — a program indicator is DHIS2's expression-backed
 * metric definition. DER mirrors every PI into
 * {@code der.metadata_catalog_item} (resource=programIndicators)
 * via the metadata sync job; this service turns those rows into
 * {@code der.analytics_definition} entries by routing each PI
 * through {@link AnalyticsDefinitionService#create}. That funnel
 * means every imported PI goes through the same compile +
 * classify path as operator-authored metrics, so support state
 * (READY / UNSUPPORTED / PARSE_ERROR) stays uniform.</p>
 *
 * <p>The sync is admin-triggered, not automatic on metadata sync.
 * Metadata changes in a live site deserve human review before
 * silently mutating the analytics catalogue; the admin UI exposes
 * a "Sync program indicators" button that calls
 * {@code POST /admin/import-program-indicators}.</p>
 */
@Service
public class ProgramIndicatorSyncService {

    private static final Logger LOG = LoggerFactory.getLogger(
            ProgramIndicatorSyncService.class);

    public enum Outcome { CREATED, UNSUPPORTED, PARSE_ERROR,
            CODE_TAKEN, VALIDATION_ERROR, SKIPPED }

    public record ImportScope(String programUid) { }

    public record ImportItemResult(
            String sourceUid,
            String code,
            Outcome outcome,
            String message) {
    }

    public record ImportSummary(
            int scanned,
            Map<String, Integer> outcomeCounts,
            List<ImportItemResult> items) {
    }

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final AnalyticsDefinitionService definitions;

    public ProgramIndicatorSyncService(final JdbcTemplate jdbc,
                                         final ObjectMapper json,
                                         final AnalyticsDefinitionService definitions) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.json = Objects.requireNonNull(json, "json");
        this.definitions = Objects.requireNonNull(definitions, "definitions");
    }

    @Transactional
    public ImportSummary importAll(final ImportScope scope) {
        final List<ImportItemResult> items = new ArrayList<>();
        final Map<String, Integer> counts = new LinkedHashMap<>();
        for (final Outcome o : Outcome.values()) {
            counts.put(o.name(), 0);
        }
        int scanned = 0;

        final List<ProgramIndicatorPayload> rows = scanIndicators(scope);
        for (final ProgramIndicatorPayload pi : rows) {
            scanned++;
            if (pi.expression() == null || pi.expression().isBlank()) {
                final var item = new ImportItemResult(pi.uid(),
                        codeFor(pi), Outcome.SKIPPED,
                        "expression missing");
                items.add(item);
                counts.merge(Outcome.SKIPPED.name(), 1, Integer::sum);
                continue;
            }
            final AnalyticsDefinitionService.CreateRequest req =
                    new AnalyticsDefinitionService.CreateRequest(
                            codeFor(pi),
                            pi.displayName(),
                            pi.analyticsType() == null
                                    ? "EVENT" : pi.analyticsType(),
                            pi.aggregationType() == null
                                    ? "COUNT" : pi.aggregationType(),
                            pi.programUid(),
                            pi.stageUids(),
                            "EVENT_DATE",
                            "EVENT_ORG_UNIT",
                            pi.expression(),
                            List.of(),
                            pi.filter());
            final AnalyticsDefinitionService.CreateResult r;
            try {
                r = definitions.create(req);
            } catch (RuntimeException ex) {
                LOG.warn("PI import crashed for {} ({}): {}",
                        pi.uid(), codeFor(pi), ex.getMessage());
                final var item = new ImportItemResult(pi.uid(),
                        codeFor(pi), Outcome.VALIDATION_ERROR,
                        ex.getMessage());
                items.add(item);
                counts.merge(Outcome.VALIDATION_ERROR.name(),
                        1, Integer::sum);
                continue;
            }
            final Outcome outcome = mapOutcome(r.outcome());
            final String message = switch (outcome) {
                case UNSUPPORTED -> r.definition() == null ? null
                        : r.definition().unsupportedReason();
                case PARSE_ERROR -> r.compile() == null ? null
                        : String.join("; ",
                                r.compile().diagnostics());
                case VALIDATION_ERROR -> String.join("; ",
                        r.validationErrors());
                case CODE_TAKEN -> "code '" + codeFor(pi)
                        + "' already exists";
                default -> null;
            };
            items.add(new ImportItemResult(pi.uid(),
                    codeFor(pi), outcome, message));
            counts.merge(outcome.name(), 1, Integer::sum);
        }
        return new ImportSummary(scanned, counts, items);
    }

    /** One projected row from der.metadata_catalog_item.payload. */
    private record ProgramIndicatorPayload(
            String uid,
            String code,
            String displayName,
            String programUid,
            List<String> stageUids,
            String expression,
            String filter,
            String analyticsType,
            String aggregationType) {
    }

    private List<ProgramIndicatorPayload> scanIndicators(
            final ImportScope scope) {
        final StringBuilder sql = new StringBuilder(
                "SELECT dhis2_uid, payload::text "
              + "  FROM der.metadata_catalog_item "
              + " WHERE resource = 'programIndicators' ");
        final List<Object> args = new ArrayList<>();
        if (scope != null && scope.programUid() != null
                && !scope.programUid().isBlank()) {
            sql.append(" AND payload->'program'->>'id' = ? ");
            args.add(scope.programUid());
        }
        sql.append(" ORDER BY dhis2_uid ");

        final List<ProgramIndicatorPayload> out = new ArrayList<>();
        jdbc.query(sql.toString(), (rs, i) -> {
            final String uid = rs.getString("dhis2_uid");
            final String raw = rs.getString(2);
            try {
                out.add(toProjection(uid, raw));
            } catch (RuntimeException ex) {
                LOG.warn("skipped PI {} — malformed payload: {}",
                        uid, ex.getMessage());
            }
            return null;
        }, args.toArray());
        return out;
    }

    private ProgramIndicatorPayload toProjection(final String uid,
                                                   final String raw) {
        final JsonNode root;
        try {
            root = json.readTree(raw == null ? "{}" : raw);
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new IllegalArgumentException(
                    "invalid JSON payload", ex);
        }
        return new ProgramIndicatorPayload(
                uid,
                text(root, "code"),
                firstNonBlank(text(root, "displayName"),
                        text(root, "name"), uid),
                textPath(root, "program", "id"),
                stageUidList(root),
                text(root, "expression"),
                text(root, "filter"),
                text(root, "analyticsType"),
                text(root, "aggregationType"));
    }

    private static List<String> stageUidList(final JsonNode root) {
        final JsonNode n = root.get("programStage");
        if (n != null && n.isObject()) {
            final JsonNode id = n.get("id");
            if (id != null && id.isTextual()) {
                return List.of(id.asText());
            }
        }
        final JsonNode arr = root.get("programStages");
        if (arr != null && arr.isArray()) {
            final List<String> out = new ArrayList<>();
            for (final JsonNode s : arr) {
                final JsonNode id = s.get("id");
                if (id != null && id.isTextual()) {
                    out.add(id.asText());
                }
            }
            return out;
        }
        return List.of();
    }

    private static String text(final JsonNode n, final String key) {
        final JsonNode v = n.get(key);
        return v == null || v.isNull() ? null : v.asText(null);
    }

    private static String textPath(final JsonNode n, final String... path) {
        JsonNode cur = n;
        for (final String seg : path) {
            if (cur == null || !cur.isObject()) {
                return null;
            }
            cur = cur.get(seg);
        }
        return cur == null || cur.isNull() ? null : cur.asText(null);
    }

    private static String firstNonBlank(final String... candidates) {
        for (final String c : candidates) {
            if (c != null && !c.isBlank()) {
                return c;
            }
        }
        return "";
    }

    private static String codeFor(final ProgramIndicatorPayload pi) {
        if (pi.code() != null && !pi.code().isBlank()) {
            return "DHIS2_PI_" + pi.code();
        }
        return "DHIS2_PI_" + pi.uid();
    }

    private static Outcome mapOutcome(
            final AnalyticsDefinitionService.CreateOutcome o) {
        return switch (o) {
            case CREATED -> Outcome.CREATED;
            case UNSUPPORTED -> Outcome.UNSUPPORTED;
            case PARSE_ERROR -> Outcome.PARSE_ERROR;
            case CODE_TAKEN -> Outcome.CODE_TAKEN;
            case VALIDATION_ERROR -> Outcome.VALIDATION_ERROR;
        };
    }
}
