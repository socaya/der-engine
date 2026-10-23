# DER 2.0.1-alpha.1 — honest status catalog + CSV refresh

> **Scope:** Audit sweep. Adds `docs/implementation_status.md`
> cataloguing all 211 FRs/NFRs with verified status. Updates
> `docs/verification/traceability-matrix.csv`'s `status` column
> **only where verified** — 5 items confirmed DONE after code
> re-reads; 23 flipped from `specified` to `pending` to be truthful
> about the gaps. The 183 remaining rows stay `in-progress` — a
> future sweep can promote individual rows after per-FR re-reads.

**Release label:** `der-2.0.1-alpha.1`
**Git tag:** `der-2.0.1-alpha.1`

## New

- `docs/implementation_status.md` — single source of truth for
  per-FR / per-NFR status (DONE / PARTIAL / SCAFFOLD / DESIGN-ONLY /
  PENDING). Supersedes the stale `status` column.
- CSV status refresh:
  - 5 flipped to `done`: FR-11-03, FR-12-01, FR-12-02, NFR-22, NFR-35
    (each verified against actual code + schema + tests).
  - 23 flipped to `pending`: FR-01-07..10, FR-15-06..10, FR-17-08..10,
    NFR-15/16/18/19/20/23/24/25/26/28/29 (actual gaps).
  - 183 remain `in-progress` — code shipped but FR-scope-level
    verification not yet performed.

## Verification note

Earlier audit flagged 10 candidates for DONE. On per-FR re-read, 5
failed verification:

- FR-06-06 completeness state — no `completeDate` / complete flow on
  aggregate.
- FR-07-02 event version check — events upsert but no conditional-
  write by expected version.
- FR-08-01/02 TEI capture — only metadata-side mirror classes exist;
  no capture-side TEI create or search endpoint.
- FR-12-03 dependency-ordered batching — limit cap exists; dependency
  ordering not explicit.

These stay `in-progress` until the gap is closed.

## Train plan

Alphas 2 + 3 close the 23 PENDING items. Stable 2.0.1 cuts after.

## Test state

Docs-only; test counts unchanged.
