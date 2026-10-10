package com.example.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.example.ui.theme.MonoWhite

@Composable
fun LaserScanOverlay(
    modifier: Modifier = Modifier,
    heightDp: Dp = 220.dp
) {
    val infiniteTransition = rememberInfiniteTransition(label = "laser_transition")
    val offsetYRatio by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1400, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "laser_y"
    )

    Box(modifier = modifier) {
        val yOffset = heightDp * offsetYRatio
        Box(
            modifier = Modifier
                .offset(y = yOffset)
                .fillMaxWidth()
                .height(2.5.dp)
                .background(
                    Brush.horizontalGradient(
                        listOf(
                            Color.Transparent,
                            MonoWhite.copy(alpha = 0.3f),
                            MonoWhite,
                            Color.White,
                            MonoWhite,
                            MonoWhite.copy(alpha = 0.3f),
                            Color.Transparent
                        )
                    )
                )
        )
    }
}

fun Modifier.cyberBorder(
    width: Dp = 1.dp,
    glowColor: Color = MonoWhite.copy(alpha = 0.5f),
    shapeRadius: Dp = 10.dp
): Modifier = this
    .border(
        width = width,
        brush = Brush.linearGradient(
            listOf(
                glowColor,
                glowColor.copy(alpha = 0.2f),
                glowColor
            )
        ),
        shape = RoundedCornerShape(shapeRadius)
    )

fun Modifier.cyberGridBackground(
    gridSize: Float = 60f,
    lineColor: Color = Color(0x10FFFFFF)
): Modifier = this.drawBehind {
    val width = size.width
    val height = size.height

    var x = 0f
    while (x <= width) {
        drawLine(
            color = lineColor,
            start = Offset(x, 0f),
            end = Offset(x, height),
            strokeWidth = 1f
        )
        x += gridSize
    }

    var y = 0f
    while (y <= height) {
        drawLine(
            color = lineColor,
            start = Offset(0f, y),
            end = Offset(width, y),
            strokeWidth = 1f
        )
        y += gridSize
    }
}
