# DER 1.4.0-alpha.3 — Initiative 3: referral outbound encoding

> **Scope:** Attaches a `[DER-next-hop:<ou>]` marker to the DHIS2
> payload before publish so central (and later the receiving edge)
> can detect the referral intent inline. The journal column remains
> the source of truth; the marker is a transport-layer carrier.
> Inbound poll follows in alpha.4+.

**Release label:** `der-1.4.0-alpha.3`
**Git tag:** `der-1.4.0-alpha.3`
**DHIS2 reference:** 2.44-SNAPSHOT

## New

- `ReferralPayloadEncoder` (ADR-0027 D-RHO-7, codified in alpha.3).
  Given a journal entry with `nextHopOrgUnitUid` set, mutates a deep
  copy of the payload before serialising it to the request body:
    - `AGGREGATE_DATA_VALUE` → append `[DER-next-hop:<ou>]` to the
      `comment` field (space-separated when existing content).
    - `EVENT`, `PROGRAM_STAGE_EVENT`, `ENROLLMENT`, `TRACKED_ENTITY`
      → push `{"value":"[DER-next-hop:<ou>]"}` into the `notes[]`
      array (create if missing).
- `JournalPublisher` now takes the encoder as a constructor arg and
  uses `encoder.body(entry)` instead of `entry.payload().toString()`.
  Behaviour unchanged for entries with no `nextHopOrgUnitUid`.
- Fail-open: if payload shape doesn't match (not an ObjectNode,
  array root, etc.), the publisher logs WARN and sends the raw
  payload. Capture-is-always-available (ADR-0004) wins.

## Behaviour

```
Journal entry: nextHopOrgUnitUid="ou-dest",
                payload={"dataElement":"de","comment":"BP high"}

JournalPublisher.publish:
    body = encoder.body(entry)
         = {"dataElement":"de","comment":"BP high [DER-next-hop:ou-dest]"}
    POST  /api/dataValueSets ← body
```

```
Journal entry: entityType=EVENT,
                nextHopOrgUnitUid="ou-dest",
                payload={"event":"e1","program":"p1","dataValues":[]}

body = {"event":"e1","program":"p1","dataValues":[],
        "notes":[{"value":"[DER-next-hop:ou-dest]"}]}
```

| Entity type | Carrier field |
|---|---|
| `AGGREGATE_DATA_VALUE` | `comment` string (space-appended) |
| `EVENT` / `PROGRAM_STAGE_EVENT` | `notes[].value` |
| `ENROLLMENT` / `TRACKED_ENTITY` | `notes[].value` |

The receiving edge (alpha.4+) will parse the marker regex
`\[DER-next-hop:([A-Za-z0-9_-]+)\]` out of these fields to detect
inbound referrals.

## Test state

- **1205 server tests** pass (was 1193 + 12 new: 1 publisher
  marker-smoke + 11 encoder shape coverage). `mvn verify` green.
- Admin-ui: unchanged (224 tests).
- Client: unchanged (153 tests).
- SpotBugs + Checkstyle clean.

## Deliberate non-goals

- Inbound poll (query central for referrals targeted at the local
  bound OU, ingest into local store). Alpha.4+.
- Alternative markers (e.g. a DHIS2 attribute) — JSON path through
  `notes[]` is the single supported form.
- Signed / notarised markers.
- Marker versioning — `[DER-next-hop:<ou>]` is the v1 shape; future
  revisions bump the prefix (e.g. `[DER-next-hop/v2:<...>]`).

## Promotion path

`der-1.4.0-alpha.3` → alpha.4 (inbound poll + admin inbox UI) →
alpha.5+ (Initiative 2 / 8) → stable `der-1.4.0`.
