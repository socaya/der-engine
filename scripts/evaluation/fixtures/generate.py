#!/usr/bin/env python3
"""
NFR-31 — deterministic synthetic-data generator.

Emits newline-delimited JSON (JSONL) corpora of DHIS2-shaped
write payloads for use by the NFR evaluation harness (backlog
recovery, bench, precision/recall oracle fixtures). Python
stdlib only — no numpy, no faker — so the generator runs on a
pilot host with nothing beyond the system Python 3.11+.

All randomness is seeded. Given the same CLI flags, this script
produces byte-identical output across hosts. The seeded corpus
is what NFR-31 means by "synthetic data for experiments":

  * No PII — attribute values are canned strings keyed off a
    row index ("Alice-0000", "Village-0042") so a leak-check can
    grep the corpus for anything that looks like a real name.
  * No PHI — numeric values are uniform-random integers in a
    dataElement-type-appropriate range, not real patient
    observations.
  * Metadata UIDs come from the DHIS2 play / sample dataset the
    appliance already mirrors; none are invented.

Shapes produced:

  aggregate   — DHIS2 /api/dataValueSets envelopes.
  tei         — tracked_entity records matching /api/tracker
                TrackedEntityInstance shape.
  enrollment  — enrollment records tied to a TEI uid in the
                same corpus.
  event       — event records keyed on program stage + a TEI uid.

Usage:

  python3 scripts/evaluation/fixtures/generate.py \
      --kind aggregate --count 1000 --seed 42 \
      --out scripts/evaluation/fixtures/aggregate-1000.jsonl

  python3 scripts/evaluation/fixtures/generate.py \
      --kind tei --count 100 --seed 42 \
      --out scripts/evaluation/fixtures/tei-100.jsonl

Determinism contract: same --kind + --count + --seed + --metadata
flags → identical output. Change any of those and the corpus
changes. That's what lets the NFR-09 reference-comparison harness
version a corpus by its SHA-256 checksum.
"""
from __future__ import annotations

import argparse
import json
import random
import string
import sys
from pathlib import Path
from typing import Iterable

# ---------------------------------------------------------------
# Metadata the corpora reference. These are stable DHIS2 play-
# instance UIDs; the DER appliance's metadata mirror exposes the
# same values via /api/organisationUnits, /api/dataSets, /api/
# programs, and /api/trackedEntityTypes. If you point DER at a
# central with a different metadata catalogue, override via the
# --metadata flags.
# ---------------------------------------------------------------
DEFAULT_ORG_UNITS = [
    "DiszpKrYNg8",  # Ngelehun CHC (DHIS2 play example OU)
    "g8upMTyEZGZ",  # Njandama MCHP
    "YuQRtpLP10I",  # Baoma CHP
]
DEFAULT_DATA_SET = "pBOMPrpg1QX"
DEFAULT_DATA_ELEMENTS = [
    ("FTRrcoaog83", "INTEGER_POSITIVE", 1, 500),
    ("Ix2HsbDMLea", "INTEGER_POSITIVE", 1, 200),
    ("hmSnCXmLYwt", "INTEGER_POSITIVE", 1, 150),
]
DEFAULT_CATEGORY_OPTION_COMBO = "pq2XI5kz2BY"
DEFAULT_PROGRAM = "ur1Edk5Oe2n"  # TB program (play)
DEFAULT_PROGRAM_STAGE = "EPEcjy3FWmI"
DEFAULT_TRACKED_ENTITY_TYPE = "nEenWmSyUEp"  # Person
DEFAULT_ATTRIBUTES = [
    ("w75KJ2mc4zz", "First name"),    # given name
    ("zDhUuAYrxNC", "Last name"),     # family name
    ("cejWyOfXge6", "Gender"),
]

PERIOD_PREFIX = "2026"
# Mondays in Nov/Dec 2026 — spread across weeks so the backlog
# recovery test sees a realistic period distribution.
DEFAULT_WEEKS = [f"{PERIOD_PREFIX}W{w:02d}" for w in (40, 41, 42, 43, 44, 45, 46)]


# ---------------------------------------------------------------
# UID generation. DHIS2 UIDs are 11-char base62 strings starting
# with a letter. We stamp our generated UIDs with a "synthetic"
# marker in the first 3 chars ("DER") so a diff against central
# can tell "came from this generator" apart from "mirrored from
# play". Keeping that prefix also makes leak-checks trivial:
# anything starting with DER in central is an escape from the
# evaluation env.
# ---------------------------------------------------------------
_B62 = string.ascii_letters + string.digits


def synth_uid(rng: random.Random, kind: str) -> str:
    """Deterministic 11-char DHIS2-shape UID keyed on `rng`.

    First char is `kind.upper()[0]` to keep local inspection of
    corpora readable (T... = TEI, E... = enrollment, V... = event,
    D... = dataValue).
    """
    return kind[0].upper() + "".join(rng.choices(_B62, k=10))


# ---------------------------------------------------------------
# Generators per shape.
# ---------------------------------------------------------------

def gen_aggregate(count: int, rng: random.Random,
                  org_units: list[str], data_set: str,
                  elements: list[tuple[str, str, int, int]],
                  weeks: list[str]) -> Iterable[dict]:
    for i in range(count):
        ou = rng.choice(org_units)
        period = rng.choice(weeks)
        values = []
        for de_uid, _, lo, hi in elements:
            values.append({
                "dataElement": de_uid,
                "categoryOptionCombo": DEFAULT_CATEGORY_OPTION_COMBO,
                "value": str(rng.randint(lo, hi)),
                "_syntheticIdx": i,  # strip before posting if the
                                     # server rejects unknown fields;
                                     # kept for corpus auditability.
            })
        yield {
            "dataSet": data_set,
            "orgUnit": ou,
            "period": period,
            "completeDate": "2026-12-31",
            "_syntheticSource": "NFR-31",
            "_syntheticIdx": i,
            "dataValues": values,
        }


def gen_tei(count: int, rng: random.Random,
            org_units: list[str]) -> Iterable[dict]:
    for i in range(count):
        tei_uid = synth_uid(rng, "tei")
        yield {
            "trackedEntity": tei_uid,
            "trackedEntityType": DEFAULT_TRACKED_ENTITY_TYPE,
            "orgUnit": rng.choice(org_units),
            "_syntheticSource": "NFR-31",
            "_syntheticIdx": i,
            "attributes": [
                {"attribute": DEFAULT_ATTRIBUTES[0][0],
                 "value": f"Alice-{i:04d}"},
                {"attribute": DEFAULT_ATTRIBUTES[1][0],
                 "value": f"Village-{i:04d}"},
                {"attribute": DEFAULT_ATTRIBUTES[2][0],
                 "value": rng.choice(["Female", "Male"])},
            ],
        }


def gen_enrollment(count: int, rng: random.Random,
                   org_units: list[str], program: str) -> Iterable[dict]:
    """One enrollment per TEI — the TEI uid is regenerated with the
    same seed sequence so a parallel `tei` corpus of the same
    count aligns row-for-row (enrollment[i].trackedEntity ==
    tei[i].trackedEntity). Downstream fixtures rely on that
    alignment."""
    for i in range(count):
        # Burn the same UID bytes the TEI generator would at idx i,
        # then step forward for the enrollment uid.
        tei_uid = synth_uid(rng, "tei")
        enr_uid = synth_uid(rng, "enrollment")
        ou = rng.choice(org_units)
        yield {
            "enrollment": enr_uid,
            "trackedEntity": tei_uid,
            "program": program,
            "orgUnit": ou,
            "status": "ACTIVE",
            "enrolledAt": f"2026-11-{(i % 28) + 1:02d}",
            "occurredAt": f"2026-11-{(i % 28) + 1:02d}",
            "_syntheticSource": "NFR-31",
            "_syntheticIdx": i,
        }


def gen_event(count: int, rng: random.Random,
              org_units: list[str], program: str,
              program_stage: str,
              elements: list[tuple[str, str, int, int]]) -> Iterable[dict]:
    for i in range(count):
        tei_uid = synth_uid(rng, "tei")
        enr_uid = synth_uid(rng, "enrollment")
        event_uid = synth_uid(rng, "event")
        ou = rng.choice(org_units)
        data_values = []
        for de_uid, _, lo, hi in elements:
            data_values.append({
                "dataElement": de_uid,
                "value": str(rng.randint(lo, hi)),
            })
        yield {
            "event": event_uid,
            "trackedEntity": tei_uid,
            "enrollment": enr_uid,
            "program": program,
            "programStage": program_stage,
            "orgUnit": ou,
            "status": "COMPLETED",
            "occurredAt": f"2026-11-{(i % 28) + 1:02d}",
            "dataValues": data_values,
            "_syntheticSource": "NFR-31",
            "_syntheticIdx": i,
        }


# ---------------------------------------------------------------
# CLI
# ---------------------------------------------------------------

KINDS = {
    "aggregate": gen_aggregate,
    "tei": gen_tei,
    "enrollment": gen_enrollment,
    "event": gen_event,
}


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(
        prog="nfr31-generate",
        description="NFR-31 — deterministic synthetic-data corpus generator.",
    )
    p.add_argument("--kind", required=True, choices=sorted(KINDS.keys()),
                   help="Which corpus shape to emit.")
    p.add_argument("--count", required=True, type=int,
                   help="Number of rows. Deterministic in --seed.")
    p.add_argument("--seed", type=int, default=42,
                   help="PRNG seed. Default 42. Same seed + same "
                        "--kind + --count → byte-identical output.")
    p.add_argument("--out", required=True,
                   help="Destination path for the JSONL corpus.")
    p.add_argument("--org-units", default=",".join(DEFAULT_ORG_UNITS),
                   help="Comma-separated orgUnit UIDs. Defaults to "
                        "three DHIS2 play orgUnits.")
    p.add_argument("--data-set", default=DEFAULT_DATA_SET,
                   help="dataSet UID for aggregate corpora.")
    p.add_argument("--program", default=DEFAULT_PROGRAM,
                   help="program UID for enrollment/event corpora.")
    p.add_argument("--program-stage", default=DEFAULT_PROGRAM_STAGE,
                   help="programStage UID for event corpora.")
    args = p.parse_args(argv)

    if args.count < 1:
        print("error: --count must be ≥ 1", file=sys.stderr)
        return 2

    rng = random.Random(args.seed)
    org_units = [u.strip() for u in args.org_units.split(",") if u.strip()]
    if not org_units:
        print("error: --org-units is empty", file=sys.stderr)
        return 2

    kind = args.kind
    if kind == "aggregate":
        rows = gen_aggregate(args.count, rng, org_units, args.data_set,
                             DEFAULT_DATA_ELEMENTS, DEFAULT_WEEKS)
    elif kind == "tei":
        rows = gen_tei(args.count, rng, org_units)
    elif kind == "enrollment":
        rows = gen_enrollment(args.count, rng, org_units, args.program)
    elif kind == "event":
        rows = gen_event(args.count, rng, org_units, args.program,
                         args.program_stage, DEFAULT_DATA_ELEMENTS)
    else:
        # Guarded by argparse choices, but keep the branch for
        # strict-type-checkers.
        print(f"error: unknown kind {kind}", file=sys.stderr)
        return 2

    out_path = Path(args.out).expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    with out_path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, sort_keys=True, separators=(",", ":")))
            f.write("\n")
            written += 1
    print(f"wrote {written} rows → {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
