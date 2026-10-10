package com.example.model

enum class IssueSeverity(val label: String, val badgeColorHex: Long) {
    CRITICAL("CRITICAL BUG", 0xFFFFFFFF),
    BUG("LOGIC BUG", 0xFFE0E0E0),
    SECURITY("SECURITY RISK", 0xFFCCCCCC),
    WARNING("WARNING", 0xFFAAAAAA),
    OPTIMIZATION("OPTIMIZATION", 0xFF888888)
}

data class CodeIssue(
    val id: String,
    val title: String,
    val description: String,
    val severity: IssueSeverity,
    val lineNumber: Int? = null,
    val fixSuggestion: String,
    val category: String = "Code Quality"
)

data class AnalysisSummary(
    val score: Int,
    val bugCount: Int,
    val warningCount: Int,
    val optimizationCount: Int,
    val securityCount: Int,
    val riskLevel: String,
    val timeSavedMinutes: Int
)

data class CodeAnalysisResult(
    val language: String,
    val originalCode: String,
    val correctedCode: String,
    val issues: List<CodeIssue>,
    val summary: AnalysisSummary,
    val executionLogs: List<String>
)

data class CodePreset(
    val id: String,
    val title: String,
    val language: String,
    val description: String,
    val code: String
)

enum class DiffLineType {
    UNCHANGED,
    ADDED,
    REMOVED
}

data class DiffLine(
    val type: DiffLineType,
    val text: String,
    val oldLineNum: Int? = null,
    val newLineNum: Int? = null
)
