package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class PasswordHasherTest {

    private final PasswordHasher hasher = new PasswordHasher();

    @Test
    void hashesAndVerifies() {
        final String verifier = hasher.hash("correct horse battery staple");
        assertThat(verifier).startsWith("$argon2id$");
        assertThat(hasher.verify("correct horse battery staple", verifier)).isTrue();
        assertThat(hasher.verify("wrong", verifier)).isFalse();
    }

    @Test
    void producesDifferentVerifiersForSamePassword() {
        final String a = hasher.hash("abcDEF123");
        final String b = hasher.hash("abcDEF123");
        assertThat(a).isNotEqualTo(b);
        assertThat(hasher.verify("abcDEF123", a)).isTrue();
        assertThat(hasher.verify("abcDEF123", b)).isTrue();
    }

    @Test
    void hashRejectsNullOrEmpty() {
        assertThatThrownBy(() -> hasher.hash(null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> hasher.hash("")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void acceptsCustomEncoder() {
        final org.springframework.security.crypto.password.PasswordEncoder enc =
                new org.springframework.security.crypto.argon2.Argon2PasswordEncoder(16, 32, 1, 65536, 3);
        final PasswordHasher custom = new PasswordHasher(enc);
        final String v = custom.hash("x");
        assertThat(custom.verify("x", v)).isTrue();
    }

    @Test
    void verifyReturnsFalseForNullOrEmptyInputs() {
        final String verifier = hasher.hash("x");
        assertThat(hasher.verify(null, verifier)).isFalse();
        assertThat(hasher.verify("", verifier)).isFalse();
        assertThat(hasher.verify("x", null)).isFalse();
        assertThat(hasher.verify("x", "")).isFalse();
    }
}
