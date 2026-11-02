# der-2.3.99 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.98`

## Headline

**Aggregate Data filters now mirror DHIS2's own data-entry pickers.**
Period type + period are two coupled selects driven by DHIS2 period
codes; dataSet and dataElement are searchable pickers backed by the
local metadata mirror; the OU filter is gone because a DER edge is
pinned to one orgUnit.

## 1. R-G/aggregate-filters

**Before** — six free-text inputs: search, period, orgUnit,
dataElement UID, dataSet UID. Operators had to memorise 11-char
UIDs and remember raw DHIS2 period syntax.

**After** — the filter row is:

| Filter             | Control                              |
|--------------------|--------------------------------------|
| Search             | free text (unchanged)                |
| **Period type**    | `PeriodPicker` — Daily / Weekly / Monthly / Bi-monthly / Quarterly / Six-monthly / Six-monthly (April) / Yearly / Financial (April · July · October) |
| **Period**         | regenerated per type, 36 most-recent codes, newest first |
| **Dataset**        | `MetadataPicker resource="dataSets"` |
| **Data element**   | `MetadataPicker resource="dataElements"` |
| Workflow           | `WorkflowPicker` (unchanged)         |
| Max rows           | 50 / 100 / 200 / 500                 |

**OU filter dropped.** DER edges are pinned to a single orgUnit via
provisioning (ADR-0001), so the OU filter was always a no-op on
locally-captured rows. Removing it also removes the only field in
this screen that required the operator to know a UID — every
remaining filter is now a labelled select.

## 2. New shared pieces

- `admin-ui/src/lib/dhis2Periods.ts` — `PERIOD_TYPES` catalogue +
  `recentPeriods(type, count, now)` generator covering 11 DHIS2
  types. Formats match `org.hisp.dhis.period.*` outputs byte-for-byte
  so codes round-trip to Central without client-side massage.
  - Daily `YYYYMMDD`
  - Weekly `YYYYWww` (ISO)
  - Monthly `YYYYMM`
  - BiMonthly `YYYYMMB`
  - Quarterly `YYYYQn`
  - SixMonthly `YYYYSn`
  - SixMonthlyApril `YYYYAprilSn`
  - Yearly `YYYY`
  - FinancialApril / FinancialJuly / FinancialOct `YYYY<suffix>`
- `admin-ui/src/components/PeriodPicker.tsx` — two coupled selects.
  Changing the type clears the period code (codes are not comparable
  across types) and refills the dropdown.
- `MetadataPicker` grows three new resource options:
  **`dataElements`**, `trackedEntityTypes`, `trackedEntityAttributes`
  — all four plus the originals route through the existing
  `/api/<resource>` passthrough that the mirror sync keeps fresh.

## 3. Pull-from-Central dialog

Still takes an OU input (it pulls from a Central-side orgUnit, which
may differ from the edge's own OU for operators with multi-OU access
on Central). What changed: the dialog no longer inherits the removed
screen-level orgUnit state — it defaults to blank and the operator
picks via `MetadataPicker`.

## 4. Files changed

```
admin-ui/src/lib/dhis2Periods.ts                      — NEW
admin-ui/src/components/PeriodPicker.tsx              — NEW
admin-ui/src/components/MetadataPicker.tsx            — + 3 resources
admin-ui/src/screens/DataAggregate.tsx                — new filter row
                                                        + Pull dialog
                                                        decoupled from
                                                        removed orgUnit

VERSION / server/pom.xml / admin-ui/package.json / sw.js   — 2.3.99
```

## 5. Verified

```
cd admin-ui && npx tsc --noEmit                      ✓ clean
cd admin-ui && DER_ADMIN_UI_BASE=/admin/ npm run build
                                                     ✓ 2.3.99 bundle
cd server   && ./mvnw -DskipTests package            ✓ der-server-2.3.99.jar
java -jar target/der-server-2.3.99.jar               ✓ /system/health 200

# Metadata-mirror backs the dataElements picker:
GET /api/dataElements?fields=…&paging=false          ✓ 50 items
```

## 6. Follow-ups

- Mirror the picker/period-type pattern on Events + Tracker filter
  rows (occurred-at date range picker; event-status chip toggles).
- Edge-level "my OU" badge in the shell so the dropped OU filter is
  visibly accounted for rather than silently assumed.
- Period-code validator on the server so a malformed `?period=` is
  rejected with `PERIOD_INVALID` instead of silently returning 0
  rows.
