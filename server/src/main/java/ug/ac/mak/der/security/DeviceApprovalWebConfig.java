package ug.ac.mak.der.security;

import java.util.Objects;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Registers {@link DeviceApprovalInterceptor} across the app-bundle +
 * write surfaces that ADR-0019 slice B gates.
 */
@Configuration
@ConditionalOnBean(DeviceApprovalInterceptor.class)
public class DeviceApprovalWebConfig implements WebMvcConfigurer {

    private final ObjectProvider<DeviceApprovalInterceptor> interceptor;

    public DeviceApprovalWebConfig(
            final ObjectProvider<DeviceApprovalInterceptor> interceptor) {
        this.interceptor = Objects.requireNonNull(interceptor, "interceptor");
    }

    @Override
    public void addInterceptors(final InterceptorRegistry registry) {
        final DeviceApprovalInterceptor i = interceptor.getIfAvailable();
        if (i == null) {
            return;
        }
        registry.addInterceptor(i)
                .addPathPatterns(
                        // Executable code — the only app surface that lets
                        // a device actually DO something. Catalogue + icon
                        // are metadata and stay open so an unapproved
                        // device can discover its enrolment affordances.
                        "/edge-api/v1/apps/*/*/bundle.js",
                        "/api/dataValueSets",
                        "/api/events",
                        "/api/tracker/**");
    }
}
