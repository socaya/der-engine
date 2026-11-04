#!/usr/bin/env python3
"""FR-17-08 / NFR-18 / NFR-35 — resource + latency + throughput sampler.

Samples at --interval-seconds for --duration-seconds, capturing:

  * RSS (MB) and CPU% of the DER JVM (--pid)
  * Postgres data-dir / DER data-dir growth (--data-dir)
  * Round-trip latency on GET /edge-api/v1/system/health
  * Throughput inferred from CENTRAL_ACCEPTED counter deltas on
    GET /edge-api/v1/admin/metrics (requires auth; --cookie)

Emits:

  * a JSON time-series to --out (default stdout)
  * summary statistics: p50/p95/p99 for CPU, RSS, latencyMs;
    mean / peak throughput (ops/s); total disk growth (bytes);
    hardware fingerprint (uname, CPU, memory).

The percentile + throughput math is pure (no network / no subprocess)
so the unit test can exercise it against synthetic series.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import platform
import shutil
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
from typing import Dict, Iterable, List, Mapping, Optional, Sequence


# ---------------------------------------------------- pure helpers

def percentile(values: Sequence[float], p: float) -> Optional[float]:
    """Linear interpolation percentile; returns None on empty input.
    `p` is 0..100."""
    n = len(values)
    if n == 0:
        return None
    if n == 1:
        return float(values[0])
    xs = sorted(values)
    if p <= 0:
        return float(xs[0])
    if p >= 100:
        return float(xs[-1])
    rank = (p / 100.0) * (n - 1)
    lo = int(math.floor(rank))
    hi = int(math.ceil(rank))
    if lo == hi:
        return float(xs[lo])
    frac = rank - lo
    return float(xs[lo] + (xs[hi] - xs[lo]) * frac)


def throughput_series(samples: Sequence[Mapping]) -> List[Optional[float]]:
    """Per-interval ops/second derived from CENTRAL_ACCEPTED counter deltas.

    `samples[i]` must carry 'atSeconds' and 'metrics.centralAccepted'
    (both optional — missing produces None at that index)."""
    out: List[Optional[float]] = []
    prev_ca: Optional[int] = None
    prev_t: Optional[float] = None
    for s in samples:
        ca = s.get("metrics", {}).get("centralAccepted") if s.get("metrics") else None
        t = s.get("atSeconds")
        if ca is None or t is None or prev_ca is None or prev_t is None:
            out.append(None)
        else:
            dt = t - prev_t
            if dt <= 0:
                out.append(None)
            else:
                # Guard: a restart or counter reset can produce a
                # negative delta — treat as missing rather than
                # reporting negative throughput.
                delta = ca - prev_ca
                out.append(max(0.0, delta / dt))
        if ca is not None and t is not None:
            prev_ca = ca
            prev_t = t
    return out


def summarize(samples: Sequence[Mapping]) -> Dict[str, object]:
    """NFR-18 summary: p50/p95/p99 for every scalar + throughput +
    disk-growth. Pure function; safe to call with an empty series."""
    cpu = [float(s["process"]["cpuPct"]) for s in samples
                if s.get("process") and s["process"].get("cpuPct") is not None]
    rss = [float(s["process"]["rssMb"]) for s in samples
                if s.get("process") and s["process"].get("rssMb") is not None]
    lat = [float(s["latencyMs"]) for s in samples
                if s.get("latencyMs") is not None]
    disk = [int(s["dataBytes"]) for s in samples
                 if s.get("dataBytes") is not None]
    tps_series = throughput_series(samples)
    tps = [float(x) for x in tps_series if x is not None]
    disk_growth = (disk[-1] - disk[0]) if len(disk) >= 2 else None
    return {
        "cpuPct":     {"p50": percentile(cpu, 50),
                         "p95": percentile(cpu, 95),
                         "p99": percentile(cpu, 99),
                         "samples": len(cpu)},
        "rssMb":      {"p50": percentile(rss, 50),
                         "p95": percentile(rss, 95),
                         "p99": percentile(rss, 99),
                         "samples": len(rss)},
        "latencyMs":  {"p50": percentile(lat, 50),
                         "p95": percentile(lat, 95),
                         "p99": percentile(lat, 99),
                         "samples": len(lat)},
        "throughputOps": {"meanPerSecond": (sum(tps) / len(tps)) if tps else None,
                            "peakPerSecond": max(tps) if tps else None,
                            "samples": len(tps)},
        "diskGrowthBytes": disk_growth,
    }


# ------------------------------------------------- shell + proc probes

def _run(cmd: List[str], timeout: float = 10.0) -> Optional[str]:
    try:
        out = subprocess.check_output(cmd, timeout=timeout,
                                        stderr=subprocess.DEVNULL)
        return out.decode("utf-8", errors="replace").strip()
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired,
            FileNotFoundError):
        return None


def hardware_fingerprint() -> Dict:
    fp: Dict = {
        "uname": " ".join(platform.uname()),
        "python": platform.python_version(),
        "cpuCount": os.cpu_count(),
    }
    if shutil.which("lscpu"):
        fp["lscpu"] = _run(["lscpu"])
    elif shutil.which("sysctl"):
        fp["sysctl"] = _run(["sysctl", "-n", "machdep.cpu.brand_string"])
    if os.path.exists("/proc/meminfo"):
        try:
            with open("/proc/meminfo", "r", encoding="utf-8") as fh:
                fp["meminfo"] = "".join(fh.readlines()[:4])
        except OSError:
            pass
    elif shutil.which("vm_stat"):
        fp["vm_stat"] = _run(["vm_stat"])
    return fp


def sample_process(pid: int) -> Optional[Dict]:
    if pid <= 0:
        return None
    out = _run(["ps", "-o", "rss=,%cpu=", "-p", str(pid)])
    if not out:
        return None
    parts = out.split()
    if len(parts) < 2:
        return None
    try:
        rss_kb = int(parts[0])
        cpu_pct = float(parts[1])
    except ValueError:
        return None
    return {"rssMb": round(rss_kb / 1024.0, 2), "cpuPct": cpu_pct}


def sample_data_dir(data_dir: str) -> Optional[int]:
    if not data_dir or not os.path.isdir(data_dir):
        return None
    out = _run(["du", "-sk", data_dir])
    if not out:
        return None
    try:
        return int(out.split()[0]) * 1024
    except (ValueError, IndexError):
        return None


# ---------------------------------------------- latency + metrics probes

def probe_latency(base_url: str, insecure: bool = False,
                    timeout: float = 5.0) -> Optional[float]:
    """Returns round-trip ms for GET /edge-api/v1/system/health, or
    None on failure."""
    if not base_url:
        return None
    url = base_url.rstrip("/") + "/edge-api/v1/system/health"
    ctx = ssl._create_unverified_context() if insecure else None
    started = time.monotonic()
    try:
        with urllib.request.urlopen(url, timeout=timeout, context=ctx) as resp:
            resp.read()
        return round((time.monotonic() - started) * 1000.0, 2)
    except (urllib.error.URLError, urllib.error.HTTPError, OSError):
        return None


def probe_metrics(base_url: str, cookie: str, insecure: bool = False,
                    timeout: float = 5.0) -> Optional[Dict]:
    """Reads GET /admin/metrics. Returns the normalised slice we care
    about (cumulative CENTRAL_ACCEPTED, heapUsed, threadCount) or
    None on failure."""
    if not base_url or not cookie:
        return None
    url = base_url.rstrip("/") + "/edge-api/v1/admin/metrics"
    req = urllib.request.Request(url)
    req.add_header("Cookie", cookie)
    ctx = ssl._create_unverified_context() if insecure else None
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            body = json.loads(resp.read() or b"{}")
    except (urllib.error.URLError, urllib.error.HTTPError, OSError, ValueError):
        return None
    journal = body.get("journal", {}) or {}
    process = body.get("process", {}) or {}
    return {
        "centralAccepted": journal.get("CENTRAL_ACCEPTED"),
        "queueDepth": body.get("queueDepth"),
        "heapUsedMb": process.get("heapUsedMb"),
        "threadCount": process.get("threadCount"),
    }


# ------------------------------------------------------------- main

def main(argv: Optional[Iterable[str]] = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--pid", type=int, default=0)
    p.add_argument("--data-dir", default="")
    p.add_argument("--base-url", default="",
                   help="DER base URL for latency + metrics probes; "
                        "empty disables both")
    p.add_argument("--cookie", default="",
                   help="session cookie for /admin/metrics; empty skips "
                        "throughput sampling")
    p.add_argument("--insecure", action="store_true")
    p.add_argument("--duration-seconds", type=float, default=60.0)
    p.add_argument("--interval-seconds", type=float, default=5.0)
    p.add_argument("--out", default="-", help="JSON output path; - = stdout")
    args = p.parse_args(list(argv) if argv is not None else None)

    series: List[Dict] = []
    started = time.monotonic()
    while time.monotonic() - started < args.duration_seconds:
        sample: Dict = {
            "atSeconds": round(time.monotonic() - started, 2),
            "process": sample_process(args.pid),
            "dataBytes": sample_data_dir(args.data_dir),
            "latencyMs": probe_latency(args.base_url, args.insecure),
            "metrics": probe_metrics(args.base_url, args.cookie, args.insecure),
        }
        series.append(sample)
        time.sleep(args.interval_seconds)

    report = {
        "hardware": hardware_fingerprint(),
        "pid": args.pid,
        "dataDir": args.data_dir,
        "baseUrl": args.base_url,
        "intervalSeconds": args.interval_seconds,
        "durationSeconds": args.duration_seconds,
        "series": series,
        "summary": summarize(series),
    }
    text = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.out == "-":
        sys.stdout.write(text)
    else:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
