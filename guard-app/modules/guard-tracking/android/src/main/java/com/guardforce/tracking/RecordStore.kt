package com.guardforce.tracking

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject

/**
 * Everything the service captures while JS may not be running: breadcrumb pings, location
 * on/off transitions and patrol trail points. JS drains it in order and acknowledges by id.
 */
class RecordStore(context: Context) : SQLiteOpenHelper(context, "guard_tracking.db", null, 1) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""create table records (
            id integer primary key autoincrement, kind text not null, shift_key text, at integer not null,
            lat real, lng real, accuracy real, speed real, battery integer, mock integer, enabled integer, patrol_id text)""")
        db.execSQL("create index records_kind on records(kind, id)")
    }
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) { db.execSQL("drop table if exists records"); onCreate(db) }

    fun insert(kind: String, shiftKey: String?, at: Long, lat: Double? = null, lng: Double? = null, accuracy: Float? = null, speed: Float? = null,
               battery: Int? = null, mock: Boolean? = null, enabled: Boolean? = null, patrolId: String? = null) {
        val v = ContentValues().apply {
            put("kind", kind); put("shift_key", shiftKey); put("at", at); put("lat", lat); put("lng", lng); put("accuracy", accuracy); put("speed", speed)
            put("battery", battery); mock?.let { put("mock", if (it) 1 else 0) }; enabled?.let { put("enabled", if (it) 1 else 0) }; put("patrol_id", patrolId)
        }
        writableDatabase.insert("records", null, v)
    }

    /** Pings and location-state changes, oldest first. */
    fun drain(limit: Int): List<JSONObject> = query("kind in ('ping','location_state')", null, limit)

    fun trail(patrolId: String): List<JSONObject> = query("kind = 'trail' and patrol_id = ?", arrayOf(patrolId), 10_000)

    fun ack(maxId: Long) { writableDatabase.delete("records", "id <= ? and kind in ('ping','location_state')", arrayOf(maxId.toString())) }
    fun clearTrail(patrolId: String) { writableDatabase.delete("records", "kind = 'trail' and patrol_id = ?", arrayOf(patrolId)) }
    fun clearAll() { writableDatabase.delete("records", null, null) }
    fun pendingCount(): Int = readableDatabase.rawQuery("select count(*) from records where kind in ('ping','location_state')", null).use { it.moveToFirst(); it.getInt(0) }

    private fun query(where: String, args: Array<String>?, limit: Int): List<JSONObject> {
        val out = ArrayList<JSONObject>()
        readableDatabase.query("records", null, where, args, null, null, "id asc", limit.toString()).use { c ->
            while (c.moveToNext()) {
                val o = JSONObject()
                o.put("id", c.getLong(c.getColumnIndexOrThrow("id")))
                o.put("kind", c.getString(c.getColumnIndexOrThrow("kind")))
                o.put("shiftKey", c.getString(c.getColumnIndexOrThrow("shift_key")))
                o.put("at", c.getLong(c.getColumnIndexOrThrow("at")))
                fun num(col: String) { val i = c.getColumnIndexOrThrow(col); if (!c.isNull(i)) o.put(col, c.getDouble(i)) }
                num("lat"); num("lng"); num("accuracy"); num("speed")
                val bi = c.getColumnIndexOrThrow("battery"); if (!c.isNull(bi)) o.put("battery", c.getInt(bi))
                val mi = c.getColumnIndexOrThrow("mock"); if (!c.isNull(mi)) o.put("mock", c.getInt(mi) == 1)
                val ei = c.getColumnIndexOrThrow("enabled"); if (!c.isNull(ei)) o.put("enabled", c.getInt(ei) == 1)
                val pi = c.getColumnIndexOrThrow("patrol_id"); if (!c.isNull(pi)) o.put("patrolId", c.getString(pi))
                out.add(o)
            }
        }
        return out
    }
}
