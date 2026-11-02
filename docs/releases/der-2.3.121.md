# der-2.3.121 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.120`

## Headline

**R-AQ closed — repo-mapper guard added.** The last of the three
R-AQ items ships here: a static-source tripwire that fails the build
when any repository SELECT omits a column that the row mapper reads.
Also folds in a one-line fix to the stale `insertEmitsAllColumns`
test (uncovered by the new coverage run) so journal repository tests
are fully green.

## 1. R-AQ/3 — `OperationJournalRepositorySelectCoverageTest`

**Guards against the 2.3.119 regression class.** The 2.3.119
"invalid credentials" bug was `OperationJournalRepository.findById`
emitting a SELECT that was missing `workflow_run_id`, which the
shared `rowMapper()` reads unconditionally. The resulting
`BadSqlGrammarException` was then rewritten to HTTP 401 by the
security entry point (fixed in 2.3.120 by permit-listing `/error`).

The repository has six separate SELECT statements that share the same
row mapper; keeping them aligned by convention is fragile. This test
reads the repository source, extracts every `rs.get*("col")`
reference in the row mapper, extracts every `SELECT … FROM
der.operation_journal` statement (gluing concatenated string
literals), and asserts each SELECT emits every required column.

**Proof it catches the real regression:** removing `workflow_run_id`
from `findById`'s SELECT during development reproduced:

```
SELECT near line 83 missing columns [workflow_run_id] (full: SELECT
operation_id, entity_type, entity_ref, payload_json, state,
attempt_count, last_error, submitted_by, created_at, updated_at,
next_hop_org_unit_uid FROM der.operation_journal WHERE
operation_id = ?)
```

— exactly the failure mode that cost ten minutes of debugging in
2.3.119. The test runs in 60 ms and needs no database (static text
scan over the source file at test time), so it joins the always-on
test suite rather than being gated on Testcontainers.

### Scope

The guard is scoped to `OperationJournalRepository` for now. The
pattern — one shared row mapper + many near-identical SELECTs — is
specific to this class; most other repositories either have a single
SELECT or use `BeanPropertyRowMapper` which can't drift. If a second
repository grows the same shape later, lift the scanner into a
reusable test helper.

## 2. Fixed `insertEmitsAllColumns` test

The existing journal repository test asserted 11 arguments to
`jdbc.update(…)`, but the production insert statement already passed
12 (including `workflow_run_id`). Mockito reported it as "actual
invocation has different arguments". Added the missing
`eq((Object) null)` so the test matches the real insert.

## 3. Live verification

```
./mvnw test -Dtest='OperationJournal*'
→ 19 tests, 0 failures, 0 errors (incl. new coverage guard)
```

## 4. Files changed

```
server/src/test/java/.../OperationJournalRepositorySelectCoverageTest.java
                                             — new tripwire test
server/src/test/java/.../OperationJournalRepositoryTest.java
                                             — insert expectation
                                               += workflow_run_id

VERSION / server/pom.xml / admin-ui/package.json
  / admin-ui/public/sw.js                    — 2.3.121
```

## 5. R-AQ closed

| # | Item | Shipped |
|---|------|---------|
| 1 | `/error` permit so controller exceptions surface as 500 with message | 2.3.120 |
| 2 | Queue header "Last cleaned <ago> · <n> rows" chip | 2.3.120 |
| 3 | Defensive stopPropagation on all three Data Lineage buttons | 2.3.120 |
| 4 | Repo-mapper coverage guard | 2.3.121 |

Nothing else is open for R-AQ. Next up: whatever the operator reports
after exercising the Lineage buttons post-2.3.120 (SW cache will
clear on hard-reload now that both 2.3.120 and 2.3.121 have bumped
`SW_VERSION`).
