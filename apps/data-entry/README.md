# `@der/app-data-entry`

First real DER-dispatched app (C-UI-5c slice 3). Replaces
`client/src/screens/AggregateEntry.tsx` over the slice-3/4 rollout.
The shell screen is **unchanged** by this slice — this app and the
shell screen coexist. The shell screen flips to a redirect in a
later release.

## Build

```sh
cd client && node scripts/build-apps.mjs
```

Output lands at `apps/data-entry/dist/bundle.js` — a 2.7 KB ESM
module. The bundle externals `react`, `react-dom`,
`react-router-dom`, `@der/app-sdk`; each resolves to a shell-served
`/vendor/<name>.js` via the index.html importmap so the app and
shell share one React instance (hooks require this).

## Install

From the **Admin UI** → **Settings → App catalogue** → **Install
app**:

- App key: `data-entry`
- Display name: `Data Entry`
- Module: `Data`
- Version: `0.1.0-alpha.1`
- Requires DER API: `1.0.0`
- File: `apps/data-entry/dist/bundle.js`

The DER server signs the bundle (Ed25519) on upload, catalogues it,
and advertises it on `GET /edge-api/v1/apps`. Device clients fetch
+ verify + cache the bundle on next launcher open.

## UI (slice 3)

Minimal end-to-end path:

- Signed-in operator + bound OU displayed in the header.
- Four inputs: dataset UID, period, data-element UID, value.
- Submit button calls `useDerApi().submitAggregate({…})`.
- Success / error strip under the heading.
- Online status pill reflects `useOnlineStatus()`.

Future slices migrate the full AggregateEntry shape (dataset
browse, period picker with calendar, locking, draft save /
prefill).
