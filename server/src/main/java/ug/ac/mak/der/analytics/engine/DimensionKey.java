package ug.ac.mak.der.analytics.engine;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;

import ug.ac.mak.der.analytics.expression.ExpressionContext;

/**
 * Stable encoding of a per-cell dimension tuple.
 *
 * <p>Format: {@code name1=value1|name2=value2} with names sorted
 * ASCII-ascending. The sort is non-negotiable — it's what keeps
 * the materialiser's PK deterministic when a definition declares
 * dimensions in whatever order the operator entered them.</p>
 *
 * <p>Unknown / missing dimension values encode as the literal
 * string {@code (unknown)} rather than being dropped (§5.1 —
 * "Unknown remains a visible category").</p>
 */
public final class DimensionKey {

    public static final String UNKNOWN = "(unknown)";

    private DimensionKey() { }

    /** Resolve every declared dimension against the context and
     *  pack into a stable key. Returns {@code ""} when the metric
     *  declares no dimensions. */
    public static String encode(final List<AnalyticsDimension> dimensions,
                                  final ExpressionContext ctx) {
        if (dimensions == null || dimensions.isEmpty()) {
            return "";
        }
        final TreeMap<String, String> sorted = new TreeMap<>();
        for (final AnalyticsDimension d : dimensions) {
            sorted.put(d.name(), resolveOne(d, ctx));
        }
        final StringBuilder b = new StringBuilder();
        for (final var e : sorted.entrySet()) {
            if (b.length() > 0) {
                b.append('|');
            }
            b.append(e.getKey()).append('=').append(escape(e.getValue()));
        }
        return b.toString();
    }

    private static String resolveOne(final AnalyticsDimension d,
                                       final ExpressionContext ctx) {
        final Object raw = switch (d.kind()) {
            case DATA_ELEMENT -> ctx.dataElement(null, d.sourceUid())
                    .orElse(null);
            case VARIABLE -> ctx.variable(d.sourceUid()).orElse(null);
        };
        if (raw == null) {
            return UNKNOWN;
        }
        if (!d.buckets().isEmpty()) {
            final BigDecimal n = tryBigDecimal(raw);
            if (n != null) {
                for (final AnalyticsDimension.Bucket b : d.buckets()) {
                    if (b.contains(n)) {
                        return b.label();
                    }
                }
                return UNKNOWN;
            }
            // Non-numeric with buckets declared — fall through to
            // raw-value encoding so the operator can see the
            // non-matching input rather than swallowing it.
        }
        final String s = raw.toString().trim();
        return s.isEmpty() ? UNKNOWN : s;
    }

    /** Decode a key back into a map for query responses + tests.
     *  Returns an empty map when the key is {@code ""} (no
     *  dimensions declared on the metric). */
    public static Map<String, String> decode(final String key) {
        if (key == null || key.isEmpty()) {
            return Map.of();
        }
        final Map<String, String> out = new LinkedHashMap<>();
        for (final String part : key.split("\\|")) {
            final int eq = part.indexOf('=');
            if (eq <= 0) {
                continue;
            }
            out.put(part.substring(0, eq),
                    unescape(part.substring(eq + 1)));
        }
        return out;
    }

    /** Build a prefix pattern for SQL LIKE from a partial filter.
     *  The filter map holds (name → required value) pairs; the
     *  returned string embeds those required pairs sorted + escaped
     *  so SQL LIKE 'pattern%' matches cells whose dimension_key
     *  starts with the filter. Returns {@code null} when the filter
     *  is empty. */
    public static String likePrefix(final Map<String, String> filter) {
        if (filter == null || filter.isEmpty()) {
            return null;
        }
        final TreeMap<String, String> sorted = new TreeMap<>(filter);
        final StringBuilder b = new StringBuilder();
        for (final var e : sorted.entrySet()) {
            if (b.length() > 0) {
                b.append('|');
            }
            b.append(e.getKey()).append('=').append(escape(e.getValue()));
        }
        return b.toString();
    }

    /** Produce an array of all distinct dimension name → values
     *  observed in a collection of encoded keys. Used by the admin
     *  UI to render the pivot dropdowns with the actual bucket
     *  labels, not whatever the metric author declared. */
    public static Map<String, List<String>> observedValues(
            final List<String> keys) {
        final Map<String, java.util.TreeSet<String>> acc = new LinkedHashMap<>();
        for (final String k : keys) {
            for (final var e : decode(k).entrySet()) {
                acc.computeIfAbsent(e.getKey(),
                        x -> new java.util.TreeSet<>()).add(e.getValue());
            }
        }
        final Map<String, List<String>> out = new LinkedHashMap<>();
        acc.forEach((k, v) -> out.put(k, new ArrayList<>(v)));
        return out;
    }

    private static String escape(final String raw) {
        return raw == null ? UNKNOWN
                : raw.replace("\\", "\\\\")
                     .replace("|", "\\p")
                     .replace("=", "\\e");
    }

    private static String unescape(final String raw) {
        return raw == null ? "" : raw
                .replace("\\e", "=")
                .replace("\\p", "|")
                .replace("\\\\", "\\");
    }

    private static BigDecimal tryBigDecimal(final Object v) {
        Objects.requireNonNull(v, "value");
        if (v instanceof BigDecimal b) {
            return b;
        }
        if (v instanceof Number n) {
            return new BigDecimal(n.toString());
        }
        try {
            return new BigDecimal(v.toString().trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    /** Parse the old-style unescaped keys ingested by Phase 1/2 cells
     *  — kept for a one-pass migration if we ever run one. Currently
     *  Phase 4a is the first slice to actually populate keys so this
     *  is a no-op guard. */
    public static List<String> legacyParts(final String key) {
        return key == null ? List.of() : Arrays.asList(key.split("\\|"));
    }
}
