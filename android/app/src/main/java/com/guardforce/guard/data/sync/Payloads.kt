package com.guardforce.guard.data.sync

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

object Kinds {
    const val CHECK_IN = "CHECK_IN"
    const val CHECK_OUT = "CHECK_OUT"
    const val LOCATION_STATE = "LOCATION_STATE"
    const val PATROL_START = "PATROL_START"
    const val PATROL_COMPLETE = "PATROL_COMPLETE"
    const val TASK_START = "TASK_START"
    const val TASK_COMPLETE = "TASK_COMPLETE"
    const val LEAVE_APPLY = "LEAVE_APPLY"
    const val LEAVE_CANCEL = "LEAVE_CANCEL"
    const val REG_SELFIE = "REG_SELFIE"
}

@Serializable data class LocalPhoto(val file: String, val remotePath: String, val lat: Double? = null, val lng: Double? = null, val takenAt: String)

@Serializable
data class CheckInPayload(
    val shiftKey: String, val guardId: String, val siteId: String,
    val lat: Double, val lng: Double, val accuracyM: Float?,
    val selfieFile: String, val selfieRemotePath: String, val capturedAt: String,
    val device: JsonObject, val shiftId: String? = null,
)

@Serializable
data class CheckOutPayload(
    val shiftKey: String, val lat: Double, val lng: Double, val accuracyM: Float?,
    val selfieFile: String, val selfieRemotePath: String, val capturedAt: String, val device: JsonObject,
)

@Serializable data class LocationStatePayload(val shiftKey: String, val enabled: Boolean, val at: String)
@Serializable data class PatrolStartPayload(val patrolId: String, val at: String)
@Serializable data class PatrolCompletePayload(val patrolId: String, val trail: List<List<Double>>, val photos: List<LocalPhoto>, val at: String, val notes: String? = null)
@Serializable data class TaskStartPayload(val taskId: String, val at: String)
@Serializable data class TaskCompletePayload(val taskId: String, val photo: LocalPhoto? = null, val note: String? = null, val lat: Double? = null, val lng: Double? = null, val at: String)
@Serializable data class LeaveApplyPayload(val type: String, val start: String, val end: String, val reason: String? = null)
@Serializable data class LeaveCancelPayload(val id: String)
@Serializable data class RegSelfiePayload(val file: String, val remotePath: String)
