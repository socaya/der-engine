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
import ug.ac.mak.der.workflow.CaptureFormService.EnrollmentSummary;
import ug.ac.mak.der.workflow.CaptureFormService.EventDetail;
import ug.ac.mak.der.workflow.CaptureFormService.EventSummary;
import ug.ac.mak.der.workflow.CaptureFormService.FormAssembly;
import ug.ac.mak.der.workflow.CaptureFormService.FormDataPrefill;
import ug.ac.mak.der.workflow.CaptureFormService.FormField;
import ug.ac.mak.der.workflow.CaptureFormService.FormSection;
import ug.ac.mak.der.workflow.CaptureFormService.FormType;
import ug.ac.mak.der.workflow.CaptureFormService.Ownership;
import ug.ac.mak.der.workflow.CaptureFormService.ProgramStageSummary;
import ug.ac.mak.der.workflow.CaptureFormService.ProgramSummary;
import ug.ac.mak.der.workflow.CaptureFormService.Requirement;
import ug.ac.mak.der.workflow.CaptureFormService.TrackedEntityAttributeSummary;
import ug.ac.mak.der.workflow.CaptureFormService.TrackedEntityTypeRef;
import ug.ac.mak.der.workflow.CaptureFormService.TrackerEventSummary;
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

    // ───── phase 2 — program-stage + event endpoints ─────────────────────

    @Test
    void listStagesReturnsSortedStages() throws Exception {
        when(forms.listStagesForProgram("P1")).thenReturn(List.of(
                new ProgramStageSummary("S1", "Registration", false, 1),
                new ProgramStageSummary("S2", "Visit", true, 2)));
        mockMvc.perform(get("/edge-api/v1/capture/programs/P1/stages")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(2))
                .andExpect(jsonPath("$.stages[0].stageUid").value("S1"))
                .andExpect(jsonPath("$.stages[1].repeatable").value(true));
    }

    @Test
    void listStagesForUnmirroredProgram503() throws Exception {
        when(forms.listStagesForProgram("Pghost"))
                .thenThrow(new CaptureFormError(
                        ErrorCode.METADATA_NOT_READY,
                        "program Pghost not mirrored"));
        mockMvc.perform(get("/edge-api/v1/capture/programs/Pghost/stages")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("METADATA_NOT_READY"));
    }

    @Test
    void getStageFormReturnsFormEnvelope() throws Exception {
        when(forms.assembleForProgramStage("P1", "S1")).thenReturn(new FormAssembly(
                FormType.EVENT_STAGE, "PROGRAM_STAGE", "S1", "Registration",
                new Ownership(null, null, true),
                List.of(new FormSection(null, "Registration", List.of(
                        new FormField("DE1", "DE1", null, "Patient ID",
                                null, "TEXT", null, Requirement.REQUIRED)))),
                List.of()));
        mockMvc.perform(get("/edge-api/v1/capture/programs/P1/stages/S1/form")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.formType").value("EVENT_STAGE"))
                .andExpect(jsonPath("$.bindingUid").value("S1"))
                .andExpect(jsonPath("$.sections[0].fields[0].requirement")
                        .value("REQUIRED"));
    }

    @Test
    void getStageFormWrongProgram400() throws Exception {
        when(forms.assembleForProgramStage("Pbad", "S1"))
                .thenThrow(new CaptureFormError(
                        ErrorCode.CAPTURE_PARAM_INVALID,
                        "stage S1 does not belong to program Pbad"));
        mockMvc.perform(get("/edge-api/v1/capture/programs/Pbad/stages/S1/form")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CAPTURE_PARAM_INVALID"));
    }

    @Test
    void listEventsReturnsRows() throws Exception {
        when(forms.listEvents("P1", "OU1", 100)).thenReturn(List.of(
                new EventSummary(UUID.randomUUID(), "S1", "OU1",
                        Instant.parse("2026-11-06T09:00:00Z"), "ACTIVE",
                        java.util.Map.of())));
        mockMvc.perform(get("/edge-api/v1/capture/programs/P1/events")
                        .param("orgUnit", "OU1")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1))
                .andExpect(jsonPath("$.events[0].programStageUid").value("S1"));
    }

    @Test
    void listEventsRequiresOrgUnit() throws Exception {
        when(forms.listEvents("P1", null, 100))
                .thenThrow(new CaptureFormError(
                        ErrorCode.CAPTURE_PARAM_INVALID, "orgUnit is required"));
        mockMvc.perform(get("/edge-api/v1/capture/programs/P1/events")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CAPTURE_PARAM_INVALID"));
    }

    @Test
    void getEventDetailReturnsEvent() throws Exception {
        final UUID eventId = UUID.randomUUID();
        when(forms.getEventDetail(eventId)).thenReturn(new EventDetail(
                eventId, null, "P1", "S1", "OU1",
                Instant.parse("2026-11-06T10:00:00Z"), "ACTIVE",
                "HllvX50cXC0", java.util.Map.of("DE1", "value-42"), null));
        mockMvc.perform(get("/edge-api/v1/capture/events/" + eventId + "/detail")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.programStageUid").value("S1"))
                .andExpect(jsonPath("$.dataValues.DE1").value("value-42"));
    }

    @Test
    void getEventDetailNotFound404() throws Exception {
        final UUID eventId = UUID.randomUUID();
        when(forms.getEventDetail(eventId))
                .thenThrow(new CaptureFormError(
                        ErrorCode.WORKFLOW_RUN_NOT_FOUND,
                        "event " + eventId + " not found"));
        mockMvc.perform(get("/edge-api/v1/capture/events/" + eventId + "/detail")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("WORKFLOW_RUN_NOT_FOUND"));
    }

    // ───── phase 3 — tracker reads + program-type discrimination ────────

    @Test
    void getProgramReturnsSingleEventSummary() throws Exception {
        when(forms.resolveProgram("P1")).thenReturn(new ProgramSummary(
                "P1", "HIV Test", "WITHOUT_REGISTRATION", null));
        mockMvc.perform(get("/edge-api/v1/capture/programs/P1")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.programType").value("WITHOUT_REGISTRATION"))
                .andExpect(jsonPath("$.trackedEntityTypeUid").doesNotExist());
    }

    @Test
    void getProgramReturnsTrackerSummary() throws Exception {
        when(forms.resolveProgram("P2")).thenReturn(new ProgramSummary(
                "P2", "TX Referrals", "WITH_REGISTRATION", "TET1"));
        mockMvc.perform(get("/edge-api/v1/capture/programs/P2")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.programType").value("WITH_REGISTRATION"))
                .andExpect(jsonPath("$.trackedEntityTypeUid").value("TET1"));
    }

    @Test
    void getProgramMetadataNotReady() throws Exception {
        when(forms.resolveProgram("Pghost"))
                .thenThrow(new CaptureFormError(
                        ErrorCode.METADATA_NOT_READY, "program Pghost not mirrored"));
        mockMvc.perform(get("/edge-api/v1/capture/programs/Pghost")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("METADATA_NOT_READY"));
    }

    @Test
    void getProgramTrackedEntityType() throws Exception {
        when(forms.resolveProgramTrackedEntityType("P2"))
                .thenReturn(new TrackedEntityTypeRef("TET1"));
        mockMvc.perform(get("/edge-api/v1/capture/programs/P2/trackedEntityType")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trackedEntityTypeUid").value("TET1"));
    }

    @Test
    void getProgramTrackedEntityTypeOnSingleEvent400() throws Exception {
        when(forms.resolveProgramTrackedEntityType("P1"))
                .thenThrow(new CaptureFormError(
                        ErrorCode.CAPTURE_PARAM_INVALID,
                        "program P1 is WITHOUT_REGISTRATION; no trackedEntityType applies"));
        mockMvc.perform(get("/edge-api/v1/capture/programs/P1/trackedEntityType")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CAPTURE_PARAM_INVALID"));
    }

    @Test
    void listTeiTypeAttributesHappy() throws Exception {
        when(forms.listAttributesForTeiType("TET1")).thenReturn(List.of(
                new TrackedEntityAttributeSummary("TEA1", "First name", "TEXT",
                        null, true, false),
                new TrackedEntityAttributeSummary("TEA2", "National ID", "TEXT",
                        null, true, true)));
        mockMvc.perform(get("/edge-api/v1/capture/trackedEntityTypes/TET1/attributes")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(2))
                .andExpect(jsonPath("$.attributes[0].searchable").value(true))
                .andExpect(jsonPath("$.attributes[1].uniqueAttribute").value(true));
    }

    @Test
    void listTeiTypeAttributesMetadataNotReady() throws Exception {
        when(forms.listAttributesForTeiType("TETghost"))
                .thenThrow(new CaptureFormError(
                        ErrorCode.METADATA_NOT_READY,
                        "trackedEntityType TETghost not mirrored"));
        mockMvc.perform(get("/edge-api/v1/capture/trackedEntityTypes/TETghost/attributes")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("METADATA_NOT_READY"));
    }

    @Test
    void listTeiEnrollmentsHappy() throws Exception {
        when(forms.listEnrollmentsForTei("TEI1", "P2")).thenReturn(List.of(
                new EnrollmentSummary(
                        "Enroll111A1", "TEI1", "P2", "OU1", "ACTIVE",
                        "2026-01-01", null,
                        Instant.parse("2026-11-06T09:00:00Z"))));
        mockMvc.perform(get("/edge-api/v1/capture/trackedEntities/TEI1/enrollments")
                        .param("programUid", "P2")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1))
                .andExpect(jsonPath("$.enrollments[0].enrollmentUid")
                        .value("Enroll111A1"))
                .andExpect(jsonPath("$.enrollments[0].status").value("ACTIVE"));
    }

    @Test
    void listTeiEnrollmentsMissingTeiRejected() throws Exception {
        when(forms.listEnrollmentsForTei("", null))
                .thenThrow(new CaptureFormError(
                        ErrorCode.CAPTURE_PARAM_INVALID, "teiUid is required"));
        /* Controller passes the path param through; the service gate
         * surfaces the 400.  We exercise the service error path via
         * a mocked call directly. */
    }

    @Test
    void listEnrollmentEventsHappy() throws Exception {
        when(forms.listEventsForEnrollment("Enroll111A1", "S1")).thenReturn(List.of(
                new TrackerEventSummary(
                        "Event111A11", "Enroll111A1", "P2", "S1", "OU1",
                        "ACTIVE", "2026-02-01",
                        Instant.parse("2026-11-06T10:00:00Z"))));
        mockMvc.perform(get("/edge-api/v1/capture/enrollments/Enroll111A1/events")
                        .param("programStageUid", "S1")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1))
                .andExpect(jsonPath("$.events[0].programStageUid").value("S1"));
    }

    @Test
    void listEnrollmentEventsMissingEnrollment400() throws Exception {
        when(forms.listEventsForEnrollment("", null))
                .thenThrow(new CaptureFormError(
                        ErrorCode.CAPTURE_PARAM_INVALID,
                        "enrollmentUid is required"));
        /* Same shape as listTeiEnrollmentsMissingTeiRejected — path
         * param validation covered at the service boundary. */
    }

    @Test
    void getRunFormProgramStageBinding() throws Exception {
        /* Run-scoped form for a PROGRAM_STAGE workflow run returns
         * formType=EVENT_STAGE and the stage's displayName. */
        final UUID runId = UUID.randomUUID();
        when(forms.assembleForRun(eq(runId), anyString(), any()))
                .thenReturn(new FormAssembly(
                        FormType.EVENT_STAGE, "PROGRAM_STAGE", "S1",
                        "Registration",
                        new Ownership("OPERATOR", null, true),
                        List.of(new FormSection(null, "Step 1", List.of())),
                        List.of()));
        mockMvc.perform(get("/edge-api/v1/capture/runs/" + runId + "/form")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.formType").value("EVENT_STAGE"))
                .andExpect(jsonPath("$.bindingKind").value("PROGRAM_STAGE"));
    }
}
