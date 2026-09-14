package com.guardforce.guard.core

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

/**
 * Every failure the app can act on. Network errors are retried by the sync engine; the rest
 * are permanent and surface to the guard with a translated message.
 */
sealed class AppError(message: String, cause: Throwable? = null) : Exception(message, cause) {
    class Network(cause: Throwable) : AppError("network", cause)
    class Unauthorized : AppError("unauthorized")
    class Http(val status: Int, val code: String?, val detail: String) : AppError(detail)

    /** A PostgREST/PL-pgSQL error. [code] is the domain token (TAMPER_SUSPECTED, NO_GUARD_FOR_PHONE ...) when present, else the SQLSTATE. */
    class Rpc(val code: String, val detail: String, val sqlState: String? = null) : AppError(detail)

    val isRetryable: Boolean
        get() = this is Network || (this is Http && (status >= 500 || status == 408 || status == 429))
}

object Errors {
    private val tokenRegex = Regex("^([A-Z][A-Z0-9_]{2,})(?::|$)")

    /** Turns a GoTrue / PostgREST / Storage error body into an [AppError]. */
    fun fromPostgrest(status: Int, body: String): AppError {
        if (status == 401) return AppError.Unauthorized()
        val obj = runCatching { AppJson.parseToJsonElement(body) as? JsonObject }.getOrNull()
        fun field(name: String) = (obj?.get(name) as? JsonPrimitive)?.contentOrNull
        val message = field("message") ?: field("msg") ?: field("error_description") ?: field("error") ?: body.take(200)
        val sqlState = field("code")
        val token = tokenRegex.find(message)?.groupValues?.get(1)
        return if (token != null || (sqlState != null && sqlState.startsWith("P0"))) {
            AppError.Rpc(token ?: sqlState!!, message, sqlState)
        } else {
            AppError.Http(status, sqlState, message)
        }
    }
}
