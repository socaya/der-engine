package ug.ac.mak.der.dhis2emulator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.ResponseEntity;

import ug.ac.mak.der.locale.LocaleProperties;
import ug.ac.mak.der.locale.TemporalContext;

class I18nControllerTest {

    @SuppressWarnings("unchecked")
    private static ObjectProvider<TemporalContext> provider(final TemporalContext t) {
        final ObjectProvider<TemporalContext> p = mock(ObjectProvider.class);
        when(p.getIfAvailable()).thenReturn(t);
        return p;
    }

    /** Default-locale controller that mirrors the pre-FR-04-09
     *  `en`-family behaviour when no temporal provider is wired. */
    private I18nController defaultCtl() {
        return new I18nController(provider(null));
    }

    private I18nController ctlWith(final TemporalContext t) {
        return new I18nController(provider(t));
    }

    @Test
    void englishLocaleReturnsNoWarning() {
        final ResponseEntity<Map<String, Object>> res = defaultCtl().get("en");
        assertThat(res.getBody()).containsEntry("locale", "en");
        assertThat(res.getBody()).doesNotContainKey("warnings");
    }

    @Test
    void missingLocaleIsTreatedAsEnglish() {
        final ResponseEntity<Map<String, Object>> res = defaultCtl().get(null);
        assertThat(res.getBody()).doesNotContainKey("warnings");
    }

    @Test
    @SuppressWarnings("unchecked")
    void nonEnglishLocaleAttachesFallbackWarning() {
        final ResponseEntity<Map<String, Object>> res = defaultCtl().get("fr");
        assertThat(res.getBody()).containsEntry("locale", "en");
        assertThat(res.getBody()).containsEntry("requestedLocale", "fr");
        assertThat((List<Object>) res.getBody().get("warnings"))
                .containsExactly("I18N_FALLBACK");
    }

    @Test
    void configuredDefaultLocaleIsReflectedInResponse() {
        final var ctx = new TemporalContext(
                new LocaleProperties("fr", "UTC", List.of("fr", "en")));
        final ResponseEntity<Map<String, Object>> res = ctlWith(ctx).get(null);
        assertThat(res.getBody()).containsEntry("locale", "fr");
        assertThat(res.getBody()).doesNotContainKey("warnings");
    }

    @Test
    void englishFamilyFromConfigAvoidsFallbackWarning() {
        // Operator extends English family to include en-GB; a request
        // for en-GB should NOT trigger I18N_FALLBACK.
        final var ctx = new TemporalContext(
                new LocaleProperties("en", "UTC", List.of("en")));
        final ResponseEntity<Map<String, Object>> res = ctlWith(ctx).get("en-GB");
        assertThat(res.getBody()).doesNotContainKey("warnings");
    }

    @Test
    @SuppressWarnings("unchecked")
    void nonFamilyLocaleStillWarnsUnderConfiguredDefault() {
        final var ctx = new TemporalContext(
                new LocaleProperties("en", "UTC", List.of("en")));
        final ResponseEntity<Map<String, Object>> res = ctlWith(ctx).get("de");
        assertThat((List<Object>) res.getBody().get("warnings"))
                .containsExactly("I18N_FALLBACK");
        assertThat(res.getBody()).containsEntry("requestedLocale", "de");
    }
}
