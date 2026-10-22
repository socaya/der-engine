package ug.ac.mak.der.orgunit;

import java.util.Objects;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import ug.ac.mak.der.workflow.DeviceOwnerEnforcementInterceptor;

/**
 * Wires {@link OrgUnitScopeInterceptor} and (if present) the ADR-0023
 * {@link DeviceOwnerEnforcementInterceptor} into the Spring MVC chain.
 */
@Configuration
@ConditionalOnBean(OrgUnitScopeInterceptor.class)
public class OrgUnitWebConfig implements WebMvcConfigurer {

    private final OrgUnitScopeInterceptor interceptor;
    private final ObjectProvider<DeviceOwnerEnforcementInterceptor> deviceOwner;

    public OrgUnitWebConfig(final OrgUnitScopeInterceptor interceptor,
                             final ObjectProvider<DeviceOwnerEnforcementInterceptor> deviceOwner) {
        this.interceptor = Objects.requireNonNull(interceptor, "interceptor");
        this.deviceOwner = Objects.requireNonNull(deviceOwner, "deviceOwner");
    }

    @Override
    public void addInterceptors(final InterceptorRegistry registry) {
        registry.addInterceptor(interceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/system/**", "/api/me");
        final DeviceOwnerEnforcementInterceptor doe = deviceOwner.getIfAvailable();
        if (doe != null) {
            registry.addInterceptor(doe)
                    .addPathPatterns("/api/dataValueSets");
        }
    }
}
