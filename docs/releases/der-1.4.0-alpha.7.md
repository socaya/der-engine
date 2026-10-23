# DER 1.4.0-alpha.7 — Initiative 3 closeout: events + tracker scan + ingest

> **Scope:** Completes Initiative 3 option A. Encoder rewrites
> `orgUnit` for event/tracker payloads too; HTTP scanner now also
> queries `/api/events`; ingest service writes accepted events via
> `EventService`.

**Release label:** `der-1.4.0-alpha.7`
**Git tag:** `der-1.4.0-alpha.7`
**DHIS2 reference:** 2.44-SNAPSHOT

## New

- `ReferralPayloadEncoder` rewrites `orgUnit` on EVENT / PROGRAM_STAGE_EVENT /
  ENROLLMENT / TRACKED_ENTITY payloads when `nextHopOrgUnitUid` is
  set — mirrors the alpha.6 aggregate rewrite.
- `HttpCentralReferralSearchClient.findReferrals` runs **two**
  queries per tick: aggregate (`/api/dataValueSets`) and events
  (`/api/events?orgUnit=<bound>&ouMode=DESCENDANTS`). Event payloads
  are matched via the marker regex over `notes[].value`.
- `ReferralIngestService` adds an EVENT path — parses the stored
  event JSON, reconstructs an `EventService.EventInput`, overrides
  `orgUnit` with the bound OU, and submits.
- ENROLLMENT / TRACKED_ENTITY paths log and return `false` — the
  mark still happens but no local write.

## Test state

- **1259 server tests** pass (was 1250 + 9 new: 2 HTTP events parse +
  3 ingest events + 1 encoder orgUnit rewrite for events + 3 updates
  to existing tests). `mvn verify` green.
- Admin-ui + client: unchanged.
- SpotBugs + Checkstyle clean.

## Initiative 3 status

Option A (chain-via-hub) is now feature-complete for aggregate and
event. Enrollment / tracked-entity ingest, multi-hop chaining, and
signed/notarised referrals remain post-1.4.0 non-goals. Option B
(direct TLS mesh) and Option C (MQTT) ship as a design-spike ADR
in `der-2.0.0`.

## Promotion path

`der-1.4.0-alpha.7` → alpha.8 (Initiative 8 part 3 — MFA) →
alpha.9+ (Initiative 2 part 1 server plugin scaffold) → stable
`der-1.4.0`.
