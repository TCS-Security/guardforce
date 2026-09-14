package com.guardforce.guard.api

import com.guardforce.guard.core.AppJson
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.URLEncoder
import java.time.OffsetDateTime

class SupabaseGuardApi(private val http: SupabaseHttp) : GuardApi {

    private suspend fun rpc(name: String, params: JsonObject = JsonObject(emptyMap())): String =
        http.json("POST", "/rest/v1/rpc/$name", params.toString())

    private suspend fun <T> rpc(name: String, params: JsonObject, serializer: KSerializer<T>): T =
        AppJson.decodeFromString(serializer, rpc(name, params))

    private suspend fun <T> select(table: String, query: String, serializer: KSerializer<T>): List<T> =
        AppJson.decodeFromString(ListSerializer(serializer), http.json("GET", "/rest/v1/$table?$query"))

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    override suspend fun me(): Me = rpc("guard_me", JsonObject(emptyMap()), Me.serializer())
    override suspend fun home(): Home = rpc("guard_home", JsonObject(emptyMap()), Home.serializer())
    override suspend fun claimAccount(): Me = rpc("claim_guard_account", JsonObject(emptyMap()), Me.serializer())

    override suspend fun setPin(pin: String) { rpc("set_guard_pin", buildJsonObject { put("p_pin", pin) }) }
    override suspend fun verifyPin(pin: String): Boolean = rpc("verify_guard_pin", buildJsonObject { put("p_pin", pin) }).trim() == "true"
    override suspend fun setRegistrationSelfie(path: String) { rpc("set_registration_selfie", buildJsonObject { put("p_path", path) }) }

    override suspend fun registerDevice(installId: String, fcmToken: String?, model: String, osVersion: String, appVersion: String, bundleVersion: String) {
        rpc("register_device", buildJsonObject {
            put("p_install_id", installId); put("p_fcm_token", fcmToken); put("p_model", model)
            put("p_os_version", osVersion); put("p_app_version", appVersion); put("p_bundle_version", bundleVersion)
        })
    }

    override suspend fun upload(bucket: String, path: String, bytes: ByteArray, contentType: String) {
        http.call("POST", "/storage/v1/object/$bucket/$path", bytes.toRequestBody(contentType.toMediaType()), headers = mapOf("x-upsert" to "true"))
    }

    override suspend fun signedUrl(bucket: String, path: String, expiresSec: Int): String {
        val res = http.json("POST", "/storage/v1/object/sign/$bucket/$path", buildJsonObject { put("expiresIn", expiresSec) }.toString())
        val rel = AppJson.parseToJsonElement(res).jsonObject["signedURL"]!!.jsonPrimitive.content
        return http.url("/storage/v1" + (if (rel.startsWith("/")) rel else "/$rel"))
    }

    override suspend fun checkIn(guardId: String, siteId: String, lat: Double, lng: Double, accuracyM: Float?, selfiePath: String, capturedAt: String, device: JsonObject, shiftId: String?): CheckInResult =
        rpc("check_in", buildJsonObject {
            put("p_guard_id", guardId); put("p_site_id", siteId); put("p_lat", lat); put("p_lng", lng)
            put("p_accuracy_m", accuracyM); put("p_selfie_path", selfiePath); put("p_captured_at", capturedAt)
            put("p_device", device); put("p_shift_id", shiftId)
        }, CheckInResult.serializer())

    override suspend fun checkOut(shiftId: String, lat: Double, lng: Double, accuracyM: Float?, selfiePath: String, capturedAt: String, device: JsonObject): CheckOutResult =
        rpc("check_out", buildJsonObject {
            put("p_shift_id", shiftId); put("p_lat", lat); put("p_lng", lng); put("p_accuracy_m", accuracyM)
            put("p_selfie_path", selfiePath); put("p_captured_at", capturedAt); put("p_device", device)
        }, CheckOutResult.serializer())

    override suspend fun ingestPings(shiftId: String, pings: List<Ping>): Int {
        val arr = JsonArray(pings.map { AppJson.encodeToJsonElement(Ping.serializer(), it) })
        return rpc("ingest_pings", buildJsonObject { put("p_shift_id", shiftId); put("p_pings", arr) }).trim().toIntOrNull() ?: pings.size
    }

    override suspend fun reportLocationState(shiftId: String, enabled: Boolean, at: String) {
        rpc("report_location_state", buildJsonObject { put("p_shift_id", shiftId); put("p_enabled", enabled); put("p_at", at) })
    }

    override suspend fun reportTamper(guardId: String, siteId: String, lat: Double?, lng: Double?, detail: String?) {
        rpc("report_tamper", buildJsonObject { put("p_guard_id", guardId); put("p_site_id", siteId); put("p_lat", lat); put("p_lng", lng); put("p_detail", detail) })
    }

    override suspend fun startPatrol(patrolId: String, at: String): PatrolInfo =
        rpc("start_patrol", buildJsonObject { put("p_patrol_id", patrolId); put("p_at", at) }, PatrolInfo.serializer())

    override suspend fun completePatrol(patrolId: String, trail: JsonObject?, photos: List<PatrolPhoto>, at: String, notes: String?): PatrolInfo =
        rpc("complete_patrol", buildJsonObject {
            put("p_patrol_id", patrolId)
            put("p_trail", trail ?: JsonNull)
            put("p_photos", JsonArray(photos.map { AppJson.encodeToJsonElement(PatrolPhoto.serializer(), it) }))
            put("p_at", at); put("p_notes", notes)
        }, PatrolInfo.serializer())

    override suspend fun startTask(taskId: String, at: String) { rpc("start_task", buildJsonObject { put("p_task_id", taskId); put("p_at", at) }) }

    override suspend fun completeTask(taskId: String, photoPath: String?, note: String?, lat: Double?, lng: Double?, at: String) {
        rpc("complete_task", buildJsonObject {
            put("p_task_id", taskId); put("p_photo_path", photoPath); put("p_note", note); put("p_lat", lat); put("p_lng", lng); put("p_at", at)
        })
    }

    override suspend fun applyLeave(type: String, startDate: String, endDate: String, reason: String?): LeaveRequest =
        rpc("apply_leave", buildJsonObject { put("p_type", type); put("p_start", startDate); put("p_end", endDate); put("p_reason", reason) }, LeaveRequest.serializer())

    override suspend fun cancelLeave(leaveId: String): LeaveRequest =
        rpc("cancel_leave", buildJsonObject { put("p_leave_id", leaveId) }, LeaveRequest.serializer())

    override suspend fun listLeave(guardId: String): List<LeaveRequest> =
        select("leave_requests", "select=id,type,start_date,end_date,reason,status,decided_at,decision_note,created_at&guard_id=eq.$guardId&order=start_date.desc&limit=50", LeaveRequest.serializer())

    override suspend fun leaveBalance(guardId: String, year: Int): LeaveBalance? =
        select("leave_balances", "select=year,casual_total,earned_total,casual_used,earned_used,unpaid_used&guard_id=eq.$guardId&year=eq.$year", LeaveBalance.serializer()).firstOrNull()

    override suspend fun listShifts(guardId: String, fromDate: String, toDate: String): List<ShiftRecord> =
        select("shifts", "select=id,site_id,shift_date,scheduled_start,scheduled_end,status,attendance,started_at,ended_at,flags,trust,late_by_min,worked_minutes,away_seconds,sites(name)&guard_id=eq.$guardId&shift_date=gte.$fromDate&shift_date=lte.$toDate&order=shift_date.desc,scheduled_start.desc&limit=100", ShiftRecord.serializer())

    override suspend fun listNotifications(guardId: String): List<NotificationItem> =
        select("notifications", "select=id,title,body,created_at,read_at,payload&recipient_guard_id=eq.$guardId&order=created_at.desc&limit=50", NotificationItem.serializer())

    override suspend fun markNotificationsRead(ids: List<String>) {
        if (ids.isEmpty()) return
        val body = buildJsonObject { put("read_at", OffsetDateTime.now().toString()) }.toString()
        http.json("PATCH", "/rest/v1/notifications?id=in.(${enc(ids.joinToString(","))})", body, headers = mapOf("Prefer" to "return=minimal"))
    }
}
