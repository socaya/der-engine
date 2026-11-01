# der-2.3.66 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.65`

## Headline

**Admin workspace cleanup + run-detail drill + storage donut.** The
`/admin` entry page sheds its detail-heavy panels in favour of a
clean dashboard; a new admin-side run detail screen gives the
Monitoring row drill-ins a proper destination inside the admin
surface; storage facts render as a donut.

## 1. Admin run detail drill

### Server

`GET /edge-api/v1/workflows/activity/runs/{runId}` (ADMIN).

One call returns everything an admin needs to troubleshoot one
run without visiting the operator UI:

```json
{
  "run":   { runId, workflowId, workflowName, workflowVersion,
             businessKey, state, createdAt, updatedAt, createdBy },
  "steps": [{ stepId, stepName, ordinal, ownerRole,
              ownerDeviceId, ownerDeviceName,
              state, stateAt,
              contribution: { payload, submittedAt, submittedBy,
                              submittedDeviceId, submittedDeviceName } | null,
              blockedBy:   [{ stepId, stepName }] }],
  "issues": [{ severity, message, fieldRef, detectedAt, … }],
  "conflicts": [{ category, identityKey, status, detectedAt }]
}
```

### UI

New `/workflows/monitoring/runs/{runId}` screen using the standard
`SyncStatusBar` + `Panel` + `.ea-table--dense` idiom:
- Run header with state chip + Back-to-Monitoring action.
- Steps table (state chip per step, waiting-on list for blocked ones).
- Contributions cards per contributed step with pretty-printed
  payload.
- Issues table (if any) scoped to this run.
- Conflicts table (if any) scoped to this run.

Monitoring row business-keys + the Issues "Message" cell are now
`<Link>`s to this screen — admins drill into the specific run
rather than the workflow definition.

## 2. Workspace dashboard — cleaner, module-first

Dropped from the `/admin` landing page:

- **System components** list (duplicates `/system/information`).
- **Recent activity** list (duplicates `/audit/events`).
- **Resource usage rings** (lives in `/monitoring`).
- **Synchronisation activity** 24-hour mini-bar (lives in `/sync`).
- **Conflict review** priority breakdown (lives in `/journal/conflicts`).

Kept at this level:
- **Hero** — welcome + status chip + build version + reliability % +
  attention chip (count of pending conflicts linking to the module).
- **5 KPI tiles** — DER / DHIS2 / DB / Sync / Devices.
- **Topology** — DHIS2 → DER → Clients (visual, single-row Panel).
- **Devices**, **Workflows**, **Storage** three-up tiles.

## 3. Storage facts → donut chart

Replaces the three-row facts list with a `Donut` component (new
shared helper) showing a four-slice breakdown of the storage
volume:

- **DER files** (`storage.derDataRootBytes`)
- **PostgreSQL (der.*)** (`storage.derDbSchemaBytes`)
- **Other on volume** (`totalBytes − files − db − free`)
- **Free** (`storage.usableBytes`)

Centre caption shows the DER footprint sum. Legend lists each slice
with its byte count.

## 4. Files changed

```
server/src/main/java/.../web/WorkflowActivityController.java   — +runDetail endpoint
admin-ui/src/api/edgeApi.ts                                     — AdminRunDetail types
                                                                   + getAdminRunDetail()
admin-ui/src/screens/workflow/WorkflowRunDetail.tsx            (new)
admin-ui/src/screens/workflow/WorkflowMonitoring.tsx           — business-key + message
                                                                   cells link into
                                                                   /workflows/monitoring/runs/{runId}
admin-ui/src/App.tsx                                            — + run-detail route
admin-ui/src/screens/shared.tsx                                — + Donut component
admin-ui/src/screens/Workspace.tsx                             — dropped 5 panels,
                                                                   added storage Donut,
                                                                   hero gains reliability %
                                                                   + conflicts chip
admin-ui/src/styles.css                                         — .ea-donut* + run-detail
                                                                   contrib styles
VERSION / server/pom.xml / admin-ui/package.json / sw.js        — 2.3.66
```

## 5. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.66 bundle
cd server   && mvn -q -DskipTests package   ✓ der-server-2.3.66.jar
```

## 6. Follow-ups

- Keyboard navigation on the inner-sidebar Monitoring rail.
- Section-local refresh (per-panel re-fetch) on Monitoring.
- Expand the Topology panel into a mini-dashboard with mesh links
  once the Phase 05 network data is wired.
