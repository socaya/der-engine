package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class AuthorityCatalogTest {

    @Test
    void everyAuthorityIsDerPrefixed() {
        for (final AuthorityCatalog a : AuthorityCatalog.values()) {
            assertThat(a.authority()).startsWith("der.");
            assertThat(a.module()).isNotBlank();
            assertThat(a.description()).isNotBlank();
        }
    }

    @Test
    void allReturnsImmutableList() {
        assertThat(AuthorityCatalog.all()).containsExactly(AuthorityCatalog.values());
        org.assertj.core.api.Assertions
                .assertThatThrownBy(() -> AuthorityCatalog.all().add(AuthorityCatalog.USERS_READ))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void validAuthorityStringsCoversEveryEnumConstant() {
        final java.util.Set<String> strings = AuthorityCatalog.validAuthorityStrings();
        for (final AuthorityCatalog a : AuthorityCatalog.values()) {
            assertThat(strings).contains(a.authority());
        }
        assertThat(strings).hasSize(AuthorityCatalog.values().length);
    }
}
