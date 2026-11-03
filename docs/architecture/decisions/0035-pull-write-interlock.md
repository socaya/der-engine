# ADR-0035 — Pull/write interlock

Status: **Accepted** (Phase 13.1)
Supersedes: n/a (extends ADR-0034)

## Context

ADR-0034 shipped inbound data pull with a three-way merge
(central-wins for terminal rows; `CONFLICT_REVIEW` for non-terminal
rows; shadow-overwrite for system-origin PENDING rows added in
Phase 10.4). What it didn't formalise: what happens when a pull
arrives for row X at the same moment the drain worker is pushing
row X to central?

Scenario:
1. Operator captures a row at T0 — journal row X in state PENDING.
2. Drain worker starts a tick at T1, picks X, flips to IN_FLIGHT.
3. Central pull starts a tick at T1+ε, fetches the central-side
   version of X.
4. Drain worker's POST to central at T2 is still in flight.
5. Pull applies the central value → the aggregate_data_value row is
   overwritten before the drain's own POST completes.
6. Drain's POST eventually succeeds; drain flips journal row X to
   `CENTRAL_ACCEPTED`.
7. Row X in the local mirror now shows central's older value AND
   is marked `CENTRAL_ACCEPTED` with the operator's version
   (which central actually received). The journal and the mirror
   have drifted.

The real-world incidence of this race is small — pull runs every 5
min; drain every 1 min; the overlap window per tick is seconds —
but it's non-zero, and the failure mode is silent data drift which
operators won't catch without a reconciliation check.

## Decision

Introduce an application-level row-interlock on
`operation_journal`:

- The drain worker, as its first act in `drainBatch`, acquires an
  advisory lock on the row by issuing
  `SELECT 1 FROM der.operation_journal WHERE operation_id = ?
   FOR UPDATE SKIP LOCKED` inside the same transaction that flips
  state to `IN_FLIGHT`.
- The pull mergers, before applying the central-wins overwrite, do
  the same `SELECT ... FOR UPDATE SKIP LOCKED` on the journal row
  (if any journal row exists for the entity ref). If the lock is
  skipped (someone else holds it), the pull defers overwrite for
  this tick and continues to the next row. The deferred row will
  be retried on the next pull tick (5 min later) by which time the
  drain has either committed or rolled back.
- Terminal state transitions (`CENTRAL_ACCEPTED` / `CENTRAL_REJECTED`
  / `CONFLICT_REVIEW`) are the only valid lock-release points. The
  reaper (Phase 11.1 / 12.1) is the backstop if the drain crashes
  while holding the lock.

### Why `SKIP LOCKED` not `NOWAIT`

The pull puller should prefer "I'll try you next tick" over
"something's wrong, raise an error". `NOWAIT` would raise an
exception and either tank the whole tick or require per-row catch
plumbing. `SKIP LOCKED` is the clean Postgres idiom for
work-queue scanning.

### Why not advisory locks (`pg_advisory_xact_lock`)

Advisory locks are simpler but detached from the row — if the
puller code path forgets to acquire the lock for a specific
row, it will silently proceed. Attaching the lock to the actual
`operation_journal` row via `FOR UPDATE` means the lock exists
exactly where the row's state transitions.

### Why not a dedicated lock column

A new `locked_at` column would double the schema's bookkeeping
and require a reaper to free the lock on crash. Postgres row locks
are released automatically on tx commit / rollback — including
after SIGKILL — so leveraging them avoids a whole category of
"stuck lock" bugs.

### Rejected alternatives

- **Serializable isolation on the whole DB.** Would correct the
  race but tanks throughput and makes all unrelated transactions
  pay the cost. Overkill.
- **Pessimistic serialisation of pull and drain at job level**
  (never run both simultaneously). Would require job-level
  coordination through Quartz; harder to reason about than row-
  level isolation; and would waste the common-case where pull
  touches rows the drain isn't near.

## Consequences

- **Positive**: no silent drift between journal and mirror even
  during overlapping pull + drain ticks. Operator-facing invariant
  "journal state matches mirror value" holds.
- **Positive**: pull defers rather than fails. The 5-minute
  retry cadence makes deferral invisible to operators.
- **Negative**: an infinitely-stuck drain holding the lock would
  starve the pull indefinitely. Mitigation: the Phase 12.1
  continuous reaper. If a drain holds `IN_FLIGHT` past the
  configured threshold (default PT10M), it's requeued and the lock
  released.
- **Negative**: `SELECT FOR UPDATE SKIP LOCKED` isn't portable to
  non-Postgres backends. ADR-0004 already locks DER to Postgres
  for the journal store, so this is already in scope.

## Implementation

- `OperationJournalRepository.tryLockRowForPublish(opId)` executes
  `SELECT 1 FROM der.operation_journal WHERE operation_id = ? FOR
   UPDATE SKIP LOCKED` and returns a boolean indicating whether
  the lock was acquired.
- `JournalWorker.drainBatch` already runs inside a Spring
  `@Transactional` block; `tryLockRowForPublish` is called from
  within that tx so the lock is released on commit.
- `AggregatePuller`, `EventPuller`, `TrackerPuller` call
  `tryLockRowForPublish` before applying an overwrite OR raising
  a conflict. Skip the row on `false`; proceed on `true`.
- Metric `der_pull_deferred_total{reason="row_locked"}` counts
  deferred rows so dashboards can show the frequency.

## Testing

- Unit test proves `tryLockRowForPublish` returns true when no
  concurrent tx holds the row and false when one does.
- Chaos test
  (`scripts/evaluation/chaos_pull_write_interlock.sh`) seeds a
  PENDING row, starts the drain in one tx, starts a pull in
  another, asserts the pull-side observes `false` from
  `tryLockRowForPublish` and leaves the row untouched.

Chaos script ships alongside the existing
`chaos_journal_recovery.sh`.
