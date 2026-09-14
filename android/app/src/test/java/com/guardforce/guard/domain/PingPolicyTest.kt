package com.guardforce.guard.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PingPolicyTest {
    private val policy = PingPolicy(PingConfig(movingS = 120, stationaryS = 900))
    private fun fix(lat: Double, lng: Double, speed: Float?, at: Long) = Fix(lat, lng, speed, at)

    @Test fun `starts at the moving interval`() {
        assertEquals(120, policy.nextIntervalS(emptyList()))
        assertEquals(120, policy.nextIntervalS(listOf(fix(12.9, 77.7, 0f, 0))))
    }

    @Test fun `three still fixes back off to the stationary interval`() {
        val fixes = listOf(fix(12.9, 77.7, 0.1f, 0), fix(12.90001, 77.70001, 0.2f, 120_000), fix(12.9, 77.7, 0f, 240_000))
        assertEquals(900, policy.nextIntervalS(fixes))
    }

    @Test fun `walking keeps the moving interval even with low reported speed`() {
        // 60 m between fixes with speed unreported: distance says moving
        val fixes = listOf(fix(12.9000, 77.7, null, 0), fix(12.9005, 77.7, null, 120_000), fix(12.9010, 77.7, null, 240_000))
        assertEquals(120, policy.nextIntervalS(fixes))
    }

    @Test fun `a single fast fix ends the stationary phase`() {
        val fixes = listOf(fix(12.9, 77.7, 0f, 0), fix(12.9, 77.7, 0f, 1), fix(12.9, 77.7, 3f, 2))
        assertEquals(120, policy.nextIntervalS(fixes))
    }

    @Test fun `flushes on count or age`() {
        assertFalse(policy.shouldFlush(0, 10_000))
        assertFalse(policy.shouldFlush(2, 60))
        assertTrue(policy.shouldFlush(5, 0))
        assertTrue(policy.shouldFlush(1, 180))
    }

    @Test fun `config rejects zero intervals`() {
        assertTrue(runCatching { PingConfig(0, 900) }.isFailure)
    }
}
