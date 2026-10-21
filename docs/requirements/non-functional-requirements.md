# Complete non-functional requirements catalogue

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.


These are the **35 baseline NFR acceptance/verification statements**. Numeric thresholds must be pinned before evaluation; a recommendation is not measured evidence.

### NFR-01 — Availability (P0)
**Acceptance criterion:** During a WAN-only partition with operational edge and LAN, all declared supported local workflows remain available.  
**Associated suite:** T15  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-02 — Durability (P0)
**Acceptance criterion:** No acknowledged local commit is lost in tested application/worker restart cases; durable outbox remains consistent.  
**Associated suite:** T09  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-03 — Atomicity (P0)
**Acceptance criterion:** A business change and corresponding pending journal intent are committed atomically or both rolled back.  
**Associated suite:** T09  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-04 — Consistency (P0)
**Acceptance criterion:** Zero unexpected invalid references or silent lost updates in predefined integrity cases.  
**Associated suite:** T10  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-05 — Authorisation (P0)
**Acceptance criterion:** 100% of predefined forbidden access attempts are rejected across UI and direct API paths.  
**Associated suite:** T03  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-06 — Confidentiality (P0)
**Acceptance criterion:** Protect transport, credentials, privileged logs and stored backups in accordance with selected policies.  
**Associated suite:** T03  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-07 — Local visibility (P0)
**Acceptance criterion:** Every acknowledged local commit is retrievable by a second authorised client without central access.  
**Associated suite:** T08  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-08 — API parity (P0)
**Acceptance criterion:** For declared deterministic equivalent operations, edge and reference responses/record effects match defined oracles.  
**Associated suite:** T20  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-09 — Validation parity (P0)
**Acceptance criterion:** 100% agreement for the pinned set of reference comparison fixtures; report unsupported semantics separately.  
**Associated suite:** T20  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-10 — Conflict precision (P0)
**Acceptance criterion:** 100% of integrity-critical known conflicts detected in seeded tests; report overall precision and recall.  
**Associated suite:** T11  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-11 — Retry safety (P0)
**Acceptance criterion:** Zero unintended duplicate business objects in the defined repeat/lost-acknowledgement tests.  
**Associated suite:** T12  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-12 — Accounting (P0)
**Acceptance criterion:** Each eligible journal operation has a traceable pending, accepted, rejected, uncertain or review-required outcome.  
**Associated suite:** T13  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-13 — Recoverability (P0)
**Acceptance criterion:** Application/sync restart yields no missing committed operations and restores consistent processing state.  
**Associated suite:** T17  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-14 — Security freshness (P0)
**Acceptance criterion:** Offline privilege and credential freshness decisions follow documented deny/expiry policy.  
**Associated suite:** T02  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-15 — Performance latency (P1)
**Acceptance criterion:** Measure p50/p95 latency at fixed 5/10/20-user workloads; candidate p95 under 2 s for selected simple requests, pending feasibility.  
**Associated suite:** T19  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-16 — Throughput (P1)
**Acceptance criterion:** Report sustained successful writes/s and reads/s for configured workloads and reference hardware.  
**Associated suite:** T19  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-17 — Backlog recovery (P0)
**Acceptance criterion:** Measure time to stable central outcomes after restoration for backlog sizes 100/1000 and report unresolved items.  
**Associated suite:** T16  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-18 — Resource budget (P1)
**Acceptance criterion:** Measure and publish CPU, memory and disk storage growth under each workload; limits set before acceptance.  
**Associated suite:** T19  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-19 — Scalability (P1)
**Acceptance criterion:** Test increasing local client concurrency at 1/5/10/20 sessions and report saturation and errors.  
**Associated suite:** T19  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-20 — Observability (P1)
**Acceptance criterion:** Provide operator-visible health, last successful sync, queue depth, rejection and conflict metrics.  
**Associated suite:** T17  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-21 — Auditability (P0)
**Acceptance criterion:** Every conflict decision and privilege-changing operation includes accountable actor, time and outcome.  
**Associated suite:** T11  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-22 — Interoperability (P0)
**Acceptance criterion:** All integrations use documented pinned-version DHIS2 APIs or supported reuse mechanisms; exceptions logged.  
**Associated suite:** T20  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-23 — Maintainability (P1)
**Acceptance criterion:** Implementation separated into tested local execution, persistence, journal, sync and administrative components.  
**Associated suite:** T20  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-24 — Portability (P1)
**Acceptance criterion:** Reproduce prototype in documented reference Linux/server environment using versioned deployment steps.  
**Associated suite:** T01  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-25 — Usability (P1)
**Acceptance criterion:** Users can distinguish locally committed from centrally accepted records; errors are actionable.  
**Associated suite:** T07  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-26 — Accessibility (P2)
**Acceptance criterion:** Use semantic forms, keyboard navigation and readable states in any new administration interfaces.  
**Associated suite:** T20  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-27 — Test reproducibility (P0)
**Acceptance criterion:** Repeat test scenarios with fixed seed, reset conditions, version record and uniquely identified runs.  
**Associated suite:** T19  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-28 — Time correctness (P1)
**Acceptance criterion:** Document time source/time zone and detect unsafe clock drift in test setup.  
**Associated suite:** T14  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-29 — Backup integrity (P1)
**Acceptance criterion:** A verified restoration retains committed records and their pending/accepted reconciliation history.  
**Associated suite:** T18  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-30 — Graceful degradation (P0)
**Acceptance criterion:** When disk, DB or credentials prevent durable acceptance, reject explicitly; never report false success.  
**Associated suite:** T18  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-31 — Data minimisation (P0)
**Acceptance criterion:** Synthetic data only for planned university experiments; collect only necessary audit details.  
**Associated suite:** T20  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-32 — No central coupling (P0)
**Acceptance criterion:** A successful supported local operation makes no blocking central API call on its critical path.  
**Associated suite:** T15  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-33 — Metadata safety (P0)
**Acceptance criterion:** An incompatible metadata change does not silently reinterpret unacknowledged local operations.  
**Associated suite:** T14  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-34 — Failure isolation (P0)
**Acceptance criterion:** Sync worker failures do not crash or block supported local application execution.  
**Associated suite:** T17  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.

### NFR-35 — Deployment transparency (P0)
**Acceptance criterion:** Report exact DHIS2 version, metadata fixture, software dependencies, hardware and unsupported cases.  
**Associated suite:** T01  
**Evidence:** Record environment, workload, result, source logs and pass/fail status.
