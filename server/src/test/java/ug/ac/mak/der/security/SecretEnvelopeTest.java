package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.security.SecureRandom;
import java.util.Base64;

import org.junit.jupiter.api.Test;

class SecretEnvelopeTest {

    private static String makeKey() {
        final byte[] key = new byte[32];
        new SecureRandom().nextBytes(key);
        return Base64.getEncoder().encodeToString(key);
    }

    @Test
    void disabledWhenNoKeyConfigured() {
        final SecretEnvelope env = new SecretEnvelope("");
        assertThat(env.isEnabled()).isFalse();
        assertThat(env.seal("secret")).isEqualTo("secret");
        assertThat(env.open("secret")).isEqualTo("secret");
    }

    @Test
    void blankKeyTreatedAsDisabled() {
        final SecretEnvelope env = new SecretEnvelope("   ");
        assertThat(env.isEnabled()).isFalse();
    }

    @Test
    void rejectsWrongLengthKey() {
        final String tooShort = Base64.getEncoder().encodeToString(new byte[16]);
        assertThatThrownBy(() -> new SecretEnvelope(tooShort))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("32 bytes");
    }

    @Test
    void sealOpenRoundtrip() {
        final SecretEnvelope env = new SecretEnvelope(makeKey());
        assertThat(env.isEnabled()).isTrue();
        final String sealed = env.seal("JBSWY3DPEHPK3PXP");
        assertThat(sealed).startsWith("env:v1:");
        assertThat(env.open(sealed)).isEqualTo("JBSWY3DPEHPK3PXP");
    }

    @Test
    void openPassesThroughNonEnvelope() {
        final SecretEnvelope env = new SecretEnvelope(makeKey());
        assertThat(env.open("legacy-plain")).isEqualTo("legacy-plain");
    }

    @Test
    void openFailsWhenEnvelopePresentButKeyMissing() {
        final SecretEnvelope env = new SecretEnvelope(makeKey());
        final String sealed = env.seal("S");
        final SecretEnvelope noKey = new SecretEnvelope("");
        assertThatThrownBy(() -> noKey.open(sealed))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not configured");
    }

    @Test
    void openRejectsTruncatedEnvelope() {
        final SecretEnvelope env = new SecretEnvelope(makeKey());
        final String bogus = "env:v1:" + Base64.getEncoder().encodeToString(new byte[4]);
        assertThatThrownBy(() -> env.open(bogus))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void sealProducesDifferentCiphertextForSamePlaintext() {
        final SecretEnvelope env = new SecretEnvelope(makeKey());
        final String a = env.seal("S");
        final String b = env.seal("S");
        assertThat(a).isNotEqualTo(b);
    }
}
