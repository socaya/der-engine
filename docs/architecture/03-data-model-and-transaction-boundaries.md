# Data architecture, integrity and ownership

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

## Ownership
DHIS2 Core owns DHIS2 business schema and supported business transactions. DER owns edge-registration, operation identity, reconciliation state, checkpoints, conflict reviews and audit evidence. Never treat copying PostgreSQL rows between two DHIS2 installations as a supported automatic merge procedure.

## Proposed DER-owned entities
- `edge_node`: stable node ID, local/central release, OU scope, bootstrap state.
- `metadata_snapshot`: fingerprint, object selection, dependencies, validity, source timestamp.
- `operation_journal`: stable operation UUID, origin, entity-kind/key, actor, local sequence, metadata version, payload hash/reference, state, created/updated timestamps.
- `sync_attempt`: attempt ID, operation ID, transport result, response digest, timestamp, failure classification.
- `reconciliation_checkpoint`: object type, scope, cursor/watermark, verified position, replay boundary.
- `conflict_case`: affected record, local/central versions, reason, policy, reviewer, disposition, audit refs.
- `security_event`: actor, action, outcome, entity scope, date, correlation ID.
- `backup_manifest`: schema versions, checksums, location, verification and restore outcome.

## Transaction invariant
Successful local business write and required journal intent must be atomic, or an alternative provably lossless change-capture mechanism must be demonstrated (e.g. supported transactional hooks). A DER service calling DHIS2 API and then independently inserting an outbox record **does not** meet the invariant. Define the architecture-specific mechanism before claiming NFR atomicity.

## Record identity
Use stable and collision-resistant identifiers appropriate for DHIS2 APIs; preserve reference relationships (tracked entities -> enrolments -> events). Determine operation identity independently of request/transport retries. Respect central validation/uniqueness rules. Detect and explicitly handle delete, missing references, stale version, metadata and permission changes.

## Retention and privacy
Synthetic data for experiments. If deployment ever includes personal records, define encryption, least privilege, backup access, data retention and redaction before use. Do not place identity tokens, patient attributes or payload secrets in logs.
