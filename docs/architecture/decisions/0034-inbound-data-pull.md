# ADR-0034 — Inbound data pull

Status: **Accepted** (Phase 09)
Supersedes: n/a (closes FR-13-02..09)

## Context

Through alpha.1..alpha.4 the Data module has been one-way outbound:
operators capture locally, `operation_journal` queues PENDING rows, the
sync drain pushes them to Central DHIS2. Nothing flows the other
direction. If an external user edits a dataValue on central, DER's
mirror stays stale. Operators cannot see central-side corrections,
cannot do federated evaluation, and cross-edge referrals cannot pick
up metadata written by sibling edges through central.

Metadata-side ADR-0004 already solved an analogous problem for
dataElements / programs / OUs via `MetadataSyncService`. ADR-0034
applies the same pattern to data values + events + TEIs. Scope is
limited to what the single-edge operator model needs today:

- Pull everything central has for *this* edge's bound org unit
  subtree.
- Honour central-side changes already-ACCEPTED by the edge, so we
  don't fight a corrector operator.
- Protect in-flight local edits (PENDING / IN_FLIGHT /
  CONFLICT_REVIEW / RETRYABLE) by routing collisions to the existing
  conflict-review workflow instead of silently overwriting.

## Decision

Introduce `DataPullService` + `DataPullJob` + `data_pull_cursor`
(V082). Three pullers — aggregate (`/api/dataValueSets`), events
(`/api/events`), tracker (`/api/tracker`) — each driven by a
per-(entity, orgUnit) `last_pulled_at` watermark. The scheduled job
runs every 5 minutes, is gated by the Phase 08
`CentralReachabilityGate` (skipped when OFFLINE, logs
`skipped_unreachable`), and uses the existing sync-worker's circuit
breaker for retries.

### Merge semantics

For each row central returns:

| Local state                             | Action                                                     |
|-----------------------------------------|------------------------------------------------------------|
| Row doesn't exist locally               | Insert; `version=1`; `submittedBy=SYSTEM`                  |
| Local terminal (CENTRAL_ACCEPTED / CENTRAL_REJECTED) | Overwrite; bump `version`; stamp `last_pulled_at`      |
| Local PENDING / IN_FLIGHT / RETRYABLE   | Create `CONFLICT_REVIEW` journal row; keep local write     |
| Local already CONFLICT_REVIEW           | Update the existing conflict row's `last_response` so the operator sees the newest central version |
| Central version == local version        | No-op (cursor advances)                                    |

**Rationale for "central-wins only for terminals":** a terminal row
is one the operator (or a prior worker tick) has already shipped to
central. Central's authoritative value is by definition "what we
sent, maybe edited since". Overwriting is safe and expected. A
non-terminal row is one the operator is still working on — their
local draft is more trustworthy than central's older copy, and
auto-overwriting would silently lose their work.

**Rationale against last-writer-wins on timestamps:** DER's clock
drift against central can be minutes on an unsynced edge. Comparing
`updatedAt` across the two systems is unreliable. State-based routing
(terminal vs. non-terminal) sidesteps the clock question entirely.

### Watermark

`data_pull_cursor` is `(entity_type, org_unit_uid, last_pulled_at,
last_cursor, consecutive_failures, last_error)`. On each successful
pull we advance `last_pulled_at` to the max `lastUpdated` central
returned for this scope. First-time cursor: `null` → pull everything
central has for the OU subtree in one batch (operator sees this as
"initial reconciliation"; expected to be slow on fresh installs).

### Rejected alternatives

- **CRDT merge.** Overkill for the small write surface here; would
  need a schema redesign and a new semantics specification. Phase 09
  stays within the existing `operation_journal` state machine.
- **Pull as part of the push drain tick.** Rejected because the gate
  short-circuit already covers "central down"; mixing pull + push
  into one tick would make the batch-size + metric semantics
  ambiguous. Separate job keeps the two concerns on independent
  schedules.
- **Last-writer-wins on `updatedAt`.** Rejected per the clock-drift
  argument above.

## Consequences

- **Positive**: closes FR-13-02..09; operators finally see central
  corrections; cross-edge referrals pick up sibling edits via central;
  evaluation screens can reconcile against central without being
  stale.
- **Positive**: terminal rows always converge to central's authoritative
  value — a basic guarantee the schema has implied for alpha.1..4 but
  not actually delivered.
- **Negative**: first pull on fresh install may be slow (full OU
  subtree history). Operator-facing banner when first cursor is null;
  pull job runs with higher batch size on first tick.
- **Negative**: a corrupt central-side edit now auto-propagates to the
  edge for terminal rows. Mitigation: audit log every pull overwrite
  (`DATA_PULL_OVERWRITE` event); operator can inspect what landed.
- **Negative**: CONFLICT_REVIEW backlog grows when operators edit the
  same rows central also edits. Mitigation: existing conflict-review
  UI handles the backlog; Phase 09.5 adds a "last central value" column
  to the conflict detail so the operator can see the alternative
  without leaving the queue.

## Implementation plan

- **09.1** this ADR (committed in the same slice as the schema).
- **09.2** V082 `data_pull_cursor` migration + `DataPullCursorRepository`
  + `DataPullService` skeleton (no pullers wired yet).
- **09.3** Aggregate puller + full merge-semantics coverage test.
- **09.4** Event + tracker pullers (same semantics).
- **09.5** `DataPullJob` scheduled; UI "Last pulled" column on the
  three Data screens; conflict detail "central value" column.
- **09.6** Live-verify against local DHIS2 2.44-SNAPSHOT with an
  edit-on-central-then-check-DER smoke test.

Each slice ships independently.
