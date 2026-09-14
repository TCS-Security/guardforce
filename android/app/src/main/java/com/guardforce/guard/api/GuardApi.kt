package com.guardforce.guard.api

import kotlinx.serialization.json.JsonObject

/**
 * The contract between the app and the backend. One implementation today
 * ([SupabaseGuardApi]); moving to an owned API later is a matter of a second implementation,
 * not a Play Store release of every screen.
 */
interface GuardApi {
    suspend fun me(): Me
    suspend fun home(): Home
    suspend fun claimAccount(): Me
    suspend fun setPin(pin: String)
    suspend fun verifyPin(pin: String): Boolean
    suspend fun setRegistrationSelfie(path: String)
    suspend fun registerDevice(installId: String, fcmToken: String?, model: String, osVersion: String, appVersion: String, bundleVersion: String)

    suspend fun upload(bucket: String, path: String, bytes: ByteArray, contentType: String = "image/jpeg")
    suspend fun signedUrl(bucket: String, path: String, expiresSec: Int = 600): String

    suspend fun checkIn(guardId: String, siteId: String, lat: Double, lng: Double, accuracyM: Float?, selfiePath: String, capturedAt: String, device: JsonObject, shiftId: String?): CheckInResult
    suspend fun checkOut(shiftId: String, lat: Double, lng: Double, accuracyM: Float?, selfiePath: String, capturedAt: String, device: JsonObject): CheckOutResult
    suspend fun ingestPings(shiftId: String, pings: List<Ping>): Int
    suspend fun reportLocationState(shiftId: String, enabled: Boolean, at: String)
    suspend fun reportTamper(guardId: String, siteId: String, lat: Double?, lng: Double?, detail: String?)

    suspend fun startPatrol(patrolId: String, at: String): PatrolInfo
    suspend fun completePatrol(patrolId: String, trail: JsonObject?, photos: List<PatrolPhoto>, at: String, notes: String?): PatrolInfo

    suspend fun startTask(taskId: String, at: String)
    suspend fun completeTask(taskId: String, photoPath: String?, note: String?, lat: Double?, lng: Double?, at: String)

    suspend fun applyLeave(type: String, startDate: String, endDate: String, reason: String?): LeaveRequest
    suspend fun cancelLeave(leaveId: String): LeaveRequest
    suspend fun listLeave(guardId: String): List<LeaveRequest>
    suspend fun leaveBalance(guardId: String, year: Int): LeaveBalance?

    suspend fun listShifts(guardId: String, fromDate: String, toDate: String): List<ShiftRecord>
    suspend fun listNotifications(guardId: String): List<NotificationItem>
    suspend fun markNotificationsRead(ids: List<String>)
}
