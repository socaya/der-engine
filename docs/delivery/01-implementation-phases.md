# Phased delivery with evidence gates

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

| Phase | Deliverable | Exit evidence |
|---|---|---|
| 00 Baseline | Approved scope, FR/NFR inventory, toolchain, version policy | Requirements IDs unique, build/test commands known |
| 01 Compatibility | DHIS2 2.43.x spike, architecture ADR, API matrix | Live reference contract tests + rejected alternatives |
| 02 Edge foundation | Local DHIS2, DB, identity, TLS, bootstrap | Edge health and offline access tests |
| 03 Shared workflows | Supported aggregate/event/Tracker, shared reads, concurrency | Two distinct clients perform dependent offline pathway |
| 04 Outbound | Atomic capture mechanism, durable journal, central imports | Commit/restart/lost-ack/duplicate tests |
| 05 Inbound/conflicts | Central change detection, drift, manual review | Divergence cases and policy tests |
| 06 Reliability | Monitoring, security, backups, recovery | Restore and fault-injection drill |
| 07 UI | 18 client + 36 admin screen specifications mapped/reused/implemented | Per-screen responsive/accessibility/API tests |
| 08 Evaluation | Synthetic datasets, controlled WAN fault tests, statistics | Repeatable raw results, no discarded failures |
| 09 Release | Verified DER release, guides, known limitations | Full build matrix, no outstanding critical defects |

## Strict gate
No phase advances if a committed P0 item lacks passing test/evidence. Require all tests for the phase passing, and enforce 100% line/branch coverage for **defined instrumented DER-owned production logic** where agreed; document excluded compiler-generated/bootstrap code and require behaviour, mutation/negative, integration and real DHIS2 verification. Tests can have coverage and still miss important faults. Screen inventory coverage means every screen has a reviewed design and implementation/reuse disposition; 54 screens do not all become custom page rewrites.

## Academic scope discipline
If 16-week schedule or hardware cannot support optional work, defer P2 transparently; do not change OBJ-1..4 or misstate achievements. Separate specification-complete from working prototype-complete.
