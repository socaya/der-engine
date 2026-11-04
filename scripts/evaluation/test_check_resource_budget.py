#!/usr/bin/env python3
"""Unit tests for the NFR-18 pure comparator in check_resource_budget.py.

No filesystem IO — exercises the comparator against synthetic reports.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from check_resource_budget import (          # noqa: E402
    check_budgets,
    markdown_report,
)


def _report(cpu=None, rss=None, lat=None, disk_bytes=None, dur=None):
    """Fabricates the subset of the sampler's report that the
    comparator looks at."""
    summary = {}
    if cpu is not None:
        summary["cpuPct"] = {"p50": cpu[0], "p95": cpu[1], "p99": cpu[2]}
    if rss is not None:
        summary["rssMb"] = {"p50": rss[0], "p95": rss[1], "p99": rss[2]}
    if lat is not None:
        summary["latencyMs"] = {"p50": lat[0], "p95": lat[1], "p99": lat[2]}
    if disk_bytes is not None:
        summary["diskGrowthBytes"] = disk_bytes
    return {"summary": summary, "durationSeconds": dur}


def _budgets():
    """Mirror of budgets/resource_budgets.json for the unit test —
    changes to the shipped file don't change behaviour here."""
    return {
        "cpuPct":    {"p50Max": 40.0, "p95Max": 70.0, "p99Max": 90.0},
        "rssMb":     {"p50Max": 1024.0, "p95Max": 1536.0, "p99Max": 2048.0},
        "latencyMs": {"p50Max": 50.0, "p95Max": 500.0, "p99Max": 2000.0},
        "diskGrowthBytesPerHour": {"max": 52_428_800},
    }


class CheckBudgetsTest(unittest.TestCase):

    def test_everything_within_budget_passes(self) -> None:
        r = _report(cpu=(30.0, 65.0, 85.0),
                      rss=(800.0, 1400.0, 1900.0),
                      lat=(10.0, 100.0, 500.0),
                      disk_bytes=1_000_000, dur=600.0)
        result = check_budgets(r, _budgets())
        self.assertTrue(result["pass"])
        self.assertEqual(result["failures"], [])
        # Every budgeted percentile landed in passed.
        metrics = [p["metric"] for p in result["passed"]]
        self.assertIn("cpuPct.p95", metrics)
        self.assertIn("rssMb.p99", metrics)
        self.assertIn("latencyMs.p50", metrics)
        self.assertIn("diskGrowthBytesPerHour", metrics)

    def test_cpu_overflow_fails(self) -> None:
        # p95 = 75 > 70
        r = _report(cpu=(30.0, 75.0, 85.0))
        result = check_budgets(r, _budgets())
        self.assertFalse(result["pass"])
        fails = {f["metric"]: f for f in result["failures"] if "skipped" not in f}
        self.assertIn("cpuPct.p95", fails)
        self.assertEqual(fails["cpuPct.p95"]["measured"], 75.0)
        self.assertEqual(fails["cpuPct.p95"]["budget"], 70.0)

    def test_latency_p99_overflow_fails(self) -> None:
        r = _report(lat=(10.0, 100.0, 3000.0))
        result = check_budgets(r, _budgets())
        self.assertFalse(result["pass"])
        failing = {f["metric"] for f in result["failures"] if "skipped" not in f}
        self.assertIn("latencyMs.p99", failing)

    def test_disk_growth_per_hour_computed_correctly(self) -> None:
        # 100 MB raw growth over 1h → 100 MB/hr > 50 MiB limit → fail
        hundred_mb = 100 * 1024 * 1024
        r = _report(disk_bytes=hundred_mb, dur=3600.0)
        result = check_budgets(r, _budgets())
        fails = {f["metric"]: f for f in result["failures"] if "skipped" not in f}
        self.assertIn("diskGrowthBytesPerHour", fails)
        # 1 MB over 1h — well within budget → pass
        r = _report(disk_bytes=1_000_000, dur=3600.0)
        result = check_budgets(r, _budgets())
        self.assertTrue(result["pass"])

    def test_missing_summary_metric_surfaces_as_skipped(self) -> None:
        """When the sampler didn't capture CPU (e.g. pid=0), the
        comparator reports it as skipped rather than failing — but
        the overall pass flag stays TRUE because skipped != failed."""
        r = _report(rss=(800.0, 1400.0, 1900.0),
                      lat=(10.0, 100.0, 500.0),
                      disk_bytes=1_000_000, dur=600.0)
        # No cpu
        result = check_budgets(r, _budgets())
        self.assertTrue(result["pass"])
        skipped = [f for f in result["failures"] if "skipped" in f]
        self.assertTrue(any(f["metric"].startswith("cpuPct.") for f in skipped))

    def test_duration_override(self) -> None:
        r = _report(disk_bytes=10_000_000, dur=None)
        # No duration anywhere → disk check is skipped, but pass is True
        result = check_budgets(r, _budgets())
        self.assertTrue(result["pass"])
        skipped = {f["metric"]: f for f in result["failures"] if "skipped" in f}
        self.assertIn("diskGrowthBytesPerHour", skipped)
        # Explicit duration lets the check run
        result = check_budgets(r, _budgets(), duration_seconds=3600.0)
        self.assertTrue(result["pass"])  # 10MB / h is within budget

    def test_both_cpu_and_rss_overflow_reports_both(self) -> None:
        r = _report(cpu=(30.0, 75.0, 85.0),
                      rss=(800.0, 1600.0, 2200.0))
        result = check_budgets(r, _budgets())
        self.assertFalse(result["pass"])
        failing = {f["metric"] for f in result["failures"] if "skipped" not in f}
        self.assertIn("cpuPct.p95", failing)
        self.assertIn("rssMb.p95", failing)
        self.assertIn("rssMb.p99", failing)


class MarkdownReportTest(unittest.TestCase):

    def test_pass_summary(self) -> None:
        result = {"pass": True, "failures": [],
                     "passed": [{"metric": "cpuPct.p95",
                                   "measured": 60.0, "budget": 70.0}]}
        md = markdown_report(result)
        self.assertIn("**Result:** **PASS**", md)
        self.assertIn("Passing", md)
        self.assertNotIn("Budget violations", md)

    def test_fail_summary_has_rule_column(self) -> None:
        result = {
            "pass": False,
            "failures": [{"metric": "cpuPct.p95", "measured": 75.0,
                           "budget": 70.0, "rule": "cpuPct.p95 <= 70"}],
            "passed": [],
        }
        md = markdown_report(result)
        self.assertIn("**Result:** **FAIL**", md)
        self.assertIn("Budget violations", md)
        self.assertIn("cpuPct.p95 <= 70", md)

    def test_skipped_section_renders(self) -> None:
        result = {
            "pass": True, "passed": [],
            "failures": [{"metric": "latencyMs.p95", "skipped": "no samples",
                           "measured": None, "budget": 500.0,
                           "rule": "latencyMs.p95 <= 500 ms"}],
        }
        md = markdown_report(result)
        self.assertIn("Skipped", md)
        self.assertIn("no samples", md)


if __name__ == "__main__":
    unittest.main()
