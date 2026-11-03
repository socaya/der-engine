# DER admin endpoints — operator runbook

**Scope:** Every operator-callable endpoint added across Phases
7–12, with a `curl` example + expected response + interpretation
cue. Complements `docs/security/role-capability-matrix.md` (which
answers "who can call it") by answering "what does it do and how
do I read the output?"

**Base URL:** `http://localhost:8085` (local dev) or your reverse
proxy's address.

**Auth:** Cookie session. Sign in once:

```bash
curl -s -c /tmp/der-cookies.txt \
  -X POST -H 'content-type: application/json' \
  -d '{"username":"der-admin","password":"<secret>"}' \
  http://localhost:8085/edge-api/v1/auth/sign-in
```

All subsequent calls include `-b /tmp/der-cookies.txt`.

## Phase 7 — Finish-the-flow

### 7.1 Draft publish

```bash
# List drafts owned by the signed-in user
curl -s -b /tmp/der-cookies.txt \
  'http://localhost:8085/edge-api/v1/drafts' | jq

# Publish one — commits to the outbound journal
curl -s -b /tmp/der-cookies.txt \
  -X POST 'http://localhost:8085/edge-api/v1/drafts/<id>/publish' | jq
```

Response shape:
```json
{"draftId":"…","kind":"aggregate","imported":1,"ignored":0,
 "conflicts":[],"draftConsumed":true}
```

`draftConsumed=true` means the draft was deleted after full
acceptance; `false` means at least one row was rejected (see
`conflicts`) and the draft was kept for the operator to edit.

## Phase 8 — ReachabilityGate

```bash
# Current gate state + consecutive success/failure counters
curl -s -b /tmp/der-cookies.txt \
  http://localhost:8085/edge-api/v1/dhis2/reachability | jq
```

```json
{"state":"REACHABLE","since":"2026-11-02T19:21:02Z",
 "consecutiveSuccess":14,"consecutiveFailure":0,"drainsAllowed":true}
```

`drainsAllowed=false` means the journal drain is paused (gate in
OFFLINE); operators see this reflected in the UI topbar badge.

## Phase 9 — Inbound data pull

### 9.5 Cursor view

```bash
curl -s -b /tmp/der-cookies.txt \
  http://localhost:8085/edge-api/v1/data/pull/cursors | jq
```

```json
{"cursors":[
  {"entityType":"AGGREGATE","orgUnitUid":"ouX","lastPulledAt":"…",
   "consecutiveFailures":0,"lastError":null,"updatedAt":"…"},
  …
]}
```

A non-zero `consecutiveFailures` on any cursor means the puller is
stuck for that scope — check `lastError` for diagnosis.

The scheduled `DATA_PULL` Quartz job runs the puller every 5 min
by default; configurable via `der.data.pull.cron`.

## Phase 10 — Tracker + referrals

### 10.3 Referral ack

Called by destination edges after ingesting a referred record:

```bash
curl -s -b /tmp/der-cookies.txt \
  -X POST -H 'content-type: application/json' \
  -d '{"operationId":"<uuid>","receiptId":"edge-B/42",
       "destinationOrgUnit":"ou-DEST"}' \
  http://localhost:8085/edge-api/v1/referrals/ack | jq
```

```json
{"operationId":"…","deliveredAt":"…","duplicate":false}
```

`duplicate=true` means central replayed the ack OR the operation
isn't a referral — both are safe no-ops.

### 10.3.2 Escalation (automated)

No endpoint — the `REFERRAL_ESCALATION` Quartz job runs every 5
min and emits `REFERRAL_UNDELIVERED` audit events for referrals
outstanding past the threshold (default PT30M via
`der.referral.escalation.threshold`).

To see outstanding referrals directly:

```sql
SELECT operation_id, next_hop_org_unit_uid, updated_at
  FROM der.operation_journal
 WHERE next_hop_org_unit_uid IS NOT NULL
   AND referral_delivered_at IS NULL
   AND referral_escalated_at IS NULL
 ORDER BY updated_at ASC;
```

## Phase 11 + 12 — Durability + observability

### 11.1 + 12.1 Journal reaper

No endpoint — reapers fire automatically:

- **Boot reaper** (`JournalInFlightReaperRunner`) fires once on
  `ApplicationReadyEvent`. Reaps rows left IN_FLIGHT by the previous
  process.
- **Continuous reaper** (`StuckInFlightReaperService` + Quartz
  `STUCK_INFLIGHT_REAP` job) fires every 5 min. Reaps rows stuck
  IN_FLIGHT longer than `der.journal.inflight-threshold` (default
  PT10M).

Both emit `JOURNAL_INFLIGHT_REAPED` / `JOURNAL_INFLIGHT_STUCK_REAPED`
audit events + increment `der_journal_inflight_reaped_total{origin=
boot|runtime}` metric.

### 12.3 Prometheus metrics

```bash
curl -s http://localhost:8085/actuator/prometheus | grep ^der_
```

Expected counters (register lazily on first increment):

| Metric | Tags | Interpretation |
|---|---|---|
| `der_journal_drain_outcome_total` | `outcome` | `rate()` graphs drain throughput |
| `der_journal_inflight_reaped_total` | `origin` | Alert on steady non-zero `origin=runtime` — publishers are dying |
| `der_data_pull_outcome_total` | `entity_type`, `outcome` | Pull failures by family |
| `der_referral_delivered_total` | — | Cross-edge delivery rate |
| `der_referral_escalated_total` | — | Alert if non-zero over 24h window |

### 12.4 Orphan auto-heal (automated)

No endpoint — runs as part of the pull cycle. See
`TRACKER_ORPHAN_AUTOHEALED` audit events to confirm the reconciler
is closing conflicts automatically.

## Quick ops recipes

**"Something is stuck in IN_FLIGHT"**:
```sql
SELECT operation_id, entity_type, entity_ref, updated_at
  FROM der.operation_journal WHERE state = 'IN_FLIGHT';
```
Wait for the next `STUCK_INFLIGHT_REAP` tick (≤5 min); if the row is
still there, lower the threshold or check publisher thread health.

**"Central is reachable but no data flowing"**: hit
`/dhis2/reachability` — if `drainsAllowed=false` the gate is still
DEGRADED. One good `/dhis2/ping` promotes it to REACHABLE.

**"Operator reports stale data"**: check
`/data/pull/cursors` — a non-advancing `lastPulledAt` with
`consecutiveFailures > 0` points at central problems; a stale
timestamp with `consecutiveFailures=0` means the puller is
succeeding but central has no new data for the scope.
