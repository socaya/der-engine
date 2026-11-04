#!/usr/bin/env python3
"""Unit tests for the FR-17-09 pure functions in export_experiment.py.

Also an end-to-end bundle-generation test that writes to a tempdir
and asserts the manifest + layout.
"""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from export_experiment import (          # noqa: E402
    collect_failures,
    main,
    summarise_inputs,
)


class CollectFailuresTest(unittest.TestCase):

    def test_clean_sweep_no_failures(self) -> None:
        result = collect_failures(
            resource_budget={"pass": True, "failures": []},
            bench_budget={"pass": True, "failures": []},
            bench_report={"levels": [{"concurrency": 1, "errors": {"HTTP_5XX": 0},
                                         "failed": 0, "total": 100}]},
            backup_integrity={"match": True, "fingerprintDiff":
                                  {"byStateDiff": {}, "countsDiff": {}, "missing": []}},
        )
        self.assertFalse(result["anyFailure"])
        self.assertEqual(result["resourceBudget"]["failures"], [])
        self.assertEqual(result["bench"]["errorsByLevel"], [])

    def test_skipped_resource_budget_entries_excluded(self) -> None:
        """Insufficient-sample dimensions are 'skipped', not failures —
        they must not inflate the failure count."""
        result = collect_failures(
            resource_budget={
                "pass": True,
                "failures": [{"metric": "cpuPct.p50", "skipped": "no samples",
                                "measured": None, "budget": 40}],
            },
            bench_budget=None, bench_report=None, backup_integrity=None,
        )
        self.assertFalse(result["anyFailure"])
        self.assertEqual(result["resourceBudget"]["failures"], [])

    def test_bench_errors_surface_per_level(self) -> None:
        bench_report = {"levels": [
            {"concurrency": 1, "errors": {"HTTP_5XX": 0, "OTHER": 0},
             "failed": 0, "total": 100},
            {"concurrency": 20, "errors": {"HTTP_5XX": 5, "TIMEOUT": 2},
             "failed": 7, "total": 300},
        ]}
        result = collect_failures(None, None, bench_report, None)
        rows = result["bench"]["errorsByLevel"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["concurrency"], 20)
        self.assertEqual(rows[0]["errors"], {"HTTP_5XX": 5, "TIMEOUT": 2})
        self.assertTrue(result["anyFailure"])

    def test_saturation_fields_pulled_through(self) -> None:
        bench_report = {
            "levels": [],
            "saturation": {
                "saturatedAtConcurrency": 20,
                "latencyInflectedAtConcurrency": 20,
            },
        }
        result = collect_failures(None, None, bench_report, None)
        self.assertEqual(result["bench"]["saturatedAtConcurrency"], 20)

    def test_backup_integrity_divergence(self) -> None:
        bi = {"match": False, "fingerprintDiff": {
            "byStateDiff": {"CENTRAL_ACCEPTED": -1, "PENDING": 1},
            "countsDiff": {}, "missing": [],
        }}
        result = collect_failures(None, None, None, bi)
        self.assertTrue(result["anyFailure"])
        self.assertFalse(result["backupIntegrity"]["pass"])
        self.assertEqual(
            result["backupIntegrity"]["byStateDiff"]["CENTRAL_ACCEPTED"], -1)

    def test_all_sources_missing_does_not_crash(self) -> None:
        result = collect_failures(None, None, None, None)
        self.assertFalse(result["anyFailure"])


class SummariseInputsTest(unittest.TestCase):

    def test_underscore_prefixed_keys_are_stripped(self) -> None:
        pinned = {"_comment": "committee",
                    "_pins": {"updatedAt": "2026-11-04"},
                    "cpuPct": {"p95Max": 70}}
        out = summarise_inputs({"resource": pinned})
        self.assertNotIn("_comment", out["resource"])
        self.assertNotIn("_pins", out["resource"])
        self.assertIn("cpuPct", out["resource"])

    def test_multiple_budget_files(self) -> None:
        out = summarise_inputs({
            "bench": {"latencyMs": {"p95Max": 500}},
            "resource": {"rssMb": {"p95Max": 1536}},
        })
        self.assertIn("bench", out)
        self.assertIn("resource", out)


class EndToEndBundleTest(unittest.TestCase):

    def test_bundle_layout_and_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            sweep = tmp_path / "sweep"
            sweep.mkdir()
            budgets = tmp_path / "budgets"
            budgets.mkdir()
            out = tmp_path / "out"

            # Fake sweep artefacts.
            (sweep / "resource-sample.json").write_text(json.dumps(
                {"hardware": {"uname": "test host"},
                 "summary": {}, "durationSeconds": 60.0}))
            (sweep / "resource-budget-result.json").write_text(json.dumps(
                {"pass": True, "failures": [], "passed": []}))
            (sweep / "bench-health.json").write_text(json.dumps(
                {"levels": [{"concurrency": 1, "errors": {"HTTP_5XX": 0},
                               "failed": 0, "total": 100}],
                 "saturation": {"peakConcurrency": 1}}))
            (sweep / "bench-budget-result.json").write_text(json.dumps(
                {"pass": True, "failures": [], "passed": []}))

            # Fake budgets dir.
            (budgets / "resource_budgets.json").write_text(json.dumps(
                {"_comment": "committee", "cpuPct": {"p95Max": 70}}))

            rc = main([
                "--sweep-dir", str(sweep),
                "--budgets-dir", str(budgets),
                "--out", str(out),
                "--commit", "abcd123",
                "--base-url", "http://localhost:8080",
                "--duration-seconds", "60",
                "--concurrency", "1,5",
                "--operator", "test",
            ])
            self.assertEqual(rc, 0)

            # Exactly one experiment dir created.
            created = list(out.iterdir())
            self.assertEqual(len(created), 1)
            bundle = created[0]

            # Core layout.
            self.assertTrue((bundle / "config.json").is_file())
            self.assertTrue((bundle / "failures.json").is_file())
            self.assertTrue((bundle / "manifest.json").is_file())
            self.assertTrue((bundle / "inputs" / "resource_budgets.json").is_file())
            self.assertTrue((bundle / "outputs" / "resource-sample.json").is_file())
            self.assertTrue((bundle / "outputs" / "bench-health.json").is_file())

            # Config carries the config fields.
            cfg = json.loads((bundle / "config.json").read_text())
            self.assertEqual(cfg["commit"], "abcd123")
            self.assertEqual(cfg["operator"], "test")
            self.assertEqual(cfg["concurrencyLevels"], [1, 5])
            self.assertEqual(cfg["hardware"]["uname"], "test host")
            # Underscore keys were stripped from the inputs summary.
            self.assertNotIn("_comment",
                               cfg["inputsSummary"]["resource_budgets"])

            # Failures are empty on a clean sweep.
            fails = json.loads((bundle / "failures.json").read_text())
            self.assertFalse(fails["anyFailure"])

            # Manifest covers every file.
            manifest = json.loads((bundle / "manifest.json").read_text())
            for rel in ("config.json", "failures.json",
                          "inputs/resource_budgets.json",
                          "outputs/bench-health.json"):
                self.assertIn(rel, manifest["files"])
            # SHA-256 is 64 hex chars.
            self.assertTrue(all(len(h) == 64
                                   for h in manifest["files"].values()))


if __name__ == "__main__":
    unittest.main()
