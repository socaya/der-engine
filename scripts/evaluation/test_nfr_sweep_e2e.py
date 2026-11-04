#!/usr/bin/env python3
"""Phase 11.3 — synthetic end-to-end sweep.

Exercises the full budget-checker + experiment-export pipeline
against fabricated sweep artefacts. Does NOT replace a live
pilot-hardware campaign — a real sweep MUST run on the reference
Ubuntu 24.04 host before the stable 1.0.0 tag cuts. What this
test does guarantee:

  * check_resource_budget.py's comparator honours every pinned
    percentile from the shipped budgets JSON
  * check_bench_budget.py's comparator honours every pinned
    latency ceiling + throughput floor at every concurrency level
  * export_experiment.py stitches the fabricated artefacts into
    a reviewer-friendly bundle with every expected key

So any budget tightening in the pinned JSON files is caught at
gate-time instead of surfacing only on a quarterly evaluation run.

Exit 0 — synthetic sweep passes; 1 — any budget comparator
regressed; 2 — invocation error.
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from check_bench_budget import check_budgets as check_bench      # noqa: E402
from check_resource_budget import check_budgets as check_resource  # noqa: E402
from export_experiment import collect_failures                       # noqa: E402


def _load_budget(name: str) -> dict:
    with (HERE / "budgets" / name).open() as fh:
        return json.load(fh)


def _synthetic_resource_report() -> dict:
    """A sampler report whose summary passes every pinned budget
    with margin — proves the pins are reachable on healthy hardware."""
    return {
        "hardware": {"uname": "synthetic phase-11.3 host",
                       "cpuCount": 4},
        "pid": 1234,
        "durationSeconds": 60.0,
        "summary": {
            "cpuPct": {"p50": 25.0, "p95": 55.0, "p99": 75.0, "samples": 12},
            "rssMb":  {"p50": 800.0, "p95": 1200.0, "p99": 1800.0,
                         "samples": 12},
            "latencyMs": {"p50": 25.0, "p95": 300.0, "p99": 1500.0,
                            "samples": 12},
            "throughputOps": {"meanPerSecond": 5.0,
                                "peakPerSecond": 10.0, "samples": 11},
            # 400 KB over 60 s → ~24 MB/hr, well under the 50 MiB/hr pin.
            "diskGrowthBytes": 400_000,
        },
    }


def _synthetic_bench_report() -> dict:
    """A bench report whose per-level results pass every pinned
    latency + throughput budget with margin."""
    levels = [
        {"concurrency": 1,  "duration_seconds": 15.0,
         "total": 150, "successful": 150, "failed": 0,
         "throughput_rps": 10.0, "p50_ms": 15.0,
         "p95_ms": 50.0, "p99_ms": 90.0, "max_ms": 150.0,
         "errors": {"HTTP_4XX": 0, "HTTP_5XX": 0, "TIMEOUT": 0,
                      "CONNECTION_REFUSED": 0, "OTHER": 0}},
        {"concurrency": 5,  "duration_seconds": 15.0,
         "total": 600, "successful": 600, "failed": 0,
         "throughput_rps": 40.0, "p50_ms": 30.0,
         "p95_ms": 200.0, "p99_ms": 400.0, "max_ms": 500.0,
         "errors": {"HTTP_4XX": 0, "HTTP_5XX": 0, "TIMEOUT": 0,
                      "CONNECTION_REFUSED": 0, "OTHER": 0}},
        {"concurrency": 10, "duration_seconds": 15.0,
         "total": 1200, "successful": 1200, "failed": 0,
         "throughput_rps": 80.0, "p50_ms": 40.0,
         "p95_ms": 350.0, "p99_ms": 800.0, "max_ms": 1200.0,
         "errors": {"HTTP_4XX": 0, "HTTP_5XX": 0, "TIMEOUT": 0,
                      "CONNECTION_REFUSED": 0, "OTHER": 0}},
        {"concurrency": 20, "duration_seconds": 15.0,
         "total": 1500, "successful": 1500, "failed": 0,
         "throughput_rps": 60.0, "p50_ms": 90.0,
         "p95_ms": 700.0, "p99_ms": 1500.0, "max_ms": 1800.0,
         "errors": {"HTTP_4XX": 0, "HTTP_5XX": 0, "TIMEOUT": 0,
                      "CONNECTION_REFUSED": 0, "OTHER": 0}},
    ]
    return {
        "url": "http://localhost:8080/edge-api/v1/system/health",
        "method": "GET",
        "durationSeconds": 15.0,
        "levels": levels,
        "saturation": {
            "peakConcurrency": 10, "peakThroughputRps": 80.0,
            "saturatedAtConcurrency": 20,
            "latencyInflectedAtConcurrency": None,
            "totalErrors": 0,
            "errorBreakdown": {},
        },
    }


class SyntheticSweepTest(unittest.TestCase):

    def test_resource_budget_passes_the_shipped_pins(self) -> None:
        result = check_resource(_synthetic_resource_report(),
                                   _load_budget("resource_budgets.json"))
        self.assertTrue(result["pass"],
                         f"shipped resource pins unreachable: {result['failures']}")

    def test_bench_budget_passes_the_shipped_pins(self) -> None:
        result = check_bench(_synthetic_bench_report(),
                                _load_budget("bench_budgets.json"))
        self.assertTrue(result["pass"],
                         f"shipped bench pins unreachable: {result['failures']}")

    def test_failures_aggregator_sees_a_clean_sweep(self) -> None:
        failures = collect_failures(
            check_resource(_synthetic_resource_report(),
                            _load_budget("resource_budgets.json")),
            check_bench(_synthetic_bench_report(),
                         _load_budget("bench_budgets.json")),
            _synthetic_bench_report(),
            None,
        )
        self.assertFalse(failures["anyFailure"])
        self.assertEqual(failures["bench"]["errorsByLevel"], [])

    def test_bench_pins_catch_a_clear_regression(self) -> None:
        bad = _synthetic_bench_report()
        # 400 ms p50 at c=5 is a hard violation (pin is 40 ms).
        bad["levels"][1]["p50_ms"] = 400.0
        result = check_bench(bad, _load_budget("bench_budgets.json"))
        self.assertFalse(result["pass"])
        hits = [f for f in result["failures"]
                if f["metric"] == "latencyMs.p50" and f["concurrency"] == 5]
        self.assertEqual(len(hits), 1)

    def test_resource_pins_catch_a_cpu_regression(self) -> None:
        bad = _synthetic_resource_report()
        bad["summary"]["cpuPct"]["p95"] = 85.0   # pin is 70
        result = check_resource(bad,
                                   _load_budget("resource_budgets.json"))
        self.assertFalse(result["pass"])
        hits = [f for f in result["failures"]
                if "skipped" not in f and f["metric"] == "cpuPct.p95"]
        self.assertEqual(len(hits), 1)

    def test_end_to_end_experiment_export(self) -> None:
        """Runs export_experiment.py against the synthetic sweep
        artefacts + asserts the shape of the produced bundle."""
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            sweep = tmp_path / "sweep"
            sweep.mkdir()

            # Write the fabricated artefacts to the expected names.
            (sweep / "resource-sample.json").write_text(
                json.dumps(_synthetic_resource_report()))
            (sweep / "bench-health.json").write_text(
                json.dumps(_synthetic_bench_report()))
            rb = check_resource(_synthetic_resource_report(),
                                  _load_budget("resource_budgets.json"))
            bb = check_bench(_synthetic_bench_report(),
                               _load_budget("bench_budgets.json"))
            (sweep / "resource-budget-result.json").write_text(json.dumps(rb))
            (sweep / "bench-budget-result.json").write_text(json.dumps(bb))

            out = tmp_path / "experiment"
            rc = subprocess.run(
                [sys.executable, str(HERE / "export_experiment.py"),
                 "--sweep-dir", str(sweep),
                 "--out", str(out),
                 "--commit", "synthetic-11.3",
                 "--base-url", "synthetic://none",
                 "--duration-seconds", "60",
                 "--concurrency", "1,5,10,20",
                 "--operator", "phase-11.3-test"],
                check=True, capture_output=True, text=True).returncode
            self.assertEqual(rc, 0)
            bundles = list(out.iterdir())
            self.assertEqual(len(bundles), 1)
            bundle = bundles[0]
            # Shape + clean-failure assertions.
            cfg = json.loads((bundle / "config.json").read_text())
            self.assertEqual(cfg["commit"], "synthetic-11.3")
            self.assertEqual(cfg["hardware"]["uname"],
                              "synthetic phase-11.3 host")
            fails = json.loads((bundle / "failures.json").read_text())
            self.assertFalse(fails["anyFailure"])


if __name__ == "__main__":
    unittest.main()
