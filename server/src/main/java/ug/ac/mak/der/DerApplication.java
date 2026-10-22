package ug.ac.mak.der;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

// Non-final so Spring's @Configuration CGLIB proxy can subclass it.
@SpringBootApplication
@ConfigurationPropertiesScan("ug.ac.mak.der")
public class DerApplication {

    protected DerApplication() {
        // Spring Boot entry point; direct instantiation is not meaningful.
    }

    public static void main(final String[] args) {
        SpringApplication.run(DerApplication.class, args);
    }
}
