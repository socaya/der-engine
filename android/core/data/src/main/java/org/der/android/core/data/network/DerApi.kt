package org.der.android.core.data.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

/**
 * Retrofit interface mirroring the DER edge-api auth surface. DTOs
 * match `AuthController.SignInRequest` / `SignInResponse` field-for-field.
 * Only the endpoints Phase 2 needs are declared here — the service
 * grows with later phases.
 */
interface DerApi {
    @POST("edge-api/v1/auth/sign-in")
    suspend fun signIn(@Body request: SignInRequestDto): Response<SignInResponseDto>

    @GET("edge-api/v1/auth/session")
    suspend fun session(): Response<SignInResponseDto>

    @POST("edge-api/v1/auth/sign-out")
    suspend fun signOut(): Response<Unit>
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
