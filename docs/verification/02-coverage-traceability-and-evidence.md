# Evidence register and test traceability

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

See `traceability-matrix.csv` (211 FR/NFR rows) and `screen-traceability.csv` (54 screen rows). These are actual baseline identifiers, but verification state is deliberately **specified** until code is run. Do not convert blank evidence fields into passing claims.

## Required evidence naming
`evidence/<der-version>/<dhis2-patch>/<test-suite>/<run-id>/` includes command, environment manifest, synthetic fixture hash, raw logs, result JSON, screen capture where relevant, acceptance assertion and pass/fail. Record commit hash and migration version. Run evidence must show executable endpoints and real DB effects for integration cases.

## Acceptance reporting
Publish counts: applicable, passed, failed, skipped, blocked, not-run, exempted (approved reason), and requirement verified percentages. A skipped test is **not** a pass. A 100% gate means 100% of applicable tests passed plus separate 100% measured coverage on declared target code; it does not imply all conceivable behaviours are proven.
