package com.guardforce.guard.tracking

import kotlinx.coroutines.flow.MutableStateFlow

/** What the tracking service knows right now; the home screen renders it. */
data class LiveStatus(
    val tracking: Boolean = false,
    val lat: Double? = null,
    val lng: Double? = null,
    val accuracyM: Float? = null,
    val inFence: Boolean? = null,
    val distanceOutsideM: Double? = null,
    val batteryPct: Int? = null,
    val lastFixMs: Long? = null,
    val locationEnabled: Boolean = true,
    val isMock: Boolean = false,
    val intervalS: Int = 0,
) {
    companion object { val flow = MutableStateFlow(LiveStatus()) }
}
