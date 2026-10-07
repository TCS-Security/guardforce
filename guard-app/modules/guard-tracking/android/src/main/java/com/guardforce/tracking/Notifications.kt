package com.guardforce.tracking

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationCompat

object Notifications {
    const val CH_TRACKING = "gf_tracking"
    const val CH_ALERTS = "gf_alerts"
    const val ID_TRACKING = 1001
    const val ID_LOCATION_OFF = 1002

    fun ensureChannels(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CH_TRACKING, "Shift tracking", NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) })
        nm.createNotificationChannel(NotificationChannel(CH_ALERTS, "Alerts", NotificationManager.IMPORTANCE_HIGH).apply { enableVibration(true) })
    }

    private fun smallIcon(context: Context): Int {
        val id = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
        return if (id != 0) id else android.R.drawable.ic_menu_mylocation
    }

    private fun openApp(context: Context): PendingIntent {
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)?.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP) ?: Intent()
        return PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    fun tracking(context: Context, o: TrackingOptions, locationOff: Boolean): Notification =
        NotificationCompat.Builder(context, CH_TRACKING)
            .setSmallIcon(smallIcon(context))
            .setContentTitle(if (locationOff) o.text("trackingOffTitle", "Location is OFF — shift will not count") else o.text("trackingTitle", "On duty"))
            .setContentText(o.text("trackingBody", "Location is being recorded for your shift."))
            .setOngoing(true).setOnlyAlertOnce(true)
            .setColor(if (locationOff) 0xFFE84C23.toInt() else 0xFF375028.toInt())
            .setContentIntent(openApp(context))
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

    fun locationOff(context: Context, o: TrackingOptions) {
        val fix = PendingIntent.getActivity(context, 1, Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val body = o.text("locationOffBody", "Your shift is not being counted while location is off. Tap to fix.")
        val n = NotificationCompat.Builder(context, CH_ALERTS)
            .setSmallIcon(smallIcon(context))
            .setContentTitle(o.text("locationOffTitle", "Turn location back on"))
            .setContentText(body).setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX).setCategory(NotificationCompat.CATEGORY_ALARM)
            .setColor(0xFFE84C23.toInt()).setContentIntent(fix).setFullScreenIntent(openApp(context), true).setAutoCancel(true)
            .build()
        context.getSystemService(NotificationManager::class.java).notify(ID_LOCATION_OFF, n)
    }

    fun cancelLocationOff(context: Context) = context.getSystemService(NotificationManager::class.java).cancel(ID_LOCATION_OFF)
}
