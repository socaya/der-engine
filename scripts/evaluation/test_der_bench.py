#!/usr/bin/env python3
"""Tests for der_bench.py. End-to-end stdlib HTTP server smoke plus
NFR-19 pure-function coverage (classify_error, analyze_saturation)."""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = pathlib.Path(__file__).resolve().parent
SCRIPT = HERE / "der_bench.py"

sys.path.insert(0, str(HERE))
from der_bench import (          # noqa: E402
    analyze_saturation,
    classify_error,
)


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        if self.path.startswith("/slow"):
            time.sleep(0.02)
            body = b'{"status":"slow"}'
        elif self.path.startswith("/bad"):
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error":"nope"}')
            return
        else:
            body = b'{"status":"ok"}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args, **kwargs):  # pragma: no cover - silence
        pass


class DerBenchTest(unittest.TestCase):
    def setUp(self):
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        self.port = self.server.server_address[1]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()

    def _run(self, *args: str, duration: str = "0.3") -> dict:
        completed = subprocess.run(
            [sys.executable, str(SCRIPT),
             "--base-url", f"http://127.0.0.1:{self.port}",
             "--duration-seconds", duration,
             "--concurrency", "1,2",
             *args],
            check=True, capture_output=True, text=True,
        )
        return json.loads(completed.stdout)

    def test_reports_percentiles(self) -> None:
        report = self._run("--path", "/ok")
        self.assertEqual(len(report["levels"]), 2)
        for lvl in report["levels"]:
            self.assertGreater(lvl["total"], 0)
            self.assertEqual(lvl["failed"], 0)
            self.assertGreaterEqual(lvl["p95_ms"], 0)
            self.assertGreater(lvl["throughput_rps"], 0)

    def test_marks_http_500_as_failed(self) -> None:
        report = self._run("--path", "/bad")
        for lvl in report["levels"]:
            self.assertEqual(lvl["successful"], 0)
            self.assertGreater(lvl["failed"], 0)

    def test_percentile_scales_with_slow_endpoint(self) -> None:
        report = self._run("--path", "/slow", duration="0.5")
        for lvl in report["levels"]:
            self.assertGreaterEqual(lvl["p50_ms"], 10.0)

    def test_report_includes_saturation_and_errors(self) -> None:
        """NFR-19: every report MUST carry the saturation summary and
        each level MUST carry the categorised errors map."""
        report = self._run("--path", "/ok")
        self.assertIn("saturation", report)
        self.assertIn("peakConcurrency", report["saturation"])
        self.assertIn("totalErrors", report["saturation"])
        self.assertIn("errorBreakdown", report["saturation"])
        for lvl in report["levels"]:
            self.assertIn("errors", lvl)
            for cls in ("HTTP_4XX", "HTTP_5XX", "TIMEOUT",
                         "CONNECTION_REFUSED", "OTHER"):
                self.assertIn(cls, lvl["errors"])

    def test_http_500_lands_in_errors_http_5xx(self) -> None:
        report = self._run("--path", "/bad")
        for lvl in report["levels"]:
            # Every failed sample classifies as HTTP_5XX, not OTHER.
            self.assertGreater(lvl["errors"]["HTTP_5XX"], 0)
            self.assertEqual(lvl["errors"]["OTHER"], 0)
        # The saturation summary aggregates the per-level breakdown.
        self.assertGreater(
            report["saturation"]["errorBreakdown"].get("HTTP_5XX", 0), 0)


class ClassifyErrorTest(unittest.TestCase):

    def test_http_4xx_bracket(self) -> None:
        self.assertEqual(classify_error(400, None), "HTTP_4XX")
        self.assertEqual(classify_error(404, "Not Found"), "HTTP_4XX")
        self.assertEqual(classify_error(499, None), "HTTP_4XX")

    def test_http_5xx_bracket(self) -> None:
        self.assertEqual(classify_error(500, None), "HTTP_5XX")
        self.assertEqual(classify_error(503, "Service Unavailable"), "HTTP_5XX")

    def test_timeout_message(self) -> None:
        self.assertEqual(classify_error(0, "The read timed out"), "TIMEOUT")
        self.assertEqual(classify_error(0, "timeout after 10s"), "TIMEOUT")

    def test_connection_refused_message(self) -> None:
        self.assertEqual(classify_error(0, "Connection refused"),
                           "CONNECTION_REFUSED")
        self.assertEqual(classify_error(0, "ECONNREFUSED"),
                           "CONNECTION_REFUSED")

    def test_other_fallback(self) -> None:
        self.assertEqual(classify_error(0, "DNS lookup failed"), "OTHER")
        self.assertEqual(classify_error(0, None), "OTHER")


class AnalyzeSaturationTest(unittest.TestCase):

    def test_empty_levels(self) -> None:
        s = analyze_saturation([])
        self.assertIsNone(s["peakConcurrency"])
        self.assertEqual(s["totalErrors"], 0)

    def test_linear_scaling_no_saturation(self) -> None:
        """Throughput still rising — nothing saturated yet."""
        levels = [
            {"concurrency": 1,  "throughput_rps": 10.0, "p95_ms": 5.0,  "failed": 0, "errors": {}},
            {"concurrency": 5,  "throughput_rps": 50.0, "p95_ms": 6.0,  "failed": 0, "errors": {}},
            {"concurrency": 10, "throughput_rps": 100.0,"p95_ms": 7.0, "failed": 0, "errors": {}},
        ]
        s = analyze_saturation(levels)
        self.assertEqual(s["peakConcurrency"], 10)
        self.assertEqual(s["peakThroughputRps"], 100.0)
        self.assertIsNone(s["saturatedAtConcurrency"])
        self.assertIsNone(s["latencyInflectedAtConcurrency"])

    def test_throughput_saturates_at_middle(self) -> None:
        """Throughput peaks at c=10, falls > 5% at c=20."""
        levels = [
            {"concurrency": 1,  "throughput_rps": 10.0, "p95_ms": 5.0,  "failed": 0, "errors": {}},
            {"concurrency": 10, "throughput_rps": 100.0,"p95_ms": 10.0, "failed": 0, "errors": {}},
            {"concurrency": 20, "throughput_rps": 60.0, "p95_ms": 30.0, "failed": 0, "errors": {}},
        ]
        s = analyze_saturation(levels)
        self.assertEqual(s["peakConcurrency"], 10)
        self.assertEqual(s["saturatedAtConcurrency"], 20)

    def test_latency_inflection_detected(self) -> None:
        """p95 doubles vs lowest at c=20."""
        levels = [
            {"concurrency": 1,  "throughput_rps": 10.0, "p95_ms": 5.0,  "failed": 0, "errors": {}},
            {"concurrency": 10, "throughput_rps": 90.0, "p95_ms": 8.0,  "failed": 0, "errors": {}},
            {"concurrency": 20, "throughput_rps": 100.0,"p95_ms": 25.0, "failed": 0, "errors": {}},
        ]
        s = analyze_saturation(levels)
        self.assertEqual(s["latencyInflectedAtConcurrency"], 20)

    def test_error_breakdown_merged_across_levels(self) -> None:
        levels = [
            {"concurrency": 1,  "throughput_rps": 10.0, "p95_ms": 5.0, "failed": 2,
             "errors": {"HTTP_5XX": 2, "OTHER": 0}},
            {"concurrency": 10, "throughput_rps": 90.0, "p95_ms": 8.0, "failed": 3,
             "errors": {"HTTP_5XX": 1, "TIMEOUT": 2}},
        ]
        s = analyze_saturation(levels)
        self.assertEqual(s["totalErrors"], 5)
        self.assertEqual(s["errorBreakdown"]["HTTP_5XX"], 3)
        self.assertEqual(s["errorBreakdown"]["TIMEOUT"], 2)


if __name__ == "__main__":
    unittest.main()
