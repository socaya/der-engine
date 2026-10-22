package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import ug.ac.mak.der.workflows.drafts.Draft;
import ug.ac.mak.der.workflows.drafts.DraftRepository;

@WebMvcTest(DraftController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class DraftControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean DraftRepository drafts;

    private final ObjectMapper mapper = new ObjectMapper();

    private RequestPostProcessor as(final UUID userId) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(userId, "op", "Op",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(EdgeRole.OPERATOR), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    private Draft sample(final UUID ownerId) {
        return new Draft(UUID.randomUUID(), ownerId, "AGGREGATE", "Weekly",
                mapper.createObjectNode(), Instant.parse("2026-10-22T00:00:00Z"),
                Instant.parse("2026-10-22T00:00:00Z"));
    }

    @Test
    void listUnauth() throws Exception {
        mockMvc.perform(get("/edge-api/v1/drafts")).andExpect(status().isUnauthorized());
    }

    @Test
    void listOk() throws Exception {
        final UUID uid = UUID.randomUUID();
        when(drafts.findByOwner(uid)).thenReturn(List.of(sample(uid)));
        mockMvc.perform(get("/edge-api/v1/drafts").with(as(uid)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.drafts[0].kind").value("AGGREGATE"));
    }

    @Test
    void upsertUnauth() throws Exception {
        mockMvc.perform(post("/edge-api/v1/drafts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"AGGREGATE\",\"title\":\"X\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void upsertRejectsEmptyBody() throws Exception {
        mockMvc.perform(post("/edge-api/v1/drafts").with(as(UUID.randomUUID()))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void upsertRejectsBlankKind() throws Exception {
        mockMvc.perform(post("/edge-api/v1/drafts").with(as(UUID.randomUUID()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"  \",\"title\":\"X\",\"payload\":{}}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void upsertRejectsBlankTitle() throws Exception {
        mockMvc.perform(post("/edge-api/v1/drafts").with(as(UUID.randomUUID()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"K\",\"title\":\"\",\"payload\":{}}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void upsertCreatesWhenDraftIdOmitted() throws Exception {
        final UUID uid = UUID.randomUUID();
        when(drafts.upsert(any(Draft.class))).thenAnswer(inv -> inv.getArgument(0));
        mockMvc.perform(post("/edge-api/v1/drafts").with(as(uid))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"K\",\"title\":\"T\",\"payload\":{}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("T"));
    }

    @Test
    void upsertUpdatesWhenExistingAndOwnerMatches() throws Exception {
        final UUID uid = UUID.randomUUID();
        final Draft existing = sample(uid);
        when(drafts.findById(existing.draftId())).thenReturn(Optional.of(existing));
        when(drafts.upsert(any(Draft.class))).thenAnswer(inv -> inv.getArgument(0));
        mockMvc.perform(post("/edge-api/v1/drafts").with(as(uid))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"draftId\":\"" + existing.draftId()
                                + "\",\"kind\":\"K2\",\"title\":\"T2\",\"payload\":{}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kind").value("K2"));
    }

    @Test
    void upsertFallsBackToCreateWhenDraftIdForeign() throws Exception {
        final UUID uid = UUID.randomUUID();
        final Draft foreign = sample(UUID.randomUUID());
        when(drafts.findById(foreign.draftId())).thenReturn(Optional.of(foreign));
        when(drafts.upsert(any(Draft.class))).thenAnswer(inv -> inv.getArgument(0));
        mockMvc.perform(post("/edge-api/v1/drafts").with(as(uid))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"draftId\":\"" + foreign.draftId()
                                + "\",\"kind\":\"K\",\"title\":\"T\",\"payload\":{}}"))
                .andExpect(status().isOk());
    }

    @Test
    void deleteUnauth() throws Exception {
        mockMvc.perform(delete("/edge-api/v1/drafts/" + UUID.randomUUID()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deleteNotFound() throws Exception {
        final UUID uid = UUID.randomUUID();
        when(drafts.findById(any(UUID.class))).thenReturn(Optional.empty());
        mockMvc.perform(delete("/edge-api/v1/drafts/" + UUID.randomUUID()).with(as(uid)))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteForeignReturnsNotFound() throws Exception {
        final UUID uid = UUID.randomUUID();
        final Draft foreign = sample(UUID.randomUUID());
        when(drafts.findById(foreign.draftId())).thenReturn(Optional.of(foreign));
        mockMvc.perform(delete("/edge-api/v1/drafts/" + foreign.draftId()).with(as(uid)))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteOk() throws Exception {
        final UUID uid = UUID.randomUUID();
        final Draft own = sample(uid);
        when(drafts.findById(own.draftId())).thenReturn(Optional.of(own));
        when(drafts.delete(own.draftId(), uid)).thenReturn(1);
        mockMvc.perform(delete("/edge-api/v1/drafts/" + own.draftId()).with(as(uid)))
                .andExpect(status().isNoContent());
    }
}
