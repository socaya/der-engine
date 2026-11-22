package org.der.android

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.core.os.LocaleListCompat
import androidx.fragment.app.FragmentActivity
import dagger.hilt.android.AndroidEntryPoint
import org.der.android.core.auth.AppearancePreference
import org.der.android.design.DerTheme
import org.der.android.design.DerThemeMode
import org.der.android.notifications.DerNotifications
import org.der.android.ui.DerApp
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : FragmentActivity() {

    @Inject lateinit var appearance: AppearancePreference

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val requestedRoute = intent?.getStringExtra(DerNotifications.EXTRA_ROUTE)
        setContent {
            ThemedDerApp(appearance, initialRoute = requestedRoute)
        }
    }
}

@Composable
private fun ThemedDerApp(
    appearance: AppearancePreference,
    initialRoute: String? = null,
) {
    val mode by appearance.themeMode.collectAsState(initial = AppearancePreference.THEME_SYSTEM)
    val locale by appearance.localeTag.collectAsState(initial = AppearancePreference.LOCALE_SYSTEM)
    LaunchedEffect(locale) {
        // Apply the locale app-wide. AppCompatDelegate recreates
        // the activity on change — Compose state survives via
        // Hilt-scoped ViewModels + DataStore.
        val list = if (locale.isBlank()) {
            LocaleListCompat.getEmptyLocaleList()
        } else {
            LocaleListCompat.forLanguageTags(locale)
        }
        if (AppCompatDelegate.getApplicationLocales() != list) {
            AppCompatDelegate.setApplicationLocales(list)
        }
    }
    DerTheme(mode = parseMode(mode)) {
        DerApp(initialDeepLink = initialRoute)
    }
}

private fun parseMode(raw: String): DerThemeMode = when (raw) {
    AppearancePreference.THEME_LIGHT -> DerThemeMode.LIGHT
    AppearancePreference.THEME_DARK -> DerThemeMode.DARK
    else -> DerThemeMode.SYSTEM
}
