package ug.ac.mak.der.web;

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
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityAuditRepository;

@WebMvcTest(UserAttributionController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class UserAttributionControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean EdgeUserDhis2MappingRepository repo;
    @MockBean SecurityAuditRepository audit;
    @MockBean Clock clock;

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
                new UserAttributionController.MappingRequest("u", "n", "D");
        org.junit.jupiter.api.Assertions.assertEquals("u", r.dhis2UserUid());
        org.junit.jupiter.api.Assertions.assertEquals("n", r.dhis2Username());
        org.junit.jupiter.api.Assertions.assertEquals("D", r.dhis2DisplayName());
    }

    @Test
    void mappingRequestNulls() {
        final UserAttributionController.MappingRequest r =
                new UserAttributionController.MappingRequest(null, null, null);
        org.junit.jupiter.api.Assertions.assertNull(r.dhis2UserUid());
    }
}
