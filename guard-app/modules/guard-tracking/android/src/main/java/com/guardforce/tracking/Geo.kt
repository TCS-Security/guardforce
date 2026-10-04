package com.guardforce.tracking

import org.json.JSONObject
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/** Site perimeter as handed over by JS (mirrors public.site_distance_m / is_in_fence). */
data class Fence(val type: String, val lat: Double, val lng: Double, val radiusM: Int, val polygon: List<Pair<Double, Double>>?, val leewayM: Int) {
    companion object {
        fun fromJson(o: JSONObject?): Fence? {
            if (o == null) return null
            val ring = o.optJSONArray("polygon")?.let { arr -> (0 until arr.length()).map { i -> val p = arr.getJSONArray(i); Pair(p.getDouble(0), p.getDouble(1)) } }
            return Fence(o.optString("type", "radius"), o.getDouble("lat"), o.getDouble("lng"), o.optInt("radiusM", 150), ring, o.optInt("leewayM", 50))
        }
    }
}

object Geo {
    private const val EARTH_R = 6_371_008.8

    fun haversineM(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
        val dLat = Math.toRadians(lat2 - lat1); val dLng = Math.toRadians(lng2 - lng1)
        val a = sin(dLat / 2) * sin(dLat / 2) + cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLng / 2) * sin(dLng / 2)
        return 2 * EARTH_R * atan2(sqrt(a), sqrt(1 - a))
    }

    fun distanceOutsideM(f: Fence, lat: Double, lng: Double): Double {
        val poly = f.polygon
        if (f.type == "polygon" && poly != null && poly.size >= 3) {
            if (pointInPolygon(poly, lng, lat)) return 0.0
            return distanceToRing(poly, lat, lng)
        }
        val d = haversineM(f.lat, f.lng, lat, lng) - f.radiusM
        return if (d < 0) 0.0 else d
    }

    private fun pointInPolygon(ring: List<Pair<Double, Double>>, x: Double, y: Double): Boolean {
        var inside = false; var j = ring.size - 1
        for (i in ring.indices) {
            val (xi, yi) = ring[i]; val (xj, yj) = ring[j]
            val denom = (yj - yi).takeIf { it != 0.0 } ?: 1e-12
            if ((yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / denom + xi) inside = !inside
            j = i
        }
        return inside
    }

    private fun distanceToRing(ring: List<Pair<Double, Double>>, lat: Double, lng: Double): Double {
        val kLat = EARTH_R * PI / 180; val kLng = kLat * cos(Math.toRadians(lat))
        var best = Double.MAX_VALUE
        for (i in ring.indices) {
            val a = ring[i]; val b = ring[(i + 1) % ring.size]
            val ax = (a.first - lng) * kLng; val ay = (a.second - lat) * kLat; val bx = (b.first - lng) * kLng; val by = (b.second - lat) * kLat
            val dx = bx - ax; val dy = by - ay; val len2 = dx * dx + dy * dy
            val t = (if (len2 == 0.0) 0.0 else ((-ax) * dx + (-ay) * dy) / len2).coerceIn(0.0, 1.0)
            val cx = ax + t * dx; val cy = ay + t * dy
            best = minOf(best, sqrt(cx * cx + cy * cy))
        }
        return if (best == Double.MAX_VALUE) 0.0 else abs(best)
    }
}
