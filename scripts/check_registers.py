#!/usr/bin/env python3
"""Validate the DER requirements/UI/traceability registers under `docs/`.

Checks (fatal on violation):
    1. docs/requirements/source-functional-register.csv has exactly 176 unique
       FR-xx-yy IDs, each with a valid priority (P0|P1|P2) and non-empty text.
    2. docs/requirements/source-nonfunctional-register.csv has exactly 35
       unique NFR-xx IDs with valid priority and a non-empty Test column.
    3. docs/ui/source-screen-inventory.csv has exactly 54 unique screen IDs
       split into 18 `client` (DC-01..DC-18) and 36 `admin-ui` (EA-01..EA-36).
    4. Every screen ID has a matching spec file docs/ui/screens/<ID>.md.
    5. docs/verification/traceability-matrix.csv covers every FR and every NFR
       with matching priority. No orphan rows.
    6. docs/verification/screen-traceability.csv covers every screen ID with
       a spec path that exists.

Exit code 0 = all checks pass. Exit code 1 = at least one check failed.
"""
from __future__ import annotations

import csv
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
REQ_DIR = ROOT / "docs" / "requirements"
UI_DIR = ROOT / "docs" / "ui"
VERIF_DIR = ROOT / "docs" / "verification"

FR_RE = re.compile(r"^FR-\d{2}-\d{2}$")
NFR_RE = re.compile(r"^NFR-\d{2}$")
SCREEN_RE = re.compile(r"^(DC|EA)-\d{2}$")
VALID_PRIORITIES = {"P0", "P1", "P2"}


class Report:
    def __init__(self) -> None:
        self.failures: list[str] = []
        self.passes: list[str] = []

    def check(self, condition: bool, message: str) -> None:
        if condition:
            self.passes.append(message)
        else:
            self.failures.append(message)

    def dump(self) -> int:
        for line in self.passes:
            print(f"  [OK]   {line}")
        for line in self.failures:
            print(f"  [FAIL] {line}", file=sys.stderr)
        total = len(self.passes) + len(self.failures)
        print()
        if self.failures:
            print(f"FAIL: {len(self.failures)} of {total} checks failed.", file=sys.stderr)
            return 1
        print(f"PASS: all {total} checks passed.")
        return 0


def read_csv(path: pathlib.Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def check_functional(report: Report) -> dict[str, str]:
    path = REQ_DIR / "source-functional-register.csv"
    rows = read_csv(path)
    report.check(len(rows) == 176, f"functional register has 176 rows (found {len(rows)})")
    ids = [r["Requirement ID"] for r in rows]
    report.check(len(set(ids)) == len(ids), "functional register has unique Requirement IDs")
    bad_fmt = [i for i in ids if not FR_RE.match(i)]
    report.check(not bad_fmt, f"all FR IDs match FR-xx-yy ({len(bad_fmt)} malformed)")
    bad_prio = [r["Requirement ID"] for r in rows if r["Priority"] not in VALID_PRIORITIES]
    report.check(not bad_prio, f"all FR priorities in P0|P1|P2 ({len(bad_prio)} violations)")
    empty_text = [r["Requirement ID"] for r in rows if not r["Requirement"].strip()]
    report.check(not empty_text, f"no FR has empty 'Requirement' text ({len(empty_text)} violations)")
    return {r["Requirement ID"]: r["Priority"] for r in rows}


def check_nonfunctional(report: Report) -> dict[str, str]:
    path = REQ_DIR / "source-nonfunctional-register.csv"
    rows = read_csv(path)
    report.check(len(rows) == 35, f"non-functional register has 35 rows (found {len(rows)})")
    ids = [r["Requirement ID"] for r in rows]
    report.check(len(set(ids)) == len(ids), "non-functional register has unique Requirement IDs")
    bad_fmt = [i for i in ids if not NFR_RE.match(i)]
    report.check(not bad_fmt, f"all NFR IDs match NFR-xx ({len(bad_fmt)} malformed)")
    bad_prio = [r["Requirement ID"] for r in rows if r["Priority"] not in VALID_PRIORITIES]
    report.check(not bad_prio, f"all NFR priorities in P0|P1|P2 ({len(bad_prio)} violations)")
    missing_test = [r["Requirement ID"] for r in rows if not r["Test"].strip()]
    report.check(not missing_test, f"every NFR has a Test id ({len(missing_test)} missing)")
    return {r["Requirement ID"]: r["Priority"] for r in rows}


def check_screens(report: Report) -> list[dict[str, str]]:
    path = UI_DIR / "source-screen-inventory.csv"
    rows = read_csv(path)
    report.check(len(rows) == 54, f"screen inventory has 54 rows (found {len(rows)})")
    ids = [r["screen_id"] for r in rows]
    report.check(len(set(ids)) == len(ids), "screen inventory has unique IDs")
    bad_fmt = [i for i in ids if not SCREEN_RE.match(i)]
    report.check(not bad_fmt, f"all screen IDs match (DC|EA)-xx ({len(bad_fmt)} malformed)")
    dc = sum(1 for r in rows if r["application"] == "client")
    ea = sum(1 for r in rows if r["application"] == "admin-ui")
    report.check(dc == 18, f"18 client (DC) screens (found {dc})")
    report.check(ea == 36, f"36 admin-ui (EA) screens (found {ea})")
    missing_specs: list[str] = []
    for row in rows:
        spec = UI_DIR / "screens" / f"{row['screen_id']}.md"
        if not spec.is_file():
            missing_specs.append(row["screen_id"])
    report.check(not missing_specs, f"every screen has a spec file ({len(missing_specs)} missing: {missing_specs[:5]})")
    return rows


def check_traceability(report: Report, fr: dict[str, str], nfr: dict[str, str]) -> None:
    path = VERIF_DIR / "traceability-matrix.csv"
    rows = read_csv(path)
    fr_rows = [r for r in rows if r["requirement_id"].startswith("FR-")]
    nfr_rows = [r for r in rows if r["requirement_id"].startswith("NFR-")]
    report.check(len(fr_rows) == 176, f"traceability-matrix has 176 FR rows (found {len(fr_rows)})")
    report.check(len(nfr_rows) == 35, f"traceability-matrix has 35 NFR rows (found {len(nfr_rows)})")

    seen_fr = {r["requirement_id"] for r in fr_rows}
    missing_fr = set(fr) - seen_fr
    orphan_fr = seen_fr - set(fr)
    report.check(not missing_fr, f"every FR is in traceability ({len(missing_fr)} missing)")
    report.check(not orphan_fr, f"no orphan FR in traceability ({len(orphan_fr)} orphans)")

    seen_nfr = {r["requirement_id"] for r in nfr_rows}
    missing_nfr = set(nfr) - seen_nfr
    orphan_nfr = seen_nfr - set(nfr)
    report.check(not missing_nfr, f"every NFR is in traceability ({len(missing_nfr)} missing)")
    report.check(not orphan_nfr, f"no orphan NFR in traceability ({len(orphan_nfr)} orphans)")

    prio_mismatch_fr = [
        r["requirement_id"]
        for r in fr_rows
        if r["requirement_id"] in fr and r["priority"] != fr[r["requirement_id"]]
    ]
    report.check(not prio_mismatch_fr, f"FR priorities match register ({len(prio_mismatch_fr)} mismatches)")

    prio_mismatch_nfr = [
        r["requirement_id"]
        for r in nfr_rows
        if r["requirement_id"] in nfr and r["priority"] != nfr[r["requirement_id"]]
    ]
    report.check(not prio_mismatch_nfr, f"NFR priorities match register ({len(prio_mismatch_nfr)} mismatches)")


def check_screen_traceability(report: Report, screens: list[dict[str, str]]) -> None:
    path = VERIF_DIR / "screen-traceability.csv"
    rows = read_csv(path)
    report.check(len(rows) == 54, f"screen-traceability has 54 rows (found {len(rows)})")
    inventory_ids = {r["screen_id"] for r in screens}
    trace_ids = {r["screen_id"] for r in rows}
    report.check(inventory_ids == trace_ids, "screen-traceability covers exactly the inventory IDs")
    missing_spec = [r["screen_id"] for r in rows if not (ROOT / "docs" / r["specification"]).is_file()]
    report.check(not missing_spec, f"every screen-traceability spec path exists ({len(missing_spec)} missing)")


def main() -> int:
    report = Report()
    try:
        fr = check_functional(report)
        nfr = check_nonfunctional(report)
        screens = check_screens(report)
        check_traceability(report, fr, nfr)
        check_screen_traceability(report, screens)
    except FileNotFoundError as exc:
        print(f"FATAL: required register file missing: {exc.filename}", file=sys.stderr)
        return 2
    return report.dump()


if __name__ == "__main__":
    raise SystemExit(main())
