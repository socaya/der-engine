# Requirements lifecycle and prioritisation

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

There are 176 functional requirements, 35 non-functional requirements and 54 planned UI screen specifications from the established DER baseline. These counts describe documented intentions, not completed software. Every `FR-xx-yy` and `NFR-xx` remains stable across refactoring; use `status=specified|implemented|verified|deferred|rejected`, include reviewer and evidence link. P0 must be verified against a real pinned DHIS2 integration where relevant; P1 must have exercised operational evidence; P2 may be deferred without claiming complete platform delivery.

## Definition of requirement completion
- Source and expected result are explicit; design owner and code path identified.
- Happy path, denial path and at least one relevant failure/recovery path are tested.
- Screen behaviour is traced if user-facing; no bypass by calling API directly.
- Integration tests use actual DHIS2 endpoints for DHIS2-dependent functionality.
- Requirement-specific tests pass; coverage reports cannot substitute for behaviour.
- A recorded evidence link exists and requirement is marked `verified` only after review.

## Completeness accounting
Report verified numerator/denominator separately for P0, P1 and P2; count neither partial implementation nor disabled tests as complete. A phase passes only when 100% of committed applicable phase cases pass, all committed P0 requirements are evidenced, and no critical defects remain. If 100% line/branch coverage is used as a gate, define instrumented DER-owned code boundaries and justified exclusions beforehand; coverage does not prove correctness.
