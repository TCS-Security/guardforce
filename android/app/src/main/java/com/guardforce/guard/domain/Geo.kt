package com.guardforce.guard.domain

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/** A site perimeter as the app sees it. Polygon points are (lng, lat) like GeoJSON. */
data class FenceSpec(
    val type: String,
    val lat: Double,
    val lng: Double,
    val radiusM: Int,
    val polygon: List<Pair<Double, Double>>?,
    val leewayM: Int,
)

/**
 * Local mirror of public.site_distance_m / is_in_fence so the guard sees "inside / 120 m
 * outside" before the server confirms it. The server remains the source of truth.
 */
object Geo {
    private const val EARTH_R = 6_371_008.8

    fun haversineM(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
        val dLat = Math.toRadians(lat2 - lat1)
        val dLng = Math.toRadians(lng2 - lng1)
        val a = sin(dLat / 2) * sin(dLat / 2) + cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLng / 2) * sin(dLng / 2)
        return 2 * EARTH_R * atan2(sqrt(a), sqrt(1 - a))
    }

    /** Metres beyond the raw fence edge; 0 when inside. */
    fun distanceOutsideM(fence: FenceSpec, lat: Double, lng: Double): Double {
        val poly = fence.polygon
        if (fence.type == "polygon" && poly != null && poly.size >= 3) {
            if (pointInPolygon(poly, lng, lat)) return 0.0
            return distanceToRing(poly, lat, lng)
        }
        val d = haversineM(fence.lat, fence.lng, lat, lng) - fence.radiusM
        return if (d < 0) 0.0 else d
    }

    fun inFence(fence: FenceSpec, lat: Double, lng: Double): Boolean = distanceOutsideM(fence, lat, lng) <= fence.leewayM

    /** Ray casting on (lng, lat) pairs. */
    fun pointInPolygon(ring: List<Pair<Double, Double>>, x: Double, y: Double): Boolean {
        var inside = false
        var j = ring.size - 1
        for (i in ring.indices) {
            val (xi, yi) = ring[i]
            val (xj, yj) = ring[j]
            val intersects = (yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / ((yj - yi).takeIf { it != 0.0 } ?: 1e-12) + xi
            if (intersects) inside = !inside
            j = i
        }
        return inside
    }

    /** Distance from a point to the closest polygon edge, using a local equirectangular projection. */
    fun distanceToRing(ring: List<Pair<Double, Double>>, lat: Double, lng: Double): Double {
        val kLat = EARTH_R * PI / 180
        val kLng = kLat * cos(Math.toRadians(lat))
        fun px(p: Pair<Double, Double>) = (p.first - lng) * kLng
        fun py(p: Pair<Double, Double>) = (p.second - lat) * kLat
        var best = Double.MAX_VALUE
        for (i in ring.indices) {
            val a = ring[i]
            val b = ring[(i + 1) % ring.size]
            val ax = px(a); val ay = py(a); val bx = px(b); val by = py(b)
            val dx = bx - ax; val dy = by - ay
            val len2 = dx * dx + dy * dy
            val t = if (len2 == 0.0) 0.0 else ((-ax) * dx + (-ay) * dy) / len2
            val tt = t.coerceIn(0.0, 1.0)
            val cx = ax + tt * dx; val cy = ay + tt * dy
            val d = sqrt(cx * cx + cy * cy)
            if (d < best) best = d
        }
        return if (best == Double.MAX_VALUE) 0.0 else abs(best)
    }
}
