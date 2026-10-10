package com.example.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.MonoBlack
import com.example.ui.theme.MonoCardBg
import com.example.ui.theme.MonoCardBorder
import com.example.ui.theme.MonoWhite
import com.example.ui.theme.TextMuted
import com.example.ui.theme.TextPrimary
import kotlinx.coroutines.delay

@Composable
fun ScanningAnimationHud(
    modifier: Modifier = Modifier,
    onAnimationComplete: () -> Unit
) {
    val progress = remember { Animatable(0f) }
    var currentLogIndex by remember { mutableIntStateOf(0) }

    val scanSteps = listOf(
        "> Tokenizing code into Abstract Syntax Tree (AST)...",
        "> Auditing async/await Promise lifecycles & closures...",
        "> Scanning for SQL injection & null-safety violations...",
        "> Optimizing algorithmic complexity & removing anti-patterns...",
        "> Generating verified, clean corrected code block..."
    )

    LaunchedEffect(Unit) {
        for (i in scanSteps.indices) {
            currentLogIndex = i
            val target = (i + 1).toFloat() / scanSteps.size
            progress.animateTo(
                targetValue = target,
                animationSpec = tween(380, easing = FastOutSlowInEasing)
            )
            delay(120)
        }
        delay(150)
        onAnimationComplete()
    }

    val infiniteTransition = rememberInfiniteTransition(label = "hud_scan")
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.4f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(600, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse_alpha"
    )

    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MonoCardBg)
            .border(1.dp, MonoCardBorder, RoundedCornerShape(12.dp))
            .padding(16.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Header Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .background(MonoWhite.copy(alpha = pulseAlpha), CircleShape)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "MONOCHROME BUG SCANNER",
                        color = MonoWhite,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 1.sp
                    )
                }

                Text(
                    text = "${(progress.value * 100).toInt()}%",
                    color = MonoWhite,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace
                )
            }

            // Monochrome Progress Bar
            LinearProgressIndicator(
                progress = { progress.value },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(5.dp)
                    .clip(RoundedCornerShape(3.dp)),
                color = MonoWhite,
                trackColor = Color(0xFF262626),
            )

            // Terminal Logs
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MonoBlack, RoundedCornerShape(8.dp))
                    .border(1.dp, MonoCardBorder, RoundedCornerShape(8.dp))
                    .padding(12.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Terminal,
                            contentDescription = null,
                            tint = MonoWhite,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "LIVE AST ENGINE LOGS",
                            color = TextMuted,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    scanSteps.take(currentLogIndex + 1).forEachIndexed { idx, step ->
                        val isLatest = idx == currentLogIndex
                        Text(
                            text = step,
                            color = if (isLatest) MonoWhite else TextPrimary.copy(alpha = 0.6f),
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            fontWeight = if (isLatest) FontWeight.Bold else FontWeight.Normal,
                            lineHeight = 16.sp
                        )
                    }
                }
            }
        }
    }
}
