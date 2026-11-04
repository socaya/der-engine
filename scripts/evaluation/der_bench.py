#!/usr/bin/env python3
"""NFR-15 (latency), NFR-16 (throughput), NFR-19 (scalability) harness.

Issues a configurable number of HTTP requests against a running DER using
only the Python stdlib. Measures p50 / p95 / p99 latency and sustained
successful requests/second at concurrency levels 1 / 5 / 10 / 20.

Usage:
    der_bench.py --base-url http://localhost:8080 \
        --path /edge-api/v1/system/health --duration-seconds 15

Writes a JSON summary to stdout. The orchestrator in run_phase_08.sh
captures it into docs/evaluation/evidence/phase-08/<run>/.
"""
from __future__ import annotations

import argparse
import json
import ssl
import statistics
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, asdict
from typing import List, Optional


@dataclass
class Sample:
    latency_ms: float
    status: int
    ok: bool
    error: Optional[str] = None


@dataclass
class ConcurrencyResult:
    concurrency: int
    duration_seconds: float
    total: int
    successful: int
    failed: int
    throughput_rps: float
    p50_ms: float
    p95_ms: float
    p99_ms: float
    max_ms: float
    errors: dict  # NFR-19 — categorised {HTTP_4XX, HTTP_5XX, TIMEOUT,
                   #                 CONNECTION_REFUSED, OTHER} → int


# NFR-19 — categorise failed samples so the saturation report
# distinguishes "server rejected 500" from "ran out of sockets".
ERROR_CLASSES = ("HTTP_4XX", "HTTP_5XX", "TIMEOUT",
                   "CONNECTION_REFUSED", "OTHER")


def classify_error(status: int, msg: Optional[str]) -> str:
    """Pure classifier — maps a failed sample to one of
    ERROR_CLASSES. Callable without the live bench."""
    if 400 <= status < 500:
        return "HTTP_4XX"
    if 500 <= status < 600:
        return "HTTP_5XX"
    text = (msg or "").lower()
    if "timed out" in text or "timeout" in text:
        return "TIMEOUT"
    if "refused" in text or "econnrefused" in text:
        return "CONNECTION_REFUSED"
    return "OTHER"


def analyze_saturation(levels: List[dict]) -> dict:
    """NFR-19 — turns the per-concurrency result table into a
    reviewer-facing saturation summary.

    * `peakConcurrency` — the concurrency at which throughput maxed.
    * `peakThroughputRps` — that peak throughput.
    * `saturatedAtConcurrency` — the first concurrency at which
      throughput dropped below 95% of the peak (or None if no drop).
    * `latencyInflectedAtConcurrency` — the first concurrency at which
      p95 latency exceeds 2x the lowest-observed p95 (or None).
    * `totalErrors` — sum of 'failed' across every level.
    * `errorBreakdown` — merged per-class error counts across levels.
    """
    if not levels:
        return {"peakConcurrency": None,
                "peakThroughputRps": 0.0,
                "saturatedAtConcurrency": None,
                "latencyInflectedAtConcurrency": None,
                "totalErrors": 0,
                "errorBreakdown": {}}
    peak_c = None
    peak_tp = 0.0
    for lvl in levels:
        if lvl.get("throughput_rps", 0.0) > peak_tp:
            peak_tp = float(lvl["throughput_rps"])
            peak_c = lvl["concurrency"]
    saturated_at = None
    for lvl in levels:
        if peak_tp > 0 and lvl.get("concurrency", 0) > (peak_c or 0) \
                and float(lvl.get("throughput_rps", 0.0)) < 0.95 * peak_tp:
            saturated_at = lvl["concurrency"]
            break
    p95s = [float(l.get("p95_ms", 0.0)) for l in levels
                if float(l.get("p95_ms", 0.0)) > 0]
    low_p95 = min(p95s) if p95s else 0.0
    latency_inflected_at = None
    for lvl in levels:
        if low_p95 > 0 and float(lvl.get("p95_ms", 0.0)) > 2 * low_p95:
            latency_inflected_at = lvl["concurrency"]
            break
    total_errors = sum(int(l.get("failed", 0)) for l in levels)
    breakdown: dict = {}
    for lvl in levels:
        for cls, n in (lvl.get("errors") or {}).items():
            breakdown[cls] = breakdown.get(cls, 0) + int(n)
    return {
        "peakConcurrency": peak_c,
        "peakThroughputRps": round(peak_tp, 3),
        "saturatedAtConcurrency": saturated_at,
        "latencyInflectedAtConcurrency": latency_inflected_at,
        "totalErrors": total_errors,
        "errorBreakdown": breakdown,
    }


def _issue(url: str, method: str, body: Optional[bytes], headers: dict,
           timeout: float, insecure: bool) -> Sample:
    req = urllib.request.Request(url, data=body, method=method)
    for k, v in headers.items():
        req.add_header(k, v)
    ctx = ssl._create_unverified_context() if insecure else None
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            resp.read()
            elapsed = (time.perf_counter() - started) * 1000.0
            return Sample(elapsed, resp.status, 200 <= resp.status < 400)
    except urllib.error.HTTPError as exc:
        elapsed = (time.perf_counter() - started) * 1000.0
        return Sample(elapsed, exc.code, False, f"HTTP {exc.code}")
    except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
        elapsed = (time.perf_counter() - started) * 1000.0
        return Sample(elapsed, 0, False, str(exc))


def _percentile(values: List[float], pct: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    k = max(0, min(len(s) - 1, int(round(pct / 100.0 * (len(s) - 1)))))
    return s[k]


def run_concurrency(url: str, concurrency: int, duration_seconds: float,
                     method: str = "GET", body: Optional[bytes] = None,
                     headers: Optional[dict] = None, timeout: float = 10.0,
                     insecure: bool = False) -> ConcurrencyResult:
    headers = headers or {}
    stop_at = time.monotonic() + duration_seconds
    samples: List[Sample] = []
    lock = threading.Lock()

    def worker() -> None:
        while time.monotonic() < stop_at:
            s = _issue(url, method, body, headers, timeout, insecure)
            with lock:
                samples.append(s)

    started = time.monotonic()
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        for _ in range(concurrency):
            pool.submit(worker)
    actual = time.monotonic() - started

    ok_latencies = [s.latency_ms for s in samples if s.ok]
    all_latencies = [s.latency_ms for s in samples]
    successful = sum(1 for s in samples if s.ok)
    errors = {cls: 0 for cls in ERROR_CLASSES}
    for s in samples:
        if not s.ok:
            errors[classify_error(s.status, s.error)] += 1
    return ConcurrencyResult(
        concurrency=concurrency,
        duration_seconds=round(actual, 3),
        total=len(samples),
        successful=successful,
        failed=len(samples) - successful,
        throughput_rps=round(successful / actual, 3) if actual > 0 else 0.0,
        p50_ms=round(_percentile(ok_latencies, 50), 3),
        p95_ms=round(_percentile(ok_latencies, 95), 3),
        p99_ms=round(_percentile(ok_latencies, 99), 3),
        max_ms=round(max(all_latencies) if all_latencies else 0.0, 3),
        errors=errors,
    )


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--base-url", required=True,
                   help="DER base URL, e.g. http://localhost:8080")
    p.add_argument("--path", default="/edge-api/v1/system/health",
                   help="Request path (default: health probe)")
    p.add_argument("--method", default="GET")
    p.add_argument("--duration-seconds", type=float, default=15.0)
    p.add_argument("--concurrency", default="1,5,10,20",
                   help="Comma-separated concurrency levels")
    p.add_argument("--cookie", default=None,
                   help="Optional Cookie header for authenticated endpoints")
    p.add_argument("--insecure", action="store_true",
                   help="Skip TLS verification (self-signed dev certs)")
    p.add_argument("--timeout-seconds", type=float, default=10.0)
    args = p.parse_args(argv)

    url = args.base_url.rstrip("/") + args.path
    headers = {"Cookie": args.cookie} if args.cookie else {}
    levels = [int(c.strip()) for c in args.concurrency.split(",") if c.strip()]

    report = {
        "url": url,
        "method": args.method,
        "durationSeconds": args.duration_seconds,
        "levels": [],
    }
    for c in levels:
        result = run_concurrency(url, c, args.duration_seconds,
                                   method=args.method, headers=headers,
                                   timeout=args.timeout_seconds,
                                   insecure=args.insecure)
        report["levels"].append(asdict(result))

    # NFR-19 saturation summary over the per-level table.
    report["saturation"] = analyze_saturation(report["levels"])

    json.dump(report, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
