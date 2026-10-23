# DER 1.4.0-alpha.5 — Initiative 3: HTTP referral search + resolve

> **Scope:** Replaces the alpha.4 no-op with an HTTP implementation
> of `CentralReferralSearchClient` that queries central's
> `/api/dataValueSets` and filters by the ADR-0027 D-RHO-7 marker.
> Adds resolve endpoints (accept + dismiss) and admin UI buttons.
> Aggregate scan only; events / tracker + outbound orgUnit rewrite
> move to alpha.6.

**Release label:** `der-1.4.0-alpha.5`
**Git tag:** `der-1.4.0-alpha.5`
**DHIS2 reference:** 2.44-SNAPSHOT

## New

- `HttpCentralReferralSearchClient` (`@Primary`,
  `@ConditionalOnProperty(prefix="der.referral.http", name="enabled")`).
  Queries central
  `/api/dataValueSets?orgUnit=<bound>&children=true&lastUpdated=<since>`,
  parses the body, matches each `dataValue.comment` against
  `\[DER-next-hop:([A-Za-z0-9_-]+)\]`, filters by bound-OU match, and
  returns `(AGGREGATE_DATA_VALUE, <de|ou|period|coc>, raw-json)`
  candidates. Fail-open on IO / interruption / non-2xx.
- Resolve endpoints (ADMIN only):
    - `POST /edge-api/v1/referral/inbox/{inboxId}/accept` → marks
      `ACCEPTED`.
    - `POST /edge-api/v1/referral/inbox/{inboxId}/dismiss` → marks
      `DISMISSED`.
    - 404 when the row is not pending (idempotent across repeated
      resolves).
- Admin UI inbox screen gets Accept + Dismiss buttons per row with
  disabled-while-busy state.
- `edgeApi.acceptReferralInbox` + `dismissReferralInbox` helpers.

## Behaviour

```
der.referral.http.enabled=true + der.central.base-url=http://central/dhis
  → ReferralInboxPollJob fires (every 10 min by default)
    → ReferralInboxScanner.scanOnce()
       → HttpCentralReferralSearchClient.findReferrals(ouUid, since)
          GET /api/dataValueSets?orgUnit=<ouUid>&children=true
                                &lastUpdated=<since>
          filter dataValues where comment matches
            [DER-next-hop:<ouUid>]
          returns Candidate(AGGREGATE_DATA_VALUE, de|ou|period|coc, …)
       → inbox.insertIfAbsent for each candidate

POST /edge-api/v1/referral/inbox/<id>/accept   (ADMIN)
POST /edge-api/v1/referral/inbox/<id>/dismiss  (ADMIN)
  → inbox.markResolved(id, status, actor, now)
  → 200 { inboxId, status } | 404 when not pending
```

## Known limitation (closed in alpha.6)

The HTTP search queries central by bound OU, but alpha.3's outbound
encoding only *tags* the comment — it does **not** rewrite the
dataValue's `orgUnit` to the destination. So in practice central
still stores the dataValue under the sending edge's OU, and this
scan won't surface it unless operators either:

1. Pre-set the dataValue's `orgUnit` to the destination OU on write
   (manual), or
2. Wait for alpha.6, which adds the outbound orgUnit rewrite so the
   referral lives naturally under the receiving OU in central.

For testing today, point `der.referral.http.enabled=true` and seed
central with a dataValue manually set to the destination OU plus the
marker — the scan will pick it up.

## Test state

- **1239 server tests** pass (was 1223 + 10 HTTP client + 3 resolve
  controller + 3 existing controller mock widening). `mvn verify`
  green.
- **237 admin-ui tests** pass (was 230 + 5 resolve-button screen +
  2 edgeApi table rows). Vitest at **100 / 91.09 / 97.92 / 100** —
  thresholds unchanged.
- Client: unchanged (153 tests).
- SpotBugs + Checkstyle clean.

## Deliberate non-goals (deferred to alpha.6)

- Outbound orgUnit rewrite so central stores the dataValue under the
  destination OU.
- Events + tracker HTTP scan (`/api/events` + `/api/tracker/events`
  + `/api/tracker/enrollments`).
- Accept-ingest: today's `accept` just marks the row; alpha.6 will
  write the payload into the local `AggregateDataValueService` so
  the receiving edge actually sees the data.
- Payload drill-in on the inbox screen (today shows metadata only).
- Multi-hop referral chaining.
- Initiative 2 part 1 (server plugin), Initiative 8 part 3 (MFA).

## Promotion path

`der-1.4.0-alpha.5` → alpha.6 (outbound OU rewrite + accept-ingest +
events/tracker scan) → alpha.7+ (Initiative 2 / 8) → stable
`der-1.4.0`.
