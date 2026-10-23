package ug.ac.mak.der.agent;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * ADR-0029 scaffold. The Agent polls DHIS2 Core's /api/metadata for
 * changed objects and fans out webhook notifications to registered
 * edges. Alpha.9 ships the Spring Boot shell; polling + webhook
 * dispatch land in subsequent alphas.
 */
@SpringBootApplication
public class AgentApplication {

    public static void main(final String[] args) {
        SpringApplication.run(AgentApplication.class, args);
    }
}
