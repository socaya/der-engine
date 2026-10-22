# DER 0.5.0-alpha.1 — Phase 04, durable journal worker drain

> **Scope:** DER now pushes locally-collected data back to central. Phase 04 closes the ADR-0004 hybrid architecture loop. ADR-0010 documents the drain semantics.

**Release label:** `der-0.5.0-alpha.1`
**Git tag:** `der-0.5.0-alpha.1`

## New

- V008 — operation_journal gains `idempotency_key`, `next_attempt_at`, `last_response`.
- `ug.ac.mak.der.workflows.journal.*` — JournalWorker (bounded batch, state transitions, exponential backoff with jitter), JournalPublisher (capability-aware target endpoints), ResponseClassifier.
- `JournalDrainJob` Quartz job (`JOURNAL_WORKER_DRAIN`), cron `0 * * * * ?` default (every minute).
- `JournalWorkerController` admin REST — `GET /edge-api/v1/journal/worker` (health), `POST /pause`, `POST /resume`.
- Config: `der.journal.drain.{enabled,cron,batch-size,backoff-base-seconds,backoff-cap-seconds}`.

## Test state

- 759 tests pass.
- JaCoCo thresholds: LINE ≥ 0.94, BRANCH ≥ 0.70 (progressive; stable 1.0 raises to 1.00/1.00). Transparent threshold rationale in `pom.xml`.
- SpotBugs clean (30 reviewed suppressions).

## Non-goals

- Multi-node drain coordination.
- Exactly-once (idempotency_key + central dedup = at-most-once-with-safe-retry).
