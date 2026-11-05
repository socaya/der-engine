package ug.ac.mak.der.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
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

import ug.ac.mak.der.attribution.EdgeUserDhis2Mapping;
import ug.ac.mak.der.attribution.EdgeUserDhis2MappingRepository;
import ug.ac.mak.der.dhis2.Dhis2ReferenceClient;
import ug.ac.mak.der.ops.AdminSettingRepository;
import ug.ac.mak.der.orgunit.EdgeOrgUnitBinding;
import ug.ac.mak.der.orgunit.OrgUnitBindingService;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecretEnvelope;
import ug.ac.mak.der.security.SecurityAuditRepository;

@WebMvcTest(UserAttributionController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class UserAttributionControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean EdgeUserDhis2MappingRepository repo;
    @MockBean SecurityAuditRepository audit;
    @MockBean Clock clock;
    @MockBean Dhis2ReferenceClient dhis2;
    @MockBean AdminSettingRepository settings;
    @MockBean SecretEnvelope envelope;
    @MockBean OrgUnitBindingService binding;

    @org.junit.jupiter.api.BeforeEach
    void stubClock() {
        when(clock.instant()).thenReturn(Instant.parse("2026-11-03T10:00:00Z"));
        when(clock.getZone()).thenReturn(ZoneId.of("UTC"));
    }

    private RequestPostProcessor as() {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "ad", "Ad",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(EdgeRole.ADMIN), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    private EdgeUserDhis2Mapping sample(final UUID id) {
        final Instant t = Instant.parse("2026-11-03T10:00:00Z");
        return new EdgeUserDhis2Mapping(id, "Abc12345678", "user1", "User One",
                t, UUID.randomUUID(), t);
    }

    @Test
    void listOk() throws Exception {
        final UUID id = UUID.randomUUID();
        when(repo.findAll()).thenReturn(List.of(sample(id)));
        mockMvc.perform(get("/edge-api/v1/admin/users/dhis2-mappings").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mappings[0].dhis2UserUid").value("Abc12345678"));
    }

    @Test
    void getOk() throws Exception {
        final UUID id = UUID.randomUUID();
        when(repo.findByEdgeUser(id)).thenReturn(Optional.of(sample(id)));
        mockMvc.perform(get("/edge-api/v1/admin/users/" + id + "/dhis2-mapping").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dhis2Username").value("user1"));
    }

    @Test
    void getNotFound() throws Exception {
        final UUID id = UUID.randomUUID();
        when(repo.findByEdgeUser(id)).thenReturn(Optional.empty());
        mockMvc.perform(get("/edge-api/v1/admin/users/" + id + "/dhis2-mapping").with(as()))
                .andExpect(status().isNotFound());
    }

    @Test
    void putUnauthenticated() throws Exception {
        mockMvc.perform(put("/edge-api/v1/admin/users/" + UUID.randomUUID() + "/dhis2-mapping")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dhis2UserUid\":\"u\",\"dhis2Username\":\"n\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void putMissingFields() throws Exception {
        mockMvc.perform(put("/edge-api/v1/admin/users/" + UUID.randomUUID() + "/dhis2-mapping")
                        .with(as())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MAPPING_INVALID"));
    }

    @Test
    void putAcceptsAndPersists() throws Exception {
        final UUID id = UUID.randomUUID();
        mockMvc.perform(put("/edge-api/v1/admin/users/" + id + "/dhis2-mapping").with(as())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dhis2UserUid\":\"Abc12345678\",\"dhis2Username\":\"alice\","
                                + "\"dhis2DisplayName\":\"Alice\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dhis2UserUid").value("Abc12345678"));
        verify(repo).upsert(any(EdgeUserDhis2Mapping.class));
        verify(audit).append(any(AuditEvent.class), any());
    }

    @Test
    void deleteOkTrue() throws Exception {
        final UUID id = UUID.randomUUID();
        when(repo.delete(id)).thenReturn(1);
        mockMvc.perform(delete("/edge-api/v1/admin/users/" + id + "/dhis2-mapping").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cleared").value(true));
    }

    @Test
    void deleteOkFalseWhenAbsent() throws Exception {
        final UUID id = UUID.randomUUID();
        when(repo.delete(id)).thenReturn(0);
        mockMvc.perform(delete("/edge-api/v1/admin/users/" + id + "/dhis2-mapping").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cleared").value(false));
    }

    @Test
    void deleteUnauthenticated() throws Exception {
        mockMvc.perform(delete("/edge-api/v1/admin/users/" + UUID.randomUUID() + "/dhis2-mapping"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void mappingRequestRecord() {
        final UserAttributionController.MappingRequest r =
                new UserAttributionController.MappingRequest("u", "n", "D", "BASIC", "secret");
        org.junit.jupiter.api.Assertions.assertEquals("u", r.dhis2UserUid());
        org.junit.jupiter.api.Assertions.assertEquals("n", r.dhis2Username());
        org.junit.jupiter.api.Assertions.assertEquals("D", r.dhis2DisplayName());
        org.junit.jupiter.api.Assertions.assertEquals("BASIC", r.authType());
        org.junit.jupiter.api.Assertions.assertEquals("secret", r.credential());
    }

    @Test
    void mappingRequestNulls() {
        final UserAttributionController.MappingRequest r =
                new UserAttributionController.MappingRequest(null, null, null, null, null);
        org.junit.jupiter.api.Assertions.assertNull(r.dhis2UserUid());
        org.junit.jupiter.api.Assertions.assertNull(r.authType());
    }

    @Test
    void candidatesHappyPath() throws Exception {
        final com.fasterxml.jackson.databind.ObjectMapper om =
                new com.fasterxml.jackson.databind.ObjectMapper();
        final com.fasterxml.jackson.databind.JsonNode body = om.readTree(
                "{\"users\":["
                        + "{\"id\":\"A1B2C3D4E5F\",\"username\":\"alice.c\","
                        + "\"displayName\":\"Alice Central\",\"disabled\":false},"
                        + "{\"id\":\"Z9yT5w1Z9Kq\",\"username\":\"der-admin-c\","
                        + "\"displayName\":\"DER Admin (Central)\",\"disabled\":true}"
                        + "]}");
        when(dhis2.fetchJson(any(String.class))).thenReturn(body);
        mockMvc.perform(get("/edge-api/v1/admin/users/dhis2-candidates")
                        .param("q", "alice").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.query").value("alice"))
                .andExpect(jsonPath("$.candidates[0].id").value("A1B2C3D4E5F"))
                .andExpect(jsonPath("$.candidates[0].username").value("alice.c"))
                .andExpect(jsonPath("$.candidates[0].disabled").value(false))
                .andExpect(jsonPath("$.candidates[1].disabled").value(true));
    }

    @Test
    void candidatesEmptyQueryDefaultsToPaged() throws Exception {
        final com.fasterxml.jackson.databind.ObjectMapper om =
                new com.fasterxml.jackson.databind.ObjectMapper();
        when(dhis2.fetchJson(any(String.class))).thenReturn(om.readTree("{\"users\":[]}"));
        mockMvc.perform(get("/edge-api/v1/admin/users/dhis2-candidates").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.candidates").isArray())
                .andExpect(jsonPath("$.query").value(""));
    }

    @Test
    void candidatesDhis2Unreachable() throws Exception {
        when(dhis2.fetchJson(any(String.class)))
                .thenThrow(new Dhis2ReferenceClient.Dhis2UnreachableException(
                        "central down", new RuntimeException("x")));
        mockMvc.perform(get("/edge-api/v1/admin/users/dhis2-candidates")
                        .param("q", "alice").with(as()))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("DHIS2_UNREACHABLE"));
    }

    @Test
    void candidatesBadResponse() throws Exception {
        when(dhis2.fetchJson(any(String.class)))
                .thenThrow(new Dhis2ReferenceClient.Dhis2ResponseException(
                        "bad json", new RuntimeException("x")));
        mockMvc.perform(get("/edge-api/v1/admin/users/dhis2-candidates")
                        .param("q", "alice").with(as()))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("DHIS2_RESPONSE_INVALID"));
    }

    @Test
    void candidatesDefaultScopeAppendsBoundOuFilter() throws Exception {
        when(binding.current()).thenReturn(EdgeOrgUnitBinding.bound(
                "HL2zXaIULBe", "Clinic A",
                "/ZEzf44yY3Kd/T4LOE9sCy2R/QLtB3RDiv2c/HL2zXaIULBe",
                UUID.randomUUID()));
        final com.fasterxml.jackson.databind.ObjectMapper om =
                new com.fasterxml.jackson.databind.ObjectMapper();
        when(dhis2.fetchJson(any(String.class)))
                .thenReturn(om.readTree("{\"users\":[]}"));
        mockMvc.perform(get("/edge-api/v1/admin/users/dhis2-candidates")
                        .with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scope").value("ou"))
                .andExpect(jsonPath("$.boundOrgUnitId").value("HL2zXaIULBe"))
                .andExpect(jsonPath("$.boundOrgUnitDisplayName").value("Clinic A"));
        /* The DHIS2 path must carry the path-prefix filter for the OU. */
        final org.mockito.ArgumentCaptor<String> cap =
                org.mockito.ArgumentCaptor.forClass(String.class);
        verify(dhis2).fetchJson(cap.capture());
        assertThat(cap.getValue())
                .contains("filter=organisationUnits.path:like:HL2zXaIULBe");
    }

    @Test
    void candidatesScopeAllSkipsOuFilter() throws Exception {
        when(binding.current()).thenReturn(EdgeOrgUnitBinding.bound(
                "HL2zXaIULBe", "Clinic A",
                "/ZEzf44yY3Kd/HL2zXaIULBe", UUID.randomUUID()));
        final com.fasterxml.jackson.databind.ObjectMapper om =
                new com.fasterxml.jackson.databind.ObjectMapper();
        when(dhis2.fetchJson(any(String.class)))
                .thenReturn(om.readTree("{\"users\":[]}"));
        mockMvc.perform(get("/edge-api/v1/admin/users/dhis2-candidates")
                        .param("scope", "all").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scope").value("all"))
                .andExpect(jsonPath("$.boundOrgUnitId").doesNotExist());
        final org.mockito.ArgumentCaptor<String> cap =
                org.mockito.ArgumentCaptor.forClass(String.class);
        verify(dhis2).fetchJson(cap.capture());
        assertThat(cap.getValue()).doesNotContain("filter=organisationUnits");
    }

    @Test
    void candidatesUnboundEdgeFallsBackToAll() throws Exception {
        /* binding.current() returns null (Mockito default) → empty binding → scope reported as 'all'. */
        final com.fasterxml.jackson.databind.ObjectMapper om =
                new com.fasterxml.jackson.databind.ObjectMapper();
        when(dhis2.fetchJson(any(String.class)))
                .thenReturn(om.readTree("{\"users\":[]}"));
        mockMvc.perform(get("/edge-api/v1/admin/users/dhis2-candidates")
                        .with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scope").value("all"))
                .andExpect(jsonPath("$.boundOrgUnitId").doesNotExist());
    }

    @Test
    void defaultAuthTypeReadsSettingOrFallsBack() throws Exception {
        when(settings.read("dhis2.user_credentials.default_auth_type"))
                .thenReturn(java.util.Optional.of(
                        new ug.ac.mak.der.ops.AdminSettingRepository.Entry(
                                "dhis2.user_credentials.default_auth_type",
                                "\"TOKEN\"", UUID.randomUUID(),
                                Instant.parse("2026-11-03T10:00:00Z"))));
        mockMvc.perform(get("/edge-api/v1/admin/users/dhis2-auth-type-default").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.defaultAuthType").value("TOKEN"));

        when(settings.read("dhis2.user_credentials.default_auth_type"))
                .thenReturn(java.util.Optional.empty());
        mockMvc.perform(get("/edge-api/v1/admin/users/dhis2-auth-type-default").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.defaultAuthType").value("BASIC"));
    }

    @Test
    void userDetailsHappyPath() throws Exception {
        final com.fasterxml.jackson.databind.ObjectMapper om =
                new com.fasterxml.jackson.databind.ObjectMapper();
        final com.fasterxml.jackson.databind.JsonNode body = om.readTree(
                "{\"id\":\"M5zQapPyTZI\",\"username\":\"alice.c\","
                        + "\"displayName\":\"Alice Central\",\"email\":\"alice@dhis2.local\","
                        + "\"disabled\":false,\"created\":\"2024-02-01T09:00:00Z\","
                        + "\"userCredentials\":{\"lastLogin\":\"2026-11-04T10:00:00Z\","
                        + "\"twoFactorEnabled\":true},"
                        + "\"organisationUnits\":[{\"id\":\"ou-1\",\"displayName\":\"Facility A\"}],"
                        + "\"userGroups\":[]}");
        when(dhis2.fetchJson(any(String.class))).thenReturn(body);
        mockMvc.perform(get("/edge-api/v1/admin/users/dhis2-user-details")
                        .param("uid", "M5zQapPyTZI").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("alice.c"))
                .andExpect(jsonPath("$.email").value("alice@dhis2.local"))
                .andExpect(jsonPath("$.twoFactorEnabled").value(true))
                .andExpect(jsonPath("$.organisationUnits[0].displayName").value("Facility A"))
                .andExpect(jsonPath("$.userGroups").isArray());
    }

    @Test
    void userDetailsRejectsBadUid() throws Exception {
        mockMvc.perform(get("/edge-api/v1/admin/users/dhis2-user-details")
                        .param("uid", "not-a-dhis2-uid").with(as()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UID_INVALID"));
    }

    @Test
    void putWithAuthTypeAndCredentialSealsAndAudits() throws Exception {
        final UUID id = UUID.randomUUID();
        when(envelope.seal("my-pat-token")).thenReturn("env:v1:ciphertext");
        when(repo.findByEdgeUser(id))
                .thenReturn(java.util.Optional.of(new EdgeUserDhis2Mapping(
                        id, "Abc12345678", "alice.c", "Alice Central",
                        Instant.parse("2026-11-03T10:00:00Z"), UUID.randomUUID(),
                        Instant.parse("2026-11-03T10:00:00Z"),
                        EdgeUserDhis2Mapping.AuthType.TOKEN,
                        "env:v1:ciphertext",
                        Instant.parse("2026-11-03T10:00:00Z"), UUID.randomUUID())));
        mockMvc.perform(put("/edge-api/v1/admin/users/" + id + "/dhis2-mapping")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dhis2UserUid\":\"Abc12345678\",\"dhis2Username\":\"alice.c\","
                                + "\"authType\":\"TOKEN\",\"credential\":\"my-pat-token\"}")
                        .with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authType").value("TOKEN"))
                .andExpect(jsonPath("$.hasCredential").value(true));
        /* envelope.seal was consulted — never log the cleartext. */
        verify(envelope).seal("my-pat-token");
    }

    @Test
    void putRejectsCredentialWithoutAuthType() throws Exception {
        final UUID id = UUID.randomUUID();
        mockMvc.perform(put("/edge-api/v1/admin/users/" + id + "/dhis2-mapping")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dhis2UserUid\":\"Abc12345678\",\"dhis2Username\":\"alice.c\","
                                + "\"credential\":\"orphan-secret\"}")
                        .with(as()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message")
                        .value(org.hamcrest.Matchers.containsString("authType")));
    }

    @Test
    void putRejectsUnknownAuthType() throws Exception {
        final UUID id = UUID.randomUUID();
        mockMvc.perform(put("/edge-api/v1/admin/users/" + id + "/dhis2-mapping")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dhis2UserUid\":\"Abc12345678\",\"dhis2Username\":\"alice.c\","
                                + "\"authType\":\"RANDOM\"}")
                        .with(as()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message")
                        .value(org.hamcrest.Matchers.containsString("TOKEN or BASIC")));
    }
}
