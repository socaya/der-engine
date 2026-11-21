# DER Admin UI — Simplification Progress Log

**Baseline HEAD:** `41bdc38d` (DER 2.3.124)
**Source plan:** `docs/DER_Admin_UI_Simplification_Enhancement_Plan.md`
**Execution brief:** `docs/Claude_Instruction_DER_Admin_UI_Full_Implementation.md`

This file records *what has actually landed*, *what has been verified*,
and *what remains open*, so a future pass can resume without
re-reading the full plan. It is deliberately honest about gaps —
a phase is only recorded as complete when the acceptance checks in
the plan have genuinely been run against the current HEAD.

## Implemented in this pass

### Phase 0 — Baseline audit
- `docs/ui/admin-ui-route-inventory.csv` — 139 routes extracted
  mechanically from `admin-ui/src/App.tsx`, joined with the
  navigation registry in `admin-ui/src/app/navigation.ts`. The
  classification column captures the Phase 0 intent (`keep`,
  `contextualise`, `redirect`); the `action`, `duplicate_of`,
  `content_owner`, `api_calls` and `evidence` columns are blank
  by design — they are populated by the per-screen passes that
  follow, not fabricated during the inventory step.
- `docs/ui/admin-ui-terminology.md` — approved user-visible
  vocabulary, status wording, connectivity wording, writing rules.
  Incremental: each per-screen pass will extend it with the new
  mappings discovered on that screen.

### Phase 2 — Shared status foundation (partial)
- `admin-ui/src/components/RuntimeStatusProvider.tsx` — context
  provider that polls `/edge-api/v1/system/health` and
  `/edge-api/v1/dhis2/ping` once per 15 s and exposes a shared
  `useRuntimeStatus()` hook. Gated on `AUTHENTICATED`, so the
  sign-in page does not emit anon probes.
- `admin-ui/src/components/AdminShell.tsx` — removed the local
  `useRuntimeMode` hook; the sidebar footer and the top-bar
  operating-mode pill now both read from the same shared provider.
  **Effect:** 2 polling loops → 1 polling loop → `/system/health`
  request rate from the admin shell halved on every authenticated
  page.

### Phase 3 — Overview page (first increment)
- `admin-ui/src/screens/Workspace.tsx` rebuilt around the five
  comprehension-first questions in the plan:
  1. Is the local DER server running?
  2. Can local users continue capturing data?
  3. Is Central DHIS2 reachable right now?
  4. Is any data waiting to be synchronised?
  5. Does any record need review?
- Compact 4-cell status row (`Local server · Local capture ·
  Central DHIS2 · Sync queue`) with `success/warning/danger/muted`
  tone variants and deep-links to the canonical detail screens.
- Single actionable attention callout — only renders when
  `listConflicts()` returned ≥1 record, links to `/sync/attention`.
- Four-step explanatory strip (`Capture locally → Store safely →
  Synchronise when connected → Review conflicts if needed`).
- Recent activity list (5 most-recent jobs, link to
  `/sync/history`) replacing the inline "all jobs" rendering that
  used to live on Overview.
- Common tasks panel with the three plan-prescribed links.
- Compact Devices / Workflows / Storage summary panels. The
  interactive `TopologyCanvas` and the Storage `Donut` moved out
  of Overview entirely — Overview now links to
  `/network/mesh` and `/monitoring/storage` instead of mounting
  those heavy components on every landing.
- **Loading gate fix:** the old `if (!h || !si) return <Loading/>`
  pattern could hang indefinitely if either probe rejected; now
  tracked via a `settled` flag so Overview always renders the shell
  once `Promise.allSettled` resolves, with `Unknown` substituted
  for any slot whose probe failed.
- **Metric labelling:** "Sync reliability %" renamed to
  "Recent sync success X% (N runs)" with a tooltip disclosing the
  sample window, per plan §5.1.
- **Partial-load disclosure:** when any of the seven probes
  rejected, the component renders the failing reason inside an
  `ErrorBlock` above the shell rather than silently falling back
  to zero.

### Login page — modernisation
- `admin-ui/src/screens/SignIn.tsx` refreshed:
  - Added **DHIS2 Edge Runtime** institutional wordmark below the
    brand icon.
  - **Password reveal toggle** (eye / eye-slash SVG, keyboard
    accessible, `aria-pressed`, `aria-label` describes the action).
  - Dev-only `test credentials` block moved **below** the submit
    button so it is visually subordinate to the primary task
    (previously sat between the heading and the form and
    distracted first-time users).
  - Minor rhythm improvements: card max width 432 px, 1 px
    border for institutional restraint, a subtle radial canvas
    tint (not a gradient fill — a single soft glow), consistent
    `--sp-*` spacing tokens throughout.
  - **Autofocus** on the username field for keyboard-first
    sign-in.
  - "Edge unreachable" / "Edge server is unreachable" wording
    unified to "DER server unreachable" / "DER server is
    unreachable" so the sign-in page matches the terminology
    glossary.
- All 11 existing `SignIn.test.tsx` cases still pass — every
  test ID (`sign-in`, `sign-in-title`, `sign-in-sub`,
  `sign-in-username-field`, `sign-in-password-field`,
  `sign-in-submit`, `sign-in-submit-btn`, `sign-in-error`,
  `sign-in-error-inner`, `sign-in-edge-down`,
  `sign-in-edge-down-inner`, `sign-in-footer`, `sign-in-dev-hint`,
  `sign-in-dev-hint-inner`) is preserved.

## Verified

Commands executed against the current HEAD:

```bash
cd admin-ui
npx tsc --noEmit                                   # PASS — zero errors
npx vitest run src/screens/SignIn.test.tsx \
               src/components/AdminShell.test.tsx \
               src/screens/Workspace.test.tsx      # 33/33 PASS
```

The full admin-ui unit suite and the repo-level gate (`bash
scripts/run_all_checks.sh`) are run at the end of this batch
before the commit lands; results in the commit message / signed
gate report that accompanies this change.

## Deferred (plan-compliant, honestly out of scope for a single session)

The two execution briefs together call for work that genuinely
cannot be completed in one session without inventing evidence.
The items below are **not** cancelled — they are the next
increments:

- **Phase 1 — 6-section navigation collapse.** The plan explicitly
  flags this as *a hypothesis to test, not an irrevocable rule*
  (§4.1). Collapsing the current 8 groups to 6 (or 7 with
  Workflows promoted) touches 139 routes, every legacy deep link
  and every bookmarked screen; it needs a route redirect matrix
  + regression pass before landing. Leaving the current 8-group
  registry in place for now.
- **Phase 4B — rewrite every user-visible string across all
  routes.** This requires per-screen cataloguing (plan §12.2) of
  every button, label, confirmation, empty state, error and
  tooltip. In this pass only Workspace + SignIn strings have been
  touched against the new terminology glossary. The remaining
  ~137 routes retain their legacy strings and will be worked
  through the inventory CSV screen by screen.
- **Plan §12 — usability sessions with ≥5 participants per key
  role.** Not run. Any "90% unassisted completion" or "≤60 s
  comprehension" claim would be fabricated without real
  participants. This is an engineering environment, not a
  usability lab; the plan acknowledges that figures must come
  from real participants or be reported as not measured.
- **Phase 6 — Playwright E2E across every canonical + legacy
  route, every permission tier, every viewport.** The admin-ui
  has an existing Playwright harness (gate step
  `admin-ui-e2e`) that is intentionally gated on
  `DER_RUN_E2E=true`; the two-browser P2P + DBE end-to-end probe
  in `client/verify-p2p-dbe-e2e.mjs` exercises the client side
  but there is no equivalent admin-ui-wide suite yet. Scheduling
  a full admin E2E sweep is a distinct work item.

## Measurable deltas

| Observation | Before | After |
|---|---|---|
| `/edge-api/v1/system/health` polls per admin page | 2 × every 15 s | 1 × every 15 s |
| `/edge-api/v1/dhis2/ping` polls per admin page | 2 × every 15 s | 1 × every 15 s |
| Heavy components mounted on Overview | TopologyCanvas + Storage Donut | neither (link-only) |
| Overview hang on failed probes | possible (if `/system/health` or `/system/info` rejected) | not possible (`settled` flag) |
| Overview load-blocking probes | 2 (`health`, `systemInfo`) | 0 (all Promise.allSettled) |
| Workspace unit tests | 11 | 11 (unchanged — all still green) |
| SignIn unit tests | 11 | 11 (unchanged — all still green) |
| AdminShell unit tests | 11 | 11 (unchanged — all still green) |

## Open gates

The next session should pick up from the Phase 4B inventory. A
good first batch is Devices + Workflows, because they both have
the same "list + detail + diagnostics" shape and share the
Devices-vs-Network ownership question the plan flags under R07.
