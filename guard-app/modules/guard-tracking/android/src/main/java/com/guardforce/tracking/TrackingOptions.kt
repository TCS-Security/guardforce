package com.guardforce.tracking

import android.content.Context
import org.json.JSONObject

/**
 * Everything the service needs, handed over by JS at start and persisted so a reboot can
 * restart tracking without JS. Strings are passed in so the notification speaks the guard's
 * language without the module owning translations.
 */
class TrackingOptions(val json: JSONObject) {
    val shiftKey: String get() = json.optString("shiftKey", "")
    val siteName: String get() = json.optString("siteName", "")
    val fence: Fence? get() = Fence.fromJson(json.optJSONObject("fence"))
    val movingS: Int get() = json.optInt("movingS", 120).coerceIn(30, 1800)
    val stationaryS: Int get() = json.optInt("stationaryS", 900).coerceIn(60, 3600)
    val warnMin: Int get() = json.optInt("warnMin", 30).coerceAtLeast(1)
    fun text(key: String, default: String): String = json.optJSONObject("texts")?.optString(key, default) ?: default

    companion object {
        private const val PREFS = "guard_tracking"
        fun save(context: Context, o: TrackingOptions?) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("options", o?.json?.toString()).putBoolean("running", o != null).apply()
        }
        fun load(context: Context): TrackingOptions? {
            val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            if (!p.getBoolean("running", false)) return null
            return p.getString("options", null)?.let { runCatching { TrackingOptions(JSONObject(it)) }.getOrNull() }
        }
        fun patrol(context: Context): String? = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("patrol", null)
        fun setPatrol(context: Context, id: String?) { context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("patrol", id).apply() }
    }
}
