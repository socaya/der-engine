package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PiiMaskingTest {

    @Test
    void maskUsername() {
        assertThat(PiiMasking.maskUsername(null)).isNull();
        assertThat(PiiMasking.maskUsername("")).isEmpty();
        assertThat(PiiMasking.maskUsername("   ")).isEqualTo("   ");
        assertThat(PiiMasking.maskUsername("a")).isEqualTo("*");
        assertThat(PiiMasking.maskUsername("ab")).isEqualTo("**");
        assertThat(PiiMasking.maskUsername("alice")).isEqualTo("a***e");
        assertThat(PiiMasking.maskUsername("alice.smith")).isEqualTo("a*********h");
    }

    @Test
    void maskEmail() {
        assertThat(PiiMasking.maskEmail(null)).isNull();
        assertThat(PiiMasking.maskEmail("not-an-email")).isEqualTo("n**********l");
        assertThat(PiiMasking.maskEmail("alice@example.org")).isEqualTo("a***e@example.org");
        // Degenerate "emails" without a usable local part fall back to maskUsername.
        assertThat(PiiMasking.maskEmail("@foo")).isEqualTo("@**o");
        assertThat(PiiMasking.maskEmail("x@")).isEqualTo("**");
    }

    @Test
    void maskDisplayName() {
        assertThat(PiiMasking.maskDisplayName(null)).isNull();
        assertThat(PiiMasking.maskDisplayName("")).isEmpty();
        assertThat(PiiMasking.maskDisplayName("   ")).isEqualTo("   ");
        assertThat(PiiMasking.maskDisplayName("Alice")).isEqualTo("A****");
        assertThat(PiiMasking.maskDisplayName("Alice Jane")).isEqualTo("A**** J***");
        assertThat(PiiMasking.maskDisplayName("A J Smith")).isEqualTo("A J S****");
    }
}
