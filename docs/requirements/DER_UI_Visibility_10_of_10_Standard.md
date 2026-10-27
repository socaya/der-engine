# DER Administration Console — UI Visibility 10/10 Standard

**Project:** DHIS2 Edge Runtime (DER)  
**Repository reviewed:** `socaya/der-engine`  
**Scope:** `admin-ui/` on the reviewed `main` branch  
**Target design language:** **Clean enterprise operations console + DHIS2 familiarity + Atlassian-style information density, but calmer and more readable.**  
**Document purpose:** Define the visual and usability quality bar required for DER to achieve a **10/10 UI Visibility rating**, independently of functional completeness.

---

## 1. Executive Rating

### Current visibility assessment

| Area | Current Rating | 10/10 Target |
|---|---:|---:|
| Global information hierarchy | 6.5/10 | 10/10 |
| Typography and readability | 5.0/10 | 10/10 |
| Navigation visibility | 6.0/10 | 10/10 |
| Operational-state visibility | 6.0/10 | 10/10 |
| Dashboard clarity | 5.5/10 | 10/10 |
| Tables and dense data views | 6.5/10 | 10/10 |
| Status and exception visibility | 7.0/10 | 10/10 |
| Conflict/reconciliation visibility | 5.5/10 | 10/10 |
| Metadata visibility | 6.5/10 | 10/10 |
| Forms and actions | 7.0/10 | 10/10 |
| Responsive visibility | 7.0/10 | 10/10 |
| Accessibility and visual consistency | 6.0/10 | 10/10 |
| **Overall current UI visibility** | **≈ 6.1/10** | **10/10** |

The current DER admin UI has a strong technical foundation, reusable components, live operational screens, and a clear domain model. The main gap is not lack of screens. The main gap is that **too much operational and technical information is shown with insufficient visual hierarchy, text is frequently too small, some critical DER states are not globally visible, and several important workflows still feel like engineering views rather than a calm operator console.**

---

# 2. Definition of a 10/10 DER UI

A **10/10 DER UI** must allow an administrator or operator to answer the following within a few seconds of opening the console:

1. **Is the DER runtime operational?**
2. **Can local users continue working?**
3. **Is Central DHIS2 reachable?**
4. **What operating mode is DER currently in?**
5. **Are locally accepted operations safely stored?**
6. **Is synchronization healthy?**
7. **How many operations are pending, retrying, rejected, or awaiting review?**
8. **Are there conflicts requiring a human decision?**
9. **Is metadata sufficiently current for supported workflows?**
10. **Are there security, storage, database, or service-health issues requiring intervention?**

A user should not need to interpret implementation details to answer these questions.

---

# 3. Core Design Principles

## 3.1 Calm enterprise operations console

DER should look and behave like a mature operational system, not a prototype dashboard.

Required characteristics:

- light neutral application canvas;
- restrained brand colours;
- status colour used only where it communicates state;
- minimal decorative gradients;
- minimal unnecessary borders;
- fewer visual containers;
- generous spacing between major sections;
- strong section hierarchy;
- dense information only where density improves decision-making;
- no excessive card grids;
- no unnecessarily small text.

## 3.2 DHIS2 familiarity

DER should feel understandable to administrators already familiar with DHIS2.

This does **not** mean copying the DHIS2 interface. It means preserving familiar concepts such as organisation units, programs, program stages, tracked entities, events, aggregate data, metadata, user roles, validation, DHIS2 Central, and synchronization status.

Where DER introduces new concepts, the UI must clearly distinguish them:

- Edge Runtime;
- Offline-First Mode;
- Local Commit;
- Pending Central Acceptance;
- Conflict Review;
- Reconciliation;
- Metadata Drift;
- Durable Journal;
- Recovery.

## 3.3 Atlassian-style information density

DER should adopt the useful aspects of Atlassian-style enterprise software:

- readable left navigation;
- restrained page chrome;
- tabular information for operational data;
- clear primary and secondary actions;
- contextual drawers;
- lightweight status pills;
- strong empty states;
- well-separated configuration and operational areas;
- progressive disclosure.

However, DER should be **calmer than Jira**. Avoid excessive badges, noisy side panels, too many nested tabs, crowded toolbars, multiple competing action colours, small 11 px interface text, and excessive information on the landing page.

---

# 4. Typography Standard — Mandatory for 10/10

Typography is the most important immediate visibility improvement.

## 4.1 Required type scale

| Element | Target |
|---|---:|
| Main page title | 28–30 px |
| Major section heading | 20–22 px |
| Panel/section title | 17–18 px |
| Standard body | **15–16 px** |
| Primary navigation | **15 px** |
| Secondary navigation/tabs | **14 px minimum** |
| Table body | **14–15 px** |
| Table headers | **12.5–13 px** |
| Form labels | 14–15 px |
| Secondary/supporting text | **13 px minimum** |
| Technical IDs / monospace values | 12–13 px |
| Badges/chips | 12–13 px |
| Tooltips | 13 px |
| Raw JSON/code viewer | 12–13 px |

### Non-negotiable rule

**No important operational information may rely on 10–11 px text.**

10–11 px may only be used for exceptional decorative or non-essential micro-labels where accessibility remains acceptable.

## 4.2 Font weight

Recommended:

- page title: 700;
- section title: 600;
- body: 400–450;
- table body: 400–500;
- navigation: 500;
- active navigation: 600;
- numerical KPI: 600–700;
- muted supporting text: 400.

Avoid excessive bold text.

## 4.3 Font family

Preferred application stack:

```css
font-family:
  Inter,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  "Helvetica Neue",
  Arial,
  sans-serif;
```

If Inter is not bundled, the system stack must remain visually consistent.

---

# 5. Colour and Contrast Standard

## 5.1 Base palette

The current DER navy/teal identity is appropriate.

Recommended use:

- Navy: primary navigation, key controls, selected state.
- Teal: secondary brand/accent use.
- Green: healthy/success.
- Amber: warning/degraded/offline-first state where action may not yet be required.
- Red: failed, unsafe, rejected, destructive, or critical conditions only.
- Neutral grey: routine metadata and secondary text.

## 5.2 Status colours must have semantic meaning

| Tone | Meaning |
|---|---|
| Green | Healthy / accepted / complete |
| Blue | Informational / in progress |
| Amber | Degraded / offline-first / delayed / warning |
| Red | Failed / rejected / critical / requires intervention |
| Grey | Paused / inactive / unknown / not applicable |

Do not use brand colour simply to decorate status elements.

## 5.3 Contrast target

All normal text and controls should meet WCAG AA contrast.

Critical status must never be communicated using colour alone. Every status requires at least one of: label, icon, state name, or explanatory text.

---

# 6. Global Shell — 10/10 Target

The shell should establish DER context on every screen.

## 6.1 Left navigation

Target width: **240–260 px**

Required:

- visible logo;
- readable 15 px labels;
- consistent icons;
- clear active state;
- no unnecessarily deep hierarchy;
- contextual routes hidden from the global navigation;
- collapse behaviour for smaller screens.

### Recommended primary navigation

1. **Overview**
2. **DHIS2**
3. **Synchronisation**
4. **Workflows**
5. **Data**
6. **Administration**
7. **System**
8. **Security & Audit** — if security scope remains large enough
9. **Settings**

Devices and users should normally live under **Administration** unless operational use justifies keeping Devices top-level.

## 6.2 Top bar

The top bar should contain:

- sidebar toggle;
- global DER operating mode;
- organisation unit/site context;
- search, if fully functional;
- Attention/Notifications;
- user profile;
- sign out through user menu or a secondary action.

### Mandatory global operating-state control

Examples:

**● Connected**  
**● Offline-First**  
**↻ Recovery & Reconciliation**

This element must be visible across all authenticated pages. Clicking it should open the Synchronisation overview.

## 6.3 Remove misleading hard-coded states

The reviewed shell includes a hard-coded:

> DER server · online

A 10/10 interface must never show a static health indicator.

Replace it with live state, for example:

> DER Runtime · Operational

or

> DER Runtime · Degraded

or

> DER Runtime · Starting

---

# 7. DER Operating Mode — Core Visibility Requirement

DER's operating mode is one of the most important concepts in the entire project.

A 10/10 UI must distinguish clearly between:

## 7.1 Connected

**DER Connected**

- LAN operational;
- DER operational;
- Central DHIS2 reachable;
- eligible changes synchronizing normally.

Suggested user-facing text:

> DER is connected to Central DHIS2. Local operations are available and eligible changes are being synchronized.

## 7.2 Offline-First

**DER Offline-First Mode**

This must **not** be presented as a generic outage.

Suggested text:

> Central DHIS2 is unavailable. DER remains operational on the local network. Locally accepted changes are being stored safely and queued for synchronization.

Display:

- time Central became unavailable;
- number of locally queued operations;
- last successful Central synchronization;
- local runtime health;
- metadata age;
- whether supported workflows remain available.

## 7.3 Recovery & Reconciliation

**Recovery & Reconciliation**

Suggested text:

> Connectivity has been restored. DER is reconciling pending local operations with Central DHIS2 while supported local workflows remain available.

Display:

- backlog size;
- processing rate;
- accepted;
- retrying;
- rejected;
- conflicts;
- estimated progress if reliable enough to calculate.

Do not show unreliable time estimates.

---

# 8. Overview / Workspace — 10/10 Target

The current Workspace contains too many operational and technical panels.

A 10/10 Workspace should focus on decisions.

## 8.1 First screen

Recommended structure:

### Runtime status strip

| Runtime | Local Workflows | Central DHIS2 | Sync | Attention |
|---|---|---|---|---|
| Operational | Available | Connected | Healthy | 2 |

## 8.2 Four primary operational metrics

Only four or five primary indicators should appear above the fold:

1. DER Runtime
2. Central DHIS2
3. Synchronisation
4. Attention
5. Optional: Local active users/devices

## 8.3 Operational activity

Show:

- recent synchronization trend;
- pending queue;
- exceptions;
- recent significant activity.

Do **not** make CPU, JVM heap, database migrations, scheduler job count, installed apps, or other internals prominent on the main landing page. Move those to System / Monitoring.

## 8.4 No dashboard decoration for its own sake

Avoid unnecessary circular gauges, mini charts, card grids, and decorative topology diagrams. Use visualizations only when they help answer an operational question.

---

# 9. Navigation Visibility — 10/10 Target

## 9.1 Secondary navigation

Current secondary tabs are too small.

Target:

- 14 px minimum;
- minimum 36–40 px touch/click height;
- horizontally scrollable on small displays;
- active state with strong contrast;
- no more than approximately 6–7 visible choices before regrouping is considered.

## 9.2 Route terminology

Labels must use operator language.

| Current/technical | Preferred |
|---|---|
| Needs your attention | Attention |
| Worker | Sync Worker |
| Queues | Data Queue |
| Compat | Compatibility |
| Drift | Metadata Drift |
| Journal operation | Synchronisation Operation |
| Central rejected | Rejected by Central DHIS2 |

Technical terms can remain in detail views.

---

# 10. Tables — 10/10 Standard

DER contains many data-heavy views, so tables must be first-class components.

## 10.1 Visual standard

Required:

- 14–15 px body text;
- 12.5–13 px headers;
- 44–52 px row height;
- sticky headers where appropriate;
- subtle horizontal separators;
- minimal vertical borders;
- visible hover;
- selected-row state;
- clear empty state;
- consistent status chips;
- right-aligned numerical columns;
- monospace only for technical identifiers;
- sortable columns where useful;
- predictable row actions.

## 10.2 Search and filtering

Filters should be directly above the table.

Recommended:

- text search;
- type;
- state/status;
- date/time;
- organisation unit/workflow where relevant.

Active filters should be obvious and easily removable.

## 10.3 Pagination

Pagination must show:

- current page;
- total pages;
- row count;
- page size;
- previous/next.

Do not force users to infer whether a search applies to the current page or the full dataset.

---

# 11. Status Chips — 10/10 Standard

Status chips should use plain language.

Examples:

- Waiting
- Sending
- Accepted
- Retrying
- Rejected
- Needs Attention
- Offline-First
- Paused
- Running
- Up to Date
- Degraded

Avoid exposing raw enum values unless inside diagnostic/detail views.

---

# 12. Synchronisation — 10/10 Visibility

The current Synchronisation area is one of DER's strongest UI areas and should be retained, simplified, and visually enlarged.

## 12.1 Synchronisation overview

Must show:

- current sync state;
- Central reachability;
- worker state;
- last successful sync;
- queue size;
- attention count;
- recent runs;
- primary action.

Recommended states:

- Up to Date
- Waiting
- Synchronising
- Central Unavailable
- Needs Attention
- Paused
- Recovering

## 12.2 Primary synchronization action

Prefer:

**Synchronise Pending Changes**

over ambiguous generic actions where appropriate.

Metadata synchronization should remain separate because it has different semantics.

## 12.3 Queue visibility

A user must be able to see:

- locally committed;
- pending;
- in-flight;
- accepted;
- retryable;
- Central rejected;
- conflict review;
- unknown acknowledgement outcome.

Operator labels should be human-readable while raw states remain available in details.

---

# 13. Conflict and Reconciliation UI — Mandatory 10/10 Area

This is the most important UI enhancement required by the DER research contribution.

The current conflict screen should evolve beyond simple Accept/Reject.

## 13.1 Conflict detail must show

### Identity

- entity type;
- entity/reference ID;
- workflow/program;
- organisation unit;
- local operation ID;
- conflict classification;
- priority;
- time detected.

### Version context

- last known shared version;
- Edge version/time;
- Central version/time;
- metadata version;
- operation origin;
- operation history.

### Field-level comparison

| Field | Edge | Central | Assessment |
|---|---|---|---|
| Phone | 0772… | 0782… | Conflict |
| Status | Active | Active | Same |
| Stage | Consultation | Laboratory | Conflict |

## 13.2 Explain the conflict

The screen must answer:

> Why did DER not resolve this automatically?

Example:

> Both DER and Central DHIS2 changed the same attribute after their last common version. Applying either version automatically could discard a valid update.

## 13.3 Resolution actions

Preferred actions:

- **Use Edge Version**
- **Use Central Version**
- **Merge Compatible Changes**
- **Defer**
- **View History**

Where "Use Edge Version" still requires Central validation, the UI must say so.

Avoid generic **Reject** without explaining what is being rejected.

## 13.4 Confirmation

Destructive or potentially data-losing actions require confirmation that explains:

- what will change;
- whether data is retained in audit history;
- whether Central will be updated;
- whether local operation remains visible.

---

# 14. Metadata — 10/10 Visibility

The current metadata browser is technically comprehensive but visually overwhelming.

## 14.1 Group resources

Instead of a flat list of many metadata resource types, group them.

### Aggregate
- Data Elements
- Data Sets
- Categories
- Category Combinations

### Tracker
- Programs
- Program Stages
- Tracked Entity Types
- Tracked Entity Attributes
- Relationships

### Rules & Validation
- Program Rules
- Program Rule Variables
- Program Rule Actions
- Validation Rules
- Validation Rule Groups

### Organisation
- Organisation Units
- OU Levels
- OU Groups
- OU Group Sets

### Options
- Option Sets
- Option Groups

### Analytics
- Indicators
- Dashboards
- Visualisations
- Maps
- Event Reports

### Administration / Other
- User Groups
- User Roles
- Attributes
- Documents
- Reports
- SQL Views

## 14.2 Metadata health summary

The page should immediately show:

- last successful metadata sync;
- current Central metadata version/snapshot;
- current Edge metadata snapshot;
- drift detected;
- affected pending operations;
- stale metadata warning.

## 14.3 Metadata detail

Use tabs:

**Summary | Relationships | Rules | Raw JSON**

Raw JSON is a diagnostic feature, not the primary operator view.

---

# 15. Forms — 10/10 Standard

Required:

- 15 px input text;
- 14–15 px labels;
- clear descriptions;
- explicit required fields;
- readable validation messages;
- clear primary action;
- no excessive form width;
- logical field groups;
- confirmation for dangerous changes;
- save feedback.

Maximum normal field width: **480–640 px**, depending on content.

Long descriptions/text areas may use wider layouts.

---

# 16. Buttons and Actions

## 16.1 Hierarchy

Each screen should have:

- one dominant primary action where possible;
- secondary actions;
- tertiary/link actions;
- destructive actions visually separated.

Avoid multiple equally strong primary buttons.

## 16.2 Naming

Use verb + object.

Examples:

- Synchronise Pending Changes
- Pull Metadata
- Retry Operation
- Resolve Conflict
- Bind Organisation Unit
- Pause Sync Worker
- Create User
- Run Compatibility Check

Avoid vague labels such as Submit, Execute, or Process unless context is unmistakable.

---

# 17. Notifications / Attention Centre

The current notification affordance should become a functional Attention Centre or be removed until functional.

Valid attention types:

- conflict awaiting review;
- Central rejection;
- repeated sync failure;
- metadata drift affecting pending operations;
- low storage;
- database/service degradation;
- worker paused unexpectedly;
- permission/credential staleness;
- backup failure;
- Central connectivity restored/lost.

Notifications should be actionable.

---

# 18. Global Search

The current search box should either become functional or be removed.

A 10/10 search can search:

- users;
- devices;
- sync operations;
- Tracker/event references;
- workflows;
- metadata names/UIDs;
- sync runs;
- organisation units.

Results should be grouped by type.

Keyboard shortcut: **/** or **Ctrl/Cmd + K** is recommended.

---

# 19. Monitoring — 10/10 Visibility

System internals should be moved away from the main Workspace.

Recommended System/Monitoring areas:

## Health
- DER application
- database
- sync worker
- scheduler
- metadata service
- Central DHIS2 reachability

## Resources
- CPU
- memory
- DER storage footprint
- available disk
- database growth

## Diagnostics
- recent failures
- logs
- probes
- compatibility checks

## Activity
- operational timeline
- alerts
- significant state changes

Technical details should progressively disclose.

---

# 20. User and Access Visibility

User screens should show:

- username/display name;
- role;
- organisation unit;
- active/inactive;
- last login/session;
- Central identity mapping;
- local credential/session state;
- last Central authorization verification.

DER-specific security status is important during disconnected operation.

Example:

> Central permissions last verified: 2h 14m ago

If authorization becomes stale beyond policy, show a warning.

---

# 21. Responsive Design — 10/10 Standard

## Desktop

Optimized for:

- 1366×768;
- 1440×900;
- 1920×1080;
- higher-resolution displays.

No critical content should require excessive horizontal travel.

## Tablet

At <=1024 px:

- sidebar may collapse;
- top bar must retain operating mode;
- section tabs remain readable;
- summary grids stack appropriately;
- tables remain usable.

## Mobile

At <=768 px:

- navigation becomes drawer;
- key status remains visible;
- forms become single column;
- action bars wrap;
- tables horizontally scroll or transform to readable rows;
- conflict review remains usable.

Administrative mobile support need not expose every advanced diagnostic feature, but must preserve critical operational visibility.

---

# 22. Accessibility — Mandatory for 10/10

Required:

- keyboard navigation;
- visible focus;
- accessible names for icon buttons;
- semantic headings;
- table headers;
- sufficient contrast;
- status not communicated by colour alone;
- correct aria states for expandable regions;
- modal focus trapping;
- screen-reader-friendly error messages;
- minimum practical target size near 40–44 px;
- reduced motion support where relevant.

---

# 23. Empty, Loading, Error and Degraded States

Every major screen must explicitly design:

1. Loading
2. Empty
3. Partial load
4. Error
5. Offline Central
6. Permission denied
7. Data unavailable
8. Stale data
9. Retryable failure
10. Critical failure

Do not display only blank tables or generic "Error" messages.

Example:

> **Central DHIS2 unavailable**  
> DER remains available locally. Metadata shown here is from the most recent successful synchronization on 27 Oct 2026 at 21:42.

---

# 24. Language and Terminology

Use consistent language throughout the UI.

Preferred:

- Central DHIS2
- DER Runtime
- Edge
- Local
- Synchronisation
- Offline-First
- Reconciliation
- Attention
- Pending
- Accepted
- Rejected by Central DHIS2
- Metadata Mirror
- Metadata Drift
- Local Commit

Avoid switching between server / runtime / node / engine unless the distinction is intentional.

---

# 25. Page-Level Visibility Requirements

## Overview

Must immediately reveal:

- DER status;
- operating mode;
- Central connectivity;
- synchronization state;
- attention count;
- last successful sync.

## DHIS2

Must reveal:

- Central URL/identity;
- DHIS2 version;
- reachability;
- compatibility;
- organisation-unit binding;
- metadata health.

## Synchronisation

Must reveal:

- queue state;
- worker state;
- last success;
- Central reachability;
- pending;
- retrying;
- rejected;
- attention;
- history.

## Workflows

Must reveal:

- workflow name;
- type;
- enabled state;
- supported DER status;
- metadata version;
- dependent stages/steps;
- local availability;
- last synchronization state.

## Data

Must reveal:

- aggregate/events/Tracker distinction;
- local state;
- synchronization state;
- validation state;
- Central acceptance state.

## Administration

Must reveal:

- users;
- mappings;
- roles;
- sessions;
- credentials;
- devices;
- enrolment/ownership as applicable.

## System

Must reveal:

- service health;
- database;
- scheduler;
- sync worker;
- storage;
- resources;
- diagnostics.

## Security & Audit

Must reveal:

- audit integrity;
- security events;
- backup;
- restore;
- recovery state.

---

# 26. Visual Density Standard

A 10/10 DER UI should be **dense enough for operations but not compressed**.

Recommended spacing:

| Token | Use |
|---|---|
| 4 px | micro-spacing |
| 8 px | related inline items |
| 12 px | compact controls |
| 16 px | normal control spacing |
| 20–24 px | section content |
| 32 px | major section separation |
| 48 px | major page separation where appropriate |

Avoid large empty decorative spaces and avoid cramped clusters.

---

# 27. Card and Panel Rules

Use a panel only when grouping materially helps comprehension.

Prefer:

- section title;
- divider;
- content.

Over:

- card inside card;
- card grids;
- heavily shadowed containers.

Recommended:

- subtle borders;
- near-zero or very soft shadows;
- 6–10 px radius;
- white/light neutral surface.

---

# 28. Recommended Information Architecture

```text
DER

Overview

DHIS2
  Overview
  Organisation Unit
  Compatibility
  Metadata Mirror
  Metadata Drift

Synchronisation
  Overview
  Data Queue
  Metadata Sync
  Attention
  Worker
  Schedule
  History
  Settings

Workflows
  Workflows
  Approvals
  Referrals

Data
  Overview
  Aggregate
  Events
  Tracker
  Drafts
  Maintenance

Administration
  Users
  Roles
  DHIS2 Mappings
  Sessions
  Credentials
  Devices
  Device Enrolment
  Device Diagnostics

System
  Health
  Metrics
  Storage
  Diagnostics
  Analytics

Security & Audit
  Audit Trail
  Integrity Verification
  Security Events
  Backup
  Restore
  Recovery

Settings
  General
  Provisioning
  Apps
  Releases
  Network
```

---

# 29. 10/10 Visibility Acceptance Checklist

The UI reaches **10/10 Visibility** only when all P0 requirements and nearly all P1 requirements below are satisfied.

## P0 — Must Have

- [ ] Body text baseline is at least 15 px.
- [ ] Secondary tabs are at least 14 px.
- [ ] Table body text is at least 14 px.
- [ ] Critical secondary text is at least 13 px.
- [ ] DER operating mode is globally visible.
- [ ] Connected / Offline-First / Recovery states are explicit.
- [ ] Hard-coded "DER server · online" is removed.
- [ ] Workspace is simplified around operational decisions.
- [ ] Central outage is not incorrectly presented as DER outage.
- [ ] Synchronization state is visible from every page.
- [ ] Conflict detail shows meaningful Edge vs Central comparison.
- [ ] Conflict decisions explain consequences.
- [ ] Navigation hierarchy is visually clear.
- [ ] No important feature depends on 10–11 px labels.
- [ ] Error/empty/loading/offline states are deliberately designed.
- [ ] Status colour is never the only status indicator.
- [ ] Primary actions are clearly distinguished.
- [ ] Tables are legible without zoom.
- [ ] Accessibility contrast and keyboard focus are acceptable.

## P1 — Strongly Required

- [ ] Primary navigation consolidated to approximately 8–9 logical domains.
- [ ] Metadata resources grouped by domain.
- [ ] Metadata health summary added.
- [ ] Raw JSON moved to a secondary diagnostic tab.
- [ ] Search is functional or removed.
- [ ] Notification bell becomes a real Attention Centre or is removed.
- [ ] Monitoring internals moved away from Workspace.
- [ ] Users show authorization freshness.
- [ ] Sync terminology is consistently operator-friendly.
- [ ] DHIS2 metadata browsing and metadata synchronization are clearly distinguished.
- [ ] Security/Monitoring duplicate routes are resolved.
- [ ] Destructive actions require confirmation and explain effect.
- [ ] Responsive navigation remains readable.
- [ ] Tablet/mobile state visibility is retained.

## P2 — Refinement

- [ ] Reduce decorative dashboard charts.
- [ ] Reduce unnecessary panel/card chrome.
- [ ] Standardize icon language.
- [ ] Standardize empty-state illustrations/icons if used.
- [ ] Add keyboard shortcuts for common navigation.
- [ ] Add route-aware global search.
- [ ] Add contextual help for advanced DER terminology.
- [ ] Improve transitions without distracting motion.
- [ ] Add user-selectable compact/comfortable table density only if needed.

---

# 30. Proposed Scoring Model

A repeatable score can be calculated across ten categories.

| Category | Weight |
|---|---:|
| Typography and readability | 15% |
| Information hierarchy | 15% |
| Operational-state visibility | 15% |
| Navigation clarity | 10% |
| Data/table readability | 10% |
| Conflict and exception visibility | 10% |
| Visual consistency | 10% |
| Responsive usability | 5% |
| Accessibility | 5% |
| Empty/error/loading/degraded states | 5% |
| **Total** | **100%** |

### Rating interpretation

| Score | Rating |
|---:|---|
| 95–100 | 10/10 — Production-grade visibility |
| 90–94 | 9/10 — Excellent |
| 80–89 | 8/10 — Strong |
| 70–79 | 7/10 — Good |
| 60–69 | 6/10 — Functional but visibly immature |
| 50–59 | 5/10 — Significant readability/hierarchy issues |
| <50 | Major redesign required |

The current repository review places DER at approximately **61/100 for UI visibility**, mainly because the application already has strong coverage and operational semantics, but typography, dashboard density, global DER-state visibility, navigation density, and conflict-reconciliation presentation prevent it from reaching a production-grade 10/10.

---

# 31. Target Visual Character

The final interface should feel:

**Professional** — Not experimental.  
**Operational** — Focused on what administrators need to know and do.  
**Calm** — No unnecessary colour, borders, badges, cards, or visual noise.  
**Readable** — No important 10–11 px UI text.  
**DHIS2-aware** — Uses familiar DHIS2 concepts while clearly introducing DER-specific concepts.  
**Conflict-aware** — Makes reconciliation, provenance and conflicting changes understandable.  
**Offline-first** — Treats loss of Central connectivity as an operating condition, not automatically as an application failure.  
**Enterprise-ready** — Consistent enough to support national-scale operational use and formal MSc evaluation.

---

# 32. Final 10/10 Visibility Definition

DER reaches **10/10 UI Visibility** when a new but technically competent administrator can open the console and, without consulting documentation:

- understand DER's current operating mode;
- know whether local workflows can continue;
- distinguish DER health from Central DHIS2 connectivity;
- understand synchronization state;
- identify what needs human attention;
- inspect and resolve conflicts safely;
- find metadata, data, users, workflows and system health predictably;
- read tables and supporting text comfortably;
- distinguish primary actions from diagnostics;
- understand failures and degraded states;
- use the console effectively on common desktop and tablet resolutions.

The interface should no longer feel like a collection of implemented capabilities.

It should feel like **one coherent DHIS2 Edge Runtime operations console**.

---

# 33. Recommended Next Step

After completing this visibility standard, perform a separate **DER Functionality 10/10 Review**.

That review should score:

1. Overview and operational state
2. DHIS2 integration
3. Metadata synchronization
4. Data synchronization
5. Conflict detection and reconciliation
6. Workflows
7. Aggregate data
8. Event capture
9. Tracker
10. User/access management
11. Device management
12. Audit/security
13. Backup/recovery
14. Monitoring/diagnostics
15. Offline-first behavior
16. Recovery after WAN restoration
17. Reliability and idempotency
18. Compatibility with pinned DHIS2 release
19. Performance/resource usage
20. Test coverage and production readiness

The functionality rating should be kept separate from UI Visibility so that a visually excellent screen cannot conceal an incomplete backend capability, and a technically complete feature cannot receive a high usability score when it remains difficult to operate.

---

## Repository areas reviewed for this visibility assessment

Primary files and areas inspected include:

- `admin-ui/src/App.tsx`
- `admin-ui/src/app/navigation.ts`
- `admin-ui/src/components/AdminShell.tsx`
- `admin-ui/src/styles.css`
- `admin-ui/src/screens/mockups/Workspace.tsx`
- `admin-ui/src/screens/mockups/SyncOverview.tsx`
- `admin-ui/src/screens/mockups/Metadata.tsx`
- `admin-ui/src/screens/mockups/DataQueues.tsx`
- `admin-ui/src/screens/mockups/UsersDashboard.tsx`
- `admin-ui/src/screens/mockups/MoreScreens.tsx`
- supporting shared UI components and route definitions under `admin-ui/src/`

---

**Status:** UI Visibility target specification ready for implementation and subsequent 10/10 rescoring.
