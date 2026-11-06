package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
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
import ug.ac.mak.der.workflow.CaptureFormService;
import ug.ac.mak.der.workflow.CaptureFormService.CaptureFormError;
import ug.ac.mak.der.workflow.CaptureFormService.ErrorCode;
import ug.ac.mak.der.workflow.CaptureFormService.FormAssembly;
import ug.ac.mak.der.workflow.CaptureFormService.FormDataPrefill;
import ug.ac.mak.der.workflow.CaptureFormService.FormField;
import ug.ac.mak.der.workflow.CaptureFormService.FormSection;
import ug.ac.mak.der.workflow.CaptureFormService.FormType;
import ug.ac.mak.der.workflow.CaptureFormService.Ownership;
import ug.ac.mak.der.workflow.CaptureFormService.Requirement;
import ug.ac.mak.der.workflow.CaptureWorkflowRun;
import ug.ac.mak.der.workflow.CaptureWorkflowService;

@WebMvcTest(CaptureFormController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class CaptureFormControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean CaptureFormService forms;
    @MockBean CaptureWorkflowService workflows;

    private static RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op",
                EdgeUser.Origin.BOOTSTRAP, null, false,
                EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h",
                now, now, now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    private static CaptureWorkflowRun run(final UUID runId,
                                            final UUID workflowId,
                                            final CaptureWorkflowRun.State state) {
        final Instant now = Instant.parse("2026-11-06T10:00:00Z");
        return new CaptureWorkflowRun(runId, workflowId, 1, "ou-1|2026W44",
                UUID.randomUUID(), state, now, now, UUID.randomUUID());
    }

    private static FormAssembly happyForm() {
        return new FormAssembly(
                FormType.AGGREGATE, "DATA_SET", "DS1", "Weekly OPD",
                new Ownership("OPERATOR", null, true),
                List.of(new FormSection(null, "Capture",
                        List.of(new FormField(
                                "DE1|HllvX50cXC0", "DE1", "HllvX50cXC0",
                                "Malaria confirmed", "default", "NUMBER", null,
                                Requirement.REQUIRED)))),
                List.of());
    }

    // ───── /runs listing ────────────────────────────────────────────────

    @Test
    void listRunsRequiresWorkflowId() throws Exception {
        mockMvc.perform(get("/edge-api/v1/capture/runs").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CAPTURE_PARAM_INVALID"));
    }

    @Test
    void listRunsReturnsRuns() throws Exception {
        final UUID wf = UUID.randomUUID();
        when(workflows.runs(wf))
                .thenReturn(List.of(run(UUID.randomUUID(), wf,
                        CaptureWorkflowRun.State.OPEN)));
        mockMvc.perform(get("/edge-api/v1/capture/runs")
                        .param("workflowId", wf.toString())
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1))
                .andExpect(jsonPath("$.runs[0].state").value("OPEN"));
    }

    @Test
    void listRunsStateFilterRejectsBadValue() throws Exception {
        final UUID wf = UUID.randomUUID();
        when(workflows.runs(wf)).thenReturn(List.of());
        mockMvc.perform(get("/edge-api/v1/capture/runs")
                        .param("workflowId", wf.toString())
                        .param("state", "NOT_A_STATE")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CAPTURE_PARAM_INVALID"));
    }

    // ───── POST /runs ───────────────────────────────────────────────────

    @Test
    void startRunRejectsMissingWorkflowId() throws Exception {
        mockMvc.perform(post("/edge-api/v1/capture/runs")
                        .with(as(EdgeRole.OPERATOR))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"businessKey\":\"ou-1|2026W44\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CAPTURE_PARAM_INVALID"));
    }

    @Test
    void startRunCreatesRunAndReturns201() throws Exception {
        final UUID wf = UUID.randomUUID();
        final UUID runId = UUID.randomUUID();
        when(workflows.startRun(eq(wf), eq("ou-1|2026W44"), any(UUID.class)))
                .thenReturn(run(runId, wf, CaptureWorkflowRun.State.OPEN));
        mockMvc.perform(post("/edge-api/v1/capture/runs")
                        .with(as(EdgeRole.OPERATOR))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"workflowId\":\"" + wf + "\","
                                + "\"businessKey\":\"ou-1|2026W44\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.runId").value(runId.toString()))
                .andExpect(jsonPath("$.state").value("OPEN"));
    }

    // ───── GET /runs/{id}, /form, /data ─────────────────────────────────

    @Test
    void getRunReturns404ForUnknown() throws Exception {
        final UUID runId = UUID.randomUUID();
        when(forms.findRun(runId)).thenReturn(java.util.Optional.empty());
        mockMvc.perform(get("/edge-api/v1/capture/runs/" + runId)
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("WORKFLOW_RUN_NOT_FOUND"));
    }

    @Test
    void getRunReturnsSummary() throws Exception {
        final UUID runId = UUID.randomUUID();
        final UUID wf = UUID.randomUUID();
        when(forms.findRun(runId)).thenReturn(java.util.Optional.of(
                run(runId, wf, CaptureWorkflowRun.State.AWAITING)));
        mockMvc.perform(get("/edge-api/v1/capture/runs/" + runId)
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("AWAITING"))
                .andExpect(jsonPath("$.businessKey").value("ou-1|2026W44"));
    }

    @Test
    void getRunFormHappyPath() throws Exception {
        final UUID runId = UUID.randomUUID();
        when(forms.assembleForRun(eq(runId), anyString(), any()))
                .thenReturn(happyForm());
        mockMvc.perform(get("/edge-api/v1/capture/runs/" + runId + "/form")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.formType").value("AGGREGATE"))
                .andExpect(jsonPath("$.bindingUid").value("DS1"))
                .andExpect(jsonPath("$.ownership.isMyStep").value(true))
                .andExpect(jsonPath("$.sections[0].fields[0].fieldRef")
                        .value("DE1|HllvX50cXC0"));
    }

    @Test
    void getRunFormForwardsDeviceHeader() throws Exception {
        final UUID runId = UUID.randomUUID();
        final UUID device = UUID.randomUUID();
        when(forms.assembleForRun(eq(runId), anyString(), eq(device)))
                .thenReturn(happyForm());
        mockMvc.perform(get("/edge-api/v1/capture/runs/" + runId + "/form")
                        .header("X-DER-Device-Id", device.toString())
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk());
        verify(forms).assembleForRun(eq(runId), anyString(), eq(device));
    }

    @Test
    void getRunFormRejectsMalformedDeviceHeader() throws Exception {
        final UUID runId = UUID.randomUUID();
        mockMvc.perform(get("/edge-api/v1/capture/runs/" + runId + "/form")
                        .header("X-DER-Device-Id", "not-a-uuid")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CAPTURE_PARAM_INVALID"));
    }

    @Test
    void getRunFormBlockedSurfacesDependencies() throws Exception {
        final UUID runId = UUID.randomUUID();
        final UUID blocker = UUID.randomUUID();
        when(forms.assembleForRun(eq(runId), anyString(), any()))
                .thenThrow(new CaptureFormError(
                        ErrorCode.WORKFLOW_RUN_BLOCKED,
                        "waiting on reviewer",
                        Map.of("blockedOnStepIds", List.of(blocker.toString()))));
        mockMvc.perform(get("/edge-api/v1/capture/runs/" + runId + "/form")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("WORKFLOW_RUN_BLOCKED"))
                .andExpect(jsonPath("$.blockedOnStepIds[0]")
                        .value(blocker.toString()));
    }

    @Test
    void getRunFormDeviceRequired403() throws Exception {
        final UUID runId = UUID.randomUUID();
        when(forms.assembleForRun(eq(runId), anyString(), any()))
                .thenThrow(new CaptureFormError(
                        ErrorCode.DEVICE_HEADER_REQUIRED,
                        "step is device-owned"));
        mockMvc.perform(get("/edge-api/v1/capture/runs/" + runId + "/form")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("DEVICE_HEADER_REQUIRED"));
    }

    @Test
    void getRunFormMetadataNotReady503() throws Exception {
        final UUID runId = UUID.randomUUID();
        when(forms.assembleForRun(eq(runId), anyString(), any()))
                .thenThrow(new CaptureFormError(
                        ErrorCode.METADATA_NOT_READY,
                        "dataSet DS1 not mirrored"));
        mockMvc.perform(get("/edge-api/v1/capture/runs/" + runId + "/form")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("METADATA_NOT_READY"));
    }

    @Test
    void getRunDataReturnsCells() throws Exception {
        final UUID runId = UUID.randomUUID();
        when(forms.prefetchRunData(runId)).thenReturn(new FormDataPrefill(
                Map.of("DE1|HllvX50cXC0", "42"),
                Instant.parse("2026-11-06T09:00:00Z")));
        mockMvc.perform(get("/edge-api/v1/capture/runs/" + runId + "/data")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cells.['DE1|HllvX50cXC0']").value("42"));
    }

    // ───── advance ──────────────────────────────────────────────────────

    @Test
    void advanceRejectsUnknownRun() throws Exception {
        final UUID runId = UUID.randomUUID();
        when(forms.findRun(runId)).thenReturn(java.util.Optional.empty());
        mockMvc.perform(post("/edge-api/v1/capture/runs/" + runId + "/advance")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isNotFound());
    }

    @Test
    void advanceCallsServiceAndReturnsUpdatedState() throws Exception {
        final UUID runId = UUID.randomUUID();
        final UUID wf = UUID.randomUUID();
        when(forms.findRun(runId)).thenReturn(java.util.Optional.of(
                run(runId, wf, CaptureWorkflowRun.State.OPEN)));
        when(workflows.advanceRunState(runId)).thenReturn(false);
        mockMvc.perform(post("/edge-api/v1/capture/runs/" + runId + "/advance")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completedByThisCall").value(false));
        verify(workflows).advanceRunState(runId);
    }

    // ───── free-standing dataset endpoints ──────────────────────────────

    @Test
    void getDataSetFormReturnsForm() throws Exception {
        when(forms.assembleForDataSet("DS1")).thenReturn(happyForm());
        mockMvc.perform(get("/edge-api/v1/capture/datasets/DS1/form")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bindingUid").value("DS1"))
                .andExpect(jsonPath("$.ownership.isMyStep").value(true));
    }

    @Test
    void getDataSetFormMetadataMissing503() throws Exception {
        when(forms.assembleForDataSet("DSX"))
                .thenThrow(new CaptureFormError(
                        ErrorCode.METADATA_NOT_READY, "DSX not mirrored"));
        mockMvc.perform(get("/edge-api/v1/capture/datasets/DSX/form")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("METADATA_NOT_READY"));
    }

    @Test
    void getDataSetDataRequiresOrgUnitAndPeriod() throws Exception {
        when(forms.prefetchDataSetData(null, null))
                .thenThrow(new CaptureFormError(
                        ErrorCode.CAPTURE_PARAM_INVALID, "orgUnit is required"));
        mockMvc.perform(get("/edge-api/v1/capture/datasets/DS1/data")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CAPTURE_PARAM_INVALID"));
    }

    @Test
    void getDataSetDataReturnsCells() throws Exception {
        when(forms.prefetchDataSetData("OU1", "2026W44"))
                .thenReturn(new FormDataPrefill(
                        Map.of("DE1|HllvX50cXC0", "7"),
                        Instant.parse("2026-11-05T08:00:00Z")));
        mockMvc.perform(get("/edge-api/v1/capture/datasets/DS1/data")
                        .param("orgUnit", "OU1")
                        .param("period", "2026W44")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cells.['DE1|HllvX50cXC0']").value("7"));
    }

    // ───── extra coverage for branch + error paths ──────────────────────

    @Test
    void listRunsFiltersByValidState() throws Exception {
        final UUID wf = UUID.randomUUID();
        when(workflows.runs(wf)).thenReturn(List.of(
                run(UUID.randomUUID(), wf, CaptureWorkflowRun.State.OPEN),
                run(UUID.randomUUID(), wf, CaptureWorkflowRun.State.COMPLETED)));
        mockMvc.perform(get("/edge-api/v1/capture/runs")
                        .param("workflowId", wf.toString())
                        .param("state", "COMPLETED")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1))
                .andExpect(jsonPath("$.runs[0].state").value("COMPLETED"));
    }

    @Test
    void startRunServiceIllegalArgumentMapsTo400() throws Exception {
        final UUID wf = UUID.randomUUID();
        when(workflows.startRun(any(UUID.class), anyString(), any(UUID.class)))
                .thenThrow(new IllegalArgumentException(
                        "workflow " + wf + " is disabled"));
        mockMvc.perform(post("/edge-api/v1/capture/runs")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"workflowId\":\"" + wf + "\","
                                + "\"businessKey\":\"ou-1|2026W44\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CAPTURE_PARAM_INVALID"))
                .andExpect(jsonPath("$.message",
                        org.hamcrest.Matchers.containsString("disabled")));
    }

    @Test
    void advanceReportsCompletedByThisCall() throws Exception {
        final UUID runId = UUID.randomUUID();
        final UUID wf = UUID.randomUUID();
        when(forms.findRun(runId)).thenReturn(java.util.Optional.of(
                run(runId, wf, CaptureWorkflowRun.State.COMPLETED)));
        when(workflows.advanceRunState(runId)).thenReturn(true);
        mockMvc.perform(post("/edge-api/v1/capture/runs/" + runId + "/advance")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completedByThisCall").value(true))
                .andExpect(jsonPath("$.state").value("COMPLETED"));
    }

    @Test
    void getRunFormNotOwned403() throws Exception {
        /* Covers the WORKFLOW_RUN_NOT_OWNED → 403 httpFor branch
         * (service throws it when the client explicitly asks for the
         * editable envelope on a step they don't own). */
        final UUID runId = UUID.randomUUID();
        when(forms.assembleForRun(eq(runId), anyString(), any()))
                .thenThrow(new CaptureFormError(
                        ErrorCode.WORKFLOW_RUN_NOT_OWNED,
                        "current step owned by REVIEWER"));
        mockMvc.perform(get("/edge-api/v1/capture/runs/" + runId + "/form")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("WORKFLOW_RUN_NOT_OWNED"));
    }

    @Test
    void getRunDataNotFoundSurfacesAs404() throws Exception {
        final UUID runId = UUID.randomUUID();
        when(forms.prefetchRunData(runId))
                .thenThrow(new CaptureFormError(
                        ErrorCode.WORKFLOW_RUN_NOT_FOUND,
                        "run " + runId + " not found"));
        mockMvc.perform(get("/edge-api/v1/capture/runs/" + runId + "/data")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("WORKFLOW_RUN_NOT_FOUND"));
    }
}
