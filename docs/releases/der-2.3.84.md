# der-2.3.84 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.83`

## Headline

**`dataSet` is now a required tag on every aggregate data value.**

Standard DHIS2 does not require values to pin to a dataset, but
DER does — facility-local analytics depend on being able to filter
and roll up by dataset without re-deriving the mapping from mirror
metadata at read time. V070 backfills what it can and enforces
`NOT NULL`; the service rejects any write that omits a dataset.

## 1. V070 migration

```sql
-- 1. Backfill rows whose dataElement lives in exactly one dataset.
WITH candidate AS (
    SELECT av.value_id, ds.dhis2_uid AS ds_uid
    FROM aggregate_data_value av
    JOIN metadata_data_set ds ON EXISTS (
        SELECT 1 FROM jsonb_array_elements(ds.payload->'dataSetElements') dse
        WHERE dse->'dataElement'->>'id' = av.data_element_uid
    )
    WHERE av.data_set_uid IS NULL
),
unambiguous AS (
    SELECT value_id, MIN(ds_uid) AS ds_uid
    FROM candidate
    GROUP BY value_id
    HAVING COUNT(DISTINCT ds_uid) = 1
)
UPDATE aggregate_data_value av
   SET data_set_uid = u.ds_uid
  FROM unambiguous u
 WHERE av.value_id = u.value_id;

-- 2. Drop pre-feature leftovers that can't be unambiguously tagged.
DELETE FROM aggregate_data_value WHERE data_set_uid IS NULL;

-- 3. Enforce.
ALTER TABLE aggregate_data_value
    ALTER COLUMN data_set_uid SET NOT NULL;
```

Backfill picks the dataset only when the dataElement belongs to
**exactly one**; ambiguous rows are dropped alongside the untagged
leftovers so the NOT NULL enforcement never has to lie.

## 2. Java invariants

- `AggregateDataValue` compact ctor now
  `Objects.requireNonNull(dataSetUid, "dataSetUid")` + blank check.
- Backward-compat ctors on `AggregateDataValue` + `DataValueInput`
  removed — call sites must supply the dataset.
- `AggregateDataValueService.validate()` rejects rows with null /
  blank `dataSetUid` with reason `"dataSet is required"`.
- `DataValueSetsController` returns 400 early when the envelope
  omits `dataSet` — one rejection per request instead of one per
  row.

## 3. API semantics

`POST /api/dataValueSets` — envelope `dataSet` field is now
required. Submissions without it get:

```json
{
  "status": "ERROR",
  "importCount": { "imported": 0, "ignored": 0 },
  "conflicts": [
    { "object": "dataSet", "value": "dataSet is required (DER policy)" }
  ],
  "responseType": "ImportSummary"
}
```

HTTP status: 400.

## 4. Callers updated

- `ReferralIngestService.ingestAggregate` now reads `dataSet` from
  the referral payload and passes it through.

## 5. Files changed

```
database/migrations/V070__aggregate_data_set_required.sql   — NEW
server/.../aggregate/AggregateDataValue.java                 — requireNonNull;
                                                                back-compat ctor
                                                                removed
server/.../aggregate/AggregateDataValueService.java          — DataValueInput
                                                                back-compat ctor
                                                                removed; validate()
                                                                rejects null/blank
server/.../dhis2emulator/DataValueSetsController.java        — envelope-level 400
server/.../workflows/referral/ReferralIngestService.java     — threads dataSet
server/.../test/.../AggregateDataValueTest.java              — rejectsNullOrBlank
                                                                dataSet test added
server/.../test/.../AggregateDataValueRepositoryTest.java    — sample() + mock
                                                                getString("data_set_uid")
server/.../test/.../AggregateDataValueServiceTest.java       — validInput +
                                                                rejectsMissingFields
                                                                cover null/blank
                                                                dataSet
server/.../test/.../DataValueSetsControllerTest.java         — envelope dataSet
                                                                in every payload
VERSION / server/pom.xml / admin-ui/package.json / sw.js    — 2.3.84
```

## 6. Verified

```
cd server && mvn test \
  -Dtest='AggregateDataValueTest,AggregateDataValueRepositoryTest,
          AggregateDataValueServiceTest,DataValueSetsControllerTest'
                                            ✓ 38 pass / 0 fail

Pre-existing suite failures (DeviceControllerTest, MetadataListControllerTest,
Dhis2CompatibilityControllerTest, etc.) confirmed by git-stash baseline run —
not related to this change.

cd admin-ui && npm run build                 ✓ 2.3.84 bundle (852 ms)
```

## 7. Follow-ups

- CapAggregate `Open DHIS2 capture` button already supplies a
  dataset in the DHIS2 web app URL — unchanged.
- Admin "Backfill untagged values" tool to let an operator
  manually resolve previously-untagged values when they come from
  overlapping datasets (currently just deleted by V070).
- Mirror the same required-tag model to Events (R-C/2) and
  Enrolments (R-C/3) when those pages ship, so every DER data
  record carries its program context.
