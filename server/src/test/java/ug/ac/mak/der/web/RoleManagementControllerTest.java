package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.RoleDefinition;
import ug.ac.mak.der.security.RoleDefinitionRepository;
import ug.ac.mak.der.security.SecurityAuditRepository;

@WebMvcTest(RoleManagementController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class RoleManagementControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean RoleDefinitionRepository repo;
    @MockBean SecurityAuditRepository audit;
    @MockBean Clock clock;

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "admin", "Admin",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    private RoleDefinition sampleRole(final boolean builtin) {
        return new RoleDefinition(UUID.randomUUID(), builtin ? "Administrator" : "Custom",
                "d", builtin, builtin ? "ADMIN" : null,
                Set.of("der.users.read"), Instant.EPOCH, Instant.EPOCH);
    }

    @Test
    void listUnauthenticated() throws Exception {
        mockMvc.perform(get("/edge-api/v1/admin/roles"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void listForbiddenToOperator() throws Exception {
        mockMvc.perform(get("/edge-api/v1/admin/roles").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isForbidden());
    }

    @Test
    void listReturnsRoles() throws Exception {
        when(clock.instant()).thenReturn(Instant.EPOCH);
        final RoleDefinition rd = sampleRole(true);
        when(repo.findAll()).thenReturn(List.of(rd));
        when(repo.countUsersWithRole(rd.roleId())).thenReturn(3);
        mockMvc.perform(get("/edge-api/v1/admin/roles").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles[0].name").value("Administrator"))
                .andExpect(jsonPath("$.roles[0].builtin").value(true))
                .andExpect(jsonPath("$.roles[0].userCount").value(3))
                .andExpect(jsonPath("$.roles[0].authorities[0]").value("der.users.read"));
    }

    @Test
    void getByIdReturnsRole() throws Exception {
        when(clock.instant()).thenReturn(Instant.EPOCH);
        final RoleDefinition rd = sampleRole(false);
        when(repo.findById(rd.roleId())).thenReturn(Optional.of(rd));
        mockMvc.perform(get("/edge-api/v1/admin/roles/" + rd.roleId()).with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Custom"));
    }

    @Test
    void getByIdReturns404WhenMissing() throws Exception {
        final UUID id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.empty());
        mockMvc.perform(get("/edge-api/v1/admin/roles/" + id).with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNotFound());
    }

    @Test
    void createRejectsBlankName() throws Exception {
        mockMvc.perform(post("/edge-api/v1/admin/roles")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("name_required"));
    }

    @Test
    void createRejectsDuplicateName() throws Exception {
        when(repo.findByName("Nurses")).thenReturn(Optional.of(sampleRole(false)));
        mockMvc.perform(post("/edge-api/v1/admin/roles")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Nurses\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("duplicate_name"));
    }

    @Test
    void createPersistsAndAudits() throws Exception {
        when(clock.instant()).thenReturn(Instant.EPOCH);
        when(repo.findByName("Nurses")).thenReturn(Optional.empty());
        final RoleDefinition rd = sampleRole(false);
        when(repo.create(eq("Nurses"), any(), any())).thenReturn(rd);
        when(repo.countUsersWithRole(rd.roleId())).thenReturn(0);
        mockMvc.perform(post("/edge-api/v1/admin/roles")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Nurses\",\"description\":\"d\",\"authorities\":[\"der.users.read\"]}"))
                .andExpect(status().isOk());
        verify(audit).append(any(), any());
    }

    @Test
    void createPropagatesUnknownAuthority() throws Exception {
        when(clock.instant()).thenReturn(Instant.EPOCH);
        when(repo.findByName("Nurses")).thenReturn(Optional.empty());
        when(repo.create(anyString(), any(), any()))
                .thenThrow(new IllegalArgumentException("unknown authority: der.nope"));
        mockMvc.perform(post("/edge-api/v1/admin/roles")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Nurses\",\"authorities\":[\"der.nope\"]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateWritesAndAudits() throws Exception {
        when(clock.instant()).thenReturn(Instant.EPOCH);
        final RoleDefinition rd = sampleRole(false);
        when(repo.update(eq(rd.roleId()), any(), any(), any())).thenReturn(rd);
        when(repo.countUsersWithRole(rd.roleId())).thenReturn(0);
        mockMvc.perform(put("/edge-api/v1/admin/roles/" + rd.roleId())
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Custom\",\"authorities\":[]}"))
                .andExpect(status().isOk());
        verify(audit).append(any(), any());
    }

    @Test
    void updateReturnsBadRequestWhenEmptyBody() throws Exception {
        mockMvc.perform(put("/edge-api/v1/admin/roles/" + UUID.randomUUID())
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void deleteBuiltinReturns409() throws Exception {
        when(clock.instant()).thenReturn(Instant.EPOCH);
        final UUID id = UUID.randomUUID();
        doThrow(new IllegalStateException("built-in roles cannot be deleted"))
                .when(repo).delete(id);
        mockMvc.perform(delete("/edge-api/v1/admin/roles/" + id).with(as(EdgeRole.ADMIN)))
                .andExpect(status().isConflict());
    }

    @Test
    void deleteUnknownReturns404() throws Exception {
        when(clock.instant()).thenReturn(Instant.EPOCH);
        final UUID id = UUID.randomUUID();
        doThrow(new IllegalArgumentException("unknown role: " + id))
                .when(repo).delete(id);
        mockMvc.perform(delete("/edge-api/v1/admin/roles/" + id).with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteHappyPath() throws Exception {
        when(clock.instant()).thenReturn(Instant.EPOCH);
        final UUID id = UUID.randomUUID();
        mockMvc.perform(delete("/edge-api/v1/admin/roles/" + id).with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(true));
        verify(audit).append(any(), any());
    }

    @Test
    void authorityCatalogExposed() throws Exception {
        mockMvc.perform(get("/edge-api/v1/admin/roles/authorities/catalog").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authorities[0].authority").exists())
                .andExpect(jsonPath("$.authorities[0].module").exists());
    }

    @Test
    void operatorGetsForbiddenEverywhere() throws Exception {
        final UUID id = UUID.randomUUID();
        mockMvc.perform(get("/edge-api/v1/admin/roles").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/edge-api/v1/admin/roles/" + id).with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/edge-api/v1/admin/roles").with(as(EdgeRole.OPERATOR))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"x\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/edge-api/v1/admin/roles/" + id).with(as(EdgeRole.OPERATOR))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"x\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/edge-api/v1/admin/roles/" + id).with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/edge-api/v1/admin/roles/authorities/catalog")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isForbidden());
    }

    @Test
    void createWithNullAuthoritiesDefaultsToEmpty() throws Exception {
        when(clock.instant()).thenReturn(Instant.EPOCH);
        when(repo.findByName("X")).thenReturn(Optional.empty());
        final RoleDefinition rd = sampleRole(false);
        when(repo.create(eq("X"), any(), eq(Set.of()))).thenReturn(rd);
        when(repo.countUsersWithRole(rd.roleId())).thenReturn(0);
        mockMvc.perform(post("/edge-api/v1/admin/roles").with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"X\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void updateWithNullAuthoritiesDefaultsToEmpty() throws Exception {
        when(clock.instant()).thenReturn(Instant.EPOCH);
        final RoleDefinition rd = sampleRole(false);
        when(repo.update(eq(rd.roleId()), any(), any(), eq(Set.of()))).thenReturn(rd);
        when(repo.countUsersWithRole(rd.roleId())).thenReturn(0);
        mockMvc.perform(put("/edge-api/v1/admin/roles/" + rd.roleId())
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Custom\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void updatePropagatesUnknownRoleId() throws Exception {
        final UUID id = UUID.randomUUID();
        when(repo.update(eq(id), any(), any(), any()))
                .thenThrow(new IllegalArgumentException("unknown role: " + id));
        mockMvc.perform(put("/edge-api/v1/admin/roles/" + id)
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Custom\"}"))
                .andExpect(status().isBadRequest());
    }
}
