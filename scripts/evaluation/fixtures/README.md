# NFR-31 — Synthetic data for experiments

**Requirement:** NFR-31 "Synthetic data only for planned university
experiments; collect only necessary audit details."

**ADR:** 0013 (NFR evaluation harness).

This directory holds the synthetic payload corpora that every
NFR scenario consumes. Nothing in here is PII, PHI, or
production-sourced — the generator in `generate.py` is
deterministic, seed-controlled, and prefixes every synthetic UID
with a type-tagged letter (`T...` for TEI, `E...` for
enrollment, `V...` for event) so a leak-check against central
can tell "came from the DER evaluation corpus" apart from
"mirrored from a real DHIS2 instance."

## What's here

| File | Shape | Source |
|---|---|---|
| `aggregate-dataValueSet.json` | single `/api/dataValueSets` envelope, three dataElement values. | hand-authored; used by `backlog_recovery.py` to replay N times |
| `generate.py` | deterministic generator producing JSONL corpora | NFR-31 |

Generated JSONL corpora are **not checked in**. Each
NFR-dependent scenario calls the generator with its own seed
and count, consumes the output, then discards. That keeps the
repo lean and the corpora reproducible from flags alone.

## What's synthetic

All generator output satisfies three privacy / integrity
invariants:

1. **No PII.** Attribute values are canned strings keyed off
   the row index: `"Alice-0000"`, `"Village-0042"`. No real
   names, phone numbers, geographic coordinates, or national
   identifiers. A single `grep -rE '[A-Z][a-z]+-[0-9]{4}'`
   trivially audits the whole corpus for leakage.

2. **No PHI.** Numeric values are uniform-random integers over
   a dataElement-type-appropriate range (see
   `DEFAULT_DATA_ELEMENTS` in `generate.py`). No real patient
   observations are ever replayed.

3. **Only shipped metadata UIDs.** Every orgUnit / dataSet /
   dataElement / program / programStage / trackedEntityType uid
   in the corpus exists in the DHIS2 play / sample dataset the
   appliance already mirrors. No invented metadata, so a corpus
   that posts to DER never creates orphan CONFLICT_REVIEW rows
   for unknown references.

Synthetic payload rows carry two audit tags for forensic
clarity:

- `"_syntheticSource": "NFR-31"` — invariant marker.
- `"_syntheticIdx": <int>` — the deterministic row index. Pair
  with `--seed` in flight to reproduce any specific row.

If the server rejects unknown top-level fields, the harness
scripts that post these payloads strip the two markers before
submission. The tags are there for corpus-side auditability, not
for the server to interpret.

## What the parameters control

| Flag | Default | Meaning |
|---|---|---|
| `--kind` | required | `aggregate`, `tei`, `enrollment`, or `event` |
| `--count` | required | number of rows to emit |
| `--seed` | `42` | PRNG seed. Byte-identical output for same `--kind + --count + --seed`. |
| `--out` | required | JSONL destination path |
| `--org-units` | three play OUs | comma-separated UIDs; rows pick uniformly at random |
| `--data-set` | `pBOMPrpg1QX` | dataSet UID for aggregate corpora |
| `--program` | `ur1Edk5Oe2n` | program UID for enrollment/event corpora |
| `--program-stage` | `EPEcjy3FWmI` | programStage UID for event corpora |

**Determinism contract:** same `--kind + --count + --seed + --org-units +
--data-set + --program + --program-stage` → **byte-identical**
output across hosts. That's what lets NFR-09's reference-
comparison fixture corpus pin a specific SHA-256 to lock the
oracle.

## How the harness uses it

### Backlog recovery (NFR-17)

```bash
python3 scripts/evaluation/fixtures/generate.py \
  --kind aggregate --count 1000 --seed 42 \
  --out /tmp/aggregate-1000.jsonl

python3 scripts/evaluation/backlog_recovery.py \
  --payload-file /tmp/aggregate-1000.jsonl \
  --drain-timeout-seconds 600
```

(The current `backlog_recovery.py` consumes a single-envelope
JSON file and replays it N times. Point it at a specific line
of a generated JSONL or extend it to iterate — see the
`--payload-file` flag.)

### Tracker load (future NFR-17 tracker variant)

```bash
python3 scripts/evaluation/fixtures/generate.py \
  --kind tei --count 500 --seed 42 \
  --out /tmp/tei-500.jsonl

python3 scripts/evaluation/fixtures/generate.py \
  --kind enrollment --count 500 --seed 42 \
  --out /tmp/enrollment-500.jsonl

python3 scripts/evaluation/fixtures/generate.py \
  --kind event --count 1500 --seed 42 \
  --out /tmp/event-1500.jsonl
```

With the same `--seed` across the three invocations, the TEI
corpus and the first 500 enrollments align row-for-row
(`enrollment[i].trackedEntity == tei[i].trackedEntity`). Event
corpora of larger counts reference distinct TEIs; that's
intentional for load-profile realism.

### Reference-comparison oracle (NFR-09)

Not yet wired. When the NFR-09 fixture corpus lands it will
pin a specific `(--kind, --count, --seed)` triple and the
expected per-row response fingerprint. The corpus is therefore
version-controlled by its generation flags, not by checking in
the JSONL.

## Regeneration

```bash
# Re-emit the single-row fixture used by backlog_recovery.py
# (kept checked-in for the legacy consumer):
python3 scripts/evaluation/fixtures/generate.py \
  --kind aggregate --count 1 --seed 42 --out /tmp/one.jsonl
python3 -c "import json,sys; print(json.dumps(json.loads(open('/tmp/one.jsonl').read()),indent=2))" \
  > scripts/evaluation/fixtures/aggregate-dataValueSet.json
```

Reset: generated corpora live under `/tmp` by default — removal
is implicit on reboot. The only in-repo file is this README +
the hand-authored single-envelope JSON.

## Cross-references

- Generator source: `generate.py` in this directory.
- Consumers: `scripts/evaluation/backlog_recovery.py`,
  `scripts/evaluation/der_bench.py` (uses in-process payload
  synthesis today; may migrate to this generator).
- Scenario: `tests/security/nfr-31-synthetic-data.md`.
- ADR: `docs/architecture/decisions/0013-nfr-evaluation-harness.md`.
