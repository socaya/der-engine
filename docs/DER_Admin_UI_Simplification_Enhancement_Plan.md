# DER Server Admin UI — Comprehensive Simplification and User Experience Enhancement Plan

**Product:** DHIS2 Edge Runtime (DER) — deployable offline-first edge platform; MSc research is one validation context, not the sole audience  
**Document status:** Implementation plan and repository-informed static audit; not a live browser usability certification  
**Prepared:** 21 November 2026  
**Repository:** https://github.com/socaya/der-engine  
**Primary scope:** `admin-ui/`; backend contracts and `client/` only where integration or shared user journeys require verification  
**Repository reference inspected:** GitHub connector search results at `41bdc38d131b31edba1caad21fb32bd3bc5b08ff` (verify HEAD again before implementing)  
**Version evidence:** `admin-ui/package.json` reports `2.3.124`; verify root `VERSION` and running runtime separately.

## 1. Executive direction

**DER must be understandable, learnable and operable by real-world users with different levels of technical literacy.** Every label, action, screen, error and process should use clear, familiar technology terminology and explain what users can do next. Avoid both engineering jargon and oversimplified everyday wording that conceals technical meaning. The offline-first architecture must remain accurate without making users learn its implementation terminology. Adoption, trust, safety and reliable day-to-day operation take precedence over exposing many technical controls.

The objective is **simplify the surface without reducing the underlying capability or evidence integrity**. Use progressive disclosure: clear technology language first, detailed diagnostics available in context, advanced functions available to authorised administrators. Never replace a working function with a visual-only placeholder.

### 1.1 Goals
1. A new user can explain DER in ordinary words after viewing the Overview for one minute.
2. An administrator can find any core workflow in no more than three intentional navigation steps.
3. There is one obvious entry point and one authoritative source of truth for each operational task.
4. Remove repeated headings, duplicate metrics, overlapping status indicators, unnecessary cards and repeated primary actions.
5. Distinguish clearly between **DER running**, **local capture available**, **Central DHIS2 reachable**, **records pending**, **synchronisation outcome** and **conflict needing review**.
6. Make the entire product usable in routine health-service deployments and pilots; retain academically valid deployment and MSc demonstration scenarios as a secondary validation use case.
7. Keep responsive, accessible, role-aware, efficient and stable under offline conditions.
8. Preserve security, auditability, deep links, backend contracts, original brand identity and all verified functions.

### 1.2 Non-goals
- Do not redesign the separate end-user capture app as an admin app.
- Do not remove advanced monitoring, audit, recovery or developer diagnostics from authorised reach.
- Do not introduce a mock 'demo mode' that falsely appears to be a live integration.
- Do not change the approved DER icon, wordmark, proportions, font family or brand assets.
- Do not make arbitrary changes to the one-edge-server/organisation-unit policy; verify the current domain contract and resolve source-document differences first.
- Do not swap the frontend framework or add an oversized component library solely for cosmetic purposes.

## 2. What the repository currently indicates

### 2.1 Verified static findings

| Ref | Source | Evidence / implication |
|---|---|---|
| R01 | `admin-ui/src/app/navigation.ts` | Eight primary groups: Home, Data, Sync, DHIS2, Devices, Access, Workflows, System. Registry explicitly notes earlier reduction from 10 modules/91 items to 8/~45; actual current number must be recounted. |
| R02 | `admin-ui/src/App.tsx` | React Router has many screen-level and legacy paths; route continuity and permission checks are essential. Landing `/` renders `Workspace`. |
| R03 | `admin-ui/src/screens/Workspace.tsx` | Existing landing page combines system state, topology, devices, workflows, storage and activity; candidate for cognitive-load reduction. It says previous Overview/Dashboard duplication was already consolidated. |
| R04 | `admin-ui/src/components/AdminShell.tsx` | Global runtime status appears in both sidebar footer and top bar using separate instances of `useRuntimeMode()`, which independently poll health and central reachability. Candidate for shared state and duplication cleanup. |
| R05 | `admin-ui/src/components/AdminShell.tsx` | Global attention menu aggregates conflicts, approvals, referrals and paused worker. Preserve one canonical attention workflow and distinguish the number of returned records from authoritative totals. |
| R06 | `admin-ui/src/app/navigation.ts` | Some modules expose many secondary tabs: Data, DHIS2, Devices and System particularly require task-first grouping and contextual disclosure. |
| R07 | `admin-ui/src/app/navigation.ts` | Network peers and workflow peer sharing currently intersect the Devices and Workflows concepts; audit content ownership before merging, cross-link rather than mirror content. |
| R08 | `admin-ui/src/app/navigation.ts` | Sync has queue/worker/history while Data exposes outbound queue; these are related but different workflows—define one canonical location for each and use contextual links. |
| R09 | `admin-ui/src/app/navigation.ts` | The System area includes health, metrics, storage, hardware, diagnostics, testing, packaging, recovery and more, many contextual. Consider expert-only disclosure, not deletion. |
| R10 | `admin-ui/package.json` | React 18, React Router 6, Vite, TypeScript, Vitest, Playwright, axe integration; use existing tooling and avoid new dependencies unless necessary. |
| R11 | `docs/ui/01-design-system-and-navigation.md` | Design guidance already calls for minimal institutional styling, accessible labels, error states, responsive layouts and accurate local-vs-central statuses. |
| R12 | `docs/media/ui/DER_ADMIN_UI_NAVIGATION_IMPLEMENTATION.md` | Earlier detailed navigation specification exists but refers to an older baseline and 10 groups. New implementation must reconcile it with actual current registry; do not blindly reimplement. |
| R13 | `docs/project/admin-ui-enhancement-plan.md` | Older October audit reports 19/24 captured screens and five hanging, but the audit predates subsequent releases: findings are **historical only**, not evidence of bugs today. |
| R14 | `admin-ui/src/screens/Workspace.tsx` | Dashboard computes sync success rate over up to 100 fetched runs and labels it 'Sync reliability'; that is not necessarily an end-to-end delivery-success rate. Review terminology and sample-window disclosure. |
| R15 | `admin-ui/src/screens/Workspace.tsx` | A missing compatibility snapshot is currently treated as non-reachability in one derived variable; UI must show *unknown* rather than imply *offline* when evidence is absent. |
| R16 | `admin-ui/src/screens/Workspace.tsx` | `if (!h || !si) return <LoadingBlock />` can leave the page waiting indefinitely on failed essential calls unless a surrounding timeout/retry contract applies. Verify end-to-end before declaring a blocker. |

**Audit limitation:** this is a repository/source-level review of selected key files and existing project documentation. It is not a full live sign-in/browser inspection of every page or a verified server test run. The execution instruction below requires a route-by-route browser audit before changing the implementation. No screenshot-derived assessment or new production readiness claim is made here.

### 2.2 Evidence that earlier improvement has already occurred
- Old Overview/Dashboard consolidation is documented in `Workspace.tsx` and `docs/releases/der-2.0.9.md`.
- Navigation labels have already been simplified in parts in `navigation.ts`.
- Many routes are intentionally contextual; maintain that useful design pattern.
- Existing live Playwright and axe-oriented test files exist; inspect and extend rather than recreate them.
- The UI already has components for loading, error and empty states, status feedback and SectionTabs.

**Therefore:** do not start with a new UI framework or a complete rewrite. Start with the user journeys, content inventory, deduplication and information architecture.

## 3. Audience, roles and tasks

| Audience | Needs | Default content | Hidden behind permissions / detail |
|---|---|---|---|
| First-time site manager / nontechnical stakeholder | Understand what DER does, whether services work, and how to get help | Plain Overview, status, short explanations and next actions | Database internals, configuration, dangerous operations |
| MSc examiner / evaluator | Understand design, resilience, conflicts and measurable results | Scenario-linked views and evidence-backed outcomes | Internal diagnostics unless explicitly opened for analysis |
| Data entry operator | Know whether local work is saved and what is pending | Capture launcher or simple status, queued work | Admin configuration and server controls |
| Site administrator | Know current problems and perform core actions | Overview, Sync, Devices, DHIS2, user access | Recovery, diagnostics, policy tuning |
| Technical maintainer | Troubleshoot and secure runtime | Health, logs, networking, backups, audit | Advanced authenticated tabs and technical details |
| Research evaluator | Reproduce offline-first and conflict experiments | Evidence, run comparisons, evaluation exports | Privileged test tools; never conflate synthetic and production evidence |

**Role rule:** authentication and backend authorisation are authoritative; hiding a menu item is never security enforcement. Do not expose sensitive health, user, journal or diagnostic data to unprivileged visitors.

## 4. Proposed information architecture

### 4.1 Six primary headings

| Primary section | Purpose in simple technology language | Default screen | Contextual subareas |
|---|---|---|---|
| **Overview** | Is DER working, and what needs action? | `/` (preserve) | Technical system information, recent activity, experiment evidence |
| **Local Data** | What has been captured on this server? | `/data` (preserve) | Aggregate, Events, Tracker, Drafts, Outbound queue, Maintenance |
| **Synchronisation** | What needs to be sent or reviewed? | `/sync` (preserve) | Pending items, Conflicts, History, Worker & Schedule, Policy |
| **Devices & Network** | Which devices can work through DER? | `/devices` (preserve) | Registered devices, Access point, Connections, Peer network, Diagnostics |
| **DHIS2 Connection** | What central system is DER linked to? | `/dhis2` (preserve) | Connection, Organisation unit, Metadata, Compatibility, Advanced metadata tools |
| **Administration** | Who can administer DER and how is it maintained? | choose canonical existing role-authorised route | Users & roles, Workflows, Health, Settings, Security, Backup & Restore, Advanced tools |

**Workflows placement validation:** workflows may warrant a seventh primary group if administrator usability testing demonstrates frequent independent use. Do not bury core workflow design for users who regularly need it. This six-heading proposal is a hypothesis to test, not an irrevocable architecture rule.

**Navigation continuity:** preserve current canonical URLs where possible. Change visible labels and grouping in the single navigation registry; route aliases and deep links must continue working. Maintain correct active states/breadcrumbs for contextual detail routes.

### 4.2 Only one navigation hierarchy at a time
- Primary sidebar: six choices (or seven after testing).
- Within a section: a concise task-oriented secondary row, **normally 3–5 options**. Move the remainder into 'More' or into contextual action links.
- Contextual record detail: breadcrumb, item title, primary action and a return link.
- Advanced technical tools: expand-on-demand, role-gated, properly named.
- Never show three concurrent tab/navigation strips or a sidebar menu plus a repeated set of identical dashboard navigation cards.
- Default sidebar expanded on desktop as space permits; collapsible rail or drawer on narrow screens.

### 4.3 Canonical ownership rules

| Information/action | Canonical home | Elsewhere |
|---|---|---|
| DER service availability | Overview / Health detail | Compact global status link only |
| Central DHIS2 connectivity | DHIS2 Connection | One short connected/offline indicator on Overview |
| Local saved records | Local Data | One summary on Overview |
| Outgoing record queue | Local Data > Outbound queue (record-level) | Sync links to same queue, does not recreate records table |
| Sync run history | Synchronisation > History | Overview shows only latest outcome, links to detail |
| Conflicts needing decision | Synchronisation > Needs review | Overview shows count/action, not another full table |
| Device inventory | Devices & Network > Devices | Overview shows summary count |
| Mesh topology | Devices & Network > Network diagram | Overview uses a small explanatory graphic or link, not two full editors |
| User and permissions management | Administration > Users & access | No duplicate user table on Overview |
| Audit event history | Administration > Audit log | Security and Sync contextual links, not separate competing log viewers |
| Backups, restore and recovery | Administration > Backup & recovery | System health links; destructive actions always explicitly confirmed |
| Advanced metrics and resource usage | Administration > Health | Overview at most one relevant warning |
| Research measurements | Clearly labelled Evaluation section/view | No unlabelled mixing with operational production metrics |

## 5. Proposed Overview screen: one understandable page

### 5.1 Suggested hierarchy

**Header**: `DER Server` — `Local data collection and synchronisation`  
**Context line**: Bound organisation unit (where available), last checked, DER version in low-emphasis text.

**Status summary (one concise row):**
1. **Local server** — Running / Starting / Unavailable / Unknown.
2. **Local capture** — Available / Limited / Unavailable / Unknown, from the actual capture readiness contract.
3. **Central DHIS2** — Connected / Offline / Checking / Unknown.
4. **Sync queue** — `N records waiting`, `N need review` (only with authoritative counts, otherwise 'Count unavailable').

**What happens next (one priority area):** show the most important actionable issue, such as '3 records need review', or 'Central DHIS2 is offline. Local work can continue'. An 'All caught up' state is shown only if it is actually verified.

**How DER works (one small four-step explanation):** `Capture locally → Store safely → Synchronise when connected → Review conflicts if needed`. This is a concise explanatory model, not proof that a particular record has completed every step.

**Recent activity (one concise list):** most recent real sync outcomes, with timestamp and link to detail. Do not place all logs, every workflow, full topology, storage chart, analytics and network interfaces on the landing page.

**Quick actions (maximum three):** `View captured data`, `Check synchronisation`, `Manage devices`; display only those permitted for the current user. No duplicate row of destination cards that merely reproduces the sidebar.

### 5.2 Remove or relocate from current Workspace
- Large interactive network mesh: move full interactivity to Devices & Network; retain only a compact static explanatory indicator/link if genuinely helpful.
- Disk usage donut and detailed resource breakdown: move to Health/Storage.
- Long device and workflow previews: replace with a brief count and direct link, if they add value.
- Multiple system-component lists and repeated statuses: consolidate behind the Health detail page.
- Decorative hero SVG, oversized welcome copy, repetitive metadata and redundant status chips: reduce to a crisp page title and information-dense layout.
- Repeated visible 'version', 'updated', 'timestamp', 'reliability' values: show once each with definitions and correct sampling windows.

### 5.3 Example explanatory copy
| System condition | Recommended copy | Avoid |
|---|---|---|
| Central not reachable, local healthy | `Central DHIS2 is unavailable. Local data capture can continue; pending changes will be retried according to the sync policy.` | `All systems operational` |
| Central reachability not yet checked | `Checking Central DHIS2 connection…` | `Offline` |
| Record stored only on DER | `Saved on this device/server. Not yet confirmed by Central DHIS2.` | `Synced` |
| Item awaiting conflict resolution | `This record needs review before its changes can be completed.` | `Drift`, `Attention exception` without explanation |
| Worker paused | `Automatic synchronisation is paused.` | `Worker disabled` as the only text |
| No valid count returned | `Queue status unavailable. Retry.` | `0 pending` |
| Confirmed central receipt | `Accepted by Central DHIS2 at [time]` | `Success` without provenance |

## 6. Screen-by-screen enhancement work

### 6.1 Overview (`Workspace.tsx`)
**Problems to investigate:** excessive information density, duplicate globally displayed runtime status, possible stale/partial data mislabelling, potentially indefinite initial loading, use of small legend text, dashboard KPI semantics.  
**Changes:** concise information order, one status aggregator, typed states including unknown, progressive section detail, precise metric labels and timestamps, retryable partial errors.  
**Acceptance:** a first-time user correctly identifies server state, internet-independent local capture and the next action within 60 seconds.

### 6.2 Local Data
- One clear landing summary for Aggregate, Events and Tracker; avoid using 'data', 'records' and 'queue' interchangeably.
- Consistent columns and filters; show visible distinction between locally saved, queued, in progress, accepted centrally, rejected and conflict review.
- Keep draft as draft; no visual implication that draft has been submitted.
- Record detail contains provenance, date, origin and actual synchronisation outcome.
- No duplicated record lists in Sync; navigation deep-links to canonical detail view.
- Do not expose patient identifiers unnecessarily in dashboard summaries.

### 6.3 Synchronisation
- Lead with `Pending`, `Sending`, `Accepted`, `Needs review`, `Failed` using exact backend semantics and a user-friendly glossary.
- Prefer a flow-oriented high-level summary over technical terms `journal`, `drift`, `worker` as primary labels.
- Conflict detail: clearly show local value, central value (where fetched and authorised), conflict type, difference, resolution choices, impact and audit trail; never silently auto-resolve without policy.
- Group worker, schedule and policy controls into one **Automatic sync** section with subpanels.
- Keep sync history authoritative and filterable; surface per-run result and record-level provenance.
- Clearly separate network connectivity from successful delivery and central acceptance.

### 6.4 Devices & Network
- One entry for device enrolment/status; show device name, connection mode, last seen, permission, and recent sync summary.
- Merge redundant device-network inventories by referencing a single underlying table/model; distinct views remain if they answer different questions.
- Default device page must not open a complex network mesh; use a dedicated Network diagram view.
- Keep access-point, LAN and internet connectivity distinct.
- Explain peer discovery in familiar technology language and show whether connectivity is current, stale or unknown.
- Retain security and diagnostics as advanced authorised pages.

### 6.5 DHIS2 Connection
- Default screen: central endpoint identity (redacted as necessary), connection result, verified version, configured organisation-unit binding, metadata last sync/check.
- Move compatibility flags, snapshot internals and aliases to advanced detail.
- Replace jargon-heavy metadata headings with clear technical descriptions of what fields/programmes are available locally.
- Require clear confirmation and auditing before changing organisation-unit binding or sensitive connection settings.
- Validate the one-organisation-unit design rule against actual server and accepted ADRs; document discrepancies, do not silently reshape data scope.

### 6.6 Administration
- Group user/role access, workflows, service health, backups, configuration and audit according to genuine administrator tasks.
- Separate common operations from security-sensitive or potentially destructive tools.
- Workflows: show purpose, status and actions before opening complex designers/monitoring. Keep peer-sharing semantics consistent with Devices.
- Health: show actionable service state first, technical metrics second; no duplicate dashboard overview.
- Backup & Restore: distinct action labels, destination/impact, privilege checks, verification evidence and recovery guidance.
- Settings: task-based sections, inline explanations, saved-state confirmation; no ambiguous switches.
- Evaluation: accessible to research evaluators but labelled as measurement/evidence, not simulated system health.

## 7. Content design and terminology standard

**Language level:** Simple, professional technology terminology. The audience includes facility administrators, IT officers, data managers, supervisors and support teams. Users should understand the application without knowing its source code, but DER should not sound like a consumer toy. **Keep established concepts such as Server, Device, Data, Synchronisation, Queue, Conflict, Backup, Restore, Security, Connection and Metadata when they are accurate.** Define specialised terms once where necessary.

| Existing technical/internal wording | Preferred interface term | Guidance |
|---|---|---|
| DER Runtime / control plane | DER Server | Display operational state separately: Running, Starting, Unavailable |
| Journal worker drain | Sync Service | State whether the service is running or paused |
| Outbox / operation envelope | Sync Queue | Indicate queued records and pending actions distinctly if the API does |
| Drift inspector | Metadata Changes | Show detected differences and when they were detected |
| Compatibility probe | DHIS2 Compatibility | Describe connection and version checks separately |
| Conflict reconciliation strategy | Conflict Resolution | Show both versions, selected resolution and impact |
| Peer / node | Connected Server / Peer Device | Use Peer only if a glossary or local explanation is helpful |
| Mesh topology | Network Topology | Show actual connection state and a useful diagram |
| Hash-chain verification | Audit Verification | Explain integrity validation results in details |
| Snapshot | Metadata Snapshot | Explain that it is a saved version if needed |
| OU binding | Organisation Unit Assignment | Display name and UID; preserve single-OU policy |
| WAN/ping/probe | Network Connection / Connection Test | Keep technical probe results under Diagnostics |
| Replay/reprocess | Retry Sync | Only when the underlying operation truly is a retry |

**Avoid both extremes.** Do not display `JOURNAL_WORKER_DRAIN`, `OPERATION_ENVELOPE`, `reconciliation policy ID` or raw controller terminology as navigation labels. Equally, do not replace `Sync Queue` with `Things waiting to go`, `Metadata` with `Forms and stuff`, or `Conflict Resolution` with `Choose what to keep`. Prefer precise, conventional technical terms over forced plain-language paraphrases.

**Writing rules:** sentence case; established technical nouns and action verbs; no unexplained internal acronyms; concise supporting descriptions at first use; consistent terms across menus, headings, tables, buttons, notifications and documentation. A status must distinguish local save, queued, transmitted, acknowledged and rejected when those distinctions apply. Do not imply internet availability is the same as Central DHIS2 connectivity.

## 8. Visual and interaction standards

- **Original approved DER logo and brand:** preserve exactly; flat colours, institutional navy/teal and restrained neutral surfaces. No gradients, glassmorphism, bright badges, 'AI chips', decorative illustrations or large rounded-card grids.
- **Typography:** Arial or existing approved brand font; body around 14–16 px, labels not below 13–14 px for key information, headings around 20–24 px as fits; maintain accessible zoom and contrast.
- **Density:** generous logical grouping without wasted empty space; thin dividers only where content structure requires them. Reuse established components, CSS variables and spacing tokens.
- **Layout:** sensible max content width; tables can scroll internally on small screens, forms and primary page chrome must not cause horizontal viewport scrolling.
- **Hierarchy:** one H1, meaningful H2s, one primary action per task context; minimise unnecessary labels, toolbars and nested navigation.
- **Feedback:** loading, empty, error, offline, unauthorised, permission denied, stale, in-progress, success and unknown states handled explicitly and consistently.
- **Actions:** visible focus, keyboard support, descriptive labels, disabled reasons, safe retry, accessible confirmation for dangerous operations; never silently discard unsaved changes.
- **Colour:** status text and icon as well as colour; no status-dependent meaning conveyed by colour alone.
- **Accessibility:** target WCAG 2.2 AA where applicable; verify keyboard order, semantics, focus restoration, contrast, screen-reader announcements, zoom 200–400%, reduced-motion support.
- **Responsive:** audit viewport widths at approximately 360, 390, 768, 1024, 1280 and 1440 px, and common 125%/150% browser zoom. Validate real device if possible.
- **Runtime performance:** avoid duplicate polling hooks mounted for the same resource; share cached state, deduplicate requests, cancel stale effects, handle API timeouts and avoid heavy dashboard visualisations on every home load.

## 9. Platform optimisation and technical approach

1. **Single source navigation:** edit `admin-ui/src/app/navigation.ts`, `SectionTabs` and `AdminShell` together; use explicit role-aware metadata and tested route-to-nav ownership.
2. **Canonical status data:** consider a shared runtime-status hook/provider for header, footer and overview; preserve API semantics and poll only while needed. Do not mistake missing data for false status.
3. **Query/resource strategy:** reuse lightweight state hooks; do not add a large cache dependency without measured need. Track request deduplication, cancellation, freshness and error isolation.
4. **Rendering:** only mount expensive topology and detailed chart components on their canonical screens; lazy-load suitable heavy secondary routes if bundle metrics justify it.
5. **Consistent components:** use shared `PageHeader`, `SystemStatus`, `Section`, `DataTable`, `ActionFeedback`, `EmptyState`, `ErrorState`, `ConfirmAction`; refactor only where it reduces duplication, avoid component abstraction for its own sake.
6. **API semantics:** inspect backend responses/controller contracts before renaming metric outcomes; change copy without changing data schema where possible. Maintain request/response compatibility and auth.
7. **Security:** preserve role checks on server and client; no tokens/secrets in UI logs; audit all mutations, especially rebind, resend, reset, backup, restore and policy updates.
8. **Observability:** add development-only instrumentation to compare duplicate requests, initial load, interaction delay, console errors and memory leaks before/after.
9. **Offline stability:** render previously known status as *stale* if cached; never imply fresh central connectivity without a recent probe.
10. **No silent data loss:** navigation, status redesign, and conflict controls must preserve queued operations, retry semantics, idempotency and audit history.

## 10. Full discovery and deduplication audit template

Before editing, enumerate every `admin-ui/src/App.tsx` route, navigation registry item and rendered screen. Build `docs/ui/admin-ui-route-inventory.csv` with:

`route,component,group,role,api_calls,primary_task,content_owner,duplicate_of,action,classification,implementation_status,evidence`

Classification: `keep`, `rename`, `merge-view`, `contextualise`, `redirect`, `advanced-only`, `remove-after-evidence`. The removal category requires proof of zero unique capability and maintained redirects; do not delete backend endpoints or stored data as part of aesthetic cleanup.

For each candidate duplication compare **same content? same authority? same user task?**. If data is related but serves a different decision, retain both views with distinct titles and clear cross-links.

## 11. Phased implementation programme and gates

| Phase | Work | Required outputs | Gate |
|---|---|---|---|
| **0 — Baseline** | Confirm HEAD/version, inspect routes/screens/controllers, run local app and browser walkthrough, record 6 viewport screenshots, usability issues | Route inventory, baseline screenshots, defect log, metrics, untouched baseline commit | All routes classified; blocked routes documented |
| **1 — Language & IA** | Task analysis, terminology glossary, canonical ownership, six-section nav prototype, roles, breadcrumb/back behaviour | User journey map, navigation spec, rename/redirect map | No unreachable functionality, user-tested findability |
| **2 — Shared shell** | Rework sidebar/secondary navigation/topbar/footer status; shared polling, stable active states | Component changes, route tests, responsive screenshots | Old links resolve; permission & status tests pass |
| **3 — Overview** | Reduce to state/attention/DER process/recent activity; relocate heavyweight panels | Simplified functional home, dedicated health/network links | First-time comprehension and error-state tests pass |
| **4 — Core flows** | Local Data, Sync, conflicts, pending/retry and history, accurate status wording | Working end-to-end flows and scenario fixtures | No queue/data-loss regression; real outcome semantics verified |
| **5 — Connections & devices** | DHIS2, OU, metadata and devices/network progressive disclosure | Role-aware connection, device, network tasks | Offline and reconnection journey passes |
| **6 — Administration** | Users, workflows, health, security, settings, backup/recovery, advanced tools | Clean operator flows and privileged controls | Authorisation, confirmation and audit verified |
| **7 — QA & research demonstration** | Automated and manual sweep, usability walkthrough, performance, evidence packaging, documentation | Before/after screenshots, route matrix, acceptance results, demo script, final report | All mandatory criteria satisfied; open gaps explicit |

Use meaningful batches, with isolated commits and precise evidence; implement several related screens together when safe. Never assert a phase is '100%' merely because code compiled.

## 12. Acceptance test catalogue

### 12.1 User experience
- U01: A novice explains local capture, central dependence and conflict review after viewing Overview without coaching.
- U02: All six/seven primary sections use clear plain-language labels.
- U03: Common user tasks found in ≤3 meaningful navigation steps (measured with 5 representative tasks).
- U04: No duplicate full dashboard or competing 'master' tables for the same task.
- U05: No more than five primary items in a secondary tab row unless usability testing justifies more or responsive overflow is explicitly managed.
- U06: Each screen has one unique title, clear purpose, primary action, useful empty-state and escape/back path.
- U07: At least five representative users/examiners/operators complete scripted comprehension tests; aim for ≥80% unaided task success, median ≤60s to identify each critical system state. Report actual results; do not fabricate.

### 12.2 Behaviour and accuracy
- B01: Local DER up and central offline are separately and correctly rendered.
- B02: Unknown/stale/reconnecting states are never mislabelled as accepted/synced/healthy.
- B03: Local save is never reported as Central DHIS2 acceptance.
- B04: Queue, history and conflict counts are scoped and timestamped accurately.
- B05: Offline → pending → reconnect → accepted transitions reflect actual backend acknowledgement.
- B06: Conflict-resolution action is permission-gated, audited and recoverably explained.
- B07: Role privileges and sensitive data remain protected on old and new URLs.
- B08: Existing canonical deep links, legacy redirects and page history remain functional.
- B09: Actions result in real response states; no dead or decorative controls.
- B10: No indefinite spinner on network/service failure; bounded error/retry feedback.

### 12.3 Engineering quality
- Q01: TypeScript typecheck, ESLint, unit/integration tests and build pass locally.
- Q02: Playwright route navigation, permission, offline, responsive, error and critical E2E tests pass against suitable fixtures/live services.
- Q03: axe detects no serious/critical violations on the tested route set; manual WCAG checks documented.
- Q04: Avoid duplicated polling; measure request rates and first-load payload/time against baseline rather than asserting arbitrary speedups.
- Q05: Zero unapproved API/data model regressions or lost queue operations in tests.
- Q06: Preserve approved logo, brand type, design tokens and readable responsive layout.
- Q07: Docs, route inventory, screenshot evidence, test command/results and changelog are updated.

## 13. Adoption-first product experience standard (mandatory)

The Admin UI is a **daily operational product**, not an academic dashboard. Design and test for first-time users, facility administrators with limited IT experience, district support personnel, support technicians and infrequent users returning after months away. Users must be able to complete the work without a presenter, a technical manual or an instructor translating labels.

### 13.1 No unexplained complexity, including in secondary screens

- Do **not** treat moving confusing content into an Advanced menu as sufficient. Rewrite **every existing screen**, contextual route, dialog, table column, alert, empty state, action and help tooltip using clear, familiar technology terminology. Technical internals remain available when necessary, but they must carry an understandable title, explanation, scope and safe next action.
- Remove dead-end pages, obsolete variants and redundant actions **only after** determining whether they have unique behaviour. Preserve necessary legacy redirects. Never quietly remove permissions, safety controls, audit trails, recovery tools or live capabilities.
- Where an expert-only view is needed, display its user-oriented purpose first; provide raw identifiers and diagnostics in a clearly labelled secondary detail area. The underlying need for expert access is not permission to leave the interface incomprehensible.
- Eliminate status-chip overload, visual noise, redundant page descriptions, repeated metric blocks, stacked tab bars and duplicate navigation cards. Avoid hidden functionality that only appears through undocumented gestures or cryptic icons.

### 13.2 Professional, jargon-free technology language contract

Every user-visible string must pass these checks:

1. Would a facility administrator or IT officer recognise this term without knowing DER internals?
2. Is it a standard technology term that correctly describes the feature, instead of a class name, job code or implementation detail?
3. Does a failure state explain **what failed**, **the effect on local data**, and **the next safe action**?
4. Are `Saved locally`, `Queued`, `Syncing`, `Synced`, `Rejected` and `Conflict` distinguished accurately?
5. Does a metric indicate its actual scope, time window, data freshness and limitations?
6. Is unfamiliar jargon explained briefly in the interface rather than replaced by childish or imprecise wording?

| Existing or internal wording | Preferred UI label | Optional supporting description |
|---|---|---|
| Edge runtime / control plane | DER Server | Local service for data capture and synchronisation |
| WAN probe | DHIS2 Connection Test | Checks connectivity to the central DHIS2 server |
| Sync worker / journal drain | Sync Service | Manages background synchronisation |
| Outbound queue / operation envelope | Sync Queue | Records and operations pending synchronisation |
| Conflict / reconciliation strategy | Sync Conflicts / Resolve Conflict | Compare conflicting changes before confirming |
| Metadata mirror / drift | Metadata / Metadata Changes | View locally available metadata and detected updates |
| Peer / mesh topology | Connected Devices / Network Topology | View connections between clients and DER servers |
| Hash chain / audit integrity | Audit Verification | Verify the integrity of security activity records |
| Compatibility snapshot / profile | DHIS2 Compatibility | Connection, version and supported capabilities |
| Binding / OU UID | Organisation Unit Assignment | Assigned facility or organisation unit, with UID in details |
| Degraded / partial outage | Service Warning | Name the affected service and operational impact |
| Replay / reprocess | Retry Sync | Clarify whether the operation is safe and idempotent |

The mapping is provisional: verify feature semantics and existing API responses before applying any label. Never rename backend contracts solely for wording consistency.

### 13.3 Help must live where decisions happen

- Introduce new users with a brief, **optional and dismissible** first-run explanation: purpose, the current facility, local capture, how syncing works and where to get help.
- Every main screen begins with one concise, task-oriented sentence; avoid repeated long hero introductions.
- Provide help beside unfamiliar controls and present practical examples for forms, policies and conflict decisions. Avoid documentation-only dependencies for routine tasks.
- Use actionable empty states: e.g., `No devices connected yet. Connect a device to the local network to begin.` Link to the actual permitted next step.
- Errors should preserve input, offer retry where safe and clearly distinguish no permission, not connected, no records, timed out, and unexpected failure.
- Keep labels consistent across sidebar, breadcrumbs, headings, tables, confirmation dialogs and help documents. No synonym roulette.

### 13.4 Task-first journeys (end-to-end)

| User job | Simple entry point | Minimum successful outcome |
|---|---|---|
| Check whether DER works | Overview | User knows exactly what is available locally and what needs attention |
| Connect a new device | Devices & Network → Add device | Guided authorised enrolment, clear status and troubleshooting |
| Check whether a record has reached central | Local Data → Record status | Current state, last update, next step and safe history |
| Deal with failed transfer | Synchronisation → Needs attention | Readable reason, safe retry or clear escalation |
| Resolve two competing edits | Synchronisation → Needs review → Record | Compare understandable values, see consequence, audited confirm |
| Connect central DHIS2 | DHIS2 Connection | Run a real connection check, understand outcome, resolve issue |
| Manage user access | Administration → Users | Add/modify user with clear role explanation and safe feedback |
| Protect or recover server data | Administration → Backup & recovery | Understand backups, restore impact, permissions and confirmation |

### 13.5 Quantified usability and adoption gates

- Conduct baseline and post-change usability sessions with **at least five participants per key role** where feasible, including people unfamiliar with DER. Record recruitment and limitations; do not manufacture participants or results.
- Target at least **90% unassisted completion** on the most common safe tasks; measure actual completion, time, errors and requests for help rather than assuming success.
- Target first-time users identifying DER/local/central status correctly in **30 seconds**, and finding a common task in **three navigation choices or fewer**. These are acceptance targets, not claimed current performance.
- Run a terminology comprehension check with intended deployment users; revise any term that causes repeated confusion.
- Verify on small laptops, tablets, common browser zoom settings and slow/intermittent networks. Test offline local work separately from unreachable central DHIS2.
- Provide a short operator quick-start and a one-page troubleshooting guide written for deployment staff; link them contextually inside DER.
- Support onboarding, role-specific permissions, keyboard use, accessible contrast, understandable screen-reader names and recoverable mistakes without special training.

### 13.6 Rollout and adoption safeguards

Pilot the redesigned UI with real, appropriately authorised users and non-sensitive sample data before general rollout. Capture baseline friction, compare observed task performance, log confusing interactions and remedy the highest-impact findings. When consolidating routes, preserve working bookmarks and release notes. Avoid disruptive changes to server semantics. Release with rollback instructions and a support handover. A visual redesign is **not complete** until ordinary users can operate it independently.

## 14. MSc research and evaluation as an additional scenario

The deployment and MSc demonstration remains useful as a structured offline-first scenario, but is not the organising principle of the production UI. Reuse the real product interface and authentic/synthetic-clearly-labelled evidence; do not create a separate presentation-only admin experience.

### Optional presentation narrative (5–8 minutes)

| Step | Screen | What to say / show | Evidence requirement |
|---|---|---|---|
| 1 | Overview | DER is a local edge runtime serving data collection close to users | Bound site, runtime/version and actual health |
| 2 | Devices & Network | Client devices use local connectivity independent of central internet | Real registered device and LAN/AP status |
| 3 | Local Data | A record is accepted into local durable storage | Real saved record, timestamp and local status |
| 4 | Synchronisation | The record waits safely when central DHIS2 is unavailable | Actual pending queue, no simulated acceptance |
| 5 | DHIS2 Connection | Internet/central connectivity is restored | Verified live connection probe |
| 6 | Synchronisation | DER transmits and tracks centrally acknowledged outcome | Actual sync run and server-side acknowledgement |
| 7 | Needs review | A conflicting change is displayed with understandable resolution choices | Pre-prepared legitimate synthetic test fixture, explicitly marked |
| 8 | Evaluation / Evidence | Discuss correctness, availability, conflict results and measured limitations | Repeatable experimental measurements, not marketing KPIs |

**Presenter safeguards:** mark synthetic data as synthetic; do not display personally identifiable patient data; avoid claims of perfect delivery, automatic conflict resolution or measured reliability without evidence. If Central DHIS2 cannot be reached during the examination, use labelled recorded evidence and explain the difference.

## 15. Implementation artefacts and file organisation

Recommended documentation additions:
- `docs/ui/DER_ADMIN_UI_SIMPLIFICATION_PLAN.md` — this plan adapted to latest HEAD.
- `docs/ui/admin-ui-route-inventory.csv` — machine-readable route map.
- `docs/ui/admin-ui-content-ownership.md` — one owner per metric/task and cross-link policy.
- `docs/ui/admin-ui-terminology.md` — approved user-facing terms and backend status mappings.
- `docs/ui/admin-ui-usability-test.md` — task script, results and priority defects.
- `docs/evaluation/evidence/admin-ui-simplification/` — dated screenshots, test outputs and performance data.

Likely code touchpoints: `admin-ui/src/app/navigation.ts`, `admin-ui/src/components/AdminShell.tsx`, `admin-ui/src/components/SectionTabs.tsx`, `admin-ui/src/screens/Workspace.tsx`, relevant `admin-ui/src/screens/*`, `admin-ui/src/api/edgeApi.ts`, route tests and CSS. Exact files and edits must follow Phase 0 investigation.

## 16. Decision / risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Hiding high-value Workflows inside Administration | Medium | Validate 6 vs 7 primary sections with admins; elevate if frequent task |
| Accidental false success while offline | Critical | Typed state model; distinct local save and central receipt; integration tests |
| Hiding an important advanced action | High | Keep contextual deep links and explicit authorised advanced entry |
| Incorrect metric calculation or queue count | High | Backend contract review, scope/time window, no default `0` for unknown |
| Broken historical URL | High | Redirect mapping + regression test |
| Unauthorised exposure of diagnostic/patient data | Critical | Role enforcement and redaction tests |
| Performance regression from polling/visual components | Medium | Share polling and profile before/after |
| Old audit findings mistaken for current failures | Medium | Retest current HEAD and label historical evidence |
| Design-only MSc demo not reproducible | High | Verify real offline/reconnect/conflict experiment and retain evidence |

## 17. Definition of done

A phase is done only when its inventory is updated; the relevant working behaviour is verified; accessibility, error, offline and mobile cases have been checked; route and permission regressions are absent; source and test links are recorded; and the UI has actually become easier to explain to a first-time user. The full project is ready for presentation when the live system and documentation clearly tell the research story without concealing operational uncertainty or technical limitations.

## 18. Source pointers

- [Current navigation registry](https://github.com/socaya/der-engine/blob/41bdc38d131b31edba1caad21fb32bd3bc5b08ff/admin-ui/src/app/navigation.ts)
- [Current Admin shell](https://github.com/socaya/der-engine/blob/41bdc38d131b31edba1caad21fb32bd3bc5b08ff/admin-ui/src/components/AdminShell.tsx)
- [Current landing page](https://github.com/socaya/der-engine/blob/41bdc38d131b31edba1caad21fb32bd3bc5b08ff/admin-ui/src/screens/Workspace.tsx)
- [Current routes](https://github.com/socaya/der-engine/blob/41bdc38d131b31edba1caad21fb32bd3bc5b08ff/admin-ui/src/App.tsx)
- [Design system](https://github.com/socaya/der-engine/blob/41bdc38d131b31edba1caad21fb32bd3bc5b08ff/docs/ui/01-design-system-and-navigation.md)
- [Prior navigation specification](https://github.com/socaya/der-engine/blob/41bdc38d131b31edba1caad21fb32bd3bc5b08ff/docs/media/ui/DER_ADMIN_UI_NAVIGATION_IMPLEMENTATION.md)
- [Historical Admin UI audit](https://github.com/socaya/der-engine/blob/41bdc38d131b31edba1caad21fb32bd3bc5b08ff/docs/project/admin-ui-enhancement-plan.md)

