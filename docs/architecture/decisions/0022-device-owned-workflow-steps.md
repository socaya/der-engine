# ADR-0022 — Device-owned capture-workflow steps

- **Status:** Accepted (Phase 12 / der-1.3.0-alpha.1)
- **Related:** ADR-0018 (capture-workflow config), ADR-0019 (edge
  device identity)
- **Roadmap:** Initiative 10 slice B — "device-owners"

## Context

ADR-0018 shipped the capture-workflow data model with a single owner
dimension: `owner_role` (ADMIN / OPERATOR / REVIEWER). That's
sufficient for workflows where any device-user with the right role can
pick up a step. It is **not** sufficient for the common pilot pattern
where a specific physical device (the lab tablet, the pharmacy
counter) owns a specific step and other devices must not even see it.

ADR-0019 added `edge_device` + `edge_device_dependency`, so DER
already models stable device identity. Slice B binds those two
concepts together.

## Decisions

### D-DVO-1 — Add `owner_device_id` to `capture_workflow_step`

V018 adds a nullable `owner_device_id UUID REFERENCES edge_device(device_id) ON DELETE SET NULL`.

- Nullable because most steps today don't need per-device ownership —
  a role-only step continues to work as before.
- `ON DELETE SET NULL` so revoking / deleting a device degrades the
  step gracefully back to role-only ownership, instead of blowing up
  the workflow.

### D-DVO-2 — Role remains the fallback, not a mutex

A step may set both `owner_role` and `owner_device_id`. Role is the
display label + the fallback if the device record is removed. Device
is the stricter constraint. They are not mutually exclusive; the
schema does not CHECK XOR them.

### D-DVO-3 — Config surface only in alpha.1; enforcement is alpha.2

Alpha.1 ships the schema, record, repository, controller, and admin
UI step editor's device picker. **Writes are not yet gated** by the
device header — a capture-write from a non-owner device logs a WARN
("device-owner mismatch, slice B enforcement deferred") and proceeds
normally. The enforcement interceptor lands in alpha.2 after the
event / tracker reconcilers.

### D-DVO-4 — No per-step device re-assignment history

Changing a step's owner device is an in-place UPDATE on
`capture_workflow_step`. The audit log already captures
`CAPTURE_WORKFLOW_UPDATED` for the whole workflow (via the broader
`security_audit`); we don't need a dedicated history table for this
column.

### D-DVO-5 — Admin UI exposes a device reference panel

Slice A shipped the step editor as a JSON textarea rather than a
structured per-field widget. Alpha.1 keeps that shape and adds a
device-id reference panel above the Steps textarea that lists each
enrolled device from `GET /edge-api/v1/devices` with copy-friendly
ids. Admins paste the UUID into the step's `ownerDeviceId` field.
A structured step editor with a true `<select>` lands with the event
/ tracker reconciler work in alpha.2+.

## Non-goals

- Device-user composition ("this device **and** this user").
- Multi-device ownership (one step → N devices).
- Device-group tags (deferred to Initiative 3's referral chain).
- Workflow-level device scoping (slice B explicitly steps-only).
- Historical ownership tracking.

## Consequences

- V018 is a trivial `ALTER TABLE … ADD COLUMN`; no backfill.
- Clients built against alpha.5 continue to accept the extended
  `WorkflowStep` JSON — the new field is additive and nullable.
- The deferred enforcement means slice B's security value is partial
  in alpha.1. Users should understand this reads as "pre-wiring" until
  alpha.2.
