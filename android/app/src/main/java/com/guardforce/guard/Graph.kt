package com.guardforce.guard

import android.content.Context
import com.guardforce.guard.api.AuthApi
import com.guardforce.guard.api.GuardApi
import com.guardforce.guard.api.SupabaseGuardApi
import com.guardforce.guard.api.SupabaseHttp
import com.guardforce.guard.auth.AuthManager
import com.guardforce.guard.auth.SessionStore
import com.guardforce.guard.data.GuardRepository
import com.guardforce.guard.data.db.AppDatabase
import com.guardforce.guard.data.sync.SyncEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/** Hand-wired object graph. Small enough that a DI framework would cost more than it saves. */
object Graph {
    lateinit var appContext: Context
    lateinit var store: SessionStore
    lateinit var db: AppDatabase
    lateinit var http: SupabaseHttp
    lateinit var authApi: AuthApi
    lateinit var api: GuardApi
    lateinit var auth: AuthManager
    lateinit var sync: SyncEngine
    lateinit var repo: GuardRepository
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    @Volatile private var ready = false

    fun isReady() = ready

    @Synchronized
    fun init(context: Context) {
        if (ready) return
        appContext = context.applicationContext
        store = SessionStore(appContext)
        db = AppDatabase.build(appContext)
        lateinit var manager: AuthManager
        http = SupabaseHttp(BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_ANON_KEY, object : SupabaseHttp.TokenProvider {
            override fun accessToken() = manager.accessToken()
            override suspend fun refresh() = manager.refresh()
        })
        authApi = AuthApi(http)
        api = SupabaseGuardApi(http)
        sync = SyncEngine(db, api)
        manager = AuthManager(store, authApi, { api }, onSignedOut = { repo.clearAll() })
        auth = manager
        repo = GuardRepository(appContext, db, api, store, sync, scope)
        ready = true
    }
}
