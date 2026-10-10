package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.ContentPaste
import androidx.compose.material.icons.filled.FlashOn
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.engine.SmartMockAnalyzer
import com.example.ui.theme.MonoBlack
import com.example.ui.theme.MonoCardBg
import com.example.ui.theme.MonoCardBorder
import com.example.ui.theme.MonoWhite
import com.example.ui.theme.TextMuted
import com.example.ui.theme.TextPrimary
import com.example.ui.theme.TextSecondary

@Composable
fun CodeInputSection(
    code: String,
    onCodeChange: (String) -> Unit,
    selectedLanguage: String,
    onLanguageChange: (String) -> Unit,
    onAnalyzeClick: () -> Unit,
    onPasteClick: () -> Unit,
    onClearClick: () -> Unit,
    isAnalyzing: Boolean,
    modifier: Modifier = Modifier
) {
    val languages = listOf("JavaScript", "Python", "React", "Kotlin", "SQL", "Java", "C++")
    var presetMenuExpanded by remember { mutableStateOf(false) }

    val lineCount = remember(code) { if (code.isEmpty()) 0 else code.lines().size }
    val charCount = remember(code) { code.length }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(MonoCardBg)
            .border(1.dp, MonoCardBorder, RoundedCornerShape(14.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Top Section: Title & Sample Presets dropdown
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .background(MonoWhite, CircleShape)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "SOURCE CODE INPUT / ERROR LOGS",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = MonoWhite,
                    letterSpacing = 0.5.sp
                )
            }

            // Quick Preset Loader Button (Monochrome)
            Box {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color(0xFF171717))
                        .border(1.dp, MonoWhite.copy(alpha = 0.5f), RoundedCornerShape(6.dp))
                        .clickable { presetMenuExpanded = true }
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.FlashOn,
                            contentDescription = null,
                            tint = MonoWhite,
                            modifier = Modifier.size(12.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "SAMPLE BUGS",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            color = MonoWhite
                        )
                    }
                }

                DropdownMenu(
                    expanded = presetMenuExpanded,
                    onDismissRequest = { presetMenuExpanded = false },
                    modifier = Modifier.background(Color(0xFF141414))
                ) {
                    SmartMockAnalyzer.presets.forEach { preset ->
                        DropdownMenuItem(
                            text = {
                                Column {
                                    Text(
                                        text = preset.title,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = TextPrimary
                                    )
                                    Text(
                                        text = preset.description,
                                        fontSize = 10.sp,
                                        color = TextMuted,
                                        maxLines = 1
                                    )
                                }
                            },
                            onClick = {
                                onCodeChange(preset.code)
                                if (preset.language.contains("React")) onLanguageChange("React")
                                else if (preset.language.contains("Python")) onLanguageChange("Python")
                                else if (preset.language.contains("Kotlin")) onLanguageChange("Kotlin")
                                else if (preset.language.contains("SQL")) onLanguageChange("SQL")
                                else onLanguageChange("JavaScript")
                                presetMenuExpanded = false
                            }
                        )
                    }
                }
            }
        }

        // Language Pill Carousel (Monochrome Selected State)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            languages.forEach { lang ->
                val isSelected = selectedLanguage == lang
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(if (isSelected) MonoWhite else Color(0xFF141414))
                        .border(
                            1.dp,
                            if (isSelected) MonoWhite else MonoCardBorder,
                            RoundedCornerShape(6.dp)
                        )
                        .clickable { onLanguageChange(lang) }
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = lang,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                        color = if (isSelected) MonoBlack else TextSecondary
                    )
                }
            }
        }

        // Code Editor Textarea Area
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 180.dp, max = 320.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(MonoBlack)
                .border(1.dp, MonoWhite.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                .padding(12.dp)
        ) {
            if (code.isEmpty()) {
                Text(
                    text = "// Paste your buggy JavaScript, Python, React, Kotlin, or SQL code here...\n// Or click [SAMPLE BUGS] above to test the automated reviewer.\n\nfunction example() {\n  // Code or stack trace...\n}",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp,
                    color = TextMuted.copy(alpha = 0.5f),
                    lineHeight = 18.sp
                )
            }

            BasicTextField(
                value = code,
                onValueChange = onCodeChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("code_input_textarea"),
                textStyle = TextStyle(
                    fontFamily = FontFamily.Monospace,
                    fontSize = 13.sp,
                    color = TextPrimary,
                    lineHeight = 19.sp
                ),
                cursorBrush = SolidColor(MonoWhite)
            )

            // Laser scanner overlay when analyzing
            if (isAnalyzing) {
                LaserScanOverlay(
                    modifier = Modifier.matchParentSize(),
                    heightDp = 180.dp
                )
            }
        }

        // Bottom Editor Info & Action Buttons
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "$lineCount lines • $charCount chars",
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                color = TextMuted
            )

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                // Paste button
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color(0xFF141414))
                        .border(1.dp, MonoCardBorder, RoundedCornerShape(6.dp))
                        .clickable(onClick = onPasteClick)
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.ContentPaste,
                            contentDescription = "Paste",
                            tint = MonoWhite,
                            modifier = Modifier.size(12.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "PASTE",
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            color = MonoWhite
                        )
                    }
                }

                // Clear button
                if (code.isNotEmpty()) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color(0xFF141414))
                            .border(1.dp, MonoCardBorder, RoundedCornerShape(6.dp))
                            .clickable(onClick = onClearClick)
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Clear,
                                contentDescription = "Clear",
                                tint = TextMuted,
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "CLEAR",
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                color = TextMuted
                            )
                        }
                    }
                }
            }
        }

        // Prominent monochrome "Analyze Code" button
        NeonAnalyzeButton(
            text = "ANALYZE CODE & FIX BUGS",
            onClick = onAnalyzeClick,
            modifier = Modifier.fillMaxWidth(),
            isLoading = isAnalyzing,
            enabled = code.isNotBlank()
        )
    }
}
