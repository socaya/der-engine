package ug.ac.mak.der.analytics.column;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Registry of the built-in typed codecs. Used by the compressed
 * wrapper to resolve its inner codec by id on decode without
 * carrying the instance across process restarts.
 *
 * <p>Compressed codecs are not registered here — their id contains
 * the {@code "compressor+inner"} split, and the wrapper handles
 * recursion itself.</p>
 */
public final class BuiltinCodecs {

    private static final Map<String, Codec> BY_ID;

    static {
        final Map<String, Codec> m = new LinkedHashMap<>();
        for (final ColumnType t : ColumnType.values()) {
            final Codec c = PlainCodec.forType(t);
            m.put(c.codecId(), c);
        }
        final DictionaryStringCodec dict = new DictionaryStringCodec();
        m.put(dict.codecId(), dict);
        final BitPackedInt64Codec bp = new BitPackedInt64Codec();
        m.put(bp.codecId(), bp);
        BY_ID = Map.copyOf(m);
    }

    private BuiltinCodecs() {
    }

    public static Codec lookup(final String id) {
        return BY_ID.get(id);
    }
}
