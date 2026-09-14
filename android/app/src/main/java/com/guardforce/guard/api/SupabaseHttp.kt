package com.guardforce.guard.api

import com.guardforce.guard.core.AppError
import com.guardforce.guard.core.Errors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * The only place that knows how to talk HTTP to the backend. GoTrue, PostgREST and Storage
 * are plain REST, so a hand-rolled client keeps the app free of SDK churn and makes the
 * backend swappable behind [GuardApi] (see docs/notes/rds-migration.md).
 */
class SupabaseHttp(
    private val baseUrl: String,
    private val anonKey: String,
    private val tokens: TokenProvider,
) {
    interface TokenProvider {
        fun accessToken(): String?
        /** Returns a fresh access token, or null when the session is gone. */
        suspend fun refresh(): String?
    }

    val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .writeTimeout(90, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    val jsonType = "application/json; charset=utf-8".toMediaType()

    fun url(path: String) = baseUrl.trimEnd('/') + path

    suspend fun json(
        method: String,
        path: String,
        body: String? = null,
        headers: Map<String, String> = emptyMap(),
        auth: Boolean = true,
    ): String = call(method, path, body?.toRequestBody(jsonType), headers, auth)

    suspend fun call(
        method: String,
        path: String,
        body: RequestBody? = null,
        headers: Map<String, String> = emptyMap(),
        auth: Boolean = true,
    ): String = withContext(Dispatchers.IO) {
        var token = if (auth) tokens.accessToken() else null
        var attempt = 0
        while (true) {
            attempt++
            val req = Request.Builder().url(url(path)).apply {
                header("apikey", anonKey)
                header("Authorization", "Bearer ${token ?: anonKey}")
                headers.forEach { (k, v) -> header(k, v) }
                when (method) {
                    "GET" -> get()
                    "DELETE" -> delete(body)
                    else -> method(method, body ?: ByteArray(0).toRequestBody(null))
                }
            }.build()
            val response = try {
                client.newCall(req).execute()
            } catch (e: IOException) {
                throw AppError.Network(e)
            }
            response.use { res ->
                val text = res.body?.string() ?: ""
                if (res.isSuccessful) return@withContext text
                if (res.code == 401 && auth && attempt == 1) {
                    token = tokens.refresh() ?: throw AppError.Unauthorized()
                    return@use // retry once with the new token
                }
                throw Errors.fromPostgrest(res.code, text)
            }
        }
        @Suppress("UNREACHABLE_CODE")
        throw IllegalStateException()
    }
}
