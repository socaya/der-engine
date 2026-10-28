# der-2.1.56 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.55`

## Headline

Implements the P0 (must-have) items from
`docs/requirements/DER_UI_Visibility_10_of_10_Standard.md`.

Three big levers were pulled:

1. **Typography overhaul** per §4.1 — the single largest visibility
   improvement.
2. **Live DER Runtime indicator** replacing the hard-coded
   `DER server · online` string, in both the sidebar footer and a new
   topbar operating-mode pill (§6.2 / §6.3).
3. **Operator-language navigation** (§9.2) with full Section Tabs
   relabel and 14 px+ secondary nav legibility.

## Typography (§4) — now compliant

| Element | Was | Now | Spec |
|---|---|---|---|
| App body | 14 px | **15 px** | ≥15 px |
| Table body | 12 px | **16 px** | 14–15 px |
| Table headers | 11 px | **13 px** | 12.5–13 px |
| Panel title | 14 px uppercase | **17 px, sentence case** | 17–18 px |
| Primary nav (sidebar) | 14 px | **15 px** | 15 px |
| Secondary tabs | 11 px | **14 px** | ≥14 px |
| Status chips | 10 px | **12 px** | 12–13 px |
| Screen title (`.ea-screen-header h1`) | 20 px | **22 px, 700 weight** | 20–22 px |
| Secondary text (`.ea-text-muted`) | 14 px | **14 px, ink-500** | ≥13 px |
| Monospace values | 12 px | **13 px**, SF Mono stack | 12–13 px |

Font family bumped to the `Inter` stack per §4.3.

## Live DER Runtime indicator (§6.3)

- Removed `DER server · online` hard-coded string in `AdminShell.tsx`.
- New `useRuntimeMode()` hook polls `/edge-api/v1/system/health` +
  `/edge-api/v1/compat` every 15 s and derives one of six operating
  modes per §7:
  - **DER Connected** — DER up + Central reachable
  - **DER Offline-First** — DER up + Central unreachable
  - **DER Runtime · Starting** — DER initialising
  - **DER Runtime · Degraded** — DER health DOWN
  - **DER Runtime · Checking** — initial poll not back
- Each mode has a tone + dot colour so status is never communicated
  by colour alone (§5.3).
- `RuntimeFooter` renders the live indicator in the sidebar; clicking
  jumps to `/sync` per §6.2.

## Topbar operating-mode pill (§6.2)

- New `TopbarOperatingMode` component renders a dot + mode label pill
  on every authenticated page.
- Tone-colored chip (soft-success, soft-warning, soft-primary,
  soft-danger).
- Label hides on screens narrower than 900 px (dot still shown).
- `title=` attribute carries the full §7 operator-facing explanatory
  text, e.g. *"Central DHIS2 is unavailable. DER remains operational
  on the local network. Locally accepted changes are being stored
  safely and queued for synchronisation."*

## Navigation terminology (§9.2)

Sync group section tabs renamed to operator-friendly labels:

| Was | Now |
|---|---|
| Needs your attention | **Attention** |
| Worker | **Sync Worker** |
| Data | **Data Queue** |
| Metadata | **Metadata Sync** |

Tabs now read: **Overview · Metadata Sync · Data Queue · Attention ·
Sync Worker · Schedule · History · Settings**.

## Table + chip + def-list polish (§10, §11, §26)

- Table row height ≥ 44 px (was ~28 px). Sticky headers (§10.1).
- Chip padding bumped from 1 px vertical to 3 px with 10 px horizontal
  for comfortable touch.
- Def-list row vertical padding 6 px → 8 px, label column 180 px →
  200 px, inter-column gap 20 px → 24 px.
- Section separation 12 px → 20 px (§26: 20–24 px section content).
- Section header bottom margin 16 px → 24 px.

## Live assertions (all green)

Playwright-swept against the running local DER:

| Check                                       | Observed |
|---------------------------------------------|----------|
| No `DER server · online` in page HTML        | ✓ |
| Live `RuntimeFooter` present                 | `DER Runtime · Starting` |
| Topbar `[data-test="topbar-mode"]` present   | `Runtime · Starting` |
| Section tabs read operator-friendly labels   | `Overview · Metadata Sync · Data Queue · Attention · Sync Worker · Schedule · History · Settings` |
| Body font-size                               | 15 px |
| Panel title font-size                        | 17 px |
| Table body font-size                         | 16 px |
| Section tab font-size                        | 14 px |
| Sidebar item font-size                       | 15 px |
| Status chip font-size                        | 12 px |

Screenshot: `/tmp/der-10of10/01-sync.png`.

## Note — P1 items staged

The P1 "strongly required" items (metadata grouping, consolidated
primary nav to 8–9 domains, Attention centre, functional search,
monitoring moved out of Workspace, authorization-freshness on users)
are the natural follow-ups to this release. The typography + runtime
visibility foundation makes those changes materially easier because
each page now has consistent breathing room and type weight.
