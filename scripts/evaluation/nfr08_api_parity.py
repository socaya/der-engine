#!/usr/bin/env python3
"""
NFR-08 — API-parity probe.

"For declared deterministic equivalent operations, edge and
reference responses/record effects match defined oracles."

Reads every oracle under `scripts/evaluation/fixtures/oracles/`,
probes DER with the same request shape, and asserts DER's response
carries at least the oracle's required-key set with type-compatible
values. The oracles are shape contracts (not byte-identical
snapshots) — DER is free to return extra fields, but it must not
omit a canonical one or return it under a different type.

Python stdlib only — ADR-0013.

Usage:

  export DER_URL=http://localhost:8085
  export DER_BOOTSTRAP_ADMIN_USERNAME=der-admin
  export DER_BOOTSTRAP_ADMIN_PASSWORD=...

  python3 scripts/evaluation/nfr08_api_parity.py \\
    --out docs/evaluation/evidence/<phase>/<commit>/nfr-08.json

  # Override the paths that take a {uid} placeholder:
  python3 scripts/evaluation/nfr08_api_parity.py \\
    --out out.json \\
    --program-uid ueBhWkWll5v --org-unit-uid HL2zXaIULBe

Exit codes:
  0  — every oracle's shape invariants hold against DER
  1  — one or more violations (missing key, wrong type,
       pager envelope absent, …)
  2  — environment misconfiguration (bad --out, auth failed, …)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path
from typing import Any


ORACLES_DIR = (Path(__file__).resolve().parent
               / "fixtures" / "oracles")


def mint_cookie_jar(base: str, username: str, password: str) -> CookieJar:
    jar = CookieJar()
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar))
    data = json.dumps({"username": username,
                         "password": password}).encode()
    req = urllib.request.Request(
        base + "/edge-api/v1/auth/sign-in",
        data=data, method="POST",
        headers={"Content-Type": "application/json"})
    try:
        with opener.open(req, timeout=30) as r:
            r.read()
    except urllib.error.HTTPError as e:
        raise SystemExit(f"error: sign-in as {username!r} returned "
                         f"HTTP {e.code}.")
    return jar


def probe(base: str, path: str, jar: CookieJar) -> tuple[int, Any]:
    url = base + path
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar))
    req = urllib.request.Request(url,
            headers={"Accept": "application/json"})
    try:
        with opener.open(req, timeout=30) as r:
            raw = r.read()
            return r.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, None


def json_type(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__


def check_shape(body: Any, shape: dict) -> list[str]:
    """Return a list of per-oracle violations; empty = all pass."""
    violations: list[str] = []
    if not isinstance(body, dict):
        return [f"expected object, got {json_type(body)}"]
    for k in shape.get("requiredKeys", []):
        if k not in body:
            violations.append(f"missing required key: {k!r}")
    for k, element_keys in shape.get("requiredArrayKeys", {}).items():
        val = body.get(k)
        if not isinstance(val, list):
            violations.append(
                f"{k!r} expected array, got {json_type(val)}")
            continue
        for i, elem in enumerate(val):
            if not isinstance(elem, dict):
                violations.append(
                    f"{k!r}[{i}] expected object, got {json_type(elem)}")
                continue
            for ek in element_keys:
                if ek not in elem:
                    violations.append(
                        f"{k!r}[{i}] missing required key: {ek!r}")
                    break  # one hit per element is enough
    for k, inner_keys in shape.get("requiredObjectKeys", {}).items():
        val = body.get(k)
        if not isinstance(val, dict):
            violations.append(
                f"{k!r} expected object, got {json_type(val)}")
            continue
        for ik in inner_keys:
            if ik not in val:
                violations.append(f"{k!r}.{ik!r} missing")
    for k, expected_type in shape.get("typedKeys", {}).items():
        if k not in body:
            continue  # requiredKeys handles absence
        got_type = json_type(body[k])
        if got_type != expected_type:
            violations.append(
                f"{k!r}: expected {expected_type}, got {got_type}")
    return violations


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(prog="nfr08-api-parity")
    p.add_argument("--base-url",
                   default=os.environ.get("DER_URL",
                                            "http://localhost:8085"))
    p.add_argument("--admin-user",
                   default=os.environ.get("DER_ADMIN_USER")
                   or os.environ.get("DER_BOOTSTRAP_ADMIN_USERNAME"))
    p.add_argument("--admin-password",
                   default=os.environ.get("DER_ADMIN_PASSWORD")
                   or os.environ.get("DER_BOOTSTRAP_ADMIN_PASSWORD"))
    p.add_argument("--program-uid", default="ueBhWkWll5v",
                   help="UID to substitute into oracles whose endpoint "
                        "carries a {uid} placeholder.")
    p.add_argument("--org-unit-uid", default="HL2zXaIULBe",
                   help="Org-unit UID for descendants oracle.")
    p.add_argument("--out", required=True,
                   help="Path to write the evidence JSON bundle.")
    args = p.parse_args(argv)

    if not args.admin_user or not args.admin_password:
        print("error: --admin-user and --admin-password required "
              "(or DER_ADMIN_USER/_PASSWORD, or DER_BOOTSTRAP_ADMIN_USERNAME/"
              "PASSWORD).", file=sys.stderr)
        return 2

    if not ORACLES_DIR.is_dir():
        print(f"error: oracle corpus missing at {ORACLES_DIR}", file=sys.stderr)
        return 2

    base = args.base_url.rstrip("/")
    print(f"[nfr08] probing {base} against "
          f"{sum(1 for _ in ORACLES_DIR.glob('*.json'))} oracle(s)")
    jar = mint_cookie_jar(base, args.admin_user, args.admin_password)

    rows_out: list[dict] = []
    total_violations = 0
    for oracle_path in sorted(ORACLES_DIR.glob("*.json")):
        try:
            oracle = json.loads(oracle_path.read_text())
        except json.JSONDecodeError as e:
            print(f"error: {oracle_path} is not valid JSON: {e}",
                  file=sys.stderr)
            return 2
        endpoint = oracle["endpoint"]
        # Substitute placeholders. The convention: {uid} on a
        # /programs/{uid} oracle takes --program-uid; on a
        # /organisationUnits/{uid} oracle takes --org-unit-uid.
        probed_path = endpoint
        if "{uid}" in probed_path:
            if "organisationUnits" in probed_path:
                probed_path = probed_path.replace("{uid}", args.org_unit_uid)
            else:
                probed_path = probed_path.replace("{uid}", args.program_uid)
        status, body = probe(base, probed_path, jar)
        if status != 200:
            rows_out.append({
                "oracle": oracle_path.name,
                "endpoint": endpoint,
                "probedPath": probed_path,
                "status": status,
                "violations": [f"HTTP {status}, expected 200"],
                "ok": False,
            })
            total_violations += 1
            continue
        shape_violations = check_shape(body, oracle.get("shape", {}))
        rows_out.append({
            "oracle": oracle_path.name,
            "endpoint": endpoint,
            "probedPath": probed_path,
            "status": status,
            "violations": shape_violations,
            "ok": len(shape_violations) == 0,
        })
        total_violations += len(shape_violations)

    out_path = Path(args.out).expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "nfr": "NFR-08",
        "baseUrl": base,
        "rows": rows_out,
        "summary": {
            "oracles": len(rows_out),
            "passed": sum(1 for r in rows_out if r["ok"]),
            "violations": total_violations,
        },
    }
    out_path.write_text(json.dumps(out, indent=2, sort_keys=True))
    print(f"[nfr08] evidence -> {out_path}")
    print(f"[nfr08] oracles={out['summary']['oracles']} "
          f"passed={out['summary']['passed']} "
          f"violations={out['summary']['violations']}")

    if total_violations:
        print("[nfr08] FAIL -- shape violations:", file=sys.stderr)
        for r in rows_out:
            for v in r["violations"]:
                print(f"  - {r['oracle']} ({r['probedPath']}): {v}",
                      file=sys.stderr)
        return 1
    print("[nfr08] PASS -- every oracle's shape invariants hold")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
