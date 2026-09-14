package com.guardforce.guard.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

/** A write waiting for the network. Processed strictly in insertion order. */
@Entity(tableName = "outbox")
data class OutboxEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val kind: String,
    val payload: String,
    val createdAt: Long,
    val attempts: Int = 0,
    val lastError: String? = null,
    val blocked: Boolean = false,
)

/** Breadcrumbs captured by the tracking service, flushed in batches to ingest_pings. */
@Entity(tableName = "pings")
data class PingEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val shiftKey: String,
    val recordedAt: Long,
    val lat: Double,
    val lng: Double,
    val accuracyM: Float?,
    val speedMps: Float?,
    val batteryPct: Int?,
    val isMock: Boolean,
)

/**
 * The phone's own record of the shift it is running. [key] is minted at check-in so pings can
 * be recorded before the server has answered; [serverId] arrives with the check_in response.
 */
@Entity(tableName = "local_shifts")
data class LocalShiftEntity(
    @PrimaryKey val key: String,
    val serverId: String?,
    val siteId: String,
    val guardId: String,
    val startedAtMs: Long,
    val status: String,
    val updatedAt: Long,
)

@Entity(tableName = "trail_points")
data class TrailPointEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val patrolId: String,
    val atMs: Long,
    val lat: Double,
    val lng: Double,
)

/** Last good JSON for guard_me / guard_home so the app opens offline. */
@Entity(tableName = "cache")
data class CacheEntity(@PrimaryKey val key: String, val json: String, val updatedAt: Long)

/** Local status overrides (patrol started, task done) shown until the server catches up. */
@Entity(tableName = "overrides", primaryKeys = ["kind", "id"])
data class OverrideEntity(val kind: String, val id: String, val status: String, val atMs: Long, val extra: String? = null)
