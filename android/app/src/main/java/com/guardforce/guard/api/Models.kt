package com.guardforce.guard.api

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

// Shapes returned by guard_me() / guard_home() (supabase/migrations/0011_guard_app.sql) and by
// direct table reads under RLS. Field names are the SQL column names on purpose.

@Serializable
data class Me(
    val guard: GuardInfo,
    val kyc_missing: List<String> = emptyList(),
    val documents: List<DocInfo> = emptyList(),
    val supervisor: SupervisorInfo? = null,
    val site: SiteInfo? = null,
    val agency: AgencyInfo,
    val config: AppConfig? = null,
    val server_time: String? = null,
)

@Serializable
data class GuardInfo(
    val id: String,
    val agency_id: String,
    val employee_code: String? = null,
    val full_name: String,
    val phone: String,
    val designation: String? = null,
    val site_id: String? = null,
    val status: String = "active",
    val registration_selfie_path: String? = null,
    val has_pin: Boolean = false,
    val languages: List<String> = emptyList(),
    val joined_at: String? = null,
    val phone_verified_at: String? = null,
)

@Serializable data class DocInfo(val type: String, val status: String, val has_file: Boolean = false)
@Serializable data class SupervisorInfo(val name: String, val phone: String? = null)

@Serializable
data class SiteInfo(
    val id: String,
    val name: String,
    val client_name: String? = null,
    val address: String? = null,
    val lat: Double,
    val lng: Double,
    val fence_type: String = "radius",
    val radius_m: Int = 150,
    val polygon: JsonElement? = null,
    val leeway_m: Int = 50,
    val patrol_photo_required: Boolean = true,
)

@Serializable
data class AgencyInfo(
    val id: String,
    val name: String,
    val status: String = "active",
    val timezone: String = "Asia/Kolkata",
    val late_threshold_min: Int = 15,
    val location_off_warn_min: Int = 30,
    val outage_threshold_min: Int = 10,
)

@Serializable
data class AppConfig(
    val min_app_version: String = "1.0.0",
    val ota_channel: String = "production",
    val ping_interval_moving_s: Int = 120,
    val ping_interval_stationary_s: Int = 900,
    val selfie_max_kb: Int = 120,
    val photo_max_kb: Int = 250,
    val features: JsonObject = JsonObject(emptyMap()),
)

@Serializable
data class Home(
    val today: String,
    val server_time: String? = null,
    val active_shift_id: String? = null,
    val shifts: List<ShiftInfo> = emptyList(),
    val patrols: List<PatrolInfo> = emptyList(),
    val tasks: List<TaskInfo> = emptyList(),
    val unread_notifications: Int = 0,
)

@Serializable
data class ShiftInfo(
    val id: String,
    val site_id: String,
    val site_name: String? = null,
    val shift_date: String,
    val scheduled_start: String? = null,
    val scheduled_end: String? = null,
    val status: String = "scheduled",
    val attendance: String = "pending",
    val started_at: String? = null,
    val start_captured_at: String? = null,
    val ended_at: String? = null,
    val flags: List<String> = emptyList(),
    val trust: String? = null,
    val late_by_min: Int = 0,
    val worked_minutes: Int = 0,
    val away_seconds: Int = 0,
    val location_enabled: Boolean = true,
    val location_off_seconds: Int = 0,
    val has_exception: Boolean = false,
    val shift_type: String? = null,
)

@Serializable
data class PatrolInfo(
    val id: String,
    val route_id: String? = null,
    val route_name: String? = null,
    val min_photos: Int = 1,
    val frequency_min: Int? = null,
    val grace_min: Int? = null,
    val expected_at: String? = null,
    val started_at: String? = null,
    val ended_at: String? = null,
    val status: String = "scheduled",
    val distance_m: Double? = null,
    val duration_s: Int? = null,
)

@Serializable
data class TaskInfo(
    val id: String,
    val title: String,
    val description: String? = null,
    val due_at: String? = null,
    val photo_required: Boolean = true,
    val site_id: String,
    val site_name: String? = null,
    val status: String = "pending",
    val started_at: String? = null,
    val completed_at: String? = null,
    val photo_path: String? = null,
)

@Serializable
data class LeaveRequest(
    val id: String,
    val type: String,
    val start_date: String,
    val end_date: String,
    val reason: String? = null,
    val status: String = "pending",
    val decided_at: String? = null,
    val decision_note: String? = null,
    val created_at: String,
)

@Serializable
data class LeaveBalance(
    val year: Int,
    val casual_total: Int = 12,
    val earned_total: Int = 15,
    val casual_used: Int = 0,
    val earned_used: Int = 0,
    val unpaid_used: Int = 0,
)

@Serializable
data class NotificationItem(
    val id: String,
    val title: String,
    val body: String? = null,
    val created_at: String,
    val read_at: String? = null,
    val payload: JsonObject? = null,
)

@Serializable
data class Ping(
    val recorded_at: String,
    val lat: Double,
    val lng: Double,
    val accuracy_m: Float? = null,
    val speed_mps: Float? = null,
    val battery_pct: Int? = null,
    val is_mock: Boolean = false,
)

/** Row of public.shifts joined with sites(name) for the history screen. */
@Serializable
data class ShiftRecord(
    val id: String,
    val site_id: String,
    val shift_date: String,
    val scheduled_start: String? = null,
    val scheduled_end: String? = null,
    val status: String = "scheduled",
    val attendance: String = "pending",
    val started_at: String? = null,
    val ended_at: String? = null,
    val flags: List<String> = emptyList(),
    val trust: String? = null,
    val late_by_min: Int = 0,
    val worked_minutes: Int = 0,
    val away_seconds: Int = 0,
    val sites: SiteName? = null,
) { @Serializable data class SiteName(val name: String) }

@Serializable
data class CheckInResult(
    val id: String,
    val status: String,
    val flags: List<String> = emptyList(),
    val start_in_fence: Boolean? = null,
    val start_distance_m: Double? = null,
    val late_by_min: Int = 0,
    val trust: String? = null,
)

@Serializable
data class CheckOutResult(
    val id: String,
    val status: String,
    val attendance: String = "pending",
    val worked_minutes: Int = 0,
    val away_seconds: Int = 0,
    val flags: List<String> = emptyList(),
)

@Serializable
data class PatrolPhoto(val file_path: String, val lat: Double? = null, val lng: Double? = null, val taken_at: String? = null, val caption: String? = null)
