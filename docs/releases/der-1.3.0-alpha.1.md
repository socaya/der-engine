# DER 1.3.0-alpha.1 — Initiative 10 slice B kickoff: device-owner config

> **Scope:** First alpha after the stable `der-1.2.0` cut. Begins
> Initiative 10 slice B by adding per-step owner-device configuration
> (ADR-0022). Writes are **not** gated by the device header yet —
> enforcement + the event / tracker reconcilers + workflow import/export
> land in later alphas.

**Release label:** `der-1.3.0-alpha.1`
**Git tag:** `der-1.3.0-alpha.1`
**DHIS2 reference:** 2.44-SNAPSHOT

## New

- Database migration **V018** — adds `owner_device_id UUID` to
  `capture_workflow_step`, nullable FK to `edge_device(device_id)`
  with `ON DELETE SET NULL`. Partial index on non-null values.
- `CaptureWorkflowStep` record gains `ownerDeviceId`; repository +
  controller round-trip it through the JSON API.
- Admin UI `EACaptureWorkflowDesigner` adds a collapsible "Enrolled
  devices" reference panel listing each device's UUID so admins can
  paste it into a step's `ownerDeviceId` field. Hidden when the fleet
  is empty.
- ADR-0022 — nullable device-owner column, role remains the fallback,
  config-only in alpha.1 (enforcement in alpha.2+), no history table,
  JSON textarea editor keeps the slice-A shape plus a reference panel.
- 1 new server test (repository round-trip of `owner_device_id`) +
  4 new admin-ui screen tests (device-panel renders, hidden-when-empty,
  userAgent-null fallback, null-devices response).

## Behaviour

```
POST /edge-api/v1/workflows   (ADMIN)
  { "steps": [{
      "ordinal": 0, "displayName": "Lab",
      "ownerRole": "OPERATOR",
      "ownerDeviceId": "11111111-....", /* new field, optional */
      "stepKind": "CAPTURE"
  }]}

Response round-trips ownerDeviceId.
```

```
Designer at /workflows/:id
  ↳ fetches /edge-api/v1/devices
  ↳ renders a <details> panel of enrolled devices with copyable UUIDs
  ↳ admin pastes UUID into the step's ownerDeviceId JSON field
  ↳ saveWorkflow persists through to capture_workflow_step.owner_device_id
```

## Test state

- **1114 server tests** pass (was 1113 + 1 new). `mvn verify` green.
- **212 admin-ui tests** pass (was 208 + 4 new). Vitest at
  **100 / 91.03 / 97.70 / 100**. Thresholds unchanged (100/90/97/100).
- Client: unchanged — no DC-side work in this alpha.
- SpotBugs + Checkstyle clean.

## Deliberate non-goals (deferred to alpha.2+)

- Enforcement — writes from a non-owner device log WARN but are not
  blocked. The interceptor lands with the event / tracker reconciler
  work.
- Event / tracker reconcilers (parallel to the aggregate reconciler
  shipped elsewhere in slice A).
- Workflow import/export (JSON round-trip across DER installs).
- Structured step editor with a `<select>` of devices (JSON textarea
  continues to be the authoring surface in slice B alpha.1).
- Multi-device ownership, device-group tags, device-user composition.
- Historical ownership tracking.

## Promotion path

`der-1.3.0-alpha.1` → alpha.2 (enforcement + first reconciler) →
alpha.3+ (import/export, remaining Initiative 2/3/8 work) → stable
`der-1.3.0`.
