package org.der.android.core.data.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

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
