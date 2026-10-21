# Glossary, invariants and assumptions

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

| Term | Precise meaning |
|---|---|
| Edge | Site-hosted application environment shared by authorised clients over LAN |
| Central | Authoritative DHIS2 instance for consolidated data and centrally managed configuration |
| WAN disconnected | Edge cannot reach central DHIS2; LAN and edge remain operational |
| Local commit | Transaction durably accepted by the edge; **not** central acceptance |
| Central acceptance | Verified successful application of the eligible change at central DHIS2 |
| Journal | Durable record of a change and its transmission/reconciliation lifecycle |
| Conflict | Incompatible changes or invariants requiring explicit policy or human judgement |
| Drift | Central/edge metadata, permission or version divergence |
| Compatible | Tested against a specific pinned DHIS2 patch, not presumed to work on all `2.43+` |

## Immutable design invariants
- Device clients use the edge endpoint in both connected and disconnected modes.
- WAN interruptions do not block supported local commits.
- Local commit and central reconciliation are separately acknowledged in API and UI.
- No unverified exactly-once transport assumption; retry safety is proven per operation class.
- No silent overwrite of incompatible updates or illegal references.
- The edge's availability guarantee assumes functional LAN, edge host, database and power.
- Unsupported operations are rejected or explicitly unavailable, never simulated as successful.

## Assumptions to verify at architecture gate
Exact DHIS2 2.43.x patch and supported Java/PostgreSQL versions; central integration privilege model; available Tracker and aggregate APIs; metadata access; how business-write capture is made durable; offline user policy; legal data-retention requirements; permitted synthetic reference fixtures; representative hardware and workload.
