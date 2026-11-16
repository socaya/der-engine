# NFR-07 — Two-client local retrieval (local-first)

**ID:** nfr-07-two-client-local-retrieval
**Status:** PINNED
**Evidence class:** executable scenario (in-repo MockMvc)
**Covered requirement:** NFR-07 "Every acknowledged local commit is
retrievable by a second authorised client without central access."

## Preconditions

- Two distinct authenticated sessions (different users, different
  cookies, different device fingerprints).
- Both sessions address the same DER appliance (same
  `operation_journal` + `aggregate_data_value` tables in prod; the
  scenario shares an `AtomicReference<AggregateDataValue>` in test).
- No central DHIS2 reachable. Enforced architecturally by NFR-32's
  reflection pin (no `HttpClient` / `Dhis2ReferenceClient` on the
  write-path services); this scenario proves the complementary
  observational property.

## Fixture

- Alice: `userId=a0000000-...-a11`, username `alice`, role
  OPERATOR, DHIS2-origin.
- Bob:   `userId=b0000000-...-b22`, username `bob`,   role
  OPERATOR, DHIS2-origin.
- DataValue triple: `DE_WEIGHT` × `OU_CLINIC_A` × `2026W46`,
  value `"42"`, dataSet `DS_WEEKLY`.

## Scenario

1. **Alice POST** `/api/dataValueSets` with the single-row
   payload. Service returns `ImportSummary(imported=1, ignored=0,
   conflicts=[])`. The write sink captures an
   `AggregateDataValue(..., submittedBy=alice, submittedAt=T0,
   valueVersion=1)`.
2. **Bob GET** `/api/dataValueSets?orgUnit=OU_CLINIC_A&
   period=2026W46`. The repo reads back the captured row and the
   controller marshals it to the DHIS2 shape.
3. Assertions on Bob's response body:
   - `dataValues[0].dataElement == DE_WEIGHT`
   - `dataValues[0].orgUnit     == OU_CLINIC_A`
   - `dataValues[0].period      == 2026W46`
   - `dataValues[0].value       == "42"`
   - `dataValues[0].stored_by   == <Alice's UUID>` — the load-
     bearing claim: identity carries across clients.
   - `dataValues[0].lastUpdated == T0` — the exact submittedAt
     the service produced, not a repo-side adjustment.

## Invariants pinned

1. **Write-then-read across sessions** — Bob observes the exact
   value Alice wrote. The share-visibility is at the storage
   layer (same repo row); neither client makes a central call.
2. **Identity preservation** — `stored_by` is Alice's UUID even
   when Bob is the reader. Pins the "every acknowledged local
   commit" phrasing against a silent downgrade that would re-stamp
   stored_by with the reader's id.
3. **Timestamp preservation** — `lastUpdated == submittedAt`,
   not `now()`. Guards against the repo accidentally stamping a
   read-time timestamp that would make the row look fresher
   than it is.
4. **Zero data leak to anonymous callers** — the third test case
   pins that an unauthenticated GET returns 401. "Second
   authorised client" is read strictly; no backdoor retrieval.

## Evidence pointer

Executable at
`server/src/test/java/ug/ac/mak/der/nfr/Nfr07TwoClientRetrievalScenarioTest.java`.
Runs under `mvn -DskipITs -Dtest='Nfr07*' test` and appears in
the every-release gate output.

## Reset instructions

None required — all state is in-process (`AtomicReference` sink).
No DB fixtures.

## Cross-references

- NFR-32 architectural pin:
  `server/src/test/java/ug/ac/mak/der/nfr/Nfr32NoCentralCouplingTest.java`
- Shipped critical write paths: `AggregateDataValueService`,
  `EventService`, `TrackerService`.
- ADR: ADR-0010 durable journal.
