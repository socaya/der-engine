package org.der.android.design

import androidx.compose.ui.graphics.Color

/**
 * Canonical DER color tokens mirrored from `apps/app-sdk/src/tokens.css`.
 * Keep this file in lockstep with the CSS token file — the Compose client
 * must stay visually indistinguishable from the web client on the same
 * surfaces.
 */
object DerColors {
    // Primary (interactive emphasis)
    val Primary50 = Color(0xFFE6F0FA)
    val Primary100 = Color(0xFFC6DCF3)
    val Primary500 = Color(0xFF0D58A8)
    val Primary600 = Color(0xFF0A4A92)
    val Primary700 = Color(0xFF083C78)
    val PrimarySoft = Color(0xFFE8EFF8)

    // Accent (sync pills, teal)
    val Accent500 = Color(0xFF2B9EAC)
    val Accent600 = Color(0xFF1B7D8A)
    val AccentSoft = Color(0xFFE4F4F6)

    // Ink (text hierarchy)
    val Ink900 = Color(0xFF0F1C2E)
    val Ink800 = Color(0xFF1B2B4A)
    val Ink700 = Color(0xFF2D3F5F)
    val Ink500 = Color(0xFF5A6A85)
    val Ink400 = Color(0xFF7585A0)

    // Semantics
    val Success = Color(0xFF1B9E5A)
    val SuccessSoft = Color(0xFFE3F7EC)
    val SuccessInk = Color(0xFF0F7F44)
    val Warning = Color(0xFFD68A1A)
    val WarningSoft = Color(0xFFFDF2D9)
    val WarningInk = Color(0xFF8A5A0B)
    val Danger = Color(0xFFC0392B)
    val DangerSoft = Color(0xFFFDE6E6)
    val DangerInk = Color(0xFF8E2B21)
    val Info = Color(0xFF1D4ED8)
    val InfoSoft = Color(0xFFE3F2FD)
    val InfoInk = Color(0xFF0A3CB7)

    // Surface
    val Surface = Color(0xFFFFFFFF)
    val SurfaceRaised = Color(0xFFF7F8FA)
    val Background = Color(0xFFEEF2F7)
    val BorderSubtle = Color(0xFFDCE2EB)
    val Ink100 = Color(0xFFE3E8EF)
}
