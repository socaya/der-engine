# `@der/app-sdk`

The public surface every DER-dispatched app imports from.

```ts
import { useAuth, useOrgUnitBinding, useDerApi,
         ScreenCard, StatusPill } from '@der/app-sdk';
```

## How a DER-dispatched app gets built

1. `apps/<your-app>/` is a stand-alone Vite project — copy
   `apps/app-sdk/vite.config.template.ts` into it. Its `entry`
   points at the app's root component.
2. `react`, `react-dom`, `react-router-dom` and `@der/app-sdk`
   are declared as externals — the shell resolves them at runtime
   via a `<script type="importmap">` block in `client/index.html`.
3. `npm run build` produces `dist/bundle.js` — a single ESM
   module with a `default` export (a React component).
4. An admin uploads the bundle through **Admin UI → Settings →
   App catalogue** (C-UI-5a); the DER server signs it with
   Ed25519 before storing.
5. Operator devices open the launcher (C-UI-5a), the catalogue
   advertises the new version, the client runtime (C-UI-5b)
   fetches + verifies + caches the bundle in IndexedDB, then
   `AppHost` dynamic-imports its Blob URL and mounts
   `mod.default` inside the shell.

## What the SDK exposes

- `useAuth()` — signed-in user, roles, display name.
- `useOrgUnitBinding()` — the single OU this edge is bound to
  (locked per ADR-0015).
- `useOnlineStatus()` — `{ isOnline, queuedCount }`.
- `useDerApi()` — `{ submitAggregate, listDrafts, listEvents, … }`,
  offline-safe, cookie-authenticated.
- `ScreenCard`, `StatusPill` — shell-styled primitives so apps
  feel native.

The SDK ships only type declarations here; the runtime lives in
the shell (imported into every app via the import map) so every
app shares the same React instance and context providers.

## What this slice covers vs what's still open

**Shipped (C-UI-5c slice 1):**
- SDK type surface (`src/index.ts`) + typed Props.
- Vite config template for an app bundle.
- Import map stub in `client/index.html`.
- This documentation.

**Open (C-UI-5c slice 2):**
- Shell Vite config emits `react`, `react-dom`, `react-router-dom`
  and `@der/app-sdk` as `/vendor/*.js` chunks with stable names
  so the import map's hrefs resolve.
- First real migration — `apps/data-entry/` replaces
  `client/src/screens/AggregateEntry.tsx`.

**Open (C-UI-5c slice 3+):**
- `apps/capture-event/`, `apps/capture-tracker/`,
  `apps/workflow-capture/` migrations; each is its own ADR +
  commit.
