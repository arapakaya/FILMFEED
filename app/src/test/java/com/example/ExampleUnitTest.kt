package com.example

import com.example.engine.SmartMockAnalyzer
import com.example.model.DiffLineType
import com.example.model.IssueSeverity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ExampleUnitTest {

    @Test
    fun testJsAsyncFetchAnalysis() {
        val preset = SmartMockAnalyzer.presets.first { it.id == "js_async_fetch" }
        val result = SmartMockAnalyzer.analyze(preset.code, "JavaScript")

        assertNotNull(result)
        assertEquals("JavaScript", result.language)
        assertTrue(result.issues.isNotEmpty())
        assertTrue(result.issues.any { it.severity == IssueSeverity.CRITICAL })
        assertTrue(result.correctedCode.contains("await fetch"))
        assertTrue(result.summary.score < 50)
    }

    @Test
    fun testSqlInjectionAnalysis() {
        val preset = SmartMockAnalyzer.presets.first { it.id == "sql_injection" }
        val result = SmartMockAnalyzer.analyze(preset.code, "SQL")

        assertTrue(result.issues.any { it.title.contains("SQL Injection") })
        assertTrue(result.correctedCode.contains("WHERE user = ?"))
    }

    @Test
    fun testCustomCodeAnalysis() {
        val customCode = """
            function test() {
                var x = 10;
                if (x == 10) {
                    console.log("Found");
                }
            }
        """.trimIndent()

        val result = SmartMockAnalyzer.analyze(customCode, "JavaScript")
        assertTrue(result.issues.any { it.title.contains("var") || it.title.contains("==") || it.title.contains("log") })
        assertTrue(result.correctedCode.contains("const") || result.correctedCode.contains("==="))
    }

    @Test
    fun testDiffComputation() {
        val original = "line1\nline2"
        val corrected = "line1\nline2_fixed\nline3"
        val diff = SmartMockAnalyzer.computeDiff(original, corrected)

        assertTrue(diff.any { it.type == DiffLineType.UNCHANGED })
        assertTrue(diff.any { it.type == DiffLineType.REMOVED || it.type == DiffLineType.ADDED })
    }
}
