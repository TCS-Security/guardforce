package com.guardforce.guard.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class GeoTest {
    // Seed sites (supabase/seed.sql)
    private val sobha = FenceSpec("radius", 12.93420, 77.72780, 250, null, 50)
    private val brigade = FenceSpec(
        "polygon", 12.84590, 77.51150, 150,
        listOf(77.5100 to 12.8450, 77.5132 to 12.8452, 77.5134 to 12.8470, 77.5104 to 12.8468, 77.5100 to 12.8450), 50,
    )

    @Test fun `centre of a radius fence is inside with zero distance`() {
        assertEquals(0.0, Geo.distanceOutsideM(sobha, 12.93420, 77.72780), 0.01)
        assertTrue(Geo.inFence(sobha, 12.93420, 77.72780))
    }

    @Test fun `leeway buffer keeps a point just past the radius inside`() {
        // ~280 m north: 30 m past the 250 m radius, inside the 50 m leeway
        val lat = 12.93420 + 280 / 111_320.0
        val d = Geo.distanceOutsideM(sobha, lat, 77.72780)
        assertTrue(d in 25.0..35.0, "expected ~30 m outside, got $d")
        assertTrue(Geo.inFence(sobha, lat, 77.72780))
    }

    @Test fun `one kilometre away is outside`() {
        val d = Geo.distanceOutsideM(sobha, 12.9420, 77.7360)
        assertTrue(d > 700, "got $d")
        assertFalse(Geo.inFence(sobha, 12.9420, 77.7360))
    }

    @Test fun `polygon interior is inside`() {
        assertEquals(0.0, Geo.distanceOutsideM(brigade, 12.8460, 77.5117), 0.0)
        assertTrue(Geo.inFence(brigade, 12.8460, 77.5117))
    }

    @Test fun `polygon exterior distance is measured to the nearest edge`() {
        // 100 m south of the southern edge (lat 12.8450..12.8452)
        val lat = 12.8450 - 100 / 111_320.0
        val d = Geo.distanceOutsideM(brigade, lat, 77.5115)
        assertTrue(d in 90.0..115.0, "expected ~100 m, got $d")
        assertFalse(Geo.inFence(brigade, lat, 77.5115))
    }

    @Test fun `haversine matches a known distance`() {
        // Bengaluru city centre to Sobha Dream Acres: ~13.4 km
        val d = Geo.haversineM(12.9716, 77.5946, 12.93420, 77.72780)
        assertTrue(d in 14_000.0..15_500.0, "got $d")
    }
}
