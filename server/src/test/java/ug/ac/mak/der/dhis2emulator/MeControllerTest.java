package ug.ac.mak.der.dhis2emulator;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.EnumSet;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.web.TestSecurityConfig;

@WebMvcTest(MeController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class MeControllerTest {

    @Autowired MockMvc mockMvc;

    private RequestPostProcessor as(final EdgeRole... roles) {
        final Instant now = Instant.now();
        final EnumSet<EdgeRole> set = roles.length == 0
                ? EnumSet.noneOf(EdgeRole.class)
                : EnumSet.copyOf(java.util.Arrays.asList(roles));
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "alice", "Alice", EdgeUser.Origin.DHIS2, "x1", false,
                set, now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void projectsPrincipal() throws Exception {
        mockMvc.perform(get("/api/me").with(as(EdgeRole.OPERATOR, EdgeRole.REVIEWER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("alice"))
                .andExpect(jsonPath("$.displayName").value("Alice"))
                .andExpect(jsonPath("$.authorities").value(org.hamcrest.Matchers.hasItem("DER_OPERATOR")))
                .andExpect(jsonPath("$.userRoles[?(@.displayName=='OPERATOR')].id")
                        .value("DER-ROLE-OPERATOR"))
                .andExpect(jsonPath("$.derOrigin").value("DHIS2"));
    }

    @Test
    void anonymousIs401() throws Exception {
        mockMvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void userWithNoRolesStillRendersEmptyAuthorityArrays() throws Exception {
        mockMvc.perform(get("/api/me").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authorities").isArray())
                .andExpect(jsonPath("$.userRoles").isArray());
    }
}
