# ADR-0032 — Client-user attribution engine

**Status:** Proposed (plan + initial schema land in alpha.3 of 2.0.2)
**Date:** 2026-10-23
**Decision owners:** socaya
**Supersedes / amends:** ADR-0001 (DER identity), ADR-0028 (TOTP MFA)

## Context

Today DER authenticates in two independent planes:

- **Device client (DC) ↔ Edge** — the operator signs in to DER with
  their edge-local `edge_user` row (bootstrap admin, provisioned
  operators). The session cookie `DER_SESSION` identifies the human.
  Captured data lands in DER as rows attributed via `created_by`
  columns on `operation_journal`, `capture_workflow`, etc.
- **Edge ↔ DHIS2 Central** — the journal drain / metadata sync use a
  **single service-account** credential (`DER_DHIS2_USER` /
  `DER_DHIS2_PASSWORD`) to talk to central. Every imported record
  therefore shows up in DHIS2 as modified by that one account.

This collapses attribution: a nurse captures 50 records on a Capacitor
tablet, the records reach DHIS2 central, and DHIS2's `storedBy` /
`createdBy` says `admin` on all of them. Audit trails on the central
side cannot answer "who captured this value" without going back to
DER's own `operation_journal` by stable ID. Supervisors looking at
DHIS2 alone see one actor for the whole facility — which breaks
accountability, quality-review workflows, and the pilot evaluation's
"who captured what" questions.

The requirements driving this:

- **FR-16-02 User traceability** (functional-register): "Preserve
  attribution of captured data to the actual device user, including
  through journal replay and conflict resolution."
- **FR-16-03 Session binding**: "Each captured record MUST be
  cryptographically bound to the device user's session."
- **NFR-29 Audit completeness** (nonfunctional-register): "Trail must
  identify both the local actor and the central-side service account
  that enacted each operation."

## Decision

Introduce a **client-user attribution engine** in the server with four
layers:

1. **Edge user ↔ DHIS2 user mapping** (`edge_user_dhis2_mapping`
   table). Every provisioned edge user carries their mapped central
   `userUid` (and optional display name). The mapping is populated at
   provisioning time by the admin, by looking up the DHIS2 user by
   username. Unmapped users may still capture data locally, but their
   drains fail with `USER_NOT_MAPPED` until the admin resolves it.

2. **Captured-by stamping on journal entries.** The existing
   `operation_journal.created_by` column already stores the edge
   user UUID. Alpha.3 adds a sibling column
   `captured_by_dhis2_uid` which the mapping engine resolves at
   enqueue time (not drain time) so historical replays preserve
   attribution even if the mapping later changes.

3. **DHIS2 submission options.** Three strategies, choose per
   endpoint:
   - **(A) `storedBy` field** — DHIS2 aggregate (`dataValues[].storedBy`)
     and tracker (`events[].storedBy`, `enrollments[].storedBy`) both
     accept a storedBy field. DER populates it from the mapped UID's
     username. **Chosen for alpha.3** — zero new central dependencies.
   - **(B) Impersonation via `ImpersonateUser` header** — only works
     on DHIS2 instances with the custom impersonation module; not
     portable. Not chosen.
   - **(C) Per-user OAuth2 tokens** — DER mints a short-lived DHIS2
     access token per captured record via the central's PAT API.
     Future direction (ADR-0033), gated on PAT availability.

4. **Audit chain gets both actors.** `security_audit.enactor_user_id`
   stays the service account; a new `captured_by_user_id` column (and
   its mapped UID) is added via the `metadata` JSONB column — no
   schema change needed, convention is `metadata.capturedByEdgeUser`
   + `metadata.capturedByDhis2Uid`.

## Scope — alpha.3 of 2.0.2

- V026 migration adds `edge_user_dhis2_mapping` table (one row per
  edge user, columns `edge_user_id UUID`, `dhis2_user_uid VARCHAR(11)`,
  `dhis2_username TEXT`, `dhis2_display_name TEXT`, `mapped_at`,
  `mapped_by`).
- V026 adds `operation_journal.captured_by_dhis2_uid` column.
- `EdgeUserDhis2MappingRepository` + `EdgeUserDhis2MappingService` —
  CRUD + central lookup.
- `/edge-api/v1/admin/users/{id}/dhis2-mapping` admin endpoints.
- `JournalPublisher` stamps `storedBy` into aggregate value sets,
  tracker events, enrollments. Falls back to the service account when
  no mapping (configurable: strict mode fails the drain, lenient
  mode continues with service account + `MAPPING_FALLBACK` audit).
- Playwright E2E `ea-mapping.spec.ts`: admin assigns mapping →
  operator captures a value → drain → DHIS2 shows the mapped user as
  `storedBy`.

## Out of scope — follow-ups

- OAuth2 PAT per-user tokens (ADR-0033).
- Delegated impersonation.
- Central-side `createdBy` propagation beyond `storedBy` (DHIS2's
  core identity remains the service account calling the API; this is
  a DHIS2 limitation documented in docs/references/).
- Automatic mapping from DHIS2 user search by email (admin-manual
  for alpha.3; auto-suggest in alpha.4).

## Consequences

- **Audit** — DHIS2 reviewers see the human captor on each value
  via `storedBy`, not the service account.
- **Review workflows** — supervisors can filter DHIS2 by `storedBy`
  for quality assurance.
- **Admin burden** — every provisioned operator must be mapped
  before they can capture mergable data. We mitigate with a
  **lenient-mode** flag during pilot.
- **Replay semantics** — because mapping is resolved at enqueue, a
  mapping change does not retroactively rewrite journal entries;
  replays preserve the historical `captured_by_dhis2_uid`.
- **Risk — stale usernames.** If a DHIS2 user is renamed centrally,
  the stored `dhis2_username` becomes stale. Alpha.4 adds a refresh
  job that reconciles the mapping nightly.

## Verification

- Unit tests on the service + repository.
- `MappingDrainIntegrationTest`: enqueue → drain → mock DHIS2
  server returns the request body → assertion that `storedBy`
  matches mapped username.
- Live Playwright flow against local DHIS2 2.44-SNAPSHOT.
- Evidence captured under
  `docs/evaluation/evidence/alpha.3-attribution/`.
