# Operations, health, backup and restart recovery

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

## Observable metrics
Local request success/latency, active sessions, database pool usage, journal backlog by state, oldest pending age, sync attempt rate, accepted/rejected/uncertain ratios, conflicts by reason, last verified central result, metadata fingerprint, disk free space and restore verification. Health must not label an edge unavailable merely because central is unreachable.

## Operator runbooks
**WAN outage:** verify local app + DB health; stop expecting central accepts; ensure journal grows under disk limits; never disable validation. **Sync backlog:** check credentials, API changes, failure class, dependencies, retry policy, disk; do not indiscriminately clear queue. **Uncertain submission:** inspect effect by stable ID/record before retry. **Conflict:** authorised reviewer examines versions, validation and relationships; action audited. **Metadata drift:** pause affected queue, refresh/revalidate snapshot, resume only safe items.

## Backup procedure
Capture consistent supported DHIS2 database backup plus DER-owned metadata/journal state with coordinated recovery point; encrypt and checksum manifests where required; test restoration on isolated host before claiming recovery. A database backup without journal consistency can cause replays or missing accepted state.

## Restart test
Create accepted local transaction and queued operation -> stop DER worker before/after remote call -> restart -> query same record and journal -> verify remote effect or safe retry -> confirm no duplicate imported business record. Preserve trace artifacts.

## Incident recording
Log UTC time, version, affected site, symptoms, reproduction, blast radius, containment, corrective action, test evidence and any unresolved record state; do not erase conflicting entries or sensitive evidence.
