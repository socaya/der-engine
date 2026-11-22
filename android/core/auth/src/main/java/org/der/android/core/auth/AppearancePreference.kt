package org.der.android.core.auth

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.appearanceStore by preferencesDataStore(name = "der-appearance")

/**
 * Operator-visible UX preferences — theme mode + locale tag. Both
 * are plain strings so new values can land without a migration.
 */
@Singleton
class AppearancePreference @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    val themeMode: Flow<String> =
        context.appearanceStore.data.map { it[KEY_THEME] ?: THEME_SYSTEM }

    val localeTag: Flow<String> =
        context.appearanceStore.data.map { it[KEY_LOCALE] ?: LOCALE_SYSTEM }

    suspend fun currentTheme(): String = themeMode.first()
    suspend fun currentLocale(): String = localeTag.first()

    suspend fun setTheme(value: String) {
        context.appearanceStore.edit { it[KEY_THEME] = value }
    }

    suspend fun setLocale(value: String) {
        context.appearanceStore.edit { it[KEY_LOCALE] = value }
    }

    companion object {
        private val KEY_THEME = stringPreferencesKey("themeMode")
        private val KEY_LOCALE = stringPreferencesKey("localeTag")

        const val THEME_SYSTEM = "SYSTEM"
        const val THEME_LIGHT = "LIGHT"
        const val THEME_DARK = "DARK"

        const val LOCALE_SYSTEM = ""
    }
}
