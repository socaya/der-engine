#!/usr/bin/env python3
"""NFR-17 backlog recovery harness.

Measures how long the journal worker takes to drain a backlog of
N operations after central reachability is restored. Workflow:

    1. Pause the journal worker.
    2. POST N aggregate / tracker writes to DER, filling the journal.
    3. Record the backlog depth from GET /journal/worker.
    4. Resume the worker and poll the backlog until it reaches zero.
    5. Emit duration + unresolved count.

Writes a JSON report to stdout.
"""
from __future__ import annotations

import argparse
import json
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Dict, Iterable, List, Optional


def _request(base: str, path: str, method: str = "GET",
              body: Optional[bytes] = None, cookie: Optional[str] = None,
              insecure: bool = False, timeout: float = 10.0) -> Dict:
    req = urllib.request.Request(base.rstrip("/") + path, data=body, method=method)
    if cookie:
        req.add_header("Cookie", cookie)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    ctx = ssl._create_unverified_context() if insecure else None
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        raw = resp.read()
        return {
            "status": resp.status,
            "body": json.loads(raw) if raw else {},
        }


def _backlog(base: str, cookie: str, insecure: bool) -> int:
    resp = _request(base, "/edge-api/v1/journal/worker", cookie=cookie,
                     insecure=insecure)
    pending = int(resp["body"].get("pending", 0))
    retryable = int(resp["body"].get("retryable", 0))
    return pending + retryable


def seed_backlog(base: str, cookie: str, insecure: bool,
                   count: int, payload: Dict) -> List[Dict]:
    """Pushes `count` identical aggregate writes into the journal."""
    body = json.dumps(payload).encode("utf-8")
    results: List[Dict] = []
    for i in range(count):
        try:
            results.append(_request(base, "/api/dataValueSets", method="POST",
                                       body=body, cookie=cookie,
                                       insecure=insecure))
        except urllib.error.HTTPError as exc:
            results.append({"status": exc.code,
                             "body": {"error": str(exc)}})
    return results


def wait_drain(base: str, cookie: str, insecure: bool,
                 timeout_seconds: float, poll_seconds: float) -> Dict:
    started = time.monotonic()
    last = -1
    samples = []
    while time.monotonic() - started < timeout_seconds:
        depth = _backlog(base, cookie, insecure)
        samples.append({
            "atSeconds": round(time.monotonic() - started, 2),
            "backlog": depth,
        })
        if depth == 0:
            return {
                "drainedSeconds": round(time.monotonic() - started, 3),
                "samples": samples,
                "unresolved": 0,
                "timedOut": False,
            }
        if depth != last:
            last = depth
        time.sleep(poll_seconds)
    final = _backlog(base, cookie, insecure)
    return {
        "drainedSeconds": None,
        "samples": samples,
        "unresolved": final,
        "timedOut": True,
    }


def _pause_resume(base: str, cookie: str, insecure: bool, action: str) -> None:
    _request(base, f"/edge-api/v1/journal/worker/{action}", method="POST",
              cookie=cookie, insecure=insecure)


def main(argv: Optional[Iterable[str]] = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--base-url", required=True)
    p.add_argument("--cookie", required=True,
                   help="Session cookie for an ADMIN user")
    p.add_argument("--insecure", action="store_true")
    p.add_argument("--count", type=int, default=100,
                   help="Backlog size (NFR-17 fixtures: 100 and 1000)")
    p.add_argument("--payload-file", required=True,
                   help="JSON file: aggregate dataValueSet to replay N times")
    p.add_argument("--drain-timeout-seconds", type=float, default=600.0)
    p.add_argument("--poll-seconds", type=float, default=2.0)
    args = p.parse_args(list(argv) if argv is not None else None)

    with open(args.payload_file, "r", encoding="utf-8") as fh:
        payload = json.load(fh)

    report = {
        "count": args.count,
        "payloadFile": args.payload_file,
    }

    _pause_resume(args.base_url, args.cookie, args.insecure, "pause")
    seeded = seed_backlog(args.base_url, args.cookie, args.insecure,
                            args.count, payload)
    report["seeded"] = sum(1 for s in seeded if 200 <= int(s["status"]) < 400)
    report["seedRejected"] = len(seeded) - report["seeded"]
    report["backlogAfterSeed"] = _backlog(args.base_url, args.cookie, args.insecure)

    _pause_resume(args.base_url, args.cookie, args.insecure, "resume")
    report["drain"] = wait_drain(args.base_url, args.cookie, args.insecure,
                                    args.drain_timeout_seconds, args.poll_seconds)

    json.dump(report, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0 if not report["drain"]["timedOut"] else 1


if __name__ == "__main__":
    sys.exit(main())
