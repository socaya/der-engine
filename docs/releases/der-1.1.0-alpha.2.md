# DER 1.1.0-alpha.2 — Initiative 4: local approval workflows

> **Scope:** Second slice of the post-1.0 roadmap. Ships ADR-0016
> (local approval gate on the journal) with an opt-in per-domain
> toggle, REVIEWER-driven approve / reject surface, and admin-UI
> approval queue. No disruption to the default flow — approval is
> off out of the box.

**Release label:** `der-1.1.0-alpha.2`
**Git tag:** `der-1.1.0-alpha.2`
**DHIS2 reference:** 2.44-SNAPSHOT

## New

- **ADR-0016 Local approval workflows** — accepted. REVIEWER role is
  reused (not a new APPROVER role). Config-level per-domain toggle
  (aggregate / event / tracker). Reject is terminal; no automatic
  undo of the local business write.
- **V013 schema:** adds `requires_approval`, `approved_by/at`,
  `rejected_by/at`, `rejection_reason` columns to `operation_journal`
  + a check constraint ("approved XOR rejected") + a partial index
  for the awaiting-approval query.
- `ug.ac.mak.der.approval` package:
  - `ApprovalRequirements` — reads the three config flags.
  - `ApprovalRecord` — approval view DTO.
  - `ApprovalRepository` — reads + writes the approval columns.
  - `ApprovalService` — approve / reject / list pending with
    outcome enum (APPROVED / REJECTED / NOT_FOUND / NOT_REQUIRED /
    ALREADY_DECIDED).
- `OperationJournalRepository.findPendingReadyToDrain(limit)` — new
  worker query that filters out awaiting / rejected rows.
  `JournalWorker.drainBatch` migrates to it.
- `OperationJournalRepository.markRequiresApproval(opId)` — flipped
  by write services when the config says approval is required.
- `AggregateDataValueService` and `EventService` call
  `markRequiresApproval` when the respective config flag is on.
- `ApprovalController` at `/edge-api/v1/approvals/**` (REVIEWER +
  ADMIN for mutations; any authenticated role can read status).
- Admin UI `EAApprovalQueue` screen bundled into `EACoreScreens.tsx`,
  routed at `/approvals`, with "Approvals" nav link.
- `edgeApi` helpers (admin): `listPendingApprovals`,
  `approveOperation`, `rejectOperation`.

## Configuration

| Property | Default | Purpose |
|---|---|---|
| `der.approval.require.aggregate` | `false` | Require review before draining aggregate writes. |
| `der.approval.require.event` | `false` | Require review before draining event (incl. program-stage events). |
| `der.approval.require.tracker` | `false` | Require review before draining tracker (TEI + enrolment) writes. |

Pilot operators enabling any of these **must** also grant the
`REVIEWER` role to at least one user; otherwise writes stall forever.
The release note says this out loud.

## REST surface

- `GET  /edge-api/v1/approvals/pending?limit=100` — REVIEWER/ADMIN.
- `GET  /edge-api/v1/approvals/{opId}` — any authenticated role.
- `POST /edge-api/v1/approvals/{opId}/approve` — REVIEWER/ADMIN.
- `POST /edge-api/v1/approvals/{opId}/reject` with `{reason: string}` — REVIEWER/ADMIN.

Error shape on 409:

```json
{ "code": "APPROVAL_NOT_REQUIRED",      "message": "..." }
{ "code": "APPROVAL_ALREADY_DECIDED",   "message": "..." }
```

## Test state

- **935 server tests** pass (was 927, +45 new approval-package +
  OperationJournalRepository additions, after rebalancing).
- Admin-ui: **157 tests, 100/91.31/99.24/100** (was 145 /
  100/91.46/99.18/100 after `der-1.1.0-alpha.1`).
- `mvn verify` green; SpotBugs + Checkstyle clean; JaCoCo per-class
  limits met.

## Deliberate non-goals

- Program-rule-driven conditional approval ("require approval if
  value > threshold") — needs Initiative 10 capture-workflow
  modelling; land in `der-1.2.0`.
- Multi-stage approval chains (nurse → in-charge → district) —
  Phase 11+.
- Automatic undo on reject. The business row stays; the operator
  decides whether to re-enter corrected data.
- Approval of ADR-0005 custom-app writes — those bypass DER's
  service layer so the gate doesn't fire for them.

## Promotion path

`der-1.1.0-alpha.2` → `der-1.1.0-alpha.3` (Initiative 8 part 1:
TLS enforcement + PII log masking + backup-archive at-rest encryption)
→ stable `der-1.1.0`.
