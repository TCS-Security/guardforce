package com.guardforce.guard.data.sync

import com.guardforce.guard.api.GuardApi
import com.guardforce.guard.api.PatrolPhoto
import com.guardforce.guard.api.Ping
import com.guardforce.guard.core.AppError
import com.guardforce.guard.core.AppJson
import com.guardforce.guard.core.GfLog
import com.guardforce.guard.data.db.AppDatabase
import com.guardforce.guard.data.db.OutboxEntity
import com.guardforce.guard.domain.LocalShiftView
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.io.File
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset

/**
 * Drains the outbox in order, then flushes pings. Network errors stop the run (WorkManager
 * retries); domain errors are resolved here so a stuck write never blocks the queue forever.
 */
class SyncEngine(private val db: AppDatabase, private val api: GuardApi) {
    private val mutex = Mutex()
    val lastSyncAt = MutableStateFlow(0L)
    val lastError = MutableStateFlow<String?>(null)
    /** Human-facing problems from permanent failures (shown as a toast). */
    val issues = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val syncing = MutableStateFlow(false)

    /** @return true when everything pending was sent. */
    suspend fun sync(): Boolean {
        if (!mutex.tryLock()) return false
        syncing.value = true
        try {
            processOutbox()
            flushPings()
            lastSyncAt.value = System.currentTimeMillis()
            lastError.value = null
            db.localShifts().prune(System.currentTimeMillis() - 3 * 86_400_000L)
            db.overrides().prune(System.currentTimeMillis() - 2 * 86_400_000L)
            return true
        } catch (e: AppError) {
            lastError.value = e.message
            GfLog.w("sync stopped: ${e.message}")
            return false
        } finally {
            syncing.value = false
            mutex.unlock()
        }
    }

    private suspend fun processOutbox() {
        while (true) {
            val op = db.outbox().nextPending() ?: return
            try {
                execute(op)
                db.outbox().delete(op.id)
            } catch (e: AppError) {
                if (e.isRetryable || e is AppError.Unauthorized) throw e
                GfLog.w("outbox ${op.kind}#${op.id} failed permanently: ${e.message}")
                if (!resolvePermanent(op, e)) {
                    db.outbox().update(op.copy(attempts = op.attempts + 1, lastError = e.message, blocked = true))
                }
            }
        }
    }

    private inline fun <reified T> payload(op: OutboxEntity): T = AppJson.decodeFromString(kotlinx.serialization.serializer<T>(), op.payload)

    private suspend fun upload(bucket: String, file: String, remotePath: String) {
        val f = File(file)
        if (!f.exists()) { GfLog.w("upload skipped, file gone: $file"); return }
        api.upload(bucket, remotePath, f.readBytes())
    }

    private suspend fun serverShiftId(shiftKey: String): String? = db.localShifts().get(shiftKey)?.serverId

    private suspend fun execute(op: OutboxEntity) {
        val now = System.currentTimeMillis()
        when (op.kind) {
            Kinds.CHECK_IN -> {
                val p = payload<CheckInPayload>(op)
                upload("selfies", p.selfieFile, p.selfieRemotePath)
                val res = api.checkIn(p.guardId, p.siteId, p.lat, p.lng, p.accuracyM, p.selfieRemotePath, p.capturedAt, p.device, p.shiftId)
                db.localShifts().resolve(p.shiftKey, res.id, LocalShiftView.ACTIVE, now)
            }
            Kinds.CHECK_OUT -> {
                val p = payload<CheckOutPayload>(op)
                val id = serverShiftId(p.shiftKey) ?: throw AppError.Rpc("SHIFT_NOT_FOUND", "no server shift for ${p.shiftKey}")
                flushPingsFor(p.shiftKey, id) // away-time needs every breadcrumb before check_out
                upload("selfies", p.selfieFile, p.selfieRemotePath)
                api.checkOut(id, p.lat, p.lng, p.accuracyM, p.selfieRemotePath, p.capturedAt, p.device)
                db.localShifts().setStatus(p.shiftKey, LocalShiftView.CLOSED, now)
            }
            Kinds.LOCATION_STATE -> {
                val p = payload<LocationStatePayload>(op)
                val id = serverShiftId(p.shiftKey) ?: return
                api.reportLocationState(id, p.enabled, p.at)
            }
            Kinds.PATROL_START -> { val p = payload<PatrolStartPayload>(op); api.startPatrol(p.patrolId, p.at) }
            Kinds.PATROL_COMPLETE -> {
                val p = payload<PatrolCompletePayload>(op)
                p.photos.forEach { upload("patrol-photos", it.file, it.remotePath) }
                val trail: JsonObject? = if (p.trail.size >= 2) buildJsonObject {
                    put("type", "LineString")
                    put("coordinates", buildJsonArray { p.trail.forEach { pt -> add(buildJsonArray { add(JsonPrimitive(pt[0])); add(JsonPrimitive(pt[1])) }) } })
                } else null
                api.completePatrol(p.patrolId, trail, p.photos.map { PatrolPhoto(it.remotePath, it.lat, it.lng, it.takenAt) }, p.at, p.notes)
                db.trail().delete(p.patrolId)
                db.overrides().delete("patrol", p.patrolId)
            }
            Kinds.TASK_START -> { val p = payload<TaskStartPayload>(op); api.startTask(p.taskId, p.at) }
            Kinds.TASK_COMPLETE -> {
                val p = payload<TaskCompletePayload>(op)
                p.photo?.let { upload("task-photos", it.file, it.remotePath) }
                api.completeTask(p.taskId, p.photo?.remotePath, p.note, p.lat, p.lng, p.at)
                db.overrides().delete("task", p.taskId)
            }
            Kinds.LEAVE_APPLY -> { val p = payload<LeaveApplyPayload>(op); api.applyLeave(p.type, p.start, p.end, p.reason) }
            Kinds.LEAVE_CANCEL -> { val p = payload<LeaveCancelPayload>(op); api.cancelLeave(p.id) }
            Kinds.REG_SELFIE -> {
                val p = payload<RegSelfiePayload>(op)
                upload("selfies", p.file, p.remotePath)
                api.setRegistrationSelfie(p.remotePath)
            }
            else -> GfLog.w("unknown outbox kind ${op.kind}")
        }
    }

    /** @return true when the op was dealt with and may be deleted. */
    private suspend fun resolvePermanent(op: OutboxEntity, e: AppError): Boolean {
        val code = (e as? AppError.Rpc)?.code ?: (e as? AppError.Http)?.code ?: "ERROR"
        val now = System.currentTimeMillis()
        when (op.kind) {
            Kinds.CHECK_IN -> {
                val p = payload<CheckInPayload>(op)
                when (code) {
                    "TAMPER_SUSPECTED" -> {
                        runCatching { api.reportTamper(p.guardId, p.siteId, p.lat, p.lng, "queued check-in rejected") }
                        issues.tryEmit("TAMPER_SUSPECTED")
                    }
                    "SHIFT_ALREADY_STARTED" -> {
                        // The server already has this shift running (double tap, retried request). Adopt it.
                        val home = runCatching { api.home() }.getOrNull()
                        val id = home?.active_shift_id
                        if (id != null) { db.localShifts().resolve(p.shiftKey, id, LocalShiftView.ACTIVE, now); db.outbox().delete(op.id); return true }
                    }
                    else -> issues.tryEmit(code)
                }
                db.localShifts().setStatus(p.shiftKey, LocalShiftView.FAILED, now)
                db.pings().deleteShift(p.shiftKey)
                db.outbox().delete(op.id)
                return true
            }
            Kinds.CHECK_OUT -> {
                val p = payload<CheckOutPayload>(op)
                db.localShifts().setStatus(p.shiftKey, LocalShiftView.CLOSED, now)
                if (code != "SHIFT_NOT_IN_PROGRESS") issues.tryEmit(code)
                db.outbox().delete(op.id)
                return true
            }
            Kinds.PATROL_COMPLETE -> { val p = payload<PatrolCompletePayload>(op); db.overrides().delete("patrol", p.patrolId); issues.tryEmit(code); db.outbox().delete(op.id); return true }
            Kinds.TASK_COMPLETE -> { val p = payload<TaskCompletePayload>(op); db.overrides().delete("task", p.taskId); issues.tryEmit(code); db.outbox().delete(op.id); return true }
            else -> { issues.tryEmit(code); db.outbox().delete(op.id); return true }
        }
    }

    suspend fun flushPings() {
        for (key in db.pings().shiftKeys()) {
            val shift = db.localShifts().get(key)
            when {
                shift == null || shift.status == LocalShiftView.FAILED -> db.pings().deleteShift(key)
                shift.serverId == null -> Unit // check-in not confirmed yet; keep buffering
                else -> flushPingsFor(key, shift.serverId)
            }
        }
    }

    private suspend fun flushPingsFor(key: String, serverId: String) {
        while (true) {
            val batch = db.pings().forShift(key, 200)
            if (batch.isEmpty()) return
            val pings = batch.map {
                Ping(
                    recorded_at = OffsetDateTime.ofInstant(Instant.ofEpochMilli(it.recordedAt), ZoneOffset.UTC).toString(),
                    lat = it.lat, lng = it.lng, accuracy_m = it.accuracyM, speed_mps = it.speedMps, battery_pct = it.batteryPct, is_mock = it.isMock,
                )
            }
            try {
                api.ingestPings(serverId, pings)
            } catch (e: AppError) {
                if (e.isRetryable || e is AppError.Unauthorized) throw e
                GfLog.w("pings rejected for $key: ${e.message}")
            }
            db.pings().delete(batch.map { it.id })
        }
    }
}
