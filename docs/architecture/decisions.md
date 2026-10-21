# Required architecture decisions

1. Pinned DHIS2 version, supported APIs and supported workflow subset.
2. Full-instance versus selective compatibility versus hybrid hosting; evidence and trade-offs.
3. Secure offline identity bootstrap and permission staleness.
4. Durable change capture tied to DHIS2 commit semantics.
5. Operation identity, idempotency/replay and central acknowledgement interpretation.
6. Conflict policy for aggregate, event and Tracker modifications.
7. Central-to-edge changes, metadata refresh and schema drift.
8. Edge server and LAN availability assumptions.

Capture options, decision, rationale, experiment/test, owner and review date for each.
