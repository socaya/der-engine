# Scope and change-control rules

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

## In scope — academic prototype
Selected DHIS2 2.43+ aggregate, event and Tracker use cases; version-pinned DHIS2 backend or justified compatibility alternative; edge-local metadata and supported validation; existing authorised identities under a documented offline policy; persistent shared LAN data; concurrency management; durable operation tracking; bidirectional data/metadata exchange where supported; conflict classification, audited manual review, restart recovery; an admin console; experimental evidence.

## Explicitly out of scope
All DHIS2 modules/versions, all Tracker permutations, automatic resolution of arbitrary business conflicts, client-to-client P2P, continuity when edge power or LAN fails, multi-edge HA, nationwide rollout, production clinical certification, unsupported DHIS2 database mutations, automatic offline registration for unknown users without a specified trust model.

## Backlog classifications
**P0** required for the selected demonstrator; **P1** required to operate/test the demonstrator reliably; **P2** production-oriented extension. A 54-screen design inventory does not require rebuilding each native DHIS2 page; reuse a supported original interface and document reuse. Do not mark reused screens as implemented before verifying compatibility.

## Change procedure
1. Register change ID, proposer, date, source and reason.
2. Identify impacted OBJ, FR/NFR, screens, architecture, tests, security, time and DHIS2 version.
3. Classify: clarification, defect correction, scope addition, breaking change.
4. Approve or reject in a decision record; supervisor approval for material research changes.
5. Update linked docs/tests, then code. Keep original requirement ID or explicitly supersede with history.
6. Never silently downgrade P0, erase test failures, or represent prototype features as production-ready.

## Stop-work triggers
Unverified central API import outcome, irreversible data loss, accidental security bypass, uncertain authorisation rules, unsafe direct DHIS2 table writes, discrepancy with proposal objective, missing repeatable acceptance evidence.
