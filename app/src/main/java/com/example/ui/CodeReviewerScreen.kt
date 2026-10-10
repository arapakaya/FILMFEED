package com.example.ui

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.engine.SmartMockAnalyzer
import com.example.model.CodeAnalysisResult
import com.example.ui.components.CodeInputSection
import com.example.ui.components.DiagnosticOutputContainer
import com.example.ui.components.ScanningAnimationHud
import com.example.ui.components.cyberGridBackground
import com.example.ui.theme.MonoBlack
import com.example.ui.theme.MonoCardBorder
import com.example.ui.theme.MonoWhite
import com.example.ui.theme.TextMuted
import com.example.ui.theme.TextPrimary
import com.example.ui.theme.TextSecondary
import kotlinx.coroutines.launch

@Composable
fun CodeReviewerScreen() {
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    val snackbarHostState = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()

    var inputCode by remember {
        mutableStateOf(SmartMockAnalyzer.presets.first().code)
    }
    var selectedLanguage by remember { mutableStateOf("JavaScript") }
    var isAnalyzing by remember { mutableStateOf(false) }
    var analysisResult by remember { mutableStateOf<CodeAnalysisResult?>(null) }

    fun triggerHaptic() {
        try {
            val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createOneShot(30, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(30)
            }
        } catch (_: Exception) {}
    }

    fun startAnalysis() {
        triggerHaptic()
        isAnalyzing = true
        analysisResult = null
    }

    fun onScanFinished() {
        isAnalyzing = false
        analysisResult = SmartMockAnalyzer.analyze(inputCode, selectedLanguage)
        triggerHaptic()
    }

    Scaffold(
        modifier = Modifier
            .fillMaxSize()
            .background(MonoBlack),
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = MonoBlack
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .cyberGridBackground(gridSize = 64f, lineColor = Color(0x0CFFFFFF))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp, vertical = 10.dp)
            ) {
                // Monochrome Top App Bar
                CyberTopAppBar(
                    onResetToSample = {
                        val sample = SmartMockAnalyzer.presets.first()
                        inputCode = sample.code
                        selectedLanguage = sample.language
                        analysisResult = null
                        triggerHaptic()
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("Sample JavaScript bug loaded")
                        }
                    }
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Adaptive Content: Split view on wide screens (>= 700dp), vertical stack on mobile
                BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
                    val isWideScreen = maxWidth >= 700.dp

                    if (isWideScreen) {
                        // Wide Screen: Dual Pane (Left: Input, Right: Diagnostics)
                        Row(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(bottom = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            // Left Pane: Code Input
                            Column(
                                modifier = Modifier
                                    .weight(0.48f)
                                    .fillMaxHeight()
                                    .verticalScroll(rememberScrollState()),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                CodeInputSection(
                                    code = inputCode,
                                    onCodeChange = { inputCode = it },
                                    selectedLanguage = selectedLanguage,
                                    onLanguageChange = { selectedLanguage = it },
                                    onAnalyzeClick = { startAnalysis() },
                                    onPasteClick = {
                                        clipboardManager.getText()?.let {
                                            inputCode = it.text
                                            triggerHaptic()
                                        }
                                    },
                                    onClearClick = {
                                        inputCode = ""
                                        analysisResult = null
                                        triggerHaptic()
                                    },
                                    isAnalyzing = isAnalyzing
                                )
                            }

                            // Right Pane: Output Container / Scanner / Empty State
                            Column(
                                modifier = Modifier
                                    .weight(0.52f)
                                    .fillMaxHeight()
                                    .verticalScroll(rememberScrollState()),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                if (isAnalyzing) {
                                    ScanningAnimationHud(
                                        onAnimationComplete = { onScanFinished() }
                                    )
                                } else if (analysisResult != null) {
                                    DiagnosticOutputContainer(
                                        result = analysisResult!!,
                                        onCopyCode = { codeToCopy ->
                                            clipboardManager.setText(AnnotatedString(codeToCopy))
                                            triggerHaptic()
                                            coroutineScope.launch {
                                                snackbarHostState.showSnackbar("Fixed code copied to clipboard!")
                                            }
                                        },
                                        onApplyToEditor = { fixedCode ->
                                            inputCode = fixedCode
                                            triggerHaptic()
                                            coroutineScope.launch {
                                                snackbarHostState.showSnackbar("Applied clean fix to code input!")
                                            }
                                        }
                                    )
                                } else {
                                    CyberEmptyStateCard(
                                        onPickPreset = { preset ->
                                            inputCode = preset.code
                                            selectedLanguage = preset.language
                                            triggerHaptic()
                                        }
                                    )
                                }
                            }
                        }
                    } else {
                        // Compact Screen (Mobile Portrait): Smooth Scrollable Stack
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            verticalArrangement = Arrangement.spacedBy(14.dp),
                            contentPadding = PaddingValues(bottom = 24.dp)
                        ) {
                            // Section 1: Code Input
                            item(key = "input_section") {
                                CodeInputSection(
                                    code = inputCode,
                                    onCodeChange = { inputCode = it },
                                    selectedLanguage = selectedLanguage,
                                    onLanguageChange = { selectedLanguage = it },
                                    onAnalyzeClick = { startAnalysis() },
                                    onPasteClick = {
                                        clipboardManager.getText()?.let {
                                            inputCode = it.text
                                            triggerHaptic()
                                        }
                                    },
                                    onClearClick = {
                                        inputCode = ""
                                        analysisResult = null
                                        triggerHaptic()
                                    },
                                    isAnalyzing = isAnalyzing
                                )
                            }

                            // Section 2: Scanning HUD / Output / Empty
                            if (isAnalyzing) {
                                item(key = "scanning_hud") {
                                    ScanningAnimationHud(
                                        onAnimationComplete = { onScanFinished() }
                                    )
                                }
                            } else if (analysisResult != null) {
                                item(key = "diagnostic_output") {
                                    DiagnosticOutputContainer(
                                        result = analysisResult!!,
                                        onCopyCode = { codeToCopy ->
                                            clipboardManager.setText(AnnotatedString(codeToCopy))
                                            triggerHaptic()
                                            coroutineScope.launch {
                                                snackbarHostState.showSnackbar("Fixed code copied to clipboard!")
                                            }
                                        },
                                        onApplyToEditor = { fixedCode ->
                                            inputCode = fixedCode
                                            triggerHaptic()
                                            coroutineScope.launch {
                                                snackbarHostState.showSnackbar("Applied clean fix to editor!")
                                            }
                                        }
                                    )
                                }
                            } else {
                                item(key = "empty_state") {
                                    CyberEmptyStateCard(
                                        onPickPreset = { preset ->
                                            inputCode = preset.code
                                            selectedLanguage = preset.language
                                            triggerHaptic()
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CyberTopAppBar(
    onResetToSample: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF0F0F0F))
            .border(1.dp, MonoCardBorder, RoundedCornerShape(12.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(34.dp)
                    .background(Color(0xFF1C1C1C), CircleShape)
                    .border(1.dp, MonoWhite, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.BugReport,
                    contentDescription = null,
                    tint = MonoWhite,
                    modifier = Modifier.size(18.dp)
                )
            }

            Spacer(modifier = Modifier.width(10.dp))

            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "SMART CODE REVIEWER",
                        color = MonoWhite,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.ExtraBold,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 1.sp
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color(0xFF262626))
                            .border(0.5.dp, MonoWhite, RoundedCornerShape(4.dp))
                            .padding(horizontal = 5.dp, vertical = 1.dp)
                    ) {
                        Text(
                            text = "MONO v2.4",
                            color = MonoWhite,
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .background(MonoWhite, CircleShape)
                    )
                    Spacer(modifier = Modifier.width(5.dp))
                    Text(
                        text = "AST ENGINE ACTIVE • MONOCHROME EDITION",
                        color = TextMuted,
                        fontSize = 9.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }

        IconButton(
            onClick = onResetToSample,
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(Color(0xFF171717))
                .border(1.dp, MonoCardBorder, CircleShape)
        ) {
            Icon(
                imageVector = Icons.Default.Refresh,
                contentDescription = "Load Default Sample",
                tint = MonoWhite,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

@Composable
fun CyberEmptyStateCard(
    onPickPreset: (com.example.model.CodePreset) -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Color(0xFF0F0F0F))
            .border(1.dp, MonoCardBorder, RoundedCornerShape(14.dp))
            .padding(18.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(54.dp)
                    .background(Color(0xFF171717), CircleShape)
                    .border(1.dp, MonoWhite.copy(alpha = 0.5f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Shield,
                    contentDescription = null,
                    tint = MonoWhite,
                    modifier = Modifier.size(28.dp)
                )
            }

            Text(
                text = "READY FOR STATIC CODE AUDIT",
                color = MonoWhite,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 1.sp
            )

            Text(
                text = "Paste code or error logs in the input panel above and tap 'ANALYZE CODE & FIX BUGS' to detect vulnerabilities, off-by-one errors, and unhandled promises with instant automated patches.",
                color = TextSecondary,
                fontSize = 12.sp,
                lineHeight = 18.sp,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )

            Text(
                text = "OR LOAD A PRE-BUILT SCENARIO:",
                color = MonoWhite,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 1.sp,
                modifier = Modifier.padding(top = 4.dp)
            )

            // Preset Quick Buttons
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                SmartMockAnalyzer.presets.take(3).forEach { preset ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF171717))
                            .border(1.dp, MonoCardBorder, RoundedCornerShape(8.dp))
                            .clickable { onPickPreset(preset) }
                            .padding(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Code,
                                    contentDescription = null,
                                    tint = MonoWhite,
                                    modifier = Modifier.size(14.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = preset.title,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    fontFamily = FontFamily.Monospace,
                                    color = TextPrimary
                                )
                            }
                            Text(
                                text = preset.language,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace,
                                color = TextMuted
                            )
                        }
                    }
                }
            }
        }
    }
}
