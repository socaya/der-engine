package org.der.android.design

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

/**
 * Operator-selectable theme mode. [SYSTEM] follows the OS; the
 * Settings screen also offers explicit [LIGHT] / [DARK] overrides.
 */
enum class DerThemeMode { SYSTEM, LIGHT, DARK }

private val DerLightColors = lightColorScheme(
    primary = DerColors.Primary500,
    onPrimary = DerColors.Surface,
    primaryContainer = DerColors.PrimarySoft,
    onPrimaryContainer = DerColors.Primary700,
    secondary = DerColors.Accent500,
    onSecondary = DerColors.Surface,
    secondaryContainer = DerColors.AccentSoft,
    onSecondaryContainer = DerColors.Accent600,
    error = DerColors.Danger,
    background = DerColors.Background,
    onBackground = DerColors.Ink800,
    surface = DerColors.Surface,
    onSurface = DerColors.Ink800,
    surfaceVariant = DerColors.SurfaceRaised,
    onSurfaceVariant = DerColors.Ink500,
    outline = DerColors.BorderSubtle,
    outlineVariant = DerColors.BorderSubtle,
)

private val DerDarkPalette = darkColorScheme(
    primary = DerDarkColors.Primary,
    onPrimary = DerDarkColors.Background,
    primaryContainer = DerDarkColors.PrimaryContainer,
    onPrimaryContainer = DerDarkColors.PrimaryInk,
    secondary = DerDarkColors.Accent,
    onSecondary = DerDarkColors.Background,
    secondaryContainer = DerDarkColors.AccentContainer,
    onSecondaryContainer = DerDarkColors.AccentInk,
    error = DerDarkColors.Danger,
    background = DerDarkColors.Background,
    onBackground = DerDarkColors.Ink,
    surface = DerDarkColors.Surface,
    onSurface = DerDarkColors.Ink,
    surfaceVariant = DerDarkColors.SurfaceVariant,
    onSurfaceVariant = DerDarkColors.InkMuted,
    outline = DerDarkColors.BorderSubtle,
    outlineVariant = DerDarkColors.BorderSubtle,
)

@Composable
fun DerTheme(
    mode: DerThemeMode = DerThemeMode.SYSTEM,
    content: @Composable () -> Unit,
) {
    val dark = when (mode) {
        DerThemeMode.SYSTEM -> isSystemInDarkTheme()
        DerThemeMode.LIGHT -> false
        DerThemeMode.DARK -> true
    }
    MaterialTheme(
        colorScheme = if (dark) DerDarkPalette else DerLightColors,
        typography = DerTypography,
        content = content,
    )
}
