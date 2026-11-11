package ug.ac.mak.der.analytics.column;

/**
 * Primitive column types supported by the native columnar engine
 * (SRS FR-STO-003). Each type has a matching {@link ColumnBatch}
 * implementation and a canonical {@link Codec} family.
 *
 * <p>Types are intentionally the minimum set the analytics engine
 * needs to represent a contribution ledger row + a materialised
 * cell. Complex types (arrays, maps) land in Gate 7 if a workload
 * justifies them.</p>
 */
public enum ColumnType {
    /** 64-bit signed integer. Backing: {@code long[]}. */
    INT64,
    /** Arbitrary-precision decimal with explicit scale per value.
     *  Backing: {@code BigDecimal[]}. Required for analytics
     *  precision (FR-INC-003 + §12 fixture 13). */
    DECIMAL,
    /** UTF-8 string. Backing: {@code String[]} for the plain codec;
     *  dictionary codec will switch to dictionary id + utf-8 pool. */
    STRING,
    /** Boolean. Backing: bit-packed {@code long[]}. */
    BOOL,
    /** Date, days since 1970-01-01. Backing: {@code int[]}. */
    DATE
}
