# der-2.3.26 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.25`

## Headline

**Six follow-ups land together.** Each extends work shipped earlier
this week; bundling them keeps the schema stable at V059 and lets
one end-to-end run exercise the whole lot.

| # | Scope |
|---|---|
| 1 | Pin-aware metadata resolution + stale-pin drift warning |
| 2 | Snapshot pair-wise diff endpoint + live-tagged counts |
| 3 | `HIDEFIELD`, `ASSIGN`, `CREATEEVENT` action handlers |
| 4 | `d2:condition(…)` ternary + richer `d2:count(…)` |
| 5 | Role matrix UI gains a Device column + Edit link |
| 6 | `d2:lastEventDate(…)` + `d2:minutesBetween(…)` |

## 1. Pin-aware metadata resolution

`ProgramRuleEvaluator.evaluate()` now consults the workflow's
`pinned_snapshot_id` (2.3.25) before falling back to the live mirror:

```
rules = pinnedSnapshotId == null
      ? mirror.findRulesByProgram(programUid)
      : mirror.findRulesByProgramInSnapshot(programUid, pinnedSnapshotId)
if rules.isEmpty() && pinnedSnapshotId != null:
    issues.add(PINNED_SNAPSHOT_DRIFT, WARNING)
    rules = mirror.findRulesByProgram(programUid)   // fallback
```

The mirror's upsert-overwrite semantics mean a pin becomes "stale"
once a later sync overwrites the row's `snapshot_id`. The evaluator
degrades gracefully — operators see a WARNING on the run so they
know results came from the live mirror instead of the pin.

`loadRuleVariableAliases` applies the same prefer-pin-then-fallback.

Added `ExtendedMirrorRepository.findRulesByProgramInSnapshot(programUid,
snapshotId)`.

## 2. Snapshot pair-wise diff

```
GET /edge-api/v1/metadata/snapshots/{a}/diff/{b}
→ 200
{
  "a": { … snapshot a counters … },
  "b": { … snapshot b counters … },
  "deltas": {
    "organisationUnits": { "a": 484, "b": 484, "delta": 0 },
    "dataElements":      { "a": 358, "b": 360, "delta":  2 },
    ...
  },
  "liveTaggedCounts": {
    "a": { "programRules": 0, "dataElements": 0, … },
    "b": { "programRules": 388, "dataElements": 358, … }
  }
}
```

`deltas` is the simple counter diff from `metadata_snapshot`.
`liveTaggedCounts` shows how many rows presently carry each snapshot
id — these drift to zero as later syncs overwrite, giving operators a
proxy for "how much of this snapshot's data still exists".

Full per-UID row-level diff needs row-versioning in the mirror
schema; captured as a follow-up.

## 3. HIDEFIELD / ASSIGN / CREATEEVENT

`ProgramRuleEvaluator.toIssue()` now handles three new DHIS2 action
types, each emitting a validation issue the client can consume:

| Action | Issue code | Severity | Message |
|---|---|---|---|
| `HIDEFIELD`, `HIDESECTION` | `PROGRAM_RULE_HIDEFIELD` / `PROGRAM_RULE_HIDESECTION` | INFO | `Field '<uid>' should be hidden (…)` |
| `ASSIGN` (no conflict) | `PROGRAM_RULE_ASSIGN` | INFO | `Rule '<name>' suggests value '<v>' for '<uid>'.` |
| `ASSIGN` (operator already captured a different value) | `PROGRAM_RULE_ASSIGN` | WARNING | `… but a different value ('<cur>') is already captured.` |
| `CREATEEVENT` | `PROGRAM_RULE_CREATEEVENT` | INFO | `Rule '<name>' asks for a follow-up event to be created.` |

None gate completion — they are advisories the client UI uses to
hide inputs, pre-fill values, or schedule follow-ups.

## 4. `d2:condition` + richer `d2:count`

```
d2:condition(<cond-string>, <trueV>, <falseV>)
    → eval(cond) ? trueV : falseV

d2:count(#{var})
    → "1" if the payload has a non-blank value for #{var}, else "0"
```

The condition arg is a quoted DHIS2 expression; `splitArgs` already
respects quotes + parens, so nested `d2:condition(..., d2:left(..),
d2:right(..))` parses cleanly. Verified against a synthetic rule:

```
cond = d2:condition('#{age} > 18', 'adult', 'minor') == 'adult'
age = 42 → SHOWERROR fires
age = 10 → rule inert
```

## 5. Role matrix — Device column + Edit

`/admin/workflows/assignments` grew two columns:
- **Device** — the step's `ownerDeviceId` short-form, or "any" when
  shared pool.
- **Edit** — one-click link to the workflow wizard at
  `/admin/workflows/{id}` for inline role / device changes.

Admins see the whole facility's assignment matrix at a glance and
jump straight into the editor without hunting through the catalogue.

## 6. `d2:lastEventDate` + `d2:minutesBetween`

```
d2:minutesBetween(a, b)   // accepts dates or ISO instants
d2:lastEventDate(#{var})  // date of the most recent contribution
                          // whose payload carried var's UID
```

For `d2:lastEventDate` the evaluator extracts a per-UID "most-recent
contribution timestamp" table alongside the merged value map and
exposes it via a thread-local so the function layer can resolve
without threading an extra context record through every helper.

Verified:

```
contribute dataElement=FIELD_T, submittedAt=today
rule: d2:lastEventDate(#{trigger}) == V{current_date}
→ fires ✓
```

## 7. Verified end-to-end

One synthetic metadata seed + six scenarios in a single run:

```
§2.3.27 snapshot diff #45 → #46          ✓ 5 counter deltas + live-tagged counts
§2.3.26 pin to older + contribute        ✓ PINNED_SNAPSHOT_DRIFT (WARNING)
                                            + PROGRAM_RULE_SHOWERROR
                                            (fallback resolved live rules)
§2.3.28 HIDEFIELD / ASSIGN / CREATEEVENT ✓ three INFO issues
§2.3.29 d2:condition age=42 → 'adult'    ✓ "Patient is an adult" SHOWERROR fired
§2.3.30 /workflows/assignments           ✓ Device column rendered
§2.3.31 d2:lastEventDate matches today   ✓ SHOWERROR fired
pageerrors                                ✓ 0
```

## 8. Files changed

```
server/.../metadata/ExtendedMirrorRepository.java        — findRulesByProgramInSnapshot()
server/.../workflow/ProgramRuleEvaluator.java            — WorkflowPinningService ctor arg,
                                                           pin-aware evaluate(),
                                                           HIDEFIELD/ASSIGN/CREATEEVENT handlers,
                                                           d2:condition, d2:count,
                                                           d2:lastEventDate, d2:minutesBetween,
                                                           extractLastSeen + ThreadLocal
server/.../web/MetadataSnapshotController.java           — + GET /{a}/diff/{b}
admin-ui/src/screens/CapabilityScreens.tsx               — role matrix Device column + Edit
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.26
```

## 9. Follow-ups

- Row-versioning in the mirror schema so per-UID snapshot diffs
  (added / removed / changed by UID) become possible.
- Client-side surface for `HIDEFIELD` / `HIDESECTION` / `ASSIGN`
  issue codes — the capture screens need to listen on the run
  validation stream and translate them to field-level UI actions.
- Device-aware queue scoping without `?deviceId=` — the server
  auto-scopes when the principal carries a device identity.

## 10. Build + test

```
mvn test -Dtest=CaptureWorkflowControllerTest          ✓ 20/20
mvn -q -DskipTests package                             ✓ 2.3.26 JAR
End-to-end 6-item sweep                                ✓ zero pageerrors
```
