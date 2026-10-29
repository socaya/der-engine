# der-2.2.4 (stable)

**Date:** 2026-10-29
**Previous stable:** `der-2.2.3`

## Headline

**§8 UI maturity — fully implemented.** Four pieces land together:

1. **Multi-edge fleet view** at `/fleet` with roster + per-peer
   24-hour uptime
2. **Operator onboarding tour** — 5-step modal shown on first
   login, dismissed state persisted per-user
3. **Accessibility pass** — skip-link, global focus-visible outline,
   ARIA landmarks on nav + main, reduced-motion safety
4. **Offline-first service worker** — SPA shell cached, selected
   API GETs served stale-while-revalidate

## 1. Schema (V040)

```
der.edge_fleet_entry   — this edge's view of every edge in the fleet
                          (role: self | peer, display_name, site_id,
                           first_seen_at, last_seen_at, version, tags)
der.user_preference    — per-operator KV (tour.dismissed, theme, etc)
```

## 2. Fleet view

`FleetService.refreshRoster()` runs every 5 min — upserts self +
each peer into `edge_fleet_entry`. Peer-health view joins
`network_peer` with the latest `peer_health_sample` so operators
see 24-h uptime without a central aggregator.

### Endpoints

```
GET /edge-api/v1/fleet
→ {
    summary: { edgeCount, peerCount, peersUp24h,
               latestHealthProbeAt, self: { edgeId } },
    edges:   [{ edgeId, displayName, siteId, role,
                 firstSeenAt, lastSeenAt, announcedVersion, tags }],
    peers:   [{ peerId, nodeId, endpoint, state, trust,
                 lastOutcome, lastLatencyMs, remoteVersion,
                 samples24h, up24h, uptime24h }]
  }

GET /edge-api/v1/fleet/summary
```

### UI — `/fleet` page

Two panels:

- **Fleet roster · N** — role chip (SELF info / PEER muted), display
  name, site, version, first/last seen.
- **Peer health · N** — trust chip, last outcome chip (UP success /
  DEGRADED warn / DOWN danger), latency ms, remote version, 24-h
  uptime %.

Sub-nav tab added to the **Network** group between Mesh topology and
Security.

### Verified

```
summary.edgeCount: 2  (self + 1 peer edge)
summary.peerCount: 2  (2 network_peer rows)
self.edgeId:       66:7C:69:12:31:D7:…
roster rows:       2  (self + peer)
peer-health rows:  2  (with uptime calc from samples24h/up24h)
```

## 3. Onboarding tour

`OnboardingTour.tsx` reads `GET /user-prefs`; if `tour.dismissed`
isn't `"true"` the modal mounts:

```
Step 1: Welcome to DER
Step 2: Overview — the always-on health dashboard
Step 3: Network — AP, devices, mesh, messaging
Step 4: Backup + Security — audit, compliance, backup/restore
Step 5: You're all set
```

Each step has a `<Link>` deep-linking into the relevant page. The
modal lives in `AdminShell` so it overlays whichever page the
operator lands on first. **Skip tour** and **Get started** both call
`POST /user-prefs/tour.dismissed` with `value: "true"` — the modal
never shows again for that user.

### Accessibility

- `role="dialog" aria-modal="true" aria-labelledby="onboarding-title"`
- Progress-bar segments carry `aria-hidden="true"` (visual only)
- Skip button `aria-label="Skip the onboarding tour"`

### Verified

```
Fresh login (user_pref row absent)  → tour modal visible ✓
Click "Skip tour" / "Get started"  → pref written, modal hidden
Next login                           → pref read, modal not mounted
Delete pref via API                  → modal re-mounts on next load ✓
```

## 4. Accessibility pass

### `styles.css` additions (top of file)

```css
.ea-skip-link{
  position: absolute; left: -9999px; top: -9999px;
  background: var(--der-primary); color: #fff;
  padding: 10px 14px; border-radius: 4px; font-weight: 600;
  z-index: 100000;
}
.ea-skip-link:focus{ left: 12px; top: 12px; outline: 3px solid #fff; }

:focus-visible{
  outline: 2px solid var(--der-primary-ink);
  outline-offset: 2px;
  border-radius: 3px;
}

.ea-sr-only{ position:absolute; width:1px; height:1px; …; clip:rect(0,0,0,0); }

@media (prefers-reduced-motion: reduce){
  *, *::before, *::after{
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### AdminShell changes

```tsx
<a href="#ea-main" className="ea-skip-link">Skip to main content</a>
<aside className="ea-sidebar" aria-label="Primary navigation">
<main id="ea-main" tabIndex={-1}>
```

### Verified

```
Tab from fresh page load → focus lands on "Skip to main content"
Focus-visible outline on all buttons / links on tab
Prefers-reduced-motion: honored (0.01 ms animations)
```

## 5. Offline-first service worker

### `admin-ui/public/sw.js`

- **Install** — caches `/admin/` + `/admin/index.html`.
- **Activate** — evicts caches whose key doesn't start with the
  current `SW_VERSION`.
- **Fetch strategy**:
  - Shell (`/admin/**`): **cache-first**; falls back to `/admin/`
    when offline so SPA routing still works.
  - Whitelisted JSON GETs (`/system/health`, `/network/status`,
    `/network/access-point`, `/network/interfaces`, `/network/events`,
    `/activity/recent`, `/fleet/summary`): **stale-while-revalidate**.
  - `POST`/`PUT`/`DELETE`: always network.
  - SSE (`accept: text/event-stream`): always network.

### Registration

```tsx
// main.tsx
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' });
  });
}
```

Dev HMR skipped by the `PROD` guard; the service worker only
registers in built bundles.

### Verified

```
GET /admin/sw.js → 200, 3142 bytes
Content includes SW_VERSION constant + fetch handler + SWR helper
```

## 6. Files changed

```
database/migrations/V040__phase_prod_ui_maturity.sql                      (new)
server/src/main/java/ug/ac/mak/der/fleet/FleetService.java                 (new)
server/src/main/java/ug/ac/mak/der/fleet/UserPreferenceService.java        (new)
server/src/main/java/ug/ac/mak/der/web/FleetController.java                (new)
server/src/main/java/ug/ac/mak/der/security/SecurityConfig.java            — permit /fleet/** + /user-prefs/**
admin-ui/public/sw.js                                                       (new)
admin-ui/src/main.tsx                                                       — register sw.js (prod only)
admin-ui/src/screens/Fleet.tsx                                              (new)
admin-ui/src/screens/OnboardingTour.tsx                                     (new)
admin-ui/src/components/AdminShell.tsx                                      — skip-link + aria landmarks + OnboardingTour mount
admin-ui/src/styles.css                                                     — skip-link + focus-visible + reduced-motion + sr-only
admin-ui/src/App.tsx                                                        — /fleet route
admin-ui/src/app/navigation.ts                                              — Fleet sub-tab under Network
```

## 7. Next step in the sequential march

- **2.2.5** — §9 Testing (chaos, load, soak, golden)
- **2.2.6** — §10 Packaging (.deb, OCI, HW kits, docs site)

## Build + test

```
tsc -b && vite build                 ✓ 1759 modules
./mvnw -q -DskipTests clean package  ✓ 2.2.4 JAR + V040 applied
E2E Playwright sweep                 ✓ 0 pageerrors
  a11y: first-tab focus lands on ea-skip-link ✓
  Fleet endpoint:        edgeCount=2, peerCount=2, self fingerprint present ✓
  User prefs:            KV write + read round-trip ✓
  Onboarding tour:       visible on fresh login, hidden after dismiss ✓
  Service worker:        3.1 KB served at /admin/sw.js ✓
```
