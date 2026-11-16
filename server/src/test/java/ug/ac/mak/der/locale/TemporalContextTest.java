package ug.ac.mak.der.locale;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;

import org.junit.jupiter.api.Test;

class TemporalContextTest {

    private static LocaleProperties props(final String locale, final String tz,
                                            final List<String> family) {
        return new LocaleProperties(locale, tz, family);
    }

    @Test
    void defaultsResolveToUtcAndEnglish() {
        final var ctx = new TemporalContext(props(null, null, null));
        assertThat(ctx.serverZone()).isEqualTo(ZoneId.of("UTC"));
        assertThat(ctx.defaultLocale()).isEqualTo(Locale.forLanguageTag("en"));
        assertThat(ctx.defaultLocaleTag()).isEqualTo("en");
    }

    @Test
    void invalidZoneFallsBackToUtcNotCrash() {
        final var ctx = new TemporalContext(
                props("en", "Nowhere/NotAZone", null));
        assertThat(ctx.serverZone()).isEqualTo(ZoneId.of("UTC"));
    }

    @Test
    void englishFamilyMatchesConfiguredPrefixes() {
        final var ctx = new TemporalContext(
                props("en", "UTC", List.of("en", "en-US", "en-GB")));
        assertThat(ctx.isEnglishFamily("en")).isTrue();
        assertThat(ctx.isEnglishFamily("en-US")).isTrue();
        assertThat(ctx.isEnglishFamily("EN")).isTrue();  // case-insensitive
        assertThat(ctx.isEnglishFamily(null)).isTrue();   // null → fallback
        assertThat(ctx.isEnglishFamily("fr")).isFalse();
    }

    @Test
    void parseFlexibleHandlesInstantZonedLocal() {
        final var ctx = new TemporalContext(
                props("en", "Africa/Kampala", null));
        // Instant form — zone-explicit, trailing Z.
        assertThat(ctx.parseFlexibleInstant("2026-11-15T10:00:00Z").toString())
                .isEqualTo("2026-11-15T10:00:00Z");
        // Zoned form with offset.
        assertThat(ctx.parseFlexibleInstant("2026-11-15T10:00:00+03:00").toString())
                .isEqualTo("2026-11-15T07:00:00Z");
        // Zone-less local time — anchored to server zone
        // (Africa/Kampala = UTC+03:00). 10:00 local → 07:00 UTC.
        assertThat(ctx.parseFlexibleInstant("2026-11-15T10:00:00").toString())
                .isEqualTo("2026-11-15T07:00:00Z");
    }

    @Test
    void parseFlexibleRejectsGibberish() {
        final var ctx = new TemporalContext(props(null, null, null));
        assertThatThrownBy(() -> ctx.parseFlexibleInstant("not-a-date"))
                .isInstanceOf(DateTimeParseException.class);
    }

    @Test
    void parseFlexibleRequiresNonNull() {
        final var ctx = new TemporalContext(props(null, null, null));
        assertThatThrownBy(() -> ctx.parseFlexibleInstant(null))
                .isInstanceOf(NullPointerException.class);
    }
}
