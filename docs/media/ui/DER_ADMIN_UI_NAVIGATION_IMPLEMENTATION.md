# DER Admin UI — Navigation Architecture and Implementation Specification

**Document:** `docs/ui/DER_ADMIN_UI_NAVIGATION_IMPLEMENTATION.md`  
**Product:** DER — DHIS2 Edge Runtime  
**Target repository:** `https://github.com/socaya/der-engine`  
**Inspected baseline:** `main` at `62de73f7d9c17297b5215bd5731f6c6bfb82d157` (re-audit HEAD before changes)  
**Scope:** `admin-ui/`, integration with existing `server/`, and relevant `docs/ui/`; **do not redesign `client/` into an administrator application**.  
**Status:** Implementation instructions, not a statement of completed features.

## 0. Binding instructions to Claude Code

1. Start with a fresh `git status`, HEAD revision, current DER version (`VERSION`, Maven, frontend manifests), and existing tests. Read this specification in full.
2. Inspect actual routes, screen exports, APIs, server controllers, role enforcement, and requirements documents before coding. Treat the route inventory below as a *verified baseline at the inspected commit*, not proof of what is currently deployed.
3. Preserve the approved **DER / DHIS2 Edge Runtime** logo asset exactly. Locate the image in the repository or request the approved asset if absent. Do not generate a replacement, approximate it with CSS, recolour or distort it. Use the existing brand navy, teal, blue-grey and subdued neutral palette, without gradients or bright decorative cards.
4. Preserve all existing functionality and deep links. Never erase a working screen merely to replace it with a visual placeholder. Every new UI action must have real authorised API behaviour or be explicitly disabled with an honest explanation.
5. DER is configured for **one organisation unit per edge server**. Do not expose a multi-OU synchronisation selector. Display the actual bound OU consistently. See critical design conflict in §4.
6. Work sequentially through phases; do not advance while the phase gate fails. Record exact tests, results, deviations and relevant source files. No fabricated test outputs or completion percentages.
7. Do not add AI- or Claude-specific files to production source. This specification can live under `docs/ui/` as ordinary engineering documentation. Maintain appropriate academic attribution/disclosure requirements; do not misrepresent authorship.
8. Do not assume the app is production ready because React routes, test files or documentation exist. Verify actual end-to-end server integration.

## 1. Observed code and current state

The following is grounded in repository inspection at the baseline commit:

- `admin-ui/src/App.tsx` defines a flat header navigation and protected React Router routes, using `AuthProvider` and `RequireAuth`.
- `admin-ui/src/screens/EACoreScreens.tsx` provides components including `EASetupWelcome`, `EAUsersList`, `EAUserCreate`, `EACompatInspector`, `EACompatHistory`, `EAJobsList`, `EAJobTrigger`, `EADriftInspector`, `EAConflictList`, `EAConflictResolve`, `EAWorkerHealth`, `EAMetadataOverview`, `EAApprovalQueue`, `EACaptureWorkflowList`, `EACaptureWorkflowDesigner`, `EADeviceFleet`, `EAFacilityAnalytics`, `EAAuditVerify`, and `EAReferralInbox`.
- `admin-ui/src/screens/EARemainderScreens.tsx` includes `EARecoveryTools`, `EABackupList`, `EARestoreList`, `EAEvaluationReports`, `EAAppsList`, `EADiagnostics`, `EASettings`. **The source explicitly describes backup and restore screen limitations in an earlier development phase**; verify current implementation before declaring fully working.
- Server controller families exist for `OrgUnitBinding`, `SyncJobs`, `SyncStatus`, `MetadataSync`, `Drift`, `ConflictReview`, `JournalWorker`, `CaptureWorkflow`, `Approval`, `ReferralInbox`, `Device`, `Analytics`, `Backup`, `Restore`, `SecurityAudit`, `OperationsAdmin`, `OperatorMetrics`, `Dhis2Compatibility`, `System`, `Provisioning`, `Apps`, and others. Controller existence alone does not establish route functionality.
- `client/src/App.tsx` separately handles aggregate, event and Tracker end-user workflows. Maintain separate operational and administrative navigation.
- `docs/implementation_status.md` reports 54 UI screens accounted for (37 dedicated / 17 sibling states) and 160/211 requirements done, 51 partial, at the document's recorded baseline. **Do not treat these self-reported numbers as independently tested results**.
- `docs/architecture/decisions/0015-edge-orgunit-binding.md` describes a *subtree* binding, whereas the user-selected DER product rule is **one OU only**. This is an unresolved specification conflict requiring formal resolution and backend tests before exposing new OU controls.

### Existing React paths: preserve or redirect, never silently break

| Existing route | Current screen | New menu placement |
|---|---|---|
| `/` | `EASetupWelcome` | Setup / provisioning (introduce dashboard separately) |
| `/provisioning/users` | `EAUsersList` | Users & Access → Users |
| `/provisioning/users/new` | `EAUserCreate` | Users & Access → Add user (contextual action) |
| `/compat` | `EACompatInspector` | DHIS2 Integration → Compatibility |
| `/compat/history` | `EACompatHistory` | DHIS2 Integration → Compatibility history |
| `/sync/jobs` | `EAJobsList` | Synchronisation → Jobs |
| `/sync/jobs/trigger` | `EAJobTrigger` | Synchronisation → Trigger job (contextual action) |
| `/sync/drift` | `EADriftInspector` | DHIS2 Integration → Drift |
| `/journal/conflicts` | `EAConflictList` | Synchronisation → Conflicts |
| `/conflicts/:id` | `EAConflictResolve` | Conflict detail drawer/page |
| `/journal/worker` | `EAWorkerHealth` | Synchronisation → Worker health |
| `/approvals` | `EAApprovalQueue` | Workflows & Approvals → Approvals |
| `/workflows` | `EACaptureWorkflowList` | Workflows & Approvals → Workflows |
| `/workflows/:id` | `EACaptureWorkflowDesigner` | Workflow designer detail |
| `/devices` | `EADeviceFleet` | Devices & Clients → Device fleet |
| `/analytics` | `EAFacilityAnalytics` | Monitoring → Facility analytics |
| `/audit/verify` | `EAAuditVerify` | Security & Recovery → Audit verification |
| `/referral/inbox` | `EAReferralInbox` | Workflows & Approvals → Referral inbox |
| `/metadata` | `EAMetadataOverview` | DHIS2 Integration → Metadata mirror |
| `/recovery` | `EARecoveryTools` | Security & Recovery → Recovery tools |
| `/backup` | `EABackupList` | Security & Recovery → Backups |
| `/restore` | `EARestoreList` | Security & Recovery → Restore |
| `/evaluation` | `EAEvaluationReports` | Monitoring → Evaluation |
| `/apps` | `EAAppsList` | Settings → Installed apps |
| `/diagnostics` | `EADiagnostics` | Monitoring → Diagnostics |
| `/settings` | `EASettings` | Settings → General |

## 2. Navigation information architecture

Use **10 navigation groups** in a fixed shell. Default to collapsed groups where needed, maintain expanded state, and surface only authorised links. Distinguish **existing route** `[E]` from **new screen or route required** `[N]`. A proposed route is **not an existing backend API endpoint**.

### 2.1 Workspace
- Dashboard — `/dashboard` [N]: operational overview based on actual service readings; no invented metrics.
- System overview — `/system/overview` [N]: DER, local DHIS2, PostgreSQL, sync and client readiness.
- System information — `/system/information` [N]: version, build, compatibility, status, modules; segregate public and privileged diagnostics.

### 2.2 DHIS2 Integration
- Central connection — `/integration/connection` [N]: reachability, authentication validity and verified DHIS2 version.
- Organisation unit binding — `/integration/organisation-unit` [N]: current bound OU, central UID, status, governance; rebind only under restricted and audited procedure.
- Compatibility inspector — `/compat` [E].
- Compatibility history — `/compat/history` [E].
- Metadata mirror — `/metadata` [E].
- Metadata drift — `/sync/drift` [E].
- Program-rule compatibility — `/integration/program-rules` [N; only if server contract verified].

### 2.3 Synchronisation
- Sync overview — `/sync` [N]: connectivity, inbound/outbound status, queue and unresolved outcomes.
- Sync jobs — `/sync/jobs` [E].
- Trigger job — `/sync/jobs/trigger` [E; action/detail; do not require permanent sidebar item].
- Sync history — `/sync/history` [N]: runs, filters, detail, retry evidence.
- Data queues — `/sync/queues` [N]: outgoing and incoming (if implemented), pending/uncertain/rejected status.
- Conflicts — `/journal/conflicts` [E]; resolution route `/conflicts/:id` [E].
- Worker health — `/journal/worker` [E].
- Metadata sync — `/sync/metadata` [N; distinct from metadata browser].
- Data exchange — `/sync/data` [N; aggregated data-value, event, Tracker and eligible central pull status].
- Sync schedule — `/sync/schedule` [N; only show controls actually supported].

### 2.4 Workflows & Approvals
- Workflows — `/workflows` [E]; designer `/workflows/:id` [E].
- Runs and execution — `/workflows/runs` [N].
- Step assignments / device responsibilities — `/workflows/assignments` [N].
- Approval queue — `/approvals` [E].
- Referral inbox — `/referral/inbox` [E].
- Referral history — `/referral/history` [N; contingent on server support].

### 2.5 Local Data
- Data overview — `/data` [N]: locally available data by type and status, no unrestricted bulk export.
- Aggregate — `/data/aggregate` [N; admin inspection only].
- Events — `/data/events` [N; admin inspection only].
- Tracker — `/data/tracker` [N; admin inspection only].
- Draft and pending workflow data — `/data/drafts` [N; if server support exists].
- Data retention and maintenance — `/data/maintenance` [N; guarded destructive operations].

### 2.6 Users & Access
- Users — `/provisioning/users` [E].
- Add user — `/provisioning/users/new` [E; prominent action on Users, not necessarily sidebar].
- Central DHIS2 user mapping — `/access/mappings` [N].
- Roles and permissions — `/access/roles` [N].
- User sessions — `/access/sessions` [N].
- MFA and credentials — `/access/credentials` [N; privileged, never show PAT/password values].

### 2.7 Devices & Clients
- Device fleet — `/devices` [E].
- Device enrolment — `/devices/enrolment` [N].
- Ownership and workflow device assignments — `/devices/ownership` [N].
- Active client connections — `/devices/connections` [N; only if observed].
- Device diagnostics — `/devices/diagnostics` [N].

### 2.8 Monitoring & Analytics
- Facility analytics — `/analytics` [E].
- Operator metrics — `/monitoring/metrics` [N].
- Service health — `/monitoring/health` [N].
- Storage — `/monitoring/storage` [N].
- Alerts and activity — `/monitoring/activity` [N].
- Diagnostics — `/diagnostics` [E].
- Experimental evaluation — `/evaluation` [E; admin/research role].

### 2.9 Security & Recovery
- Audit verification — `/audit/verify` [E].
- Security events — `/security/events` [N].
- Backups — `/backup` [E].
- Restore — `/restore` [E; restrict and require confirmation].
- Recovery tools — `/recovery` [E].

### 2.10 Settings
- General settings — `/settings` [E].
- Provisioning — `/setup` [N alias to existing `/` setup experience].
- Installed DHIS2 apps — `/apps` [E].
- Software and releases — `/settings/releases` [N].
- Network/TLS and endpoints — `/settings/network` [N; only exposed fields supported].

## 3. Interaction design and brand rules

- Header: exact uploaded approved DER logo in top-left (preserve aspect ratio), universal search, bounded global status summary, bound OU read-only label, authenticated user menu.
- Sidebar: quiet white/off-white surfaces; soft active-state tint; navy headings; teal reserved for meaningful active indicators; no gradients and no bright blocks. Retain a clear separation between operations and administration.
- Workspace: breadcrumbs, concise title, contextual actions, content-first tables and filters. Place detail views in accessible drawers or dedicated routes.
- Reduce decorative metrics cards. Show up to 3–5 relevant metrics only when values are sourced from a real API.
- Typography: Arial or equally readable sans-serif; restrained type scale, comfortable row heights, consistent spacing.
- Use colour as a redundant signal with text/icon for errors, success, warnings and sync states. No colour-only communication.
- Support 320px mobile through desktop without sideways page overflow; tables may scroll within a bounded region with clear controls.
- Page states: loading, empty, error, permission denied, offline central, unavailable edge server, partial integration, operation pending, stale view, confirmation and audit result.
- Do not hard-code personal names, hostnames, counts or organisation names from visual mockups. Treat them as non-production design examples.

## 4. Critical single-OU rule and identity model

**Product requirement:** a DER Server synchronises records for **exactly one central DHIS2 organisation unit, in both directions**. Enforce scope in UI, server authorisation, journal, inbound/outbound worker, metadata filtering, and test fixtures. A human-readable ancestor path is context only; the synchronisation scope must not silently expand to ancestor/descendant OUs.

**Critical conflict:** ADR-0015 describes *single orgUnit subtree* binding; that contradicts the above leaf/exact-OU requirement. Before implementation:
1. Inspect actual `OrgUnitBindingService`, `OrgUnitScopeInterceptor`, repositories, API contracts and tests.
2. Document the discrepancy and obtain project-level resolution in a new ADR or an explicit revision of ADR-0015.
3. Implement/test one exact central OU UID if this remains the selected product requirement. No temporary UI-only restriction.
4. Add negative tests for a valid-looking child OU, parent OU, sibling OU and malicious direct API payload bypass.
5. Rebind must be privileged and audited; require reconciliation plan for pending journal entries, existing records and identity mapping before allowing activation.

**Users:** each DER user must be assigned to the bound OU and mapped to a verified central DHIS2 identity. PAT or username/password integration can be offered only where supported by securely implemented server-side credential handling. Verify actual central identity, OU membership and permissions; do not treat a token string as proof of identity by itself. Never expose, store in local browser storage or log PATs/passwords. Distinguish edge-local session authentication from central service authentication. Test disconnected permission freshness, revocation, expired secrets and unmapped users.

**Connectivity:** WAN loss is not equivalent to local failure. The system can remain locally ready while central synchronisation is waiting. Separate local-save state from central-accepted state throughout the UI.

## 5. Implementation strategy and code layout

Prefer a **single-source navigation registry**, React Router route definitions, route guards, lazy screen imports as appropriate and consistent breadcrumb metadata. Keep `admin-ui/` separate from `client/`. Do not invent backend APIs.

Suggested locations (adapt to existing conventions):

```text
admin-ui/src/
  app/
    AdminShell.tsx
    navigation.ts
    routes.tsx
    permissions.ts
  components/
    BrandLogo.tsx
    Sidebar.tsx
    Topbar.tsx
    Breadcrumbs.tsx
    OrgUnitContext.tsx
    PageHeader.tsx
    ScreenStates.tsx
  pages/
    dashboard/
    system/
    integration/
    sync/
    workflow/
    data/
    access/
    devices/
    monitoring/
    security/
    settings/
  screens/
    EACoreScreens.tsx         # retain and incrementally migrate existing code
    EARemainderScreens.tsx    # retain and incrementally migrate existing code
  api/
    edgeApi.ts               # keep existing typed clients; extend only for verified APIs
```

**Navigation registry contract:** each entry should define stable id, label, path, group, icon, required authorities, visibility/feature flag, breadcrumb, optional child entries, and screen implementation status. A route must not be shown as functional unless a component actually serves it. `RequireAuth` and server-side RBAC must protect every mutation; do not assume hiding a menu is a security control.

**Backward compatibility:** existing routes in §1 remain valid or receive explicit tested redirects. Links from alert messages, journals, approval queues and bookmarked pages must continue functioning. Avoid changing the `/api/` DHIS2 compatibility surface while redesigning admin navigation.

**Status taxonomy:** `implemented`, `partial`, `not-implemented`, `unavailable`, `not-authorised` should remain distinguishable. If a new screen has no supported server API, keep the route excluded from normal navigation until available or show an explicit capability gap—not fake example data.

## 6. Phased instructions and mandatory completion gates

### Phase 00 — Source and baseline audit
Tasks: inspect `admin-ui/src/App.tsx`, both screen bundles, `edgeApi.ts`, `AuthContext`, `RequireAuth`, relevant controllers, exact OU code/ADR, `docs/requirements`, screen traceability, version and test scripts. Produce a route-to-component-to-API-to-permission inventory. Record existing tests and output; do not yet delete routes.

**Gate:** every current route, hidden screen, API call and permission assumption recorded; no unreviewed API assumption.

### Phase 01 — Navigation architecture and single-OU decision
Tasks: approve grouped IA, decide dashboard vs provisioning entry point, reconcile ADR-0015, establish one authoritative registry and route metadata, define role/permission map against actual backend authorities.

**Gate:** all existing routes mapped; exact OU rule enforced or documented blocker; no role mismatch; no unexplained route duplicates.

### Phase 02 — Shared shell, logo and design system
Tasks: implement responsive sidebar, topbar, user menu, breadcrumbs, OU read-only context, collapse/expand, deep-link active state, error/empty loading layouts, small-screen navigation. Reuse exact approved logo binary. Remove bright gradient/oversized card styling without loss of information.

**Gate:** keyboard navigation, visible focus, accessible names, mobile/desktop screenshots, no overflow or broken legacy deep links, all shell component tests pass.

### Phase 03 — Existing screen migration
Tasks: wire confirmed existing screens first, including compatibility, jobs, drift, conflicts, journal worker, users, approvals, workflows, devices, analytics, referral, metadata, recovery, backup, restore, evaluation, apps, diagnostics, settings. Keep old URLs working.

**Gate:** every current route opens the original functional screen, no dropped actions, no new 404s, Playwright navigation tests pass.

### Phase 04 — Synchronisation workspace
Tasks: provide overview, history, metadata sync, data queues, worker, conflict navigation. Use actual API contracts; verify write vs central acceptance, inbound vs outbound, queue retry semantics. Do not permit arbitrary deletion of queued operations without policy and audit safeguards.

**Gate:** jobs/queue/history/conflict drilldown work with real fixture-backed or integrated APIs, negative auth tests, WAN-down state tests; missing integration cannot display fabricated success.

### Phase 05 — OU and user mapping workspace
Tasks: show bound OU; central reference UID, mapping status, user records, roles, effective permissions, central mapping validation, credential method state and audit. Implement only after backend contracts verified. Keep secret values server-side and redact diagnostics.

**Gate:** exact OU scope tests pass; cross-OU access denied; no secrets in DOM/browser storage/logs; identity mapping verified, expired and revoked cases covered.

### Phase 06 — Workflows, clients and referrals
Tasks: expose design/approval/runs, device fleet/enrolment/ownership, referral inbox/history subject to implemented server semantics. Separate device workflow clients from DER administrator actions.

**Gate:** every action actually calls supported endpoint and checks permissions; state transitions/test failures handled; no placeholder approval/referral success messages.

### Phase 07 — Monitoring, recovery and settings
Tasks: add service information, health, metrics, storage, audit, backup/restore, settings/releases. Confirm liveness vs local readiness vs central connectivity. Require explicit confirmations for irreversible actions.

**Gate:** all displayed measurements sourced from real probes or explicitly shown unavailable; backup/restore requests traceable; RBAC and audit verified.

### Phase 08 — Comprehensive quality verification
Tasks: add unit, integration, role-permission matrix, Playwright E2E, keyboard/a11y, network-fault, narrow/mobile, browser-history and single-OU tests. Confirm visual review on every navigable screen. Track FR/NFR and screen IDs.

**Gate:** 100% of *required tests* pass; 100% line and branch coverage for newly written DER-owned navigation/security-sensitive logic, measuring only meaningful instrumented modules, with any exclusions justified. **Coverage is not sufficient:** include real backend and failure-mode tests. Report achieved percentages instead of claiming an unverified result. No critical/high severity unaddressed security or data-scope defect.

### Phase 09 — Integration, documentation and release
Tasks: update `docs/ui/01-design-system-and-navigation.md`, source screen inventory, ADR(s), route/permission matrix, release notes, screenshots, deployment checks and system information. Use consistent `der-X.Y.Z` versioning but do not bump a major version solely for a navigation redesign; follow actual compatibility/semver policy.

**Gate:** reproducible build, tests, lint/typecheck, recorded report, changelog and clean git revision. No release tag unless all stated gate evidence exists.

## 7. Test coverage matrix

| Test group | Minimum assertion |
|---|---|
| Navigation registry | unique IDs/paths, no orphan links, valid routes |
| Legacy URL | all routes in §1 still resolve to expected screen or deliberate redirect |
| Authentication | anonymous users blocked from protected screens |
| Authorisation | restricted menu visibility and server denial on direct URL/mutation |
| Single OU | exact bound OU shown; no multi-OU picker; other OU requests denied |
| User mapping | correct central identity/OU verification; PAT/password never displayed or logged |
| Synchronisation | queued, accepted, uncertain, failed and conflict states distinguished |
| Offline behaviour | WAN-down warning without falsely reporting local outage |
| Branding | approved logo asset unchanged, proportional and legible |
| Visual/responsive | desktop/tablet/mobile, no clipping, readable tables and drawers |
| Accessibility | keyboard, screen-reader landmarks, focus traps, contrast |
| Error states | API timeouts, empty lists, 401/403/404/409/500 and stale data |
| Dangerous actions | audited permission checks, confirmation and server validation |
| Documentation | all routes and requirement IDs represented and current |

## 8. Completion reporting required after EVERY phase

Create a short engineering report in the existing project documentation structure containing: phase and git SHA; DER version; inspected files; requirements/screen IDs; changed files; tests run with exact commands and exit status; measured line/branch coverage; screenshots of affected views; outstanding defects; explicitly unimplemented capabilities; and **PASS/BLOCKED** decision. Do not proceed if blocked. Do not fabricate evidence.

## 9. Prompt for Claude to execute

> Read `docs/ui/DER_ADMIN_UI_NAVIGATION_IMPLEMENTATION.md` completely. Audit the repository at HEAD and validate the routes, controllers, capabilities and requirements before modifying code. Implement its phases in order, preserving working behaviour and existing routes. Apply the exact approved DER logo and restrained soft brand UI. Respect one exact organisation unit per DER Server, including backend scope verification; reconcile ADR-0015 before changing OU behaviour. Never add fake data or falsely mark backend integration as implemented. Do not advance a phase until mandatory tests and required code coverage pass with recorded evidence. Do not commit secrets, AI instruction files or fabricated certification results.

## 10. Source links

- Repository: https://github.com/socaya/der-engine
- Current admin routes: https://github.com/socaya/der-engine/blob/main/admin-ui/src/App.tsx
- Existing core screens: https://github.com/socaya/der-engine/blob/main/admin-ui/src/screens/EACoreScreens.tsx
- Existing additional screens: https://github.com/socaya/der-engine/blob/main/admin-ui/src/screens/EARemainderScreens.tsx
- Client routes: https://github.com/socaya/der-engine/blob/main/client/src/App.tsx
- OU binding ADR: https://github.com/socaya/der-engine/blob/main/docs/architecture/decisions/0015-edge-orgunit-binding.md
- Implementation status: https://github.com/socaya/der-engine/blob/main/docs/implementation_status.md
