package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.security.SecureRandom;

import org.junit.jupiter.api.Test;

class SessionIssuerTest {

    private final SessionIssuer issuer = new SessionIssuer();

    @Test
    void issuesHighEntropyTokens() {
        final String a = issuer.issueToken();
        final String b = issuer.issueToken();
        assertThat(a).isNotEqualTo(b);
        assertThat(a).matches("[A-Za-z0-9_-]+");
        // 32 bytes url-safe base64 => 43 chars no padding
        assertThat(a).hasSize(43);
    }

    @Test
    void hashIsStableAndHex() {
        final String token = "my-token";
        final String h1 = issuer.hash(token);
        final String h2 = issuer.hash(token);
        assertThat(h1).isEqualTo(h2);
        assertThat(h1).hasSize(64).matches("[0-9a-f]+");
    }

    @Test
    void hashRejectsNullOrEmpty() {
        assertThatThrownBy(() -> issuer.hash(null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> issuer.hash("")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void customRngIsHonoured() {
        final SessionIssuer custom = new SessionIssuer(new SecureRandom(new byte[]{1, 2, 3}));
        assertThat(custom.issueToken()).isNotEmpty();
    }
}
