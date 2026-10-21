# Synchronisation, conflicts and state transitions

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

## Outbound states
`LOCAL_COMMITTED -> PENDING -> CLAIMED -> SENT_UNCONFIRMED -> {CENTRAL_ACCEPTED, CENTRAL_REJECTED, REVIEW_REQUIRED, RETRY_WAIT, OUTCOME_UNKNOWN}`. `RETRY_WAIT -> CLAIMED`; `OUTCOME_UNKNOWN -> VERIFY_EFFECT -> {CENTRAL_ACCEPTED, REVIEW_REQUIRED, RETRY_WAIT}`. Crash recovery must re-evaluate persisted leases and uncertainty.

## Invariants
1. Only a verifiably accepted central result becomes `CENTRAL_ACCEPTED`.
2. Transport HTTP success alone may not prove business-level success; parse version-specific DHIS2 import summaries.
3. Failed attempts do not delete committed local data.
4. Replays use stable identity and/or observed central effect to prevent unintended duplicates.
5. Dependencies determine safe submission order; Tracker enrolments/events must not outrun prerequisites.
6. Admin retry is auditable and cannot overwrite an unresolved conflict without a policy decision.
7. Central-to-edge updates pass through scope/version/permission and conflict rules.

## Conflict taxonomy
- Local lost-update: competing edge client modifies stale record -> local optimistic check.
- Divergent central/edge update: overlapping fields -> classify; never default to latest timestamp.
- Unique attribute collision: prevent duplicate identity; preserve journal.
- Delete/update conflict: require explicit resolution of intended end state.
- Metadata drift: quarantine transactions whose semantics no longer match central.
- Permission drift: reject or review according to documented offline-policy validity.
- Uncertain acknowledgement: inspect remote effect before a side-effecting retry.

## Resolution UI contract
Display local proposed values, central values, metadata versions, request history, affected relationships, policy reason and permitted actions. Require review actor + justification and immutable audit trail. No generic merge if meaning or validation might change.

## Recovery scenarios
Power loss and full edge failure are not availability guarantees; test post-restart recovery. Worker crash after submission but before response is critical. WAN disruption during bootstrap, partial metadata import, and checkpoint disagreement must trigger safe stop/quarantine, not blind progression.
