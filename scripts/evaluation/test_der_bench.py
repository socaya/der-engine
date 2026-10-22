#!/usr/bin/env python3
"""Tests for der_bench.py. Uses an in-process HTTP server (stdlib only)."""
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


if __name__ == "__main__":
    unittest.main()
