# der-2.0.2-alpha.3 — attribution engine evidence

**Captured:** 2026-10-23
**Edge:** `localhost:8085` (DER 2.0.2-alpha.3-SNAPSHOT)
**Central:** `localhost:8080/dhis` (DHIS2 2.44-SNAPSHOT)

## Scope

Alpha.3 wires ADR-0032 end-to-end: `ReferralPayloadEncoder` now resolves
the captured-by DHIS2 username from `CapturedByResolver` and stamps
`storedBy` on every outbound DHIS2 payload (aggregate dataValueSets,
events, enrollments, tracker entity nested enrollments and events).

## Verified live

| Probe | Status | Evidence |
|---|---|---|
| Boot after V026 schema (persisted from alpha.2) | OK, 1.7s | — |
| Mapping persisted across restart | OK | `user-mappings-after-restart.json` |
| Admin GET mapping by edge user | OK | `user-mapping-get.json` |

## Attribution flow

```
┌───────────────────┐
│  Device client    │  session cookie binds captor
│  POST capture     │  → DER server
└────────┬──────────┘
         ▼
┌───────────────────┐
│ Edge              │ OperationJournalEntry.submittedBy = <edge user UUID>
│ operation_journal │ captured_by_dhis2_uid = <resolved at enqueue time>
└────────┬──────────┘
         ▼  (BackupDrainJob picks up PENDING entries)
┌───────────────────┐
│ ReferralPayload   │ CapturedByResolver.storedByFor(submittedBy)
│ Encoder.body()    │ ──→ "nurse.alice"
│                   │ ──→ payload.storedBy = "nurse.alice"
│                   │ ──→ payload.dataValues[].storedBy = "nurse.alice"
└────────┬──────────┘
         ▼
┌───────────────────┐
│ JournalPublisher  │ POST /api/dataValueSets?dryRun=false
│                   │ Basic auth = DER_DHIS2_USER (service account)
└────────┬──────────┘
         ▼
┌───────────────────┐
│ DHIS2 2.44        │ import summary.storedBy = "nurse.alice"
│                   │ (not the service account)
└───────────────────┘
```

## Unit test coverage (6 cases)

Suite: `StoredByAttributionTest`
- `aggregateStampsStoredByOnEnvelopeAndDataValues` — envelope +
  every `dataValues[].storedBy` set.
- `eventStampsStoredBy` — event payload envelope.
- `enrollmentStampsStoredBy` — enrollment envelope.
- `trackedEntityStampsNestedEnrollmentsAndEvents` — no top-level
  `storedBy` (DHIS2 doesn't accept one on TEIs); nested enrollments
  + events get the stamp.
- `noStampWhenMappingAbsent` — payload untouched, lenient fallback
  so the service account's `storedBy` from DHIS2 is retained.
- `noStampWhenResolverUnavailable` — graceful degradation when
  running in test slices without the attribution bean.

## Known limitation

The storedBy stamp currently sits in `ReferralPayloadEncoder` for
reach — every drain path routes through it. Alpha.4 should split
the responsibility into a dedicated `StoredByStampingEncoder` and
chain it in a composition so the two concerns (next-hop referral
marker + captor attribution) are testable independently.

## Next

- **Lenient vs strict** policy flag (`der.attribution.strict`): when
  strict, drains fail with `USER_NOT_MAPPED` instead of silently
  falling back to the service account.
- **Playwright DC smoke:** capture → verify DHIS2 import summary
  records `storedBy = mapped username`.
- **Nightly mapping refresh** job that reconciles DHIS2 user renames
  against the stored `dhis2_username`.
