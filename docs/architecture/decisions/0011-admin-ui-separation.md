# ADR-0011: admin-ui vs device-client separation + backup/restore scope

- Status: **ACCEPTED**
- Date decided: 2026-10-22
- Deciders: socaya
- Related: ADR-0004 (hybrid architecture), ADR-0005 (custom apps)

## Decision

**Two independent SPAs, deliberate helper duplication.**

- `client/` is the device-client used by data-capture staff (DC-01..18).
- `admin-ui/` is the admin console (EA-01..36).
- Both consume DER's `/edge-api/v1/*` and `/api/*`; same cookie session;
  they are deployed as sibling static-asset trees served by the DER
  server.
- Shared helpers (`edgeApi.ts`, `AuthContext.tsx`, `RequireAuth.tsx`,
  `ScreenStates.tsx`, test harness) are **copy-pasted** between the two
  projects at the moment. A Phase 06.5 contract test will assert that
  the two copies produce identical outputs for a battery of inputs.
- Each project owns its own `node_modules`, Vite config, Playwright
  config, and coverage gate.

### Rationale

- Keeps dependency surfaces minimal: `admin-ui` does not pull
  `@dhis2/ui` or `@dhis2/app-runtime`, so administrator laptops with
  spotty bandwidth get a small, cache-friendly download.
- Lets each project set its own branch-coverage threshold without
  cross-coupling.
- Trades slight code duplication for a simpler mental model and
  independent release cycles.

### Alternatives considered

- **npm workspace monorepo** with a `packages/shared` directory.
  Rejected because it would touch every CI step, require path aliases
  in both Vite configs, and complicate Playwright's module resolution
  during E2E.
- **Merge admin-ui into client under `/admin`.** Rejected because the
  admin audience is different from capture staff and we want distinct
  deployment artefacts (admin bundle is not shipped to data-capture
  devices by default).

## Backup / restore scope boundary (companion decision)

Phase 06 Release 3 ships UI screens for backup / restore
(EA-23..EA-26) backed by the stub `backup_run` + `restore_run` tables
from V010. The actual `pg_dump` orchestration + archive
upload/download ships in Phase 07.

Backup stub endpoints return HTTP 202 + a `requested` row so operators
can see their intent recorded. A later `pg_dump` worker (Phase 07)
drains `REQUESTED → QUEUED → SUCCESS/FAILED` through the same journal
mechanics as ADR-0010.

## Consequences

### Positive

- Both SPAs are small, independently buildable, and testable without a
  monorepo tool.
- Backup/restore gets a durable persistence story early even though the
  physical implementation ships later.

### Negative

- Any change to `edgeApi.ts` must be mirrored. Mitigated by:
  - Contract test (Phase 06.5).
  - Explicit `// shared with admin-ui` comments on affected sections.

### Risk

- Divergent helpers over time. Mitigation: Phase 09 does a final merge
  review before stable 1.0 and either promotes to a shared package or
  justifies the divergence per-helper in writing.
