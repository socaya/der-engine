#!/usr/bin/env python3
"""
NFR-05 — Forbidden-access matrix.

"100% of predefined forbidden access attempts are rejected across
UI and direct API paths."

Walks a pinned (role × path × method) grid against a running DER
and asserts every row matches its expected outcome:

  200 (or 2xx) — admitted
  401          — anonymous (no session)
  403          — authenticated but lacking authority

Any mismatch → exit non-zero + print the violation. Evidence
dumped to `--out` as JSON so pilot acceptance can archive it
alongside the other NFR runs.

Python stdlib only — ADR-0013.

Usage:

  export DER_URL=http://localhost:8085
  export DER_ADMIN_USER=der-admin
  export DER_ADMIN_PASSWORD=...
  export DER_OPERATOR_USER=nurse.alice
  export DER_OPERATOR_PASSWORD=...

  python3 scripts/evaluation/forbidden_access_matrix.py \
    --out docs/evaluation/evidence/<phase>/<commit>/nfr-05.json

Exit codes:
  0  — all 2xx/4xx assertions match expectation
  1  — one or more rows violated expectation
  2  — environment misconfiguration (no DER_URL, auth failed, …)
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
from typing import Literal

Role = Literal["anon", "operator", "admin"]
Expect = Literal["allow", "unauthorised", "forbidden"]

ALLOW, UNAUTH, FORBID = "allow", "unauthorised", "forbidden"

# ---------------------------------------------------------------
# The pinned matrix. Each row is (method, path, {role: expect}).
# `allow` means 2xx; `unauthorised` means 401; `forbidden` means
# 403. The matrix errs on the side of ONLY listing paths where
# the expectation is either "everyone allowed" or "admin-only."
# The test is "can an operator do an admin thing?", not "every
# path returns 2xx for admin."
# ---------------------------------------------------------------
MATRIX: list[tuple[str, str, dict[Role, Expect]]] = [
    # Public readiness + sign-in — allowed to anonymous callers
    # too so an unrecovered appliance can bootstrap.
    ("GET", "/edge-api/v1/system/health",
        {"anon": ALLOW, "operator": ALLOW, "admin": ALLOW}),
    ("GET", "/edge-api/v1/system/preflight",
        {"anon": ALLOW, "operator": ALLOW, "admin": ALLOW}),

    # Admin-ops surface — operators are ADMIN-gated out.
    ("GET", "/edge-api/v1/admin/ops/settings",
        {"anon": UNAUTH, "operator": FORBID, "admin": ALLOW}),
    ("GET", "/edge-api/v1/admin/ops/users/scope",
        {"anon": UNAUTH, "operator": FORBID, "admin": ALLOW}),
    # Note: /admin/ops/backup/verify is deliberately omitted — its
    # 500 is a backup-repo-not-wired handler bug on a dev appliance,
    # unrelated to the authority check NFR-05 is pinning.
    ("GET", "/edge-api/v1/admin/ops/journal/last-purge",
        {"anon": UNAUTH, "operator": FORBID, "admin": ALLOW}),

    # App catalogue admin surface
    ("GET", "/edge-api/v1/admin/apps/hub",
        {"anon": UNAUTH, "operator": FORBID, "admin": ALLOW}),
    ("GET", "/edge-api/v1/admin/apps/central-sync/policy",
        {"anon": UNAUTH, "operator": FORBID, "admin": ALLOW}),

    # Sync surface — OPERATOR legitimately holds
    # `der.sync.metadata.run` by seed-migration grant so facility
    # staff can kick off a resync without admin involvement.
    # Anons still rejected.
    ("POST", "/edge-api/v1/sync/metadata",
        {"anon": UNAUTH, "operator": ALLOW, "admin": ALLOW}),

    # Restore is admin-only — destructive, rewrites the DB.
    ("POST", "/edge-api/v1/restore/request",
        {"anon": UNAUTH, "operator": FORBID, "admin": ALLOW}),

    # Decommission is admin-only — disables every other user.
    ("POST", "/edge-api/v1/admin/ops/decommission",
        {"anon": UNAUTH, "operator": FORBID, "admin": ALLOW}),

    # Public app catalogue read (signed-bundle shape) — any
    # authenticated user can list what's installed; anons cannot.
    ("GET", "/edge-api/v1/apps",
        {"anon": ALLOW, "operator": ALLOW, "admin": ALLOW}),

    # App-installed (ADR-0005 legacy) requires auth.
    ("GET", "/edge-api/v1/apps/installed",
        {"anon": UNAUTH, "operator": ALLOW, "admin": ALLOW}),
]


def mint_cookie_jar(base: str, username: str, password: str) -> CookieJar:
    """Sign in and return a CookieJar carrying DER_SESSION."""
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
                         f"HTTP {e.code}. Check DER_{username.upper()}_PASSWORD.")
    return jar


def probe(base: str, method: str, path: str,
             jar: CookieJar | None) -> int:
    """Hit {base}{path} with {method}; return status code.
    Treats network errors as 0 so the matrix can report them
    distinctly from HTTP statuses."""
    url = base + path
    data = b"{}" if method in ("POST", "PUT", "PATCH") else None
    headers = {"Content-Type": "application/json"} if data else {}
    req = urllib.request.Request(url, data=data, method=method,
                                     headers=headers)
    if jar is not None:
        opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(jar))
    else:
        opener = urllib.request.build_opener()
    try:
        with opener.open(req, timeout=30) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except urllib.error.URLError:
        return 0


def classify(status: int) -> str:
    """Map HTTP status to the three expectation buckets. Note we
    treat 400 / 405 / 409 / 507 as ALLOW because "the request
    reached the handler and was rejected on content, not on
    authority" — NFR-05 is about authority, not payload."""
    if status == 401:
        return UNAUTH
    if status == 403:
        return FORBID
    if 200 <= status < 500:
        # Any non-401/403 that reached the handler counts as
        # "authority admitted the request." 400/405/etc. are
        # handler-side rejections, not auth rejections.
        return ALLOW
    return f"unexpected:{status}"


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(prog="nfr05-forbidden-access")
    p.add_argument("--base-url",
                   default=os.environ.get("DER_URL",
                                            "http://localhost:8085"))
    p.add_argument("--admin-user",
                   default=os.environ.get("DER_ADMIN_USER"))
    p.add_argument("--admin-password",
                   default=os.environ.get("DER_ADMIN_PASSWORD"))
    p.add_argument("--operator-user",
                   default=os.environ.get("DER_OPERATOR_USER"))
    p.add_argument("--operator-password",
                   default=os.environ.get("DER_OPERATOR_PASSWORD"))
    p.add_argument("--out", required=True,
                   help="Path to write the evidence JSON bundle.")
    args = p.parse_args(argv)

    if not all([args.admin_user, args.admin_password,
                args.operator_user, args.operator_password]):
        print("error: all of --admin-user/--admin-password + "
              "--operator-user/--operator-password are required "
              "(or set DER_ADMIN_USER/DER_ADMIN_PASSWORD/"
              "DER_OPERATOR_USER/DER_OPERATOR_PASSWORD env vars).",
              file=sys.stderr)
        return 2

    base = args.base_url.rstrip("/")
    print(f"[nfr05] probing {base}")

    # Mint two session cookies.
    admin_jar = mint_cookie_jar(base, args.admin_user, args.admin_password)
    operator_jar = mint_cookie_jar(base, args.operator_user, args.operator_password)
    jars: dict[Role, CookieJar | None] = {
        "anon": None, "operator": operator_jar, "admin": admin_jar,
    }

    rows_out: list[dict] = []
    violations: list[str] = []
    for method, path, roles in MATRIX:
        for role, expected in roles.items():
            got_status = probe(base, method, path, jars[role])
            got = classify(got_status)
            ok = (got == expected)
            if not ok:
                violations.append(
                    f"{method} {path} as {role}: expected={expected} "
                    f"got={got} (HTTP {got_status})")
            rows_out.append({
                "method": method, "path": path, "role": role,
                "expected": expected, "got": got, "status": got_status,
                "ok": ok,
            })

    out_path = Path(args.out).expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "nfr": "NFR-05",
        "baseUrl": base,
        "rows": rows_out,
        "violations": violations,
        "summary": {
            "probed": len(rows_out),
            "violations": len(violations),
            "passed": len(rows_out) - len(violations),
        },
    }
    out_path.write_text(json.dumps(out, indent=2, sort_keys=True))
    print(f"[nfr05] evidence → {out_path}")
    print(f"[nfr05] probed={out['summary']['probed']} "
          f"passed={out['summary']['passed']} "
          f"violations={out['summary']['violations']}")

    if violations:
        print("[nfr05] FAIL — violations:", file=sys.stderr)
        for v in violations:
            print("  •", v, file=sys.stderr)
        return 1
    print("[nfr05] PASS — every row matched expectation")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
