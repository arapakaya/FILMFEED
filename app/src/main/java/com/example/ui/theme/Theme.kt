package com.example.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val MonochromeColorScheme = darkColorScheme(
    primary = MonoWhite,
    onPrimary = MonoBlack,
    primaryContainer = MonoDarkGray,
    onPrimaryContainer = MonoWhite,
    secondary = MonoSilver,
    onSecondary = MonoBlack,
    tertiary = MonoLightGray,
    onTertiary = MonoBlack,
    background = MonoBlack,
    onBackground = MonoWhite,
    surface = MonoCardBg,
    onSurface = MonoWhite,
    surfaceVariant = MonoSurfaceElevated,
    onSurfaceVariant = MonoLightGray,
    outline = MonoCardBorder,
    error = MonoWhite,
    onError = MonoBlack
)

@Composable
fun SmartCodeReviewerTheme(
    content: @Composable () -> Unit
) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window
            window?.let {
                it.statusBarColor = MonoBlack.toArgb()
                it.navigationBarColor = MonoBlack.toArgb()
                WindowCompat.getInsetsController(it, view).apply {
                    isAppearanceLightStatusBars = false
                    isAppearanceLightNavigationBars = false
                }
            }
        }
    }

    MaterialTheme(
        colorScheme = MonochromeColorScheme,
        typography = Typography,
        content = content
    )
}
