package com.example.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.engine.SmartMockAnalyzer
import com.example.model.AnalysisSummary
import com.example.model.CodeAnalysisResult
import com.example.model.CodeIssue
import com.example.model.IssueSeverity
import com.example.ui.theme.MonoBlack
import com.example.ui.theme.MonoCardBg
import com.example.ui.theme.MonoCardBorder
import com.example.ui.theme.MonoDarkGray
import com.example.ui.theme.MonoLightGray
import com.example.ui.theme.MonoSilver
import com.example.ui.theme.MonoWhite
import com.example.ui.theme.TextMuted
import com.example.ui.theme.TextPrimary
import com.example.ui.theme.TextSecondary

@Composable
fun DiagnosticOutputContainer(
    result: CodeAnalysisResult,
    onCopyCode: (String) -> Unit,
    onApplyToEditor: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    var copiedRecently by remember { mutableStateOf(false) }

    val diffLines = remember(result.originalCode, result.correctedCode) {
        SmartMockAnalyzer.computeDiff(result.originalCode, result.correctedCode)
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(MonoCardBg)
            .border(1.dp, MonoCardBorder, RoundedCornerShape(14.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Summary Header & Score Card
        SummaryScoreCard(summary = result.summary)

        // Sub Navigation Tabs: Issues / Corrected Code / Diff
        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = Color(0xFF0F0F0F),
            contentColor = MonoWhite,
            indicator = { tabPositions ->
                TabRowDefaults.SecondaryIndicator(
                    modifier = Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                    color = MonoWhite,
                    height = 2.dp
                )
            },
            divider = {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(MonoCardBorder)
                )
            }
        ) {
            Tab(
                selected = selectedTab == 0,
                onClick = { selectedTab = 0 },
                text = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.BugReport,
                            contentDescription = null,
                            modifier = Modifier.size(15.dp),
                            tint = if (selectedTab == 0) MonoWhite else TextMuted
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "ERRORS (${result.issues.size})",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            color = if (selectedTab == 0) MonoWhite else TextMuted
                        )
                    }
                }
            )

            Tab(
                selected = selectedTab == 1,
                onClick = { selectedTab = 1 },
                text = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Code,
                            contentDescription = null,
                            modifier = Modifier.size(15.dp),
                            tint = if (selectedTab == 1) MonoWhite else TextMuted
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "CLEAN FIX",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            color = if (selectedTab == 1) MonoWhite else TextMuted
                        )
                    }
                }
            )

            Tab(
                selected = selectedTab == 2,
                onClick = { selectedTab = 2 },
                text = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = null,
                            modifier = Modifier.size(15.dp),
                            tint = if (selectedTab == 2) MonoWhite else TextMuted
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "DIFF VIEW",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            color = if (selectedTab == 2) MonoWhite else TextMuted
                        )
                    }
                }
            )
        }

        // Tab Content
        when (selectedTab) {
            0 -> {
                IdentifiedIssuesBulletList(issues = result.issues)
            }
            1 -> {
                CorrectedCodeContainer(
                    correctedCode = result.correctedCode,
                    language = result.language,
                    copiedRecently = copiedRecently,
                    onCopyCode = {
                        copiedRecently = true
                        onCopyCode(result.correctedCode)
                    },
                    onApplyToEditor = {
                        onApplyToEditor(result.correctedCode)
                    }
                )
            }
            2 -> {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "MODIFIED CODE DIFF",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            color = MonoWhite
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                text = "- Removed",
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace,
                                color = TextMuted
                            )
                            Text(
                                text = "+ Added Fix",
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace,
                                color = MonoWhite
                            )
                        }
                    }
                    DiffCodeView(diffLines = diffLines)
                }
            }
        }
    }
}

@Composable
fun SummaryScoreCard(summary: AnalysisSummary) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Color(0xFF0F0F0F))
            .border(1.dp, MonoCardBorder, RoundedCornerShape(10.dp))
            .padding(12.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .background(Color(0xFF1C1C1C), CircleShape)
                            .border(1.5.dp, MonoWhite, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "${summary.score}",
                            color = MonoWhite,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "HEALTH SCORE",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            color = TextMuted,
                            letterSpacing = 1.sp
                        )
                        Text(
                            text = if (summary.score < 50) "Critical Issues Detected" else if (summary.score < 80) "Improvements Needed" else "Optimized Clean State",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = TextPrimary
                        )
                    }
                }

                // Monochrome Risk Badge
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(if (summary.riskLevel == "CRITICAL") MonoWhite else Color(0xFF262626))
                        .border(1.dp, MonoWhite, RoundedCornerShape(6.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "RISK: ${summary.riskLevel}",
                        color = if (summary.riskLevel == "CRITICAL") MonoBlack else MonoWhite,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }

            // Stat Badges Row (Black and White)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                StatBadge(
                    label = "Bugs",
                    count = summary.bugCount,
                    icon = Icons.Default.BugReport,
                    modifier = Modifier.weight(1f)
                )
                StatBadge(
                    label = "Security",
                    count = summary.securityCount,
                    icon = Icons.Default.Security,
                    modifier = Modifier.weight(1f)
                )
                StatBadge(
                    label = "Warnings",
                    count = summary.warningCount,
                    icon = Icons.Default.Warning,
                    modifier = Modifier.weight(1f)
                )
                StatBadge(
                    label = "Optimizations",
                    count = summary.optimizationCount,
                    icon = Icons.Default.Speed,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
fun StatBadge(
    label: String,
    count: Int,
    icon: ImageVector,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(6.dp))
            .background(Color(0xFF141414))
            .border(1.dp, MonoCardBorder, RoundedCornerShape(6.dp))
            .padding(vertical = 6.dp, horizontal = 4.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = MonoWhite,
                    modifier = Modifier.size(11.dp)
                )
                Spacer(modifier = Modifier.width(3.dp))
                Text(
                    text = "$count",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = MonoWhite
                )
            }
            Text(
                text = label,
                fontSize = 9.sp,
                fontFamily = FontFamily.Monospace,
                color = TextMuted
            )
        }
    }
}

@Composable
fun IdentifiedIssuesBulletList(
    issues: List<CodeIssue>,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "IDENTIFIED ERRORS & IMPROVEMENTS",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = MonoWhite,
                letterSpacing = 1.sp
            )
            Text(
                text = "${issues.size} findings",
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                color = TextMuted
            )
        }

        issues.forEachIndexed { index, issue ->
            IssueBulletItem(issue = issue, index = index + 1)
        }
    }
}

@Composable
fun IssueBulletItem(
    issue: CodeIssue,
    index: Int
) {
    var expanded by remember { mutableStateOf(false) }

    val isCritical = issue.severity == IssueSeverity.CRITICAL

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Color(0xFF0F0F0F))
            .border(
                1.dp,
                if (isCritical) MonoWhite else MonoCardBorder,
                RoundedCornerShape(10.dp)
            )
            .clickable { expanded = !expanded }
            .padding(12.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            // Header Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.Top
                ) {
                    // Bullet dot in white
                    Box(
                        modifier = Modifier
                            .padding(top = 5.dp)
                            .size(7.dp)
                            .background(if (isCritical) MonoWhite else MonoSilver, CircleShape)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            // High-contrast severity pill
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(if (isCritical) MonoWhite else Color(0xFF262626))
                                    .border(0.5.dp, MonoWhite, RoundedCornerShape(4.dp))
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = issue.severity.label,
                                    color = if (isCritical) MonoBlack else MonoWhite,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace
                                )
                            }

                            if (issue.lineNumber != null) {
                                Text(
                                    text = "Line ${issue.lineNumber}",
                                    color = TextMuted,
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(4.dp))

                        Text(
                            text = issue.title,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = TextPrimary
                        )
                    }
                }

                Icon(
                    imageVector = if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = if (expanded) "Collapse" else "Expand",
                    tint = TextMuted,
                    modifier = Modifier.size(20.dp)
                )
            }

            // Description
            Text(
                text = issue.description,
                fontSize = 12.sp,
                color = TextSecondary,
                lineHeight = 18.sp,
                modifier = Modifier.padding(start = 15.dp)
            )

            // Expanded Fix Suggestion (Monochrome)
            AnimatedVisibility(
                visible = expanded,
                enter = fadeIn() + expandVertically(),
                exit = fadeOut() + shrinkVertically()
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 15.dp, top = 6.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color(0xFF1A1A1A))
                        .border(1.dp, MonoWhite.copy(alpha = 0.4f), RoundedCornerShape(6.dp))
                        .padding(10.dp)
                ) {
                    Row(verticalAlignment = Alignment.Top) {
                        Icon(
                            imageVector = Icons.Default.Lightbulb,
                            contentDescription = null,
                            tint = MonoWhite,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text(
                                text = "RECOMMENDED RESOLUTION",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace,
                                color = MonoWhite
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = issue.fixSuggestion,
                                fontSize = 11.sp,
                                color = TextPrimary,
                                lineHeight = 16.sp
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CorrectedCodeContainer(
    correctedCode: String,
    language: String,
    copiedRecently: Boolean,
    onCopyCode: () -> Unit,
    onApplyToEditor: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Bar with actions
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
                    text = "CLEAN & HARDENED CODE BLOCK",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = MonoWhite,
                    letterSpacing = 0.5.sp
                )
            }

            // Quick action buttons
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                // Apply to editor button
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color(0xFF1E1E1E))
                        .border(1.dp, MonoWhite.copy(alpha = 0.6f), RoundedCornerShape(6.dp))
                        .clickable(onClick = onApplyToEditor)
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "APPLY TO EDITOR",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        color = MonoWhite
                    )
                }

                // Copy code button
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(if (copiedRecently) MonoWhite else Color(0xFF171717))
                        .border(
                            1.dp,
                            MonoWhite,
                            RoundedCornerShape(6.dp)
                        )
                        .clickable(onClick = onCopyCode)
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = if (copiedRecently) Icons.Default.Check else Icons.Default.ContentCopy,
                            contentDescription = "Copy",
                            tint = if (copiedRecently) MonoBlack else MonoWhite,
                            modifier = Modifier.size(12.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = if (copiedRecently) "COPIED!" else "COPY FIX",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            color = if (copiedRecently) MonoBlack else MonoWhite
                        )
                    }
                }
            }
        }

        // Formatted Code Block
        CodeBlockView(
            code = correctedCode,
            modifier = Modifier.fillMaxWidth()
        )
    }
}
