# ADR-0001: Record architecture decisions

- Status: ACCEPTED
- Date: 2026-10-21
- Deciders: socaya
- Related requirements: all P0 work in Phases 01+

## Context

The DER project is a research prototype whose architectural choices must be
defensible under supervisor review and whose evidence must be reproducible by
future maintainers. The main engineering specification (DER-ENG-001) explicitly
forbids silent scope changes and requires every non-trivial architectural
decision to be auditable.

## Decision

Use lightweight Architecture Decision Records (ADRs) in Markdown, kept in
`docs/architecture/decisions/NNNN-title.md`. Each ADR follows the Nygard
template, extended with explicit `Status`, `Date`, `Deciders` and `Related
requirements` fields. ADR filenames are zero-padded and never renumbered after
acceptance. An ADR MAY be marked `SUPERSEDED` by a later ADR; the original stays
in the repository to preserve history.

Valid statuses:

- `PROPOSED` — written but not yet reviewed; may change wording.
- `ACCEPTED` — reviewed and in force. Reference it from code or docs.
- `SUPERSEDED by ADR-NNNN` — kept for history, no longer binding.
- `REJECTED` — recorded explicitly so the rejection reason survives.

## Consequences

- Reviewers can audit which decisions are frozen and which are open.
- Code and docs reference ADRs by number (`see ADR-0005`), stable across moves.
- Scope decisions that affect FR/NFR coverage must be reflected in the
  `docs/verification/traceability-matrix.csv` and `docs/releases/*.md`.
