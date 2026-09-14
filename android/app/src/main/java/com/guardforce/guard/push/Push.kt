package com.guardforce.guard.push

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.guardforce.guard.Graph
import com.guardforce.guard.core.GfLog
import com.guardforce.guard.tracking.Notifications
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/** Registers this install (and its FCM token when Firebase is configured) in public.devices. */
object DeviceRegistrar {
    suspend fun register(context: Context) {
        if (!Graph.store.hasSession() || Graph.store.guardId == null) return
        val token = try {
            if (FirebaseApp.getApps(context).isEmpty() && FirebaseApp.initializeApp(context) == null) null
            else FirebaseMessaging.getInstance().token.await()
        } catch (e: Exception) {
            GfLog.d("FCM unavailable: ${e.message}"); null
        }
        Graph.repo.registerDevice(token)
    }
}

class GuardFcmService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        Graph.init(this)
        Graph.scope.launch(Dispatchers.IO) { Graph.repo.registerDevice(token) }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        Graph.init(this)
        val title = message.notification?.title ?: message.data["title"]
        val body = message.notification?.body ?: message.data["body"]
        Notifications.message(this, title, body)
        Graph.scope.launch(Dispatchers.IO) { Graph.repo.refreshHomeQuietly() }
    }
}
