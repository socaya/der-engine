package ug.ac.mak.der.web;

import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsStringIgnoringCase;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import ug.ac.mak.der.build.BuildInfo;
import ug.ac.mak.der.build.BuildInfoProvider;

@WebMvcTest(SystemController.class)
@Import(SystemControllerTest.FixedClockConfig.class)
class SystemControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private BuildInfoProvider buildInfoProvider;

    @Test
    void reportsServiceIdentityAndBuildInfo() throws Exception {
        when(buildInfoProvider.buildInfo()).thenReturn(new BuildInfo(
                "0.1.0-SNAPSHOT",
                "abc1234",
                "main",
                false,
                Instant.parse("2026-10-21T00:00:00Z"),
                "unknown"
        ));

        mockMvc.perform(get("/edge-api/v1/system/health"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.service").value("der-server"))
                .andExpect(jsonPath("$.status").value("starter-ready"))
                .andExpect(jsonPath("$.version").value("0.1.0-SNAPSHOT"))
                .andExpect(jsonPath("$.commit").value("abc1234"))
                .andExpect(jsonPath("$.branch").value("main"))
                .andExpect(jsonPath("$.dirty").value(false))
                .andExpect(jsonPath("$.buildTime").value("2026-10-21T00:00:00Z"))
                .andExpect(jsonPath("$.dhis2Integrated").value(false))
                .andExpect(jsonPath("$.dhis2Reference.version").value("unknown"))
                .andExpect(jsonPath("$.timestamp").value("2026-10-21T12:00:00Z"));
    }

    @Test
    void reportsDirtyFlagAndPinnedDhis2VersionWhenPresent() throws Exception {
        when(buildInfoProvider.buildInfo()).thenReturn(new BuildInfo(
                "0.5.0",
                "deadbeef",
                "release/0.5.0",
                true,
                Instant.parse("2026-12-01T00:00:00Z"),
                "2.43.1"
        ));

        mockMvc.perform(get("/edge-api/v1/system/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dirty").value(true))
                .andExpect(jsonPath("$.dhis2Reference.version").value("2.43.1"))
                .andExpect(jsonPath("$.dhis2Integrated").value(false));
    }

    @Test
    void doesNotLeakSecretsOrDatabaseDescriptors() throws Exception {
        when(buildInfoProvider.buildInfo()).thenReturn(new BuildInfo(
                "0.1.0", "c", "b", false, Instant.EPOCH, "unknown"));

        mockMvc.perform(get("/edge-api/v1/system/health"))
                .andExpect(content().string(not(containsStringIgnoringCase("password"))))
                .andExpect(content().string(not(containsStringIgnoringCase("secret"))))
                .andExpect(content().string(not(containsStringIgnoringCase("jdbc:"))))
                .andExpect(content().string(not(containsStringIgnoringCase("Bearer "))));
    }

    @Test
    void respondsAsJsonEvenWithoutAcceptHeader() throws Exception {
        when(buildInfoProvider.buildInfo()).thenReturn(new BuildInfo(
                "0.1.0", "c", "b", false, Instant.EPOCH, "unknown"));

        mockMvc.perform(get("/edge-api/v1/system/health"))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON));
    }

    @Test
    void unknownSystemPathReturns404() throws Exception {
        mockMvc.perform(get("/edge-api/v1/system/does-not-exist"))
                .andExpect(status().isNotFound());
    }

    @org.springframework.boot.test.context.TestConfiguration
    static class FixedClockConfig {
        @org.springframework.context.annotation.Bean
        public Clock testClock() {
            return Clock.fixed(Instant.parse("2026-10-21T12:00:00Z"), ZoneOffset.UTC);
        }
    }
}
