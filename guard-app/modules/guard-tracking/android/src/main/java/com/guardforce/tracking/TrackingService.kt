package com.guardforce.tracking

import android.Manifest
import android.app.AlarmManager
import android.app.PendingIntent
import android.app.Service
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
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Foreground service for the shift (F5/LOC-1). Records every fix into [RecordStore], adapts the
 * cadence when the guard is still, watches the location toggle and warns every warnMin minutes
 * while it is off. Runs with or without the JS side; JS drains the store when it is alive.
 */
class TrackingService : Service() {
    companion object {
        const val ACTION_START = "com.guardforce.tracking.START"
        const val ACTION_STOP = "com.guardforce.tracking.STOP"
        const val EXTRA_OPTIONS = "options"

        @Volatile var running = false
        @Volatile var status = JSONObject()
        var listener: ((JSONObject) -> Unit)? = null

        fun start(context: Context, options: TrackingOptions) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return
            TrackingOptions.save(context, options)
            ContextCompat.startForegroundService(context, Intent(context, TrackingService::class.java).setAction(ACTION_START).putExtra(EXTRA_OPTIONS, options.json.toString()))
        }
        fun stop(context: Context) {
            TrackingOptions.save(context, null)
            TrackingOptions.setPatrol(context, null)
            runCatching { context.startService(Intent(context, TrackingService::class.java).setAction(ACTION_STOP)) }
        }
    }

    private lateinit var fused: FusedLocationProviderClient
    private lateinit var store: RecordStore
    private var options: TrackingOptions? = null
    private val handler = Handler(Looper.getMainLooper())
    private val recent = ArrayDeque<Triple<Double, Double, Float?>>()
    private var currentIntervalS = 0
    private var locationEnabled = true

    private val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) { result.lastLocation?.let { onFix(it) } }
    }
    private val providersReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) { checkLocationEnabled() }
    }
    private val watchdog = object : Runnable {
        override fun run() { checkLocationEnabled(); handler.postDelayed(this, 60_000) }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        fused = LocationServices.getFusedLocationProviderClient(this)
        store = RecordStore(this)
        Notifications.ensureChannels(this)
        registerReceiver(providersReceiver, IntentFilter().apply { addAction(LocationManager.PROVIDERS_CHANGED_ACTION); addAction(LocationManager.MODE_CHANGED_ACTION) })
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) { stopTracking(); return START_NOT_STICKY }
        val o = intent?.getStringExtra(EXTRA_OPTIONS)?.let { runCatching { TrackingOptions(JSONObject(it)) }.getOrNull() } ?: TrackingOptions.load(this)
        if (o == null) { stopSelf(); return START_NOT_STICKY }
        options = o
        startTracking(o)
        return START_STICKY
    }

    private fun startTracking(o: TrackingOptions) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) { stopSelf(); return }
        val n = Notifications.tracking(this, o, locationOff = !locationEnabled)
        if (Build.VERSION.SDK_INT >= 29) ServiceCompat.startForeground(this, Notifications.ID_TRACKING, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        else startForeground(Notifications.ID_TRACKING, n)
        running = true
        publish(JSONObject().put("tracking", true))
        requestUpdates(o.movingS)
        handler.removeCallbacks(watchdog); handler.postDelayed(watchdog, 60_000)
        checkLocationEnabled()
    }

    private fun requestUpdates(intervalS: Int) {
        if (intervalS == currentIntervalS) return
        currentIntervalS = intervalS
        val req = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, TimeUnit.SECONDS.toMillis(intervalS.toLong()))
            .setMinUpdateIntervalMillis(TimeUnit.SECONDS.toMillis((intervalS / 2).coerceAtLeast(15).toLong()))
            .setMaxUpdateDelayMillis(TimeUnit.SECONDS.toMillis(intervalS.toLong()))
            .setWaitForAccurateLocation(false).build()
        try {
            fused.removeLocationUpdates(callback)
            fused.requestLocationUpdates(req, callback, Looper.getMainLooper())
            publish(JSONObject().put("intervalS", intervalS))
        } catch (e: SecurityException) { stopTracking() }
    }

    private fun batteryPct(): Int? = runCatching { getSystemService(BatteryManager::class.java).getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY).takeIf { it in 0..100 } }.getOrNull()

    private fun nextIntervalS(o: TrackingOptions): Int {
        if (recent.size < 3) return o.movingS
        val w = recent.toList().takeLast(3)
        val slow = w.all { (it.third ?: 0f) < 0.7f }
        val anchor = w.first()
        val still = w.all { Geo.haversineM(anchor.first, anchor.second, it.first, it.second) <= 25.0 }
        return if (slow && still) o.stationaryS else o.movingS
    }

    private fun onFix(loc: Location) {
        val o = options ?: return
        val isMock = if (Build.VERSION.SDK_INT >= 31) loc.isMock else @Suppress("DEPRECATION") loc.isFromMockProvider
        val fence = o.fence
        val dist = fence?.let { Geo.distanceOutsideM(it, loc.latitude, loc.longitude) }
        val inFence = if (fence != null && dist != null) dist <= fence.leewayM else null
        val battery = batteryPct()
        val now = System.currentTimeMillis()
        val speed = if (loc.hasSpeed()) loc.speed else null
        val acc = if (loc.hasAccuracy()) loc.accuracy else null
        recent.addLast(Triple(loc.latitude, loc.longitude, speed)); while (recent.size > 6) recent.removeFirst()

        store.insert("ping", o.shiftKey, now, loc.latitude, loc.longitude, acc, speed, battery, isMock)
        TrackingOptions.patrol(this)?.let { store.insert("trail", o.shiftKey, now, loc.latitude, loc.longitude, acc, patrolId = it) }

        publish(JSONObject().put("tracking", true).put("lat", loc.latitude).put("lng", loc.longitude).put("accuracyM", acc ?: JSONObject.NULL)
            .put("inFence", inFence ?: JSONObject.NULL).put("distanceOutsideM", dist ?: JSONObject.NULL).put("batteryPct", battery ?: JSONObject.NULL)
            .put("lastFixMs", now).put("isMock", isMock).put("locationEnabled", true).put("pending", store.pendingCount()))
        if (!locationEnabled) checkLocationEnabled()
        requestUpdates(nextIntervalS(o))
    }

    private fun isLocationOn(): Boolean {
        val lm = getSystemService(LocationManager::class.java)
        val permitted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        return permitted && (if (Build.VERSION.SDK_INT >= 28) lm.isLocationEnabled else lm.isProviderEnabled(LocationManager.GPS_PROVIDER) || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER))
    }

    private fun checkLocationEnabled() {
        val o = options ?: return
        val on = isLocationOn()
        if (on == locationEnabled) return
        locationEnabled = on
        store.insert("location_state", o.shiftKey, System.currentTimeMillis(), enabled = on)
        getSystemService(android.app.NotificationManager::class.java).notify(Notifications.ID_TRACKING, Notifications.tracking(this, o, locationOff = !on))
        if (on) { Notifications.cancelLocationOff(this); LocationOffWarningReceiver.cancel(this) }
        else { Notifications.locationOff(this, o); LocationOffWarningReceiver.schedule(this, o.warnMin) }
        publish(JSONObject().put("locationEnabled", on).put("pending", store.pendingCount()))
    }

    private fun publish(patch: JSONObject) {
        val merged = JSONObject(status.toString())
        patch.keys().forEach { k -> merged.put(k, patch.get(k)) }
        status = merged
        listener?.invoke(merged)
    }

    private fun stopTracking() {
        handler.removeCallbacks(watchdog)
        runCatching { fused.removeLocationUpdates(callback) }
        // requestUpdates() is a no-op when the interval has not changed, so a stop that leaves
        // this set would make the next start on the same service instance record nothing.
        currentIntervalS = 0
        LocationOffWarningReceiver.cancel(this)
        Notifications.cancelLocationOff(this)
        running = false
        publish(JSONObject().put("tracking", false).put("intervalS", 0))
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        runCatching { unregisterReceiver(providersReceiver) }
        runCatching { fused.removeLocationUpdates(callback) }
        running = false
        super.onDestroy()
    }
}

/** Fires every warnMin minutes while location is off (LOC-1: "flashed every 30 minutes"). */
class LocationOffWarningReceiver : BroadcastReceiver() {
    companion object {
        private fun pending(context: Context) = PendingIntent.getBroadcast(context, 4242, Intent(context, LocationOffWarningReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        fun schedule(context: Context, minutes: Int) {
            context.getSystemService(AlarmManager::class.java).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + minutes * 60_000L, pending(context))
        }
        fun cancel(context: Context) { context.getSystemService(AlarmManager::class.java).cancel(pending(context)) }
    }
    override fun onReceive(context: Context, intent: Intent) {
        val o = TrackingOptions.load(context) ?: return
        val lm = context.getSystemService(LocationManager::class.java)
        val on = if (Build.VERSION.SDK_INT >= 28) lm.isLocationEnabled else lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
        if (!on) { Notifications.locationOff(context, o); schedule(context, o.warnMin) }
    }
}

/** Restarts tracking after a reboot or app update when a shift is still running on this phone. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val o = TrackingOptions.load(context) ?: return
        TrackingService.start(context, o)
    }
}
