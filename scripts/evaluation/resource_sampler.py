#!/usr/bin/env python3
"""NFR-18 (resource budget) + NFR-35 (deployment transparency) sampler.

Samples RSS (MB), CPU% and data-directory size on a configurable interval,
plus a one-shot hardware fingerprint (uname, lscpu or sysctl, meminfo).

The sampler is portable across Linux and macOS; it falls back to
`ps -o rss=,%cpu=` which both support. Data directory growth is a
simple `du -sb` on the --data-dir path.

Writes a JSON time-series to stdout.
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import time
from typing import Dict, Iterable, List, Optional


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
    return {
        "rssMb": round(rss_kb / 1024.0, 2),
        "cpuPct": cpu_pct,
    }


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


def main(argv: Optional[Iterable[str]] = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--pid", type=int, default=0,
                   help="DER JVM pid; 0 to skip process sampling")
    p.add_argument("--data-dir", default="",
                   help="Postgres data dir or $DER_HOME; empty to skip disk sample")
    p.add_argument("--duration-seconds", type=float, default=60.0)
    p.add_argument("--interval-seconds", type=float, default=5.0)
    args = p.parse_args(list(argv) if argv is not None else None)

    series: List[Dict] = []
    started = time.monotonic()
    while time.monotonic() - started < args.duration_seconds:
        sample: Dict = {
            "atSeconds": round(time.monotonic() - started, 2),
            "process": sample_process(args.pid),
            "dataBytes": sample_data_dir(args.data_dir),
        }
        series.append(sample)
        time.sleep(args.interval_seconds)

    report = {
        "hardware": hardware_fingerprint(),
        "pid": args.pid,
        "dataDir": args.data_dir,
        "intervalSeconds": args.interval_seconds,
        "durationSeconds": args.duration_seconds,
        "series": series,
    }
    json.dump(report, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
