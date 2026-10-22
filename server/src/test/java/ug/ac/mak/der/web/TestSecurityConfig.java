package ug.ac.mak.der.web;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Permissive Spring Security chain for {@code @WebMvcTest} slices.
 *
 * <p>The real {@code SecurityConfig} is scoped out on the {@code test}
 * profile; this config stands in so Spring Security filters are present
 * (so {@code .with(authentication(...))} can install the SecurityContext)
 * while every request is permitted.</p>
 */
@TestConfiguration
@EnableWebSecurity
public class TestSecurityConfig {

    @Bean
    SecurityFilterChain testFilterChain(final HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }
}
