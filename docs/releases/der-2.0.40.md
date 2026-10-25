# der-2.0.40 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.39`

## Headline

Resolve the OU-path breadcrumb to human-readable ancestor
names. The Organisation-unit page now reads
`Mauritius › Plaines Wilhems › Town of Quatre Bornes - Ward 4 › A&A Medcare Medical Centre/Clinic`
instead of four raw DHIS2 UIDs.

## Changes

### `admin-ui/src/api/edgeApi.ts`

New helper:

```ts
export async function getOrganisationUnit(uid: string)
  : Promise<{ id: string; displayName?: string; path?: string } | null>
```

Hits the DHIS2-shape endpoint `GET /api/organisationUnits/{uid}`
that already existed in `MetadataListController`. Returns
`null` on 404 so missing-ancestor UIDs quietly fall back to the
raw UID render instead of surfacing an error.

### `admin-ui/src/screens/CapabilityScreens.tsx` — `CapOrgUnitBinding`

- New state `pathNames: Record<uid, displayName>` keyed by UID.
- New `useEffect` triggered on `b.orgUnitPath` change: parses the
  `/`-separated path into UIDs and fires `getOrganisationUnit`
  in parallel for each one. Results merge into `pathNames`.
- The breadcrumb render now resolves each UID through
  `pathNames[uid]`:
  - When a name is cached, it renders as plain text (leaf gets
    `ink-700` + weight 500 so the facility pops).
  - When the fetch hasn't resolved yet, falls back to the raw
    UID in `.ea-mono` so the layout never collapses.
  - Each crumb carries a `title={uid}` hover tooltip so the UID
    is still one hover away for operators that need it.
- Marked the breadcrumb `<nav>` with
  `data-test="ou-path"` for the verification spec.

The DHIS2 UID remains visible in the first stat tile and via the
Copy UID button, so no debugging context is lost — only the
redundant breadcrumb-UID render was swapped.

## Live assertions

| Check                                      | Observed                                                                                     |
|--------------------------------------------|----------------------------------------------------------------------------------------------|
| Breadcrumb text                            | `Mauritius › Plaines Wilhems › Town of Quatre Bornes - Ward 4 › A&A Medcare Medical Centre/Clinic` |
| Breadcrumb contains 11-char UID            | **no** (regex `\b[A-Za-z0-9]{11}\b` matches 0 times)                                         |
| Facility name as leaf                      | yes (`Medcare` present)                                                                      |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.0.39/V239-ou-names.png`.

## What's next

Groundwork laid for the Sync module revamp
(`/admin/sync/*`) — see the follow-up iteration.
