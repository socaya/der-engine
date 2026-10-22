#!/usr/bin/env python3
"""Tests for resource_sampler.py."""
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


if __name__ == "__main__":
    unittest.main()
