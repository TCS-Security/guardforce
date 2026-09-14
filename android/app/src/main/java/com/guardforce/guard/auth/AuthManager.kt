package com.guardforce.guard.auth

import com.guardforce.guard.api.AuthApi
import com.guardforce.guard.api.GuardApi
import com.guardforce.guard.api.Me
import com.guardforce.guard.api.SupabaseHttp
import com.guardforce.guard.core.AppError
import com.guardforce.guard.core.GfLog
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

enum class AuthStage {
    /** No refresh token on this phone: phone → OTP. */
    SIGNED_OUT,
    /** OTP verified, guard row not linked yet (or not fetched). */
    NEEDS_CLAIM,
    /** Linked, but the guard never chose a PIN. */
    NEEDS_PIN,
    /** Linked with a PIN; every cold start lands here. */
    LOCKED,
    READY,
}

/** Owns the auth state machine and hands tokens to [SupabaseHttp]. */
class AuthManager(
    private val store: SessionStore,
    private val authApi: AuthApi,
    private val apiProvider: () -> GuardApi,
    private val onSignedOut: suspend () -> Unit,
) : SupabaseHttp.TokenProvider {

    private val refreshMutex = Mutex()
    private val _stage = MutableStateFlow(initialStage())
    val stage: StateFlow<AuthStage> = _stage

    var pendingPhone: String? = null
        private set

    private fun initialStage(): AuthStage = when {
        !store.hasSession() -> AuthStage.SIGNED_OUT
        store.guardId == null -> AuthStage.NEEDS_CLAIM
        !store.hasLocalPin() -> AuthStage.LOCKED // PIN exists on the server (new phone) or has to be created; resolved after unlock/claim
        else -> AuthStage.LOCKED
    }

    override fun accessToken(): String? = store.accessToken

    override suspend fun refresh(): String? = refreshMutex.withLock {
        val rt = store.refreshToken ?: return null
        try {
            val s = authApi.refresh(rt)
            store.saveSession(s)
            s.access_token
        } catch (e: AppError) {
            if (e is AppError.Http && e.status in 400..403 || e is AppError.Unauthorized) {
                GfLog.w("Refresh token rejected; signing out")
                signOutLocal()
                null
            } else throw e
        }
    }

    suspend fun requestOtp(phoneE164: String) {
        authApi.requestOtp(phoneE164)
        pendingPhone = phoneE164
    }

    suspend fun verifyOtp(code: String): Boolean {
        val phone = pendingPhone ?: return false
        val s = authApi.verifyOtp(phone, code)
        store.saveSession(s)
        store.phone = phone
        _stage.value = AuthStage.NEEDS_CLAIM
        return true
    }

    /** Links auth user ↔ guard row. Throws [AppError.Rpc] NO_GUARD_FOR_PHONE / PHONE_ALREADY_LINKED. */
    suspend fun claim(): Me {
        val me = apiProvider().claimAccount()
        store.guardId = me.guard.id
        store.agencyId = me.guard.agency_id
        store.guardName = me.guard.full_name
        _stage.value = if (me.guard.has_pin) AuthStage.LOCKED else AuthStage.NEEDS_PIN
        return me
    }

    suspend fun setPin(pin: String) {
        apiProvider().setPin(pin)
        store.saveLocalPin(pin)
        _stage.value = AuthStage.READY
    }

    /** Offline-first: local hash first, then the server (new phone, same guard). */
    suspend fun unlock(pin: String): Boolean {
        if (store.checkLocalPin(pin)) { _stage.value = AuthStage.READY; return true }
        return try {
            if (apiProvider().verifyPin(pin)) {
                store.saveLocalPin(pin)
                _stage.value = AuthStage.READY
                true
            } else false
        } catch (e: AppError.Network) {
            false
        }
    }

    /** Device biometrics stand in for the PIN only when a PIN is already on this phone. */
    fun unlockWithDevice() { if (store.hasLocalPin()) _stage.value = AuthStage.READY }

    fun needsPinSetup(): Boolean = !store.hasLocalPin()

    fun markPinRequired() { if (_stage.value == AuthStage.LOCKED && !store.hasLocalPin()) _stage.value = AuthStage.NEEDS_PIN }

    fun lock() { if (_stage.value == AuthStage.READY) _stage.value = AuthStage.LOCKED }

    suspend fun signOut() {
        store.accessToken?.let { runCatching { authApi.signOut(it) } }
        signOutLocal()
    }

    private suspend fun signOutLocal() {
        store.clear()
        _stage.value = AuthStage.SIGNED_OUT
        runCatching { onSignedOut() }
    }
}
