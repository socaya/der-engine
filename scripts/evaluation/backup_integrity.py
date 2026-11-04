#!/usr/bin/env python3
"""NFR-29 — Verified-restoration evidence harness.

Runs a full round-trip against a live DER edge and emits the
reviewer-facing evidence artefact that NFR-29 demands:

  1. Snapshot the journal-state distribution + system fingerprint.
  2. Trigger a FULL (or AUDIT) backup; wait for SUCCESS.
  3. Trigger a restore from the resulting archive; wait for SUCCESS.
  4. Snapshot the post-restore state.
  5. Compare committed records AND their pending/accepted
     reconciliation history. The spec requires that **every**
     journal-state count matches — not just the grand total.

The report is written to --evidence-out (default: stdout) as JSON, and
if --summary-out is supplied a compact Markdown summary is also
produced so the reviewer can skim it.

Exit codes:
    0 — backup + restore + fingerprint match
    1 — anything failed or the fingerprint diverged
    2 — invalid CLI invocation

The pure comparison logic lives in `compare_fingerprint()` so the
unit test can exercise it without a live DER.
"""
from __future__ import annotations

import argparse
import json
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Dict, Iterable, Mapping, Optional


JOURNAL_STATES = (
    "PENDING",
    "IN_FLIGHT",
    "RETRYABLE",
    "CENTRAL_ACCEPTED",
    "CENTRAL_REJECTED",
    "CONFLICT_REVIEW",
    "QUARANTINED",
    "UNKNOWN_OUTCOME",
    "REQUIRES_APPROVAL",
)


# ---------------------------------------------------------------- HTTP

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


# --------------------------------------------------------- Fingerprint

def fingerprint(health: Mapping, journal_by_state: Mapping[str, int]
                   ) -> Dict[str, object]:
    """Builds the comparable fingerprint from two DER probes.

    - `health` is the parsed /edge-api/v1/system/health body.
    - `journal_by_state` is the parsed byState map from the operational
      report (/edge-api/v1/admin/ops/reports/operational).

    Returns a dict with:
      - 'counts' — every int (and nested int) from health
      - 'byState' — one entry per canonical journal state (missing
        states default to 0 so the comparison is total)
    """
    counts: Dict[str, int] = {}
    for key, value in health.items():
        if isinstance(value, int):
            counts[key] = value
        elif isinstance(value, dict):
            for nested_key, nested_value in value.items():
                if isinstance(nested_value, int):
                    counts[f"{key}.{nested_key}"] = nested_value
    by_state = {s: int(journal_by_state.get(s, 0)) for s in JOURNAL_STATES}
    return {"counts": counts, "byState": by_state}


def compare_fingerprint(before: Mapping, after: Mapping
                            ) -> Dict[str, object]:
    """NFR-29 core comparator.

    Returns a dict with:
      - 'match' (bool) — True iff every state count AND every health
        counter matches
      - 'byStateDiff' — per-state delta (after - before) for every
        journal state that changed
      - 'countsDiff' — per-counter delta for health counters that changed
      - 'missing' — states that disappeared between snapshots
    """
    by_state_diff: Dict[str, int] = {}
    for state in JOURNAL_STATES:
        before_n = int(before.get("byState", {}).get(state, 0))
        after_n = int(after.get("byState", {}).get(state, 0))
        if before_n != after_n:
            by_state_diff[state] = after_n - before_n
    counts_diff: Dict[str, int] = {}
    all_counter_keys = (set(before.get("counts", {}).keys())
                           | set(after.get("counts", {}).keys()))
    missing = []
    for key in all_counter_keys:
        before_v = before.get("counts", {}).get(key)
        after_v = after.get("counts", {}).get(key)
        if before_v is None:
            counts_diff[key] = after_v if isinstance(after_v, int) else 0
        elif after_v is None:
            missing.append(key)
        elif before_v != after_v:
            counts_diff[key] = after_v - before_v
    match = (not by_state_diff) and (not counts_diff) and (not missing)
    return {
        "match": match,
        "byStateDiff": by_state_diff,
        "countsDiff": counts_diff,
        "missing": missing,
    }


# ------------------------------------------------------ Markdown summary

def markdown_summary(report: Mapping) -> str:
    lines = [
        f"# NFR-29 evidence — {report.get('kind', '?')} backup round-trip",
        "",
        f"* **Generated:** {report.get('generatedAt', '?')}",
        f"* **Backup run id:** {report.get('backupRunId', '—')}",
        f"* **Restore run id:** {report.get('restoreRunId', '—')}",
        f"* **Match:** **{'YES' if report.get('match') else 'NO'}**",
        "",
    ]
    diff = report.get("fingerprintDiff", {})
    if diff.get("byStateDiff"):
        lines.append("## Journal-state drift")
        lines.append("| State | Δ (after − before) |")
        lines.append("|---|---:|")
        for state, delta in sorted(diff["byStateDiff"].items()):
            lines.append(f"| {state} | {delta:+d} |")
        lines.append("")
    if diff.get("countsDiff"):
        lines.append("## Other-counter drift")
        lines.append("| Counter | Δ |")
        lines.append("|---|---:|")
        for key, delta in sorted(diff["countsDiff"].items()):
            lines.append(f"| {key} | {delta:+d} |")
        lines.append("")
    if diff.get("missing"):
        lines.append("## Missing counters post-restore")
        for key in diff["missing"]:
            lines.append(f"* {key}")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------- Main

def _snapshot(base: str, cookie: str, insecure: bool) -> Dict[str, object]:
    health = _call(base, "/edge-api/v1/system/health",
                    cookie=cookie, insecure=insecure, timeout=10.0)["body"]
    ops = _call(base, "/edge-api/v1/admin/ops/reports/operational",
                  cookie=cookie, insecure=insecure, timeout=10.0)["body"]
    return fingerprint(health, ops.get("byState", {}))


def main(argv: Optional[Iterable[str]] = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--base-url", required=True)
    p.add_argument("--cookie", required=True)
    p.add_argument("--insecure", action="store_true")
    p.add_argument("--kind", default="FULL", choices=["AUDIT", "FULL"])
    p.add_argument("--backup-timeout-seconds", type=float, default=600.0)
    p.add_argument("--restore-timeout-seconds", type=float, default=600.0)
    p.add_argument("--poll-seconds", type=float, default=3.0)
    p.add_argument("--evidence-out", default="-",
                    help="path to write JSON evidence; '-' = stdout")
    p.add_argument("--summary-out",
                    help="optional path to write a Markdown summary")
    args = p.parse_args(list(argv) if argv is not None else None)

    report: Dict[str, object] = {
        "kind": args.kind,
        "generatedAt": datetime.now(timezone.utc).isoformat()
                             .replace("+00:00", "Z"),
    }

    report["fingerprint.before"] = _snapshot(args.base_url, args.cookie,
                                                args.insecure)

    create = _call(args.base_url, "/edge-api/v1/backup/request",
                    args.cookie, args.insecure, method="POST",
                    body=json.dumps({"kind": args.kind}).encode("utf-8"))
    run_id = create["body"].get("runId")
    report["backupRunId"] = run_id

    backup = _poll_until(args.base_url,
                           f"/edge-api/v1/backup/runs/{run_id}",
                           args.cookie, args.insecure,
                           expected="SUCCESS",
                           timeout_seconds=args.backup_timeout_seconds,
                           poll_seconds=args.poll_seconds)
    report["backup"] = backup["body"]
    if backup["body"].get("status") != "SUCCESS":
        report["match"] = False
        return _emit(args, report)

    archive_path = backup["body"].get("archivePath")
    if not archive_path:
        report["error"] = "backup SUCCESS without archivePath"
        report["match"] = False
        return _emit(args, report)

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
        report["match"] = False
        return _emit(args, report)

    report["fingerprint.after"] = _snapshot(args.base_url, args.cookie,
                                               args.insecure)
    diff = compare_fingerprint(
        report["fingerprint.before"], report["fingerprint.after"])
    report["fingerprintDiff"] = diff
    report["match"] = diff["match"]

    return _emit(args, report)


def _emit(args, report: Dict) -> int:
    """Writes the evidence + optional summary, returns the exit code."""
    text = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.evidence_out == "-":
        sys.stdout.write(text)
    else:
        with open(args.evidence_out, "w", encoding="utf-8") as f:
            f.write(text)
    if args.summary_out:
        with open(args.summary_out, "w", encoding="utf-8") as f:
            f.write(markdown_summary(report))
    return 0 if report.get("match") else 1


if __name__ == "__main__":
    sys.exit(main())
