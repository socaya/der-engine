#!/usr/bin/env python3
"""
FR-17-01..07 — scenario matrix manifest + evidence runner.

The FR-17 register requires a seeded workload scenario matrix
tying every FR-17 item to a concrete evidence producer (fixture
generator, chaos driver, oracle test, benchmark). The producers
have shipped incrementally; this script is the manifest that
reviewers and pilot operators read to find which test / script
owns which obligation, plus a runner that enumerates each and
confirms the producer exists on disk.

Not a live benchmarker — it's a pin against the FR-17 taxonomy
so a refactor can't drop an obligation silently. The actual
runs happen under `scripts/evaluation/nfr_sweep.sh` /
`run_phase_08.sh`; this just documents and verifies the surface.

Python stdlib only — ADR-0013.

Usage:

  python3 scripts/evaluation/fr17_scenario_matrix.py \\
    --out docs/evaluation/evidence/<phase>/<commit>/fr-17.json

Exit codes:
  0  — every FR-17 row has its evidence producer present on disk
  1  — one or more rows missing — a producer was deleted or
       renamed without updating the manifest
  2  — environment misconfiguration (bad --out path, etc.)
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


# ---------------------------------------------------------------
# The pinned FR-17 taxonomy. Each row names:
#   id         — the FR-17-0X obligation
#   title      — the shall requirement (one-line)
#   producers  — relative paths from repo root; at least one per
#                row MUST exist on disk, else the row is PARTIAL
#   notes      — why those producers satisfy the obligation
# ---------------------------------------------------------------
MATRIX = [
    {
        "id": "FR-17-01",
        "title": "Generate seeded aggregate/event/Tracker inputs without personal data",
        "producers": [
            "scripts/evaluation/fixtures/generate.py",
            "scripts/evaluation/fixtures/aggregate-dataValueSet.json",
            "scripts/evaluation/fixtures/README.md",
        ],
        "notes": (
            "NFR-31 generator shipped; seeded Random(42) emits aggregate / "
            "tei / enrollment / event JSONL corpora with _syntheticSource + "
            "_syntheticIdx markers so a leak-check can filter synthetic-vs-"
            "real at pilot. PII-free by construction (canned names, uniform-"
            "random observations within DE-type range)."
        ),
    },
    {
        "id": "FR-17-02",
        "title": "Deterministically disconnect and restore WAN while keeping LAN alive",
        "producers": [
            "scripts/evaluation/chaos.sh",
            "scripts/evaluation/chaos_pull_write_interlock.sh",
            "scripts/evaluation/chaos_journal_recovery.sh",
        ],
        "notes": (
            "chaos.sh wraps pfctl / tc rules to drop only outbound packets "
            "destined for the pinned central IP; LAN traffic (edge <-> client "
            "device) keeps flowing. Companion scripts exercise the drain-"
            "under-partition + pull-write-interlock + journal-recovery paths."
        ),
    },
    {
        "id": "FR-17-03",
        "title": "Run defined simultaneous client updates and dependent workflow steps",
        "producers": [
            "scripts/evaluation/der_bench.py",
            "scripts/evaluation/soak.sh",
            "scripts/evaluation/soak_72h.sh",
            "scripts/evaluation/load.sh",
        ],
        "notes": (
            "der_bench.py drives N concurrent write clients against a running "
            "DER with configurable workload mix (aggregate / event / tracker) "
            "and prints a budget-comparable report. soak scripts hold steady "
            "state for pilot-duration runs."
        ),
    },
    {
        "id": "FR-17-04",
        "title": "Compare inputs, validation responses and resulting records with reference DHIS2",
        "producers": [
            "scripts/evaluation/fr04_02_app_shell_surface.py",
            "server/src/test/java/ug/ac/mak/der/nfr/Nfr32NoCentralCouplingTest.java",
        ],
        "notes": (
            "fr04_02 probes 33 rows of the DHIS2 app-shell surface against a "
            "running DER and asserts status + shape invariants per endpoint, "
            "pinning the compat posture a stock DHIS2 2.4x bundle depends on. "
            "Nfr32 pins the architectural invariant that central coupling "
            "cannot leak into the write path (@Transactional boundary)."
        ),
    },
    {
        "id": "FR-17-05",
        "title": "Define expected conflict classes and compute precision and recall",
        "producers": [
            "server/src/test/java/ug/ac/mak/der/nfr/"
            "Fr1010Nfr10Nfr11ConflictPrecisionScenarioTest.java",
        ],
        "notes": (
            "Seeded Random(42) corpus of 150 (local, central) event pairs "
            "balanced across CENTRAL_DIVERGED / CENTRAL_DELETED / IN_SYNC + "
            "50-row DUPLICATE_LOCAL set. Pins recall + precision = 1.0 on "
            "every integrity-critical class. NFR-11 retry-storm scenario "
            "adds the 100-write duplicate-avoidance assertion."
        ),
    },
    {
        "id": "FR-17-06",
        "title": "Confirm committed data/journal survive defined restarts",
        "producers": [
            "server/src/test/java/ug/ac/mak/der/nfr/"
            "Nfr12Nfr13AccountingAndRecoverabilityScenarioTest.java",
            "server/src/test/java/ug/ac/mak/der/nfr/"
            "Nfr02Nfr03Nfr04DurabilityAtomicityConsistencyTest.java",
            "scripts/evaluation/chaos_journal_recovery.sh",
        ],
        "notes": (
            "NFR-12/13 pin the restart-reaper's exact SQL predicate (only "
            "IN_FLIGHT rows rewind; terminal rows never touched) + the "
            "outcome-bucket exhaustiveness. NFR-02/03/04 pin @Transactional "
            "on every write entry + FK invariants + the operation_journal "
            "state CHECK + covering index. chaos_journal_recovery.sh is the "
            "live-run driver that kills DER mid-drain and verifies journal "
            "state after restart."
        ),
    },
    {
        "id": "FR-17-07",
        "title": "Compare central and local intended effects after recovery",
        "producers": [
            "scripts/evaluation/backlog_recovery.py",
            "scripts/evaluation/chaos_pull_write_interlock.sh",
            "scripts/evaluation/forbidden_access_matrix.py",
        ],
        "notes": (
            "backlog_recovery.py drives a WAN-interrupt then measures the "
            "drain catch-up rate + any residual delta between central-side "
            "import summaries and local journal terminal states. The "
            "oracle is the operation_journal: every row must reach one of "
            "the five NFR-12 public buckets after convergence (ties into "
            "the NFR-12 exhaustiveness invariant)."
        ),
    },
]


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(prog="fr17-scenario-matrix")
    p.add_argument("--out", required=True,
                   help="Path to write the evidence JSON bundle.")
    args = p.parse_args(argv)

    repo_root = Path(__file__).resolve().parent.parent.parent

    rows_out: list[dict] = []
    violations: list[str] = []
    for row in MATRIX:
        missing: list[str] = []
        present: list[str] = []
        for rel in row["producers"]:
            if (repo_root / rel).exists():
                present.append(rel)
            else:
                missing.append(rel)
        ok = len(missing) == 0
        rows_out.append({
            "id": row["id"],
            "title": row["title"],
            "producersPresent": present,
            "producersMissing": missing,
            "notes": row["notes"],
            "ok": ok,
        })
        if not ok:
            violations.append(
                f"{row['id']}: missing {len(missing)} producer(s): "
                + ", ".join(missing))

    out_path = Path(args.out).expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "fr": "FR-17-01..07",
        "repoRoot": str(repo_root),
        "rows": rows_out,
        "violations": violations,
        "summary": {
            "obligations": len(rows_out),
            "satisfied": len(rows_out) - len(violations),
            "violations": len(violations),
        },
    }
    out_path.write_text(json.dumps(out, indent=2, sort_keys=True))
    print(f"[fr17] evidence -> {out_path}")
    print(f"[fr17] obligations={out['summary']['obligations']} "
          f"satisfied={out['summary']['satisfied']} "
          f"violations={out['summary']['violations']}")

    if violations:
        print("[fr17] FAIL -- violations:", file=sys.stderr)
        for v in violations:
            print("  -", v, file=sys.stderr)
        return 1
    print("[fr17] PASS -- every FR-17 obligation backed by a producer on disk")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
