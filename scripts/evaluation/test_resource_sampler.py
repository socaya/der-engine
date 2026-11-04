#!/usr/bin/env python3
"""Tests for resource_sampler.py — end-to-end smoke + FR-17-08
percentile / throughput pure-function coverage."""
from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
SCRIPT = HERE / "resource_sampler.py"

sys.path.insert(0, str(HERE))
from resource_sampler import (          # noqa: E402
    percentile,
    summarize,
    throughput_series,
)


class ResourceSamplerTest(unittest.TestCase):
    def _run(self, pid: int, data_dir: str = "") -> dict:
        completed = subprocess.run(
            [sys.executable, str(SCRIPT),
             "--pid", str(pid),
             "--data-dir", data_dir,
             "--duration-seconds", "0.3",
             "--interval-seconds", "0.1"],
            check=True, capture_output=True, text=True,
        )
        return json.loads(completed.stdout)

    def test_hardware_fingerprint_present(self) -> None:
        report = self._run(0)
        self.assertIn("hardware", report)
        self.assertIn("uname", report["hardware"])

    def test_samples_timeseries(self) -> None:
        report = self._run(0)
        self.assertGreaterEqual(len(report["series"]), 1)

    def test_data_dir_size_captured(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            fp = pathlib.Path(tmp) / "payload.bin"
            fp.write_bytes(b"x" * 4096)
            report = self._run(0, tmp)
        samples = [s for s in report["series"] if s["dataBytes"] is not None]
        self.assertGreaterEqual(len(samples), 1)
        self.assertGreaterEqual(samples[0]["dataBytes"], 4096)

    def test_pid_sampling_handles_self(self) -> None:
        report = self._run(os.getpid())
        has_process = any(s["process"] is not None for s in report["series"])
        self.assertTrue(has_process)

    def test_summary_present_in_report(self) -> None:
        report = self._run(0)
        self.assertIn("summary", report)
        # Every pillar must be present even on a zero-sample run.
        for key in ("cpuPct", "rssMb", "latencyMs", "throughputOps"):
            self.assertIn(key, report["summary"])


class PercentileTest(unittest.TestCase):

    def test_empty_returns_none(self) -> None:
        self.assertIsNone(percentile([], 50))

    def test_single_value(self) -> None:
        self.assertEqual(percentile([42.0], 50), 42.0)

    def test_sorted_series_median(self) -> None:
        self.assertEqual(percentile([10, 20, 30, 40, 50], 50), 30.0)

    def test_unsorted_series_still_correct(self) -> None:
        self.assertEqual(percentile([50, 10, 30, 20, 40], 50), 30.0)

    def test_p0_min_p100_max(self) -> None:
        self.assertEqual(percentile([10, 20, 30], 0), 10.0)
        self.assertEqual(percentile([10, 20, 30], 100), 30.0)

    def test_linear_interpolation(self) -> None:
        # p75 of [10, 20, 30, 40] → 32.5 via linear interpolation
        self.assertEqual(percentile([10, 20, 30, 40], 75), 32.5)


class ThroughputSeriesTest(unittest.TestCase):

    def test_first_sample_is_none(self) -> None:
        samples = [
            {"atSeconds": 0.0, "metrics": {"centralAccepted": 10}},
            {"atSeconds": 5.0, "metrics": {"centralAccepted": 20}},
        ]
        tps = throughput_series(samples)
        self.assertIsNone(tps[0])            # no prior delta
        self.assertAlmostEqual(tps[1], 2.0)  # 10 ops / 5 s

    def test_missing_counter_preserves_prev(self) -> None:
        samples = [
            {"atSeconds": 0.0,  "metrics": {"centralAccepted": 10}},
            {"atSeconds": 5.0,  "metrics": {}},
            {"atSeconds": 10.0, "metrics": {"centralAccepted": 30}},
        ]
        tps = throughput_series(samples)
        self.assertIsNone(tps[0])
        self.assertIsNone(tps[1])
        # Δ against the last known sample at t=0 → (30-10)/10 = 2.0
        self.assertAlmostEqual(tps[2], 2.0)

    def test_counter_regression_clamps_to_zero(self) -> None:
        # Simulates a server restart — the counter drops. We must
        # not emit negative throughput.
        samples = [
            {"atSeconds": 0.0, "metrics": {"centralAccepted": 100}},
            {"atSeconds": 5.0, "metrics": {"centralAccepted": 5}},
        ]
        tps = throughput_series(samples)
        self.assertEqual(tps[1], 0.0)

    def test_zero_dt_returns_none(self) -> None:
        samples = [
            {"atSeconds": 5.0, "metrics": {"centralAccepted": 10}},
            {"atSeconds": 5.0, "metrics": {"centralAccepted": 20}},
        ]
        tps = throughput_series(samples)
        self.assertIsNone(tps[1])


class SummarizeTest(unittest.TestCase):

    def test_empty_series_is_safe(self) -> None:
        s = summarize([])
        self.assertIsNone(s["cpuPct"]["p50"])
        self.assertIsNone(s["diskGrowthBytes"])
        self.assertIsNone(s["throughputOps"]["meanPerSecond"])

    def test_cpu_rss_latency_percentiles(self) -> None:
        samples = [
            {"atSeconds": 0,  "process": {"cpuPct": 10.0, "rssMb": 100.0},
             "latencyMs": 5.0,  "dataBytes": 1000},
            {"atSeconds": 5,  "process": {"cpuPct": 20.0, "rssMb": 110.0},
             "latencyMs": 7.0,  "dataBytes": 1100},
            {"atSeconds": 10, "process": {"cpuPct": 50.0, "rssMb": 120.0},
             "latencyMs": 9.0,  "dataBytes": 1200},
            {"atSeconds": 15, "process": {"cpuPct": 80.0, "rssMb": 130.0},
             "latencyMs": 50.0, "dataBytes": 1300},
        ]
        s = summarize(samples)
        self.assertEqual(s["cpuPct"]["p50"], 35.0)
        self.assertEqual(s["rssMb"]["samples"], 4)
        self.assertEqual(s["latencyMs"]["p50"], 8.0)
        self.assertEqual(s["diskGrowthBytes"], 300)

    def test_throughput_mean_peak(self) -> None:
        samples = [
            {"atSeconds": 0,  "metrics": {"centralAccepted": 100}},
            {"atSeconds": 5,  "metrics": {"centralAccepted": 110}},  # 2/s
            {"atSeconds": 10, "metrics": {"centralAccepted": 160}},  # 10/s
        ]
        s = summarize(samples)
        self.assertAlmostEqual(s["throughputOps"]["meanPerSecond"], 6.0)
        self.assertAlmostEqual(s["throughputOps"]["peakPerSecond"], 10.0)
        self.assertEqual(s["throughputOps"]["samples"], 2)

    def test_partial_samples_ignored_per_dimension(self) -> None:
        samples = [
            {"atSeconds": 0, "process": {"cpuPct": 10.0, "rssMb": 100.0},
             "latencyMs": None, "dataBytes": None},
            {"atSeconds": 5, "process": None,
             "latencyMs": 5.0, "dataBytes": 1000},
        ]
        s = summarize(samples)
        self.assertEqual(s["cpuPct"]["samples"], 1)
        self.assertEqual(s["latencyMs"]["samples"], 1)
        self.assertIsNone(s["diskGrowthBytes"])   # only one disk sample


if __name__ == "__main__":
    unittest.main()
