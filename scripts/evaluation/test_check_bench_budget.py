#!/usr/bin/env python3
"""Unit tests for the NFR-15 / NFR-16 pure comparator in
check_bench_budget.py. No filesystem IO — exercises against
synthetic bench reports."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from check_bench_budget import (          # noqa: E402
    check_budgets,
    markdown_report,
)


def _level(concurrency: int, p50=10.0, p95=100.0, p99=200.0,
             rps=50.0, total=1000, failed=0) -> dict:
    return {"concurrency": concurrency,
            "p50_ms": p50, "p95_ms": p95, "p99_ms": p99,
            "throughput_rps": rps, "total": total, "failed": failed}


def _budgets():
    return {
        "latencyMs": {
            "p50Max": 50.0, "p95Max": 500.0, "p99Max": 2000.0,
            "perConcurrency": {
                "1":  {"p50Max": 20.0, "p95Max": 100.0},
                "20": {"p50Max": 100.0, "p95Max": 1000.0},
            },
        },
        "throughputRps": {
            "min": 10.0,
            "perConcurrency": {"20": {"min": 50.0}},
        },
        "errors": {"maxErrorRatePct": 1.0},
    }


class CheckBudgetsTest(unittest.TestCase):

    def test_everything_within_budget_passes(self) -> None:
        report = {"levels": [
            _level(1,  p50=15.0, p95=80.0,  rps=20.0),
            _level(5,  p50=30.0, p95=200.0, rps=40.0),
            _level(10, p50=40.0, p95=400.0, rps=80.0),
            _level(20, p50=90.0, p95=900.0, rps=60.0),
        ]}
        result = check_budgets(report, _budgets())
        self.assertTrue(result["pass"])
        self.assertEqual(result["failures"], [])
        # Spot-check: c=1 used the override (20 ms, not 50)
        passing_c1 = [p for p in result["passed"]
                        if p["concurrency"] == 1 and p["metric"] == "latencyMs.p50"]
        self.assertEqual(passing_c1[0]["budget"], 20.0)

    def test_per_concurrency_override_tightens_limit(self) -> None:
        """c=1 override is 20 ms; without the override the global
        50 ms would have let 30 ms through. With the override, 30 ms
        fails."""
        report = {"levels": [_level(1, p50=30.0)]}
        result = check_budgets(report, _budgets())
        self.assertFalse(result["pass"])
        f = next(f for f in result["failures"]
                 if f["metric"] == "latencyMs.p50" and f["concurrency"] == 1)
        self.assertEqual(f["budget"], 20.0)

    def test_per_concurrency_override_loosens_limit(self) -> None:
        """c=20 override is 100 ms; global ceiling is 50 ms. 90 ms at
        c=20 passes because the override wins."""
        report = {"levels": [_level(20, p50=90.0, p95=900.0, rps=60.0)]}
        result = check_budgets(report, _budgets())
        self.assertTrue(result["pass"])

    def test_global_ceiling_applies_when_no_override(self) -> None:
        # c=5 has no override; global p95 500 applies — 600 is over.
        report = {"levels": [_level(5, p95=600.0)]}
        result = check_budgets(report, _budgets())
        self.assertFalse(result["pass"])

    def test_throughput_minimum_enforced(self) -> None:
        report = {"levels": [_level(10, rps=5.0)]}
        result = check_budgets(report, _budgets())
        self.assertFalse(result["pass"])
        f = next(f for f in result["failures"] if f["metric"] == "throughputRps")
        self.assertEqual(f["budget"], 10.0)
        self.assertEqual(f["measured"], 5.0)

    def test_throughput_per_concurrency_override(self) -> None:
        # c=20 requires >=50; 30 fails even though it beats the global 10.
        report = {"levels": [_level(20, rps=30.0, p50=90.0, p95=900.0)]}
        result = check_budgets(report, _budgets())
        self.assertFalse(result["pass"])
        f = next(f for f in result["failures"] if f["metric"] == "throughputRps")
        self.assertEqual(f["budget"], 50.0)

    def test_error_rate_enforced(self) -> None:
        # 20 failed out of 1000 → 2% > 1%
        report = {"levels": [_level(5, total=1000, failed=20)]}
        result = check_budgets(report, _budgets())
        self.assertFalse(result["pass"])
        f = next(f for f in result["failures"] if f["metric"] == "errorRatePct")
        self.assertAlmostEqual(f["measured"], 2.0)

    def test_zero_total_does_not_divide_by_zero(self) -> None:
        report = {"levels": [_level(5, total=0, failed=0,
                                       p50=10.0, p95=20.0, rps=10.0)]}
        result = check_budgets(report, _budgets())
        # errorRatePct = 0 → below budget, passes.
        self.assertTrue(result["pass"])

    def test_missing_report_fields_are_tolerated(self) -> None:
        # Level without p99_ms — comparator must not crash.
        level = {"concurrency": 5, "p50_ms": 10.0, "p95_ms": 100.0,
                   "throughput_rps": 20.0, "total": 0, "failed": 0}
        result = check_budgets({"levels": [level]}, _budgets())
        self.assertTrue(result["pass"])

    def test_empty_report_passes(self) -> None:
        self.assertTrue(check_budgets({"levels": []}, _budgets())["pass"])


class MarkdownReportTest(unittest.TestCase):

    def test_pass_summary(self) -> None:
        result = {"pass": True, "failures": [],
                     "passed": [{"metric": "latencyMs.p50", "concurrency": 5,
                                   "measured": 30.0, "budget": 50.0}]}
        md = markdown_report(result)
        self.assertIn("**Result:** **PASS**", md)
        self.assertNotIn("Budget violations", md)

    def test_fail_summary_includes_concurrency_column(self) -> None:
        result = {
            "pass": False,
            "failures": [{"metric": "throughputRps", "concurrency": 20,
                           "measured": 5.0, "budget": 50.0,
                           "rule": "throughputRps >= 50 @ c=20"}],
            "passed": [],
        }
        md = markdown_report(result)
        self.assertIn("**Result:** **FAIL**", md)
        self.assertIn("Budget violations", md)
        self.assertIn("| 20 |", md)
        self.assertIn("throughputRps >= 50", md)


if __name__ == "__main__":
    unittest.main()
