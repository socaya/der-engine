# der-2.3.83 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.82`

## Headline

**Aggregate data values now carry a `dataSet` tag — DER-only
analytics benefit, DHIS2 compatibility unchanged.**

## 1. Rationale

Standard DHIS2 identifies an aggregate value by
`(dataElement, orgUnit, period, categoryOptionCombo, attributeOptionCombo)`
— the dataset is just a form grouping, not part of the row key.
That's fine for Central, but it leaves DER's facility-local
analytics blind to "which form did this value come from?" The user
asked us to tie each value to its dataset so facility reports can
roll up / filter by dataset without re-deriving the mapping from
mirror metadata at read time.

We added a nullable **tag**, not a key component — same cell
captured via two overlapping datasets still resolves to the same
row (last-writer-wins semantics preserved), the column just
records the form that last captured it.

## 2. Schema — V069

```sql
ALTER TABLE aggregate_data_value
    ADD COLUMN IF NOT EXISTS data_set_uid TEXT
        REFERENCES metadata_data_set(dhis2_uid)
        ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_aggregate_data_value_data_set
    ON aggregate_data_value (data_set_uid, submitted_at DESC);
```

- Nullable: pre-V069 rows + ad-hoc writes with no envelope dataset
  stay untagged.
- Soft FK to `metadata_data_set.dhis2_uid`; `ON DELETE SET NULL`
  so a mirror purge doesn't cascade into user data.
- Index tuned for the common filter (`WHERE data_set_uid = ?
  ORDER BY submitted_at DESC`).

## 3. Write path

`DataValueSetsController` propagates the envelope `dataSet` field
into every per-row `DataValueInput`. `AggregateDataValueService`
threads it through to `AggregateDataValue`, which the repository
upserts.

`upsert()` persists the tag on INSERT and on UPDATE preserves it
via `COALESCE(EXCLUDED.data_set_uid, …)` — a null in the update
envelope doesn't clobber a previously-set tag.

## 4. Read / UI

`GET /edge-api/v1/data/aggregate` now:

- Accepts `?dataSet=…` filter.
- LEFT JOINs `metadata_data_set` so each row carries
  `dataSetUid` + `dataSetName`.

`DataAggregate` screen gains:

- **Dataset UID** filter input next to Period / OrgUnit /
  DataElement.
- **Dataset** column (first after Last updated) showing the
  resolved display name, falling back to the raw UID, falling
  back to a muted `untagged` label.
- Free-text search extended to match dataset name and UID.

## 5. Backward compatibility

- `AggregateDataValue` gets a secondary ctor accepting the
  original 11 params (defaults `dataSetUid` to null) — every
  existing caller + test compiles unchanged.
- `DataValueInput` gets the same backward-compat ctor.
- No DHIS2 wire-format change: the central-pushed payload is still
  the compound-key based dataValueSets envelope. The dataSet tag
  is a DER-local annotation.

## 6. Files changed

```
database/migrations/V069__aggregate_data_set_tag.sql     — NEW
server/.../aggregate/AggregateDataValue.java              — dataSetUid field +
                                                             back-compat ctor
server/.../aggregate/AggregateDataValueRepository.java    — upsert + mapper +
                                                             filter SELECTs
server/.../aggregate/AggregateDataValueService.java       — DataValueInput +
                                                             dataSetUid wiring
                                                             + back-compat ctor
server/.../dhis2emulator/DataValueSetsController.java     — envelope dataSet
                                                             → DataValueInput
server/.../web/DataModuleController.java                  — ?dataSet= filter +
                                                             dataSetName join
admin-ui/src/api/edgeApi.ts                              — LocalAggregateRow.
                                                             dataSetUid /
                                                             dataSetName;
                                                             listLocalAggregate
                                                             .dataSet
admin-ui/src/screens/DataAggregate.tsx                   — Dataset filter input
                                                             + column
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.83
```

## 7. Follow-ups

- Backfill task: for untagged pre-V069 rows, resolve the dataset
  by walking `metadata_data_set.payload->'dataSetElements'`; where
  the dataElement belongs to exactly one dataset, apply it; where
  it belongs to several, defer to admin review.
- Same tagging model for Events (R-C/2) and Enrolments (R-C/3) —
  less critical because programs are already part of the write
  envelope, but worth normalising.
