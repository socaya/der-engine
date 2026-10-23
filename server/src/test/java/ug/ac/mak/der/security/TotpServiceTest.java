package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

class TotpServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-23T00:00:00Z");
    private final TotpService svc = new TotpService(Clock.fixed(NOW, ZoneOffset.UTC));

    @Test
    void generateSecretProduces20Bytes32CharsBase32() {
        final String s = svc.generateSecret();
        assertThat(s).hasSize(32);
        assertThat(s.chars()).allMatch(c -> "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(c) >= 0);
    }

    @Test
    void otpAuthUriShape() {
        final String uri = svc.otpAuthUri("DER", "alice", "JBSWY3DPEHPK3PXP");
        assertThat(uri).startsWith("otpauth://totp/DER:alice?");
        assertThat(uri).contains("secret=JBSWY3DPEHPK3PXP");
        assertThat(uri).contains("algorithm=SHA1");
    }

    @Test
    void verifyAcceptsCurrentStepCode() {
        final String secret = svc.generateSecret();
        final long step = NOW.getEpochSecond() / 30;
        final String code = svc.generate(secret, step);
        assertThat(svc.verify(secret, code)).isTrue();
    }

    @Test
    void verifyAcceptsOneStepDrift() {
        final String secret = svc.generateSecret();
        final long step = NOW.getEpochSecond() / 30;
        assertThat(svc.verify(secret, svc.generate(secret, step - 1))).isTrue();
        assertThat(svc.verify(secret, svc.generate(secret, step + 1))).isTrue();
    }

    @Test
    void verifyRejectsTwoStepDrift() {
        final String secret = svc.generateSecret();
        final long step = NOW.getEpochSecond() / 30;
        assertThat(svc.verify(secret, svc.generate(secret, step + 2))).isFalse();
    }

    @Test
    void verifyRejectsMalformedInputs() {
        final String secret = svc.generateSecret();
        assertThat(svc.verify(null, "123456")).isFalse();
        assertThat(svc.verify("", "123456")).isFalse();
        assertThat(svc.verify(secret, null)).isFalse();
        assertThat(svc.verify(secret, "12345")).isFalse();
        assertThat(svc.verify(secret, "abcdef")).isFalse();
    }

    @Test
    void generateIs6Digits() {
        final String code = svc.generate("JBSWY3DPEHPK3PXP", 1);
        assertThat(code).hasSize(6).matches("\\d{6}");
    }

    @Test
    void base32RoundTrip() {
        final byte[] data = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 };
        final String encoded = TotpService.base32Encode(data);
        assertThat(TotpService.base32Decode(encoded)).containsExactly(data);
    }

    @Test
    void base32DecodeRejectsInvalidChar() {
        assertThatThrownBy(() -> TotpService.base32Decode("!!!"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
