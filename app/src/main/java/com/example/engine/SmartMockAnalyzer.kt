package com.example.engine

import com.example.model.AnalysisSummary
import com.example.model.CodeAnalysisResult
import com.example.model.CodeIssue
import com.example.model.CodePreset
import com.example.model.DiffLine
import com.example.model.DiffLineType
import com.example.model.IssueSeverity

object SmartMockAnalyzer {

    val presets: List<CodePreset> = listOf(
        CodePreset(
            id = "js_async_fetch",
            title = "JS: Async Fetch & Uncaught Rejection",
            language = "JavaScript",
            description = "Missing await on Promises, loose equality check, and missing error boundary.",
            code = """
async function getUserData(userId) {
  let response = fetch('https://api.example.com/users/' + userId);
  let data = response.json();
  
  if (data.status == 200) {
    console.log("User found: " + data.name);
    return data;
  }
}
            """.trimIndent()
        ),
        CodePreset(
            id = "react_use_effect",
            title = "React: Infinite Re-render Loop",
            language = "React / JS",
            description = "Missing dependency array in useEffect triggering continuous state re-renders.",
            code = """
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    fetchUser(userId).then(data => {
      setUser(data);
    });
  });

  return (
    <div className="card">
      <h2>{user.name}</h2>
    </div>
  );
}
            """.trimIndent()
        ),
        CodePreset(
            id = "sql_injection",
            title = "SQL: Injection Vulnerability",
            language = "JavaScript / SQL",
            description = "Direct string concatenation into database query opens critical SQL injection risk.",
            code = """
function authenticateUser(username, password) {
  const rawQuery = "SELECT * FROM users WHERE user = '" + username + "' AND pass = '" + password + "'";
  const result = db.query(rawQuery);
  return result[0];
}
            """.trimIndent()
        ),
        CodePreset(
            id = "python_mutable_default",
            title = "Python: Mutable Default & ZeroDivision",
            language = "Python",
            description = "Mutable list in default function argument causing state pollution across calls.",
            code = """
def calculate_metrics(values, cache=[]):
    cache.append(values)
    avg = sum(values) / len(values)
    return {"average": avg, "history": cache}
            """.trimIndent()
        ),
        CodePreset(
            id = "js_closure_loop",
            title = "JS: Loop Off-by-One & Var Scope",
            language = "JavaScript",
            description = "Off-by-one boundary error and var scoping bug in asynchronous closure.",
            code = """
function processOrders(items) {
  var results = [];
  for (var i = 0; i <= items.length; i++) {
    setTimeout(function() {
      results.push(items[i].price * 1.15);
    }, 100);
  }
  return results;
}
            """.trimIndent()
        ),
        CodePreset(
            id = "kotlin_npe_resource",
            title = "Kotlin: Force Unwrap & Leak",
            language = "Kotlin",
            description = "Dangerous force-unwrap operator (!!) and unclosed stream causing resource leaks.",
            code = """
fun loadConfig(path: String?): String {
    val file = java.io.File(path!!)
    val stream = java.io.FileInputStream(file)
    val text = stream.bufferedReader().readText()
    return text
}
            """.trimIndent()
        )
    )

    fun analyze(inputCode: String, selectedLanguage: String): CodeAnalysisResult {
        val trimmed = inputCode.trim()

        // Check if matching preset patterns
        if (trimmed.contains("getUserData") && trimmed.contains("fetch(")) {
            return generateJsFetchAnalysis(inputCode)
        }
        if (trimmed.contains("useEffect") && (trimmed.contains("setUser") || trimmed.contains("UserProfile"))) {
            return generateReactEffectAnalysis(inputCode)
        }
        if (trimmed.contains("SELECT * FROM") || (trimmed.contains("rawQuery") && trimmed.contains("WHERE"))) {
            return generateSqlInjectionAnalysis(inputCode)
        }
        if (trimmed.contains("cache=[]") || (trimmed.contains("calculate_metrics") && trimmed.contains("len(values)"))) {
            return generatePythonMutableAnalysis(inputCode)
        }
        if (trimmed.contains("processOrders") || (trimmed.contains("<= items.length") && trimmed.contains("var i"))) {
            return generateJsClosureLoopAnalysis(inputCode)
        }
        if (trimmed.contains("path!!") || (trimmed.contains("FileInputStream") && trimmed.contains("loadConfig"))) {
            return generateKotlinNpeAnalysis(inputCode)
        }

        // Custom general code analysis
        return analyzeCustomCode(inputCode, selectedLanguage)
    }

    private fun generateJsFetchAnalysis(originalCode: String): CodeAnalysisResult {
        val correctedCode = """
async function getUserData(userId) {
  if (!userId) {
    throw new Error("Invalid userId supplied");
  }

  try {
    const response = await fetch(`https://api.example.com/users/${'$'}{encodeURIComponent(userId)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP Error: ${'$'}{response.status} ${'$'}{response.statusText}`);
    }

    const data = await response.json();
    
    if (data?.status === 200) {
      return data;
    }
    
    return null;
  } catch (error) {
    console.error("Failed to fetch user data:", error);
    throw error;
  }
}
        """.trimIndent()

        val issues = listOf(
            CodeIssue(
                id = "issue_1",
                title = "Missing 'await' on Promise resolution",
                description = "fetch() and response.json() return Promises. Without 'await', response and data are unresolved Promise objects, causing data.status to evaluate to undefined.",
                severity = IssueSeverity.CRITICAL,
                lineNumber = 2,
                fixSuggestion = "Prepend 'await' to both fetch() and response.json() calls."
            ),
            CodeIssue(
                id = "issue_2",
                title = "Loose equality operator ('==') used",
                description = "Using '==' enables unintended type coercion (e.g., '200' == 200). Strict equality ('===') guarantees both value and type matching.",
                severity = IssueSeverity.WARNING,
                lineNumber = 5,
                fixSuggestion = "Replace 'data.status == 200' with 'data.status === 200'."
            ),
            CodeIssue(
                id = "issue_3",
                title = "Missing try-catch error boundary",
                description = "Network requests can fail due to network drops or 5xx server faults. An unhandled rejection can crash the runtime process.",
                severity = IssueSeverity.BUG,
                lineNumber = 1,
                fixSuggestion = "Wrap network I/O in a robust try/catch block with explicit error logging."
            ),
            CodeIssue(
                id = "issue_4",
                title = "URL Injection & Lack of Parameter Encoding",
                description = "Directly appending raw userId opens the door to path manipulation or URL breakages if special characters are present.",
                severity = IssueSeverity.SECURITY,
                lineNumber = 2,
                fixSuggestion = "Use template literals with encodeURIComponent(userId)."
            ),
            CodeIssue(
                id = "issue_5",
                title = "Debug console.log in production flow",
                description = "Leaking raw data.name to console can expose PII (personally identifiable information) in client/server logs.",
                severity = IssueSeverity.OPTIMIZATION,
                lineNumber = 6,
                fixSuggestion = "Remove redundant console.log statements before deploying to production."
            )
        )

        val summary = AnalysisSummary(
            score = 38,
            bugCount = 2,
            warningCount = 1,
            optimizationCount = 1,
            securityCount = 1,
            riskLevel = "CRITICAL",
            timeSavedMinutes = 45
        )

        return CodeAnalysisResult(
            language = "JavaScript",
            originalCode = originalCode,
            correctedCode = correctedCode,
            issues = issues,
            summary = summary,
            executionLogs = listOf(
                "Parsed Abstract Syntax Tree (AST)",
                "Identified 2 unhandled Promise allocations",
                "Flagged unsafe URL concatenation at L2",
                "Synthesized async/await error boundaries",
                "Applied strict type comparison rules"
            )
        )
    }

    private fun generateReactEffectAnalysis(originalCode: String): CodeAnalysisResult {
        val correctedCode = """
import React, { useState, useEffect } from 'react';

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    let isSubscribed = true;
    setLoading(true);

    fetchUser(userId)
      .then(data => {
        if (isSubscribed) {
          setUser(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (isSubscribed) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      isSubscribed = false; // Cleanup subscription on unmount
    };
  }, [userId]); // Fixed dependency array

  if (loading) return <div className="spinner">Loading user...</div>;
  if (error) return <div className="error-alert">{error}</div>;

  return (
    <div className="card">
      <h2>{user?.name ?? 'Unknown User'}</h2>
    </div>
  );
}
        """.trimIndent()

        val issues = listOf(
            CodeIssue(
                id = "react_1",
                title = "Missing dependency array triggers infinite loop",
                description = "Calling setUser inside useEffect without a dependency array executes the effect after every render, triggering another render infinitely.",
                severity = IssueSeverity.CRITICAL,
                lineNumber = 4,
                fixSuggestion = "Add [userId] as the second argument to useEffect."
            ),
            CodeIssue(
                id = "react_2",
                title = "Unsafe property access on initial null state",
                description = "Initial state is null; rendering user.name before the promise resolves throws a fatal 'TypeError: Cannot read properties of null'.",
                severity = IssueSeverity.BUG,
                lineNumber = 11,
                fixSuggestion = "Use optional chaining (user?.name) or add explicit loading state guard."
            ),
            CodeIssue(
                id = "react_3",
                title = "Memory leak risk from async race conditions",
                description = "If the component unmounts before fetchUser finishes, setting state triggers a memory leak warning or sets state on an unmounted component.",
                severity = IssueSeverity.WARNING,
                lineNumber = 5,
                fixSuggestion = "Return a cleanup function setting isSubscribed = false."
            )
        )

        return CodeAnalysisResult(
            language = "React / JSX",
            originalCode = originalCode,
            correctedCode = correctedCode,
            issues = issues,
            summary = AnalysisSummary(
                score = 42,
                bugCount = 2,
                warningCount = 1,
                optimizationCount = 0,
                securityCount = 0,
                riskLevel = "CRITICAL",
                timeSavedMinutes = 60
            ),
            executionLogs = listOf(
                "React Hooks linter executed",
                "Detected continuous re-render loop pattern",
                "Added dependency array with [userId]",
                "Added unmount cleanup flag & optional chaining"
            )
        )
    }

    private fun generateSqlInjectionAnalysis(originalCode: String): CodeAnalysisResult {
        val correctedCode = """
// Secure Parameterized Query
async function authenticateUser(username, password) {
  if (!username || !password) {
    throw new Error("Credentials cannot be empty");
  }

  // Use parameterized placeholders to prevent SQL injection
  const query = "SELECT id, username, email FROM users WHERE user = ? AND pass_hash = ?";
  
  // Note: Passwords should be verified using bcrypt/argon2 hashing, not plaintext SQL matching
  const [rows] = await db.execute(query, [username, hashPassword(password)]);
  
  return rows[0] || null;
}
        """.trimIndent()

        val issues = listOf(
            CodeIssue(
                id = "sql_1",
                title = "High Severity: SQL Injection Vulnerability",
                description = "Direct string concatenation allows attackers to inject malicious SQL syntax (e.g., ' OR '1'='1) to bypass authentication or drop tables.",
                severity = IssueSeverity.CRITICAL,
                lineNumber = 2,
                fixSuggestion = "Refactor query to use parameterized queries/prepared statements with placeholder markers (?)."
            ),
            CodeIssue(
                id = "sql_2",
                title = "Plaintext password storage hazard",
                description = "Comparing raw password strings against database entries indicates plaintext password storage or lack of salted hashing.",
                severity = IssueSeverity.SECURITY,
                lineNumber = 2,
                fixSuggestion = "Store only cryptographic hashes (bcrypt, Argon2, PBKDF2) and verify asynchronously."
            ),
            CodeIssue(
                id = "sql_3",
                title = "Over-fetching sensitive data (SELECT *)",
                description = "Querying with 'SELECT *' retrieves secret fields like salt, recovery codes, and tokens unnecessarily.",
                severity = IssueSeverity.OPTIMIZATION,
                lineNumber = 2,
                fixSuggestion = "Specify explicit column projections (e.g., SELECT id, username, email)."
            )
        )

        return CodeAnalysisResult(
            language = "SQL / JavaScript",
            originalCode = originalCode,
            correctedCode = correctedCode,
            issues = issues,
            summary = AnalysisSummary(
                score = 25,
                bugCount = 1,
                warningCount = 0,
                optimizationCount = 1,
                securityCount = 1,
                riskLevel = "CRITICAL",
                timeSavedMinutes = 90
            ),
            executionLogs = listOf(
                "AST Security scanner triggered",
                "CWE-89: SQL Injection pattern detected in rawQuery",
                "Converted string concatenation to Prepared Statement",
                "Added sanitization and explicit column projection"
            )
        )
    }

    private fun generatePythonMutableAnalysis(originalCode: String): CodeAnalysisResult {
        val correctedCode = """
from typing import List, Dict, Any, Optional

def calculate_metrics(values: List[float], cache: Optional[List[Any]] = None) -> Dict[str, Any]:
    # Defensive copy prevents mutable default cross-invocation side effects
    if cache is None:
        cache = []
        
    if not values:
        return {"average": 0.0, "history": cache, "count": 0}

    cache.append(list(values))
    avg = sum(values) / len(values)
    
    return {
        "average": round(avg, 2),
        "history": cache,
        "count": len(values)
    }
        """.trimIndent()

        val issues = listOf(
            CodeIssue(
                id = "py_1",
                title = "Mutable default argument 'cache=[]'",
                description = "Python default arguments are evaluated once when the function is defined, not on each call. Appending to 'cache' mutates the list for all future calls across the application life cycle.",
                severity = IssueSeverity.CRITICAL,
                lineNumber = 1,
                fixSuggestion = "Use 'cache: Optional[List] = None' and initialize 'if cache is None: cache = []'."
            ),
            CodeIssue(
                id = "py_2",
                title = "ZeroDivisionError on empty input values",
                description = "If an empty list is passed (values = []), 'len(values)' is 0, raising an uncaught ZeroDivisionError crash.",
                severity = IssueSeverity.BUG,
                lineNumber = 3,
                fixSuggestion = "Add a guard clause: 'if not values: return 0.0'."
            ),
            CodeIssue(
                id = "py_3",
                title = "Missing type hints and docstring",
                description = "Function signatures without type annotations reduce IDE auto-complete accuracy and static analysis verification.",
                severity = IssueSeverity.OPTIMIZATION,
                lineNumber = 1,
                fixSuggestion = "Include PEP 484 type annotations (List[float], Dict[str, Any])."
            )
        )

        return CodeAnalysisResult(
            language = "Python",
            originalCode = originalCode,
            correctedCode = correctedCode,
            issues = issues,
            summary = AnalysisSummary(
                score = 45,
                bugCount = 2,
                warningCount = 0,
                optimizationCount = 1,
                securityCount = 0,
                riskLevel = "HIGH",
                timeSavedMinutes = 40
            ),
            executionLogs = listOf(
                "PyLint / Flake8 engine loaded",
                "W0102: Dangerous default value [] as argument",
                "W0703: ZeroDivision potential on empty sequence",
                "Refactored to None-guarded default pattern"
            )
        )
    }

    private fun generateJsClosureLoopAnalysis(originalCode: String): CodeAnalysisResult {
        val correctedCode = """
function processOrders(items) {
  if (!Array.isArray(items)) {
    throw new TypeError("Expected items to be an Array");
  }

  // Use let for block scope and strictly '< items.length'
  const results = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item && typeof item.price === 'number') {
      results.push(Number((item.price * 1.15).toFixed(2)));
    }
  }
  
  return results;
}
        """.trimIndent()

        val issues = listOf(
            CodeIssue(
                id = "loop_1",
                title = "Off-by-one boundary condition (<= items.length)",
                description = "Array indices run from 0 to length - 1. Using '<=' causes the final iteration to index items[items.length], reading undefined and throwing 'Cannot read property price of undefined'.",
                severity = IssueSeverity.CRITICAL,
                lineNumber = 3,
                fixSuggestion = "Change condition from 'i <= items.length' to 'i < items.length'."
            ),
            CodeIssue(
                id = "loop_2",
                title = "Function-scoped 'var' in async closure",
                description = "'var i' is shared across all iterations. By the time setTimeout callbacks execute, i will already equal items.length, reading undefined.",
                severity = IssueSeverity.BUG,
                lineNumber = 3,
                fixSuggestion = "Use block-scoped 'let i' or modern Array.prototype.map()."
            ),
            CodeIssue(
                id = "loop_3",
                title = "Returning results array synchronously before setTimeout fires",
                description = "setTimeout is asynchronous. The function returns 'results' immediately while it is still empty (results.length === 0).",
                severity = IssueSeverity.BUG,
                lineNumber = 8,
                fixSuggestion = "Use Promise.all() with async/await or calculate synchronously."
            )
        )

        return CodeAnalysisResult(
            language = "JavaScript",
            originalCode = originalCode,
            correctedCode = correctedCode,
            issues = issues,
            summary = AnalysisSummary(
                score = 30,
                bugCount = 3,
                warningCount = 0,
                optimizationCount = 0,
                securityCount = 0,
                riskLevel = "CRITICAL",
                timeSavedMinutes = 55
            ),
            executionLogs = listOf(
                "Scope analysis completed",
                "Detected off-by-one index traversal",
                "Flagged synchronous return of asynchronous mutated array",
                "Refactored to block scope with price validation"
            )
        )
    }

    private fun generateKotlinNpeAnalysis(originalCode: String): CodeAnalysisResult {
        val correctedCode = """
import java.io.File
import java.io.FileInputStream
import java.io.IOException

@Throws(IOException::class)
fun loadConfig(path: String?): Result<String> {
    if (path.isNullOrBlank()) {
        return Result.failure(IllegalArgumentException("Configuration path cannot be empty or null"))
    }

    val file = File(path)
    if (!file.exists() || !file.canRead()) {
        return Result.failure(IOException("File does not exist or lacks read permissions: ${'$'}path"))
    }

    // Auto-close resource with use {} to prevent file descriptor leaks
    return runCatching {
        file.bufferedReader().use { reader ->
            reader.readText()
        }
    }
}
        """.trimIndent()

        val issues = listOf(
            CodeIssue(
                id = "kt_1",
                title = "Dangerous force-unwrap operator (path!!)",
                description = "Using the !! operator immediately crashes the JVM with a NullPointerException if 'path' is null, defeating Kotlin's null-safety design.",
                severity = IssueSeverity.CRITICAL,
                lineNumber = 2,
                fixSuggestion = "Validate path with path.isNullOrBlank() or provide a fallback."
            ),
            CodeIssue(
                id = "kt_2",
                title = "Unclosed Stream: File descriptor leak",
                description = "FileInputStream is never closed. If an exception is thrown or during long-running tasks, OS file handles will be exhausted.",
                severity = IssueSeverity.BUG,
                lineNumber = 3,
                fixSuggestion = "Use Kotlin's .use { } extension block to guarantee automatic closure."
            ),
            CodeIssue(
                id = "kt_3",
                title = "Missing error boundary for I/O exceptions",
                description = "Missing file, permissions failure, or disk error will crash the app without handling.",
                severity = IssueSeverity.WARNING,
                lineNumber = 4,
                fixSuggestion = "Wrap with runCatching { } or return a Result<String>."
            )
        )

        return CodeAnalysisResult(
            language = "Kotlin",
            originalCode = originalCode,
            correctedCode = correctedCode,
            issues = issues,
            summary = AnalysisSummary(
                score = 35,
                bugCount = 2,
                warningCount = 1,
                optimizationCount = 0,
                securityCount = 0,
                riskLevel = "CRITICAL",
                timeSavedMinutes = 40
            ),
            executionLogs = listOf(
                "Kotlin static analysis engine",
                "Detected unsafe !! unwrap operator",
                "Unclosed AutoCloseable resource detected (FileInputStream)",
                "Wrapped in Idiomatic .use { } block"
            )
        )
    }

    private fun analyzeCustomCode(inputCode: String, language: String): CodeAnalysisResult {
        val lines = inputCode.lines()
        val detectedIssues = mutableListOf<CodeIssue>()

        // 1. Check for console.log / print / System.out
        lines.forEachIndexed { index, line ->
            if (line.contains("console.log") || line.contains("System.out.println") || (line.contains("print(") && !line.contains("printer"))) {
                detectedIssues.add(
                    CodeIssue(
                        id = "custom_log_${index}",
                        title = "Unsanitized debugging logs present",
                        description = "Direct print/console statements clutter runtime logs and can accidentally leak sensitive internal state in production.",
                        severity = IssueSeverity.OPTIMIZATION,
                        lineNumber = index + 1,
                        fixSuggestion = "Replace with a structured production logger or remove before release."
                    )
                )
            }
        }

        // 2. Check for loose equality
        lines.forEachIndexed { index, line ->
            if (line.contains(" == ") && !line.contains(" == null") && !line.contains("===")) {
                detectedIssues.add(
                    CodeIssue(
                        id = "custom_eq_${index}",
                        title = "Non-strict equality operator ('==')",
                        description = "Loose equality triggers type coercion which frequently results in subtle truthy/falsy evaluation bugs.",
                        severity = IssueSeverity.WARNING,
                        lineNumber = index + 1,
                        fixSuggestion = "Use strict comparison '==='."
                    )
                )
            }
        }

        // 3. Check for var keyword
        lines.forEachIndexed { index, line ->
            if (line.trim().startsWith("var ")) {
                detectedIssues.add(
                    CodeIssue(
                        id = "custom_var_${index}",
                        title = "Use of legacy function-scoped 'var'",
                        description = "'var' hoists variable definitions and leads to unintentional variable shadowing and closure pitfalls.",
                        severity = IssueSeverity.WARNING,
                        lineNumber = index + 1,
                        fixSuggestion = "Use block-scoped 'const' or 'let'."
                    )
                )
            }
        }

        // 4. Check for eval or innerHTML
        lines.forEachIndexed { index, line ->
            if (line.contains("eval(") || line.contains("innerHTML")) {
                detectedIssues.add(
                    CodeIssue(
                        id = "custom_xss_${index}",
                        title = "Critical Security: Arbitrary code execution / XSS",
                        description = "Using eval() or injecting raw HTML strings allows malicious payload execution.",
                        severity = IssueSeverity.SECURITY,
                        lineNumber = index + 1,
                        fixSuggestion = "Sanitize inputs and use safe DOM methods or strict JSON.parse()."
                    )
                )
            }
        }

        // 5. Check for null or undefined checks
        if (inputCode.contains("null") || inputCode.contains("undefined") || inputCode.contains("!.")) {
            detectedIssues.add(
                CodeIssue(
                    id = "custom_null",
                    title = "Potential Unchecked Null / NullPointerException",
                    description = "Variables may be dereferenced without affirmative null or undefined verification.",
                    severity = IssueSeverity.BUG,
                    lineNumber = 1,
                    fixSuggestion = "Implement optional chaining (?.) or an early defensive guard clause."
                )
            )
        }

        // If no issues were detected, create standard software quality improvements
        if (detectedIssues.isEmpty()) {
            detectedIssues.add(
                CodeIssue(
                    id = "clean_1",
                    title = "Missing Input Validation Guard Clauses",
                    description = "Parameters are ingested without verifying schema, range, or non-null contracts.",
                    severity = IssueSeverity.OPTIMIZATION,
                    lineNumber = 1,
                    fixSuggestion = "Add parameter assertion guards at the entry point of the routine."
                )
            )
            detectedIssues.add(
                CodeIssue(
                    id = "clean_2",
                    title = "Error Handling & Observability",
                    description = "Wrap volatile computational paths in structured error-handling wrappers with telemetry.",
                    severity = IssueSeverity.WARNING,
                    lineNumber = lines.size,
                    fixSuggestion = "Add try/catch blocks and meaningful telemetry events."
                )
            )
        }

        // Generate clean corrected code
        val cleanedLines = lines.map { line ->
            var l = line
            if (l.trim().startsWith("var ")) {
                l = l.replaceFirst("var ", "const ")
            }
            if (l.contains(" == ") && !l.contains("===")) {
                l = l.replace(" == ", " === ")
            }
            if (l.contains("console.log(")) {
                l = "// logger.debug(${l.substringAfter("console.log(")}"
            }
            l
        }

        val correctedCode = buildString {
            append("// [CodeReviewer] Cleaned & Hardened Implementation\n")
            cleanedLines.forEach { line ->
                append(line).append("\n")
            }
        }

        val criticalCount = detectedIssues.count { it.severity == IssueSeverity.CRITICAL }
        val bugCount = detectedIssues.count { it.severity == IssueSeverity.BUG }
        val warningCount = detectedIssues.count { it.severity == IssueSeverity.WARNING }
        val securityCount = detectedIssues.count { it.severity == IssueSeverity.SECURITY }
        val optCount = detectedIssues.count { it.severity == IssueSeverity.OPTIMIZATION }

        val score = (100 - (criticalCount * 25 + bugCount * 15 + securityCount * 20 + warningCount * 8 + optCount * 3))
            .coerceIn(15, 95)

        val riskLevel = when {
            criticalCount > 0 || securityCount > 0 -> "CRITICAL"
            bugCount > 0 -> "HIGH"
            warningCount > 1 -> "MODERATE"
            else -> "LOW"
        }

        return CodeAnalysisResult(
            language = language,
            originalCode = inputCode,
            correctedCode = correctedCode,
            issues = detectedIssues,
            summary = AnalysisSummary(
                score = score,
                bugCount = bugCount + criticalCount,
                warningCount = warningCount,
                optimizationCount = optCount,
                securityCount = securityCount,
                riskLevel = riskLevel,
                timeSavedMinutes = (detectedIssues.size * 18).coerceAtLeast(15)
            ),
            executionLogs = listOf(
                "Scanning lexical structure across ${lines.size} lines",
                "Audited typing semantics and variable scopes",
                "Applied defensibility patterns and sanitized logging",
                "Reformatted syntax tree and verified bracket balancing"
            )
        )
    }

    fun computeDiff(original: String, corrected: String): List<DiffLine> {
        val origLines = original.lines()
        val corrLines = corrected.lines()
        val diff = mutableListOf<DiffLine>()

        val maxLines = maxOf(origLines.size, corrLines.size)
        var origIndex = 0
        var corrIndex = 0

        while (origIndex < origLines.size || corrIndex < corrLines.size) {
            val origLine = origLines.getOrNull(origIndex)
            val corrLine = corrLines.getOrNull(corrIndex)

            if (origLine == corrLine && origLine != null) {
                diff.add(
                    DiffLine(
                        type = DiffLineType.UNCHANGED,
                        text = origLine,
                        oldLineNum = origIndex + 1,
                        newLineNum = corrIndex + 1
                    )
                )
                origIndex++
                corrIndex++
            } else {
                if (origLine != null) {
                    diff.add(
                        DiffLine(
                            type = DiffLineType.REMOVED,
                            text = origLine,
                            oldLineNum = origIndex + 1,
                            newLineNum = null
                        )
                    )
                    origIndex++
                }
                if (corrLine != null) {
                    diff.add(
                        DiffLine(
                            type = DiffLineType.ADDED,
                            text = corrLine,
                            oldLineNum = null,
                            newLineNum = corrIndex + 1
                        )
                    )
                    corrIndex++
                }
            }
        }

        return diff
    }
}
