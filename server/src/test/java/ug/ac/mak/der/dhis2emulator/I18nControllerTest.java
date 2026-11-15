package ug.ac.mak.der.dhis2emulator;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

class I18nControllerTest {

    private final I18nController ctl = new I18nController();

    @Test
    void englishLocaleReturnsNoWarning() {
        final ResponseEntity<Map<String, Object>> res = ctl.get("en");
        assertThat(res.getBody()).containsEntry("locale", "en");
        assertThat(res.getBody()).doesNotContainKey("warnings");
    }

    @Test
    void missingLocaleIsTreatedAsEnglish() {
        final ResponseEntity<Map<String, Object>> res = ctl.get(null);
        assertThat(res.getBody()).doesNotContainKey("warnings");
    }

    @Test
    @SuppressWarnings("unchecked")
    void nonEnglishLocaleAttachesFallbackWarning() {
        final ResponseEntity<Map<String, Object>> res = ctl.get("fr");
        assertThat(res.getBody()).containsEntry("locale", "en");
        assertThat(res.getBody()).containsEntry("requestedLocale", "fr");
        assertThat((List<Object>) res.getBody().get("warnings")).containsExactly("I18N_FALLBACK");
    }
}
