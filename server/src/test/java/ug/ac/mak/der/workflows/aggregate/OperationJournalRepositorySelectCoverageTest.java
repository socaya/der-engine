package ug.ac.mak.der.workflows.aggregate;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;

/**
 * §2.3.120 R-AQ — tripwire that keeps every repository SELECT in sync
 * with the columns {@link OperationJournalRepository#rowMapper()}
 * reads. The 2.3.119 "invalid credentials" bug was a {@code
 * findById} SELECT missing {@code workflow_run_id}, which the row
 * mapper hydrated unconditionally — the resulting
 * {@code BadSqlGrammarException} propagated through
 * {@code DispatcherServlet} forward to {@code /error} and was
 * rewritten to HTTP 401 by the security entry point, surfacing in
 * the admin UI as a login failure.
 *
 * <p>The {@code /error} forward is now permit-listed so similar
 * failures surface honestly as 500s, but we still want to catch
 * the mismatch at build time: an engineer adding a column to the
 * row mapper and forgetting to update one of several near-identical
 * SELECTs produces exactly this class of bug.</p>
 *
 * <p>This test parses the repository source rather than firing
 * against a real database, so it runs in every build without
 * Testcontainers.</p>
 */
class OperationJournalRepositorySelectCoverageTest {

    private static final Path REPO_SRC = Path.of(
            "src/main/java/ug/ac/mak/der/workflows/aggregate/"
            + "OperationJournalRepository.java");

    @Test
    void everySelectFromOperationJournalCoversEveryColumnRowMapperReads()
            throws Exception {
        final String src = Files.readString(REPO_SRC);
        final Set<String> required = extractRequiredColumns(src);
        assertThat(required)
                .as("rowMapper() must reference at least operation_id")
                .contains("operation_id");

        final List<Select> selects = extractSelects(src);
        assertThat(selects)
                .as("expected at least three SELECT ... FROM "
                        + "der.operation_journal queries in the repository")
                .hasSizeGreaterThanOrEqualTo(3);

        final List<String> violations = new ArrayList<>();
        for (final Select s : selects) {
            final Set<String> missing = new TreeSet<>(required);
            missing.removeAll(s.columns);
            if (!missing.isEmpty()) {
                violations.add(String.format(
                        "SELECT near line %d missing columns %s (full: %s)",
                        s.lineNumber, missing, s.text));
            }
        }
        assertThat(violations)
                .as("every repository SELECT must emit every column the "
                        + "row mapper reads — missing one re-introduces the "
                        + "2.3.119 BadSqlGrammar → 401 regression")
                .isEmpty();
    }

    /**
     * Pull every column referenced by the row mapper via {@code
     * rs.getString("col")}, {@code rs.getObject("col", ...)}, {@code
     * rs.getInt("col")}, {@code rs.getTimestamp("col")}.
     */
    private static Set<String> extractRequiredColumns(final String src) {
        final int start = src.indexOf("private RowMapper");
        if (start < 0) {
            return Set.of();
        }
        // Find the end of the row-mapper method body — the first
        // unmatched closing brace at the method's indent. Simpler
        // and good enough: slice until the next top-level `}` which
        // we locate by matching `    }` at the start of a line.
        final int end = src.indexOf("\n    }\n", start);
        final String body = src.substring(start, end > 0 ? end : src.length());
        final Pattern p = Pattern.compile(
                "rs\\.get(?:String|Object|Int|Timestamp)"
                + "\\(\\s*\"([a-z_][a-z0-9_]*)\"");
        final Set<String> cols = new TreeSet<>();
        final Matcher m = p.matcher(body);
        while (m.find()) {
            cols.add(m.group(1));
        }
        return cols;
    }

    /**
     * Pull every {@code SELECT ... FROM der.operation_journal}
     * statement, gluing concatenated string literals back together.
     */
    private static List<Select> extractSelects(final String src) {
        final List<Select> out = new ArrayList<>();
        final Pattern p = Pattern.compile("\"SELECT (?:(?!\").)+\"",
                Pattern.DOTALL);
        final Matcher m = p.matcher(src);
        while (m.find()) {
            final int startIdx = m.start();
            final String full = gluedStringAt(src, startIdx);
            // Only interested in SELECTs that touch the journal
            // table — other tables have their own repositories and
            // row mappers.
            if (!full.contains("der.operation_journal")) {
                continue;
            }
            // Skip COUNT(*) and DELETE-style subqueries that don't
            // use the shared rowMapper.
            final String upper = full.toUpperCase();
            if (upper.contains("COUNT(")
                    || upper.contains("MAX(")
                    || upper.contains("MIN(")) {
                continue;
            }
            /* Phase 10.3.2 — only guard SELECTs that feed the
             * shared rowMapper(). A SELECT followed by an inline
             * lambda row mapper (e.g. "(ResultSet rs, int n) ->
             * ...") is intentionally a slim projection for a
             * dedicated purpose — the escalation scanner's
             * (operation_id, next_hop_org_unit_uid, updated_at)
             * tuple being the first example — and does NOT need
             * to carry every column the shared mapper reads. We
             * detect this by searching the ~400 characters after
             * the SELECT literal for a reference to rowMapper().
             * No match → inline mapper → skip. */
            final int tailStart = m.end();
            final int tailEnd = Math.min(src.length(), tailStart + 500);
            final String tail = src.substring(tailStart, tailEnd);
            if (!tail.contains("rowMapper(")) {
                continue;
            }
            // Grab the comma-separated column list between SELECT
            // and FROM, then the simple column names.
            final int selectIdx = full.indexOf("SELECT ");
            final int fromIdx = full.indexOf(" FROM ");
            if (selectIdx < 0 || fromIdx < 0 || fromIdx <= selectIdx) {
                continue;
            }
            final String projection = full.substring(selectIdx + "SELECT ".length(),
                    fromIdx);
            final Set<String> cols = new TreeSet<>();
            for (final String rawCol : projection.split(",")) {
                final String token = rawCol.trim();
                // Strip optional table alias (e.g. "oj.operation_id")
                // and any AS-aliased column name.
                final String last = token.contains(".")
                        ? token.substring(token.lastIndexOf('.') + 1)
                        : token;
                final String simple = last.split("\\s+")[0];
                if (simple.matches("[a-z_][a-z0-9_]*")) {
                    cols.add(simple);
                }
            }
            // Line number of the SELECT literal — useful in the
            // violation message so a reviewer can jump straight to
            // the offending jdbc.query call.
            final int line = (int) src.substring(0, startIdx)
                    .chars().filter(c -> c == '\n').count() + 1;
            out.add(new Select(cols, full, line));
        }
        return out;
    }

    /**
     * Walk forward from a string-literal boundary and glue adjacent
     * {@code "..."} fragments separated only by whitespace or {@code
     * +}. This reconstructs multi-line SQL concatenations into a
     * single logical statement.
     */
    private static String gluedStringAt(final String src, final int firstIdx) {
        final StringBuilder sb = new StringBuilder();
        int i = firstIdx;
        while (i < src.length()) {
            if (src.charAt(i) != '"') {
                break;
            }
            final int end = findStringEnd(src, i);
            if (end < 0) {
                break;
            }
            sb.append(src, i + 1, end);
            // Skip past the closing quote, then whitespace / +.
            i = end + 1;
            while (i < src.length()
                    && (Character.isWhitespace(src.charAt(i))
                        || src.charAt(i) == '+')) {
                i++;
            }
        }
        return sb.toString();
    }

    private static int findStringEnd(final String src, final int openIdx) {
        for (int i = openIdx + 1; i < src.length(); i++) {
            final char c = src.charAt(i);
            if (c == '\\') {
                i++;
                continue;
            }
            if (c == '"') {
                return i;
            }
        }
        return -1;
    }

    private record Select(Set<String> columns, String text, int lineNumber) { }
}
