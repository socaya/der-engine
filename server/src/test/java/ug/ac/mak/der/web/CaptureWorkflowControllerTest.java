package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
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

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflow.CaptureWorkflow;
import ug.ac.mak.der.workflow.CaptureWorkflowRun;
import ug.ac.mak.der.workflow.CaptureWorkflowService;

@WebMvcTest(CaptureWorkflowController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class CaptureWorkflowControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean CaptureWorkflowService svc;
    @MockBean ug.ac.mak.der.workflow.CaptureWorkflowImportService importer;
    @MockBean ug.ac.mak.der.workflow.CaptureWorkflowContributionRepository contributions;

    private final Instant NOW = Instant.parse("2026-10-22T00:00:00Z");

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "a", "A",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    private CaptureWorkflow workflow(final UUID id) {
        return new CaptureWorkflow(id, "wf", CaptureWorkflow.BindingKind.DATA_SET,
                "ds1", true, 1, NOW, NOW, null, List.of(), List.of());
    }

    @Test
    void list() throws Exception {
        when(svc.list()).thenReturn(List.of(workflow(UUID.randomUUID())));
        mockMvc.perform(get("/edge-api/v1/workflows").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workflows[0].displayName").value("wf"));
    }

    @Test
    void getNotFound() throws Exception {
        when(svc.get(any(UUID.class))).thenReturn(Optional.empty());
        mockMvc.perform(get("/edge-api/v1/workflows/" + UUID.randomUUID())
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNotFound());
    }

    @Test
    void getOk() throws Exception {
        final UUID id = UUID.randomUUID();
        when(svc.get(id)).thenReturn(Optional.of(workflow(id)));
        mockMvc.perform(get("/edge-api/v1/workflows/" + id).with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workflowId").value(id.toString()));
    }

    @Test
    void createUnauth() throws Exception {
        mockMvc.perform(post("/edge-api/v1/workflows")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"wf\",\"boundMetadataId\":\"ds1\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createMissingFields() throws Exception {
        mockMvc.perform(post("/edge-api/v1/workflows").with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createOk() throws Exception {
        when(svc.save(any(CaptureWorkflow.class), any(UUID.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        mockMvc.perform(post("/edge-api/v1/workflows").with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"wf\",\"boundMetadataKind\":\"DATA_SET\","
                                + "\"boundMetadataId\":\"ds1\",\"enabled\":true,"
                                + "\"steps\":[{\"ordinal\":0,\"displayName\":\"s\","
                                + "\"ownerRole\":\"OPERATOR\",\"stepKind\":\"CAPTURE\","
                                + "\"fields\":[{\"fieldRef\":\"de.coc\",\"requirement\":\"REQUIRED\"}]}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("wf"))
                .andExpect(jsonPath("$.steps[0].fields[0].fieldRef").value("de.coc"));
    }

    @Test
    void createBadEnum() throws Exception {
        mockMvc.perform(post("/edge-api/v1/workflows").with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"wf\",\"boundMetadataKind\":\"BAD_KIND\","
                                + "\"boundMetadataId\":\"ds1\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("WORKFLOW_INVALID"));
    }

    @Test
    void createAcceptsProgramBinding() throws Exception {
        when(svc.save(any(CaptureWorkflow.class), any(UUID.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        mockMvc.perform(post("/edge-api/v1/workflows").with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"wf\",\"boundMetadataKind\":\"PROGRAM\","
                                + "\"boundMetadataId\":\"p1\",\"enabled\":true,"
                                + "\"steps\":[{\"ordinal\":0,\"displayName\":\"s\","
                                + "\"ownerRole\":\"OPERATOR\",\"stepKind\":\"CAPTURE\","
                                + "\"fields\":[]}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.boundMetadataKind").value("PROGRAM"));
    }

    @Test
    void updateReusesPathId() throws Exception {
        when(svc.save(any(CaptureWorkflow.class), any(UUID.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        final UUID id = UUID.randomUUID();
        mockMvc.perform(put("/edge-api/v1/workflows/" + id).with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"wf\",\"boundMetadataId\":\"ds1\",\"enabled\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workflowId").value(id.toString()));
    }

    @Test
    void deleteNotFound() throws Exception {
        when(svc.delete(any(UUID.class))).thenReturn(0);
        mockMvc.perform(delete("/edge-api/v1/workflows/" + UUID.randomUUID())
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteOk() throws Exception {
        when(svc.delete(any(UUID.class))).thenReturn(1);
        mockMvc.perform(delete("/edge-api/v1/workflows/" + UUID.randomUUID())
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNoContent());
    }

    @Test
    void createWithDependencies() throws Exception {
        when(svc.save(any(CaptureWorkflow.class), any(UUID.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        final UUID s1 = UUID.randomUUID();
        final UUID s2 = UUID.randomUUID();
        mockMvc.perform(post("/edge-api/v1/workflows").with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"wf\",\"boundMetadataId\":\"ds1\","
                                + "\"enabled\":true,"
                                + "\"steps\":[{\"stepId\":\"" + s1 + "\",\"ordinal\":0,"
                                + "\"displayName\":\"a\",\"ownerRole\":\"OPERATOR\","
                                + "\"stepKind\":\"CAPTURE\",\"fields\":[]},"
                                + "{\"stepId\":\"" + s2 + "\",\"ordinal\":1,"
                                + "\"displayName\":\"b\",\"ownerRole\":\"REVIEWER\","
                                + "\"stepKind\":\"REVIEW\",\"fields\":[]}],"
                                + "\"dependencies\":[{\"stepId\":\"" + s2 + "\","
                                + "\"dependsOnStepId\":\"" + s1 + "\","
                                + "\"kind\":\"COMPLETES_BEFORE\"}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dependencies[0].kind").value("COMPLETES_BEFORE"));
    }

    @Test
    void createBlankDisplayNameRejected() throws Exception {
        mockMvc.perform(post("/edge-api/v1/workflows").with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\" \",\"boundMetadataId\":\"ds1\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createBlankMetadataIdRejected() throws Exception {
        mockMvc.perform(post("/edge-api/v1/workflows").with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"wf\",\"boundMetadataId\":\" \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void exportCanonical() throws Exception {
        final UUID id = UUID.randomUUID();
        when(svc.get(id)).thenReturn(Optional.of(workflow(id)));
        mockMvc.perform(get("/edge-api/v1/workflows/" + id + "/export")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.schemaVersion").value(1))
                .andExpect(jsonPath("$.displayName").value("wf"))
                .andExpect(jsonPath("$.workflowId").doesNotExist());
    }

    @Test
    void exportNotFound() throws Exception {
        when(svc.get(any(UUID.class))).thenReturn(Optional.empty());
        mockMvc.perform(get("/edge-api/v1/workflows/" + UUID.randomUUID() + "/export")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isNotFound());
    }

    @Test
    void importOk() throws Exception {
        when(importer.importWorkflow(any(), org.mockito.ArgumentMatchers.anyBoolean(),
                any(UUID.class))).thenReturn(
                new ug.ac.mak.der.workflow.CaptureWorkflowImportService.ImportResult(
                        workflow(UUID.randomUUID()), List.of("warn-1"), false));
        mockMvc.perform(post("/edge-api/v1/workflows/import").with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"schemaVersion\":1,\"displayName\":\"x\","
                                + "\"boundMetadataKind\":\"DATA_SET\","
                                + "\"boundMetadataId\":\"ds1\",\"enabled\":true,"
                                + "\"steps\":[{\"ordinal\":0,\"displayName\":\"s\","
                                + "\"ownerRole\":\"OPERATOR\",\"stepKind\":\"CAPTURE\","
                                + "\"fields\":[]}],\"dependencies\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dryRun").value(false))
                .andExpect(jsonPath("$.warnings[0]").value("warn-1"));
    }

    @Test
    void importRejectsBadSchema() throws Exception {
        when(importer.importWorkflow(any(), org.mockito.ArgumentMatchers.anyBoolean(),
                any(UUID.class))).thenThrow(new IllegalArgumentException("schemaVersion"));
        mockMvc.perform(post("/edge-api/v1/workflows/import").with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"schemaVersion\":99}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("WORKFLOW_IMPORT_INVALID"));
    }

    @Test
    void contributionsForRun() throws Exception {
        final UUID runId = UUID.randomUUID();
        when(contributions.findByRun(runId)).thenReturn(List.of(
                new ug.ac.mak.der.workflow.CaptureWorkflowContribution(
                        UUID.randomUUID(), runId, UUID.randomUUID(), "{}",
                        null, null, NOW)));
        mockMvc.perform(get("/edge-api/v1/workflows/runs/" + runId + "/contributions")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contributions[0].runId").value(runId.toString()));
    }

    @Test
    void runsList() throws Exception {
        final UUID id = UUID.randomUUID();
        when(svc.runs(id)).thenReturn(List.of(new CaptureWorkflowRun(
                UUID.randomUUID(), id, 1, "key", null,
                CaptureWorkflowRun.State.OPEN, NOW, NOW, null)));
        mockMvc.perform(get("/edge-api/v1/workflows/" + id + "/runs").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runs[0].state").value("OPEN"));
    }
}
