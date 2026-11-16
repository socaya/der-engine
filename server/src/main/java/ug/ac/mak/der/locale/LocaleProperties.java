package ug.ac.mak.der.locale;

import java.time.ZoneId;
import java.util.List;
import java.util.Locale;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.ConstructorBinding;

/**
 * FR-04-09 — explicit server-side locale + timezone fallback policy.
 *
 * <p>Without this, DER inherited whatever the JVM default happened to
 * be, which is a documented source of inconsistency between an
 * appliance that boots with {@code TZ=UTC} (containerised) and one
 * that boots with the host's local zone (bare-metal). Both are
 * possible production topologies on the current install path.</p>
 *
 * <p>Three knobs:
 * <ul>
 *   <li>{@link #defaultLocale} — locale used when a caller doesn't
 *       advertise one via {@code Accept-Language} or a {@code locale}
 *       query parameter. Default {@code en}.</li>
 *   <li>{@link #serverTimeZone} — zone used to interpret
 *       zone-less timestamps the server receives (e.g. a DHIS2 app
 *       posting {@code "2026-11-15T10:00"} with no offset). Default
 *       {@code UTC}, which is the DHIS2 server norm.</li>
 *   <li>{@link #englishFamilyLocales} — prefixes that count as
 *       "English-family" for the i18n stub's fallback decision; a
 *       request with any of these as its locale prefix gets the
 *       empty-messages English response without the
 *       {@code I18N_FALLBACK} warning. Default {@code en}.</li>
 * </ul>
 */
@ConfigurationProperties(prefix = "der.locale")
public record LocaleProperties(String defaultLocale,
                                 String serverTimeZone,
                                 List<String> englishFamilyLocales) {

    @ConstructorBinding
    public LocaleProperties {
        if (defaultLocale == null || defaultLocale.isBlank()) {
            defaultLocale = "en";
        }
        if (serverTimeZone == null || serverTimeZone.isBlank()) {
            serverTimeZone = "UTC";
        }
        if (englishFamilyLocales == null || englishFamilyLocales.isEmpty()) {
            englishFamilyLocales = List.of("en");
        } else {
            englishFamilyLocales = List.copyOf(englishFamilyLocales);
        }
    }

    /** The parsed {@link ZoneId}. {@code UTC} on an invalid value —
     *  mis-config shouldn't crash the appliance; the {@code /clock}
     *  probe surfaces the resolved zone back so operators can see it
     *  fell back to UTC. */
    public ZoneId resolvedZone() {
        try {
            return ZoneId.of(serverTimeZone);
        } catch (java.time.DateTimeException ex) {
            return ZoneId.of("UTC");
        }
    }

    public Locale resolvedLocale() {
        return Locale.forLanguageTag(defaultLocale == null ? "en" : defaultLocale);
    }
}
