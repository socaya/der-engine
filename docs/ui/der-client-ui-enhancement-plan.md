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

## Phase C-UI-5 — DER-managed apps (post C-UI-4)

**Added 2026-11-06 per maintainer direction:** Apps like Data
Entry, Capture (for Events and Tracker programs), and future
operator-specific apps are not baked into the client bundle. They
live on the DER server — installed, versioned and refreshed
server-side, and surfaced in the device client's shell.

### Scope

- **Server-managed app catalogue.** Every installable app is a
  row in a new `der.installed_app` table (or reused `custom_app`
  if ADR-0005 already covers it) with:
  - `app_id`, `display_name`, `module` (one of the six Server
    Modules), `icon_url`, `entry_url` (JS / HTML served by DER),
    `version`, `installed_at`, `installed_by`, `active`.
- **Installation lifecycle on the server.** Admin-ui gets an
  "Apps" screen that uploads / enables / disables / upgrades
  apps. The client never installs or upgrades anything — it
  reads the catalogue read-only at runtime.
- **Client reads the catalogue at launcher open.** The app-
  launcher overlay (C-UI-2) grows a second grid of **"Apps"**
  underneath the six Server-Module cards. Each app card = one
  installed_app row.
- **App surface fits the shell.** When the operator opens an app
  the client mounts the app's entry URL inside the shell's main
  content slot — via an iframe sandbox, with the DerTopbar and
  DerBreadcrumb kept visible. A small `postMessage` bridge lets
  apps:
  - read the bound OU, the signed-in user, the online state,
  - request writes through DER's own `/api/*` / `/edge-api/v1/*`
    endpoints (CSP tightened so iframe can only POST to the DER
    origin — never direct to DHIS2).
- **Version + refresh from the server.** The catalogue row's
  `version` field feeds the client's cache-bust: when the admin
  pushes a new version, the next overlay open invalidates the
  cached iframe URL. Clients don't need a reload cycle.

### Endpoints needed (new or confirm existing)

| Method | Path | Notes |
|---|---|---|
| GET | `/edge-api/v1/apps` | Returns `{apps: [{appId, displayName, module, iconUrl, entryUrl, version, active}]}`. Op-readable. |
| POST | `/edge-api/v1/admin/apps/install` | Admin uploads a zipped app bundle. Writes to `installed_app`. |
| POST | `/edge-api/v1/admin/apps/:id/enable` | Flips `active`. |
| POST | `/edge-api/v1/admin/apps/:id/disable` | Flips `active`. |
| POST | `/edge-api/v1/admin/apps/:id/upgrade` | Supersedes the row with a new `version`. |

ADR-0005 (custom app hosting) already covers part of this — confirm
the existing endpoints before adding new ones. Prior EA audit
listed `/edge-api/v1/apps` + `/edge-api/v1/admin/apps/*` as
Administration surfaces already in admin-ui at `/apps`.

### Client components

- Extend `modules.ts` to export an `AppCatalogueCard` interface
  separate from `ModuleCard`.
- `DerAppLauncher.tsx` (shipped in C-UI-2) grows a second grid
  section beneath the modules — queried from
  `GET /edge-api/v1/apps` via a new `useInstalledApps()` hook.
- `AppHost.tsx` — new screen at `/apps/:appId`. Mounts the app's
  `entryUrl` in a sandboxed `<iframe>`; sets up the postMessage
  bridge; applies the shell card around the iframe so the
  operator always sees the topbar + breadcrumb.

### Security

- `iframe sandbox="allow-scripts allow-same-origin allow-forms"`.
- Content-Security-Policy on the shell: `frame-src 'self'`
  only — apps cannot load cross-origin iframes. Enforced on the
  server side via the response header.
- postMessage bridge validates `event.origin === window.location.origin`
  and enumerates its own small verb list (read-bound-ou, read-user,
  write-aggregate, write-event). No open eval, no full fetch proxy.

### Non-goals

- No DHIS2 Core app loading. If an operator wants Capture / Data
  Entry, that app is packaged separately and installed on DER.
  The DHIS2 origin is never iframed.
- No app-level org-unit override — every app inherits the edge's
  bound OU via the postMessage bridge.
- No multi-version A/B install. One active version per app.

### Phased delivery

- **C-UI-5a** — read-only app catalogue + iframe host (`/apps/:id`).
- **C-UI-5b** — admin-ui upload + enable/disable flow (relies on
  ADR-0005's existing endpoints where they exist).
- **C-UI-5c** — version refresh + offline cache (apps served from
  the PWA cache too).

### Risks

| Risk | Mitigation |
|---|---|
| Legacy DHIS2 apps use `@dhis2/ui` chrome and break inside our shell | Document the DER App SDK: a single-page entry mounts at `#root`, declares its chrome preference via a meta tag; we strip HeaderBar automatically by injecting a CSS override. |
| iframe host costs performance | Lazy-mount on user click; keep the iframe alive during navigation inside the app, dispose on route change out. |
| postMessage bridge turns into a mini-RPC that duplicates edgeApi | Keep the verb list minimal. Apps prefer to call DER's `/api` / `/edge-api` directly — the bridge only exists for cross-document identity reads. |

---

## Next action

Maintainer approval of this plan → open Phase C-UI-1 as an ADR
(ADR-0037 Device-client UI shell) and ship the shell scaffold on
a feature branch.
