# EA-19..36 → Server-Module alignment

> **Scope.** Companion to `docs/ui/EA-01-18-alignment.md`. Maps each
> EA-19..EA-36 design spec to the admin-ui component that implements
> it, the sidebar nav group it sits under, and the verified server
> endpoint(s) the component calls via `edgeApi.*`. Written after the
> alignment audit on gate-PASS commit `0dfc486`.
>
> **Finding.** All eighteen EA-NN specs resolve to a landed admin-ui
> component wired to a real Spring `@RestController` endpoint. The one
> screen the first-pass audit flagged as a gap (**EA-24 Resolution
> history**) is actually covered cross-module through the generic
> audit-events feed at `/audit/trail` — every call to
> `POST /journal/conflicts/{id}/resolve` emits an audit event which
> `MockupSecurityAuditTrail` renders. No dedicated screen is required
> because the design spec's "trail of resolutions" is the audit trail.

## EA-19..36 traceability table

| ID | Spec title | Admin-ui component | Canonical route | Server endpoint(s) | Nav group |
|---|---|---|---|---|---|
| EA-19 | Checkpoints | `MockupConflictList` | `/sync/attention` | `/edge-api/v1/journal/conflicts` · `/edge-api/v1/journal/conflicts/:id/resolve` | Synchronisation |
| EA-20 | Conflict queue | `MockupConflictList` | `/sync/attention` | `/edge-api/v1/journal/conflicts` · `/edge-api/v1/journal/conflicts/:id/resolve` | Synchronisation |
| EA-21 | Conflict details | `MockupConflictDetail` | `/sync/attention/:operationId` | `/edge-api/v1/journal/conflicts/:id/central-response` · `/edge-api/v1/journal/conflicts/:id/resolve` | Synchronisation |
| EA-22 | Version comparison | `SnapshotDiff` | `/metadata/snapshots/:a/diff/:b` | `/edge-api/v1/metadata/snapshots/diff` · `/edge-api/v1/metadata/snapshots/counters/diff` | DHIS2 |
| EA-23 | Resolution | `MockupConflictDetail` | `/sync/attention/:operationId` | `/edge-api/v1/journal/conflicts/:id/central-response` · `/edge-api/v1/journal/conflicts/:id/resolve` | Synchronisation |
| EA-24 | Resolution history | `MockupSecurityAuditTrail` (filtered on resolve-events) | `/audit/trail` | `/edge-api/v1/security/audit/events` · `/edge-api/v1/security/audit/events/export.csv` · `/edge-api/v1/security/audit/verify` | Security & Audit |
| EA-25 | Metadata versions | `SnapshotList` | `/metadata/snapshots` | `/edge-api/v1/metadata/snapshots` · `/edge-api/v1/metadata/snapshots/:id/retire` · `/edge-api/v1/metadata/snapshots/:id/reinstate` | DHIS2 |
| EA-26 | Metadata drift | `MockupDriftInspector` | `/dhis2/metadata-drift` | `/edge-api/v1/dhis2/metadata/drift` · `/edge-api/v1/dhis2/compat/refresh` | DHIS2 |
| EA-27 | Edge users | `MockupUsersDashboard` | `/provisioning/users` | `/edge-api/v1/provisioning/users` · `/edge-api/v1/provisioning/users/dhis2-mapping` | Administration |
| EA-28 | Permission policies | `CapAuthorities` | `/access/authorities` | `/edge-api/v1/authorities` · `/edge-api/v1/roles` | Administration |
| EA-29 | Audit trail | `MockupSecurityAuditTrail` | `/audit/trail` | `/edge-api/v1/security/audit/events` · `/edge-api/v1/security/audit/verify` | Security & Audit |
| EA-30 | Backup catalogue | `MockupBackupList` | `/backup` | `/edge-api/v1/backups` · `/edge-api/v1/backups/verify/status` · `/edge-api/v1/backups/verify/history` · `/edge-api/v1/backups/pitr/wal` · `/edge-api/v1/system/settings` | Security & Audit |
| EA-31 | Restore | `MockupRestoreList` | `/restore` | `/edge-api/v1/restores` · `/edge-api/v1/restores/upload` · `/edge-api/v1/restores/request` | Security & Audit |
| EA-32 | Failure diagnostics | `EADiagnostics` | `/diagnostics` | `/edge-api/v1/system/diagnostics` | System |
| EA-33 | Metrics | `CapOperatorMetrics` | `/monitoring/metrics` | `/edge-api/v1/system/info` · `/edge-api/v1/jobs` | System |
| EA-34 | Test scenarios | `EACaptureWorkflowList` | `/workflows/manage` | `/edge-api/v1/workflows` · `/edge-api/v1/workflows/:id/runs` · `/edge-api/v1/workflows/:id` · `/edge-api/v1/workflows/:id/export` | Workflows |
| EA-35 | Test results | `WorkflowMonitoring` | `/workflows/monitoring` | `/edge-api/v1/workflows/queue` · `/edge-api/v1/devices` · `/edge-api/v1/workflows/activity-summary` · `/edge-api/v1/workflows/drafts` | Workflows |
| EA-36 | Settings | `EASettings` | `/settings` | `/edge-api/v1/system/settings` | Settings |

## Verification method

Same as EA-01..18 audit:

1. Component source: `grep -nE '^export (function|const) <name>'` in `admin-ui/src/screens/`.
2. Edge API calls: `grep -h 'edgeApi\.' <file>` — every EA-NN component has at least one.
3. Server endpoint existence: `grep -rn '<path>' server/src/main/java/ug/ac/mak/der/web/` — each path maps to a Spring `@GetMapping` / `@PostMapping`.
4. Nav-group membership: `grep -n '<route>' admin-ui/src/app/navigation.ts`.

## Cross-module coverage of EA-24

The spec for EA-24 reads "resolution history: a chronological list of
previously resolved conflicts and the actors who resolved them." In
the current DER architecture, every mutation on
`/journal/conflicts/{id}/resolve` is logged by the `AuditEventWriter`
and surfaces through `/edge-api/v1/security/audit/events`. The audit
feed is the canonical resolution history; there is no need to duplicate
it under `/sync/attention/history` because:

- The audit-events feed is role-gated (`der.audit.read`) and already in
  the Security & Audit nav group.
- A dedicated "resolution history" view would be a filtered subset of
  the same data stream, and the audit UI already supports `eventType=`
  filtering so operators can narrow to resolve events.

This cross-module placement is intentional (ADR-0017 Audit-first
design) and is recorded here so the EA-24 spec is traceable even
though it does not get its own `/sync/attention/history` route.

## Combined summary (EA-01..36)

- 36 screen specs, 35 implemented via a direct component, 1 implemented
  cross-module through the shared audit feed.
- Zero code changes required from this audit.
- Admin-ui alignment to the six DER Server Modules (DHIS2 ·
  Synchronisation · Network · Workflows · Data · Administration — plus
  the four admin-only groups System · Security & Audit · Settings ·
  Overview) is complete.
