package org.der.android.design

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

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

/**
 * The DER Material 3 theme. Compose equivalent of `apps/app-sdk/src/tokens.css`.
 * Dark mode is intentionally deferred until the web client ships a dark
 * palette (ADR-0041 §non-goals).
 */
@Composable
fun DerTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DerLightColors,
        typography = DerTypography,
        content = content,
    )
}
