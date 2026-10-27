# der-2.1.53 (stable)

**Date:** 2026-10-27
**Previous stable:** `der-2.1.52`

## Headline

Two review notes:

> "Why is this Last error? [success response body] — on details page the
> tabs e.g. Overview / Payload on Data sync is not formatted according
> to standard UI styles. Display professionally please."
>
> "Remove all the funny border radius, white background for tables etc,
> make the tables as interactive, Atlassian styles please, modern,
> compact. The Metadata pull seems not to show the metadata payload
> loaded. [...] This run didn't move individual records — it's a
> scheduler heartbeat with no payload to show."
>
> "Elements div, section e.g. `<section class="ea-panel">...</section>`
> and not following the standard UI design principles."

Fixed:

1. **"Last error" renamed to "Last response"** on successful runs — the
   server stores the DHIS2 import response in the `last_error` column
   regardless of success/failure. The UI now treats it as a response
   unless the operator-facing state is actually a failure.
2. **Parsed response summary** — the raw DHIS2 import JSON (which
   contains dozens of `strictPeriods: false` style flags no operator
   cares about) is parsed into a short list: Message · Status · HTTP ·
   Import count · Conflicts. The raw body stays available behind a
   "Show full response" toggle.
3. **Metadata pull payload now rendered** — the Sync History detail
   page used to say *"This run didn't move individual records"* for
   metadata pulls. It now renders the pull's `detail` JSON
   (`total: 874, snapshotId: 27, centralVersion: "2.44-SNAPSHOT"`) as
   the Payload via `JsonViewer`.
4. **Atlassian-flat UI pass** — tables, panels and def-lists restyled
   to match standard Atlassian / modern-admin conventions.

## Changes

### Atlassian-flat styling (`admin-ui/src/styles.css`)

- **Panels**: `.ea-panel-title` is now Title Case 14 px semibold (was
  tiny UPPERCASE 12 px). `.ea-panel-head` grew a hairline bottom border
  so the title visually anchors the section. Panel margin bumped to
  20 px between sections.
- **Tables**:
  - Base: 13 px rows, 8 px horizontal padding, hairline bottom borders.
  - Dense variant: 12 px rows, 8/10 padding.
  - Hover state darkens by 4 % navy — subtle but visible.
  - Selectable rows show a 6 % navy wash when hovered.
  - Zebra striping removed.
  - All table cells use `background: transparent` so there's no
    boxy white card behind rows.
- **Def-list**: switched from "zebra-with-borders" to a clean two-
  column attributes grid (`180px label | 1fr value`, 20 px gap, 6 px
  vertical padding, no row separators). Reads like an Atlassian
  attributes block.
- **JsonViewer**: dropped the rounded card. Header on a muted bg,
  code block on white, flat 1 px border.
- **RowMenu dropdown**: lost the rounded corners; now a flat 1 px
  bordered popover with a soft shadow. Open-state kebab button
  switches to the navy soft tone. Menu items get a hairline hover.

### SyncHistory detail (`/sync/history/:runId`)

- When a run's detail JSON carries payload-shaped keys (metadata
  pulls, drift snapshots etc.) but no `operationIds`, the Payload tab
  now renders the detail JSON directly via `JsonViewer` (dropping the
  `byType` / `operationIds` keys since those have their own blocks
  above).
- "Breakdown by data type" switched from floating tiles to a proper
  dense table (icon · data type · records count), consistent with
  every other table in the admin UI.

### DataQueues detail (`/sync/data/:operationId`)

- Status chip for `last_error` field flipped to a "Last response"
  panel. The raw body is parsed through `parseResponseBody()` and
  rendered as:
  - **Message** — the DHIS2 response's `message` or `description`
  - **Status** — chip, success-green if OK/SUCCESS, danger-red otherwise
  - **HTTP** — e.g. `OK · 200`
  - **Import count** — imported / updated / ignored / deleted counts
  - **Conflicts** — count if any
- "Show full response" toggle reveals the raw JSON in a `<pre>` block.
- Title no longer concatenates entity type + ref into one over-long
  string. Title is just the entity type (`Aggregate data`); the ref
  moves to the subtitle line as mono text so long GUID-like refs
  don't wrap into the header actions.

### DrawerTabs (`shared.tsx`)

- Reused the standard `.ea-section-tabs` / `.ea-section-tab` classes
  instead of inline-styled buttons. Picks up the admin UI's standard
  underline-tab look automatically. The optional per-tab badge keeps
  its pill shape for count visibility.

## Live assertions (all green)

Playwright-swept the Metadata pull detail page:

| Check                                                    | Observed |
|----------------------------------------------------------|----------|
| H1 reads "📦 Metadata pull · Succeeded"                   | ✓        |
| Overview tab renders Run attributes block (Atlassian flat) | ✓      |
| Payload tab renders Payload panel with JsonViewer         | ✓        |
| JsonViewer shows `{total: 874, snapshotId: 27, centralVersion: "2.44-SNAPSHOT"}` | ✓ |
| "scheduler heartbeat" fallback copy gone                  | ✓        |

Screenshots in `/tmp/der-md-detail/` cover Overview + Payload tabs.
