package org.der.android.design

import androidx.compose.ui.graphics.Color

/**
 * DER dark palette. The web client doesn't ship an authoritative
 * dark-mode token set yet; this palette is a deliberate derivation
 * from the light tokens:
 *   - surfaces flip from near-white → DER ink-900 anchors
 *   - primary + accent slide from their 500 to their 300 so the
 *     contrast holds on dark backgrounds
 *   - semantic ink tones keep their hue; soft fills darken to a
 *     tinted base so warnings + errors stay distinguishable without
 *     burning holes through the surface
 *
 * Keep in lockstep with [DerColors] whenever the light palette
 * changes — the dark palette is the inverted-surface variant of it.
 */
object DerDarkColors {
    // Primary (interactive emphasis)
    val Primary = Color(0xFF6AA4DA)        // Primary300 — pops on dark
    val PrimaryContainer = Color(0xFF083C78) // Primary700 — soft fill
    val PrimaryInk = Color(0xFFC6DCF3)      // Primary100

    // Accent (sync pills, teal)
    val Accent = Color(0xFF5DC3CF)
    val AccentContainer = Color(0xFF1B7D8A)
    val AccentInk = Color(0xFFE4F4F6)

    // Ink (text hierarchy)
    val Ink = Color(0xFFE6ECF4)
    val InkMuted = Color(0xFF9FB0C8)

    // Semantics — brighter foreground, darker soft bg
    val Success = Color(0xFF4CC789)
    val SuccessSoft = Color(0xFF123427)
    val SuccessInk = Color(0xFFC7F2D9)

    val Warning = Color(0xFFE2A845)
    val WarningSoft = Color(0xFF3B2A0E)
    val WarningInk = Color(0xFFF9DBA6)

    val Danger = Color(0xFFE56A5E)
    val DangerSoft = Color(0xFF3A1B18)
    val DangerInk = Color(0xFFF7C7C1)

    val Info = Color(0xFF6E97F0)
    val InfoSoft = Color(0xFF162648)
    val InfoInk = Color(0xFFD5E0FB)

    // Surfaces
    val Surface = Color(0xFF1B2B4A)         // Ink800 as the raised card
    val SurfaceVariant = Color(0xFF2D3F5F)  // Ink700 as the "raised ink"
    val Background = Color(0xFF0F1C2E)      // Ink900 anchor
    val BorderSubtle = Color(0xFF3F5172)
}
