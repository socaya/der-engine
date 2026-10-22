# ADR-0010: Durable journal worker for edge-to-central drain

- Status: **ACCEPTED**
- Date decided: 2026-10-22
- Deciders: socaya
- Related requirements: FR-11-02, FR-11-04, FR-11-05, FR-13-01
- Related ADRs: ADR-0004 (hybrid), ADR-0006 (compat), ADR-0008 (scheduler),
  ADR-0009 (conflict-review)

## Decision

A durable Quartz job `JOURNAL_WORKER_DRAIN` fires every minute (configurable
via `der.journal.drain.cron`), picks a bounded batch of `PENDING` rows
whose `next_attempt_at` is null or past, flips them to `IN_FLIGHT`, calls
the per-entity `JournalPublisher`, then transitions by response:

- `2xx` → `CENTRAL_ACCEPTED`.
- `409` → `CONFLICT_REVIEW` (ADR-0009 admin resolves).
- `5xx` or I/O → `PENDING` with `next_attempt_at` = backoff.
- `4xx` other than `409` → `CENTRAL_REJECTED` + `last_error`.

Backoff: exponential (base 30 s, cap 1 h, jitter 10 %) stored in
`next_attempt_at`.

Target endpoints are capability-aware per ADR-0006:
`endpointPolicy(DATA_VALUE_SETS)` for aggregate; tracker vs legacy events
decided by `capabilities().trackerApi()`.

Health surface: `GET /edge-api/v1/journal/worker` reports last tick,
backlog by state, oldest-pending age.
Pause/resume: `POST /edge-api/v1/journal/worker/{pause|resume}` (ADMIN).

## Non-goals

- Exactly-once; the `idempotency_key` column + central's own de-dup on
  reasonable Web API endpoints are enough for "at-most-once-with-safe-retry".
- Streaming / batched (>1 batch per tick) delivery; a single batch size
  bound covers the pilot scale. Phase 06 may extend.
