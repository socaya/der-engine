# der-2.1.76 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.75`

## Headline

SignIn page migrated off `@dhis2/ui NoticeBox` onto the DER-native
quiet state blocks shipped in 2.1.75. The sign-in surface now
visually matches every other DER screen.

## Changes

### SignIn — three NoticeBox call-sites replaced

| Call-site | Was | Now |
|---|---|---|
| EDGE_DOWN notice | `<NoticeBox warning title="Edge unreachable">` | `<ErrorBlock title="Edge unreachable">` |
| Sign-in error | `<NoticeBox error title="Sign-in failed">` | `<ErrorBlock title="Sign-in failed">` |
| Dev credentials hint | `<NoticeBox title="Test credentials">` | `<EmptyBlock title="Test credentials (dev build only)">` |

The dev-credentials row keeps all its inner content (username,
password, autofill button, rotation note) — only the outer card
chrome changed.

### Imports

`NoticeBox` dropped from the `@dhis2/ui` import list; `ErrorBlock`
+ `EmptyBlock` added from `../components/ScreenStates`.

### Bundle size

The sign-in bundle lost ~7 KB (gzip, 604 → 597 KB) by dropping
`NoticeBox` tree-shake dependencies.

## Live assertions

```
sign-in h1                     : "Sign in to DER Administration"
state-block count on sign-in   : 1 (the Test-credentials EmptyBlock)
```

Screenshot `/tmp/der-2.1.76-signin.png` — the dev credentials
block now reads as:

```
▌ [grid]  Test credentials (dev build only)
▌         USERNAME  der-admin                        [Autofill]
▌         PASSWORD  OY2/uIass26KcwqwMIc+UjqlBDNDU4ER
▌         Rotate before any shared or production use. See docs/…
```

## No remaining NoticeBox usages

`grep -rn 'NoticeBox' admin-ui/src` returns zero matches after
this release (the only hit is a historical comment inside
`ScreenStates.tsx`). The admin UI no longer uses any
`@dhis2/ui`-styled alert surface — every screen renders through
the DER vocabulary (`SyncStatusBar`, `Status`, `.ea-state-block`,
`UiIcon`).

## Build + test

```
tsc -b && vite build          ✓ 1733 modules
./mvnw -q -DskipTests package ✓ 2.1.76 JAR built
Playwright SignIn render      ✓ h1 + 1 state block rendered
Bundle size                   ✓ 604 KB → 597 KB (NoticeBox dropped)
```
