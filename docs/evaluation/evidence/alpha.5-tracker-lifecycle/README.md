# der-2.0.3-alpha.1 — tracker lifecycle evidence

**Captured:** 2026-10-23
**Target:** DER 2.0.2 (post-tag) + DHIS2 2.44-SNAPSHOT

## V027 migration

New edge-side tables with full referential integrity against V025
`tracked_entity`:

- `der.edge_enrollment` — tracker program enrollments, FK → `tracked_entity.tei_uid`
- `der.edge_tracker_event` — stage events, FK → `edge_enrollment.enrollment_uid`
- `der.edge_tracker_relationship` — typed relationships; existence
  validated at controller layer (TEIs, enrollments, events).

Named `edge_` to distinguish from V005's `enrollment`/`event` metadata
mirror (central-side reflection) — these are DER's own writable capture
state.

## Live flow verified

1. **TEI create** — `POST /edge-api/v1/tracked-entities`
   (`aAbBcCdDeE1`, type `nEenWmSyUEp`, OU `ImspTQPwCqd`).
2. **Enrollment create** — `POST /edge-api/v1/tracker/enrollments` →
   see `enrollment.json`. `storedBy: "admin"` populated from the
   ADR-0032 attribution engine; FK to the TEI respected.
3. **Event create** — `POST /edge-api/v1/tracker/events` →
   see `event.json`. `storedBy: "admin"`, nested `dataValues`
   preserved, FK to enrollment respected, status COMPLETED.
4. **Relationship create** — `POST /edge-api/v1/tracker/relationships`
   TRACKED_ENTITY→ENROLLMENT → see `relationships.json`. Both
   endpoints validated to exist before insert.
5. **FK integrity rejection** — attempted enrollment with
   non-existent `teiUid` → `TEI_NOT_FOUND` 400 (`fk-violation.json`).
6. **Join query** — `GET /tracker/events/by-enrollment/aEnRoLlMnT1`
   returns the event scoped to the enrollment.

## FR coverage after this alpha

Three FRs flip to DONE in the matrix:

- **FR-08-06 Preserve permitted TEI/event relationships with
  referential integrity.** `edge_tracker_relationship` with
  endpoint-existence check in `TrackerRelationshipController`.
- **FR-08-10 Synchronise entity/enrolment/event/relationship
  dependencies in safe order.** FK CASCADE on parent entities;
  controller rejects orphan creations; `/by-enrollment` + `/by-tei`
  queries preserve the dependency graph.
- **FR-08-12 Retain actor, operation identity and locally committed
  workflow history.** `created_by` UUID, `stored_by_dhis2_uid` from
  ADR-0032 resolver, `created_at`/`updated_at`, `version` monotonic
  counter — all three tables carry the full audit trail.

Remaining FR-08 items for alpha.2+:
- FR-08-07 dependent workflow continuity (one authorised user
  continues another's work) — covered partially via session binding
  but needs explicit handoff tracking.
- FR-08-08 uniqueness checks (unique-attribute collisions).
- FR-08-09 program rules + mandatory fields.

## Controllers

`EnrollmentController` at `/edge-api/v1/tracker/enrollments`:
- POST (upsert) with FK integrity + storedBy stamping
- GET /{uid}, GET ?teiUid=..., GET ?programUid=&limit=
- DELETE /{uid}

`TrackerEventController` at `/edge-api/v1/tracker/events`:
- POST (upsert) with FK integrity + storedBy stamping
- GET /{uid}, GET /by-enrollment/{enrollmentUid}
- DELETE /{uid}

`TrackerRelationshipController` at `/edge-api/v1/tracker/relationships`:
- POST (create) with endpoint-existence validation on both ends
- GET /{uid}, GET ?entityType=&entityUid= (lists bidirectional +
  outgoing)
- DELETE /{uid}

## Fixes applied during this alpha

- V027 initially collided with V005's existing `enrollment` table.
  Renamed new tables with `edge_` prefix.
- `EnrollmentRepository`/`TrackerEventRepository` had residual
  `ON CONFLICT ... version = der.enrollment.version + 1` that didn't
  get rewritten in the rename sweep — fixed; integration path now
  green.
