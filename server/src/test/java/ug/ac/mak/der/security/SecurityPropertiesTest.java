package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;

import org.junit.jupiter.api.Test;

class SecurityPropertiesTest {

    @Test
    void defaultsApplied() {
        final SecurityProperties p = new SecurityProperties(null, null, null);
        assertThat(p.session().ttl()).isEqualTo(Duration.ofHours(4));
        assertThat(p.session().cookieName()).isEqualTo("DER_SESSION");
        assertThat(p.session().cookieSecure()).isFalse();
        assertThat(p.session().cookieSameSite()).isEqualTo("Strict");
        assertThat(p.session().secret()).isEmpty();
        assertThat(p.signIn().rateLimitPerIpPerMinute()).isEqualTo(30);
        assertThat(p.signIn().rateLimitPerUserPerMinute()).isEqualTo(10);
        assertThat(p.bootstrap().isConfigured()).isFalse();
    }

    @Test
    void explicitValuesSurvive() {
        final SecurityProperties p = new SecurityProperties(
                new SecurityProperties.Session(Duration.ofHours(1), "C", true, "Lax", "s"),
                new SecurityProperties.SignIn(10, 5),
                new SecurityProperties.Bootstrap("u", "p"));
        assertThat(p.session().ttl()).isEqualTo(Duration.ofHours(1));
        assertThat(p.signIn().rateLimitPerIpPerMinute()).isEqualTo(10);
        assertThat(p.bootstrap().isConfigured()).isTrue();
    }

    @Test
    void bootstrapIsNotConfiguredWhenAnyFieldBlank() {
        assertThat(new SecurityProperties.Bootstrap("", "p").isConfigured()).isFalse();
        assertThat(new SecurityProperties.Bootstrap("u", "").isConfigured()).isFalse();
        assertThat(new SecurityProperties.Bootstrap(null, "p").isConfigured()).isFalse();
        assertThat(new SecurityProperties.Bootstrap("u", null).isConfigured()).isFalse();
        assertThat(new SecurityProperties.Bootstrap("u", "p").isConfigured()).isTrue();
    }
}
