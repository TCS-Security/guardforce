package com.guardforce.guard.domain

import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Time formatting in the agency's timezone (IST for every pilot agency). */
class TimeText(private val zone: ZoneId) {
    private val hm = DateTimeFormatter.ofPattern("HH:mm", Locale.ENGLISH)
    private val dayShort = DateTimeFormatter.ofPattern("EEE d MMM", Locale.ENGLISH)
    private val dayLong = DateTimeFormatter.ofPattern("EEEE, d MMMM", Locale.ENGLISH)

    fun clock(iso: String?): String = Duty.parse(iso)?.atZone(zone)?.format(hm) ?: "--:--"
    fun clock(ms: Long): String = Instant.ofEpochMilli(ms).atZone(zone).format(hm)
    fun day(isoDate: String): String = runCatching { LocalDate.parse(isoDate).format(dayShort) }.getOrDefault(isoDate)
    fun todayLong(): String = LocalDate.now(zone).format(dayLong)
    fun todayIso(): String = LocalDate.now(zone).toString()
    fun nowIso(): String = OffsetDateTime.now(zone).toString()
    fun isoAt(ms: Long): String = OffsetDateTime.ofInstant(Instant.ofEpochMilli(ms), zone).toString()

    sealed class Relative { object Now : Relative(); data class Minutes(val n: Int) : Relative(); data class Hours(val n: Int) : Relative() }
    fun relative(ms: Long, now: Long = System.currentTimeMillis()): Relative {
        val d = Duration.ofMillis((now - ms).coerceAtLeast(0))
        return when {
            d.toMinutes() < 1 -> Relative.Now
            d.toHours() < 1 -> Relative.Minutes(d.toMinutes().toInt())
            else -> Relative.Hours(d.toHours().toInt())
        }
    }

    data class Dur(val hours: Int, val minutes: Int)
    fun duration(seconds: Long): Dur = Dur((seconds / 3600).toInt(), ((seconds % 3600) / 60).toInt())
}
