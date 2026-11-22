package org.der.android.ui.settings

import android.content.Context
import android.content.Intent
import androidx.core.net.toUri
import org.der.android.CrashLogger

/**
 * Builds the "Send feedback" email intent — plain text body with
 * diagnostics the operator wouldn't type by hand, plus the last
 * crash log if one is on record. Keeps the pilot's feedback loop
 * one tap away from Settings.
 */
object FeedbackComposer {

    fun launch(
        context: Context,
        recipient: String = "support@der.example.org",
        appVersion: String,
        deviceId: String,
        userAgent: String,
        username: String?,
        pendingCaptures: Int,
        serverUrl: String,
    ) {
        val crash = CrashLogger.readLastCrash(context)
        val body = buildString {
            appendLine("DER Android — feedback")
            appendLine()
            appendLine("App version   : $appVersion")
            appendLine("Device ID     : $deviceId")
            appendLine("User agent    : $userAgent")
            appendLine("Signed in as  : ${username ?: "—"}")
            appendLine("Server URL    : $serverUrl")
            appendLine("Pending ops   : $pendingCaptures")
            if (crash != null) {
                appendLine()
                appendLine("── last crash ──")
                appendLine(crash)
            }
            appendLine()
            appendLine("── what happened ──")
            appendLine()
        }
        val uri = "mailto:$recipient".toUri().buildUpon()
            .appendQueryParameter("subject", "DER Android feedback — $appVersion")
            .appendQueryParameter("body", body)
            .build()
        val intent = Intent(Intent.ACTION_SENDTO, uri).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }
}
