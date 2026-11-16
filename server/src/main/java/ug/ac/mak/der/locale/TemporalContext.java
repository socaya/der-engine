package ug.ac.mak.der.locale;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.Objects;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;

/**
 * FR-04-09 — single source of truth for server-side timezone and
 * locale decisions.
 *
 * <p>Call this instead of reaching for {@link ZoneId#systemDefault()}
 * or {@link Locale#getDefault()}. Both are JVM-process-level globals
 * that silently differ between a containerised appliance and a
 * bare-metal one; this service makes the decision explicit and
 * admin-configurable via {@link LocaleProperties}.</p>
 */
@Service
@EnableConfigurationProperties(LocaleProperties.class)
public class TemporalContext {

    private final LocaleProperties props;

    public TemporalContext(final LocaleProperties props) {
        this.props = Objects.requireNonNull(props, "props");
    }

    public ZoneId serverZone() {
        return props.resolvedZone();
    }

    public Locale defaultLocale() {
        return props.resolvedLocale();
    }

    public String defaultLocaleTag() {
        return props.defaultLocale();
    }

    /**
     * Membership test for the "English-family" fallback list. The
     * i18n stub treats any locale whose language tag starts with one
     * of these prefixes as "requested the empty English dictionary
     * on purpose" — don't attach the I18N_FALLBACK warning in that
     * case. Case-insensitive.
     */
    public boolean isEnglishFamily(final String requested) {
        if (requested == null || requested.isBlank()) {
            return true;
        }
        final String lower = requested.toLowerCase(Locale.ROOT);
        for (final String prefix : props.englishFamilyLocales()) {
            if (prefix != null
                    && lower.startsWith(prefix.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    /**
     * Parse a timestamp that MIGHT or MIGHT NOT carry a zone. When
     * absent, anchor to {@link #serverZone()} rather than the JVM
     * default. Returns {@link Instant} so callers don't need to
     * carry zone through their call stack.
     *
     * @throws DateTimeParseException when the text parses as neither
     *     a zoned timestamp nor a local-time-only timestamp.
     */
    public Instant parseFlexibleInstant(final String text) {
        Objects.requireNonNull(text, "text");
        try {
            return Instant.parse(text);
        } catch (DateTimeParseException ignored) {
            // fall through to the local-no-zone variant
        }
        try {
            return ZonedDateTime.parse(text).toInstant();
        } catch (DateTimeParseException ignored) {
            // fall through
        }
        final LocalDateTime local = LocalDateTime.parse(text);
        return local.atZone(serverZone()).toInstant();
    }
}
