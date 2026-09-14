package com.guardforce.guard.core

import kotlinx.serialization.json.Json

/** One JSON configuration for the whole app: lenient on unknown server fields, never writes nulls. */
val AppJson: Json = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
    explicitNulls = false
    isLenient = true
    coerceInputValues = true
}
