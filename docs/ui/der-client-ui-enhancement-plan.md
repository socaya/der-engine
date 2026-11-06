# DER Client UI enhancement plan

> **Status:** Planning. No ADRs are accepted here. Each slice below
> becomes a real ADR + implementation plan when the maintainer
> approves its scope.
>
> **Dated:** 2026-11-06, against gate-PASS commit `a38dacd`.
>
> **Baseline:** device client at `/Users/stephocay/projects/msdcse-project/der/client`.
> Current UI is a plain React + React Router 6 + `@dhis2/ui` SPA
> that was deliberately stripped of DHIS2's `HeaderBar` (commit
> `c9505bb`) because `HeaderBar` fetches app-shell endpoints DER
> does not serve. The surface we build next keeps that constraint
> — **no runtime dependency on DHIS2 app-shell endpoints** — while
> mirroring the DHIS2 look-and-feel operators expect.

## Why

1. Operators who use DHIS2 Capture / Data Entry expect a familiar
   topbar + app launcher + sidebar. The current client ships a
   plain branded header + a flat launcher grid.
2. DER is a DHIS2-adjacent product. "Looks like DHIS2, feels like
   DHIS2, but is bound to one edge and one organisation unit" is
   the pilot's acceptance story.
3. Capture flows are production-ready (ADR-0036 D-CAP-3 envelope,
   per-workflow approval, auto-save, offline queue, PWA install).
   The polish gap is in the frame around them: sign-in, topbar,
   app launcher overlay, breadcrumb, screen chrome.

## Design principles

1. **No direct DHIS2 dependency.** All reads + writes go through
   DER at `/api/*` + `/edge-api/v1/*`. We do not call the live
   DHIS2 instance at `localhost:8080/dhis` — that is DER's job.
2. **DHIS2-alike, not DHIS2-clone.** Match the DHIS2 Pro UI's
   information density, colour vocabulary, typography and
   topbar + app-launcher pattern. Inputs stay `@dhis2/ui` where
   they already work well (InputField, SingleSelectField,
   DataTable, NoticeBox, CircularLoader); shell chrome is
   hand-rolled so it can talk to DER-native endpoints.
3. **Bound to one OU.** The current org-unit tree is deliberately
   absent — the edge is scoped to one OU (ADR-0015). The topbar
   shows the bound OU as a locked badge, not a picker.
4. **Offline-first.** Every screen must render from the IndexedDB
   cache + PWA shell when the edge is unreachable (sign-in reads
   `navigator.credentials` from a locally cached session; recent
   captures render from `aggregate_data_value` + capture-run
   state the client already prefetches).
5. **One source of truth per state.** Server modules → nav
   groups → tiles (per `docs/ui/EA-01-18-alignment.md`). No new
   nav axis is introduced.

## What we adopt from DHIS2 Pro UI

Audited against the live `localhost:8080/dhis` instance:

- **Topbar** — ~48 px tall, dark navy (`#1C2838` family), left
  brand lockup, centre app title, right-hand icon strip for app
  launcher / notifications / profile menu.
- **App launcher overlay** — 4- or 5-col grid of tiles with an
  icon + title under the launcher icon. Dismisses on outside
  click + Esc.
- **Breadcrumb strip** under the topbar — tiny, muted, clickable
  up-the-hierarchy navigation.
- **Content card** — white rectangle with 1 px grey border + no
  shadow (flat), 24 px padding.
- **Typography** — system font stack, 14 px base, 12 px for muted
  meta.
- **Input density** — `@dhis2/ui`'s compact `dataTest` variants.
- **Colour vocabulary** — `#2c6693` DER header blue, `#1C2838` topbar
  dark, `#F3F5F7` canvas, `#E0E4EB` border grey, status pills in
  green / amber / red / grey.

## What we don't adopt

- **OU tree + search dialog** — DER is single-OU per edge.
- **Super-user "Apps" management** — apps on DER are a fixed set,
  not installable at runtime (ADR-0005 installed-app list is in
  admin-ui, not the device client).
- **DHIS2 top-right notifications bell** — DER surfaces drafts +
  queued-offline + sync-attention via module-status screens.
  No separate inbox needed on the device client.

## Target IA

Current Launcher already groups by the six Server Modules
(DHIS2, Synchronisation, Network, Workflows, Data, Administration).
The enhancement keeps that nav backbone but reshapes the entry
point from a scrolling grid to a DHIS2-style topbar + app-launcher
overlay.

```
┌──────────────────────────────────────────────────────────┐
│ ▣  DER Edge Runtime     [bound: Facility A OU-A]   🔲 👤 │ ← topbar
├──────────────────────────────────────────────────────────┤
│ Home / Workflows / Capture runs                          │ ← breadcrumb
├──────────────────────────────────────────────────────────┤
│                                                          │
│   <active screen content card>                           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Clicking 🔲 (app-launcher icon) opens a dismissable overlay:

```
┌─────────────────────────────┐
│  DHIS2       Synchronisation│
│   ⌘           ↻             │
│  Central      Jobs + Worker │
│                             │
│  Network     Workflows      │
│   ⤷           ⟳             │
│  Status       Capture runs  │
│                             │
│  Data        Administration │
│   ⌘           ⚙             │
│  Aggregate    Session       │
│  + Programs   + Recent      │
└─────────────────────────────┘
```

The six modules' tiles live in the overlay. Launcher's current
full-page screen collapses to a lightweight "Home" (bound-OU
summary, recent activity, quick links).

## Component inventory

### 1. `DerShell.tsx` (new)
- Hosts `<DerTopbar />`, `<DerBreadcrumb />`, main content slot,
  and the `<DerAppLauncher />` overlay portal.
- Replaces the current `App.tsx`'s inline header + main.

### 2. `DerTopbar.tsx` (replaces `DerHeader.tsx`)
- Layout: brand | OU badge | spacer | app-launcher button | user menu.
- Brand lockup: DER monogram SVG + "DER Edge Runtime" text.
- OU badge: `{orgUnitDisplayName} · {orgUnitId}` with a muted
  "Not bound" state (current behaviour kept).
- App launcher button: `▦` icon. Opens the overlay.
- User menu: display name + dropdown with Session, Recent work,
  Sign out.

### 3. `DerAppLauncher.tsx` (new)
- Portal-rendered overlay (position fixed, backdrop blur).
- Grid of module cards; each card is a Link to the module's
  canonical route.
- Keyboard-navigable (arrow keys + Enter).
- Dismisses on outside click + Esc.
- Driven by a declarative `MODULES` registry — one source of
  truth, shared with the Home screen.

### 4. `DerBreadcrumb.tsx` (new)
- Reads the active route from `useLocation` + a per-screen
  `useBreadcrumb(['Workflows', 'Capture runs'])` hook.
- Renders as `Home › Workflows › Capture runs`.
- Tiny, muted, clickable up-the-hierarchy.

### 5. `DerHome.tsx` (replaces current `Launcher.tsx`)
- At `/` — opens by default after sign-in.
- Three sections:
  - **Bound to** card: OU name + id + path + last-refreshed
    timestamp from `useOrgUnitBinding`.
  - **Pending** card: queued-offline count, drafts count,
    attention-queue count. Each is a Link to the relevant screen.
  - **Recent work** list (reuse `RecentWork.tsx` component).

### 6. `SignIn.tsx` (redesign)
- Split-screen layout: left 40 % branded panel with DER monogram +
  header blue background + marketing tagline; right 60 % white
  sign-in card with username + password + Sign in button.
- Mobile: single column, brand above card.
- Styling matches DHIS2 2.44 sign-in's visual weight (same colour
  blocks, same card border, same button padding), DER brand swap.

### 7. `UserMenu.tsx` (new)
- Dropdown rendered by DerTopbar's user tile.
- Items: display name header, Session details (`/session`),
  Recent work (`/recent`), Sign out (via `useAuth().signOut`).

### 8. CSS tokens — new `src/styles/tokens.css`
- `--der-brand-500: #2c6693;` (header blue)
- `--der-ink-900: #1C2838;` (topbar dark)
- `--der-canvas: #F3F5F7;`
- `--der-surface: #ffffff;`
- `--der-border: #E0E4EB;`
- `--der-text-primary: #1C2838;`
- `--der-text-muted: #5A6A85;`
- `--der-success: #1a8754;`
- `--der-warning: #B9860A;`
- `--der-danger: #A33;`
- `--der-radius-sm: 4px;`
- `--der-radius-md: 8px;`
- `--der-shadow-pop: 0 4px 16px rgba(0,0,0,0.12);`

## Modules → App-launcher cards

Pulled verbatim from the current `Launcher.tsx` MODULES array so
no server-module drift creeps in. Each card is a `<Link to="…" />`
rendered inside the overlay grid.

| Module | Icon | Primary route | Cards (secondary) |
|---|---|---|---|
| DHIS2 | 🔌 | `/dhis2/status` | — |
| Synchronisation | ↻ | `/sync/status` | — |
| Network | 📡 | `/network/status` | — |
| Workflows | ⟳ | `/capture/runs` | — |
| Data | 📋 | `/aggregate/datasets` | Programs · Scheduled · Review · Drafts (listed below the primary tile in a hover-reveal) |
| Administration | 👤 | `/session` | Recent work |

## Phases

Four small slices, each one gate-passable on its own.

### Phase C-UI-1 — Shell scaffold
- Add `DerShell.tsx`, `DerTopbar.tsx`, `DerBreadcrumb.tsx`,
  `tokens.css`.
- Replace `App.tsx`'s inline header with the shell.
- Keep the existing Launcher as `/` for one release.
- New tests: topbar renders bound OU + user, breadcrumb reads
  active route, focus management.
- **Gate target:** 360 client tests, lines ≥ 98, branches ≥ 94.

### Phase C-UI-2 — App-launcher overlay + user menu
- `DerAppLauncher.tsx` with overlay + keyboard nav.
- `UserMenu.tsx` dropdown from topbar.
- Launcher icon replaces the Home-nav tile in the current layout.
- Tests: open/close on Esc + outside click, keyboard nav, module
  tile → route navigation, user menu → signOut flow.

### Phase C-UI-3 — Home screen + sign-in redesign
- `DerHome.tsx` mounted at `/`, old flat Launcher deleted.
- `SignIn.tsx` redesigned to the split-screen brand layout.
- Tests: Home renders OU card + pending cards + recent list;
  SignIn responsive layout breakpoints.

### Phase C-UI-4 — Screen chrome polish
- Content cards: every screen's root div wraps in a `<ScreenCard>`
  with 24 px padding, 1 px border, white background, `der-radius-md`.
- Section headings: 14 px uppercase muted + 1 px underline rule.
- Status pills: unified colour set (success / warning / danger /
  neutral / info).
- Dark-mode scaffold (CSS vars swap under `prefers-color-scheme: dark`)
  — deferred unless the pilot needs it.

## Scope boundaries (non-goals)

- **No DHIS2 instance connectivity.** Operators do not reach
  `localhost:8080/dhis` from this surface; the whole UI talks to
  DER.
- **No multi-OU picker.** One edge, one OU, locked by ADR-0015.
- **No notifications bell / inbox.** Server-Module status screens
  surface attention state; no separate inbox view.
- **No installable third-party apps.** The app-launcher grid is
  hard-coded to the six Server Modules.
- **No theme editor.** The operator cannot swap brand colours at
  runtime; branding lives in `tokens.css`.
- **No RTL support** — add when a pilot requires it.

## Acceptance criteria per slice

Every phase's PR must:

1. Keep every screen navigable via the keyboard. No mouse-only
   paths.
2. Preserve the existing `data-test` attributes so Playwright +
   Vitest don't drift.
3. Ship accessible markup: proper roles on overlay + dropdown,
   `aria-current="page"` on the active breadcrumb, `aria-label`
   on icon-only buttons.
4. Pass axe-core zero violations on the touched screens
   (Playwright run under `DER_RUN_E2E=mandatory`).
5. Stay above the current gate thresholds (99 line / 94 branch /
   94 function / 99 statement). No new global waivers.
6. Not regress any existing component or test. New styles go into
   `tokens.css` + per-component CSS; no inline hacks unless the
   inline is the simplest expression (e.g. a one-off style on a
   savebar).

## Risks

| Risk | Mitigation |
|---|---|
| Portal + focus-trap on the app-launcher overlay is finicky to test. | Pull in `@testing-library/user-event`'s `keyboard` API; cover Escape + Tab-cycle in explicit tests. |
| CSS tokens conflict with `@dhis2/ui`'s own design tokens. | Prefix every new token with `--der-`; `@dhis2/ui` tokens (`--dhis2-*` / Sass-compiled) live in a separate namespace. |
| New shell adds measurable paint latency. | Shell is < 2 KB CSS + a single React portal; HMR dev build will catch regressions early. |
| Screen-level migration (Phase C-UI-4) touches every component. | Split into per-module PRs so one bad merge can't block the pilot. |

## Verification per slice

Same approach as every prior commit this session:

1. `cd client && npx tsc --noEmit` — type clean.
2. `cd client && npm run lint` — ESLint clean.
3. `cd client && npm test -- --coverage --run` — above thresholds.
4. `cd client && npm run build` — production bundle under 650 KB
   gzipped (current: 173 KB; headroom is wide).
5. `bash scripts/run_all_checks.sh` — gate PASS.
6. Live walk-through at `http://localhost:5174/` after `npm run
   preview` (the SW + install prompt are only live on prod builds).

## File + folder layout after Phase C-UI-3

```
client/src/
├── shell/
│   ├── DerShell.tsx
│   ├── DerTopbar.tsx
│   ├── DerBreadcrumb.tsx
│   ├── DerAppLauncher.tsx
│   ├── UserMenu.tsx
│   ├── modules.ts         // single MODULES source of truth
│   └── useBreadcrumb.ts
├── styles/
│   ├── tokens.css
│   ├── shell.css
│   ├── sign-in.css
│   └── home.css
├── screens/
│   ├── DerHome.tsx        // replaces Launcher.tsx
│   ├── SignIn.tsx         // redesigned
│   └── <existing screens unchanged apart from a ScreenCard wrap>
```

## Phase C-UI-5 — Apps run **in** the client, dispatched **from** DER

**Revised 2026-11-06 per maintainer direction.** Apps like Data
Entry (Aggregate), Capture (Events), Capture (Tracker Programs),
and future operator-specific apps:

- are **not** baked into the client bundle at build time,
- are **not** executed on the DER server (no iframe host),
- **run inside the client** as real React components sharing the
  shell's context (auth, bound OU, offline queue, PWA cache),
- are **installed, versioned and broadcast from DER** — operator
  devices fetch a signed bundle, cache it in IndexedDB + the PWA
  cache, ESM-import it, and mount it into the shell's main slot.

Model shorthand: **DER dispatches, the client runs.** Same model
on Web (PWA) and Android (Capacitor wrap of the PWA). No iframes.
No postMessage bridge.

### How the dispatch works

1. **Catalogue read.** On launcher open the client calls
   `GET /edge-api/v1/apps`. Response:
   ```json
   {"apps":[{"appId":"data-entry","displayName":"Data Entry",
             "module":"Data","version":"1.4.0",
             "bundleUrl":"/edge-api/v1/apps/data-entry/1.4.0/bundle.js",
             "bundleSha256":"…","signature":"…",
             "requiresDerApi":"1.0.0","active":true}, …]}
   ```
2. **Fetch + verify.** For each active app the client checks its
   IndexedDB `installed_apps` store for a cached bundle at the
   catalogue's `version`. If absent, `fetch(bundleUrl)` + verify
   `sha256` + verify Ed25519 signature against DER's public key
   (served once at `/edge-api/v1/apps/signing-key`), then store
   the bundle text in IDB. Capped at `N` apps / `M` MB.
3. **Mount.** `AppHost.tsx` at `/apps/:appId` does:
   ```ts
   const blob = new Blob([bundleText], { type: 'application/javascript' });
   const url = URL.createObjectURL(blob);
   const mod = await import(/* @vite-ignore */ url);
   // mod.default is the app's root React component.
   ```
   The component renders inside the shell's content card. It
   calls DER edgeApi directly via a `useDerApi()` hook the SDK
   exposes — no RPC bridge, no sandbox marshaling.
4. **Version refresh.** On every launcher open + on reconnect,
   the catalogue is re-fetched. A newer `version` triggers a
   download + cache-swap on next navigation into the app.
   Offline clients keep running the last cached version until
   they reconnect.
5. **Broadcast.** Admin pushes an app upgrade on
   `POST /edge-api/v1/admin/apps/:id/upgrade`. DER updates the
   catalogue row; next client poll sees the new version.

### Why ESM dynamic import, not iframe

| Property | ESM dynamic import | iframe |
|---|---|---|
| Shares `AuthContext`, `useOrgUnitBinding`, offline queue | ✅ direct hook access | ❌ via postMessage RPC |
| Runs in client's React tree | ✅ real components | ❌ separate document |
| Debug + stack traces | ✅ one tree | ❌ cross-boundary |
| Offline cache | ✅ IDB bundle + PWA | ⚠ needs a bespoke SW path |
| Android (Capacitor) | ✅ same code | ⚠ WebView iframe quirks |
| Isolation of untrusted code | ❌ (we don't need it — first party) | ✅ (but we don't need this) |

### Scope

- **Server catalogue table.** `der.installed_app`:
  - `app_id` (UUID / slug), `display_name`, `module`, `icon_svg`,
    `active`, `created_at`, `created_by`.
  - `der.installed_app_version` child: `version`, `bundle_bytes`
    (large blob) OR `bundle_path` (file on disk),
    `bundle_sha256`, `signature`, `requires_der_api`,
    `uploaded_at`, `superseded_at`.
  - One current version per `app_id` (`superseded_at IS NULL`).
- **Signing.** DER holds an Ed25519 key pair. Public key served
  at `/edge-api/v1/apps/signing-key`; private key stays in
  `SecretEnvelope` sealed with `DER_SECURITY_SECRET_KEY`.
  Admin's upload tool signs the bundle before upload; the server
  re-verifies the signature on write + rejects on mismatch.
- **Endpoints.** Read:
  - `GET /edge-api/v1/apps` — catalogue (op).
  - `GET /edge-api/v1/apps/:id/:version/bundle.js` — the bundle (op).
  - `GET /edge-api/v1/apps/signing-key` — Ed25519 public key (op).
  Admin:
  - `POST /edge-api/v1/admin/apps/install` — upload new app (admin).
  - `POST /edge-api/v1/admin/apps/:id/upgrade` — new version (admin).
  - `POST /edge-api/v1/admin/apps/:id/enable|disable` (admin).
  - `DELETE /edge-api/v1/admin/apps/:id` (admin).
- **Client runtime.**
  - `src/apps/catalogue.ts` — `useAppCatalogue()` hook; polls
    `/edge-api/v1/apps` with cache-first semantics.
  - `src/apps/installer.ts` — `ensureInstalled(app)`: idempotent
    fetch + verify + IDB store + optional PWA precache.
  - `src/apps/signatures.ts` — Web Crypto subtle verify against
    the server's Ed25519 public key.
  - `src/apps/AppHost.tsx` — routed at `/apps/:appId`. Resolves
    the cached bundle, `import()`s it, mounts `mod.default`.
  - `src/apps/sdk.ts` — the **DER App SDK**. Exposes:
    - `useAuth`, `useOrgUnitBinding`, `useOnlineStatus`
    - `useDerApi()` returning `{ submitAggregate, listRuns, … }`
    - `<ScreenCard>`, `<ErrorBlock>`, `<LoadingBlock>` — same
      styling as the shell so apps feel native.
    Published as a published-locally package so app devs
    `import { useDerApi, ScreenCard } from '@der/app-sdk'`.
- **App bundles are ESM.** Rollup / Vite-library builds. One
  entry. `externals`: `react`, `react-dom`, `@der/app-sdk`
  (resolved to the shell's own copies at runtime via an
  import-map on the client — Vite's `importmap` emit on build).

### First-party apps to migrate

The MVP apps already live as screens in `src/screens/`.
Migration is additive — the shell keeps the screens for a
release, then thins them to a `<Navigate to="/apps/data-entry">`
as the app bundle takes over:

| First-party app | Replaces |
|---|---|
| `data-entry` (Aggregate) | `AggregateEntry.tsx` |
| `capture-event` | `EventNew.tsx` + `EventList.tsx` |
| `capture-tracker` | `TrackerSearch.tsx` + `EnrollmentCreate.tsx` + `TrackerDashboard.tsx` |
| `workflow-capture` | `CaptureRunList.tsx` + `CaptureRunForm.tsx` |

Each app's repo lives under `apps/` in the monorepo so CI can
build + sign them into DER server fixtures at release time.

### Security

- **Signature verification is mandatory.** No bundle runs without
  a valid Ed25519 signature against DER's public key.
- **Same-origin only.** `bundleUrl` must resolve under the DER
  origin; cross-origin bundles are rejected before the Blob URL
  is created.
- **CSP** on the client: `script-src 'self' blob:` to permit the
  Blob-URL imports but block anything else.
- **No `allow-scripts allow-same-origin` sandbox.** Apps run as
  trusted first-party code. The SDK does not expose `eval`.
- **Verified `requires_der_api`.** On install, the catalogue row
  declares the minimum DER API version the app needs. Client
  skips incompatible versions with a visible "needs client
  upgrade" chip instead of crashing.

### Android (Capacitor) later

- Wrap the installed PWA in Capacitor's Android project.
- Dynamic ESM imports work the same way inside Capacitor's
  WebView (Chrome engine), so the same catalogue + installer +
  AppHost pipeline runs on Android with no code change.
- Capacitor's `@capacitor/filesystem` is a nice-to-have for
  storing the bundles on the filesystem instead of IDB, but it's
  not required for MVP.

### Non-goals

- No third-party / untrusted app hosting. Apps are first-party
  signed by DER.
- No multi-version A/B. One active version per app.
- No app-level org-unit override — every app inherits the edge's
  bound OU.
- No DHIS2 Core app loading. The DHIS2 origin is never fetched
  from the client.
- No live code reload during development — dev-mode apps are
  normal Vite dev-server entries; the dispatch pipeline only
  kicks in on production builds.

### Phased delivery

- **C-UI-5a** — server catalogue + signing-key endpoint; admin-ui
  "Apps" screen for upload/enable/disable; empty client runtime
  that lists the catalogue in the App Launcher (no bundles yet).
- **C-UI-5b** — client runtime: installer, signatures, AppHost.
  Ship one dev app (an "Hello DER" smoke app) end-to-end.
- **C-UI-5c** — migrate the four first-party apps. Each migration
  is its own ADR + commit cycle.
- **C-UI-5d** — Android (Capacitor) wrap. Separate release.

### Risks

| Risk | Mitigation |
|---|---|
| Vite can't `import()` a Blob URL reliably in every browser | iOS Safari 17+ + Chrome + Firefox all support it. Android 10+ via Capacitor runs Chrome too. If a target browser lacks support, fall back to injecting a `<script type="module">` with the Blob URL. |
| App bundles balloon the IDB storage | Keep each bundle under 500 KB gzipped (a strict budget enforced on upload). N-app cap of 16; evict oldest on exceed. |
| App + shell React versions drift | Externalise React + ReactDOM via an import map so the app always binds to the shell's instance. Type-check in CI. |
| Signing-key rotation leaves old clients orphaned | Clients store the current signing-key fingerprint; a rotated key triggers a "please sign in again to re-sync" flow that re-fetches the key before the next install. |

---

## Next action

Maintainer approval of this plan → open Phase C-UI-1 as an ADR
(ADR-0037 Device-client UI shell) and ship the shell scaffold on
a feature branch.
