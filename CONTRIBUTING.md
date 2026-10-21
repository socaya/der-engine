# Contributing to DER

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch.

This document records the branch, review, release and quality rules the Phase 00
gate enforces. Treat it as a working contract: amendments require a PR of their own.

## Toolchain

- Java 21 (verified: `openjdk 21.0.10`)
- Maven 3.9+ (`server/mvnw` is the authoritative wrapper)
- Node 20+ and npm 10+
- Python 3.11+ for `scripts/`
- Docker is **not** required for Phase 00; later phases will introduce Testcontainers-based integration tests that require it.

## Branches

| Branch | Lifespan | Purpose |
|---|---|---|
| `main` | protected, long-lived | Only tagged, gate-passed commits. Never force-push. |
| `feature/FR-xx-*` | short-lived | New functional requirement work. Branch name links to the `docs/requirements/source-functional-register.csv` ID. |
| `fix/<slug>` | short-lived | Defect fixes with evidence of regression test. |
| `docs/<slug>` | short-lived | Documentation-only PRs. |
| `release/X.Y.Z` | opens with the Phase 09 release candidate | Freezes scope and runs full gate. |

## Pull requests

Every PR MUST include:

1. A link to the FR/NFR/screen ID or ADR that justifies the change.
2. Updated `docs/verification/traceability-matrix.csv` row(s) if the change
   advances implementation or verification status.
3. New or amended tests that run as part of the local-evidence gate.
4. A reviewer-approved rationale for any suppression added to
   `server/quality/spotbugs-exclude.xml` or `server/quality/dependency-check-suppressions.xml`.
5. Evidence that `scripts/run_all_checks.sh` passed locally. Attach the
   `gate-report.md` from the generated evidence bundle (do not paste raw logs).

PRs merging into `main` require a passing gate and reviewer approval. Do not
merge unfinished P0 work behind a misleading default or feature flag.

## Commits

- Author identity: `socaya <socaya@stephocay.com>`. No AI co-author trailers.
- Commit messages: imperative mood, present tense, 72-column soft limit.
- Each commit SHOULD compile and pass the gate; use `git commit --amend` or
  `git rebase -i` **before** push to preserve this property. Public history is
  never rewritten.
- Create NEW commits rather than amending published commits. If a pre-commit
  hook fails, fix the underlying issue and create a new commit.

## Issues

Open a GitHub issue for every blocker surfaced by the gate (`BLOCKED` decision
in `gate-report.md`). Reference the issue number in follow-up PRs.

## Version governance (summary of DER-ENG-001 §4.1 and docs/delivery/02-release-and-versioning.md)

- `VERSION` at the repository root is the single source of truth.
- `scripts/release.sh X.Y.Z` updates `VERSION`, `server/pom.xml`,
  `admin-ui/package.json` and `client/package.json` atomically. It does **not**
  commit, tag or push.
- `scripts/check_version_consistency.py` MUST pass before every merge.
- Git tags: annotated, preferably signed, in the exact form `der-X.Y.Z`.
  Never substitute `v`, `V`, or `der-vX.Y.Z`.
- A new DHIS2 pinned patch is **not** a DER MAJOR/MINOR/PATCH event by itself;
  it is a `der-X.Y.Z` MINOR or MAJOR depending on whether the compatibility
  matrix published in `docs/releases/` is extended or broken.

## Quality gates (Phase 00)

Running `scripts/run_all_checks.sh` executes, in order:

1. `scripts/check_version_consistency.py`
2. `scripts/check_registers.py`
3. `python3 scripts/test_check_version_consistency.py`
4. `python3 scripts/test_check_registers.py`
5. `python3 scripts/check_structure.py`
6. `server/ ./mvnw -Dder.dependency-check.skip=true verify` — unit tests,
   JaCoCo check (100% line+branch on included packages), SpotBugs, Checkstyle.
   OWASP dependency-check runs when network access is available; otherwise it
   is reported as `NOT RUN` in the evidence bundle.
7. `admin-ui/ npm run lint && npm run typecheck && npm run test:coverage`
8. `client/ npm run lint && npm run typecheck && npm run test:coverage`
9. Playwright E2E if `npm run test:e2e:install` has been run; otherwise
   reported as `NOT RUN`.

A failing step blocks the gate. Phase 00 does not accept skipped tests.
