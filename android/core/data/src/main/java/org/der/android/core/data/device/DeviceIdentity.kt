package org.der.android.core.data.device

import android.content.Context
import android.os.Build
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

private val Context.deviceStore by preferencesDataStore(name = "der-device")

/**
 * Stable per-install device identity for the Android client.
 *
 * ADR-0019 ties DER's device-trust model to a single UUID the client
 * sends on every request as `X-DER-Device-Id`. We generate that UUID
 * on first boot and keep it in DataStore so a reinstall yields a new
 * identity (which forces re-enrolment — the desired failure mode).
 *
 * Operators never see the UUID directly; the user-agent string is
 * human-friendly (manufacturer + model + Android version) and gets
 * shown in the admin-UI enrolment queue.
 */
@Singleton
class DeviceIdentity @Inject constructor(
    @ApplicationContext private val context: Context,
) {

    suspend fun deviceId(): UUID {
        val existing = context.deviceStore.data
            .map { it[DEVICE_ID_KEY] }
            .first()
        if (existing != null) {
            return runCatching { UUID.fromString(existing) }
                .getOrElse { regenerate() }
        }
        return regenerate()
    }

    fun userAgent(): String =
        "DER-Android/${Build.MANUFACTURER} ${Build.MODEL} (Android ${Build.VERSION.RELEASE})"

    private suspend fun regenerate(): UUID {
        val fresh = UUID.randomUUID()
        context.deviceStore.edit { prefs ->
            prefs[DEVICE_ID_KEY] = fresh.toString()
        }
        return fresh
    }

    companion object {
        private val DEVICE_ID_KEY = stringPreferencesKey("deviceId")
    }
}
