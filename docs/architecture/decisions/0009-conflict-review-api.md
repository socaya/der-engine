# ADR-0009: Conflict-review API over the operation journal

- Status: **ACCEPTED**
- Date decided: 2026-10-22
- Deciders: socaya
- Related requirements: FR-11-03, FR-11-05, FR-11-06
- Related ADRs: ADR-0004 (hybrid), ADR-0008 (scheduler)

## Decision

Admin REST surface at `/edge-api/v1/journal/conflicts` with three endpoints:

- `GET /edge-api/v1/journal/conflicts?limit=` — list rows in
  `CONFLICT_REVIEW` state.
- `POST /edge-api/v1/journal/conflicts/{id}/resolve` (ADMIN) — body
  `{outcome: ACCEPTED|REJECTED, rationale: ...}`. Transitions the row to
  `CENTRAL_ACCEPTED` or `CENTRAL_REJECTED`; stamps `resolved_by`,
  `resolved_at` and `resolution_rationale`.
- `POST /edge-api/v1/journal/conflicts/{id}/re-journal` (ADMIN) — clones
  the row to a new `PENDING` entry with the `supersedes` column referencing
  the original. Phase 04's worker then retries without losing the audit
  trail.

Role: ADMIN only. OPERATOR gets GET-only in Phase 06 via a separate role
check.

V006 migration adds three columns: `supersedes`, `resolved_at`,
`resolved_by`, `resolution_rationale`.

## Consequences

- Phase 04's journal worker has somewhere to put 409 responses from
  central (`CONFLICT_REVIEW` state) and an API for operators to resolve.
- Supersedes chain is kept for audit; no row is ever deleted.

## Non-goals

- No conflict-visualisation UI; Phase 06.
- No automated conflict resolution; operators decide outcome.
