package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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
import ug.ac.mak.der.workflows.aggregate.AggregateDataValueService;
import ug.ac.mak.der.workflows.drafts.Draft;
import ug.ac.mak.der.workflows.drafts.DraftRepository;
import ug.ac.mak.der.workflows.events.EventService;

@WebMvcTest(DraftController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class DraftControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean DraftRepository drafts;
    @MockBean AggregateDataValueService aggregates;
    @MockBean EventService events;
    @MockBean ug.ac.mak.der.workflows.tracker.TrackerService tracker;

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
        when(drafts.findByOwner(uid, null)).thenReturn(List.of(sample(uid)));
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

    // -------- Phase 07.1 — publish ----------

    @Test
    void publishUnauth() throws Exception {
        mockMvc.perform(post("/edge-api/v1/drafts/" + UUID.randomUUID() + "/publish"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void publishNotFound() throws Exception {
        final UUID uid = UUID.randomUUID();
        when(drafts.findById(any(UUID.class))).thenReturn(Optional.empty());
        mockMvc.perform(post("/edge-api/v1/drafts/" + UUID.randomUUID() + "/publish")
                        .with(as(uid)))
                .andExpect(status().isNotFound());
    }

    @Test
    void publishForeignReturnsNotFound() throws Exception {
        final UUID uid = UUID.randomUUID();
        final Draft foreign = sample(UUID.randomUUID());
        when(drafts.findById(foreign.draftId())).thenReturn(Optional.of(foreign));
        mockMvc.perform(post("/edge-api/v1/drafts/" + foreign.draftId() + "/publish")
                        .with(as(uid)))
                .andExpect(status().isNotFound());
    }

    @Test
    void publishUnpublishableKindRejected() throws Exception {
        final UUID uid = UUID.randomUUID();
        final Draft d = new Draft(UUID.randomUUID(), uid, "some-future-kind",
                "T", mapper.createObjectNode(),
                Instant.parse("2026-10-22T00:00:00Z"),
                Instant.parse("2026-10-22T00:00:00Z"));
        when(drafts.findById(d.draftId())).thenReturn(Optional.of(d));
        mockMvc.perform(post("/edge-api/v1/drafts/" + d.draftId() + "/publish")
                        .with(as(uid)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("DRAFT_KIND_NOT_PUBLISHABLE"));
    }

    @Test
    void publishTrackerTeiCallsTrackerServiceAndConsumesDraft() throws Exception {
        final UUID uid = UUID.randomUUID();
        final com.fasterxml.jackson.databind.node.ObjectNode payload = mapper.createObjectNode();
        final com.fasterxml.jackson.databind.node.ObjectNode tei = payload.putObject("tei");
        tei.put("teiUid", "TEIabc123def");
        tei.put("trackedEntityType", "typeA");
        tei.put("orgUnitUid", "ou1");
        tei.putObject("attributes");
        tei.put("createdBy", UUID.randomUUID().toString());
        tei.put("createdAt", "2026-11-03T10:00:00Z");
        tei.put("updatedAt", "2026-11-03T10:00:00Z");
        tei.put("teiVersion", 1);

        final Draft d = new Draft(UUID.randomUUID(), uid, "tracker-tei",
                "test-tei", payload,
                Instant.parse("2026-11-03T10:00:00Z"),
                Instant.parse("2026-11-03T10:00:00Z"));
        when(drafts.findById(d.draftId())).thenReturn(Optional.of(d));

        mockMvc.perform(post("/edge-api/v1/drafts/" + d.draftId() + "/publish")
                        .with(as(uid)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.imported").value(1))
                .andExpect(jsonPath("$.draftConsumed").value(true));
        org.mockito.Mockito.verify(tracker).upsertTei(
                any(ug.ac.mak.der.workflows.tracker.TrackedEntityRepository.TrackedEntity.class),
                eq(uid), any(), any());
        org.mockito.Mockito.verify(drafts).delete(d.draftId(), uid);
    }

    @Test
    void publishTrackerRejectsPayloadWithoutExpectedKey() throws Exception {
        final UUID uid = UUID.randomUUID();
        final Draft d = new Draft(UUID.randomUUID(), uid, "tracker-event",
                "no-event-key", mapper.createObjectNode(),
                Instant.parse("2026-11-03T10:00:00Z"),
                Instant.parse("2026-11-03T10:00:00Z"));
        when(drafts.findById(d.draftId())).thenReturn(Optional.of(d));
        mockMvc.perform(post("/edge-api/v1/drafts/" + d.draftId() + "/publish")
                        .with(as(uid)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("DRAFT_PAYLOAD_INVALID"));
    }

    @Test
    void publishTrackerRejectionKeepsDraftAndReturns409() throws Exception {
        final UUID uid = UUID.randomUUID();
        final com.fasterxml.jackson.databind.node.ObjectNode payload = mapper.createObjectNode();
        final com.fasterxml.jackson.databind.node.ObjectNode tei = payload.putObject("tei");
        tei.put("teiUid", "TEIabc123def");
        tei.put("trackedEntityType", "typeA");
        tei.put("orgUnitUid", "ou1");
        tei.putObject("attributes");
        tei.put("createdBy", UUID.randomUUID().toString());
        tei.put("createdAt", "2026-11-03T10:00:00Z");
        tei.put("updatedAt", "2026-11-03T10:00:00Z");
        tei.put("teiVersion", 1);

        final Draft d = new Draft(UUID.randomUUID(), uid, "tracker-tei",
                "will-fail", payload,
                Instant.parse("2026-11-03T10:00:00Z"),
                Instant.parse("2026-11-03T10:00:00Z"));
        when(drafts.findById(d.draftId())).thenReturn(Optional.of(d));
        when(tracker.upsertTei(any(), any(), any(), any()))
                .thenThrow(new RuntimeException("orgUnit 'ou1' not in local mirror"));

        mockMvc.perform(post("/edge-api/v1/drafts/" + d.draftId() + "/publish")
                        .with(as(uid)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DRAFT_TRACKER_REJECTED"))
                .andExpect(jsonPath("$.message").value(
                        org.hamcrest.Matchers.containsString("not in local mirror")));
        /* Draft must NOT be deleted on failure — operator fixes the
         * underlying error and retries. */
        org.mockito.Mockito.verify(drafts, org.mockito.Mockito.never())
                .delete(any(UUID.class), any(UUID.class));
    }

    @Test
    void publishAggregateRejectedWhenPayloadMissingInputsArray() throws Exception {
        final UUID uid = UUID.randomUUID();
        final Draft d = new Draft(UUID.randomUUID(), uid, "aggregate",
                "T", mapper.createObjectNode(), // {} — no "inputs"
                Instant.parse("2026-10-22T00:00:00Z"),
                Instant.parse("2026-10-22T00:00:00Z"));
        when(drafts.findById(d.draftId())).thenReturn(Optional.of(d));
        mockMvc.perform(post("/edge-api/v1/drafts/" + d.draftId() + "/publish")
                        .with(as(uid)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("DRAFT_PAYLOAD_INVALID"));
    }

    @Test
    void publishAggregateConsumesDraftOnFullAcceptance() throws Exception {
        final UUID uid = UUID.randomUUID();
        final com.fasterxml.jackson.databind.node.ObjectNode payload = mapper.createObjectNode();
        payload.putArray("inputs").addObject()
                .put("dataElementUid", "de123")
                .put("orgUnitUid", "ou42")
                .put("periodIso", "2026W44")
                .put("categoryOptionComboUid", "coc1")
                .put("attributeOptionComboUid", "aoc1")
                .put("value", "7")
                .put("comment", "")
                .put("dataSetUid", "ds1");
        final Draft d = new Draft(UUID.randomUUID(), uid, "aggregate",
                "weekly totals", payload,
                Instant.parse("2026-10-22T00:00:00Z"),
                Instant.parse("2026-10-22T00:00:00Z"));
        when(drafts.findById(d.draftId())).thenReturn(Optional.of(d));
        when(aggregates.submit(any(), any(), any(), any())).thenReturn(
                new AggregateDataValueService.ImportSummary(1, 0, List.of()));
        mockMvc.perform(post("/edge-api/v1/drafts/" + d.draftId() + "/publish")
                        .with(as(uid)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.imported").value(1))
                .andExpect(jsonPath("$.ignored").value(0))
                .andExpect(jsonPath("$.draftConsumed").value(true));
        // deletion delegated to repo on full acceptance
        org.mockito.Mockito.verify(drafts).delete(d.draftId(), uid);
    }

    @Test
    void publishAggregateKeepsDraftWhenPartialReject() throws Exception {
        final UUID uid = UUID.randomUUID();
        final com.fasterxml.jackson.databind.node.ObjectNode payload = mapper.createObjectNode();
        payload.putArray("inputs").addObject()
                .put("dataElementUid", "deBAD")
                .put("orgUnitUid", "ou42")
                .put("periodIso", "2026W44")
                .put("categoryOptionComboUid", "coc1")
                .put("attributeOptionComboUid", "aoc1")
                .put("value", "7")
                .put("comment", "")
                .put("dataSetUid", "ds1");
        final Draft d = new Draft(UUID.randomUUID(), uid, "aggregate",
                "weekly totals", payload,
                Instant.parse("2026-10-22T00:00:00Z"),
                Instant.parse("2026-10-22T00:00:00Z"));
        when(drafts.findById(d.draftId())).thenReturn(Optional.of(d));
        when(aggregates.submit(any(), any(), any(), any())).thenReturn(
                new AggregateDataValueService.ImportSummary(0, 1, List.of(
                        new AggregateDataValueService.Conflict("deBAD|ou42|2026W44",
                                "data element not in mirror"))));
        mockMvc.perform(post("/edge-api/v1/drafts/" + d.draftId() + "/publish")
                        .with(as(uid)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.imported").value(0))
                .andExpect(jsonPath("$.ignored").value(1))
                .andExpect(jsonPath("$.draftConsumed").value(false));
        org.mockito.Mockito.verify(drafts, org.mockito.Mockito.never())
                .delete(any(UUID.class), any(UUID.class));
    }
}
