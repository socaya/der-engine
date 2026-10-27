# der-2.1.47 (stable)

**Date:** 2026-10-27
**Previous stable:** `der-2.1.46`

## Headline

Two things in one release:

1. **Workflows module polished** — all 6 screens now use the same
   `.ea-screen-header` + `.ea-chip` + `Panel` + `.ea-table` primitives
   as the Sync module. No more `HeroHeader`, no more `ea-dash-hero`,
   no raw state enums.
2. **Metadata page: Recent pulls are drill-in** — click any row (or
   its *Open* button) and the right drawer shows the run details plus
   the metadata-pull payload JSON rendered with the standard
   `JsonViewer` (syntax-highlighted + copy-to-clipboard).

## Workflows module

### `/workflows` — `EACaptureWorkflowList`

- Replaced the bare `<h1>` + prose paragraph + plain link with the
  standard header: `Workflows` + `N of M enabled` status chip, subtitle
  explaining what a workflow is, and a right-aligned `New workflow`
  button. Catalogue table wrapped in `Panel`.
- Table columns: `Name · Binding · Version · Enabled · Action`.
  Enabled is now an operator-friendly chip (`Enabled` / `Disabled`),
  Delete uses `.ea-btn--ghost ea-btn--sm ea-btn--danger`.

### `/workflows/runs` — `CapWorkflowRuns`

- `HeroHeader` → `SyncStatusBar` with status chip (`None yet` /
  `N in flight` / `N recorded`).
- Table state column humanised: `COMPLETED → Completed`,
  `REJECTED → Rejected`, etc., via `humaniseState` with the raw enum
  preserved on the chip's `title=` tooltip.
- Timestamps rendered via `toLocaleString()` not raw ISO.

### `/workflows/assignments` — `CapStepAssignments`

- `HeroHeader` → `SyncStatusBar` (`None` / `N steps` chip).
- Table columns refined to `Workflow · Step · Name · Owner role ·
  Kind`. Owner role and step-kind chips humanised; raw enum lives on
  the `title=` tooltip.

### `/approvals` — `MockupApprovalQueue`

- `Hero` → `SyncStatusBar` (`All clear` / `N pending` chip).
- Table columns re-ordered to `[icon] · Record · Submitted by ·
  Submitted · Action`. Entity type gets an icon + humanised label from
  `entityTypeIcon` / `entityTypeLabel` (same vocabulary as `/sync/data`
  and `/sync/attention`); mono entity-ref sits under the label.
- Drawer header now carries the big icon + entity label + mono ref,
  followed by a clean fact list and the Approve / Reject buttons with
  a `Reject reason` text input above them.

### `/referral/inbox` — `MockupReferralInbox`

- `Hero` → `SyncStatusBar` (`N pending` / `Inbox empty` / `All
  handled` chip).
- Table columns: `[icon] · Referral · Received · Status · Action`.
  Icons + humanised type labels + humanised status chips.
- Drawer leads with the entity icon + type label + status chip, then
  received/age/inbox-id details, then Accept / Dismiss buttons when
  the entry is still PENDING.

### `/referral/history` — `CapReferralHistory`

- `HeroHeader` → `SyncStatusBar` (`N total` chip + accepted / dismissed
  / pending counts in the subtitle).
- Table columns humanised; kind + status chips use `humaniseState`.

### Shared cleanups

- Removed the now-unused `IconMail` helper from `MoreScreens.tsx`.

## Metadata page: Recent pulls → drawer

> "Each Pull history MUST also open details page with a complete
> metadata payload loaded if any (JSON)."

- `Panel("Recent pulls")` wrapped in `SplitWithDrawer`.
- Each row is now `.ea-table--selectable` with a hover state, click to
  open, plus a dedicated `Open` button in a new Action column.
- Drawer renders:
  - **Title row** — `Metadata pull` + Succeeded/Failed chip + relative
    age (`19s ago`).
  - **Fact list** — Run ID, Started, Finished, Duration, Triggered by.
  - **Metadata payload** header + `JsonViewer` with the parsed detail
    JSON (`{total: 874, snapshotId: 23, centralVersion: "2.44-SNAPSHOT"}`).
    Falls back to a `{detail: "…"}` wrapper when the detail isn't JSON,
    and a muted "This pull run did not record a payload summary." when
    the detail is empty.

## Live assertions (all green)

Playwright-swept all 6 Workflows routes:

| Route | H1 | Standard header | No old hero |
|-------|----|-----------------|-------------|
| `/workflows` | `Workflows None defined` | ✓ | ✓ |
| `/workflows/runs` | `Workflow runs None yet` | ✓ | ✓ |
| `/workflows/assignments` | `Step assignments None` | ✓ | ✓ |
| `/approvals` | `Approvals All clear` | ✓ | ✓ |
| `/referral/inbox` | `Referral inbox Inbox empty` | ✓ | ✓ |
| `/referral/history` | `Referral history 0 total` | ✓ | ✓ |

Metadata drawer:

- Click first row → drawer visible: ✓
- Drawer carries `METADATA PAYLOAD` header: ✓
- Drawer carries a `[data-test="json-copy"]` Copy button: ✓
- Example payload rendered: `{total: 874, snapshotId: 23, centralVersion: "2.44-SNAPSHOT"}`

Screenshots: `/tmp/der-workflows/` (6 Workflows screens + metadata-drawer).
