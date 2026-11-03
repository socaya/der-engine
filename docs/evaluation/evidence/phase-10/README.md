# Phase 10 evidence — tracker lifecycle + referral atomicity

**Scope:** All four Phase 10 sub-slices (10.1 → 10.4) plus their 12.x
extensions. Consolidates release notes previously scattered across
individual commits.

## 10.1 — TrackerGraphReconciler (orphan detection)

Scans local tracker mirror after every pull for enrolments without a
parent TEI and stage events without a parent enrolment. Raises
`CONFLICT_REVIEW` journal rows + `TRACKER_ORPHAN_DETECTED` audit
events; never deletes.

- Code: `server/.../workflows/tracker/TrackerGraphReconciler.java`
- Hooks: `DataPullService.pullAll` after per-entity cursor advance
- Tests: `TrackerGraphReconcilerTest` (4 cases: clean / enrol-only /
  event-only / both-families)
- **12.4 extension:** auto-heal pass — prior-tick orphans whose
  parent has since landed are auto-closed with
  `TRACKER_ORPHAN_AUTOHEALED` audit event. 2 more tests cover
  parent-exists → heal + parent-missing → no-op.

## 10.2 — Program-rule action completeness

Shipped `CREATEEVENT` and `HIDESECTION` beyond the pre-existing
`SHOWERROR` / `SHOWWARNING` / `SETMANDATORYFIELD` / `HIDEFIELD` /
`ASSIGN`. Both action handlers read the target UID from the action
payload JSON (bare string OR nested `{id}` — DHIS2 is inconsistent)
and emit a `PROGRAM_RULE_<type>` issue carrying the stage/section
UID so the capture-workflow runner can spawn events / hide sections
deterministically.

- Code: `server/.../workflow/ProgramRuleEvaluator.java`
  lines 290–389
- Tests: `ProgramRuleEvaluatorActionsTest` (6 cases; 2 more added
  in 12.2 for DISPLAYTEXT / DISPLAYKEYVALUEPAIR)
- **12.2 extension:** `DISPLAYTEXT` + `DISPLAYKEYVALUEPAIR` handlers
  so forms with these common DHIS2 rules no longer render without
  their instructional text.

## 10.3 — Referral delivery receipt

Destination edge POSTs `/edge-api/v1/referrals/ack` once it has
ingested a referred record. Origin edge stamps
`operation_journal.referral_delivered_at` + `referral_receipt_id`
and audits `REFERRAL_DELIVERED`. Idempotent: duplicate acks return
`200 { duplicate: true }` and audit as `REFERRAL_ACK_DUPLICATE`.

- V083 migration: columns + partial index
  `ix_operation_journal_referral_outstanding`
- Controller: `ReferralAckController`
- Tests: `ReferralAckControllerTest` (4 cases)
- Live-verified: fresh ack + duplicate replay + missing opId

## 10.3.2 — Scheduled escalation for unacked referrals

`ReferralEscalationService.escalateOnce` runs on a Quartz cron
(default every 5 min). Scans referrals outstanding past the
configured threshold (default PT30M) and emits
`REFERRAL_UNDELIVERED` audit events exactly once per row by
stamping `referral_escalated_at`.

- V084 migration: `referral_escalated_at` + narrower partial index
- Service: `ReferralEscalationService`
- Scheduled job: `ReferralEscalationJob`
- Tests: `ReferralEscalationServiceTest` (4 cases)

## 10.4 — TEI continuity across edges

TrackerPuller's three-way merge previously treated every
non-terminal journal state as "operator-pending → raise conflict",
misclassifying shadows. Now distinguishes submittedBy=null
(system-origin shadow → central wins, audit
`TRACKER_SHADOW_OVERWRITTEN`) from submittedBy=<uuid>
(operator-pending → raise conflict).

- Code: `server/.../workflows/pull/TrackerPuller.java`
  `MergeDecision.PROCEED_OVERWRITE_SHADOW`
- Tests: `TrackerPullerTest` (2 Phase-10.4 cases + 1 updated 9.4
  case to pass a real actor UUID)

## 12.3 — Prometheus observability (applies to all Phase 10 flows)

Five typed counter families now exported via
`/actuator/prometheus`:

| Counter | Tags | Fired by |
|---|---|---|
| `der_journal_drain_outcome_total` | `outcome` | JournalWorker |
| `der_journal_inflight_reaped_total` | `origin=boot\|runtime` | reaper runner + continuous service |
| `der_data_pull_outcome_total` | `entity_type`, `outcome` | DataPullService |
| `der_referral_delivered_total` | — | ReferralAckController |
| `der_referral_escalated_total` | — | ReferralEscalationService |

Allows operators to graph referral-delivery rate, orphan-conflict
raise rate, and reap frequency without reading the audit DB.

## Cumulative test coverage

All Phase 10 + 12.2 + 12.3 + 12.4 extensions:
**30+ unit tests** across the tracker + referral + pull + rule
batteries. 100% pass rate against `der-server-2.3.122.jar`.
