#!/usr/bin/env python3
"""Phase 01 live DHIS2 compatibility probe.

Reads the central URL + credentials from the environment, walks
``docs/verification/compatibility/supported-matrix.csv``, probes every row,
and writes an immutable JSON evidence file under
``docs/evaluation/evidence/phase-01/<commit>/compatibility/<timestamp>.json``.

Environment variables (all are strings):
    DER_DHIS2_CENTRAL_URL   e.g. http://localhost:8080/dhis
    DER_DHIS2_USER          Web API username with the minimum DER scope
    DER_DHIS2_PASSWORD      corresponding password
    DER_DHIS2_PINNED_VERSION (optional) override the pin check; defaults to 2.44-SNAPSHOT.

Exit codes:
    0 — every ``der_phase=01`` row met its contract AND /api/system/info.version
        has the pinned prefix.
    1 — any Phase 01 row failed, or the version pin check failed.
    2 — DER_DHIS2_CENTRAL_URL is unset. The caller should treat this as NOT RUN
        rather than FAIL.

Later-phase rows (``der_phase != '01'``) are probed for diagnostics; a failure
there writes a WARNING but does NOT change the exit code.
"""
from __future__ import annotations

import base64
import csv
import datetime as dt
import hashlib
import json
import os
import pathlib
import socket
import ssl
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
MATRIX = ROOT / "docs" / "verification" / "compatibility" / "supported-matrix.csv"


def commit_sha() -> str:
    git_dir = ROOT / ".git"
    head = git_dir / "HEAD"
    if not head.is_file():
        return "unknown"
    try:
        ref_line = head.read_text(encoding="utf-8").strip()
        if ref_line.startswith("ref: "):
            ref_path = git_dir / ref_line[5:]
            if ref_path.is_file():
                return ref_path.read_text(encoding="utf-8").strip()[:7]
        if len(ref_line) >= 7 and all(c in "0123456789abcdef" for c in ref_line.lower()):
            return ref_line[:7]
    except OSError:
        pass
    return "unknown"


def basic_auth(user: str, password: str) -> str:
    token = f"{user}:{password}".encode("utf-8")
    return "Basic " + base64.b64encode(token).decode("ascii")


def probe(base_url: str, path: str, method: str, auth: str | None, timeout: float) -> dict:
    url = base_url.rstrip("/") + path
    req = urllib.request.Request(url, method=method)
    req.add_header("Accept", "application/json")
    if auth:
        req.add_header("Authorization", auth)
    started = dt.datetime.now(dt.timezone.utc)
    status: int | None = None
    body_bytes = b""
    error: str | None = None
    try:
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            status = resp.status
            body_bytes = resp.read(8192)
    except urllib.error.HTTPError as ex:
        status = ex.code
        try:
            body_bytes = ex.read(8192)
        except Exception:
            body_bytes = b""
    except urllib.error.URLError as ex:
        error = f"URLError: {ex.reason}"
    except (socket.timeout, TimeoutError) as ex:
        error = f"Timeout: {ex}"
    except ssl.SSLError as ex:
        error = f"SSLError: {ex}"
    except Exception as ex:  # pragma: no cover - defensive
        error = f"{type(ex).__name__}: {ex}"
    finished = dt.datetime.now(dt.timezone.utc)
    body_sha = hashlib.sha256(body_bytes).hexdigest() if body_bytes else None
    return {
        "url": url,
        "method": method,
        "status": status,
        "body_sha256": body_sha,
        "body_bytes": len(body_bytes),
        "error": error,
        "started": started.isoformat(timespec="milliseconds"),
        "finished": finished.isoformat(timespec="milliseconds"),
        "elapsed_ms": int((finished - started).total_seconds() * 1000),
    }


def meets_contract(result: dict, min_status: int, max_status: int) -> bool:
    if result["error"] is not None:
        return False
    s = result["status"]
    return s is not None and min_status <= s <= max_status


def extract_version(result: dict) -> str | None:
    # Only valid when probe was successful and body is small-JSON.
    if result["error"] is not None or result["body_bytes"] == 0:
        return None
    url = result["url"]
    try:
        req = urllib.request.Request(url)
        req.add_header("Accept", "application/json")
        # Re-fetch body if sha-based probe above read only 8kB; version is near
        # the top of /api/system/info so we re-probe fully (small payload).
        if result.get("_auth"):
            req.add_header("Authorization", result["_auth"])
        with urllib.request.urlopen(req, timeout=10) as resp:
            payload = json.load(resp)
        v = payload.get("version")
        return v if isinstance(v, str) else None
    except Exception:
        return None


def main() -> int:
    base_url = os.environ.get("DER_DHIS2_CENTRAL_URL", "").strip()
    if not base_url:
        print("NOT RUN: DER_DHIS2_CENTRAL_URL is not set.", file=sys.stderr)
        return 2
    user = os.environ.get("DER_DHIS2_USER", "")
    password = os.environ.get("DER_DHIS2_PASSWORD", "")
    pinned = os.environ.get("DER_DHIS2_PINNED_VERSION", "2.44-SNAPSHOT")
    timeout = float(os.environ.get("DER_DHIS2_TIMEOUT", "10"))

    auth = basic_auth(user, password) if user else None

    if not MATRIX.is_file():
        print(f"FAIL: compatibility matrix missing at {MATRIX}", file=sys.stderr)
        return 1
    with MATRIX.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))

    results = []
    phase01_fail = 0
    other_fail = 0

    for row in rows:
        requires_auth = row["requires_auth"].strip().lower() == "true"
        used_auth = auth if requires_auth else None
        result = probe(base_url, row["path"], row["method"], used_auth, timeout)
        if used_auth:
            result["_auth"] = used_auth  # internal, popped before writing
        min_status = int(row["expected_min_status"])
        max_status = int(row["expected_max_status"])
        passed = meets_contract(result, min_status, max_status)
        is_phase_01 = row["der_phase"].strip() == "01"
        result_record = {
            "route_id": row["route_id"],
            "der_phase": row["der_phase"],
            "expected_status_range": [min_status, max_status],
            "requires_auth": requires_auth,
            "passed": passed,
            **{k: v for k, v in result.items() if not k.startswith("_")},
        }
        results.append(result_record)
        marker = "PASS" if passed else ("FAIL" if is_phase_01 else "WARN")
        print(f"  [{marker}] {row['route_id']:14s} {row['method']} {row['path']:60s} "
              f"-> status={result['status']} error={result['error']} ({result['elapsed_ms']}ms)")
        if not passed:
            if is_phase_01:
                phase01_fail += 1
            else:
                other_fail += 1

    # Pin check against /api/system/info.version.
    info_row = next((r for r in results if r["route_id"] == "INFO"), None)
    pin_matches: bool | None = None
    observed_version: str | None = None
    if info_row is not None and info_row["passed"]:
        req = urllib.request.Request(info_row["url"])
        req.add_header("Accept", "application/json")
        if auth:
            req.add_header("Authorization", auth)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                payload = json.load(resp)
            observed_version = payload.get("version") if isinstance(payload.get("version"), str) else None
        except Exception as ex:
            observed_version = None
            print(f"  [WARN] version re-fetch failed: {ex}")
        if observed_version is None:
            pin_matches = False
        else:
            pin_matches = observed_version.startswith(pinned)
            print(f"  [{'PASS' if pin_matches else 'FAIL'}] pinned-version   expected prefix='{pinned}' observed='{observed_version}'")
    else:
        pin_matches = False
        print(f"  [FAIL] pinned-version   /api/system/info did not meet its contract")

    now = dt.datetime.now(dt.timezone.utc)
    out_dir = ROOT / "docs" / "evaluation" / "evidence" / "phase-01" / commit_sha() / "compatibility"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"{now.strftime('%Y%m%dT%H%M%SZ')}-live-probe.json"
    envelope = {
        "generated": now.isoformat(timespec="milliseconds"),
        "commit": commit_sha(),
        "base_url": base_url,
        "pinned_version": pinned,
        "observed_version": observed_version,
        "pin_matches": pin_matches,
        "phase01_failures": phase01_fail,
        "non_phase01_failures": other_fail,
        "results": results,
    }
    with out_file.open("w", encoding="utf-8") as fh:
        json.dump(envelope, fh, indent=2, sort_keys=True)
    print(f"\nEvidence: {out_file.relative_to(ROOT)}")

    if phase01_fail > 0 or pin_matches is not True:
        print(f"FAIL: {phase01_fail} Phase 01 contract(s) failed; pin match = {pin_matches}", file=sys.stderr)
        return 1
    if other_fail > 0:
        print(f"NOTE: {other_fail} non-Phase-01 contract(s) failed — recorded for later phases.")
    print(f"PASS: all Phase 01 contracts met; observed DHIS2 version = {observed_version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
