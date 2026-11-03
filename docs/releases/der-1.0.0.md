# DER 1.0.0 — stable release (draft, pilot-evidence pending)

> **Status:** Draft. The stable `der-1.0.0` tag depends on the
> acceptance evidence bundle under
> `docs/evaluation/evidence/phase-11/` after the pilot operator runs
> `scripts/evaluation/soak_72h.sh` and `scripts/evaluation/nfr_sweep.sh`
> on the pilot box. All code and docs are ready; this file consolidates
> what will ship.
>
> **Supersedes:** `der-1.0.0-rc.1` + `der-1.0.0-rc.2` + the Phase 7-14
> incremental releases (`der-2.3.90` through `der-2.3.121`) plus the
> post-121 autonomous arc.
>
> **DHIS2 reference:** 2.44-SNAPSHOT.

## Charter

DER as an *intelligent* DHIS2 Edge Runtime — the five operator-facing
modules (DHIS2, Synchronisation, Network, Workflows, Data) are
individually operational and their ten cross-module edges are at least
minimally wired. Pilot-ready end-to-end with the acceptance evidence
bundle attached.

## Headline capability matrix

| Capability | Shipped by |
|---|---|
| Operator captures aggregate + event + tracker data offline | Phase 03.5 + alpha.3 |
| Workflows pin, run, and record audit | Phase 03.6 + ADR-0007 |
| Program rules fire + surface issues (9 action types) | ADR-0007 + Phase 10.2 + 12.2 |
| Writes drain to central with capability-aware routing | Phase 04 + 10.3 |
| Central changes mirror back into local DER | Phase 09 pullers + 12.4 orphan auto-heal |
| Metadata drift detected + quarantined | Phase 05 + alpha.2 |
| Reachability-aware drain (no RETRYABLE churn when central down) | Phase 08 |
| Journal survives SIGKILL + steady-state publisher stalls | Phase 11.1 + 12.1 |
| Approval-gated writes | Phase 07.2 + ADR-0016 |
| Cross-edge referrals with delivery receipt + escalation | Phase 10.3 + 10.3.2 |
| TEI continuity across edges (system-origin) | Phase 10.4 |
| Peer workflow sharing | ADR-0027 |
| Prometheus observability (drain + pull + reap + referral) | Phase 12.3 |
| Pull-write interlock (ADR-0035) | Phase 13.1 + chaos script |
| Cross-entity topological pull order | Phase 13.3 |
| Rule-run audit + rule-conflict detection | Phase 14.1 + E8 |
| Referral ack hop-matching + misroute audit | Phase 14.2 |
| Tracker draft publishing (TEI + enrollment + event) | Phase 14.3 |
| Bulk conflict resolve / draft publish | Phase 14.5a/b |
| Draft publish scheduling (defer to future timestamp) | E6 |
| Chaos tests gated in CI | E5 |

## Server test state

- **Server:** 1540 tests, 0 failures, 0 errors, 0 skipped.
- **admin-ui:** 249 tests, 0 failures.
- **client (device):** 158 tests, 0 failures.

Full-suite green across all three projects simultaneously —
first-time state for this arc (`db064f7`).

## What shipped since `der-1.0.0-rc.2`

The post-rc.2 autonomous arc added ~40 commits on top of the then-HEAD
baseline (`der-2.3.121`). Grouped by phase:

### Phase 7 — approval flow + journal publisher

- 7.0: strip 2.3.122 diagnostic cruft.
- 7.1: draft → submission publish path.
- 7.2: approval merge enforcement in `JournalPublisher`.
- 7.3: wired cross-module drill paths from Data screens into the
  audit timeline.

### Phase 8 — reachability-gate state machine

Made the gate authoritative: drain pauses on `UNREACHABLE` and
resumes on `REACHABLE`; no RETRYABLE churn against a dead central.

### Phase 9 — inbound data pull

`DataPullService` + cursors + conflict detection for aggregate,
event, and tracker payloads (ADR-0034). Three-way merge semantics
make last-pulled-at-origin the tie-breaker.

### Phase 10 — tracker graph reconciliation + referral atomicity

- 10.2: CREATEEVENT + HIDESECTION program-rule actions.
- 10.3: delivery-receipt endpoint + `DELIVERED` state.
- 10.3.2: scheduled escalation for unacked referrals.
- 10.4: system-origin pending rows yield to central pull (TEI
  continuity).

### Phase 11.1 — chaos test for mid-publish SIGKILL

`scripts/evaluation/chaos_journal_recovery.sh` + boot-time reaper
asserting zero stuck IN_FLIGHT after a mid-publish SIGKILL.

### Phase 12 — hardening

- 12.1: continuous IN_FLIGHT reaper (steady-state, not just boot).
- 12.2: DISPLAYTEXT + DISPLAYKEYVALUEPAIR actions + SHOWWARNING / ASSIGN.
- 12.3: Prometheus counters for drain + pull + reap + referral.
- 12.4: orphan auto-heal in `TrackerGraphReconciler`.
- 12.5: consolidated Phase 10 evidence + admin-endpoints guide +
  role-capability matrix.

### Phase 13 — close the P0 integration gaps

- 13.1: ADR-0035 pull-write interlock + `tryLockRowForPublish` in
  `OperationJournalRepository`.
- 13.1.1: wired the interlock into `TrackerPuller` (DEFER_LOCKED
  decision).
- 13.1.2: `scripts/evaluation/chaos_pull_write_interlock.sh` asserts
  the Postgres contract under contention.
- 13.2: manual pull result-polling endpoint (POST `/trigger` +
  GET `/runs/{id}` + GET `/runs?limit=`).
- 13.3: cross-entity topological pull sort (TEI → enrollment → event).
- 13.4: conflict-detail central-value column in the Data UI.

### Phase 14 — close the P1 cross-module gaps

- 14.1: rule-run audit trail (`WORKFLOW_RUN_RULES_EVALUATED`).
- 14.2: referral ack cross-check against origin `next_hop` +
  `REFERRAL_ACK_MISROUTE` audit on mismatch.
- 14.3: tracker draft publishing (tracker-tei, tracker-enrollment,
  tracker-event).
- 14.5a: bulk conflict resolve endpoint (POST `/resolve-batch`).
- 14.5b: bulk draft publish endpoint (POST `/publish-batch`).

### Post-14 polish

- **E5:** chaos tests wired into `scripts/run_all_checks.sh` behind
  `DER_RUN_CHAOS=true`.
- **E6:** draft publish scheduling — V085 column, `/schedule` +
  DELETE endpoints, `ScheduledDraftPublishJob` Quartz tick.
- **E8:** rule-conflict detection (two conflicting ASSIGN rules on
  the same field emit `PROGRAM_RULE_CONFLICT`).
- **Broken-tests sweep:** 9 pre-existing server failures + 67 errors
  across eight unrelated test clusters (constructor arg drift, enum
  growth, @MockBean gaps, null-mergedJobDataMap guards) swept to zero.
  Admin-UI 4 pre-existing failures swept to zero.

## Deliberate non-goals (deferred past 1.0.0)

Explicit from the gap register in `docs/status/status.md` §3 and §4:

| # | Deferred to | Reason |
|---|---|---|
| G3 | 1.1.0 | Admin-UI user-edit role-boundary matrix — governance decision |
| G4 | 1.1.0 | Clock-skew session invalidation threshold — governance decision |
| G5 | 1.1.0 | Break-glass admin recovery SOP — ops policy decision |
| G8 | 1.1.0 | Non-Gregorian calendar support in period parsing — no pilot demand |
| G11 | 1.1.0 | Peer-to-peer data value sharing — second-pilot item |
| G12 | 1.1.0 | Peer workflow run telemetry back to origin — second-pilot item |
| G14 | 1.1.0 | Mesh partition recovery quorum logic — second-pilot item |
| G15 | 1.1.0 | Hardware signals (disk, temp) → sync pause — governance decision |
| G19 | 1.1.0 | Pull-conflict seeded precision corpus — second-pilot item |
| G20 | 1.1.0 | Automated cross-LAN peer discovery via central relay — governance decision |
| E1-4, E7 | post-1.1.0 | UI polish items (dark mode, WebSockets, audit filtering, storybook, escalation templates) |

## Pilot acceptance evidence — the sole blocker

The following must be produced on the pilot box and committed to
`docs/evaluation/evidence/phase-11/<slice>/<run-id>/` before the
stable `der-1.0.0` tag can cut:

### 11.2 — 72h soak

```bash
export DER_ADMIN_COOKIE="JSESSIONID=…"
bash scripts/evaluation/soak_72h.sh
```

**Pass criteria:**

- `end-state-assertions.json#passed = true`
- Zero stuck IN_FLIGHT, zero orphan conflicts, zero overdue referrals
- `der_journal_drain_success_total` strictly greater than baseline

### 11.3 — NFR sweep

```bash
export DER_ADMIN_COOKIE="JSESSIONID=…"
bash scripts/evaluation/nfr_sweep.sh
```

**Pass criteria:**

- NFR-15: p50 ≤ 200 ms, p95 ≤ 2 s on `/edge-api/v1/system/health` at
  c = 20
- NFR-16: write throughput ≥ 50 ops/s sustained
- NFR-17: drain-to-zero for 100 and 1000 queued ops without
  `timedOut`
- NFR-18: RSS ≤ 2 GB sustained during the soak window
- NFR-29: `backup-integrity.json#match = true`

### Promotion to stable

With both evidence bundles present and passing, the stable
`der-1.0.0` tag cuts from the commit that produced them, with no
code changes. If any contract regresses, the fix ships as the next
RC and the pilot operator re-runs.

## Related documents

- `docs/status/status.md` — authoritative scorecard + gap register.
- `docs/evaluation/evidence/phase-11/README.md` — evidence folder
  layout.
- `docs/evaluation/evidence/phase-11/11.2-soak-72h/README.md` —
  soak orchestrator operator guide.
- `docs/architecture/decisions/0034-inbound-data-pull.md` + `0035-pull-write-interlock.md` —
  the two ADRs this release depends on.
- `docs/security/role-capability-matrix.md` — admin surface matrix.
- `docs/operations/admin-endpoints-guide.md` — operator runbook.
