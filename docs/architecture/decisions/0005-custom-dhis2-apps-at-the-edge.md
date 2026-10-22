# ADR-0005: Hosting custom DHIS2 apps on the DER edge

- Status: **ACCEPTED (finalized in alpha.6)**
- Date: 2026-10-22 (proposed); 2026-10-22 (accepted alpha.6)
- Deciders: socaya
- Related: [ADR-0004](0004-hybrid-dhis2-edge-emulation.md)
- Related requirements: FR-04-02, FR-04-04, FR-05-01, FR-05-05, FR-13-01, FR-13-06, NFR-01, NFR-22
- Related work: Phase 05 metadata/data refresh and the DER metadata mirror introduced in ADR-0004 / Phase 03b

## Context

DHIS2 operators routinely rely on custom installable apps — Uganda MoH's
eRegister is the motivating example. These are React applications built
with `@dhis2/app-platform`, uploaded to a central DHIS2 via
`POST /api/apps`, served under `/api/apps/{appKey}/*` and listed via
`GET /api/apps`. Their own `@dhis2/app-runtime` Data Engine resolves
API calls through whatever origin served them.

Under ADR-0004 the DER edge emulates the DHIS2 Web API but currently only
hosts the DER-native device-client. If a user wants to run eRegister on
the edge:

- Pointing `/api/apps` at the central means the app bundle still has to
  load from central over the WAN. If the WAN is down, the app does not
  open at all. That contradicts the whole point of the edge runtime.
- Even if the bundle is cached in the browser, its subsequent
  `/api/trackedEntities` / `/api/events` / custom endpoint calls go
  through the same origin, so DER must be ready to answer them — but DER
  cannot know a given custom app's endpoint matrix in advance.

## Decision (proposed)

DER becomes a local **DHIS2 app host**, not just an API emulator:

1. **App catalogue mirror.** Phase 05 metadata sync extends to call
   `GET /api/apps` on central and mirror the result into a new
   `metadata_dhis2_app` table (schema V003 or V004). Each row carries
   `appKey`, `name`, `version`, `appType` (`APP` / `DASHBOARD_APP` /
   `TRACKER_DASHBOARD_WIDGET` / `RESOURCE_APP`), `manifestWebappJson`,
   `bundleFingerprint`, `syncedAt`, `installedLocally` flag.
2. **Bundle store.** Bundles are stored under
   `~/.der/apps/{appKey}-{version}/` on the edge filesystem (not in
   Postgres). DER's sync downloads them from central
   (`GET /api/apps/{appKey}` returns a ZIP) and extracts.
3. **DER serves `/api/apps`.** The DHIS2-emulator gains
   `GET /api/apps` returning the mirrored catalogue in DHIS2 shape and
   `GET /api/apps/{appKey}/*` serving the extracted bundle's static
   files. From the custom app's perspective nothing changes — same URL
   contract as against central DHIS2.
4. **Admin install endpoint.** `POST /edge-api/v1/apps/install` accepts
   an uploaded ZIP so admins can bootstrap an app without reaching
   central (useful for air-gapped first boot). This also lets the Uganda
   MoH ship a custom eRegister build straight to the edge host without
   round-tripping central.
5. **Per-app compatibility declaration.** Each mirrored app's
   `manifestWebappJson` is parsed; its `activities` + known-DHIS2-API
   calls are recorded in
   `docs/verification/compatibility/der-emulated-matrix.csv` with
   `source=app:{appKey}`. Endpoints DER does not emulate return a
   stable 501 with a DHIS2-shape error so the custom app can show
   "unsupported offline" rather than conflating it with a transient
   failure (FR-04-06).
6. **Client launcher integration.** The DER device-client launcher (new
   tile added in Phase 05) reads `/api/apps` and lists installable apps
   alongside the metadata-browser tiles. Clicking a tile navigates to
   `/api/apps/{appKey}/index.html`, which is served from the local
   bundle store. From that point on, the app is a standalone DHIS2
   App-Platform SPA running against DER's `/api/*`.

## Rejected: proxy to central at runtime

Transparent reverse-proxying `/api/apps/*` to central would be the
smallest change but it binds every app launch to WAN availability. That
breaks the fundamental promise of DER (ADR-0004 §Consequences). Rejected.

## Rejected: ask every custom app to be rebuilt against DER

Any approach that requires modifying the Uganda MoH eRegister codebase
is a non-starter. The App Platform contract is the integration surface
DER must honour.

## Consequences

- A new migration (likely V003) adds `metadata_dhis2_app`.
- The server grows a `ug.ac.mak.der.appstore` package with the
  catalogue mirror + bundle extraction logic.
- Phase 05 metadata sync adds a step for apps.
- Phase 06 operations guide covers bundle disk-space budgeting
  (`~/.der/apps/` can grow to hundreds of MB per app).
- Attempting to install an unsafe bundle (zip-slip, over-large files)
  is a security concern — the install endpoint must validate.
- Per-app endpoint-coverage declarations become a maintenance surface:
  every new custom app that lands on an edge needs a review and a
  compatibility matrix entry.

## Non-decisions / out of scope here

- Which specific endpoints Uganda MoH eRegister requires beyond the
  current Phase 03b surface — captured in Phase 05 analysis.
- Signed app bundles / app provenance (Phase 09).
- App version rollback and A/B comparison (future).

## Current (Phase 03c) stance

Phase 03c alpha.1 ships the DER-native device-client only. It does
**not** host custom DHIS2 apps yet. ADR-0005 is PROPOSED here so the
work is visible in the ADR index and Phase 05 can pick it up; the
decision becomes ACCEPTED when Phase 05 planning begins. Until then,
users who need eRegister sign in to the central directly over the WAN
when it is reachable, which is the pre-DER status quo.
