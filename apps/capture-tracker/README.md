# `@der/app-capture-tracker`

Tracker capture app (C-UI-5c slice 5). Replaces
`client/src/screens/TrackerSearch.tsx`,
`client/src/screens/EnrollmentCreate.tsx` and
`client/src/screens/TrackerDashboard.tsx` over the slice-5 rollout.
The shell screens are **unchanged** by this slice — this app and
the shell screens coexist. The shell screens flip to a redirect in
a later release.

## Build

```sh
cd client && node scripts/build-apps.mjs
```

Output: `apps/capture-tracker/dist/bundle.js` — a single ESM module
externalling react, react/jsx-runtime, react-dom, react-router-dom
and `@der/app-sdk`.

## Install

From **Admin UI → Settings → App catalogue → Install app**:

- App key: `capture-tracker`
- Display name: `Tracker capture`
- Module: `Data`
- Version: `0.1.0-alpha.1`
- Requires DER API: `1.0.0`
- File: `apps/capture-tracker/dist/bundle.js`

## UI (slice 5)

- Pick a program (UID) → list tracked entities for the bound OU
  via `useDerApi().listTrackerEntities()`.
- Small results table (TEI uid + display name + last-updated).
- **Enrol new TEI** inline form (tracked-entity type UID,
  first-attribute UID + value) → `useDerApi().enrolTei()` which
  POSTs to `/api/tracker`.
- Online StatusPill reflects `useOnlineStatus()`.

Follow-up slices migrate full tracker parity (per-attribute
search, program-rule evaluation, enrolment-dashboard with stage
events, multi-attribute TEI editing).
