# der-2.3.58 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.57`

## Headline

**Workflow module scope cleanup — admin UI drops operator-work
surfaces; new Activity overview + Peer exchange.** The admin UI
now surfaces only what admins actually do (configure + oversee).
Operator / reviewer work surfaces (My queue, Approvals, Referrals)
drop out of the sidebar — they live on the client UI running on
each registered device.

## 1. New sidebar — three items

```
Workflows
  ├── Activity overview        (new default — /workflows)
  ├── Workflow management      (/workflows/manage)
  └── Peer exchange            (/workflows/peer-exchange)
```

Operator-work routes stay alive as `status: 'contextual'` so
bookmarks and drill-down links keep working, but they are no
longer sidebar items:

- `/workflows/queue`
- `/approvals`
- `/workflows/peers`
- `/workflows/import-inbox`
- `/workflows/runs`
- `/workflows/assignments`

Referrals move out of Workflows entirely — they are patient data
(DHIS2 Tracker relationship pattern, ADR-0027), not workflow
definitions. Relocated under **Data** nav as contextual:

- `/referral/inbox`
- `/referral/history`

## 2. New screen — Activity overview

`WorkflowActivity.tsx`. Admin-only read-only dashboard with KPI
tiles for:

- Workflows defined (count of catalogued workflows)
- Ready to capture (operator queue — READY rows across all devices)
- Blocked (BLOCKED rows waiting on a predecessor)
- Approvals pending (reviewer backlog)
- Referrals pending intake

Each tile carries a short description and a drill-down link to the
underlying operator surface. Tone colour (info / warning / neutral)
tracks whether the surface needs attention. Default landing when
the operator clicks *Workflows* in the sidebar.

## 3. New screen — Peer exchange

`WorkflowPeerExchange.tsx` merges the previously-separate *Peers*
and *Import inbox* nav items into one screen with two tabs:

- **Outbound · Peers** — register other DER edges this one pushes
  workflow definitions to.
- **Inbound · Import inbox** — accept / reject definitions pushed
  to this edge by peers.

Inner `WorkflowPeers` + `WorkflowImportInbox` grew an `embedded`
prop that suppresses their own HeroHeader when nested inside the
tab shell, so there's no double-header. Direct routes to the
components keep working.

## 4. Files changed

```
admin-ui/src/app/navigation.ts                                  — Workflows group
                                                                   reshaped (3 items,
                                                                   others contextual);
                                                                   referrals moved to Data.
admin-ui/src/screens/workflow/WorkflowActivity.tsx              (new)
admin-ui/src/screens/workflow/WorkflowPeerExchange.tsx          (new)
admin-ui/src/screens/workflow/WorkflowPeers.tsx                 — + embedded prop
admin-ui/src/screens/workflow/WorkflowImportInbox.tsx           — + embedded prop
admin-ui/src/App.tsx                                            — /workflows → Activity;
                                                                   + /manage + /peer-exchange routes
admin-ui/src/App.test.tsx                                       — new mocks + route cases
admin-ui/src/styles.css                                         — .ea-wf-activity-grid + tiles
VERSION / server/pom.xml / admin-ui/package.json / sw.js         — 2.3.58
```

## 5. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.58 bundle
cd admin-ui && npm test -- --run            243 passed (+2 for the new routes),
                                               4 pre-existing fails unchanged
cd server && mvn -q -DskipTests package     ✓ der-server-2.3.58.jar
```

## 6. Follow-ups

- Dedicated server endpoint `GET /edge-api/v1/workflows/activity/overview`
  returning the full counts bundle in one call (today the Activity
  screen fans out across four endpoints).
- Client-UI counterpart screens for the operator surfaces now
  removed from the admin sidebar (My queue, Approvals, Referrals).
- Decide whether to fold `workflow_peer` into `network_peer` so
  there's one peer registry; today they're two tables with distinct
  semantics (transport vs application).
