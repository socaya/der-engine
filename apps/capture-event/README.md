# `@der/app-capture-event`

Event-program capture app (C-UI-5c slice 4). Replaces
`client/src/screens/EventNew.tsx` + `EventList.tsx` over the
slice-4 rollout. The shell screens are **unchanged** by this
slice — this app and the shell screens coexist. The shell screens
flip to a redirect in a later release.

## Build

```sh
cd client && node scripts/build-apps.mjs
```

Output: `apps/capture-event/dist/bundle.js` — a single ESM module
externalling react, react/jsx-runtime, react-dom, react-router-dom
and `@der/app-sdk`.

## Install

From **Admin UI → Settings → App catalogue → Install app**:

- App key: `capture-event`
- Display name: `Event capture`
- Module: `Data`
- Version: `0.1.0-alpha.1`
- Requires DER API: `1.0.0`
- File: `apps/capture-event/dist/bundle.js`

## UI (slice 4)

- Pick a program (UID), optional stage UID.
- Inline list of the 20 most recent events for the bound OU +
  program via `useDerApi().listEvents()`.
- Single-data-element event submission via
  `useDerApi().submitEvent()` which POSTs to `/api/events`.
- Online StatusPill reflects `useOnlineStatus()`.

Follow-up slices migrate the full EventNew shape (program-rule
evaluation, stage-level form, attachments, enrollment linkage).
