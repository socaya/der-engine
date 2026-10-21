package ug.ac.mak.der.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

class SystemHealthResponseTest {

    private static final ObjectMapper MAPPER = JsonMapper.builder()
            .addModule(new JavaTimeModule())
            .build();

    @Test
    void serialisesWithStableFieldOrder() throws Exception {
        final SystemHealthResponse r = new SystemHealthResponse(
                "der-server",
                "starter-ready",
                "0.1.0-SNAPSHOT",
                "abc1234",
                "main",
                false,
                Instant.parse("2026-10-21T00:00:00Z"),
                false,
                new SystemHealthResponse.Dhis2Reference("unknown"),
                Instant.parse("2026-10-21T12:00:00Z")
        );
        final String json = MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(r);

        assertThat(json)
                .contains("\"service\" : \"der-server\"")
                .contains("\"dhis2Integrated\" : false")
                .contains("\"version\" : \"0.1.0-SNAPSHOT\"")
                .contains("\"dhis2Reference\"");
    }

    @Test
    void dhis2ReferenceCarriesVersion() {
        final SystemHealthResponse.Dhis2Reference ref = new SystemHealthResponse.Dhis2Reference("2.43.1");
        assertThat(ref.version()).isEqualTo("2.43.1");
    }
}
