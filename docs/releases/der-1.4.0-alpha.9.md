# DER 1.4.0-alpha.9 — Initiative 2 scaffold

> **Scope:** Edge Agent module skeleton under
> `agents/dhis2-edge-agent/`, plus the edge-side `/sync/notify`
> receiver that schedules an immediate metadata sync when the Agent
> fires a webhook. Agent-side polling + webhook dispatch remain
> post-1.4.0.

**Release label:** `der-1.4.0-alpha.9`
**Git tag:** `der-1.4.0-alpha.9`

## New

- `agents/dhis2-edge-agent/` — Maven module, Spring Boot shell,
  `application.yml` template, README.
- `SyncNotifyController` at `POST /edge-api/v1/sync/notify`
  (authenticated any-user). Accepts `{ objects, kinds }`, fires
  `MetadataSyncService.syncAll`, returns `{ acknowledged, objects }`
  or 503 on sync failure.
- `SecurityConfig` relaxes `/sync/notify` to `authenticated()` so the
  Agent doesn't need an ADMIN session (while keeping the rest of
  `/sync/**` admin-only).
- ADR-0029.

## Non-goals

- Agent-side DHIS2 polling + webhook dispatch (next alpha).
- Webhook HMAC signing / mTLS pairing.
- Edge registration UI.
- Backwards-compat with pre-ADR-0029 agents.

## Test state

- **1277 server tests** pass (was 1274 + 3). `mvn verify` green.
