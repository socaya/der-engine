package org.der.android.core.data.network

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import org.der.android.core.data.BuildConfig
import javax.inject.Inject
import javax.inject.Singleton

private val Context.serverStore by preferencesDataStore(name = "der-server")

/**
 * Overridable DER server URL. Build-time `der.server.url` is the
 * default (via `BuildConfig.DER_SERVER_URL`); operators override at
 * runtime from Settings — a reinstall resets to the default.
 *
 * The URL is read by [HostSelectionInterceptor] on every request, so
 * saving a new value takes effect without restarting the app.
 */
@Singleton
class ServerUrlRepository @Inject constructor(
    @ApplicationContext private val context: Context,
) {

    val url: Flow<String> =
        context.serverStore.data.map { it[URL_KEY] ?: BuildConfig.DER_SERVER_URL }

    suspend fun current(): String = url.first()

    suspend fun set(raw: String): SetResult {
        val normalised = normalise(raw)
            ?: return SetResult.Invalid("Not a valid URL — include scheme (http:// or https://)")
        context.serverStore.edit { it[URL_KEY] = normalised }
        return SetResult.Ok(normalised)
    }

    suspend fun reset() {
        context.serverStore.edit { it.remove(URL_KEY) }
    }

    sealed interface SetResult {
        data class Ok(val url: String) : SetResult
        data class Invalid(val reason: String) : SetResult
    }

    companion object {
        private val URL_KEY = stringPreferencesKey("url")

        internal fun normalise(raw: String): String? {
            val trimmed = raw.trim().removeSuffix("/")
            if (trimmed.isEmpty()) return null
            val parsed: HttpUrl = trimmed.toHttpUrlOrNull() ?: return null
            return parsed.toString().removeSuffix("/")
        }
    }
}
