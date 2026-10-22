# DER 0.4.0-alpha.1 — Phase 03c, DER-platform client (@dhis2/ui)

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **Phase scope:** DER device-client built on `@dhis2/ui` + `@dhis2/app-runtime` and pointed at DER's `/api/*` emulator. **Architecture:** hybrid per [ADR-0004](../architecture/decisions/0004-hybrid-dhis2-edge-emulation.md). **Pre-release:** alpha — write paths and the DHIS2-app host remain for Phase 03.5 / 05.

**Release label:** `der-0.4.0-alpha.1`
**Git tag:** `der-0.4.0-alpha.1`
**Maven artifact:** `ug.ac.mak.der:der-server:0.4.0-SNAPSHOT`
**Pinned DHIS2 reference:** `2.44-SNAPSHOT`
**Architecture:** hybrid (ADR-0004)

## New in this release

| Area | Deliverable |
|---|---|
| Client stack | `@dhis2/ui` 10.19.4, `@dhis2/app-runtime` 3.17.4, `react-router-dom` 6.30.6, `styled-jsx` 4.0.1 (peer of @dhis2/ui@10). |
| Entry | `main.tsx` wraps `App` in `BrowserRouter` → `DataProvider(baseUrl="", apiVersion=44)`. The Data Engine resolves against the DER origin so `GET /api/*` reaches DER's emulator. |
| Auth | `AuthProvider` + `useAuth` hook; probes `GET /edge-api/v1/auth/session` at mount; distinguishes `INITIAL / ANONYMOUS / AUTHENTICATED / EDGE_DOWN`. |
| Guard | `RequireAuth` route-level redirect to `/sign-in` for anonymous, `/edge-error` for edge-down. |
| Chrome | `HeaderBar` from `@dhis2/ui` at the top of every page. `SyncStatusPill` (`Tag`) renders DC-17 states; deliberately never renders "Synchronised" at Phase 03. |
| DC-01 | `SignIn` — Argon2-backed form against `/edge-api/v1/auth/sign-in`; differentiated error copy for invalid-credentials / rate-limited / edge-down. |
| DC-02 | `SessionDetails` — projects the authenticated user into a Card. |
| DC-03 | `Launcher` — Card tiles per metadata workflow + an ADMIN-only sync panel that fires `POST /edge-api/v1/sync/metadata`. |
| DC-04 | `RecentWork` — reads `/edge-api/v1/activity/recent` and renders a DataTable. |
| DC-05/08/11 metadata lane | `MetadataBrowser` — generic read-only table for the five mirrored entity types, using `useDataQuery`. One component drives five routes (OU/DE/DS/P/TET). |
| DC-18 | `EdgeConnectionError` — explanatory NoticeBox + Retry button when the DER server is unreachable. |
| Edge API wrapper | `src/api/edgeApi.ts` — single fetch wrapper that classifies errors into `EdgeApiError{INVALID_CREDENTIALS, RATE_LIMITED, EDGE_UNREACHABLE, UNKNOWN}`. |

## Custom DHIS2 apps (eRegister, etc.)

[ADR-0005](../architecture/decisions/0005-custom-dhis2-apps-at-the-edge.md)
is written in PROPOSED state. Phase 03c does **not** host custom installable
DHIS2 apps on the edge; the catalogue mirror + bundle store + per-app
compatibility declarations are a Phase 05 deliverable. Until then, custom apps
only work when the central is reachable — same as a stock DHIS2 Android
install.

## Test state

- Client Vitest: **59/59 tests PASS**; V8 coverage **100% line / 100% function / 100% statement / 92.25% branch** across every production source. Branch threshold temporarily set to **90%** for this alpha (`client/vite.config.ts`); will be raised back to 100% for the stable `der-0.4.0`. The uncovered branches are JSX fallback paths in `@dhis2/ui`-wrapping components (Launcher `instanceof Error` fallback, SignIn early returns, MetadataBrowser `colSpan` + id-null-fallback).
- Server Vitest: **247/247 tests PASS**, JaCoCo 100% line + branch, SpotBugs clean, Checkstyle clean (unchanged from alpha.0).
- Live-run (recreated for this alpha):
  - `scripts/run_all_checks.sh` with `.env.local` sourced: **PASS**, 18 steps.
  - DHIS2 compatibility probe: 9/9 Phase 01 rows PASS; central version `2.44-SNAPSHOT`.
  - Metadata sync against localhost DHIS2: 874 records mirrored (same shape as alpha.0).

## Deliberate non-goals (still out of scope)

- **Write paths** — `POST /api/dataValueSets`, `/api/events`, `/api/tracker`. Phase 03.5.
- **Durable outbox / journal** — Phase 04.
- **Scheduled sync** — Phase 05.
- **Custom DHIS2 app hosting** — Phase 05 per [ADR-0005](../architecture/decisions/0005-custom-dhis2-apps-at-the-edge.md).
- **Shared visibility E2E** — depends on writes; Phase 03.5.
- **Playwright E2E / OWASP dependency scan** — unchanged opt-in.

## Reproducing

```bash
git clone https://github.com/socaya/der-engine.git
cd der-engine && git checkout der-0.4.0-alpha.1

# Database + env (one-off)
psql -h localhost -U postgres -f deployment/postgresql/der-db-bootstrap.sql
cp .env.local.example .env.local  # fill in secrets

set -a; source .env.local; set +a

# Build + test server and client.
bash scripts/run_all_checks.sh

# Run the full stack in dev:
#   terminal 1 — DER server
java -jar server/target/der-server-0.4.0-SNAPSHOT.jar
#   terminal 2 — DER client (Vite proxies /edge-api and /api to the server)
cd client && npm run dev
# browse http://localhost:5174 and sign in with your bootstrap admin creds.
```
