package org.der.android.core.auth

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.unlockStore by preferencesDataStore(name = "der-unlock")

/**
 * Persistent "require biometric unlock on cold start" flag. Default
 * is off — operators opt in from Settings. The flag only guards
 * resumption of a cached session; a fresh sign-in still goes through
 * the DER username/password flow.
 */
@Singleton
class BiometricPreference @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    val required: Flow<Boolean> =
        context.unlockStore.data.map { it[KEY] ?: false }

    suspend fun current(): Boolean = required.first()

    suspend fun set(enabled: Boolean) {
        context.unlockStore.edit { it[KEY] = enabled }
    }

    companion object {
        private val KEY = booleanPreferencesKey("biometric-required")
    }
}
