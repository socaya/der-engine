# DER module integration status + gap register + implementation plan

**Prepared:** 2026-11-03
**Baseline:** `der-2.3.122` + session commits through Phase 12.5
**Scope:** The five operator-facing modules — **DHIS2**,
**Synchronisation**, **Network**, **Workflows**, **Data** — and
how they combine to deliver DER's charter as an *intelligent*
DHIS2 Edge Runtime.

This document is operator-facing and plan-grade: it names concrete
code paths, test coverage, and sequencing of the work still open.
It replaces the ad-hoc understanding that lived in individual phase
release notes.

---

## 0 · TL;DR

| Module | Standalone functionality | Integration with others | Pilot-ready? |
|---|:---:|:---:|:---:|
| **DHIS2** | ✅ 95% | ✅ 90% | 🟢 yes |
| **Synchronisation** | ✅ 90% | ✅ 90% | 🟢 yes |
| **Network** | ✅ 85% | 🟡 65% | 🟡 reachability-advisory→authoritative done; peer-mesh partial |
| **Workflows** | ✅ 90% | ✅ 85% | 🟢 yes |
| **Data** | ✅ 95% | ✅ 90% | 🟢 yes |
| **End-to-end system** | — | ✅ 85% | 🟡 yes with pilot-hardware NFR evidence |

**Headline:** every module is individually operational and the ten
cross-module edges are at least minimally wired. The remaining 15%
is targeted hardening: pilot-hardware NFR evidence, a handful of P0
UX gaps, and one open design decision (pull-write interlock).

---

## 1 · Module current status

### 1.1 DHIS2 (central integration + emulation)

**Charter:** DER speaks fluent DHIS2 to the operator-facing capture
apps on the edge, and talks native DHIS2 Web API to central for
compat / metadata / data exchange.

**Shipped:**
- Compatibility guard (`Dhis2CompatibilityGuard`) — ADR-0002 pin
  verified on every boot and periodically (`CompatRefreshJob`).
  Pinned to DHIS2 2.44 patch; `COMPATIBILITY_MISMATCH` quarantines
  the edge if central drifts off-pin.
- Web API passthrough (`Dhis2ApiProxyController`) — `/api/**`
  routed to central with role-aware classification; 501/503/404
  distinction landed in Phase 04.
- DHIS2 app-shell emulation — `SystemInfoController`,
  `AppsListController`, `MeController` so stock DHIS2 Capture
  apps (DataValueSet, Event Capture, Tracker Capture) load
  against DER as if it were central.
- Metadata mirror — 14 collections (`dataElement`, `program`,
  `programStage`, `orgUnit`, `dataSet`, …) via
  `MetadataSyncService.syncAll()`. Operator-triggered via
  `/sync/metadata` or on cron.
- Reachability — `/dhis2/ping` (10s TTL cache) + `/dhis2/reachability`
  (authoritative state machine, Phase 8).
- Connection config — `Dhis2ConnectionController` reads/writes the
  encrypted central URL + credentials.

**Partial / gaps:**
- **FR-04-02** DHIS2 app shell proxying — PWA mode works; full
  side-nav + inter-module linking against central's modules
  deferred.
- **FR-04-06** Unsupported-operation taxonomy — six codes
  (501/503/404/409/429/502) shipped; two edge cases (`validate
  only`, `preheat`) fall through to 501 generically.
- **FR-04-09** Period semantics — ISO + Gregorian + weekly / quarterly
  shipped. Non-Gregorian calendars (Ethiopian, Nepali) fall back to
  Gregorian — explicit non-goal until pilot demand surfaces.
- **FR-13 inbound pull — data values** — Phase 9 shipped aggregate /
  event / tracker pullers. Still absent: pull-write interlock
  (concurrent central pull during local journal flush — no ADR
  yet).

### 1.2 Synchronisation

**Charter:** DER mediates the outbound write path (local captures
→ central) and the inbound pull path (central changes → local
mirror) with explicit, auditable state transitions.

**Shipped:**
- Outbound drain — `JournalWorker.drainBatch` + `JournalPublisher`
  (`PENDING` → `IN_FLIGHT` → terminal). ADR-0010 state machine.
  Phase 04 original + capability-flag routing to aggregate /
  tracker endpoints. Default cron `0 * * * * ?` (every minute).
- Inbound pull — `DataPullService` + three pullers (aggregate,
  event, tracker) with ADR-0034 three-way merge semantics. Cron
  `0 */5 * * * ?` (every 5 min). Phase 9.
- Reachability gate — `CentralReachabilityGate` state machine
  (REACHABLE / DEGRADED / OFFLINE) with hysteresis; drain
  short-circuits on OFFLINE. Phase 8.
- Approved-merge gate — `JournalPublisher` skips rows where
  `requires_approval=TRUE AND approved_at IS NULL`. Static-source
  tripwire test guards against regression. Phase 7.2 + ADR-0016.
- Journal durability — Boot reaper (`JournalInFlightReaperRunner`,
  Phase 11.1) + continuous reaper (`StuckInFlightReaperService`,
  Phase 12.1) requeue stuck `IN_FLIGHT` rows.
- Conflict review — `ConflictReviewController` + per-row payload
  lineage + resolve endpoint. Phase 05.
- Referral tagging — `operation_journal.next_hop_org_unit_uid` set
  on referral writes; Phase 10.3 adds delivery receipt; 10.3.2
  adds escalation; 10.4 adds TEI continuity across edges.

**Partial / gaps:**
- **FR-11-09 / 11-10** Cursor-after-effects + cross-entity ordering
  — order shipped per-entity; cross-entity topological sort (TEI
  before enrol before event in a single batch) not formalised in an
  ADR extension.
- **FR-10-10** Conflict precision / recall measurement — needs
  seeded corpus; `scripts/evaluation/der_bench.py` scaffold only.
- **FR-10-04 / 10-05** Simultaneous-approval race — tripwire
  catches silent regressions but no concurrency harness.
- Pull-write interlock — if central pull is landing when the local
  worker is draining the same row, there's no explicit lock. In
  practice the state transitions make this safe (OIL in
  `operation_journal` is tx-isolated per row), but no stress test.

### 1.3 Network

**Charter:** DER manages its local LAN footprint (access point +
mesh peers), discovers sibling edges, and communicates with central
over whatever uplink exists.

**Shipped:**
- Local network control — `NetworkController` + `NetworkService` +
  `LinuxNetworkAgent` manage interfaces, access-point mode,
  hostapd + dnsmasq config. Phase 05.
- Peer mesh — `PeerMeshService` + `WebRtcController` + mDNS. Peer
  invite / redeem via `PeerLifecycleController`. Peers appear in
  admin UI Network tab.
- Device messaging — `DeviceMessageController` for intra-fleet
  broadcasts; `MessagingRelayController` for central-mediated
  reach-around when direct peer link is down.
- Fleet surface — `FleetController` + Grafana-ready health gauge.
- Hardware readback — `/edge-api/v1/system/hardware/**` (LEDs,
  disk, temperature). Phase 05+.
- Peer-shared workflow import — `WorkflowPeerController` ingests
  workflow definitions from sibling edges with authenticated
  key-exchange. Phase 03.6b.
- Central reachability — Phase 8 `CentralReachabilityGate` now
  authoritative (not advisory) for the drain worker.

**Partial / gaps:**
- Peer discovery is per-LAN only — no automatic cross-LAN peer
  discovery (e.g. via central relay) when edges share a tenant but
  not a physical network. Operator must manually invite.
- Peer-shared data (not just workflows) — not shipped. Operators
  can push data values peer-to-peer only indirectly via central;
  there's no `/edge-api/v1/peer-mesh/data` surface yet.
- Mesh partition recovery — no automated quorum logic. If the
  mesh splits, each half runs independently; reconciliation on
  reunion requires manual review of referral + pull cursor state.
- Hardware signals → sync — if the LED daemon reports a storage
  problem, the sync worker doesn't pause. Phase 13 design item.

### 1.4 Workflows

**Charter:** Operators define reusable capture workflows (per
program, per activity) that compile into bounded data submissions.
Workflows pin to specific metadata snapshots, enforce rules, and
produce auditable runs.

**Shipped:**
- Workflow CRUD — `CaptureWorkflowController` + designer surface in
  admin UI. Workflow definitions stored in `capture_workflow` (V051,
  V054, V058).
- Workflow runs — `WorkflowRunController` with full state machine
  (`WorkflowRun` lifecycle). Each submission step is a journalled
  write; the whole run is attributable.
- Rule engine — `ProgramRuleEvaluator` evaluates ADR-0007 actions.
  All 7 ADR-0007 actions implemented (SHOWERROR, SHOWWARNING,
  SETMANDATORYFIELD, HIDEFIELD, HIDESECTION, ASSIGN, CREATEEVENT).
  Phase 12.2 added DISPLAYTEXT + DISPLAYKEYVALUEPAIR.
- Validation — `ProgressiveValidator` runs after every
  contribution, persists issues to `workflow_validation_issue`.
- Peer workflow import — `CaptureWorkflowImportService` reads
  peer-shared JSON, validates against local metadata, persists.
- Approvals — role-gated approval queue; `requires_approval` +
  `approved_at` columns on `operation_journal`.
- Referral workflows — `/workflows/queue` + referral intake via
  `ReferralInboxScanner` (central-pull) + `WorkflowPeerController`
  (direct mesh).
- Activity feed — `WorkflowActivityController` surfaces per-user
  activity for ops review.

**Partial / gaps:**
- Tracker-shape drafts — Phase 7.1 shipped `DraftPublishService`
  for aggregate + event drafts. Tracker (TEI + enrol + event
  combos) returns `DRAFT_KIND_NOT_PUBLISHABLE` and is explicitly
  deferred to Phase 13.
- Non-ADR-0007 rule actions — SENDMESSAGE, SCHEDULEMESSAGE,
  HIDEOPTION, HIDEOPTIONGROUP, HIDEPROGRAMSTAGE not shipped; fall
  through to `default -> null`. Non-goal until a successor ADR
  extends scope.
- Rule conflict detection — two rules firing HIDESECTION on the
  same section not flagged.
- Workflow run audit trail — the ordered sequence of rules fired
  per contribution is implicit in audit events but not surfaced as
  a per-run report.

### 1.5 Data

**Charter:** DER stores locally-captured aggregate, event, and
tracker data; mirrors central-side data; routes everything through
the operation journal; surfaces operator-facing queues + conflict
reviews.

**Shipped:**
- Aggregate data value — `AggregateDataValueService` +
  `AggregateDataValueRepository` + `/edge-api/v1/data/aggregate`
  routes. ADR-0027 next-hop tagging.
- Standalone events — `EventService` + `EventRepository` +
  `/edge-api/v1/data/events`.
- Tracker — TEI + enrol + stage event domain classes +
  repositories + `/edge-api/v1/data/tracker`. Phase alpha.3.
- Drafts — `DraftController` + V009 table; publish flow Phase 7.1.
- Queue + lineage — `/data/queue` lists `operation_journal` rows
  with lineage drawer and payload inspection.
- Payload lineage — per-row drawer with the exact `/api/tracker`
  POST envelope DER would send.
- Mirrored metadata — `metadata_organisation_unit`,
  `metadata_data_element`, `metadata_program_stage`, …
  (`MetadataMirrorRepository`).
- Inbound-pulled data — Phase 9 pullers populate central-origin
  rows. Shadow detection via `createdBy = UUID(0,0)` sentinel.
- Tracker graph reconciler — Phase 10.1 + 12.4 auto-heal.
- Admin UI — all five Data sub-screens shipped (Aggregate, Events,
  Tracker, Queue, Drafts) + Maintenance + per-row lineage drawer.

**Partial / gaps:**
- Conflict-detail "central value" column — a `CONFLICT_REVIEW` row
  shows the local payload; the central payload that triggered the
  conflict is stored in `last_response` but not surfaced
  side-by-side in the operator UI. Phase 13 UI slice.
- Manual pull result polling — `POST /data/pull/trigger` returns
  202; no polling endpoint for completion status. Operator can
  infer from the cursor table but it's awkward.
- Bulk operations — single-row conflict resolve, single-row
  publish, single-row delete. Bulk UX deferred.

---

## 2 · Cross-module integration status (ten edges)

Rated 🟢 wired-and-tested, 🟡 wired-but-partial, 🔴 missing.

### 2.1 Workflows ↔ Data 🟢

Every workflow run step compiles into one or more `AggregateDataValueService.submit` / `EventService.submit` / `TrackerService.upsert*` calls. The run id is stamped on every journal row (`workflow_run_id` column, V072 / V074 / V076 / V078). The run report in `/workflows/monitoring/runs/<id>` surfaces every produced data row and its sync state.

- Tests: full capture → journal roundtrip integration tests;
  `operation_journal.workflow_run_id` referential integrity.
- Live-verified: pre-pilot smoke suite.

### 2.2 Data ↔ Synchronisation 🟢

Every `AggregateDataValueService.submit()` writes a `PENDING` row to `operation_journal`. `JournalWorker` drains them; terminal state (ACCEPTED / REJECTED / CONFLICT_REVIEW) flows back to the Data queue view.

- Tests: 10 `JournalWorkerTest` cases; approved-merge tripwire.
- Observability: Phase 12.3 Prometheus `der_journal_drain_outcome_total`.

### 2.3 Synchronisation ↔ DHIS2 🟢

`JournalPublisher.publish()` routes PENDING rows via `CapabilityFlags` (aggregate → `/api/dataValueSets`, events → `/api/events`, tracker → `/api/tracker`). Polls `/api/tracker/jobs/{id}` for async operations up to 30s. Idempotency keys and `storedBy` attribution per ADR-0032.

- Phase 8 ReachabilityGate pauses the drain when central is OFFLINE
  (prevents RETRYABLE churn during outages).

### 2.4 DHIS2 ↔ Data (metadata) 🟢

`MetadataSyncService.syncAll()` pulls 14 collections; `MetadataMirrorRepository` validates all local writes (data element exists, program stage belongs to program, category combo valid, org unit in subtree).

- Drift detection via `MetadataDriftDetector` quarantines journal rows if a dependency drifted.

### 2.5 DHIS2 ↔ Data (data values) 🟢 — shipped in Phase 9

`DataPullJob` runs every 5 minutes; `AggregatePuller` + `EventPuller` + `TrackerPuller` pull central-side changes and apply three-way merge semantics (insert / overwrite+audit / raise CONFLICT_REVIEW / shadow-overwrite). `TrackerGraphReconciler` closes orphans both proactively (new) and retroactively (auto-heal, Phase 12.4).

- Partial: pull-write interlock not formalised. In practice safe
  due to row-level tx isolation but needs ADR-0034 extension.
- Partial: manual-pull result polling endpoint missing.

### 2.6 Network ↔ Synchronisation 🟢 — authoritative since Phase 8

`CentralReachabilityGate` publishes REACHABLE / DEGRADED / OFFLINE with hysteresis. `JournalDrainJob.execute` checks `reachability.shouldDrain()` and short-circuits when OFFLINE. The UI topbar badge reads from the same gate.

- Before Phase 8 the connectivity signal was advisory only
  (operators could see it on the dashboard but the drain kept
  retrying). Now it's authoritative.
- Phase 12.3 added `der_journal_inflight_reaped_total{origin}` so
  spikes during network flaps are visible on Grafana.

### 2.7 Network ↔ Workflows 🟡

`WorkflowPeerController.importFromPeer()` ingests workflow JSON from sibling edges over the WireGuard mesh. Peers are authenticated with shared keys (V062). The peer workflow repository (`workflow_peer`, V061) records what came from where.

**Gaps:**
- Peer-to-peer workflow run status (did Edge B actually run my
  shared workflow?) — no telemetry edge back to the origin.
- Automatic workflow version-reconciliation when the same workflow
  is edited concurrently on two peers.

### 2.8 Workflows ↔ Approval / Audit 🟢

Workflow runs that touch sensitive data types flip `requires_approval` on the journal row. The approval queue (`ApprovalController`) is role-gated to the APPROVER role. All transitions are hash-chain-audited via `SecurityAuditRepository` → `security_audit` + V017 trigger.

### 2.9 Network ↔ Data (referral routing) 🟢 — delivery guaranteed since Phase 10.3

Operators tag a journal row with `next_hop_org_unit_uid`. The destination edge receives via `ReferralInboxScanner` (central pull) or `WorkflowPeerController` (direct mesh). Phase 10.3 added `POST /referrals/ack` so the destination edge marks the origin's row DELIVERED; Phase 10.3.2 escalates after threshold.

**Gaps:**
- The ack endpoint doesn't verify that `destinationOrgUnit` matches
  the origin's `next_hop_org_unit_uid` — a compromised OPERATOR
  account could falsely ack. Flagged for Phase 13.
- No multi-recipient referral (broadcast to N facilities).

### 2.10 Workflows ↔ Data (approval-gated submission) 🟢

Workflow steps that produce sensitive journal rows (configurable per entity type) auto-set `requires_approval=TRUE`. The drain's SQL filter `(requires_approval = FALSE OR approved_at IS NOT NULL)` prevents push until an APPROVER acts. Phase 7.2 tripwire guards against regression.

---

## 3 · Gaps consolidated

Material gaps grouped by severity, scoped to work that still needs
code or docs. Enhancements beyond spec moved to §4.

### 3.1 P0 — blocks `der-1.0.0` cut

| # | Gap | Owning area | Rough effort |
|---|---|---|---|
| G1 | Pull-write interlock ADR + implementation | Sync | 1 slice |
| G2 | Manual pull trigger result-polling endpoint | Data / Sync | 1 slice |
| G3 | Admin UI user-edit wiring (PATCH endpoint + screen) | Workflows (users) | 1 slice |
| G4 | Clock-skew session invalidation | DHIS2 / auth | 1 slice |
| G5 | Break-glass admin recovery | DHIS2 / auth | 1 slice (+ ops policy decision) |
| G6 | Pilot-hardware NFR sweep + 72h soak | Across | pilot hardware |
| G7 | `der-1.0.0` release notes + tag | Across | 1 slice post-G6 |
| G8 | Non-Gregorian calendar support in period parsing | DHIS2 | 1 slice (defer if no pilot demand) |
| G9 | Cross-entity topological sort in puller | Sync | 1 slice (ADR extension) |
| G10 | Conflict-detail central-value column in Data UI | Data | 1 slice |

### 3.2 P1 — ship before second pilot

| # | Gap | Owning area |
|---|---|---|
| G11 | Peer-to-peer data value sharing (not just workflows) | Network ↔ Data |
| G12 | Peer workflow run telemetry back to origin | Network ↔ Workflows |
| G13 | Tracker-shape draft publishing | Workflows / Data |
| G14 | Mesh partition recovery quorum logic | Network |
| G15 | Hardware signals (disk, temp) → sync pause | Network ↔ Sync |
| G16 | Bulk conflict resolve + bulk publish UI | Data |
| G17 | Rule-run audit trail per run (ordered rule sequence) | Workflows |
| G18 | Referral ack cross-check against origin next-hop | Sync (security) |
| G19 | Pull-conflict seeded precision corpus | Testing |
| G20 | Automated cross-LAN peer discovery via central relay | Network |

### 3.3 P2 — enhancements, defer past 1.0.0

| # | Enhancement |
|---|---|
| E1 | Dark mode for admin UI |
| E2 | WebSocket live journal updates (replace 5s polling) |
| E3 | Audit event filtering by type in operator UI |
| E4 | Component storybook for admin UI primitives |
| E5 | Chaos test as a CI gate (not just manual) |
| E6 | Draft publish scheduling (defer to timestamp) |
| E7 | Operator-defined escalation action templates |
| E8 | Rule-conflict detection (two HIDESECTIONs same section) |

---

## 4 · Implementation plan — Phases 13, 14, 15

Phase 11.2 / 11.3 / 11.4 (pilot-hardware NFR + release cut) remain
their own track and are not re-numbered here.

### Phase 13 — close the P0 integration gaps · 3 sessions

**13.1 — Pull-write interlock ADR + implementation (G1, G9)**

- Draft ADR-0035 "Pull-write race semantics": when central pull
  lands row X at the same time the drain worker is publishing row X,
  which wins? Proposed: central-wins only when local is terminal
  (already shipped in ADR-0034); when local is PENDING / IN_FLIGHT,
  pull raises CONFLICT_REVIEW regardless of system vs operator
  origin.
- Add `OperationJournalRepository.lockRowForPublish(opId)` using
  Postgres `SELECT ... FOR UPDATE SKIP LOCKED`. Guarantees the
  drain and the pull serialise on the row.
- Add `AggregatePuller.applyMergeDecision` so the central-wins
  path checks the lock state before overwriting.
- Topological sort within the tracker puller: TEI → enrol → event
  explicitly ordered + regression test.
- Live-verify with a chaos test that interleaves pull + drain.

**13.2 — Manual pull trigger + result polling (G2)**

- `POST /edge-api/v1/data/pull/trigger` already returns 202 with a
  job id; add `GET /edge-api/v1/data/pull/runs/{jobId}` returning
  `{status, result, startedAt, finishedAt}`.
- Admin UI "Pull from Central" button polls every 2s until done
  then shows the result card.
- Reuses the existing `scheduled_job_run` table.

**13.3 — Admin UI user-edit wiring (G3)**

- Add `PATCH /edge-api/v1/provisioning/users/{id}` for password reset
  + role change. Already partially stubbed.
- Wire the "Edit" button in `EACoreScreens.tsx:304` (currently
  disabled with "not yet available" title attr).
- Rate-limit per-admin + per-target-user to prevent lockout.

**13.4 — Clock-skew session invalidation (G4) + break-glass (G5)**

Both are auth cluster. Design pass with operations before code.

- Clock-skew: define policy — reject tokens with age > N minutes
  (default 24h?). Add `TokenFreshnessInterceptor`.
- Break-glass: define SOP (physical access + special command).
  Add CLI + audit event + revocation path.

**13.5 — Conflict-detail central-value column (G10)**

- Server already stores `last_response` on CONFLICT_REVIEW rows.
- Admin UI conflict detail page gets a second column rendering
  the central payload side-by-side with local.

**Exit criteria:** FR-11-09, FR-11-10, FR-10-10 all flip DONE on
the traceability matrix. Admin UI user-edit button fires and
succeeds end-to-end.

### Phase 14 — close the P1 cross-module gaps · 3-4 sessions

**14.1 — Peer-to-peer data value sharing (G11)**

- New endpoint `POST /edge-api/v1/peer-mesh/data` for direct
  edge-to-edge pushes (no central round-trip).
- Journal row carries `source_peer_id` + `received_at` for audit
  trail.
- Admin UI shows peer-received rows in a dedicated chip tone.

**14.2 — Peer workflow telemetry (G12)**

- Destination edge posts `/edge-api/v1/workflows/peer-run-complete`
  back to origin when it finishes a peer-shared workflow run.
- Origin surfaces the status in `WorkflowRunController` detail view.

**14.3 — Tracker draft publishing (G13)**

- `DraftPublishService.publishTracker` composes TEI + enrol + event
  into one atomic submission via `TrackerService` orchestration.
- UI "Publish" button in `CapDrafts.tsx` becomes enabled for tracker
  kinds.

**14.4 — Hardware signals → sync pause (G15)**

- `HardwareHealthReporter` publishes signal state (disk, temp,
  battery).
- `JournalWorker` reads the signal and short-circuits with
  `skipped: hardware-degraded` when a critical signal fires.
- Metric `der_journal_drain_skipped_total{reason}` extended.

**14.5 — Bulk Data UX (G16)**

- Admin UI gains `/data/queue` checkbox selection + "Resolve
  selected" / "Publish selected" buttons.
- Server-side batch endpoints `POST /journal/conflicts/resolve-batch`
  + `POST /drafts/publish-batch`.

**14.6 — Rule-run audit trail (G17) + referral ack cross-check (G18)**

- Audit event `WORKFLOW_RUN_RULES_EVALUATED` with ordered rule-id
  list.
- `ReferralAckController` compares `destinationOrgUnit` against
  `operation_journal.next_hop_org_unit_uid` and rejects mismatches.

### Phase 15 — pilot-hardware NFR evidence · 2 weeks on real hardware

Replaces Phase 11.2 + 11.3 + 11.4 for the actual pilot.

**15.1 — 72h soak**
- Scripted central-flap (kill DHIS2 every 2h for 20min for 24h).
- Scripted write-spike (100 writes/s for 10min twice daily).
- End-state assertions: zero stuck IN_FLIGHT, zero orphaned
  referrals, metric curves show expected shapes.

**15.2 — NFR-15/17/18/29 sweep**
- `scripts/evaluation/nfr_sweep.sh` executes on pilot box.
- Evidence lands in `docs/evaluation/evidence/phase-11/11.3-nfr-sweep/`.
- Gate: p50 ≤ 200ms, p95 ≤ 500ms, backup round-trip 100% row
  match.

**15.3 — `der-1.0.0` cut**
- Release notes under `docs/releases/der-1.0.0.md` consolidating
  Phases 7–14.
- Response-contract report per DER-ENG-001 §15.
- Signed git tag.

### Phase 16 — enhancement sweep · opportunistic

P2 items from §3.3 shipped as individual commits as time allows.
Not blocking any release.

---

## 5 · Readiness scorecard — "does DER function as an intelligent
DHIS2 Edge Runtime today?"

| Capability | State | Evidence |
|---|---|---|
| **Operator can capture** aggregate + event + tracker data offline | ✅ | Phase 03.5 + alpha.3 |
| **Workflows pin, run, and record audit** | ✅ | Phase 03.6 + ADR-0007 |
| **Program rules fire + surface issues** | ✅ | All 7 ADR-0007 actions + 2 display actions (Phase 12.2) |
| **Writes drain to central with capability-aware routing** | ✅ | Phase 04 + 10.3 referrals |
| **Central changes mirror back into local DER** | ✅ | Phase 9 pullers + Phase 12.4 auto-heal |
| **Metadata drift detected + quarantined** | ✅ | Phase 05 + alpha.2 |
| **Reachability-aware drain (no RETRYABLE churn when central down)** | ✅ | Phase 8 |
| **Journal survives SIGKILL + steady-state publisher stalls** | ✅ | Phase 11.1 + 12.1 |
| **Approval-gated writes** | ✅ | Phase 7.2 + ADR-0016 |
| **Cross-edge referrals with delivery receipt + escalation** | ✅ | Phase 10.3 + 10.3.2 |
| **TEI continuity across edges** | ✅ (system-origin) 🟡 (user-origin deferred) | Phase 10.4 + G13 |
| **Peer workflow sharing** | ✅ | ADR-0027 |
| **Peer data sharing** | ❌ | G11, Phase 14.1 |
| **Prometheus observability** | ✅ | Phase 12.3 |
| **Pilot-hardware NFR evidence** | ❌ | Phase 15 |
| **Admin UI covers all 54 specified screens** | ✅ | Phase 06 |
| **Admin runbook for the Phase 7–12 endpoints** | ✅ | Phase 12.5 |
| **Role-capability matrix documented** | ✅ | Phase 12.5 |

**Scorecard:** 15 of 18 fully green. The remaining three (user-origin
TEI hand-off, peer data sharing, pilot NFR) are explicit Phase 13 /
14 / 15 line items with scoped work plans.

---

## 6 · Appendix — module-to-module traceability

### 6.1 File map

| Module | Server (ug.ac.mak.der) | Admin UI (admin-ui/src) |
|---|---|---|
| DHIS2 | `dhis2/`, `metadata/`, `web/Dhis2*Controller` | `screens/Dhis2Overview`, `screens/Metadata*` |
| Sync | `workflows/journal/`, `workflows/pull/`, `scheduler/Journal*Job`, `scheduler/DataPull*Job` | `screens/SyncOverview`, `screens/SyncHistory`, `screens/DataQueues` |
| Network | `network/`, `web/NetworkController`, `web/PeerMesh*`, `web/WebRtcController` | `screens/Network*`, `screens/MeshTopology`, `screens/Fleet` |
| Workflows | `workflow/`, `workflows/*Service`, `web/CaptureWorkflow*`, `web/ApprovalController` | `screens/CapabilityScreens` (Capture + Workflows), `screens/workflow/*` |
| Data | `workflows/aggregate/`, `workflows/events/`, `workflows/tracker/`, `workflows/drafts/`, `web/Data*Controller` | `screens/DataAggregate`, `screens/DataEvents`, `screens/DataTracker`, `screens/CapabilityScreens` (Drafts) |

### 6.2 Migration map

| Area | Migrations |
|---|---|
| Journal | V003, V008, V021 (approval), V072, V074, V076, V078 (workflow_run_id), V083 (referral delivery), V084 (escalation) |
| Metadata mirror | V002, V005 |
| Tracker | V025, V027 |
| Scheduler | V006 (Quartz tables) |
| Audit | V017 (hash chain) |
| Drafts | V009 |
| Pull cursors | V082 |

### 6.3 ADR map

| ADR | Topic | Status |
|---|---|---|
| 0002 | DHIS2 version pin | ACCEPTED |
| 0004 | Hybrid architecture | ACCEPTED |
| 0005 | Edge app model | ACCEPTED |
| 0007 | Program rule action taxonomy | ACCEPTED |
| 0010 | Journal state machine | ACCEPTED |
| 0015 | Org-unit binding | ACCEPTED |
| 0016 | Approval gate | ACCEPTED |
| 0017 | Offline auth policy | ACCEPTED (G4 pending) |
| 0025 | Workflow reconciler | ACCEPTED |
| 0026 | Workflow run / event tracker | ACCEPTED |
| 0027 | Chain-via-hub referral | ACCEPTED (G18 pending) |
| 0028 | TOTP MFA | ACCEPTED |
| 0032 | Client user attribution | ACCEPTED |
| 0033 | Admin UI same-origin | ACCEPTED |
| 0034 | Inbound data pull | ACCEPTED (G1 extension pending) |
| 0035 | Pull-write race (G1) | DRAFT (Phase 13.1) |

---

**End of document.**
