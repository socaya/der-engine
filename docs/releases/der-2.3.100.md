# der-2.3.100 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.99`

## Headline

**Three queued follow-ups cleared autonomously.** Events + Tracker
filter rows now mirror the Aggregate picker pattern (searchable
metadata pickers, no OrgUnit field); the AdminShell OU badge was
already in place and now visibly accounts for every removed filter;
and the server rejects malformed DHIS2 period codes with
`PERIOD_INVALID` instead of silently returning 0 rows.

## 1. R-H — picker pattern on Events + Tracker

**DataEvents filter row:**

| Filter        | Before          | After                                 |
|---------------|-----------------|---------------------------------------|
| Search        | free text       | unchanged                             |
| Program       | UID text input  | `MetadataPicker resource="programs"`  |
| Program stage | UID text input  | `MetadataPicker resource="programStages"` |
| **OrgUnit**   | UID text input  | **dropped**                           |
| Status        | select          | unchanged                             |
| Workflow      | WorkflowPicker  | unchanged                             |

**DataTracker filter row:**

| Filter        | Before          | After                                 |
|---------------|-----------------|---------------------------------------|
| Search        | free text       | unchanged                             |
| Kind          | select          | unchanged                             |
| Program       | UID text input  | `MetadataPicker resource="programs"`  |
| **OrgUnit**   | UID text input  | **dropped**                           |
| TEI UID       | text input      | unchanged (zoom via rowId)            |
| Workflow      | WorkflowPicker  | unchanged                             |

The Pull-from-Central dialogs on both screens still carry their own
OU picker — the dialog targets a Central-side OU, which may differ
from the edge's bound OU for operators with multi-OU Central access.
That picker now defaults to blank and uses `MetadataPicker` with the
`organisationUnits` resource (unchanged from previous releases).

## 2. R-I — AdminShell OU badge

Already shipped at `AdminShell.tsx:336-354` (useOrgUnit → topbar
chip, links to the binding screen). Live verified: the chip renders
"**A&A Medcare Medical Centre/Clinic**" for this edge, so operators
see at a glance which OU every unfiltered row belongs to. No code
changes required; task closed as *already satisfied*.

## 3. R-J — DHIS2 period-code validator

New `ug.ac.mak.der.util.DhisPeriodCodes.isValid(code)` with regex
patterns matching the 11 DHIS2 2.44 period families produced by the
UI's `PeriodPicker`:

```
Daily              YYYYMMDD                  e.g. 20241115
Weekly             YYYYWww (ISO)             e.g. 2024W47
Monthly            YYYYMM                    e.g. 202411
BiMonthly          YYYY0M + B                e.g. 202406B
Quarterly          YYYYQn                    e.g. 2024Q4
SixMonthly         YYYYSn                    e.g. 2024S2
SixMonthlyApril    YYYYAprilSn               e.g. 2024AprilS1
Yearly             YYYY                      e.g. 2024
FinancialApril     YYYYApril                 e.g. 2024April
FinancialJuly      YYYYJuly
FinancialOct       YYYYOct
```

`DataModuleController.aggregate()` invokes it before the SQL build.
Malformed → `HTTP 400 {code: "PERIOD_INVALID", message: ...}`.

**Tests:** `DhisPeriodCodesTest` — 22 parameterised cases covering
every family + the common hand-typed mistakes (ISO dates, invalid
month/week numbers, non-canonical month names).

## 4. Live verification

```
GET /data/aggregate?period=202411&limit=1   → HTTP 200
GET /data/aggregate?period=invalid&limit=1  → HTTP 400
                                              {code: "PERIOD_INVALID",
                                               message: "period 'invalid'
                                                is not a valid DHIS2
                                                period code"}
```

## 5. Files changed

```
server/.../util/DhisPeriodCodes.java                  — NEW
server/.../web/DataModuleController.java              — period guard
                                                        + import

admin-ui/src/screens/DataEvents.tsx                   — picker row rework
admin-ui/src/screens/DataTracker.tsx                  — picker row rework

server/.../test/util/DhisPeriodCodesTest.java         — NEW (22 cases)

VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.100
```

## 6. Verified

```
cd server && ./mvnw test \
       -Dtest='DhisPeriodCodesTest,
               ReferralPayloadEncoderTest,
               TrackerServiceTest,
               JournalPublisherTest,
               CaptureWorkflowControllerTest'       ✓ 74/74
cd admin-ui && npx tsc --noEmit                      ✓ clean
cd admin-ui && DER_ADMIN_UI_BASE=/admin/ npm run build
                                                     ✓ 2.3.100 bundle
cd server   && ./mvnw -DskipTests package            ✓ der-server-2.3.100.jar
java -jar target/der-server-2.3.100.jar              ✓ /system/health 200
                                                     ✓ period guard live
```

## 7. Follow-ups

From 2.3.98 — still queued:
- Row-level payload lineage drawer (per-row `/payload/single` endpoint
  + journal history integration).
- Workflow-run → outbound bundle manifest, closing the loop with
  `/sync/data` so admins see each operation_id a run will produce.
- Capability-flag gate: hide `programSection` binding option when
  Central's `/api/schemas` doesn't advertise it.

New:
- Occurred-at date range picker on Events / Tracker (DHIS2 date-range
  pattern — defer until operators ask).
- Mirror the period validator for occurred-at timestamps when the
  range picker lands.
