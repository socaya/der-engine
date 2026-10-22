# ADR-0023 — Device-owner enforcement for capture-workflow writes

- **Status:** Accepted (Phase 12 / der-1.3.0-alpha.2)
- **Related:** ADR-0018 (capture-workflow config), ADR-0019 (edge
  device identity), ADR-0022 (device-owned steps)
- **Roadmap:** Initiative 10 slice B — "device-owners" enforcement

## Context

ADR-0022 added `owner_device_id` to `capture_workflow_step` but
deferred the enforcement half: writes from a non-owner device logged
WARN and proceeded. Alpha.2 closes that gap.

A full "which step does this payload belong to" check would require
per-run contribution tracking, which doesn't exist until a later
alpha. The simpler-but-still-useful enforcement is: **if the workflow
applicable to a write has any device-owned step, only a device that
owns one of those steps may submit payloads for that workflow**. This
blocks the broadest attack ("random device writes to a device-owned
workflow") without needing run state.

## Decisions

### D-DOE-1 — New request header `X-DER-Device-Id`

The client appends `X-DER-Device-Id: <uuid>` to data-write requests
when a device id is stored locally. The header is optional on paths
that aren't workflow-bound. The server does not trust the header
beyond the enforcement check (membership in a workflow's device-owned
step set) — the device identity contract from ADR-0019 is unchanged.

### D-DOE-2 — Interceptor on `/api/dataValueSets`, `/api/events`, `/api/tracker/**`

Reuses the `OrgUnitScopeInterceptor` registration path
(`OrgUnitWebConfig`). Runs after org-unit scope so a
device-owner-mismatch 403 is only emitted when the OU check passed.

### D-DOE-3 — Rule: "device must own some step in the applicable workflow"

For a POST / PUT / PATCH on a guarded path:

1. Sniff the metadata binding (`dataSet`, `program`, `programStage`)
   from the payload. Payloads with no detectable binding fall through
   (same contract as `OrgUnitScopeInterceptor`).
2. Load the applicable enabled `capture_workflow` for that binding.
3. If no workflow applies, allow. If the workflow has no steps with
   `owner_device_id` set, allow.
4. Otherwise, require the request's `X-DER-Device-Id` header; its
   value must match `owner_device_id` of at least one step in the
   workflow.
5. On failure, write a `DEVICE_OWNER_MISMATCH` audit row (hash-chain
   participates), set `403 Forbidden`, and return JSON
   `{ code, message, workflowId }`. On missing header, the code is
   `MISSING_DEVICE_HEADER`.

### D-DOE-4 — Fail-open when the lookup fails

If the workflow lookup throws (DB down, repository unavailable), the
interceptor allows the request and logs WARN. This preserves "capture
is always available" ADR-0004.

### D-DOE-5 — Client appends the header automatically

`client/src/api/edgeApi.ts` learns a tiny request-interceptor hook
that reads the installation-UUID from `localStorage` via the
existing `getStoredDeviceId()` helper and attaches
`X-DER-Device-Id` to every non-auth request.

## Non-goals

- Per-step binding ("this payload belongs to step S, require S's
  owner device") — needs run-contribution tracking (later alpha).
- Device-user composition.
- Device-tag membership.
- Enforcement on read endpoints (reads remain any-authenticated).
- Device-identity-driven signing of payloads (that's ADR-0019 slice B,
  tracked separately).

## Consequences

- Workflows with no device-owned steps continue to work exactly as
  today; enforcement is strictly additive.
- Any client that doesn't send the header (CLI operators, older
  integrations) will fail against a device-owned workflow — operators
  must either enrol a device for those clients or remove the step
  owner. This is intentional; the "no device-owner, no change"
  property keeps the migration zero-blast-radius.
- `DEVICE_OWNER_MISMATCH` is a new audit event — the chain picks it up
  via the ADR-0021 trigger with no code change.
