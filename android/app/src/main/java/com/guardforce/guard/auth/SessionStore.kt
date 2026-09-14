package com.guardforce.guard.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.guardforce.guard.api.Session
import com.guardforce.guard.core.GfLog
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.UUID

/**
 * Tokens, identity and the local PIN hash, in EncryptedSharedPreferences. The PIN hash lets
 * the guard unlock offline; the server hash in guards.pin_hash is the source of truth.
 */
class SessionStore(context: Context) {
    private val prefs: SharedPreferences = try {
        val key = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
        EncryptedSharedPreferences.create(
            context, "gf_session", key,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    } catch (e: Exception) {
        // A broken keystore (some budget ROMs) must not brick the app; fall back to plain prefs.
        GfLog.w("Encrypted prefs unavailable, falling back", e)
        context.getSharedPreferences("gf_session_plain", Context.MODE_PRIVATE)
    }

    val installId: String
        get() = prefs.getString("install_id", null) ?: UUID.randomUUID().toString().also { prefs.edit { putString("install_id", it) } }

    var accessToken: String?
        get() = prefs.getString("access_token", null)
        private set(v) = prefs.edit { putString("access_token", v) }
    var refreshToken: String?
        get() = prefs.getString("refresh_token", null)
        private set(v) = prefs.edit { putString("refresh_token", v) }
    var expiresAt: Long
        get() = prefs.getLong("expires_at", 0)
        private set(v) = prefs.edit { putLong("expires_at", v) }
    var userId: String?
        get() = prefs.getString("user_id", null)
        private set(v) = prefs.edit { putString("user_id", v) }
    var phone: String?
        get() = prefs.getString("phone", null)
        set(v) = prefs.edit { putString("phone", v) }
    var guardId: String?
        get() = prefs.getString("guard_id", null)
        set(v) = prefs.edit { putString("guard_id", v) }
    var agencyId: String?
        get() = prefs.getString("agency_id", null)
        set(v) = prefs.edit { putString("agency_id", v) }
    var guardName: String?
        get() = prefs.getString("guard_name", null)
        set(v) = prefs.edit { putString("guard_name", v) }
    var permissionsDone: Boolean
        get() = prefs.getBoolean("permissions_done", false)
        set(v) = prefs.edit { putBoolean("permissions_done", v) }

    fun hasSession() = refreshToken != null

    fun saveSession(s: Session) {
        accessToken = s.access_token
        refreshToken = s.refresh_token
        expiresAt = s.expires_at ?: (System.currentTimeMillis() / 1000 + s.expires_in)
        s.user?.let { userId = it.id; if (it.phone != null) phone = it.phone }
    }

    // --- local PIN ---------------------------------------------------------------------------
    fun hasLocalPin() = prefs.getString("pin_hash", null) != null

    fun saveLocalPin(pin: String) {
        val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }.joinToString("") { "%02x".format(it) }
        prefs.edit { putString("pin_salt", salt); putString("pin_hash", hash(pin, salt)) }
    }

    fun checkLocalPin(pin: String): Boolean {
        val salt = prefs.getString("pin_salt", null) ?: return false
        val stored = prefs.getString("pin_hash", null) ?: return false
        return hash(pin, salt) == stored
    }

    private fun hash(pin: String, salt: String): String =
        MessageDigest.getInstance("SHA-256").digest("$salt:$pin".toByteArray()).joinToString("") { "%02x".format(it) }

    fun clear() {
        val keep = installId
        prefs.edit { clear(); putString("install_id", keep) }
    }
}
