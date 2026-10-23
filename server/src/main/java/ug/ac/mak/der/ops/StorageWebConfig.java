package ug.ac.mak.der.ops;

import java.util.Objects;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Registers {@link StorageAdmissionInterceptor} on edge-api write paths.
 * Gated on {@link StorageHealthProbe}: {@code @WebMvcTest} slice tests
 * skip the full probe wiring so the interceptor isn't attempted.
 */
@Configuration
@ConditionalOnBean(StorageHealthProbe.class)
public class StorageWebConfig implements WebMvcConfigurer {

    private final StorageHealthProbe probe;

    public StorageWebConfig(final StorageHealthProbe probe) {
        this.probe = Objects.requireNonNull(probe, "probe");
    }

    @Bean
    StorageAdmissionInterceptor storageAdmissionInterceptor() {
        return new StorageAdmissionInterceptor(probe);
    }

    @Override
    public void addInterceptors(final InterceptorRegistry registry) {
        registry.addInterceptor(storageAdmissionInterceptor())
                .addPathPatterns("/edge-api/**");
    }
}
