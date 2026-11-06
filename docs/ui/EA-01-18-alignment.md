# EA-01..18 → Server-Module alignment

> **Scope.** This document records the traceability between the EA-01..18
> design specs under `docs/ui/screens/EA-NN.md`, the admin-ui component
> that currently implements each spec, the sidebar nav group it sits
> under (per `admin-ui/src/app/navigation.ts`), and the verified server
> endpoints the component calls. Written after the alignment audit on
> commit `f05267c`.
>
> **Finding.** All eighteen EA-NN specs map to a landed admin-ui
> component that calls a real server endpoint. No gap requires a code
> change. The historical `/X-legacy` routes referenced by the stale
> Phase-06 plan still exist for legacy-import compatibility but are not
> wired into the sidebar; the canonical routes listed below are the
> ones the sidebar + Section Tabs expose.
>
> **Naming note.** Production admin-ui components use the `Mockup*` /
> `Cap*` prefixes for historical reasons. These are **not** mock-only
> screens — every one calls `edgeApi.*` which forwards to a Spring
> `@RestController` on the DER server. The prefixes predate the
> alignment and are being retained to avoid cross-import churn.

## Server-Module nav groups

Six DER Server Modules the device client Launcher is grouped by —
`client/src/screens/Launcher.tsx` since commit `f05267c`:

- DHIS2 · Synchronisation · Network · Workflows · Data · Administration

The admin-ui sidebar exposes the same six modules plus System, Security
& Audit, and Settings (ten groups total per
`admin-ui/src/app/navigation.ts`). Every EA-NN below lives inside one
of them.

## EA-01..18 traceability table

| ID | Spec title | Admin-ui component | Canonical route | Server endpoint(s) | Nav group |
|---|---|---|---|---|---|
| EA-01 | Setup welcome | `MockupWorkspace` | `/` | `/edge-api/v1/system/health` · `/edge-api/v1/compat` · `/edge-api/v1/system/info` | Overview |
| EA-02 | Edge identity | `CapSystemInformation` | `/system/information` | `/edge-api/v1/system/info` | Overview (contextual) |
| EA-03 | Central endpoint | `MockupDhis2Overview` + `CapCentralConnection` | `/dhis2` · `/dhis2/connection` | `/edge-api/v1/admin/dhis2-connection` · `/edge-api/v1/compat` · `/edge-api/v1/compat/refresh` | DHIS2 |
| EA-04 | Organisation scope | `CapOrgUnitBinding` | `/dhis2/organisation-unit` | `/edge-api/v1/orgunit-binding` · `/edge-api/v1/orgunits` · `/edge-api/v1/orgunits/levels` · `/edge-api/v1/orgunits/groups` | DHIS2 |
| EA-05 | Metadata bootstrap | `CapMetadataSync` + `MockupMetadata` | `/dhis2/metadata-sync` · `/dhis2/metadata` | `/edge-api/v1/sync/metadata` · `/edge-api/v1/sync/jobs` · `/edge-api/v1/system/info` | DHIS2 |
| EA-06 | Provisioning validation | `MockupUsersDashboard` | `/provisioning/users` | `/edge-api/v1/provisioning/users` | Administration |
| EA-07 | Activation | `MockupDhis2Overview` (same flow as EA-03) | `/dhis2` | `/edge-api/v1/admin/dhis2-connection` · `/edge-api/v1/compat/refresh` | DHIS2 |
| EA-08 | Overview | `MockupDashboard` | `/overview-legacy` (promoted to `/` via `MockupWorkspace`) | `/edge-api/v1/system/health` · `/edge-api/v1/sync/jobs` · `/edge-api/v1/journal/stats` · `/edge-api/v1/compat` | Overview |
| EA-09 | Service health | `CapServiceHealth` + `MockupSystemOverview` | `/system/overview` · `/overview-legacy` | `/edge-api/v1/system/health` · `/edge-api/v1/system/info` | System |
| EA-10 | Connectivity | `NetworkOverview` | `/network` | `/edge-api/v1/network/status` · `/edge-api/v1/network/interfaces` · `/edge-api/v1/network/access-point` · `/edge-api/v1/network/clients` | Network |
| EA-11 | Storage | `CapStorage` | `/monitoring/storage` | `/edge-api/v1/system/info` (storage block) | System |
| EA-12 | Deployment details | `CapSystemInformation` | `/system/information` | `/edge-api/v1/system/info` | Overview (contextual) |
| EA-13 | Sync overview | `MockupSyncOverview` | `/sync` | `/edge-api/v1/journal/worker` · `/edge-api/v1/sync/jobs` · `/edge-api/v1/journal/stats` · `/edge-api/v1/system/info` | Synchronisation |
| EA-14 | Pending operations | `MockupConflictList` | `/sync/attention` | `/edge-api/v1/journal/conflicts` · `/edge-api/v1/admin/ops/journal/*` | Synchronisation |
| EA-15 | Operation details | `MockupConflictDetail` | `/sync/attention/:operationId` | `/edge-api/v1/journal/operations/:id` · `/edge-api/v1/admin/ops/journal/:id/*` | Synchronisation |
| EA-16 | Exchange history | `MockupSyncHistory` | `/sync/history` | `/edge-api/v1/sync/jobs?limit=N` · `/edge-api/v1/journal/operations` · `/edge-api/v1/sync/metadata/diagnostics` | Synchronisation |
| EA-17 | Import responses | `MockupConflictDetail` (import-summary section) | `/sync/attention/:operationId` | `/edge-api/v1/journal/operations/:id` | Synchronisation |
| EA-18 | Retry controls | `MockupConflictDetail` (retry actions) | `/sync/attention/:operationId` | `/edge-api/v1/admin/ops/journal/:id/retry` · `/edge-api/v1/admin/ops/journal/retry-run` · `/edge-api/v1/admin/ops/journal/retry-batch` | Synchronisation |

## Verification method

1. Component source: `grep -nE '^export (function|const) <name>'` in `admin-ui/src/screens/`.
2. Edge API calls: `grep -h 'edgeApi\.' <file>` — every EA-NN component has at least one.
3. Server endpoint existence: `grep -rn '<path>' server/src/main/java/ug/ac/mak/der/web/` — each path maps to a Spring `@GetMapping` / `@PostMapping`.
4. Nav-group membership: `grep -n '<route>' admin-ui/src/app/navigation.ts`.

## Legacy routes retained (non-blocking)

`/*-legacy` routes under `/setup-welcome-legacy`, `/overview-legacy`,
`/sync/jobs-legacy`, `/sync/drift-legacy`, `/journal/conflicts-legacy`,
`/journal/worker-legacy`, `/compat-legacy`, etc. are kept so direct
URLs saved by earlier pilot sessions do not 404. They are not in the
sidebar; the canonical routes above are.
