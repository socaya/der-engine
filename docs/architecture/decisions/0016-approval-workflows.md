# ADR-0016: Local approval workflows

- Status: **ACCEPTED**
- Date decided: 2026-10-22
- Deciders: socaya
- Related: ADR-0010 (journal worker), ADR-0009 (conflict review),
  ADR-0015 (orgUnit binding), post-1.0 roadmap Initiative 4

## Context

`der-1.0.0-rc.2` drains every PENDING journal row toward central as
soon as the worker picks it up. Some pilot workflows require a human
reviewer to approve data **locally** before it reaches central — e.g.
a nurse captures a dataset, the facility in-charge checks it, then
sync proceeds. The post-1.0 roadmap scopes this as Initiative 4 for
`der-1.1.0-alpha.2`.

## Decision

An optional **per-domain** approval gate sits in front of the journal
worker. When enabled, every write of that domain lands in the journal
with `requires_approval = TRUE`; the journal worker ignores it until
an authorised reviewer approves it. Rejection marks the row terminally
rejected locally; no automatic undo of the business write.

### Role: reuse `REVIEWER`

`EdgeRole` already declares `REVIEWER` (defined in `V001`, allowlisted
by the provisioning controller, previously unused). Semantically it's
exactly the right fit — "review the local work before it syncs."
`ADMIN` can approve as a super-set.

Not adding a new `APPROVER` role avoids expanding the role matrix.

### Trigger: config toggle per domain

`der-1.1.0-alpha.2` ships three config properties:

- `der.approval.require.aggregate` (default `false`)
- `der.approval.require.event` (default `false`)
- `der.approval.require.tracker` (default `false`)

When any of these is `true`, the write service sets
`requires_approval=TRUE` on the journal row before inserting it.
Program-rule-driven conditional approval (e.g. "require approval if
value > 100") is a Phase 11 follow-up; it needs the Initiative 10
capture-workflow model to express the condition properly.

### Reject semantics: terminal, no auto-undo

Approve: writes `approved_by` + `approved_at`; the journal row stays
in `state=PENDING` and the worker picks it up on the next tick.

Reject: writes `rejected_by` + `rejected_at` + `rejection_reason`;
the row stays `state=PENDING` but the worker filter excludes it. The
local business write is **not** undone — the facility operator decides
whether to re-enter corrected data in the client.

Rationale: automatic undo opens a Pandora's box (what if subsequent
writes referenced this row? what if it's been read by an app?). An
explicit manual re-enter is auditable and simple.

### Schema

V013 adds columns to `der.operation_journal`:

- `requires_approval BOOLEAN NOT NULL DEFAULT FALSE`
- `approved_by UUID REFERENCES der.edge_user(user_id)`
- `approved_at TIMESTAMPTZ`
- `rejected_by UUID REFERENCES der.edge_user(user_id)`
- `rejected_at TIMESTAMPTZ`
- `rejection_reason TEXT`
- Partial index on `requires_approval=TRUE AND approved_at IS NULL
  AND rejected_at IS NULL AND state='PENDING'` for the admin list.
- Check constraint: a row cannot be both approved and rejected.

The Java `OperationJournalEntry` record stays slim; approval columns
are exposed through a separate `OperationJournalApproval` DTO loaded
by `ApprovalRepository`.

### Journal worker filter

Add a new method `OperationJournalRepository.findPendingReadyToDrain(limit)`
that filters:

```sql
WHERE state = 'PENDING'
  AND (requires_approval = FALSE OR approved_at IS NOT NULL)
  AND rejected_at IS NULL
```

`JournalWorker.drainBatch` migrates to this method. Existing
`findPending` stays for admin backlog queries.

### REST surface

- `GET /edge-api/v1/approvals/pending?limit=N` — REVIEWER/ADMIN. Lists
  journal rows awaiting approval.
- `POST /edge-api/v1/approvals/{opId}/approve` — REVIEWER/ADMIN.
- `POST /edge-api/v1/approvals/{opId}/reject` with
  `{reason: string}` — REVIEWER/ADMIN.
- `GET /edge-api/v1/approvals/{opId}` — any authenticated role; shows
  approval state for a single operation.

## Admin UI

A new screen bundled into `EACoreScreens.tsx` as `EAApprovalQueue`
exposes the pending list with approve/reject actions. Routed at
`/approvals`. Shows the row's `entityType`, `entityRef`, submitter,
submitted-at, with "Show payload" expander.

## Not in scope

- Program-rule-driven conditional approval (requires Initiative 10).
- Multi-stage approval (e.g. nurse → in-charge → district). Add in
  der-1.3.0 if pilot demand materialises.
- Automatic undo on reject.
- Approval of ADR-0005 custom-app traffic (those bypass DER's write
  service layer; out of scope for this ADR).

## Consequences

- `V013` is a backwards-compatible column addition; existing writes
  continue to work with `requires_approval=FALSE`.
- The journal worker's drainable count drops by the number of
  awaiting-approval rows. The admin backlog widget shows both counts.
- Pilot operators must grant `REVIEWER` to at least one user when
  enabling the gate; otherwise writes stall forever. The release note
  calls this out.
