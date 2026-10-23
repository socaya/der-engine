# DER 1.4.0-alpha.6 — Initiative 3: outbound OU rewrite + accept-ingest

> **Scope:** Closes the end-to-end referral loop for aggregate
> dataValues. The outbound encoder now rewrites `orgUnit` to the
> destination so central stores the dataValue under the receiving
> OU; the receiver's inbox scan naturally finds it; accepting the
> entry writes it into the local store via the normal aggregate
> pipeline. Events + tracker ship in alpha.7.

**Release label:** `der-1.4.0-alpha.6`
**Git tag:** `der-1.4.0-alpha.6`
**DHIS2 reference:** 2.44-SNAPSHOT

## New

- `ReferralPayloadEncoder` now rewrites the `orgUnit` field on
  AGGREGATE_DATA_VALUE payloads when `nextHopOrgUnitUid` is set —
  central records the dataValue under the destination OU. The
  marker continues to be appended to `comment` as a diagnostic.
- `ReferralIngestService` (new). On accept, parses the stored inbox
  payload, builds a `DataValueInput` (overriding `orgUnit` with the
  inbox entry's bound OU — i.e. the local one), and submits via
  `AggregateDataValueService.submit`. The normal write pipeline
  (validation, journal insert, audit) runs unchanged.
- `ReferralInboxRepository.findById` for the controller's
  look-before-ingest flow.
- `ReferralInboxController` accept now:
  1. `findById` → 404 when missing or already resolved.
  2. Ingests via `ReferralIngestService` (optional bean via
     `ObjectProvider` — ingest may be absent in cut-down profiles).
  3. Marks the row `ACCEPTED` and returns
     `{ inboxId, status, ingested }`.

## Behaviour

```
Sender edge POSTs /api/dataValueSets with
    X-DER-Referral-Next-Hop: ou-dest
    body { "dataValues": [{ dataElement, orgUnit: "ou-src", … }] }

Journal entry stored with nextHopOrgUnitUid = "ou-dest".
On drain:
    JournalPublisher.publish → ReferralPayloadEncoder.body
      → orgUnit rewritten to "ou-dest"
      → comment appended with [DER-next-hop:ou-dest]
    POST /api/dataValueSets to central

Receiver edge (bound to ou-dest):
    ReferralInboxPollJob fires → HttpCentralReferralSearchClient
      GET /api/dataValueSets?orgUnit=ou-dest&children=true&lastUpdated=…
      finds the dataValue (central stored it under ou-dest)
      marker matches → inbox entry inserted

Admin clicks Accept on EA-REF-01:
    POST /edge-api/v1/referral/inbox/<id>/accept
    → findById(id) → PENDING
    → ReferralIngestService.ingest
         builds DataValueInput(..., orgUnit=ou-dest, ...)
         AggregateDataValueService.submit → values + journal + audit
    → markResolved(id, ACCEPTED)
    → { inboxId, status: ACCEPTED, ingested: true }
```

The accept path uses the inbox entry's `bound_org_unit` to override
the payload's `orgUnit` on ingest. This is the correct semantic:
central stored the dataValue under the receiving OU; the local
record on the receiver should carry the local bound OU.

## Test state

- **1250 server tests** pass (was 1239 + 5 ingest service + 2
  controller + 1 encoder + 3 misc updates). `mvn verify` green.
- Admin-ui: unchanged (237 tests).
- Client: unchanged (153 tests).
- SpotBugs + Checkstyle clean.

## Deliberate non-goals (deferred to alpha.7)

- Events + tracker HTTP scan.
- Event / enrollment / TEI accept-ingest.
- Multi-hop referrals.
- Payload drill-in on the inbox screen (metadata-only today).
- Automatic accept (today's flow requires an admin click per entry).
- Initiative 2 part 1 (server plugin), Initiative 8 part 3 (MFA).

## Promotion path

`der-1.4.0-alpha.6` → alpha.7 (events + tracker scan + ingest) →
alpha.8+ (Initiative 2 / 8) → stable `der-1.4.0`.
