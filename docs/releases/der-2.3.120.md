# der-2.3.120 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.119`

## Headline

**R-AQ — three paper-cuts off the queue + lineage flow.** The Spring
error pipeline no longer rewrites controller exceptions as HTTP 401
(the actual root cause of the 2.3.119 "invalid credentials" red
herring); the queue header now carries a **Last cleaned <ago> · <n>
rows** chip wired to the audit log; and the per-row **Lineage** button
on `/data/aggregate`, `/data/events`, and `/data/tracker` is hardened
with `stopPropagation` so the surrounding row-click can never swallow
it.

## 1. R-AQ/1 — `/error` is permit-listed

**Context.** When a controller throws, Spring forwards the request to
`/error`. The forward is a fresh request with no principal attached,
so Spring Security's filter chain sees it as anonymous and the
`HttpStatusEntryPoint(UNAUTHORIZED)` rewrites the response to 401 —
masking the actual 500 and its message. We hit this during 2.3.119
when a `BadSqlGrammarException` from `OperationJournalRepository.
findById` surfaced in the admin UI as *"invalid credentials"*.

**Fix.** `SecurityConfig.securityFilterChain` now has
`.requestMatchers("/error").permitAll()` so the error forward reaches
`DispatcherServlet`'s default error controller untouched. The real
status (500) + payload is returned.

This is safe: `/error` is a Spring-internal path and only ever
dispatches as the continuation of an already-authenticated request;
there is no exposure of unauthenticated application state.

## 2. R-AQ/2 — "Last cleaned" chip on `/data/queue`

The queue header now reads:

```
Locally captured data · DER → Central · Last successful push 3m ago
  · Waiting 2 · Sent 12 · Last cleaned 1h ago · 7 rows
```

The chip appears once `JOURNAL_RETENTION_PURGE` has ever fired —
either from the retention cron or from the **Clean processed**
button. Operators can tell at a glance whether disk growth is in
hand.

Wiring:

| Layer | Change |
|---|---|
| server | new `GET /edge-api/v1/admin/ops/journal/last-purge` returns the most-recent `JOURNAL_RETENTION_PURGE` audit event (observedAt + rowsPurged + olderThanDays) |
| client | `edgeApi.fetchLastJournalPurge()` + reload wired alongside the 4 existing fetches on `DataQueues.tsx` |
| UI | subtitle chip renders only when `observedAt` is non-empty — fresh installs see no stale "0 rows cleaned" |

No new storage: we read from `der.security_audit` so there's exactly
one authoritative record of what was purged and when.

## 3. R-AQ/3 — Lineage button defensive propagation

**Symptom** (user-reported): "lineage drawer not opening for all
records in `/admin/data/tracker`" — same complaint for `data/events`
and `data/aggregate`.

**Fix.** All three Lineage buttons now `e.stopPropagation()` before
calling `setLineage*(...)`. The surrounding `<tr>` has its own
`.closest('a,button')` guard, but event-ordering between React's
delegated handlers and state flush can produce an edge where the
row's navigate fires in the same tick, unmounting the table before
the drawer renders. Explicit stopPropagation removes the ambiguity.

Changed files: `DataAggregate.tsx`, `DataEvents.tsx`,
`DataTracker.tsx`.

## 4. Live verification

```
GET /system/health                                   → 200
POST /auth/sign-in                                    → 200 (DER_SESSION cookie)
GET /admin/ops/journal/last-purge                     → 200
    { observedAt: "", rowsPurged: 0, olderThanDays: 0 }   ← fresh install
GET /data/tracker?limit=1                             → 200 (EVENT row returned)
GET /data/tracker/event/pVdgjJ46qs0/payload           → 200 (payload + journal)
GET /data/tracker/tei/MfETweFe4IF/payload             → 200
tsc --noEmit                                          → clean
cross-module lint                                     → clean
```

Pre-existing admin-ui test failures (4 in `EACoreScreens.test.tsx`
EA-CWF-01) are unchanged across this release — tracked as a separate
cleanup.

## 5. Files changed

```
server/.../security/SecurityConfig.java              — /error permit
server/.../web/OperationsAdminController.java         — GET /journal/last-purge

admin-ui/src/api/edgeApi.ts                          — fetchLastJournalPurge
admin-ui/src/screens/DataQueues.tsx                   — Last cleaned chip
admin-ui/src/screens/DataAggregate.tsx                — stopPropagation on Lineage
admin-ui/src/screens/DataEvents.tsx                   — stopPropagation on Lineage
admin-ui/src/screens/DataTracker.tsx                  — stopPropagation on Lineage

VERSION / server/pom.xml / admin-ui/package.json
  / admin-ui/public/sw.js                             — 2.3.120
```

## 6. Follow-ups

- If operators still see the Lineage drawer fail to open after 2.3.120,
  the next step is a `console.log` in the button handler to confirm it
  fires — this release eliminates the propagation-race hypothesis but
  does not rule out stale cached bundles. Service-worker version was
  bumped (`der-admin-v2.3.120`) so hard-reload picks up the new JS.
- Defensive repo-mapper guard (contract test that every `findBy*`
  SELECT covers every column `rowMapper()` reads) is still deferred —
  the `/error` permit means future repository SELECT mismatches will
  surface as honest 500s with the real cause, which is the practical
  outcome the guard would have forced.
- The server exception entry still returns a generic 401 for actual
  anonymous requests; nothing in this change relaxes that path.
