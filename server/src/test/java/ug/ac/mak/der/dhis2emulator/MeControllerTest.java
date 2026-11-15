package ug.ac.mak.der.dhis2emulator;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.EnumSet;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.orgunit.EdgeOrgUnitBinding;
import ug.ac.mak.der.orgunit.OrgUnitBindingService;
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
    @MockBean OrgUnitBindingService binding;

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

    @Test
    void populatesBoundOrgUnitAcrossAllThreeLists() throws Exception {
        final EdgeOrgUnitBinding bound = EdgeOrgUnitBinding.bound(
                "OU-CLINIC-A", "A&A Medcare",
                "/HL2zXaIULBe/IK0Mg4vXyTl/OU-CLINIC-A",
                UUID.randomUUID());
        Mockito.when(binding.effectiveScopeFor(org.mockito.ArgumentMatchers.any()))
                .thenReturn(new OrgUnitBindingService.EffectiveScope(
                        OrgUnitBindingService.EffectiveScope.State.NO_ASSIGNMENT,
                        bound, null, null));
        mockMvc.perform(get("/api/me").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organisationUnits[0].id").value("OU-CLINIC-A"))
                .andExpect(jsonPath("$.organisationUnits[0].displayName").value("A&A Medcare"))
                .andExpect(jsonPath("$.organisationUnits[0].path")
                        .value("/HL2zXaIULBe/IK0Mg4vXyTl/OU-CLINIC-A"))
                .andExpect(jsonPath("$.dataViewOrganisationUnits[0].id").value("OU-CLINIC-A"))
                .andExpect(jsonPath("$.teiSearchOrganisationUnits[0].id").value("OU-CLINIC-A"))
                .andExpect(jsonPath("$.warnings").doesNotExist());
    }

    @Test
    void unboundApplianceSurfacesNoOuBoundWarning() throws Exception {
        Mockito.when(binding.effectiveScopeFor(org.mockito.ArgumentMatchers.any()))
                .thenReturn(new OrgUnitBindingService.EffectiveScope(
                        OrgUnitBindingService.EffectiveScope.State.UNBOUND,
                        EdgeOrgUnitBinding.empty(), null, null));
        mockMvc.perform(get("/api/me").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organisationUnits").isEmpty())
                .andExpect(jsonPath("$.dataViewOrganisationUnits").isEmpty())
                .andExpect(jsonPath("$.teiSearchOrganisationUnits").isEmpty())
                .andExpect(jsonPath("$.warnings[0]").value("NO_OU_BOUND"));
    }

    @Test
    void narrowedScopeOverridesDeviceWideBinding() throws Exception {
        final EdgeOrgUnitBinding bound = EdgeOrgUnitBinding.bound(
                "OU-CLINIC-A", "A&A Medcare",
                "/HL2zXaIULBe/IK0Mg4vXyTl/OU-CLINIC-A",
                UUID.randomUUID());
        Mockito.when(binding.effectiveScopeFor(org.mockito.ArgumentMatchers.any()))
                .thenReturn(new OrgUnitBindingService.EffectiveScope(
                        OrgUnitBindingService.EffectiveScope.State.SCOPE_ASSIGNED,
                        bound, "OU-ROOM-7",
                        new OrgUnitBindingService.NarrowedOu(
                                "OU-ROOM-7", "Room 7",
                                "/HL2zXaIULBe/IK0Mg4vXyTl/OU-CLINIC-A/OU-ROOM-7")));
        mockMvc.perform(get("/api/me").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organisationUnits[0].id").value("OU-ROOM-7"))
                .andExpect(jsonPath("$.organisationUnits[0].displayName").value("Room 7"))
                .andExpect(jsonPath("$.warnings").doesNotExist());
    }

    @Test
    void outOfBoundScopeFallsBackAndWarns() throws Exception {
        final EdgeOrgUnitBinding bound = EdgeOrgUnitBinding.bound(
                "OU-CLINIC-A", "A&A Medcare",
                "/HL2zXaIULBe/IK0Mg4vXyTl/OU-CLINIC-A",
                UUID.randomUUID());
        Mockito.when(binding.effectiveScopeFor(org.mockito.ArgumentMatchers.any()))
                .thenReturn(new OrgUnitBindingService.EffectiveScope(
                        OrgUnitBindingService.EffectiveScope.State.SCOPE_FALLS_OUTSIDE,
                        bound, "OU-ROOM-7-stale", null));
        mockMvc.perform(get("/api/me").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                // Falls back to the device-wide bound OU.
                .andExpect(jsonPath("$.organisationUnits[0].id").value("OU-CLINIC-A"))
                .andExpect(jsonPath("$.warnings[0]").value("SCOPE_ASSIGNMENT_OUT_OF_BOUND"));
    }
}
