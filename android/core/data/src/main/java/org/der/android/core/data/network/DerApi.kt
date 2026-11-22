package org.der.android.core.data.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Retrofit interface mirroring the DER edge-api auth + devices surface.
 * DTOs match the server records field-for-field. Only the endpoints the
 * current phase needs are declared here — the service grows with later
 * phases.
 */
interface DerApi {
    @POST("edge-api/v1/auth/sign-in")
    suspend fun signIn(@Body request: SignInRequestDto): Response<SignInResponseDto>

    @GET("edge-api/v1/auth/session")
    suspend fun session(): Response<SignInResponseDto>

    @POST("edge-api/v1/auth/sign-out")
    suspend fun signOut(): Response<Unit>

    @POST("edge-api/v1/devices/enroll")
    suspend fun enrolDevice(@Body request: EnrolDeviceRequestDto): Response<EnrolDeviceResponseDto>

    @GET("edge-api/v1/devices/{id}")
    suspend fun getDevice(@Path("id") id: String): Response<DeviceDto>

    // ── WebRTC signalling broker (ADR-0038 — DPP/1 rides the data channel) ──

    @POST("edge-api/v1/webrtc/offer")
    suspend fun offerSession(@Body body: WebRtcOfferDto): Response<WebRtcSessionIdDto>

    @POST("edge-api/v1/webrtc/{sessionId}/answer")
    suspend fun answerSession(
        @Path("sessionId") sessionId: String,
        @Body body: WebRtcAnswerDto,
    ): Response<Unit>

    @POST("edge-api/v1/webrtc/{sessionId}/complete")
    suspend fun completeSession(@Path("sessionId") sessionId: String): Response<Unit>

    @GET("edge-api/v1/webrtc/pending")
    suspend fun pendingSessions(@Query("deviceId") deviceId: String): Response<WebRtcSessionListDto>

    @GET("edge-api/v1/webrtc/{sessionId}")
    suspend fun getSession(@Path("sessionId") sessionId: String): Response<WebRtcSessionDto>

    @POST("edge-api/v1/webrtc/{sessionId}/ice")
    suspend fun postIceCandidate(
        @Path("sessionId") sessionId: String,
        @Body body: WebRtcIceDto,
    ): Response<WebRtcIceIdDto>

    @GET("edge-api/v1/webrtc/{sessionId}/ice")
    suspend fun pollIceCandidates(
        @Path("sessionId") sessionId: String,
        @Query("deviceId") deviceId: String,
        @Query("since") since: Long = 0L,
    ): Response<WebRtcIceListDto>

    // ── DHIS2-shaped aggregate (Data Entry) ────────────────────────────

    @GET("api/dataSets")
    suspend fun listDataSets(
        @Query("fields") fields: String = "id,displayName,name,periodType,formType",
        @Query("paging") paging: String = "false",
        @Query("orgUnit") orgUnit: String? = null,
    ): Response<DataSetListDto>

    @GET("api/dataSets/{id}")
    suspend fun getDataSet(
        @Path("id") id: String,
        @Query("fields") fields: String =
            "id,name,displayName,periodType,formType," +
                "categoryCombo[id,name,categoryOptionCombos[id,name,displayName]]," +
                "dataSetElements[dataElement[id,name,formName,valueType," +
                "optionSet[id],categoryCombo[id,name,categoryOptionCombos[id,name,displayName]]]]," +
                "sections[id,name,displayName,sortOrder," +
                "dataElements[id],greyedFields[dataElement[id],categoryOptionCombo[id]]]",
    ): Response<DataSetDto>

    @POST("api/dataValueSets")
    suspend fun submitDataValueSet(
        @Body body: DataValueSetDto,
    ): Response<ImportSummaryDto>

    @GET("api/optionSets/{id}")
    suspend fun getOptionSet(
        @Path("id") id: String,
        @Query("fields") fields: String =
            "id,displayName,name,options[id,code,name,displayName,sortOrder]",
    ): Response<OptionSetDto>

    // ── Programs + tracker (DER Capture MVP) ───────────────────────────

    @GET("api/programs")
    suspend fun listPrograms(
        @Query("fields") fields: String =
            "id,displayName,programType,trackedEntityType[id],organisationUnits[id]",
        @Query("paging") paging: String = "false",
    ): Response<ProgramListDto>

    @GET("api/programs/{id}")
    suspend fun getProgram(
        @Path("id") id: String,
        @Query("fields") fields: String =
            "id,displayName,programType,trackedEntityType[id]," +
                "programStages[id,displayName,programStageDataElements[dataElement[id,formName,name,valueType]]]," +
                "programTrackedEntityAttributes[trackedEntityAttribute[id,formName,name,valueType]]",
    ): Response<ProgramDto>

    @GET("api/tracker/trackedEntities")
    suspend fun searchTrackedEntities(
        @Query("program") program: String,
        @Query("orgUnit") orgUnit: String,
        @Query("pageSize") pageSize: Int = 50,
    ): Response<TrackedEntityListDto>

    @POST("edge-api/v1/tracker/events")
    suspend fun submitTrackerEvent(
        @Body body: TrackerEventDto,
    ): Response<ImportSummaryDto>

    // ── Program rules + validation (rule engine) ───────────────────────

    @GET("api/programRules")
    suspend fun listProgramRules(
        @Query("fields") fields: String =
            "id,name,displayName,program[id],programStage[id],condition," +
                "description,priority",
        @Query("paging") paging: String = "false",
    ): Response<ProgramRuleListDto>

    @GET("api/programRuleActions")
    suspend fun listProgramRuleActions(
        @Query("fields") fields: String =
            "id,programRule[id],programRuleActionType,content,data," +
                "dataElement[id],trackedEntityAttribute[id]," +
                "programStage[id],programStageSection[id],location",
        @Query("paging") paging: String = "false",
    ): Response<ProgramRuleActionListDto>

    @GET("api/programRuleVariables")
    suspend fun listProgramRuleVariables(
        @Query("fields") fields: String =
            "id,name,displayName,program[id],programRuleVariableSourceType," +
                "dataElement[id],trackedEntityAttribute[id]," +
                "programStage[id],useCodeForOptionSet,valueType",
        @Query("paging") paging: String = "false",
    ): Response<ProgramRuleVariableListDto>

    @GET("api/validationRules")
    suspend fun listValidationRules(
        @Query("dataSet") dataSet: String,
        @Query("fields") fields: String =
            "id,name,importance,operator," +
                "leftSide[expression,missingValueStrategy,description]," +
                "rightSide[expression,missingValueStrategy,description]",
        @Query("paging") paging: String = "false",
    ): Response<ValidationRuleListDto>

    // ── Distributed workflow (ADR-0022..0026, §2.3.58..§2.3.104) ──────

    @GET("edge-api/v1/workflows/queue")
    suspend fun workflowQueue(
        @Query("deviceId") deviceId: String? = null,
        @Query("allDevices") allDevices: Boolean = true,
    ): Response<WorkflowQueueDto>

    @GET("edge-api/v1/workflows/runs/{runId}")
    suspend fun getWorkflowRun(@Path("runId") runId: String): Response<WorkflowRunDto>

    @GET("edge-api/v1/workflows/runs/{runId}/readiness")
    suspend fun getRunReadiness(@Path("runId") runId: String): Response<RunReadinessDto>

    @POST("edge-api/v1/workflows/runs/{runId}/steps/{stepId}/contribute")
    suspend fun contributeStep(
        @Path("runId") runId: String,
        @Path("stepId") stepId: String,
        @Body body: ContributeStepRequestDto,
    ): Response<ContributeStepResponseDto>

    // ── Approvals + referral inbox (supervisor surface) ────────────────

    @GET("edge-api/v1/approvals/pending")
    suspend fun pendingApprovals(
        @Query("limit") limit: Int = 100,
    ): Response<PendingApprovalListDto>

    @POST("edge-api/v1/approvals/{opId}/approve")
    suspend fun approveOperation(@Path("opId") opId: String): Response<ApprovalOutcomeDto>

    @POST("edge-api/v1/approvals/{opId}/reject")
    suspend fun rejectOperation(
        @Path("opId") opId: String,
        @Body body: RejectApprovalRequestDto,
    ): Response<ApprovalOutcomeDto>

    @GET("edge-api/v1/referral/inbox")
    suspend fun referralInbox(
        @Query("limit") limit: Int = 100,
    ): Response<ReferralInboxListDto>

    @POST("edge-api/v1/referral/inbox/{inboxId}/accept")
    suspend fun acceptReferral(@Path("inboxId") inboxId: String): Response<ReferralOutcomeDto>

    @POST("edge-api/v1/referral/inbox/{inboxId}/dismiss")
    suspend fun dismissReferral(@Path("inboxId") inboxId: String): Response<ReferralOutcomeDto>
}

@Serializable
data class SignInRequestDto(
    val username: String,
    val password: String,
)

@Serializable
data class SignInResponseDto(
    val userId: String,
    val username: String,
    val displayName: String? = null,
    val roles: List<String> = emptyList(),
    val expiresAt: String,
    @SerialName("deviceApproved") val deviceApproved: Boolean? = null,
)

@Serializable
data class EnrolDeviceRequestDto(
    val deviceId: String,
    val userAgent: String? = null,
)

@Serializable
data class EnrolDeviceResponseDto(
    val deviceId: String,
    val status: String,
    val enrolmentToken: String? = null,
    val displayName: String? = null,
    val formFactor: String? = null,
    val enrolledAt: String? = null,
)

@Serializable
data class DeviceDto(
    val deviceId: String,
    val status: String,
    val displayName: String? = null,
    val formFactor: String? = null,
    val enrolledAt: String? = null,
    val approvedAt: String? = null,
)

// WebRTC signalling DTOs — match WebRtcController field-for-field.

@Serializable
data class WebRtcOfferDto(
    val initiatorDevice: String,
    val responderDevice: String,
    val sdpOffer: String,
    val kind: String? = "data",
)

@Serializable
data class WebRtcSessionIdDto(val sessionId: String)

@Serializable
data class WebRtcAnswerDto(val sdpAnswer: String)

@Serializable
data class WebRtcSessionDto(
    val sessionId: String,
    val initiatorDevice: String,
    val responderDevice: String,
    val state: String,
    val sdpOffer: String? = null,
    val sdpAnswer: String? = null,
    val createdAt: String? = null,
    val kind: String? = null,
)

@Serializable
data class WebRtcSessionListDto(val sessions: List<WebRtcSessionDto> = emptyList())

@Serializable
data class WebRtcIceDto(
    val fromDevice: String,
    val candidate: String,
    val sdpMid: String? = null,
    val sdpMLineIndex: Int? = null,
)

@Serializable
data class WebRtcIceIdDto(val candidateId: Long)

@Serializable
data class WebRtcIceCandidateDto(
    val candidateId: Long,
    val candidate: String,
    val fromDevice: String,
    val sdpMid: String? = null,
    val sdpMLineIndex: Int? = null,
    val receivedAt: String? = null,
)

@Serializable
data class WebRtcIceListDto(val candidates: List<WebRtcIceCandidateDto> = emptyList())

// DHIS2-shaped aggregate DTOs — DER Data Entry.

@Serializable
data class DataSetListDto(val dataSets: List<DataSetSummaryDto> = emptyList())

@Serializable
data class DataSetSummaryDto(
    val id: String,
    val name: String? = null,
    val displayName: String? = null,
    val periodType: String? = null,
    val formType: String? = null,
)

@Serializable
data class DataSetDto(
    val id: String,
    val name: String? = null,
    val displayName: String? = null,
    val periodType: String? = null,
    val formType: String? = null,
    val categoryCombo: CategoryComboDto? = null,
    val dataSetElements: List<DataSetElementDto> = emptyList(),
    val sections: List<DataSetSectionDto> = emptyList(),
)

@Serializable
data class DataSetElementDto(
    val dataElement: DataElementDto,
)

@Serializable
data class DataElementDto(
    val id: String,
    val name: String? = null,
    val formName: String? = null,
    val valueType: String? = null,
    val optionSet: ProgramRefDto? = null,
    val categoryCombo: CategoryComboDto? = null,
)

@Serializable
data class CategoryComboDto(
    val id: String,
    val name: String? = null,
    val categoryOptionCombos: List<CategoryOptionComboDto> = emptyList(),
)

@Serializable
data class CategoryOptionComboDto(
    val id: String,
    val name: String? = null,
    val displayName: String? = null,
)

@Serializable
data class DataSetSectionDto(
    val id: String,
    val name: String? = null,
    val displayName: String? = null,
    val sortOrder: Int? = null,
    val dataElements: List<ProgramRefDto> = emptyList(),
    val greyedFields: List<GreyedFieldDto> = emptyList(),
)

@Serializable
data class GreyedFieldDto(
    val dataElement: ProgramRefDto? = null,
    val categoryOptionCombo: ProgramRefDto? = null,
)

@Serializable
data class OptionSetDto(
    val id: String,
    val name: String? = null,
    val displayName: String? = null,
    val options: List<OptionDto> = emptyList(),
)

@Serializable
data class OptionDto(
    val id: String? = null,
    val code: String? = null,
    val name: String? = null,
    val displayName: String? = null,
    val sortOrder: Int? = null,
)

@Serializable
data class DataValueSetDto(
    val dataSet: String,
    val orgUnit: String,
    val period: String,
    val completeDate: String? = null,
    val dataValues: List<DataValueDto>,
)

@Serializable
data class DataValueDto(
    val dataElement: String,
    val value: String,
    val categoryOptionCombo: String? = null,
    val comment: String? = null,
)

@Serializable
data class ImportSummaryDto(
    val status: String? = null,
    val description: String? = null,
)

// Programs + tracker DTOs — DER Capture MVP.

@Serializable
data class ProgramListDto(val programs: List<ProgramSummaryDto> = emptyList())

@Serializable
data class ProgramSummaryDto(
    val id: String,
    val name: String? = null,
    val displayName: String? = null,
    val programType: String? = null,
    val trackedEntityType: ProgramRefDto? = null,
    val organisationUnits: List<ProgramRefDto> = emptyList(),
)

@Serializable
data class ProgramRefDto(val id: String)

@Serializable
data class ProgramDto(
    val id: String,
    val name: String? = null,
    val displayName: String? = null,
    val programType: String? = null,
    val trackedEntityType: ProgramRefDto? = null,
    val programStages: List<ProgramStageDto> = emptyList(),
    val programTrackedEntityAttributes: List<ProgramTeaDto> = emptyList(),
)

@Serializable
data class ProgramStageDto(
    val id: String,
    val name: String? = null,
    val displayName: String? = null,
    val programStageDataElements: List<ProgramStageDataElementDto> = emptyList(),
)

@Serializable
data class ProgramStageDataElementDto(val dataElement: DataElementDto)

@Serializable
data class ProgramTeaDto(val trackedEntityAttribute: TrackedEntityAttributeDto)

@Serializable
data class TrackedEntityAttributeDto(
    val id: String,
    val name: String? = null,
    val formName: String? = null,
    val valueType: String? = null,
)

@Serializable
data class TrackedEntityListDto(val trackedEntities: List<TrackedEntityDto> = emptyList())

@Serializable
data class TrackedEntityDto(
    val trackedEntity: String? = null,
    val orgUnit: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val attributes: List<TrackedEntityAttributeValueDto> = emptyList(),
)

@Serializable
data class TrackedEntityAttributeValueDto(
    val attribute: String,
    val value: String? = null,
    val displayName: String? = null,
)

/**
 * Payload for `POST /edge-api/v1/tracker/events` — matches the shape
 * the server's TrackerEventsController accepts. `dataValues` is a
 * flat `dataElementUid -> value` map (not the array-of-pairs shape
 * DHIS2 uses) because that's the DER edge endpoint's wire format.
 */
@Serializable
data class TrackerEventDto(
    val eventUid: String,
    val enrollmentUid: String? = null,
    val programUid: String,
    val programStageUid: String,
    val orgUnitUid: String,
    val status: String = "ACTIVE",
    val occurredDate: String,
    val dataValues: Map<String, String> = emptyMap(),
)

// Workflow DTOs — distributed service-point enforcement.

@Serializable
data class WorkflowQueueDto(
    val rows: List<WorkflowQueueRowDto> = emptyList(),
    val appliedDeviceId: String? = null,
    val deviceScopeSource: String? = null,
)

@Serializable
data class WorkflowQueueRowDto(
    val runId: String,
    val workflowId: String,
    val workflowName: String? = null,
    val businessKey: String,
    val stepId: String,
    val stepOrdinal: Int,
    val stepName: String? = null,
    val ownerRole: String? = null,
    val ownerDeviceId: String? = null,
    val readiness: String,
    val runCreatedAt: String? = null,
    val runUpdatedAt: String? = null,
    val validationErrorCount: Int = 0,
)

@Serializable
data class WorkflowRunDto(
    val runId: String,
    val workflowId: String,
    val workflowVersion: Int? = null,
    val businessKey: String,
    val state: String,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    @SerialName("submissionJournalOpId") val submissionJournalOpId: String? = null,
    @SerialName("submissionError") val submissionError: String? = null,
)

@Serializable
data class RunReadinessDto(
    // Map<stepId, readiness-name>. Preserved as a raw string map so
    // unknown enum values (future server-side additions) don't break
    // the client decode — the client narrows to known values.
    val steps: Map<String, String> = emptyMap(),
)

@Serializable
data class ContributeStepRequestDto(
    val payload: String,
    val deviceId: String? = null,
)

@Serializable
data class ContributeStepResponseDto(
    val run: WorkflowRunDto? = null,
    val completed: Boolean = false,
    val readiness: Map<String, String> = emptyMap(),
)

// Approvals + referral inbox DTOs.

@Serializable
data class PendingApprovalListDto(val rows: List<PendingApprovalRowDto> = emptyList())

@Serializable
data class PendingApprovalRowDto(
    val operationId: String,
    val entityType: String? = null,
    val entityRef: String? = null,
    val submittedBy: String? = null,
    val createdAt: String? = null,
)

@Serializable
data class RejectApprovalRequestDto(val reason: String)

@Serializable
data class ApprovalOutcomeDto(
    val outcome: String? = null,
    val code: String? = null,
    val message: String? = null,
)

@Serializable
data class ReferralInboxListDto(val entries: List<ReferralInboxEntryDto> = emptyList())

@Serializable
data class ReferralInboxEntryDto(
    val inboxId: String,
    val kind: String? = null,
    val sourceRef: String? = null,
    val boundOrgUnit: String? = null,
    val discoveredAt: String? = null,
    val status: String? = null,
    val ingestRunId: String? = null,
)

@Serializable
data class ReferralOutcomeDto(
    val inboxId: String? = null,
    val status: String? = null,
    val ingested: Boolean? = null,
    val code: String? = null,
    val message: String? = null,
)

// Program rule + validation DTOs — kept wide so the DER mirror's
// shape variations don't crash the decoder (ignoreUnknownKeys = true
// on the shared Json instance absorbs extra fields).

@Serializable
data class ProgramRuleListDto(val programRules: List<ProgramRuleDto> = emptyList())

@Serializable
data class ProgramRuleDto(
    val id: String,
    val name: String? = null,
    val displayName: String? = null,
    val condition: String? = null,
    val priority: Int? = null,
    val program: ProgramRefDto? = null,
    val programStage: ProgramRefDto? = null,
)

@Serializable
data class ProgramRuleActionListDto(
    val programRuleActions: List<ProgramRuleActionDto> = emptyList(),
)

@Serializable
data class ProgramRuleActionDto(
    val id: String,
    @SerialName("programRuleActionType") val type: String? = null,
    val content: String? = null,
    val data: String? = null,
    val location: String? = null,
    val programRule: ProgramRefDto? = null,
    val dataElement: ProgramRefDto? = null,
    val trackedEntityAttribute: ProgramRefDto? = null,
    val programStage: ProgramRefDto? = null,
    val programStageSection: ProgramRefDto? = null,
)

@Serializable
data class ProgramRuleVariableListDto(
    val programRuleVariables: List<ProgramRuleVariableDto> = emptyList(),
)

@Serializable
data class ProgramRuleVariableDto(
    val id: String,
    val name: String? = null,
    val displayName: String? = null,
    @SerialName("programRuleVariableSourceType") val sourceType: String? = null,
    val valueType: String? = null,
    val useCodeForOptionSet: Boolean? = null,
    val program: ProgramRefDto? = null,
    val dataElement: ProgramRefDto? = null,
    val trackedEntityAttribute: ProgramRefDto? = null,
    val programStage: ProgramRefDto? = null,
)

@Serializable
data class ValidationRuleListDto(
    val validationRules: List<ValidationRuleDto> = emptyList(),
)

@Serializable
data class ValidationRuleDto(
    val id: String,
    val name: String? = null,
    val importance: String? = null,
    val operator: String? = null,
    val leftSide: ValidationSideDto? = null,
    val rightSide: ValidationSideDto? = null,
)

@Serializable
data class ValidationSideDto(
    val expression: String? = null,
    val description: String? = null,
    val missingValueStrategy: String? = null,
)

