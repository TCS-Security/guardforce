package com.guardforce.guard.domain

/**
 * Adaptive tracking cadence (F5): every ping_interval_moving_s while moving, backing off to
 * ping_interval_stationary_s once the guard has been still for a few fixes. Both numbers come
 * from app_config so the agency can tune battery vs. resolution without a release.
 */
data class PingConfig(val movingS: Int = 120, val stationaryS: Int = 900) {
    init { require(movingS > 0 && stationaryS > 0) }
}

data class Fix(val lat: Double, val lng: Double, val speedMps: Float?, val atMs: Long)

class PingPolicy(private val config: PingConfig) {
    companion object {
        const val STATIONARY_SPEED_MPS = 0.7f
        const val STATIONARY_RADIUS_M = 25.0
        const val STATIONARY_FIXES = 3
        const val FLUSH_EVERY_PINGS = 5
        const val FLUSH_EVERY_S = 180L
    }

    /** Interval for the next request given the most recent fixes (newest last). */
    fun nextIntervalS(recent: List<Fix>): Int {
        if (recent.size < STATIONARY_FIXES) return config.movingS
        val window = recent.takeLast(STATIONARY_FIXES)
        val slowBySpeed = window.all { (it.speedMps ?: 0f) < STATIONARY_SPEED_MPS }
        val anchor = window.first()
        val slowByDistance = window.all { Geo.haversineM(anchor.lat, anchor.lng, it.lat, it.lng) <= STATIONARY_RADIUS_M }
        return if (slowBySpeed && slowByDistance) config.stationaryS else config.movingS
    }

    /** Batch pings so a 2G connection sees a few requests per hour, not one per fix. */
    fun shouldFlush(pending: Int, secondsSinceLastFlush: Long): Boolean =
        pending >= FLUSH_EVERY_PINGS || (pending > 0 && secondsSinceLastFlush >= FLUSH_EVERY_S)
}
