#!/usr/bin/env python3
"""Unit tests for the NFR-29 pure comparator in backup_integrity.py.

Does not touch a live DER — exercises the fingerprint + compare
logic against fabricated probe responses.
"""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from backup_integrity import (          # noqa: E402
    JOURNAL_STATES,
    compare_fingerprint,
    fingerprint,
    markdown_summary,
)


class FingerprintTest(unittest.TestCase):

    def test_flat_ints_become_counts(self):
        fp = fingerprint({"sessions": 3, "journalDepth": 12}, {})
        self.assertEqual(fp["counts"]["sessions"], 3)
        self.assertEqual(fp["counts"]["journalDepth"], 12)

    def test_nested_ints_become_dotted_keys(self):
        fp = fingerprint({"db": {"sessions": 2, "users": 7}}, {})
        self.assertEqual(fp["counts"]["db.sessions"], 2)
        self.assertEqual(fp["counts"]["db.users"], 7)

    def test_bystate_includes_every_canonical_state(self):
        fp = fingerprint({}, {"PENDING": 5, "CENTRAL_ACCEPTED": 10})
        for state in JOURNAL_STATES:
            self.assertIn(state, fp["byState"])
        self.assertEqual(fp["byState"]["PENDING"], 5)
        self.assertEqual(fp["byState"]["CENTRAL_ACCEPTED"], 10)
        # states not reported default to 0, not missing
        self.assertEqual(fp["byState"]["QUARANTINED"], 0)

    def test_non_ints_ignored_in_health(self):
        fp = fingerprint({"status": "UP", "sessions": 3}, {})
        self.assertNotIn("status", fp["counts"])
        self.assertEqual(fp["counts"]["sessions"], 3)


class CompareFingerprintTest(unittest.TestCase):

    def _fp(self, counts=None, by_state=None):
        return {"counts": counts or {}, "byState": by_state or {}}

    def test_identical_matches(self):
        before = self._fp({"a": 1}, {"PENDING": 2, "CENTRAL_ACCEPTED": 10})
        after = self._fp({"a": 1}, {"PENDING": 2, "CENTRAL_ACCEPTED": 10})
        result = compare_fingerprint(before, after)
        self.assertTrue(result["match"])
        self.assertEqual(result["byStateDiff"], {})
        self.assertEqual(result["countsDiff"], {})

    def test_bystate_regression_fails(self):
        # One CENTRAL_ACCEPTED record lost after restore — NFR-29 says
        # this MUST fail even if the grand total is preserved.
        before = self._fp({}, {"PENDING": 0, "CENTRAL_ACCEPTED": 10})
        after = self._fp({}, {"PENDING": 1, "CENTRAL_ACCEPTED": 9})
        result = compare_fingerprint(before, after)
        self.assertFalse(result["match"])
        self.assertEqual(result["byStateDiff"]["CENTRAL_ACCEPTED"], -1)
        self.assertEqual(result["byStateDiff"]["PENDING"], 1)

    def test_counter_drift_fails(self):
        before = self._fp({"journalDepth": 5}, {})
        after = self._fp({"journalDepth": 4}, {})
        result = compare_fingerprint(before, after)
        self.assertFalse(result["match"])
        self.assertEqual(result["countsDiff"]["journalDepth"], -1)

    def test_counter_missing_after_restore_fails(self):
        before = self._fp({"sessions": 3}, {})
        after = self._fp({}, {})
        result = compare_fingerprint(before, after)
        self.assertFalse(result["match"])
        self.assertIn("sessions", result["missing"])

    def test_new_counter_after_restore_fails(self):
        """A counter that didn't exist before but does now is still drift —
        the fingerprint is supposed to be stable across a round-trip."""
        before = self._fp({}, {})
        after = self._fp({"newCounter": 5}, {})
        result = compare_fingerprint(before, after)
        self.assertFalse(result["match"])
        self.assertEqual(result["countsDiff"]["newCounter"], 5)


class MarkdownSummaryTest(unittest.TestCase):

    def test_renders_pass_summary(self):
        report = {
            "kind": "FULL",
            "generatedAt": "2026-11-04T10:00:00Z",
            "backupRunId": 42,
            "restoreRunId": 99,
            "match": True,
            "fingerprintDiff": {"byStateDiff": {}, "countsDiff": {},
                                   "missing": []},
        }
        md = markdown_summary(report)
        self.assertIn("NFR-29 evidence", md)
        self.assertIn("**Match:** **YES**", md)
        self.assertNotIn("Journal-state drift", md)

    def test_renders_fail_summary_with_tables(self):
        report = {
            "kind": "FULL",
            "generatedAt": "2026-11-04T10:00:00Z",
            "backupRunId": 42,
            "restoreRunId": 99,
            "match": False,
            "fingerprintDiff": {
                "byStateDiff": {"CENTRAL_ACCEPTED": -1, "PENDING": 1},
                "countsDiff": {"journalDepth": -1},
                "missing": ["sessions"],
            },
        }
        md = markdown_summary(report)
        self.assertIn("**Match:** **NO**", md)
        self.assertIn("Journal-state drift", md)
        self.assertIn("CENTRAL_ACCEPTED", md)
        self.assertIn("-1", md)
        self.assertIn("Missing counters", md)
        self.assertIn("sessions", md)


if __name__ == "__main__":
    unittest.main()
