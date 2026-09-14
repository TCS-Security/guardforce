package com.guardforce.guard.tracking

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationCompat
import com.guardforce.guard.MainActivity
import com.guardforce.guard.R

object Notifications {
    const val CH_TRACKING = "tracking"
    const val CH_ALERTS = "alerts"
    const val ID_TRACKING = 1001
    const val ID_LOCATION_OFF = 1002
    const val ID_PATROL_DUE = 1003
    const val ID_MESSAGE = 1004

    fun ensureChannels(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CH_TRACKING, context.getString(R.string.channel_tracking), NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) })
        nm.createNotificationChannel(NotificationChannel(CH_ALERTS, context.getString(R.string.channel_alerts), NotificationManager.IMPORTANCE_HIGH).apply { enableVibration(true) })
    }

    private fun openApp(context: Context): PendingIntent = PendingIntent.getActivity(
        context, 0, Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    fun tracking(context: Context, siteName: String, locationOff: Boolean): Notification =
        NotificationCompat.Builder(context, CH_TRACKING)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(if (locationOff) context.getString(R.string.notif_tracking_off) else context.getString(R.string.notif_tracking_title, siteName))
            .setContentText(context.getString(R.string.notif_tracking_body))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setColor(context.getColor(if (locationOff) R.color.signal else R.color.olive))
            .setContentIntent(openApp(context))
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

    fun locationOff(context: Context) {
        val fix = PendingIntent.getActivity(
            context, 1, Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val n = NotificationCompat.Builder(context, CH_ALERTS)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(context.getString(R.string.notif_location_off_title))
            .setContentText(context.getString(R.string.notif_location_off_body))
            .setStyle(NotificationCompat.BigTextStyle().bigText(context.getString(R.string.notif_location_off_body)))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setColor(context.getColor(R.color.signal))
            .setContentIntent(fix)
            .setFullScreenIntent(openApp(context), true)
            .setAutoCancel(true)
            .build()
        context.getSystemService(NotificationManager::class.java).notify(ID_LOCATION_OFF, n)
    }

    fun cancelLocationOff(context: Context) = context.getSystemService(NotificationManager::class.java).cancel(ID_LOCATION_OFF)

    fun patrolDue(context: Context, routeName: String) {
        val n = NotificationCompat.Builder(context, CH_ALERTS)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(context.getString(R.string.notif_patrol_due_title))
            .setContentText(context.getString(R.string.notif_patrol_due_body, routeName))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setColor(context.getColor(R.color.olive))
            .setContentIntent(openApp(context))
            .setAutoCancel(true)
            .build()
        context.getSystemService(NotificationManager::class.java).notify(ID_PATROL_DUE, n)
    }

    fun message(context: Context, title: String?, body: String?) {
        val n = NotificationCompat.Builder(context, CH_ALERTS)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title ?: context.getString(R.string.notif_message_title))
            .setContentText(body ?: "")
            .setStyle(NotificationCompat.BigTextStyle().bigText(body ?: ""))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setColor(context.getColor(R.color.olive))
            .setContentIntent(openApp(context))
            .setAutoCancel(true)
            .build()
        context.getSystemService(NotificationManager::class.java).notify(ID_MESSAGE + (System.currentTimeMillis() % 1000).toInt(), n)
    }
}
