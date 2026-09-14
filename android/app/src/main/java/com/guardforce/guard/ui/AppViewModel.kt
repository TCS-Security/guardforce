package com.guardforce.guard.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.guardforce.guard.BuildConfig
import com.guardforce.guard.Graph
import com.guardforce.guard.api.Home
import com.guardforce.guard.api.Me
import com.guardforce.guard.auth.AuthStage
import com.guardforce.guard.domain.DutyState
import com.guardforce.guard.domain.SemVer
import com.guardforce.guard.push.DeviceRegistrar
import com.guardforce.guard.tracking.LiveStatus
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.Instant

/** Process-wide state every screen reads: auth stage, me/home, duty state, live tracking, sync. */
class AppViewModel : ViewModel() {
    private val repo = Graph.repo
    val stage: StateFlow<AuthStage> = Graph.auth.stage
    val me: StateFlow<Me?> = repo.me
    val home: StateFlow<Home?> = repo.home
    val online: StateFlow<Boolean> = repo.online
    val live: StateFlow<LiveStatus> = LiveStatus.flow
    val syncing = Graph.sync.syncing
    val issues = Graph.sync.issues

    val pending: StateFlow<Int> = combine(repo.pendingOps, repo.pendingPings) { a, b -> a + b }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    private val _duty = MutableStateFlow<DutyState?>(null)
    val duty: StateFlow<DutyState?> = _duty

    val refreshing = MutableStateFlow(false)

    init {
        viewModelScope.launch {
            combine(repo.home, repo.localShift, repo.me) { _, _, _ -> Unit }.collect { recomputeDuty() }
        }
    }

    fun recomputeDuty() { viewModelScope.launch(Dispatchers.IO) { _duty.value = repo.dutyState(Instant.now()) } }

    fun refresh() {
        if (stage.value != AuthStage.READY) return
        viewModelScope.launch(Dispatchers.IO) {
            refreshing.value = true
            try { repo.refreshAll(); recomputeDuty() } finally { refreshing.value = false }
        }
    }

    fun onReady() {
        viewModelScope.launch(Dispatchers.IO) {
            repo.refreshAll(); recomputeDuty()
            runCatching { Graph.sync.sync() }
            DeviceRegistrar.register(Graph.appContext)
        }
    }

    fun needsUpdate(): Boolean = SemVer.needsUpdate(BuildConfig.VERSION_NAME, me.value?.config?.min_app_version)

    fun blockedReason(): String? {
        val m = me.value ?: return null
        return when {
            m.agency.status == "suspended" || m.agency.status == "churned" -> "suspended"
            m.guard.status == "inactive" -> "inactive"
            else -> null
        }
    }

    fun signOut() { viewModelScope.launch(Dispatchers.IO) { Graph.auth.signOut() } }
    fun lock() { Graph.auth.lock() }
}
