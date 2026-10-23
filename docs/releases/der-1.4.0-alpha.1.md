# DER 1.4.0-alpha.1 — Initiative 3 option A kickoff: chain-via-hub referral (schema)

> **Scope:** Opens Initiative 3 with the smallest meaningful slice.
> Journal entries can now carry a `next_hop_org_unit_uid` so a
> downstream edge (bound to that OU) can later identify them as
> referral targets. Admin can tag any existing journal entry via a
> new endpoint. Write-time header capture + outbound encoding land
> in alpha.2; the inbound poll follows in alpha.3+.

**Release label:** `der-1.4.0-alpha.1`
**Git tag:** `der-1.4.0-alpha.1`
**DHIS2 reference:** 2.44-SNAPSHOT

## New

- Database migration **V021** — nullable `next_hop_org_unit_uid TEXT`
  on `operation_journal`, partial index on non-null values. No FK to
  `org_unit_mirror` (ADR-0027 D-RHO-3: validation is advisory).
- `OperationJournalEntry` record gains `nextHopOrgUnitUid` as an 11th
  field with a 10-arg convenience constructor that passes `null` —
  every existing call-site compiles unchanged.
- `OperationJournalRepository.markNextHop(operationId, orgUnitUid)` +
  the `rowMapper` + all select statements read the new column.
- `POST /edge-api/v1/journal/{operationId}/next-hop` — ADMIN only.
  Accepts `{ "orgUnitUid": "<uid>" }`, idempotent on retag. Emits a
  `JOURNAL_NEXT_HOP_SET` audit event through the ADR-0021 hash chain.
- `edgeApi.setJournalNextHop(operationId, orgUnitUid)` admin-UI
  helper.
- ADR-0027 locks in: option A over B/C, journal column (not side
  table), advisory validation, slice-by-slice rollout.

## Behaviour

```
POST /edge-api/v1/journal/<op-id>/next-hop
    body { "orgUnitUid": "ou-dest" }
    role ADMIN
    ↳ UPDATE operation_journal SET next_hop_org_unit_uid = 'ou-dest'
    ↳ audit JOURNAL_NEXT_HOP_SET (chained)
    ↳ 200 { operationId, nextHopOrgUnitUid }
```

| Status | When |
|---|---|
| 200 | tag persisted |
| 400 `NEXT_HOP_INVALID` | missing or blank `orgUnitUid` |
| 404 | operationId unknown |
| 401 | not authenticated |
| 403 | authenticated non-admin |

The tag is **capture-only** in this alpha — the drain path still
POSTs to central as a normal entry; it does not yet attach the
next-hop as a DHIS2 attribute. That ships in alpha.2.

## Test state

- **1186 server tests** pass (was 1181 + 5 controller tests + 3 repo
  tests). `mvn verify` green.
- **224 admin-ui tests** pass (was 223 + 1 edgeApi row). Vitest at
  **100 / 90.69 / 97.83 / 100** — thresholds unchanged.
- Client: unchanged (153 tests).
- SpotBugs + Checkstyle clean.

## Deliberate non-goals (deferred)

- Write-time header capture (`X-DER-Referral-Next-Hop`) — alpha.2.
- Outbound encoding into DHIS2 (attribute / comment per entity
  type) — alpha.2.
- Inbound poll — a Quartz job that queries central for entries
  tagged with the local bound OU and ingests them — alpha.3+.
- Direct edge-to-edge communication (option B, Phase 15+ spike).
- Multi-hop referrals in a single tag.
- Signed / notarised referral chains.
- Initiative 2 part 1 (server plugin), Initiative 8 part 3 (MFA).

## Promotion path

`der-1.4.0-alpha.1` → alpha.2 (write-time header + outbound
encoding) → alpha.3+ (inbound poll + admin inbox UI) → alpha.4+
(remaining Initiative 2 / 8 work) → stable `der-1.4.0`.
