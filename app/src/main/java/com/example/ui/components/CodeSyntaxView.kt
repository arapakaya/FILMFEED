package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.DiffLine
import com.example.model.DiffLineType
import com.example.ui.theme.DiffAddBg
import com.example.ui.theme.DiffRemoveBg
import com.example.ui.theme.MonoBlack
import com.example.ui.theme.MonoWhite
import com.example.ui.theme.SyntaxComment
import com.example.ui.theme.SyntaxFunction
import com.example.ui.theme.SyntaxKeyword
import com.example.ui.theme.SyntaxNumber
import com.example.ui.theme.SyntaxPunctuation
import com.example.ui.theme.SyntaxString
import com.example.ui.theme.TextMuted
import com.example.ui.theme.TextPrimary

@Composable
fun CodeBlockView(
    code: String,
    modifier: Modifier = Modifier,
    highlightLine: Int? = null
) {
    val lines = remember(code) { code.lines() }
    val horizontalScrollState = rememberScrollState()

    Box(
        modifier = modifier
            .background(MonoBlack, RoundedCornerShape(8.dp))
            .padding(vertical = 10.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(horizontalScrollState)
        ) {
            // Line numbers column
            Column(
                modifier = Modifier
                    .background(Color(0xFF0F0F0F))
                    .padding(horizontal = 10.dp, vertical = 2.dp),
                horizontalAlignment = Alignment.End
            ) {
                lines.forEachIndexed { index, _ ->
                    val lineNum = index + 1
                    val isHighlighted = lineNum == highlightLine
                    Text(
                        text = "$lineNum",
                        color = if (isHighlighted) MonoWhite else TextMuted,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp,
                        fontWeight = if (isHighlighted) FontWeight.Bold else FontWeight.Normal,
                        lineHeight = 20.sp
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Code lines
            Column(
                modifier = Modifier.padding(end = 16.dp, top = 2.dp)
            ) {
                lines.forEachIndexed { index, line ->
                    val lineNum = index + 1
                    val isHighlighted = lineNum == highlightLine
                    val annotatedLine = remember(line) { highlightCodeLine(line) }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                if (isHighlighted) Color(0x33FFFFFF) else Color.Transparent,
                                RoundedCornerShape(4.dp)
                            )
                            .padding(horizontal = 4.dp)
                    ) {
                        Text(
                            text = annotatedLine,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 12.sp,
                            lineHeight = 20.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun DiffCodeView(
    diffLines: List<DiffLine>,
    modifier: Modifier = Modifier
) {
    val horizontalScroll = rememberScrollState()

    Column(
        modifier = modifier
            .background(MonoBlack, RoundedCornerShape(8.dp))
            .padding(vertical = 8.dp)
            .horizontalScroll(horizontalScroll)
    ) {
        diffLines.forEach { diff ->
            val bg = when (diff.type) {
                DiffLineType.ADDED -> DiffAddBg
                DiffLineType.REMOVED -> DiffRemoveBg
                DiffLineType.UNCHANGED -> Color.Transparent
            }
            val indicator = when (diff.type) {
                DiffLineType.ADDED -> "+"
                DiffLineType.REMOVED -> "-"
                DiffLineType.UNCHANGED -> " "
            }
            val indicatorColor = when (diff.type) {
                DiffLineType.ADDED -> MonoWhite
                DiffLineType.REMOVED -> TextMuted
                DiffLineType.UNCHANGED -> Color(0xFF444444)
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(bg)
                    .padding(horizontal = 8.dp, vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Line numbers
                Text(
                    text = "${diff.oldLineNum?.toString() ?: " "} ".padStart(4),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    color = TextMuted,
                    modifier = Modifier.width(32.dp)
                )
                Text(
                    text = "${diff.newLineNum?.toString() ?: " "} ".padStart(4),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    color = TextMuted,
                    modifier = Modifier.width(32.dp)
                )

                // Indicator
                Text(
                    text = indicator,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = indicatorColor,
                    modifier = Modifier.width(16.dp)
                )

                // Code
                Text(
                    text = highlightCodeLine(diff.text),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp,
                    lineHeight = 18.sp
                )
            }
        }
    }
}

fun highlightCodeLine(line: String): AnnotatedString {
    return buildAnnotatedString {
        val trimmed = line.trim()
        if (trimmed.startsWith("//") || trimmed.startsWith("#")) {
            append(line)
            addStyle(SpanStyle(color = SyntaxComment), 0, line.length)
            return@buildAnnotatedString
        }

        var i = 0
        while (i < line.length) {
            val char = line[i]

            // Single-line comment
            if (i < line.length - 1 && line.substring(i, i + 2) == "//") {
                val commentStart = length
                append(line.substring(i))
                addStyle(SpanStyle(color = SyntaxComment), commentStart, length)
                break
            }

            // String literals
            if (char == '"' || char == '\'' || char == '`') {
                val quote = char
                val strStart = length
                append(char)
                i++
                while (i < line.length && line[i] != quote) {
                    if (line[i] == '\\' && i + 1 < line.length) {
                        append(line[i])
                        append(line[i + 1])
                        i += 2
                    } else {
                        append(line[i])
                        i++
                    }
                }
                if (i < line.length && line[i] == quote) {
                    append(quote)
                    i++
                }
                addStyle(SpanStyle(color = SyntaxString), strStart, length)
                continue
            }

            // Word or identifier
            if (char.isLetter() || char == '_' || char == '$') {
                val wordStart = i
                while (i < line.length && (line[i].isLetterOrDigit() || line[i] == '_' || line[i] == '$')) {
                    i++
                }
                val word = line.substring(wordStart, i)
                val outStart = length
                append(word)

                val keywords = setOf(
                    "async", "await", "function", "def", "const", "let", "var", "return",
                    "if", "else", "try", "catch", "finally", "throw", "import", "export",
                    "from", "class", "new", "val", "fun", "public", "private", "while",
                    "for", "switch", "case", "default", "yield", "typeof", "instanceof",
                    "SELECT", "FROM", "WHERE", "JOIN", "UPDATE", "DELETE", "INSERT", "INTO"
                )

                val specialValues = setOf("true", "false", "null", "undefined", "None", "self", "this")

                if (keywords.contains(word)) {
                    addStyle(SpanStyle(color = SyntaxKeyword, fontWeight = FontWeight.Bold), outStart, length)
                } else if (specialValues.contains(word)) {
                    addStyle(SpanStyle(color = SyntaxNumber, fontWeight = FontWeight.SemiBold), outStart, length)
                } else if (i < line.length && line[i] == '(') {
                    addStyle(SpanStyle(color = SyntaxFunction), outStart, length)
                } else {
                    addStyle(SpanStyle(color = TextPrimary), outStart, length)
                }
                continue
            }

            // Numbers
            if (char.isDigit()) {
                val numStart = length
                while (i < line.length && (line[i].isDigit() || line[i] == '.' || line[i] == 'x' || line[i] == 'b')) {
                    append(line[i])
                    i++
                }
                addStyle(SpanStyle(color = SyntaxNumber), numStart, length)
                continue
            }

            // Punctuation and symbols
            append(char)
            if (char in "{}[];:()=+-*/<>!&|^~") {
                addStyle(SpanStyle(color = SyntaxPunctuation), length - 1, length)
            } else {
                addStyle(SpanStyle(color = TextPrimary), length - 1, length)
            }
            i++
        }
    }
}
