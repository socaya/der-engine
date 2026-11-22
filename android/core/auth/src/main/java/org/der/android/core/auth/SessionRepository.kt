package org.der.android.core.auth

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import org.der.android.core.data.network.DerApi
import org.der.android.core.data.network.DerCookieJar
import org.der.android.core.data.network.SignInRequestDto
import org.der.android.core.data.network.SignInResponseDto
import org.der.android.core.domain.Session
import org.der.android.core.domain.SignInResult
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore by preferencesDataStore(name = "der-session")

/**
 * Single source of truth for the authenticated DER session. Persists
 * the server's SignInResponse (minus the session cookie, which lives
 * in [DerCookieJar]) so the shell can decide between SignIn vs Home
 * on cold start.
 *
 * Thread-safe. Observing [session] gives a reactive Flow that updates
 * on sign-in and sign-out.
 */
@Singleton
class SessionRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val api: DerApi,
    private val cookieJar: DerCookieJar,
    private val json: Json,
) {
    val session: Flow<Session?> =
        context.dataStore.data.map { prefs -> prefs.toSession() }

    suspend fun current(): Session? = session.first()

    suspend fun signIn(username: String, password: String): SignInResult = try {
        val response = api.signIn(SignInRequestDto(username.trim(), password))
        when {
            response.isSuccessful && response.body() != null -> {
                val session = response.body()!!.toDomain()
                persist(session)
                SignInResult.Success(session)
            }
            response.code() == 401 -> SignInResult.InvalidCredentials
            response.code() == 403 -> {
                val deviceId = response.headers()["X-DER-Device-Id"] ?: ""
                SignInResult.DeviceNotApproved(deviceId)
            }
            else -> SignInResult.Unknown("HTTP ${response.code()}")
        }
    } catch (io: IOException) {
        SignInResult.ServerUnreachable(io.message ?: "Network error")
    } catch (t: Throwable) {
        SignInResult.Unknown(t.message ?: t::class.java.simpleName)
    }

    suspend fun signOut() {
        runCatching { api.signOut() }
        cookieJar.clear()
        context.dataStore.edit { it.clear() }
    }

    private val rolesSerializer = ListSerializer(String.serializer())

    private suspend fun persist(session: Session) {
        context.dataStore.edit { prefs ->
            prefs[SessionKeys.USER_ID] = session.userId
            prefs[SessionKeys.USERNAME] = session.username
            prefs[SessionKeys.DISPLAY_NAME] = session.displayName.orEmpty()
            prefs[SessionKeys.ROLES] = json.encodeToString(rolesSerializer, session.roles)
            prefs[SessionKeys.EXPIRES_AT] = session.expiresAt
        }
    }

    private fun Preferences.toSession(): Session? {
        val userId = this[SessionKeys.USER_ID] ?: return null
        val rolesJson = this[SessionKeys.ROLES] ?: "[]"
        val roles = runCatching {
            json.decodeFromString(rolesSerializer, rolesJson)
        }.getOrDefault(emptyList())
        return Session(
            userId = userId,
            username = this[SessionKeys.USERNAME].orEmpty(),
            displayName = this[SessionKeys.DISPLAY_NAME]?.takeIf { it.isNotBlank() },
            roles = roles,
            expiresAt = this[SessionKeys.EXPIRES_AT].orEmpty(),
        )
    }
}

private fun SignInResponseDto.toDomain() = Session(
    userId = userId,
    username = username,
    displayName = displayName,
    roles = roles,
    expiresAt = expiresAt,
)

private object SessionKeys {
    val USER_ID = stringPreferencesKey("userId")
    val USERNAME = stringPreferencesKey("username")
    val DISPLAY_NAME = stringPreferencesKey("displayName")
    val ROLES = stringPreferencesKey("roles")
    val EXPIRES_AT = stringPreferencesKey("expiresAt")
}
