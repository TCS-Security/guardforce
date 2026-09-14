package com.guardforce.guard.tracking

import android.Manifest
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationManager
import android.os.BatteryManager
import android.os.Build
import android.os.Looper
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.guardforce.guard.Graph
import com.guardforce.guard.core.GfLog
import com.guardforce.guard.data.db.PingEntity
import com.guardforce.guard.data.db.TrailPointEntity
import com.guardforce.guard.data.sync.SyncScheduler
import com.guardforce.guard.domain.Duty
import com.guardforce.guard.domain.Fix
import com.guardforce.guard.domain.Geo
import com.guardforce.guard.domain.PingPolicy
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/**
 * Foreground service for the shift (F5): fused location at the agency's cadence, every fix
 * written to Room, flushed in batches. Watches the location toggle and reports it (LOC-1),
 * warning the guard every location_off_warn_min minutes until it is back on.
 */
class TrackingService : LifecycleService() {
    companion object {
        const val ACTION_START = "com.guardforce.guard.tracking.START"
        const val ACTION_STOP = "com.guardforce.guard.tracking.STOP"
        const val ACTION_PATROL = "com.guardforce.guard.tracking.PATROL"
        const val EXTRA_PATROL_ID = "patrol_id"

        @Volatile var activePatrolId: String? = null

        fun start(context: Context) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return
            ContextCompat.startForegroundService(context, Intent(context, TrackingService::class.java).setAction(ACTION_START))
        }
        fun stop(context: Context) {
            activePatrolId = null
            runCatching { context.startService(Intent(context, TrackingService::class.java).setAction(ACTION_STOP)) }
        }
        fun setPatrol(context: Context, patrolId: String?) {
            activePatrolId = patrolId
        }
    }

    private lateinit var fused: FusedLocationProviderClient
    private val recent = ArrayDeque<Fix>()
    private var policy = PingPolicy(Graph.repo.pingConfig())
    private var currentIntervalS = 0
    private var pendingSinceFlush = 0
    private var lastFlushMs = System.currentTimeMillis()
    private var locationEnabled = true
    private var watchdog: Job? = null
    private val notifiedPatrols = HashSet<String>()

    private val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            result.lastLocation?.let { onFix(it) }
        }
    }

    private val providersReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) { checkLocationEnabled() }
    }

    override fun onCreate() {
        super.onCreate()
        fused = LocationServices.getFusedLocationProviderClient(this)
        registerReceiver(providersReceiver, IntentFilter().apply {
            addAction(LocationManager.PROVIDERS_CHANGED_ACTION)
            addAction(LocationManager.MODE_CHANGED_ACTION)
        })
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        when (intent?.action) {
            ACTION_STOP -> { stopTracking(); return START_NOT_STICKY }
            else -> startTracking()
        }
        return START_STICKY
    }

    private fun siteName() = Graph.repo.me.value?.site?.name ?: ""

    private fun startTracking() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) { stopSelf(); return }
        val notification = Notifications.tracking(this, siteName(), locationOff = !locationEnabled)
        if (Build.VERSION.SDK_INT >= 29) {
            ServiceCompat.startForeground(this, Notifications.ID_TRACKING, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(Notifications.ID_TRACKING, notification)
        }
        LiveStatus.flow.value = LiveStatus.flow.value.copy(tracking = true)
        policy = PingPolicy(Graph.repo.pingConfig())
        requestUpdates(policy.nextIntervalS(recent.toList()))
        checkLocationEnabled()
        watchdog?.cancel()
        watchdog = lifecycleScope.launch {
            while (isActive) {
                delay(60_000)
                // No local shift any more (checked out elsewhere, sign-out): stand down.
                val local = Graph.repo.currentLocalShift()
                if (local == null) { stopTracking(); return@launch }
                checkLocationEnabled()
                remindDuePatrols()
                val since = (System.currentTimeMillis() - lastFlushMs) / 1000
                if (policy.shouldFlush(pendingSinceFlush, since)) flush()
            }
        }
    }

    private fun requestUpdates(intervalS: Int) {
        if (intervalS == currentIntervalS) return
        currentIntervalS = intervalS
        val req = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, TimeUnit.SECONDS.toMillis(intervalS.toLong()))
            .setMinUpdateIntervalMillis(TimeUnit.SECONDS.toMillis((intervalS / 2).coerceAtLeast(15).toLong()))
            .setMaxUpdateDelayMillis(TimeUnit.SECONDS.toMillis(intervalS.toLong()))
            .setWaitForAccurateLocation(false)
            .build()
        try {
            fused.removeLocationUpdates(callback)
            fused.requestLocationUpdates(req, callback, Looper.getMainLooper())
            LiveStatus.flow.value = LiveStatus.flow.value.copy(intervalS = intervalS)
        } catch (e: SecurityException) {
            GfLog.w("location permission lost", e); stopTracking()
        }
    }

    private fun batteryPct(): Int? = runCatching {
        getSystemService(BatteryManager::class.java).getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY).takeIf { it in 0..100 }
    }.getOrNull()

    private fun onFix(loc: Location) {
        val isMock = if (Build.VERSION.SDK_INT >= 31) loc.isMock else @Suppress("DEPRECATION") loc.isFromMockProvider
        val fence = Graph.repo.fence()
        val dist = fence?.let { Geo.distanceOutsideM(it, loc.latitude, loc.longitude) }
        val inFence = fence?.let { dist!! <= it.leewayM }
        val battery = batteryPct()
        val now = System.currentTimeMillis()
        recent.addLast(Fix(loc.latitude, loc.longitude, if (loc.hasSpeed()) loc.speed else null, now))
        while (recent.size > 6) recent.removeFirst()

        LiveStatus.flow.value = LiveStatus.flow.value.copy(
            tracking = true, lat = loc.latitude, lng = loc.longitude, accuracyM = if (loc.hasAccuracy()) loc.accuracy else null,
            inFence = inFence, distanceOutsideM = dist, batteryPct = battery, lastFixMs = now, isMock = isMock, locationEnabled = true,
        )

        lifecycleScope.launch(Dispatchers.IO) {
            val local = Graph.repo.currentLocalShift() ?: return@launch
            Graph.db.pings().insert(PingEntity(shiftKey = local.key, recordedAt = now, lat = loc.latitude, lng = loc.longitude,
                accuracyM = if (loc.hasAccuracy()) loc.accuracy else null, speedMps = if (loc.hasSpeed()) loc.speed else null, batteryPct = battery, isMock = isMock))
            activePatrolId?.let { Graph.db.trail().insert(TrailPointEntity(patrolId = it, atMs = now, lat = loc.latitude, lng = loc.longitude)) }
            pendingSinceFlush++
            if (policy.shouldFlush(pendingSinceFlush, (now - lastFlushMs) / 1000)) flush()
        }
        if (!locationEnabled) checkLocationEnabled()
        requestUpdates(policy.nextIntervalS(recent.toList()))
    }

    private suspend fun flush() {
        pendingSinceFlush = 0
        lastFlushMs = System.currentTimeMillis()
        val ok = withContext(Dispatchers.IO) { runCatching { Graph.sync.sync() }.getOrDefault(false) }
        if (!ok) SyncScheduler.kickNow(this)
    }

    private fun isLocationOn(): Boolean {
        val lm = getSystemService(LocationManager::class.java)
        val permitted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        return permitted && (if (Build.VERSION.SDK_INT >= 28) lm.isLocationEnabled else lm.isProviderEnabled(LocationManager.GPS_PROVIDER) || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER))
    }

    private fun checkLocationEnabled() {
        val on = isLocationOn()
        if (on == locationEnabled) return
        locationEnabled = on
        LiveStatus.flow.value = LiveStatus.flow.value.copy(locationEnabled = on)
        lifecycleScope.launch(Dispatchers.IO) { Graph.repo.reportLocationState(on) }
        val nm = getSystemService(android.app.NotificationManager::class.java)
        nm.notify(Notifications.ID_TRACKING, Notifications.tracking(this, siteName(), locationOff = !on))
        if (on) {
            Notifications.cancelLocationOff(this)
            LocationOffWarningReceiver.cancel(this)
        } else {
            Notifications.locationOff(this)
            val warnMin = Graph.repo.me.value?.agency?.location_off_warn_min ?: 30
            LocationOffWarningReceiver.schedule(this, warnMin)
        }
    }

    private fun remindDuePatrols() {
        val home = Graph.repo.home.value ?: return
        val now = System.currentTimeMillis()
        home.patrols.filter { it.status == "scheduled" && it.id !in notifiedPatrols }.forEach { p ->
            val due = Duty.parse(p.expected_at)?.toEpochMilli() ?: return@forEach
            if (now >= due && now - due < 10 * 60_000) {
                notifiedPatrols += p.id
                Notifications.patrolDue(this, p.route_name ?: "Patrol")
            }
        }
    }

    private fun stopTracking() {
        watchdog?.cancel()
        runCatching { fused.removeLocationUpdates(callback) }
        LocationOffWarningReceiver.cancel(this)
        Notifications.cancelLocationOff(this)
        LiveStatus.flow.value = LiveStatus.flow.value.copy(tracking = false, intervalS = 0)
        lifecycleScope.launch(Dispatchers.IO) { runCatching { Graph.sync.sync() }; SyncScheduler.kickNow(this@TrackingService) }
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        runCatching { unregisterReceiver(providersReceiver) }
        runCatching { fused.removeLocationUpdates(callback) }
        super.onDestroy()
    }
}

/** Fires every location_off_warn_min minutes while location is off (LOC-1 "flashed every 30 minutes"). */
class LocationOffWarningReceiver : BroadcastReceiver() {
    companion object {
        private const val REQ = 4242
        private fun pending(context: Context) = PendingIntent.getBroadcast(
            context, REQ, Intent(context, LocationOffWarningReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        fun schedule(context: Context, minutes: Int) {
            val am = context.getSystemService(AlarmManager::class.java)
            val at = System.currentTimeMillis() + minutes.coerceAtLeast(1) * 60_000L
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(context))
        }
        fun cancel(context: Context) { context.getSystemService(AlarmManager::class.java).cancel(pending(context)) }
    }

    override fun onReceive(context: Context, intent: Intent) {
        Graph.init(context)
        val lm = context.getSystemService(LocationManager::class.java)
        val on = if (Build.VERSION.SDK_INT >= 28) lm.isLocationEnabled else lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
        if (!on && LiveStatus.flow.value.tracking) {
            Notifications.locationOff(context)
            schedule(context, Graph.repo.me.value?.agency?.location_off_warn_min ?: 30)
        }
    }
}

/** Restarts tracking after a reboot or app update when a shift is still running on this phone. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Graph.init(context)
        val result = goAsync()
        Graph.scope.launch {
            try {
                if (Graph.store.hasSession() && Graph.repo.currentLocalShift() != null) TrackingService.start(context)
                if (Graph.store.hasSession()) SyncScheduler.ensurePeriodic(context)
            } finally { result.finish() }
        }
    }
}
