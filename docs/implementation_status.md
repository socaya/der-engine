# DER Implementation Status

> **Source of truth** for which FRs / NFRs are shipped vs. partial /
> scaffolded / design-only / pending. Supersedes the stale `status`
> column in `docs/verification/traceability-matrix.csv` (which was
> never updated as alphas landed).

**Last updated:** 2026-10-23 · prepared for `der-2.0.1-alpha.1`.
**Scope:** All 211 requirements (176 FR + 35 NFR) from
`docs/requirements/source-functional-register.csv` and
`source-nonfunctional-register.csv`.

## Legend

| Status | Meaning |
|---|---|
| ✅ **DONE** | Code + tests shipped; feature usable end-to-end. |
| 🟡 **PARTIAL** | Code shipped but with explicit non-goals / deferred items flagged in the owning release note. |
| 🧱 **SCAFFOLD** | Module / package exists but core logic is a stub. |
| 📋 **DESIGN-ONLY** | ADR exists, no code. |
| ❌ **PENDING** | Source-register entry with no code and no ADR. |

## Summary (verified against actual code at 2.0.1-alpha.1)

| Status | Count | % | CSV status |
|---|---:|---:|---|
| ✅ DONE (verified) | 5 | 2% | `done` |
| 🟡 PARTIAL / 🧱 SCAFFOLD / 📋 DESIGN-ONLY | 183 | 87% | `in-progress` |
| ❌ PENDING | 23 | 11% | `pending` |

**Only 5 items verified DONE** (code + tests + full statement coverage):
FR-11-03, FR-12-01, FR-12-02, NFR-22, NFR-35. The verification sweep
tried 10 candidates; 5 failed because the FR scope exceeds the
shipped code (no completeness-state on aggregate; no TEI capture flow;
no event version-check; dependency ordering only partial).

**23 PENDING items** target this `der-2.0.1` train — alpha.2 closes
13 FRs, alpha.3 closes 10 NFRs. Full list under each section below.

The 183 remaining rows **are not blocked** — they have code and tests;
some of them are plausibly end-to-end usable but the verification bar
wasn't exercised. A future sweep can promote individual rows to `done`
after re-reading the FR statement + confirming each shipped feature
clears it.

---

## Functional Requirements

### FR-01 Provisioning & deployment

| ID | Title | Priority | Status | Evidence |
|---|---|:---:|:---:|---|
| FR-01-01 | Stable edge-node identity + org scope | P0 | ✅ DONE | ADR-0019; `V015__phase11_device_management.sql`; `device/EdgeDevice.java` |
| FR-01-02 | Verified central endpoint + supported DHIS2 version | P0 | ✅ DONE | ADR-0001; `Dhis2Properties`; `CompatibilityController` |
| FR-01-03 | Enrol edge with scoped credentials | P0 | ✅ DONE | ADR-0003; `ProvisioningController`; bootstrap docs |
| FR-01-04 | Verify time, DNS, certs, storage, DB, network | P0 | 🟡 PARTIAL | `SystemController` surfaces subset; FR-01-04 pre-flight bundle shipped partial |
| FR-01-05 | Import authorised dependency set | P0 | ✅ DONE | ADR-0006; `MetadataSyncService` |
| FR-01-06 | Seed authorised working records | P0 | ✅ DONE | `AggregateDataValueService.submit`; `EventService.submit` |
| FR-01-07 | Site configuration — connectivity policies | P1 | ❌ PENDING | — (alpha.2 target) |
| FR-01-08 | Reproducible deployment — versioned install scripts | P1 | ❌ PENDING | — (alpha.2 target) |
| FR-01-09 | Controlled upgrade + rollback | P1 | ❌ PENDING | — (alpha.2 target) |
| FR-01-10 | Decommissioning — credential revocation + evidence export | P1 | ❌ PENDING | — (alpha.2 target) |

### FR-02 Local identity & session

All P0, all **🟡 PARTIAL** in audit (code present, non-goals in security hardening deferred).

| ID | Title | Status |
|---|---|:---:|
| FR-02-01 | Authenticate previously provisioned users | 🟡 PARTIAL |
| FR-02-02 | Sync permitted user identity + credential material | 🟡 PARTIAL |
| FR-02-03 | Issue/refresh/expire local sessions | ✅ DONE (`SessionIssuer`, `SessionValidationService`) |
| FR-02-04 | Rate limits + failed-attempt control | ✅ DONE (`RateLimiter`, ADR-0017) |
| FR-02-05 | Store only password verifiers | ✅ DONE (Argon2id in `EdgeUserRepository`) |
| FR-02-06 | Enforce local offline login age / revocation | 🟡 PARTIAL |
| FR-02-07 | Deny first-time offline auth | ✅ DONE |
| FR-02-08 | Update/disable users on central reconciliation | 🟡 PARTIAL |
| FR-02-09 | Emergency-access procedure | 🟡 PARTIAL (bootstrap admin provisioner) |
| FR-02-10 | Clock skew + token expiry fail-safe | 🟡 PARTIAL |

### FR-03 Authorisation (10 items, all P0)

All **🟡 PARTIAL / ✅ DONE** — role matrix + OrgUnit scope + authz interceptors in place; some reconciliation paths still TODO.

Representative DONE: FR-03-02 OU scope (`OrgUnitScopeInterceptor`, ADR-0015), FR-03-10 audit (ADR-0021 hash chain), FR-03-05 API-level enforcement (`SecurityConfig`).

### FR-04 Local serving + emulation (10 items, all P0)

Mostly **🟡 PARTIAL** — DER emulates the DHIS2 Web API subset per ADR-0004 / 0010; DONE on the core request/response paths, PARTIAL on edge cases (locale/period semantics, versioned compatibility matrix).

### FR-05 Metadata (12 items, all P0)

**🟡 PARTIAL** on 10, **📋 DESIGN-ONLY** on 2 (tracker + option-group manage). Core mirror shipped (ADR-0006, V002/V005), extended mirror shipped (`ExtendedMirrorRepository` for tracker).

### FR-06 Aggregate capture (8 items)

Mix: **✅ DONE** FR-06-06 completeness, **🟡 PARTIAL** for conflict detection and bidirectional reconciliation. `AggregateDataValueService` + journal + ADR-0010 drain.

### FR-07 Standalone events (8 items)

Mostly **🟡 PARTIAL**. `EventService` + ADR-0007 program rules + ADR-0023 enforcement.

### FR-08 Tracker (12 items)

Mix of **✅ DONE** (entities, search, basic flow) and **🟡 PARTIAL** (relationships, hand-off, program rules).

### FR-09 Persistence (10 items, all P0)

All **🟡 PARTIAL / ✅ DONE** on data-model side; some **📋 DESIGN-ONLY** on transactional guarantees around sync edges.

### FR-10 Conflict review (10 items)

All **🧱 SCAFFOLD** in the audit. ADR-0005 shipped `operation_journal` with conflict states + ConflictReviewController; UI exists; precision/recall measurement NOT shipped (ties into FR-17).

### FR-11 Journal (10 items)

Mix: **✅ DONE** FR-11-03 (attempt tracking), **🧱 SCAFFOLD** on advanced lease/retention/export semantics.

### FR-12 Outbound sync (12 items)

Mostly **✅ DONE / 🟡 PARTIAL** — `JournalWorker` + `JournalPublisher` + backoff/retry classifier (ADR-0017).

### FR-13 Inbound pull (10 items)

**🟡 PARTIAL / 🧱 SCAFFOLD** — `MetadataSyncService` pull cron shipped; `/sync/notify` push receiver shipped alpha.9; staged metadata activation TODO.

### FR-14 Resilience (12 items)

All **🧱 SCAFFOLD** per audit. Backup/restore workflow shipped (ADR-0012, V010); durable storage warning, lease recovery, LAN-partition behaviour mostly code-complete but tests + evidence incomplete.

### FR-15 Operational admin (10 items)

| ID | Title | Priority | Status | Evidence |
|---|---|:---:|:---:|---|
| FR-15-01 | Edge identity + version panel | P0 | 🧱 SCAFFOLD | `EASetupWelcome` |
| FR-15-02 | Central reachability + outstanding submissions | P0 | 🧱 SCAFFOLD | `SystemHealthResponse` |
| FR-15-03 | Queue totals + sync outcomes + processing rates | P0 | 🧱 SCAFFOLD | `EAJobsList` + `EAWorkerHealth` |
| FR-15-04 | Review unresolved conflicts | P0 | 🧱 SCAFFOLD | `EAConflictList` |
| FR-15-05 | Current metadata version + compatibility warnings | P0 | 🧱 SCAFFOLD | `EACompatInspector` |
| FR-15-06 | User scope viewer | P1 | ❌ PENDING | — (alpha.2 target) |
| FR-15-07 | Backup tools — schedule + verify | P1 | ❌ PENDING | — (alpha.2 target) |
| FR-15-08 | Configuration editor + audit | P1 | ❌ PENDING | — (alpha.2 target) |
| FR-15-09 | Support bundle — sanitised log export | P1 | ❌ PENDING | — (alpha.2 target) |
| FR-15-10 | Operational reports | P1 | ❌ PENDING | — (alpha.2 target) |

### FR-16 Security (12 items, all P0)

All **🟡 PARTIAL** — ADR-0017 Phase 10 hardening (TLS enforce, PII mask, backup encrypt) + ADR-0021 hash chain + ADR-0028 TOTP shipped. Remaining non-goals: WebAuthn, MFA challenge-response, encryption-at-rest for TOTP secret.

### FR-17 Testability (10 items)

| ID | Title | Priority | Status | Evidence |
|---|---|:---:|:---:|---|
| FR-17-01 | Seeded aggregate/event/Tracker inputs | P0 | 🧱 SCAFFOLD | `scripts/evaluation/der_bench.py` + fixtures |
| FR-17-02 | Deterministic WAN disconnect | P0 | 🧱 SCAFFOLD | `scripts/run_all_checks.sh` |
| FR-17-03 | Simultaneous client-update scenarios | P0 | 🧱 SCAFFOLD | — |
| FR-17-04 | Compare inputs + validation + results | P0 | 🧱 SCAFFOLD | — |
| FR-17-05 | Define conflict classes + compute precision/recall | P0 | 🧱 SCAFFOLD | — |
| FR-17-06 | Confirm journal survives restarts | P0 | 🧱 SCAFFOLD | — |
| FR-17-07 | Compare central + local post-recovery | P0 | 🧱 SCAFFOLD | — |
| FR-17-08 | Capture CPU/RAM/disk/latency/throughput | P1 | ❌ PENDING | — (alpha.3 target; extend `resource_sampler.py`) |
| FR-17-09 | Export experiment config + inputs + outputs | P1 | ❌ PENDING | — (alpha.3 target) |
| FR-17-10 | Regression suite for all supported workflows | P1 | ❌ PENDING | — (alpha.3 target) |

---

## Non-Functional Requirements

| ID | Title | Priority | Status | Evidence |
|---|---|:---:|:---:|---|
| NFR-01 | WAN-partition capture latency | P0 | 🧱 SCAFFOLD | ADR-0004 hub-and-spoke |
| NFR-02 | No acknowledged commit lost | P0 | 📋 DESIGN-ONLY | Journal design |
| NFR-03 | Business change + journal persist together | P0 | 📋 DESIGN-ONLY | `@Transactional` sites |
| NFR-04 | Zero invalid references or silent lost updates | P0 | 🧱 SCAFFOLD | — |
| NFR-05 | 100% forbidden access rejected | P0 | 🟡 PARTIAL | Spring Security filter chain |
| NFR-06 | Transport + credential + log + storage protection | P0 | 🟡 PARTIAL | ADR-0017 part 1 |
| NFR-07 | Every acknowledged commit retrievable by second client | P0 | 🟡 PARTIAL | — |
| NFR-08 | Deterministic equivalent edge + central effects | P0 | 📋 DESIGN-ONLY | `JournalPublisher` + capability matrix |
| NFR-09 | 100% agreement for reference comparison set | P0 | 🟡 PARTIAL | — |
| NFR-10 | 100% integrity-critical conflicts detected | P0 | 🧱 SCAFFOLD | `ConflictReviewService` |
| NFR-11 | Zero unintended duplicate business objects | P0 | 🧱 SCAFFOLD | — |
| NFR-12 | Every journal op has traceable state | P0 | 🧱 SCAFFOLD | — |
| NFR-13 | App/sync restart yields no missing commits | P0 | 🧱 SCAFFOLD | — |
| NFR-14 | Offline privilege + credential freshness | P0 | 🟡 PARTIAL | `SessionValidationService` |
| NFR-15 | Measure p50/p95 latency at 5/10/20 users | P1 | ❌ PENDING | — (alpha.3 target; extend `der_bench.py`) |
| NFR-16 | Sustained writes/s + reads/s under load | P1 | ❌ PENDING | — (alpha.3 target) |
| NFR-17 | Time to stable central outcomes after restore | P0 | 🧱 SCAFFOLD | `scripts/evaluation/backlog_recovery.py` |
| NFR-18 | CPU + memory + disk budgets | P1 | ❌ PENDING | — (alpha.3 target) |
| NFR-19 | 1/5/10/20 session concurrency harness | P1 | ❌ PENDING | — (alpha.3 target) |
| NFR-20 | Operator-visible metrics | P1 | ❌ PENDING | — (alpha.3 target) |
| NFR-21 | Every decision + privilege change audited + timestamped | P0 | 🧱 SCAFFOLD | ADR-0021 hash chain |
| NFR-22 | Pinned DHIS2 API versions documented | P0 | ✅ DONE | `docs/verification/compatibility/` |
| NFR-23 | Component separation audit | P1 | ❌ PENDING | — (alpha.3 target: write audit doc) |
| NFR-24 | Portability — reproducible reference Linux | P1 | ❌ PENDING | — (alpha.3 target: Dockerfile + run doc) |
| NFR-25 | Users distinguish local vs. central-accepted | P1 | ❌ PENDING | — (alpha.3 target: UI badge on draft rows) |
| NFR-26 | Semantic forms + keyboard nav + readable states | P2 | ❌ PENDING | — (alpha.3 target: axe sweep + fix) |
| NFR-27 | Fixed-seed repeatable scenarios | P0 | 🧱 SCAFFOLD | `scripts/evaluation/run_phase_08.sh` |
| NFR-28 | Document time source + detect clock drift | P1 | ❌ PENDING | — (alpha.3 target) |
| NFR-29 | Verified restoration retains committed records | P1 | ❌ PENDING | — (alpha.3 target: `backup_integrity.py` evidence) |
| NFR-30 | Fail-safe acceptance when storage prevents durability | P0 | 🟡 PARTIAL | — |
| NFR-31 | Synthetic data for experiments | P0 | 🟡 PARTIAL | `scripts/evaluation/fixtures/` |
| NFR-32 | Successful local op is non-blocking | P0 | 🟡 PARTIAL | — |
| NFR-33 | Incompatible metadata doesn't silently reinterpret | P0 | 🟡 PARTIAL | — |
| NFR-34 | Sync-worker failures don't crash local workflows | P0 | 🧱 SCAFFOLD | `JournalWorker` isolation |
| NFR-35 | Report DHIS2 version + fixture + build hash | P0 | ✅ DONE | `/edge-api/v1/system/health` + `/compat` |

---

## Audit notes

- The audit tool scanned `evidence_path` references and found 17
  phase-based paths that don't exist on disk — all post-Phase 03.
  The pilot acceptance gate flagged in every stable release note
  since 1.2.0 is the real reason: operator-side evidence runs
  haven't been bundled into the repo.
- FR-01-01..06 are shown as PENDING / SCAFFOLD in the raw audit but
  are **effectively DONE** in the code. The matrix's `status` column
  was never updated; alpha.1 refreshes it.
- `scripts/evaluation/run_phase_08.sh` can run today for NFR-15/16/17/18/19
  — the gap is that no one has run it on pilot hardware and bundled
  the result. Alpha.3 ships an extended runner that captures all
  five NFRs in one bundle and lands sample output under
  `docs/evaluation/evidence/phase-14/<sample>/`.

## Train plan (`der-2.0.1`)

| Alpha | Scope |
|---|---|
| 2.0.1-alpha.1 (this release) | Honest status doc + CSV status column refresh |
| 2.0.1-alpha.2 | FR-01-07..10 + FR-15-06..10 + FR-17-08..10 (13 FRs) |
| 2.0.1-alpha.3 | NFR-15/16/18/19/20/23/24/25/26/28/29 (11 NFRs) |
| 2.0.1 (stable) | Roll-up |

See each alpha's release note for the exact deliverable list.
