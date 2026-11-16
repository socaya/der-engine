# NFR-31 — Synthetic data for experiments

**ID:** nfr-31-synthetic-data
**Status:** PINNED
**Evidence class:** documented deterministic generator + scripted
privacy invariants
**Covered requirement:** NFR-31 "Synthetic data only for planned
university experiments; collect only necessary audit details."

## Preconditions

- Python 3.11+ on the host running the evaluation harness.
- A DHIS2 appliance (or DER against one) whose metadata mirror
  carries the UIDs listed in `generate.py`'s defaults (DHIS2
  play / sample dataset).

## Fixture

- `scripts/evaluation/fixtures/generate.py` — deterministic
  generator (Python stdlib only).
- `scripts/evaluation/fixtures/README.md` — invariants + usage.
- `scripts/evaluation/fixtures/aggregate-dataValueSet.json` —
  hand-authored single-envelope compat fixture.

## Invariants

1. **Determinism**. Same `--kind + --count + --seed` → byte-
   identical output across hosts. Pinnable: regenerate twice,
   `diff` must be empty.

   ```bash
   python3 scripts/evaluation/fixtures/generate.py \
     --kind aggregate --count 100 --seed 42 --out /tmp/a.jsonl
   python3 scripts/evaluation/fixtures/generate.py \
     --kind aggregate --count 100 --seed 42 --out /tmp/b.jsonl
   diff /tmp/a.jsonl /tmp/b.jsonl    # must exit 0
   ```

2. **No PII**. Every attribute value in the corpus matches
   `^(Alice|Village)-[0-9]{4}$` or is one of the two fixed gender
   literals. A leak audit is one grep:

   ```bash
   # Anything that doesn't match the known canned shapes is a
   # red flag worth investigating.
   python3 scripts/evaluation/fixtures/generate.py \
     --kind tei --count 1000 --seed 42 --out /tmp/tei.jsonl
   jq -r '.attributes[].value' /tmp/tei.jsonl \
     | grep -vE '^(Alice-|Village-|Female$|Male$)'
   # expected: zero matches
   ```

3. **Metadata hygiene**. Every UID the corpus references MUST
   exist in the central metadata catalogue the DER appliance
   mirrors. For the default `--org-units` / `--data-set` /
   `--program` the appliance's play-instance mirror satisfies
   this by construction.

4. **Auditability markers**. Every emitted row carries
   `_syntheticSource: "NFR-31"` + `_syntheticIdx: <int>`. If a
   row of synthetic data ever appears in a production audit
   stream, grep finds it instantly:

   ```bash
   psql -h localhost -U der -d der \
     -c "SELECT count(*) FROM der.operation_journal WHERE payload_json::text LIKE '%_syntheticSource%';"
   # expected in prod: 0
   # expected in evaluation: >0
   ```

## Evidence pointer

- Generator source: `scripts/evaluation/fixtures/generate.py`
- README: `scripts/evaluation/fixtures/README.md`
- This spec: `tests/security/nfr-31-synthetic-data.md`

The generator is directly runnable; the pilot-acceptance
evidence bundle captures `(--kind, --count, --seed)` triples +
the SHA-256 of each produced corpus into
`docs/evaluation/evidence/<phase>/<commit>/corpora/manifest.json`.

## Reset instructions

Generated corpora default to `/tmp` and are tmpfs-backed on most
Linux hosts — reboot cleans up. For a deliberate wipe:

```bash
rm -f /tmp/aggregate-*.jsonl /tmp/tei-*.jsonl \
      /tmp/enrollment-*.jsonl /tmp/event-*.jsonl
```

## Cross-references

- ADR-0013 NFR evaluation harness.
- NFR-09 reference comparison (future: will pin specific
  generator triples as oracle corpora).
- NFR-17 backlog recovery — current primary consumer.
