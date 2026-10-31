# der-2.3.10 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.9`

## Headline

**Workflow catalogue row-menu polish + 16-kind health sweep.**
After closing the 9-kind march with 2.3.9, this release switches
focus to operational tooling.

- Row-menu replacing the single Delete button: **Open designer**,
  **View runs**, **Enable / Disable toggle**, **Duplicate**,
  **Export JSON**, **Delete**.
- Comprehensive E2E matrix: every section kind × every parent
  binding verified end-to-end (64 combinations, 0 regressions).

## 1. 16-kind × 4-binding health sweep

E2E Playwright matrix test POSTs a workflow for each
`sectionKind × boundMetadataKind` pair, asserts the status matches
the documented compat matrix:

```
PASS: 64 / 64   FAIL: 0
```

Every section kind is accepted on the bindings the matrix allows,
rejected on the bindings it forbids. The breakable-section model
is clean end-to-end.

## 2. Row-menu actions

Replaces the single `<button data-test="cwf01-delete-${id}">` in the
catalogue table's last column with a `<RowMenu>` kebab:

| Action | Behaviour |
|---|---|
| Open designer | Link to `/workflows/${id}` |
| View runs | Link to `/workflows/runs?workflow=${id}` |
| Enable / Disable | PUT with `enabled: !enabled`; label flips based on current state |
| Duplicate | GET workflow → POST with `workflowId: undefined`, `displayName: "${name} (copy)"`, `enabled: false`, step ids stripped, dependencies dropped |
| Export JSON | GET `/workflows/${id}/export` → `Blob` → `<a download>` triggers browser download |
| Delete | Existing confirm-then-run → DELETE |

### Step ID handling on Duplicate

Reusing the original workflow's step UUIDs collides on
`capture_workflow_step_pkey`. The client strips `stepId: undefined`
from every step and drops dependencies (they'd reference now-missing
step ids). The server mints fresh UUIDs on insert.

## 3. Verified live

```
== row-menu playground ==
seeded id=6cc24f05 enabled=true version=1

== toggleEnabled: Enabled → Disabled ==
  enabled=false ✓

== toggleEnabled: Disabled → Enabled ==
  enabled=true ✓

== Duplicate ==
  POST 200 OK
  new id=1087a89e ≠ original      ✓
  name="…(copy)"                   ✓
  enabled=false                    ✓
  steps preserved: 1               ✓

== Export JSON ==
  GET /export 200 OK; schemaVersion=1; binding=DATA_SET; steps=1 ✓

== View runs ==
  endpoint reachable ✓

pageerrors: 0
```

## 4. Files changed

```
admin-ui/src/screens/EACoreScreens.tsx
  - EACaptureWorkflowList API picker extends to
    saveWorkflow / getWorkflow / exportWorkflow
  - toggleEnabled, duplicate, exportJson helpers added
  - RowMenu replaces Delete button in catalogue last column
VERSION / server/pom.xml / admin-ui/package.json / sw.js  — bumped to 2.3.10
```

Server has no changes — all the row-menu actions use existing
endpoints (`PUT /workflows/{id}`, `POST /workflows`, `GET
/workflows/{id}/export`, `GET /workflows/{id}/runs`).

## 5. Next

- **2.3.11** — Workflow-run coordinator + DHIS2 submission orchestrator.
  Captures land, compiler compiles, orchestrator pushes to DHIS2 when
  all steps are complete. The product owner's requirement:
  *"workflow MUST be able to bind with actual DHIS2 data capture
  structure so that multiple points capture and merge into the
  complete submission when ready"*. The compiler is already there
  — this release gets us the end-to-end submit path.

- **2.3.12** — Metadata resolution + validation. When a workflow binds
  to a dataset UID, server fetches the actual
  dataset/sections/dataElements from DHIS2 and validates step
  references against them.

- **2.3.13** — Form-based designer replacing the raw JSON textarea.

## Build + test

```
tsc -b && vite build                      ✓ 90 modules
./mvnw -q -DskipTests clean package       ✓ 2.3.10 JAR (no server changes)
16-kind × 4-binding sweep                  ✓ 64/64 PASS
Row-menu E2E                               ✓ toggle + duplicate + export + runs link, 0 pageerrors
WorkflowCompilerTest                       ✓ 14/14
```
