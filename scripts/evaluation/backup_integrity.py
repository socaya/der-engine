#!/usr/bin/env python3
"""NFR-29 backup integrity harness.

Verifies a full round-trip: snapshot row counts, trigger a DER backup,
wait for SUCCESS, trigger a restore from the resulting archive, wait for
SUCCESS, then compare row counts and the operation-journal depth.

Writes a JSON report to stdout. Non-zero exit means integrity failed.
"""
from __future__ import annotations

import argparse
import json
import ssl
import sys
import time
import urllib.error
import urllib.request
from typing import Dict, Iterable, Optional


def _call(base: str, path: str, cookie: str, insecure: bool,
           method: str = "GET", body: Optional[bytes] = None,
           timeout: float = 30.0) -> Dict:
    req = urllib.request.Request(base.rstrip("/") + path, data=body,
                                    method=method)
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


def _poll_until(base: str, path: str, cookie: str, insecure: bool,
                  expected: str, timeout_seconds: float,
                  poll_seconds: float) -> Dict:
    deadline = time.monotonic() + timeout_seconds
    last: Dict = {}
    while time.monotonic() < deadline:
        last = _call(base, path, cookie, insecure)
        status = str(last["body"].get("status", ""))
        if status == expected or status == "FAILED":
            return last
        time.sleep(poll_seconds)
    return {**last, "timedOut": True}


def row_counts(base: str, cookie: str, insecure: bool) -> Dict[str, int]:
    """Reads counters that the DER health endpoint exposes.

    The health endpoint reports journal depth; the admin diagnostics report
    includes draft + session counts (both via /edge-api/v1/system/health
    in Phase 05+). The harness treats this as a opaque fingerprint — the
    only requirement is that the same counters match before and after.
    """
    resp = _call(base, "/edge-api/v1/system/health", cookie=cookie,
                   insecure=insecure, timeout=10.0)
    out: Dict[str, int] = {}
    for key, value in resp["body"].items():
        if isinstance(value, int):
            out[key] = value
        elif isinstance(value, dict):
            for nested_key, nested_value in value.items():
                if isinstance(nested_value, int):
                    out[f"{key}.{nested_key}"] = nested_value
    return out


def main(argv: Optional[Iterable[str]] = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--base-url", required=True)
    p.add_argument("--cookie", required=True)
    p.add_argument("--insecure", action="store_true")
    p.add_argument("--kind", default="FULL",
                   choices=["AUDIT", "FULL"])
    p.add_argument("--backup-timeout-seconds", type=float, default=600.0)
    p.add_argument("--restore-timeout-seconds", type=float, default=600.0)
    p.add_argument("--poll-seconds", type=float, default=3.0)
    args = p.parse_args(list(argv) if argv is not None else None)

    report: Dict = {"kind": args.kind}

    report["counts.before"] = row_counts(args.base_url, args.cookie,
                                           args.insecure)

    create = _call(args.base_url, "/edge-api/v1/backup/request",
                    args.cookie, args.insecure, method="POST",
                    body=json.dumps({"kind": args.kind}).encode("utf-8"))
    run_id = create["body"].get("runId")
    report["backupRunId"] = run_id

    backup = _poll_until(args.base_url, f"/edge-api/v1/backup/runs/{run_id}",
                           args.cookie, args.insecure,
                           expected="SUCCESS",
                           timeout_seconds=args.backup_timeout_seconds,
                           poll_seconds=args.poll_seconds)
    report["backup"] = backup["body"]
    if backup["body"].get("status") != "SUCCESS":
        json.dump(report, sys.stdout, indent=2, sort_keys=True)
        return 1

    archive_path = backup["body"].get("archivePath")
    if not archive_path:
        report["error"] = "backup SUCCESS without archivePath"
        json.dump(report, sys.stdout, indent=2, sort_keys=True)
        return 1

    restore_create = _call(args.base_url, "/edge-api/v1/restore/request",
                             args.cookie, args.insecure, method="POST",
                             body=json.dumps({"kind": "LOCAL",
                                                "source": archive_path}).encode("utf-8"))
    restore_id = restore_create["body"].get("runId")
    report["restoreRunId"] = restore_id

    restore = _poll_until(args.base_url,
                            f"/edge-api/v1/restore/runs/{restore_id}",
                            args.cookie, args.insecure,
                            expected="SUCCESS",
                            timeout_seconds=args.restore_timeout_seconds,
                            poll_seconds=args.poll_seconds)
    report["restore"] = restore["body"]
    if restore["body"].get("status") != "SUCCESS":
        json.dump(report, sys.stdout, indent=2, sort_keys=True)
        return 1

    report["counts.after"] = row_counts(args.base_url, args.cookie,
                                           args.insecure)
    report["match"] = report["counts.before"] == report["counts.after"]

    json.dump(report, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0 if report["match"] else 1


if __name__ == "__main__":
    sys.exit(main())
