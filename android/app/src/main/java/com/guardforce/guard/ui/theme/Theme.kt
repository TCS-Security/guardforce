package com.guardforce.guard.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.guardforce.guard.R

// Tokens from dashboard/src/app/globals.css — the app and the control room are one product.
val Paper = Color(0xFFF9F7F3)
val Ink = Color(0xFF1D1711)
val Olive = Color(0xFF375028)
val OliveSoft = Color(0xFFDFEDD9)
val Signal = Color(0xFFE84C23)
val SignalSoft = Color(0xFFFFE8E1)
val Card = Color(0xFFFEFDFB)
val Secondary = Color(0xFFEFECE6)
val Accent = Color(0xFFEBE8DF)
val Border = Color(0xFFDDD9D0)
val MutedFg = Color(0xFF69625A)
val Destructive = Color(0xFFCC2827)
val Present = Color(0xFF2A904B)
val HalfDay = Color(0xFFDE9D16)
val Absent = Color(0xFFD02C2A)
val OnLeave = Color(0xFF6084A9)

@Immutable
data class GfTones(
    val present: Color, val halfDay: Color, val absent: Color, val onLeave: Color,
    val signal: Color, val signalSoft: Color, val olive: Color, val oliveSoft: Color,
    val muted: Color, val border: Color, val paper: Color, val ink: Color,
)

val LocalTones = staticCompositionLocalOf<GfTones> { DefaultTones }

private val LightScheme = lightColorScheme(
    primary = Olive, onPrimary = Color(0xFFFBFAF6), primaryContainer = OliveSoft, onPrimaryContainer = Olive,
    secondary = Secondary, onSecondary = Ink, secondaryContainer = Accent, onSecondaryContainer = Ink,
    tertiary = Signal, onTertiary = Color.White,
    background = Paper, onBackground = Ink, surface = Card, onSurface = Ink,
    surfaceVariant = Accent, onSurfaceVariant = MutedFg, outline = Border, outlineVariant = Border,
    error = Destructive, onError = Color.White, errorContainer = SignalSoft, onErrorContainer = Destructive,
)

private val DarkScheme = darkColorScheme(
    primary = Color(0xFF9DBB86), onPrimary = Ink, primaryContainer = Color(0xFF2C3F22), onPrimaryContainer = Color(0xFFDFEDD9),
    secondary = Color(0xFF2E2721), onSecondary = Paper, secondaryContainer = Color(0xFF362E27), onSecondaryContainer = Paper,
    tertiary = Signal, onTertiary = Color.White,
    background = Ink, onBackground = Paper, surface = Color(0xFF262019), onSurface = Paper,
    surfaceVariant = Color(0xFF352D25), onSurfaceVariant = Color(0xFFB4A99C), outline = Color(0xFF3F362D), outlineVariant = Color(0xFF3F362D),
    error = Color(0xFFF08A82), onError = Ink, errorContainer = Color(0xFF4A1F1B), onErrorContainer = Color(0xFFFFD6D0),
)

private val DarkTones = GfTones(
    present = Color(0xFF5FBF7C), halfDay = Color(0xFFE6B04A), absent = Color(0xFFF07070), onLeave = Color(0xFF8DB0D4),
    signal = Color(0xFFFF6B45), signalSoft = Color(0xFF4A2418), olive = Color(0xFF9DBB86), oliveSoft = Color(0xFF2C3F22),
    muted = Color(0xFFB4A99C), border = Color(0xFF3F362D), paper = Ink, ink = Paper,
)

@OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
private fun variable(res: Int, weight: Int) = Font(res, FontWeight(weight), variationSettings = FontVariation.Settings(FontVariation.weight(weight)))

val Display = FontFamily(variable(R.font.bricolage_grotesque, 500), variable(R.font.bricolage_grotesque, 600), variable(R.font.bricolage_grotesque, 700))
val Body = FontFamily(variable(R.font.schibsted_grotesk, 400), variable(R.font.schibsted_grotesk, 500), variable(R.font.schibsted_grotesk, 600), variable(R.font.schibsted_grotesk, 700))
val Mono = FontFamily(variable(R.font.jetbrains_mono, 400), variable(R.font.jetbrains_mono, 500), variable(R.font.jetbrains_mono, 600))

val GfTypography = Typography(
    displayLarge = TextStyle(fontFamily = Display, fontWeight = FontWeight.SemiBold, fontSize = 44.sp, lineHeight = 46.sp, letterSpacing = (-0.02).em),
    displayMedium = TextStyle(fontFamily = Display, fontWeight = FontWeight.SemiBold, fontSize = 34.sp, lineHeight = 38.sp, letterSpacing = (-0.02).em),
    displaySmall = TextStyle(fontFamily = Display, fontWeight = FontWeight.SemiBold, fontSize = 28.sp, lineHeight = 32.sp, letterSpacing = (-0.015).em),
    headlineMedium = TextStyle(fontFamily = Display, fontWeight = FontWeight.SemiBold, fontSize = 24.sp, lineHeight = 28.sp, letterSpacing = (-0.01).em),
    headlineSmall = TextStyle(fontFamily = Display, fontWeight = FontWeight.SemiBold, fontSize = 20.sp, lineHeight = 24.sp),
    titleLarge = TextStyle(fontFamily = Body, fontWeight = FontWeight.SemiBold, fontSize = 19.sp, lineHeight = 24.sp),
    titleMedium = TextStyle(fontFamily = Body, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 22.sp),
    titleSmall = TextStyle(fontFamily = Body, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 20.sp),
    bodyLarge = TextStyle(fontFamily = Body, fontWeight = FontWeight.Normal, fontSize = 17.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontFamily = Body, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 21.sp),
    bodySmall = TextStyle(fontFamily = Body, fontWeight = FontWeight.Normal, fontSize = 13.sp, lineHeight = 18.sp),
    labelLarge = TextStyle(fontFamily = Body, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 20.sp),
    labelMedium = TextStyle(fontFamily = Mono, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 16.sp, letterSpacing = 0.04.em),
    labelSmall = TextStyle(fontFamily = Mono, fontWeight = FontWeight.Medium, fontSize = 11.sp, lineHeight = 14.sp, letterSpacing = 0.12.em),
)

val GfShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp), small = RoundedCornerShape(8.dp), medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp), extraLarge = RoundedCornerShape(24.dp),
)

val DefaultTones = GfTones(Present, HalfDay, Absent, OnLeave, Signal, SignalSoft, Olive, OliveSoft, MutedFg, Border, Paper, Ink)

@Composable
fun GuardForceTheme(dark: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalTones provides if (dark) DarkTones else DefaultTones) {
        MaterialTheme(colorScheme = if (dark) DarkScheme else LightScheme, typography = GfTypography, shapes = GfShapes, content = content)
    }
}
