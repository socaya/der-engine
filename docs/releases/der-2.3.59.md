# der-2.3.59 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.58`

## Headline

**Workflow module scope ADR — transport-agnostic.** Peer-definition
sharing moves out of Workflows (it's a fleet-admin concern, not
workflow-operational) and lands next to the WireGuard peers list
under Network. In its place, a new **Workflow monitoring** screen
answers *where is work pooling up / who's falling behind / which
service points are under pressure*.

## 1. Workflows is transport-agnostic (ADR)

Workflows coordinate capture across devices, regardless of how those
devices are connected (wifi, LAN, WireGuard peer). The admin should
not see peer-definition sharing as a Workflow sub-item — it's an
administrative decision about *which edges to trust*, independent
of the workflow runtime.

- `/workflows/peer-exchange` dropped from the Workflows sidebar
  (route kept alive as `status: 'contextual'` for bookmarks).
- Same screen now also mounted at **`/network/workflow-sharing`** —
  this is the canonical path going forward. Added to the Network
  nav group next to Peers.

## 2. Workflows sidebar — now three items

```
Workflows
  ├── Activity overview        (/workflows)
  ├── Workflow management      (/workflows/manage)
  └── Monitoring               (/workflows/monitoring)       NEW
```

## 3. Workflow monitoring (new screen)

`WorkflowMonitoring.tsx` — admin read-only dashboard matching the
standard DER idiom (`SyncStatusBar` + `Panel` + `.ea-table--dense`).

- Status-bar tone roll-up:
    * danger  — any ready step stuck > 24 h
    * warning — > 20 ready items waiting
    * info    — items ready to capture
    * muted   — only blocked items
    * success — all clear
- Subtitle facts: Ready / Blocked / Workflows / Devices / Updated.
- Panel **By workflow** — depth per workflow × readiness + oldest
  ready step + age.
- Panel **By owner device** — depth per device + oldest ready step
  + inline *stuck* chip when age > 24 h.
- Panel **Service-point pressure** — top 12 steps by pending volume
  with workflow link.

Uses only the existing `/edge-api/v1/workflows/queue` endpoint;
richer latency telemetry (percentile wait-times, prefetch readiness,
auto-prepare for next service point) is a follow-up and needs a
server-side step-transition record (TBD migration + endpoint).

## 4. Files changed

```
admin-ui/src/app/navigation.ts                             — workflows group: + Monitoring,
                                                              peer-exchange → contextual;
                                                              network group: + workflow-sharing
admin-ui/src/App.tsx                                       — + /workflows/monitoring,
                                                              + /network/workflow-sharing
admin-ui/src/App.test.tsx                                  — + mock + route cases
admin-ui/src/screens/workflow/WorkflowMonitoring.tsx       (new)
VERSION / server/pom.xml / admin-ui/package.json / sw.js   — 2.3.59
```

## 5. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.59 bundle
cd admin-ui && npm test -- --run            245 passed (+2 for the new routes),
                                               4 pre-existing fails unchanged
cd server && mvn -q -DskipTests package     ✓ der-server-2.3.59.jar
```

## 6. Follow-ups

- Server-side step-transition record (migration V067) + endpoint
  `GET /edge-api/v1/workflows/metrics` for percentile wait-times.
- Prefetch coordination: SSE push to downstream device devices when
  a predecessor completes, with a *prefetched_at* client-side ack
  so the admin can see which devices are warm.
- Auto-prepare lists for the next service point once prefetch is
  wired.
- Decide whether `workflow_peer` and `network_peer` should unify
  into a single `edge_peer` table now that both surface alongside
  each other.
