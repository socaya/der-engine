# der-2.1.8 (stable)

**Date:** 2026-10-26
**Previous stable:** `der-2.1.7`

## Headline

The two trigger pages — `/sync/metadata` and `/sync/data` — now
carry the same directional model established on the Sync hub,
plus a payload-exploration tile grid at the bottom. One click
takes operators from "trigger the job" to "see the data it
touched".

## Changes

### `admin-ui/src/screens/CapabilityScreens.tsx`

**`TriggerPanel` extended with `direction` + `relatedLinks`**

- New optional prop `direction: { arrow, label, tone, rationale }`
  renders a compact lane above the stat strip:
  `Central <arrow> DER · <label>` with a tone-coded badge
  (`info` for one-way, `success` for two-way) and a one-line
  rationale underneath. Marked with `data-test="trigger-direction"`.
- New optional prop `relatedLinks: [[label, to, hint][]]` renders
  an "Explore payload" `ea-section-title` + `ea-tile-grid` block
  at the end of the screen with one tile per link. Marked with
  `data-test="trigger-related"`.
- The Trigger-now button gained a `data-test="trigger-run"` hook
  for verification.

**`CapMetadataSync`** (`/sync/metadata`)

- Direction `Central → DER (pull only)` · `one-way` chip.
- Rationale: "DHIS2 is the source of truth for metadata. DER
  mirrors it locally so capture surfaces keep running when the
  WAN drops; no metadata is written back from DER."
- Related tiles: **Metadata browser** · **Metadata drift**.

**`CapDataExchange`** (`/sync/data`)

- Direction `Central ↔ DER (push + pull)` · `two-way` chip.
- Rationale: "Local captures journal up to central. Central-
  held OU data also syncs down so distributed workflows share
  the same record."
- Related tiles: **Queues** · **Conflicts** · **Sync history**.

## Live assertions

| Check                                          | Observed                                                 |
|------------------------------------------------|----------------------------------------------------------|
| `/sync/metadata` direction panel               | `Central → DER (pull only)` + `one-way`                  |
| `/sync/metadata` trigger button                | `Trigger now`                                            |
| `/sync/metadata` related tiles                 | Metadata browser · Metadata drift                        |
| `/sync/data` direction panel                   | `Central ↔ DER (push + pull)` + `two-way`                |
| `/sync/data` related tiles                     | Queues · Conflicts · Sync history                        |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.1.8/V218-metadata-sync.png`
+ `V218-data-exchange.png`.
