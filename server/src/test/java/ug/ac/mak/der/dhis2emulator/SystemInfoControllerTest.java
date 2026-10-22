package ug.ac.mak.der.dhis2emulator;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.build.BuildInfo;
import ug.ac.mak.der.build.BuildInfoProvider;
import ug.ac.mak.der.dhis2.Dhis2Properties;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.web.TestSecurityConfig;

@WebMvcTest(SystemInfoController.class)
@ActiveProfiles("test")
@Import({TestSecurityConfig.class, SystemInfoControllerTest.Config.class})
class SystemInfoControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean BuildInfoProvider build;

    @org.springframework.boot.test.context.TestConfiguration
    static class Config {
        @Bean
        Clock testClock() {
            return Clock.fixed(Instant.parse("2026-10-22T12:00:00Z"), ZoneOffset.UTC);
        }

        @Bean
        Dhis2Properties props() {
            return new Dhis2Properties(
                    new Dhis2Properties.Central("http://central/dhis", "u", "p", 5000),
                    new Dhis2Properties.Compatibility("2.44-SNAPSHOT", false));
        }
    }

    private RequestPostProcessor as() {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op", EdgeUser.Origin.BOOTSTRAP, null, false,
                EnumSet.of(EdgeRole.OPERATOR), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void returnsDhis2Shape() throws Exception {
        when(build.buildInfo()).thenReturn(new BuildInfo(
                "0.4.0-SNAPSHOT", "deadbee", "main", false,
                Instant.parse("2026-10-22T00:00:00Z"), "2.44-SNAPSHOT"));
        mockMvc.perform(get("/api/system/info").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value("2.44-SNAPSHOT"))
                .andExpect(jsonPath("$.revision").value("deadbee"))
                .andExpect(jsonPath("$.systemName").value("DER Edge Runtime 0.4.0-SNAPSHOT"))
                .andExpect(jsonPath("$.derRelease").value("0.4.0-SNAPSHOT"))
                .andExpect(jsonPath("$.serverDate").value("2026-10-22T12:00:00Z"));
    }

    @Test
    void anonymousIs401() throws Exception {
        mockMvc.perform(get("/api/system/info"))
                .andExpect(status().isUnauthorized());
    }
}
