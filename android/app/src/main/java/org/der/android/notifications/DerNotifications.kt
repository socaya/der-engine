package org.der.android.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.der.android.MainActivity

/**
 * Thin wrapper around [NotificationManagerCompat] for DER's two
 * operator-facing surfaces so each caller stops rebuilding
 * channels / intents / icons by hand. Channels are declared once
 * in [ensureChannels]; the Application class calls it on boot.
 */
object DerNotifications {

    private const val CHANNEL_PEER_HANDOFF = "peer_handoff"

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val mgr = context.getSystemService(NotificationManager::class.java) ?: return
        val channel = NotificationChannel(
            CHANNEL_PEER_HANDOFF,
            "Workflow handoffs",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "A nearby device handed a workflow step to this tablet."
        }
        mgr.createNotificationChannel(channel)
    }

    /**
     * Post a notification when a peer frame hands a workflow step
     * to this device. Tapping the notification deep-links back
     * into the DER app with the Workflow tile foregrounded.
     */
    fun postWorkflowHandoff(
        context: Context,
        fromDevice: String,
        runId: String?,
        stepId: String?,
    ) {
        val id = ((runId ?: "") + (stepId ?: "")).hashCode()

        val openIntent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra(EXTRA_ROUTE, "workflow")
        }
        val pi = PendingIntent.getActivity(
            context,
            id,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val body = buildString {
            append("From device ${fromDevice.take(8)}…")
            if (runId != null) append(" · case $runId")
        }
        val n = NotificationCompat.Builder(context, CHANNEL_PEER_HANDOFF)
            .setContentTitle("A workflow step is ready")
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_popup_sync)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()

        runCatching {
            NotificationManagerCompat.from(context).notify(id, n)
        }
    }

    const val EXTRA_ROUTE = "der.route"
}
