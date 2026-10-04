package com.guardforce.tracking

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

/** JS ↔ service bridge. JS owns auth and syncing; the service owns capture. */
class GuardTrackingModule : Module() {
    private val context: Context get() = appContext.reactContext ?: throw IllegalStateException("no context")
    private val store by lazy { RecordStore(context) }

    private fun JSONObject.toMap(): Map<String, Any?> = keys().asSequence().associateWith { k ->
        when (val v = get(k)) { JSONObject.NULL -> null; is JSONObject -> v.toMap(); is JSONArray -> (0 until v.length()).map { v.get(it) }; else -> v }
    }

    override fun definition() = ModuleDefinition {
        Name("GuardTracking")
        Events("onStatus")

        OnCreate {
            TrackingService.listener = { status -> sendEvent("onStatus", status.toMap()) }
        }
        OnDestroy { TrackingService.listener = null }

        AsyncFunction("start") { optionsJson: String ->
            TrackingService.start(context, TrackingOptions(JSONObject(optionsJson)))
        }
        AsyncFunction("stop") { TrackingService.stop(context) }
        AsyncFunction("setPatrol") { patrolId: String? -> TrackingOptions.setPatrol(context, patrolId) }
        Function("isRunning") { TrackingService.running || TrackingOptions.load(context) != null }
        Function("getStatus") { TrackingService.status.toMap() }
        Function("getPendingCount") { store.pendingCount() }

        /** Oldest records first; call ack(maxId) after they are safely queued in JS. */
        AsyncFunction("drain") { limit: Int -> store.drain(limit).map { it.toMap() } }
        AsyncFunction("ack") { maxId: Double -> store.ack(maxId.toLong()) }
        AsyncFunction("trail") { patrolId: String -> store.trail(patrolId).map { it.toMap() } }
        AsyncFunction("clearTrail") { patrolId: String -> store.clearTrail(patrolId) }
        AsyncFunction("clearAll") { store.clearAll(); TrackingService.stop(context) }
    }
}
