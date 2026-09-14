package com.guardforce.guard

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.guardforce.guard.ui.AppViewModel
import com.guardforce.guard.ui.nav.AppNav
import com.guardforce.guard.ui.theme.GuardForceTheme

/** AppCompatActivity (not ComponentActivity) so per-app locales work below Android 13 and BiometricPrompt has a FragmentActivity. */
class MainActivity : AppCompatActivity() {
    private val vm: AppViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            GuardForceTheme { AppNav(vm) }
        }
    }

    override fun onResume() {
        super.onResume()
        vm.refresh()
    }
}
