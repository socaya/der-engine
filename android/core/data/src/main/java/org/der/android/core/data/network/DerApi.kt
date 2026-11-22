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
                "dataSetElements[dataElement[id,name,formName,valueType]]",
    ): Response<DataSetDto>

    @POST("api/dataValueSets")
    suspend fun submitDataValueSet(
        @Body body: DataValueSetDto,
    ): Response<ImportSummaryDto>
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
    val dataSetElements: List<DataSetElementDto> = emptyList(),
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
