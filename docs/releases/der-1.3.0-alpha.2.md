# DER 1.3.0-alpha.2 — Initiative 10 slice B: device-owner enforcement

> **Scope:** Closes the explicit alpha.1 gap. Writes to
> `/api/dataValueSets` bound to a capture-workflow with any
> device-owned step must now carry a matching `X-DER-Device-Id`
> header; non-matching writes fail 403 and audit a
> `DEVICE_OWNER_MISMATCH` event into the hash chain.

**Release label:** `der-1.3.0-alpha.2`
**Git tag:** `der-1.3.0-alpha.2`
**DHIS2 reference:** 2.44-SNAPSHOT

## New

- `DeviceOwnerEnforcementInterceptor` (ADR-0023) — Spring MVC
  interceptor guarding `/api/dataValueSets` POST/PUT/PATCH. Looks up
  the applicable `capture_workflow` for the payload's `dataSet`; if
  any step has `owner_device_id` set, requires `X-DER-Device-Id`
  header to match some step's owner device. Fail-open on lookup
  errors (ADR-0023 D-DOE-4 — capture-is-always-available wins).
- `OrgUnitWebConfig` wires the new interceptor behind an
  `ObjectProvider` so Spring slices that don't boot
  `CaptureWorkflowService` continue to work unchanged.
- New audit events: `MISSING_DEVICE_HEADER`, `DEVICE_OWNER_MISMATCH`.
  Chain through ADR-0021's trigger — no new audit code.
- Client `edgeApi` attaches `X-DER-Device-Id` to every request when a
  device id is persisted in `localStorage`. Reads via the existing
  `getStoredDeviceId()` helper from ADR-0019. Silent fall-through
  when localStorage is unavailable.
- ADR-0023 — the enforcement rule ("device must own some step in the
  applicable workflow"), interceptor placement, fail-open behaviour,
  client-side header injection.

## Behaviour

```
POST /api/dataValueSets               (JSON { dataSet: "ds1", … })
    ↳ OrgUnitScopeInterceptor         (unchanged)
    ↳ DeviceOwnerEnforcementInterceptor
         resolveForDataSet("ds1")
         if workflow has any step with owner_device_id:
             require X-DER-Device-Id header
             require header ∈ { step.owner_device_id | step ∈ workflow }
             on mismatch → 403 { code, message, workflowId }
                            + audit DEVICE_OWNER_MISMATCH (chained)
```

| Workflow state | Header | Outcome |
|---|---|---|
| no device-owned step | — | allow |
| device-owned step | missing | 403 `MISSING_DEVICE_HEADER` |
| device-owned step | not a UUID | 403 `DEVICE_OWNER_MISMATCH` |
| device-owned step | not an owner | 403 `DEVICE_OWNER_MISMATCH` |
| device-owned step | owner | allow |

## Test state

- **1127 server tests** pass (was 1114 + 13 interceptor tests).
  `mvn verify` green.
- **153 client tests** pass (was 150 + 3 header-injection tests).
  Vitest at the published thresholds.
- Admin-ui: unchanged (212 tests).
- SpotBugs + Checkstyle clean.

## Deliberate non-goals (deferred to alpha.3+)

- Per-step binding ("this payload belongs to step S, require S's
  owner device") — needs run-contribution tracking.
- Event + tracker reconcilers (parallel to the aggregate reconciler
  work).
- Workflow import/export (JSON round-trip across DER installs).
- Device-user composition, device-tag membership.
- Enforcement for `/api/events`, `/api/tracker/**` — only
  `/api/dataValueSets` is wired until program-binding lands.
- Device-identity-driven signing of payloads (ADR-0019 slice B,
  tracked separately).

## Promotion path

`der-1.3.0-alpha.2` → alpha.3 (workflow import/export +
program-binding) → alpha.4+ (reconciler, remaining Initiative 2/3/8
work) → stable `der-1.3.0`.
