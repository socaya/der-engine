# DER 1.4.0-alpha.4 — Initiative 3: referral inbox scaffolding

> **Scope:** Lays the inbox schema, scanner service, Quartz poll job,
> read-only admin UI and a no-op central-search client. The scanner
> is wired end-to-end but discovers no candidates until alpha.5
> replaces the no-op client with a real HTTP integration.

**Release label:** `der-1.4.0-alpha.4`
**Git tag:** `der-1.4.0-alpha.4`
**DHIS2 reference:** 2.44-SNAPSHOT

## New

- Database migration **V022** — `referral_inbox` table with
  `UNIQUE (kind, source_ref)` so re-polls don't create duplicates.
  Partial index on `(status, discovered_at)` for pending-only scans.
- `ug.ac.mak.der.workflows.referral`:
    - `ReferralInboxEntry` record (`inbox_id`, `kind`, `source_ref`,
      `bound_org_unit`, `payload`, `discovered_at`, `status`,
      `resolved_by`, `resolved_at`).
    - `ReferralInboxRepository` — `insertIfAbsent` (ON CONFLICT DO
      NOTHING), `findPending`, `markResolved`.
    - `CentralReferralSearchClient` interface — single
      `findReferrals(ouUid, since)` method.
    - `NoOpCentralReferralSearchClient` default `@ConditionalOnMissingBean`
      impl returning `List.of()`. Alpha.5 replaces it.
    - `ReferralInboxScanner` service — reads the bound OU, calls the
      central client, upserts each candidate. Fail-open on lookup
      failures (ADR-0004).
- `ReferralInboxPollJob` Quartz job on
  `der.referral.inbox.cron:0 */10 * * * ?`. Logs outcome into
  `scheduled_job_run`.
- `GET /edge-api/v1/referral/inbox?limit=` — any authenticated user;
  returns pending entries (metadata only; raw payload drill-in lands
  with the resolve UI in alpha.5).
- Admin UI `EAReferralInbox` (EA-REF-01) at `/referral/inbox`,
  Referral nav link, `edgeApi.listReferralInbox` helper.

## Behaviour

```
Every 10 minutes (configurable):
  ReferralInboxPollJob fires
    ↳ ReferralInboxScanner.scanOnce()
         if !bound → ScanResult.NOT_BOUND
         candidates = central.findReferrals(ouUid, now-24h)
         for each → inbox.insertIfAbsent(ReferralInboxEntry(…))
         emit ScanResult{outcome, candidates, inserted}
    ↳ scheduled_job_run row with the outcome payload

GET /edge-api/v1/referral/inbox            (any-auth)
    → { entries: [{ inboxId, kind, sourceRef, boundOrgUnit,
                     discoveredAt, status }] }

Admin UI /referral/inbox → empty-state (alpha.4) or table (alpha.5+)
```

Alpha.4 ships the no-op client — the inbox stays empty on every poll
until alpha.5 replaces the bean with an HTTP-based search that
queries central's `/api/dataValueSets` + `/api/events` + tracker
endpoints and parses the ADR-0027 D-RHO-7 marker regex
`\[DER-next-hop:([A-Za-z0-9_-]+)\]`.

## Test state

- **1223 server tests** pass (was 1205 + 18 new: 7 repository +
  7 scanner + 3 controller + 4 job). `mvn verify` green.
- **230 admin-ui tests** pass (was 224 + 4 inbox screen + 1 edgeApi
  table row + 1 App route). Vitest at **100 / 90.9 / 97.86 / 100** —
  thresholds unchanged.
- Client: unchanged (153 tests).
- SpotBugs + Checkstyle clean.

## Deliberate non-goals (deferred to alpha.5)

- Real `CentralReferralSearchClient` HTTP implementation.
- Resolve actions on the inbox entry (`accept` → ingest into local
  store, `dismiss` → mark DISMISSED).
- Admin UI resolve buttons + payload drill-in.
- Multi-hop referral tracking across the chain.
- Signed / notarised inbox entries.
- Initiative 2 part 1 (server plugin), Initiative 8 part 3 (MFA).

## Promotion path

`der-1.4.0-alpha.4` → alpha.5 (real central search + accept/dismiss
flow + resolve UI) → alpha.6+ (Initiative 2 / 8) → stable
`der-1.4.0`.
