package ug.ac.mak.der.analytics.engine;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

/**
 * One declared dimension on an analytics metric. Spec §4.4 /
 * §5.1 — operators partition cells by named axes like sex,
 * age-band, service point, diagnosis class.
 *
 * <p>Two source kinds are supported in Phase 4a:</p>
 * <ul>
 *   <li>{@code DATA_ELEMENT} — reads the value from the event's
 *       {@code data_values} JSON at {@code sourceUid}.</li>
 *   <li>{@code VARIABLE} — reads the engine variable at
 *       {@code sourceUid} (e.g. {@code event_status},
 *       {@code org_unit_uid}, {@code program_stage}).</li>
 * </ul>
 *
 * <p>Optional {@code buckets} bins a numeric dimension into
 * labelled ranges (e.g. age bands). Each bucket defines a
 * half-open range {@code [min, max)}; the first bucket whose range
 * contains the resolved value wins. If no bucket matches, the raw
 * value is emitted. Non-numeric dimensions ignore {@code buckets}.</p>
 *
 * <p>Attribute-level dimensions ({@code A{uid}}) need a cross-event
 * TEI join and land in Phase 4b with the enrollment-grain engine.</p>
 */
public record AnalyticsDimension(
        String name,
        Kind kind,
        String sourceUid,
        List<Bucket> buckets,
        String optionSetUid) {

    public AnalyticsDimension {
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(kind, "kind");
        Objects.requireNonNull(sourceUid, "sourceUid");
        buckets = buckets == null ? List.of() : List.copyOf(buckets);
        if (name.contains("=") || name.contains("|")) {
            throw new IllegalArgumentException(
                    "dimension name must not contain '=' or '|'");
        }
    }

    /** 4-arg form for Phase-4a call sites + tests that predate the
     *  OptionSet label resolver. */
    public AnalyticsDimension(final String name, final Kind kind,
                                final String sourceUid,
                                final List<Bucket> buckets) {
        this(name, kind, sourceUid, buckets, null);
    }

    public enum Kind {
        DATA_ELEMENT, VARIABLE
    }

    /** Numeric bin — {@code [min, max)}. {@code min=null} / {@code max=null}
     *  are unbounded on that side, so the final "60+" band is
     *  {@code min=60, max=null}. */
    public record Bucket(String label, BigDecimal min, BigDecimal max) {
        public Bucket {
            Objects.requireNonNull(label, "label");
            if (min != null && max != null && min.compareTo(max) >= 0) {
                throw new IllegalArgumentException(
                        "bucket '" + label + "': min must be < max");
            }
        }

        public boolean contains(final BigDecimal n) {
            if (n == null) {
                return false;
            }
            if (min != null && n.compareTo(min) < 0) {
                return false;
            }
            if (max != null && n.compareTo(max) >= 0) {
                return false;
            }
            return true;
        }
    }
}
