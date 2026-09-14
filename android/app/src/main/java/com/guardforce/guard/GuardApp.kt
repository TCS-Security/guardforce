package com.guardforce.guard

import android.app.Application
import androidx.work.Configuration
import com.guardforce.guard.data.sync.SyncScheduler
import com.guardforce.guard.tracking.Notifications

class GuardApp : Application(), Configuration.Provider {
    override fun onCreate() {
        super.onCreate()
        Graph.init(this)
        Notifications.ensureChannels(this)
        if (Graph.store.hasSession()) SyncScheduler.ensurePeriodic(this)
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder().setMinimumLoggingLevel(android.util.Log.INFO).build()
}
