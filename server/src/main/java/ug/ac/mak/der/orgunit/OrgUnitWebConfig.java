package ug.ac.mak.der.orgunit;

import java.util.Objects;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Wires {@link OrgUnitScopeInterceptor} into the Spring MVC chain. */
@Configuration
@ConditionalOnBean(OrgUnitScopeInterceptor.class)
public class OrgUnitWebConfig implements WebMvcConfigurer {

    private final OrgUnitScopeInterceptor interceptor;

    public OrgUnitWebConfig(final OrgUnitScopeInterceptor interceptor) {
        this.interceptor = Objects.requireNonNull(interceptor, "interceptor");
    }

    @Override
    public void addInterceptors(final InterceptorRegistry registry) {
        registry.addInterceptor(interceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/system/**", "/api/me");
    }
}
