package com.guardforce.guard.data

import android.content.Context
import android.os.Build
import com.guardforce.guard.BuildConfig
import com.guardforce.guard.api.GuardApi
import com.guardforce.guard.api.Home
import com.guardforce.guard.api.LeaveBalance
import com.guardforce.guard.api.LeaveRequest
import com.guardforce.guard.api.Me
import com.guardforce.guard.api.NotificationItem
import com.guardforce.guard.api.ShiftInfo
import com.guardforce.guard.api.ShiftRecord
import com.guardforce.guard.auth.SessionStore
import com.guardforce.guard.core.AppError
import com.guardforce.guard.core.AppJson
import com.guardforce.guard.core.GfLog
import com.guardforce.guard.data.db.AppDatabase
import com.guardforce.guard.data.db.CacheEntity
import com.guardforce.guard.data.db.LocalShiftEntity
import com.guardforce.guard.data.db.OutboxEntity
import com.guardforce.guard.data.db.OverrideEntity
import com.guardforce.guard.data.sync.CheckInPayload
import com.guardforce.guard.data.sync.CheckOutPayload
import com.guardforce.guard.data.sync.Kinds
import com.guardforce.guard.data.sync.LeaveApplyPayload
import com.guardforce.guard.data.sync.LeaveCancelPayload
import com.guardforce.guard.data.sync.LocalPhoto
import com.guardforce.guard.data.sync.LocationStatePayload
import com.guardforce.guard.data.sync.PatrolCompletePayload
import com.guardforce.guard.data.sync.PatrolStartPayload
import com.guardforce.guard.data.sync.RegSelfiePayload
import com.guardforce.guard.data.sync.SyncEngine
import com.guardforce.guard.data.sync.SyncScheduler
import com.guardforce.guard.data.sync.TaskCompletePayload
import com.guardforce.guard.data.sync.TaskStartPayload
import com.guardforce.guard.domain.Duty
import com.guardforce.guard.domain.DutyState
import com.guardforce.guard.domain.FenceSpec
import com.guardforce.guard.domain.LocalShiftView
import com.guardforce.guard.domain.PingConfig
import com.guardforce.guard.domain.TimeText
import com.guardforce.guard.tracking.TrackingService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.io.File
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID

/** The app's single source of truth: cached server state + the local shift + queued writes. */
class GuardRepository(
    private val context: Context,
    private val db: AppDatabase,
    private val api: GuardApi,
    private val store: SessionStore,
    private val sync: SyncEngine,
    private val scope: CoroutineScope,
) {
    val me = MutableStateFlow<Me?>(null)
    val home = MutableStateFlow<Home?>(null)
    val online = MutableStateFlow(true)
    val loadedFromCache = MutableStateFlow(false)

    val localShift: Flow<LocalShiftEntity?> = db.localShifts().currentFlow()
    val pendingOps: Flow<Int> = db.outbox().countFlow()
    val pendingPings: Flow<Int> = db.pings().countFlow()
    val patrolOverrides: Flow<List<OverrideEntity>> = db.overrides().flow("patrol")
    val taskOverrides: Flow<List<OverrideEntity>> = db.overrides().flow("task")

    init {
        scope.launch(Dispatchers.IO) {
            db.cache().get("me")?.let { me.value = decode(Me.serializer(), it.json) }
            db.cache().get("home")?.let { home.value = decode(Home.serializer(), it.json) }
            loadedFromCache.value = true
        }
    }

    private fun <T> decode(s: KSerializer<T>, json: String): T? = runCatching { AppJson.decodeFromString(s, json) }.getOrNull()

    val zone: ZoneId get() = runCatching { ZoneId.of(me.value?.agency?.timezone ?: "Asia/Kolkata") }.getOrDefault(ZoneId.of("Asia/Kolkata"))
    fun timeText() = TimeText(zone)

    fun pingConfig(): PingConfig {
        val c = me.value?.config ?: return PingConfig()
        return PingConfig(c.ping_interval_moving_s.coerceIn(30, 1800), c.ping_interval_stationary_s.coerceIn(60, 3600))
    }

    fun feature(key: String, default: Boolean = true): Boolean =
        (me.value?.config?.features?.get(key) as? JsonPrimitive)?.booleanOrNull ?: default

    fun fence(): FenceSpec? {
        val s = me.value?.site ?: return null
        val ring = runCatching {
            s.polygon?.jsonObject?.get("coordinates")?.jsonArray?.firstOrNull()?.jsonArray?.map { pt ->
                val a = pt.jsonArray; Pair(a[0].jsonPrimitive.doubleOrNull ?: 0.0, a[1].jsonPrimitive.doubleOrNull ?: 0.0)
            }
        }.getOrNull()
        return FenceSpec(s.fence_type, s.lat, s.lng, s.radius_m, ring, s.leeway_m)
    }

    // --- reads ------------------------------------------------------------------------------

    suspend fun refreshMe(): Me? = try {
        val m = api.me()
        me.value = m
        store.guardId = m.guard.id; store.agencyId = m.guard.agency_id; store.guardName = m.guard.full_name
        db.cache().put(CacheEntity("me", AppJson.encodeToString(Me.serializer(), m), System.currentTimeMillis()))
        online.value = true
        m
    } catch (e: AppError.Network) { online.value = false; me.value }

    suspend fun refreshHome(): Home? = try {
        val h = api.home()
        home.value = h
        db.cache().put(CacheEntity("home", AppJson.encodeToString(Home.serializer(), h), System.currentTimeMillis()))
        online.value = true
        reconcileLocalShift(h)
        h
    } catch (e: AppError.Network) { online.value = false; home.value }

    suspend fun refreshHomeQuietly() { runCatching { refreshHome() } }

    suspend fun refreshAll() { refreshMe(); refreshHome() }

    /** The server is the truth about which shift is running; align the local record with it. */
    private suspend fun reconcileLocalShift(h: Home) {
        val local = db.localShifts().current() ?: run {
            // The server says on duty (e.g. app reinstalled mid-shift): adopt it so tracking resumes.
            val active = h.active_shift_id?.let { id -> h.shifts.firstOrNull { it.id == id } }
            if (active != null) {
                val since = Duty.parse(active.start_captured_at ?: active.started_at)?.toEpochMilli() ?: System.currentTimeMillis()
                db.localShifts().upsert(LocalShiftEntity("srv-${active.id}", active.id, active.site_id, store.guardId ?: "", since, LocalShiftView.ACTIVE, System.currentTimeMillis()))
                TrackingService.start(context)
            }
            return
        }
        if (local.serverId != null && local.status == LocalShiftView.ACTIVE && h.active_shift_id != local.serverId) {
            val srv = h.shifts.firstOrNull { it.id == local.serverId }
            if (srv != null && srv.status != "in_progress") {
                // Ended from the dashboard (correction / exception) — stop tracking.
                db.localShifts().setStatus(local.key, LocalShiftView.CLOSED, System.currentTimeMillis())
                TrackingService.stop(context)
            }
        }
    }

    suspend fun dutyState(now: Instant = Instant.now()): DutyState {
        val local = db.localShifts().current()?.let { LocalShiftView(it.key, it.serverId, it.siteId, it.startedAtMs, it.status) }
        val h = home.value
        return Duty.state(h?.shifts ?: emptyList(), h?.active_shift_id, local, me.value?.guard?.site_id, now)
    }

    suspend fun currentLocalShift(): LocalShiftEntity? = db.localShifts().current()

    suspend fun listShifts(days: Int = 30): List<ShiftRecord> {
        val gid = store.guardId ?: return emptyList()
        val t = timeText()
        val to = t.todayIso()
        val from = java.time.LocalDate.parse(to).minusDays(days.toLong()).toString()
        return api.listShifts(gid, from, to)
    }

    suspend fun listLeave(): List<LeaveRequest> = api.listLeave(store.guardId ?: return emptyList())
    suspend fun leaveBalance(): LeaveBalance? = api.leaveBalance(store.guardId ?: return null, java.time.LocalDate.now(zone).year)
    suspend fun listNotifications(): List<NotificationItem> = api.listNotifications(store.guardId ?: return emptyList())
    suspend fun markRead(ids: List<String>) = api.markNotificationsRead(ids)
    suspend fun signedUrl(bucket: String, path: String) = api.signedUrl(bucket, path)

    // --- writes (all through the outbox) -----------------------------------------------------

    private suspend fun enqueue(kind: String, payloadJson: String) {
        db.outbox().insert(OutboxEntity(kind = kind, payload = payloadJson, createdAt = System.currentTimeMillis()))
        SyncScheduler.kickNow(context)
        scope.launch(Dispatchers.IO) { if (online.value) runCatching { sync.sync(); refreshHomeQuietly() } }
    }

    private val stamp = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss", Locale.ENGLISH)
    private fun stampNow() = Instant.now().atZone(zone).format(stamp)
    private fun agency() = store.agencyId ?: me.value?.guard?.agency_id ?: "unknown"
    private fun guard() = store.guardId ?: me.value?.guard?.id ?: "unknown"

    fun deviceJson(batteryPct: Int?, isMock: Boolean): JsonObject = buildJsonObject {
        put("battery_pct", batteryPct)
        put("model", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
        put("os", "Android ${Build.VERSION.RELEASE}")
        put("app_version", BuildConfig.VERSION_NAME)
        put("is_mock", isMock)
    }

    /** Queues the check-in, records the local shift and starts tracking. Returns the local shift key. */
    suspend fun checkIn(selfieFile: File, lat: Double, lng: Double, accuracyM: Float?, batteryPct: Int?, isMock: Boolean, shift: ShiftInfo?): String {
        val siteId = shift?.site_id ?: me.value?.guard?.site_id ?: throw IllegalStateException("no site")
        val key = "loc-" + UUID.randomUUID().toString().take(8)
        val now = System.currentTimeMillis()
        val remote = "${agency()}/selfies/${guard()}/${stampNow()}-start.jpg"
        db.localShifts().upsert(LocalShiftEntity(key, null, siteId, guard(), now, LocalShiftView.PENDING_CHECK_IN, now))
        val p = CheckInPayload(key, guard(), siteId, lat, lng, accuracyM, selfieFile.absolutePath, remote, timeText().isoAt(now), deviceJson(batteryPct, isMock), shift?.id)
        enqueue(Kinds.CHECK_IN, AppJson.encodeToString(CheckInPayload.serializer(), p))
        TrackingService.start(context)
        return key
    }

    suspend fun checkOut(selfieFile: File, lat: Double, lng: Double, accuracyM: Float?, batteryPct: Int?, isMock: Boolean) {
        val local = db.localShifts().current() ?: return
        val now = System.currentTimeMillis()
        val remote = "${agency()}/selfies/${guard()}/${stampNow()}-end.jpg"
        TrackingService.stop(context)
        db.localShifts().setStatus(local.key, LocalShiftView.PENDING_CHECK_OUT, now)
        val p = CheckOutPayload(local.key, lat, lng, accuracyM, selfieFile.absolutePath, remote, timeText().isoAt(now), deviceJson(batteryPct, isMock))
        enqueue(Kinds.CHECK_OUT, AppJson.encodeToString(CheckOutPayload.serializer(), p))
    }

    suspend fun reportLocationState(enabled: Boolean) {
        val local = db.localShifts().current() ?: return
        val p = LocationStatePayload(local.key, enabled, timeText().nowIso())
        enqueue(Kinds.LOCATION_STATE, AppJson.encodeToString(LocationStatePayload.serializer(), p))
    }

    suspend fun startPatrol(patrolId: String) {
        val now = System.currentTimeMillis()
        db.overrides().put(OverrideEntity("patrol", patrolId, "in_progress", now))
        enqueue(Kinds.PATROL_START, AppJson.encodeToString(PatrolStartPayload.serializer(), PatrolStartPayload(patrolId, timeText().isoAt(now))))
    }

    suspend fun completePatrol(patrolId: String, photos: List<LocalPhoto>, notes: String?) {
        val now = System.currentTimeMillis()
        val trail = db.trail().forPatrol(patrolId).map { listOf(it.lng, it.lat) }
        db.overrides().put(OverrideEntity("patrol", patrolId, "completed", now))
        val p = PatrolCompletePayload(patrolId, trail, photos, timeText().isoAt(now), notes?.takeIf { it.isNotBlank() })
        enqueue(Kinds.PATROL_COMPLETE, AppJson.encodeToString(PatrolCompletePayload.serializer(), p))
    }

    fun patrolPhotoPath(patrolId: String) = "${agency()}/patrols/$patrolId/${stampNow()}-${UUID.randomUUID().toString().take(6)}.jpg"
    fun taskPhotoPath(taskId: String) = "${agency()}/tasks/$taskId/${guard()}-${stampNow()}.jpg"
    fun registrationSelfiePath() = "${agency()}/selfies/reg/${guard()}.jpg"

    suspend fun startTask(taskId: String) {
        val now = System.currentTimeMillis()
        db.overrides().put(OverrideEntity("task", taskId, "in_progress", now))
        enqueue(Kinds.TASK_START, AppJson.encodeToString(TaskStartPayload.serializer(), TaskStartPayload(taskId, timeText().isoAt(now))))
    }

    suspend fun completeTask(taskId: String, photo: LocalPhoto?, note: String?, lat: Double?, lng: Double?) {
        val now = System.currentTimeMillis()
        db.overrides().put(OverrideEntity("task", taskId, "done", now))
        val p = TaskCompletePayload(taskId, photo, note?.takeIf { it.isNotBlank() }, lat, lng, timeText().isoAt(now))
        enqueue(Kinds.TASK_COMPLETE, AppJson.encodeToString(TaskCompletePayload.serializer(), p))
    }

    /** Leave goes straight to the server when online so the guard sees the real outcome; queued otherwise. */
    suspend fun applyLeave(type: String, start: String, end: String, reason: String?): Boolean {
        return try {
            api.applyLeave(type, start, end, reason); true
        } catch (e: AppError.Network) {
            enqueue(Kinds.LEAVE_APPLY, AppJson.encodeToString(LeaveApplyPayload.serializer(), LeaveApplyPayload(type, start, end, reason))); false
        }
    }

    suspend fun cancelLeave(id: String) {
        try { api.cancelLeave(id) } catch (e: AppError.Network) {
            enqueue(Kinds.LEAVE_CANCEL, AppJson.encodeToString(LeaveCancelPayload.serializer(), LeaveCancelPayload(id)))
        }
    }

    suspend fun setRegistrationSelfie(file: File) {
        val remote = registrationSelfiePath()
        enqueue(Kinds.REG_SELFIE, AppJson.encodeToString(RegSelfiePayload.serializer(), RegSelfiePayload(file.absolutePath, remote)))
        me.value?.let { me.value = it.copy(guard = it.guard.copy(registration_selfie_path = remote)) }
    }

    suspend fun registerDevice(fcmToken: String?) {
        runCatching {
            api.registerDevice(store.installId, fcmToken, "${Build.MANUFACTURER} ${Build.MODEL}".trim(), "Android ${Build.VERSION.RELEASE}", BuildConfig.VERSION_NAME, BuildConfig.OTA_CHANNEL)
        }.onFailure { GfLog.w("register_device failed: ${it.message}") }
    }

    suspend fun clearAll() {
        TrackingService.stop(context)
        SyncScheduler.cancelAll(context)
        db.wipe()
        me.value = null; home.value = null
        context.filesDir.resolve("media").deleteRecursively()
    }
}
