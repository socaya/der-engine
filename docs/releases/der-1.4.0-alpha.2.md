# DER 1.4.0-alpha.2 — Initiative 3: referral write-time capture

> **Scope:** Picks up the referral intent at write time so a journal
> entry is tagged with its `next_hop` destination **during** the POST
> rather than requiring a follow-up admin tag. Aggregate and event
> write paths wire the new `X-DER-Referral-Next-Hop` header into
> their respective services; the stored journal entry carries the
> destination OU on insert.

**Release label:** `der-1.4.0-alpha.2`
**Git tag:** `der-1.4.0-alpha.2`
**DHIS2 reference:** 2.44-SNAPSHOT

## New

- `OperationJournalRepository.insert` now writes
  `next_hop_org_unit_uid` from the record. Existing callers continue
  to use the 10-arg convenience constructor, which puts `null` into
  the column — identical to pre-slice-B behaviour.
- `AggregateDataValueService.submit` gains a 5-arg overload that
  threads `nextHopOrgUnitUid` onto every journal entry produced by
  the call. Legacy 4-arg callers unchanged.
- `EventService.submit` gains the same 5-arg overload.
- `DataValueSetsController` and `EventsController` read
  `X-DER-Referral-Next-Hop` from the request and pass it to their
  services. Blank / absent header stays `null` on insert.
- Tracker paths (`/api/tracker`, `/api/tracker/events`) share
  `EventsController.handle` and inherit the header automatically.

## Behaviour

```
POST /api/dataValueSets
    X-DER-Referral-Next-Hop: ou-dest
    body { dataValues: [...] }
    ↳ AggregateDataValueService.submit(..., "ou-dest")
    ↳ journal.insert(entry[nextHopOrgUnitUid="ou-dest"])
    ↳ 200 ImportSummary (unchanged shape)
```

```
POST /api/events
    X-DER-Referral-Next-Hop: ou-dest
    body { events: [...] }
    ↳ EventService.submit(..., "ou-dest")
    ↳ journal.insert(entry[nextHopOrgUnitUid="ou-dest"])
```

| Header value | Stored on journal |
|---|---|
| missing | `null` (unchanged pre-slice-B behaviour) |
| blank / whitespace | `null` |
| `ou-dest` | `"ou-dest"` (trimmed) |

The journal **still drains to central as a normal POST** — alpha.2
does not yet encode the next-hop into the outbound DHIS2 payload.
That (comment attachment for aggregate; event note for events) ships
in alpha.3. The inbound poll follows in alpha.4+.

## Test state

- **1193 server tests** pass (was 1186 + 7 new: 2 service-level
  aggregate + 1 service-level event + 1 controller aggregate + 1
  controller event + 2 existing mock widenings). `mvn verify` green.
- Admin-ui: unchanged (224 tests).
- Client: unchanged (153 tests).
- SpotBugs + Checkstyle clean.

## Deliberate non-goals (deferred)

- Outbound DHIS2 encoding (dataValue `comment` for aggregate, event
  `notes` for events, TEI attribute for tracker). Alpha.3.
- Inbound poll job. Alpha.4+.
- Tracker enrollment / TEI header threading (the current wiring
  reuses the events pipeline — enrollment-specific paths land with
  the inbound poll).
- Multi-hop referrals in a single tag.
- Signed / notarised referral chains.

## Promotion path

`der-1.4.0-alpha.2` → alpha.3 (outbound encoding) → alpha.4+
(inbound poll + admin inbox) → alpha.5+ (Initiative 2 / 8) → stable
`der-1.4.0`.
