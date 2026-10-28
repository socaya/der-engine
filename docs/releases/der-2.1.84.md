# der-2.1.84 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.83`

## Headline

`/dhis2/metadata-drift` cleaned up:

1. **Long explainer text folded behind an info-hint icon** —
   the "Metadata mirror fidelity · one-way comparison / DHIS2 is
   the source of truth…" paragraph is replaced with a quiet
   click-to-reveal popover.
2. **Direction strip removed** — the full-width Central → DER
   card with the big navy arrow and separate "one-way" chip is
   gone. Direction now sits on the subtitle as a short label.
3. **Related tiles depilled** — the three emoji-fronted
   `.ea-link-tile` cards (◱ Metadata browser, ▶ Metadata sync,
   ⏱ Sync history) are replaced with three ghost buttons
   carrying matching `UiIcon` glyphs.
4. **Fingerprint panel equal-sign** switched from a soft chip
   to a bold tone-coloured glyph (`=` on success-ink, `≠` on
   warning-ink). Panel head picks up a `<Status>` marker
   (**Identical** / **Different**) in the right slot.

## 1. Info-hint popover (new `InfoPopover`)

### Trigger

An 18 px round `ⓘ` button in the screen-header subtitle, next to
the direction label. Classic Atlassian-style outlined circle +
line + dot — SVG, 14 × 14 inside the trigger button.

### Open state

Click reveals a `<details>` popover anchored under the icon:

```
┌─────────────────────────────────────────┐
│ About metadata drift                    │
│                                         │
│ DHIS2 is the source of truth. This      │
│ probe hashes DER's mirrored resources   │
│ against Central's.                      │
│                                         │
│ A mismatch simply means the next        │
│ metadata-sync pull will update DER.     │
│ Nothing is ever written back to         │
│ Central.                                │
└─────────────────────────────────────────┘
```

- Native `<details>` so no React state needed.
- `.ea-info-popover-body` positioned absolutely with
  `top: calc(100% + 6px); left: 0`.
- 280–360 px wide; `.ea-surface` background, 1 px border, `el-2`
  shadow.
- Click-outside doesn't close it (native `<details>` quirk) —
  clicking the `ⓘ` again toggles it back, which is the
  familiar native-browser dismiss pattern.

### CSS

```css
.ea-info-popover-trigger{
  width:18px;height:18px;border-radius:50%;
  color:var(--der-ink-400);
}
.ea-info-popover-trigger:hover,
.ea-info-popover[open] > summary > .ea-info-popover-trigger{
  color:var(--der-primary-ink);background:var(--der-raised);
}
.ea-info-popover-body{
  position:absolute;min-width:280px;max-width:360px;
  background:var(--der-surface);border:1px solid var(--der-border);
  box-shadow:var(--el-2);padding:12px 14px;
}
```

## 2. Direction strip — removed

```
Before (full-width card, 56 px tall):
┌─────────────────────────────────────────────────────────┐
│ Central → DER   Metadata mirror fidelity · one-way      │
│                 DHIS2 is the source of truth. This probe│  [one-way]
│                 hashes the mirrored resources against   │
│                 central, so a mismatch means the next   │
│                 metadata-sync pull will update DER …    │
└─────────────────────────────────────────────────────────┘

After (one line, folded in subtitle):
Metadata drift · ● In sync
Central → DER (one-way) · ⓘ · Added 0 · Removed 0 · Modified 0 …
```

Four lines → one line. Explainer still one click away.

## 3. Related — tiles → buttons

```tsx
// was
<Link className="ea-link-tile">
  <div className="ea-link-tile-icon">◱</div>
  <div className="ea-link-tile-title">Metadata browser</div>
  <div className="ea-link-tile-desc">
    Browse the mirrored resources this comparison is measured against.
  </div>
</Link>

// now
<Link className="ea-btn ea-btn--ghost ea-btn--sm">
  <UiIcon icon="metadata" size={14} />
  <span>Metadata browser</span>
</Link>
```

The description text is folded into the destination page's own
header (where it belongs). The button form fits in a single
horizontal row with the other two cross-links.

## 4. Fingerprint panel

- `=` / `≠` separator: `.ea-chip --success / --warning` → bold
  20 px glyph in success-ink / warning-ink.
- New right-slot `<Status>` marker on the panel header reads
  **Identical** (success tone) or **Different** (warning tone).

## Live assertions

```
drift page:
  .ea-info-popover summary  : present
  popover open before click : false
  popover open after click  : true, text starts "About metadata drift…"
```

Screenshot `/tmp/der-2.1.84-drift-open.png` shows the clean
single-line subtitle with the ⓘ icon between "Central → DER
(one-way)" and the Added / Removed / Modified counts, and the
popover anchored under the icon with the full two-paragraph
explainer.

## Build + test

```
tsc -b && vite build          ✓ 1733 modules
./mvnw -q -DskipTests package ✓ 2.1.84 JAR built
Server serves 2.1.84           ✓
Playwright drift-page sweep    ✓
```
