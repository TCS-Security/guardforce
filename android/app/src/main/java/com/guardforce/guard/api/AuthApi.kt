package com.guardforce.guard.api

import com.guardforce.guard.core.AppJson
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

@Serializable
data class AuthUser(val id: String, val phone: String? = null)

@Serializable
data class Session(
    val access_token: String,
    val refresh_token: String,
    val expires_in: Long = 3600,
    val expires_at: Long? = null,
    val user: AuthUser? = null,
)

/** GoTrue phone OTP + refresh. Signup is implicit: the first OTP for a number creates the auth user. */
class AuthApi(private val http: SupabaseHttp) {

    suspend fun requestOtp(phoneE164: String) {
        val body = buildJsonObject { put("phone", phoneE164); put("create_user", true) }.toString()
        http.json("POST", "/auth/v1/otp", body, auth = false)
    }

    suspend fun verifyOtp(phoneE164: String, code: String): Session {
        val body = buildJsonObject { put("type", "sms"); put("phone", phoneE164); put("token", code) }.toString()
        return AppJson.decodeFromString(Session.serializer(), http.json("POST", "/auth/v1/verify", body, auth = false))
    }

    suspend fun refresh(refreshToken: String): Session {
        val body = buildJsonObject { put("refresh_token", refreshToken) }.toString()
        return AppJson.decodeFromString(Session.serializer(), http.json("POST", "/auth/v1/token?grant_type=refresh_token", body, auth = false))
    }

    suspend fun signOut(accessToken: String) {
        runCatching { http.json("POST", "/auth/v1/logout", "{}", headers = mapOf("Authorization" to "Bearer $accessToken"), auth = false) }
    }
}
