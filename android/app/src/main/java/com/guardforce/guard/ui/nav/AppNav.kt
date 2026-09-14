package com.guardforce.guard.ui.nav

import android.widget.Toast
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.guardforce.guard.Graph
import com.guardforce.guard.R
import com.guardforce.guard.auth.AuthStage
import com.guardforce.guard.core.AppError
import com.guardforce.guard.ui.AppViewModel
import com.guardforce.guard.ui.Labels
import com.guardforce.guard.ui.screens.history.HistoryScreen
import com.guardforce.guard.ui.screens.home.HomeScreen
import com.guardforce.guard.ui.screens.leave.ApplyLeaveScreen
import com.guardforce.guard.ui.screens.leave.LeaveScreen
import com.guardforce.guard.ui.screens.lock.LockScreen
import com.guardforce.guard.ui.screens.notifications.NotificationsScreen
import com.guardforce.guard.ui.screens.onboarding.ClaimScreen
import com.guardforce.guard.ui.screens.onboarding.OtpScreen
import com.guardforce.guard.ui.screens.onboarding.PermissionsScreen
import com.guardforce.guard.ui.screens.onboarding.PhoneScreen
import com.guardforce.guard.ui.screens.onboarding.RegistrationSelfieScreen
import com.guardforce.guard.ui.screens.onboarding.SetPinScreen
import com.guardforce.guard.ui.screens.patrol.PatrolRunScreen
import com.guardforce.guard.ui.screens.patrol.PatrolsScreen
import com.guardforce.guard.ui.screens.profile.ProfileScreen
import com.guardforce.guard.ui.screens.shift.ShiftCaptureScreen
import com.guardforce.guard.ui.screens.system.BlockedScreen
import com.guardforce.guard.ui.screens.system.ForceUpdateScreen
import com.guardforce.guard.ui.screens.task.TaskDoScreen
import com.guardforce.guard.ui.screens.task.TasksScreen

/** Where a session in [stage] should land. Ready sessions also pass the permission and reference-photo gates. */
fun landingRoute(stage: AuthStage, permissionsDone: Boolean, hasSelfie: Boolean, needsUpdate: Boolean, blocked: String?): String = when (stage) {
    AuthStage.SIGNED_OUT -> Routes.PHONE
    AuthStage.NEEDS_CLAIM -> Routes.CLAIM
    AuthStage.NEEDS_PIN -> Routes.SET_PIN
    AuthStage.LOCKED -> Routes.LOCK
    AuthStage.READY -> when {
        needsUpdate -> Routes.UPDATE
        blocked != null -> Routes.BLOCKED
        !permissionsDone -> Routes.PERMISSIONS
        !hasSelfie -> Routes.REG_SELFIE
        else -> Routes.HOME
    }
}

@Composable
fun AppNav(vm: AppViewModel, nav: NavHostController = rememberNavController()) {
    val ctx = LocalContext.current
    val stage by vm.stage.collectAsStateWithLifecycle()
    val me by vm.me.collectAsStateWithLifecycle()

    fun reset(route: String) = nav.navigate(route) { popUpTo(0) { inclusive = true }; launchSingleTop = true }

    LaunchedEffect(stage, me?.guard?.registration_selfie_path, me?.config?.min_app_version, me?.agency?.status, me?.guard?.status) {
        val route = landingRoute(stage, Graph.store.permissionsDone, me?.guard?.registration_selfie_path != null || me == null, vm.needsUpdate(), vm.blockedReason())
        val current = nav.currentBackStackEntry?.destination?.route
        val gate = route in setOf(Routes.PHONE, Routes.CLAIM, Routes.SET_PIN, Routes.LOCK, Routes.UPDATE, Routes.BLOCKED, Routes.PERMISSIONS, Routes.REG_SELFIE)
        if (gate && current != route) reset(route)
        else if (!gate && (current == null || current in setOf(Routes.PHONE, Routes.OTP, Routes.CLAIM, Routes.SET_PIN, Routes.LOCK, Routes.UPDATE, Routes.BLOCKED, Routes.PERMISSIONS, Routes.REG_SELFIE))) reset(Routes.HOME)
        if (stage == AuthStage.READY) vm.onReady()
    }
    LaunchedEffect(Unit) {
        vm.issues.collect { code -> Toast.makeText(ctx, Labels.error(ctx, AppError.Rpc(code, code)), Toast.LENGTH_LONG).show() }
    }

    NavHost(navController = nav, startDestination = Routes.LOCK) {
        composable(Routes.PHONE) { PhoneScreen(onSent = { nav.navigate(Routes.OTP) }) }
        composable(Routes.OTP) { OtpScreen(onVerified = { }, onBack = { nav.popBackStack() }) }
        composable(Routes.CLAIM) { ClaimScreen(onClaimed = { }) }
        composable(Routes.SET_PIN) { SetPinScreen(change = false, onDone = { }) }
        composable(Routes.CHANGE_PIN) { SetPinScreen(change = true, onDone = { nav.popBackStack() }, onBack = { nav.popBackStack() }) }
        composable(Routes.LOCK) { LockScreen(onUnlocked = { }, onForgot = { vm.signOut() }) }
        composable(Routes.PERMISSIONS) { PermissionsScreen(onDone = { reset(Routes.HOME) }) }
        composable(Routes.REG_SELFIE) { RegistrationSelfieScreen(onDone = { reset(Routes.HOME) }) }
        composable(Routes.UPDATE) { ForceUpdateScreen(me?.config?.min_app_version ?: "") }
        composable(Routes.BLOCKED) { BlockedScreen(vm.blockedReason() ?: "suspended", onSignOut = { vm.signOut() }) }

        composable(Routes.HOME) {
            HomeScreen(vm, nav = { r ->
                when (r) {
                    "checkin" -> nav.navigate(Routes.CHECK_IN); "checkout" -> nav.navigate(Routes.CHECK_OUT)
                    "patrols" -> nav.navigate(Routes.PATROLS); "tasks" -> nav.navigate(Routes.TASKS); "leave" -> nav.navigate(Routes.LEAVE)
                    "history" -> nav.navigate(Routes.HISTORY); "profile" -> nav.navigate(Routes.PROFILE); "notifications" -> nav.navigate(Routes.NOTIFICATIONS)
                }
            })
        }
        composable(Routes.CHECK_IN) {
            ShiftCaptureScreen(vm, end = false, onDone = { Toast.makeText(ctx, R.string.checkin_done, Toast.LENGTH_SHORT).show(); nav.popBackStack() }, onBack = { nav.popBackStack() })
        }
        composable(Routes.CHECK_OUT) {
            ShiftCaptureScreen(vm, end = true, onDone = { Toast.makeText(ctx, R.string.checkout_done, Toast.LENGTH_SHORT).show(); nav.popBackStack() }, onBack = { nav.popBackStack() })
        }
        composable(Routes.PATROLS) { PatrolsScreen(vm, onOpen = { nav.navigate(Routes.patrol(it)) }, onBack = { nav.popBackStack() }) }
        composable(Routes.PATROL) { entry ->
            val id = entry.arguments?.getString("id") ?: return@composable
            PatrolRunScreen(vm, id, onDone = { nav.popBackStack() }, onBack = { nav.popBackStack() })
        }
        composable(Routes.TASKS) { TasksScreen(vm, onOpen = { nav.navigate(Routes.task(it)) }, onBack = { nav.popBackStack() }) }
        composable(Routes.TASK) { entry ->
            val id = entry.arguments?.getString("id") ?: return@composable
            TaskDoScreen(vm, id, onDone = { Toast.makeText(ctx, R.string.task_done, Toast.LENGTH_SHORT).show(); nav.popBackStack() }, onBack = { nav.popBackStack() })
        }
        composable(Routes.LEAVE) { LeaveScreen(onApply = { nav.navigate(Routes.LEAVE_APPLY) }, onBack = { nav.popBackStack() }) }
        composable(Routes.LEAVE_APPLY) { ApplyLeaveScreen(onDone = { Toast.makeText(ctx, R.string.leave_submitted, Toast.LENGTH_SHORT).show(); nav.popBackStack() }, onBack = { nav.popBackStack() }) }
        composable(Routes.HISTORY) { HistoryScreen(onBack = { nav.popBackStack() }) }
        composable(Routes.PROFILE) {
            ProfileScreen(vm, onChangePin = { nav.navigate(Routes.CHANGE_PIN) }, onRetakeSelfie = { nav.navigate("regselfie/again") }, onBack = { nav.popBackStack() })
        }
        composable("regselfie/again") { RegistrationSelfieScreen(onDone = { nav.popBackStack() }, onBack = { nav.popBackStack() }) }
        composable(Routes.NOTIFICATIONS) { NotificationsScreen(onBack = { nav.popBackStack() }) }
    }
}
