# ADR-0027 — Chain-via-hub referral (Initiative 3 option A)

- **Status:** Accepted (Phase 13 / der-1.4.0-alpha.1)
- **Related:** ADR-0004 (hub-and-spoke), ADR-0010 (operation journal),
  ADR-0015 (edge-to-OU binding)
- **Roadmap:** Initiative 3 option A

## Context

DER has shipped as hub-and-spoke since Phase 02: edges talk to
central DHIS2, never directly to each other. The project proposal
calls for referral chains — community health worker → facility
nurse → district pharmacy → regional lab → referral hospital —
where each hop ingests the previous hop's output.

The roadmap listed three topologies (A: via hub, B: direct TLS mesh,
C: local MQTT broker). The user picked A. **Option A piggybacks on
the existing central drain**: a journal entry is tagged with
`next_hop_org_unit_uid`; after central accepts the entry, a
receiving edge (bound to that OU) polls central and pulls the entry
into its own local store. Zero direct edge-to-edge contact; no new
daemons; no mTLS pairing ceremony.

## Decisions

### D-RHO-1 — Option A over B / C

The user explicitly picked option A at tag time. B (direct TLS mesh)
is deferred to Phase 15+ as a design spike; C (MQTT) is unlikely to
ship.

### D-RHO-2 — Represent the next-hop as a column on `operation_journal`

V021 adds `next_hop_org_unit_uid TEXT` (nullable). No new table —
the referral is a property of an existing journal entry, not a
first-class resource. Rows with the column `NULL` are the normal
non-referral case and behave exactly as today.

### D-RHO-3 — Validation is advisory, not blocking

The column has no FK to `org_unit_mirror`. If an admin tags a
journal entry for an OU DER doesn't know about, we log WARN and
accept the write. Reason: the mirror can be stale and the central
DHIS2 is still the source of truth. Blocking on local-mirror
lookups would create a flaky referral surface.

### D-RHO-4 — Alpha.1 ships the capture surface only

Alpha.1:

- Schema column + record + repository plumbing.
- `POST /edge-api/v1/journal/{operationId}/next-hop` (ADMIN) tags an
  existing journal entry with a destination OU. Idempotent — repeat
  calls overwrite.
- Admin UI journal browser shows the new column.

Alpha.2 adds write-time header capture
(`X-DER-Referral-Next-Hop: <org-unit-uid>`) and the outbound
transmission (encode as a DHIS2 attribute / comment per entity
type).

Alpha.3+ adds the inbound poll — a Quartz job per edge that queries
central for records tagged with its bound OU as `next_hop` and
ingests them.

### D-RHO-5 — No special drain treatment

A tagged entry still drains to central as a normal POST. The
tag's role is to let the **receiving** edge find the entry later.
The sending edge treats `next_hop` as "write-only metadata" — it
doesn't change retry logic, state transitions, or conflict review.

### D-RHO-6 — Audit the tag operation

Setting `next_hop_org_unit_uid` emits a `JOURNAL_NEXT_HOP_SET`
audit event through the ADR-0021 hash chain. The event carries
`{operationId, orgUnitUid}` so a forensic review can reconstruct
every referral intent across the chain.

## Non-goals

- Direct edge-to-edge communication (option B, Phase 15+ spike).
- Multi-hop referrals in one tag (`A → B → C → D` recorded in a
  single column). The journal entry carries one `next_hop` at a
  time; multi-hop composes by edge B re-tagging on ingest.
- Writing a new entity type to central specifically for referrals
  (we reuse the existing journal shapes — dataValueSet, event,
  enrollment).
- Programmatic resolution of OU paths across sites (admins type the
  destination OU UID; UID validation is a central-side concern).
- Signed / notarised referral chains (future initiative).

## Consequences

- V021 is additive; existing journal entries get `NULL` in the new
  column and behave as before.
- The admin UI journal browser gains one column but no new screen —
  slice A is deliberately boring.
- The `JOURNAL_NEXT_HOP_SET` audit event participates in the
  existing hash-chain trigger; no code change there.
- Alpha.1 cannot yet complete an actual A → central → B referral
  loop. That requires alpha.2's outbound encoding + alpha.3's
  inbound poll. The slice-by-slice shape mirrors Initiative 10's
  "config first, enforce later" progression.
