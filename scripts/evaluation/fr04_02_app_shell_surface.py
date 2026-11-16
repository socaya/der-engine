#!/usr/bin/env python3
"""
FR-04-02 — Full DHIS2 app-shell surface evidence.

"Serve the supported DHIS2 app-shell resources without any
central live dependency": a stock DHIS2 custom app (eregisters,
Capture, etc.) booting against DER MUST find every well-known
`/api/*` endpoint it reads during bootstrap, with the shape its
2.4x bundle destructures.

This script probes the pinned matrix against a running DER and
asserts both HTTP status and a minimal shape invariant per
endpoint (keys expected to exist, array keys expected to hold
arrays). A fail means a shipped app-shell gap re-opened — the
PARTIAL marker on FR-04-02 should flip back.

Python stdlib only — ADR-0013.

Usage:

  export DER_URL=http://localhost:8085
  export DER_ADMIN_USER=der-admin
  export DER_ADMIN_PASSWORD=...

  python3 scripts/evaluation/fr04_02_app_shell_surface.py \\
    --out docs/evaluation/evidence/<phase>/<commit>/fr-04-02.json

Exit codes:
  0  — every endpoint's status + shape match the pinned invariant
  1  — one or more endpoints violated (JSON lists violations)
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
from typing import Any, Callable


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
    """GET {base}{path}; return (status, parsed-json-or-None)."""
    url = base + path
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar))
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with opener.open(req, timeout=30) as r:
            raw = r.read()
            try:
                return r.status, json.loads(raw) if raw else None
            except json.JSONDecodeError:
                return r.status, {"_raw": raw.decode("utf-8", "replace")}
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, None


# The pinned surface. Each row is (label, path, expected_status,
# shape_check). shape_check gets the parsed body and returns an
# empty string on pass or a reason on fail.
def _keys(*required: str) -> Callable[[Any], str]:
    def check(body: Any) -> str:
        if not isinstance(body, dict):
            return f"expected object, got {type(body).__name__}"
        missing = [k for k in required if k not in body]
        return "" if not missing else f"missing keys: {missing}"
    return check


def _array_key(key: str) -> Callable[[Any], str]:
    def check(body: Any) -> str:
        if not isinstance(body, dict) or key not in body:
            return f"missing {key!r}"
        if not isinstance(body[key], list):
            return f"{key!r} is {type(body[key]).__name__}, not list"
        return ""
    return check


def _me_shape(body: Any) -> str:
    """eregisters' require-programs reads unit.programs.length;
    HeaderBar's text-avatar reads name.split(' ')."""
    if not isinstance(body, dict):
        return "not an object"
    if "name" not in body:
        return "missing 'name'"
    ous = body.get("organisationUnits")
    if not isinstance(ous, list):
        return "'organisationUnits' not a list"
    for i, ou in enumerate(ous):
        if not isinstance(ou, dict) or "programs" not in ou:
            return f"OU[{i}] missing 'programs'"
        if not isinstance(ou["programs"], list):
            return f"OU[{i}].programs not a list"
    return ""


def _systeminfo_shape(body: Any) -> str:
    """HeaderBar binds `systemName`; app-runtime reads `version`
    + `contextPath`; absent fields render as 'undefined - <app>'."""
    for k in ("systemName", "version", "contextPath", "serverDate"):
        if not isinstance(body, dict) or k not in body:
            return f"missing {k!r}"
    return ""


def _programs_hydrated(body: Any) -> str:
    """eregisters' deriveValidIds walks
    programStages[i].programStageDataElements.map(...).  Each
    stage MUST have the array inlined."""
    if not isinstance(body, dict):
        return "not an object"
    stages = body.get("programStages")
    if not isinstance(stages, list):
        return "'programStages' not a list"
    for i, s in enumerate(stages):
        psde = s.get("programStageDataElements") if isinstance(s, dict) else None
        if not isinstance(psde, list):
            return (f"programStages[{i}].programStageDataElements "
                    f"not a list (got {type(psde).__name__}) — hydration regression")
    return ""


def _tracker_shape(body: Any) -> str:
    """2.44 renamed `instances` → `trackedEntities` + wrapped pager.
    eregisters' pullData destructures the 2.44 shape."""
    if not isinstance(body, dict):
        return "not an object"
    if "trackedEntities" not in body:
        return "missing 'trackedEntities' (2.44 shape)"
    if not isinstance(body["trackedEntities"], list):
        return "'trackedEntities' not a list"
    if not isinstance(body.get("pager"), dict):
        return "'pager' envelope missing"
    return ""


# ---------------------------------------------------------------
# What follows is the pinned FR-04-02 app-shell surface. Each
# entry is the single thing a stock DHIS2 bundle reads during
# bootstrap. Omissions here = unshipped gap.
# ---------------------------------------------------------------
MATRIX: list[tuple[str, str, int, Callable[[Any], str]]] = [
    # Session + user
    ("me", "/api/me", 200, _me_shape),
    ("me-with-programs", "/api/me.json", 200, _me_shape),

    # System
    ("systemInfo (2.4x path)", "/api/system/info", 200, _systeminfo_shape),
    ("systemInfo (legacy alias)", "/api/systemInfo", 200, _systeminfo_shape),
    ("ping", "/api/ping", 200, lambda b: ""),
    ("loginConfig", "/api/loginConfig", 200, _keys("applicationTitle", "uiLocale")),

    # Settings
    ("systemSettings", "/api/systemSettings",
     200, _keys("applicationTitle", "keyUiLocale")),
    ("userSettings (bulk)", "/api/userSettings",
     200, _keys("keyUiLocale")),

    # Metadata (canonical 2.44 wrapper shapes)
    ("dataSets", "/api/dataSets.json?paging=false", 200, _array_key("dataSets")),
    ("dataElements", "/api/dataElements.json?paging=false",
     200, _array_key("dataElements")),
    ("programs", "/api/programs.json?paging=false", 200, _array_key("programs")),
    ("programStages", "/api/programStages.json?paging=false",
     200, _array_key("programStages")),
    ("categories", "/api/categories.json?paging=false",
     200, _array_key("categories")),
    ("categoryCombos", "/api/categoryCombos.json?paging=false",
     200, _array_key("categoryCombos")),
    ("categoryOptions", "/api/categoryOptions.json?paging=false",
     200, _array_key("categoryOptions")),
    ("categoryOptionCombos",
     "/api/categoryOptionCombos.json?paging=false",
     200, _array_key("categoryOptionCombos")),
    ("optionSets", "/api/optionSets.json?paging=false",
     200, _array_key("optionSets")),
    ("options", "/api/options.json?paging=false", 200, _array_key("options")),
    ("optionGroups", "/api/optionGroups.json?paging=false",
     200, _array_key("optionGroups")),
    ("programIndicators", "/api/programIndicators.json?paging=false",
     200, _array_key("programIndicators")),
    ("programRules", "/api/programRules.json?paging=false",
     200, _array_key("programRules")),
    ("programRuleActions", "/api/programRuleActions.json?paging=false",
     200, _array_key("programRuleActions")),
    ("programRuleVariables", "/api/programRuleVariables.json?paging=false",
     200, _array_key("programRuleVariables")),
    ("trackedEntityTypes", "/api/trackedEntityTypes.json?paging=false",
     200, _array_key("trackedEntityTypes")),
    ("trackedEntityAttributes",
     "/api/trackedEntityAttributes.json?paging=false",
     200, _array_key("trackedEntityAttributes")),
    ("relationshipTypes", "/api/relationshipTypes.json?paging=false",
     200, _array_key("relationshipTypes")),

    # API-version prefix (DHIS2 apps always prepend /api/<N>/ or /api/v<N>/)
    ("version-prefix /api/44/me", "/api/44/me", 200, _me_shape),
    ("version-prefix /api/v44/me.json", "/api/v44/me.json", 200, _me_shape),

    # Tracker 2.44 shape — renamed array key, pager envelope
    ("tracker (2.44)",
     "/api/tracker/trackedEntities?program=ueBhWkWll5v&orgUnit=HL2zXaIULBe"
     "&orgUnitMode=SELECTED&page=1&pageSize=1",
     200, _tracker_shape),

    # /api/dataStore — namespace CRUD for app-local K/V
    ("dataStore (missing namespace -> 404)",
     "/api/dataStore/__fr04-02-never-exists__", 404, lambda b: ""),

    # Legacy Struts probe (silenced noise)
    ("getModules.action", "/dhis-web-commons/menu/getModules.action",
     200, lambda b: ""),

    # One hydrated single-program read — eregisters' required shape
    ("program hydrated with programStageDataElements",
     "/api/programs/ueBhWkWll5v.json", 200, _programs_hydrated),

    # OU with descendants wrapper — eregisters reads
    # e.organisationUnits.organisationUnits.
    ("OU wrapper (includeDescendants=true)",
     "/api/organisationUnits/HL2zXaIULBe.json?includeDescendants=true",
     200, _array_key("organisationUnits")),
]


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(prog="fr04-02-app-shell")
    p.add_argument("--base-url",
                   default=os.environ.get("DER_URL",
                                            "http://localhost:8085"))
    p.add_argument("--admin-user",
                   default=os.environ.get("DER_ADMIN_USER")
                   or os.environ.get("DER_BOOTSTRAP_ADMIN_USERNAME"))
    p.add_argument("--admin-password",
                   default=os.environ.get("DER_ADMIN_PASSWORD")
                   or os.environ.get("DER_BOOTSTRAP_ADMIN_PASSWORD"))
    p.add_argument("--out", required=True,
                   help="Path to write the evidence JSON bundle.")
    args = p.parse_args(argv)

    if not args.admin_user or not args.admin_password:
        print("error: --admin-user and --admin-password required "
              "(or DER_ADMIN_USER/DER_ADMIN_PASSWORD, or "
              "DER_BOOTSTRAP_ADMIN_USERNAME/PASSWORD).", file=sys.stderr)
        return 2

    base = args.base_url.rstrip("/")
    print(f"[fr04-02] probing {base}")
    jar = mint_cookie_jar(base, args.admin_user, args.admin_password)

    rows_out: list[dict] = []
    violations: list[str] = []
    for label, path, expected_status, shape_check in MATRIX:
        status, body = probe(base, path, jar)
        status_ok = (status == expected_status)
        shape_err = shape_check(body) if (status_ok and body is not None) else ""
        ok = status_ok and shape_err == ""
        rows_out.append({
            "label": label,
            "path": path,
            "expectedStatus": expected_status,
            "status": status,
            "shapeError": shape_err,
            "ok": ok,
        })
        if not status_ok:
            violations.append(
                f"{label} ({path}): expected HTTP {expected_status}, "
                f"got {status}")
        elif shape_err:
            violations.append(f"{label} ({path}): shape — {shape_err}")

    out_path = Path(args.out).expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "fr": "FR-04-02",
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
    print(f"[fr04-02] evidence → {out_path}")
    print(f"[fr04-02] probed={out['summary']['probed']} "
          f"passed={out['summary']['passed']} "
          f"violations={out['summary']['violations']}")

    if violations:
        print("[fr04-02] FAIL — violations:", file=sys.stderr)
        for v in violations:
            print("  •", v, file=sys.stderr)
        return 1
    print("[fr04-02] PASS — every app-shell probe matched expectation")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
