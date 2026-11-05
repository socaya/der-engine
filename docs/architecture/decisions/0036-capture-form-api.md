# ADR-0036 — Data-module capture form API

**Status:** Proposed
**Date:** 2026-11-06
**Decision owners:** socaya
**Related ADRs:** ADR-0004 (hybrid DHIS2 edge emulation), ADR-0007
(program-rule execution at the edge), ADR-0018 (capture-workflow
config), ADR-0032 (client-user attribution), ADR-0034 (inbound data
pull), ADR-0035 (pull-write interlock)
**DER modules touched:** Data (primary), DHIS2 (consumer),
Synchronisation (consumer), Workflows (optional consumer),
Administration (authority)

## Context

DER already emulates the DHIS2 `/api/*` write path end-to-end
(ADR-0004) and the server-side **program-rule engine** (ADR-0007) runs
against every aggregate / event / tracker write. Through V088 the
server has:

- **Writes** — `POST /api/dataValueSets` · `POST /api/events` ·
  `POST /api/tracker` · `POST /edge-api/v1/tracked-entities` ·
  `POST /edge-api/v1/tracker/{enrollments,events,relationships}`,
  each journaled into the **Synchronisation** module's
  `operation_journal` and drained by the sync worker.
- **Reads** — DHIS2-shape bulk reads (`GET /api/dataValueSets`,
  `GET /api/events`, `GET /api/tracker/events`) plus single-row
  fetches for TEIs / enrollments / stage events.
- **Metadata mirror** — eleven resources under the **DHIS2** module
  (dataSets, dataElements, programs, programStages,
  programStageDataElements, trackedEntityTypes,
  trackedEntityAttributes, categoryOptionCombos, optionSets,
  programRules, programRuleActions), pulled by `MetadataSyncService`
  and served from `metadata_*` tables.
- **Captures inside workflows** — ADR-0018's `capture_workflow_run`
  threads any journaled write back to its originating workflow step
  (`operation_journal.workflow_run_id`).
- **Attribution** — ADR-0032 stamps every row with `storedBy` resolved
  from the edge-user ↔ DHIS2-user mapping.

What a **from-scratch capture client** on the Data module cannot do
today without hand-joining the mirror tables:

- Render an aggregate entry form (needs `dataSet` → `dataSetElement`
  → `categoryCombo` → `categoryOptionCombo` → `optionSet` joined into
  one shape).
- Render an event / tracker stage form (`programStage` →
  `programStageDataElement` → `dataElement` → `optionSet`).
- Discover a program's `trackedEntityType`, searchable attributes, or
  the enrollments + events a TEI already has.
- Prefetch existing cell values for an edit, keyed the way the form
  renders them (`<de>|<coc>` map, not the DHIS2 bulk envelope).

The gap is uniformly **form-assembly** — projecting the metadata the
DHIS2 module already mirrors (plus existing row data from the
Synchronisation module's journal / entity tables) into a client-
renderable shape in one round-trip.

The existing write + bulk-read endpoints under `/api/*` stay
DHIS2-wire-compatible (ADR-0004's drop-in-emulator property). The new
endpoints are DER-native Data-module convenience views and live under
`/edge-api/v1/capture/` — consistent with the ADR-0033 split (`/api/*`
= DHIS2-wire, `/edge-api/v1/*` = DER-native).

## Decision

Add a `CaptureFormController` family under `/edge-api/v1/capture/` in
the **Data** module that projects the DHIS2-module metadata mirror
into flat, client-renderable schemas plus thin per-modality read
helpers that prefetch existing values keyed the way the form consumes
them. Three phases; defer a dedicated client-facing rules evaluation
endpoint (ADR-0007 already covers the write path, see *Alternatives*).

### Phase 1 — Aggregate form (SMALL)

```
GET /edge-api/v1/capture/datasets/{dataSetUid}/form
    → { dataSetUid, displayName, periodType, formType,
        sections: [{ sectionUid?, displayName,
          fields: [{ dataElementUid, displayName, valueType,
                     optionSetUid?,
                     categoryOptionCombos: [{ cocUid, displayName }]
                   }] }] }

GET /edge-api/v1/capture/datasets/{dataSetUid}/data
      ?orgUnit=<uid>&period=<ISO>
    → { cells: { "<de>|<coc>": "<value>" }, lastUpdatedAt }
```

Joins `metadata_data_set` × `metadata_data_element` ×
`metadata_category_option_combo` × `metadata_option_set`; `/data`
reads the Synchronisation module's `aggregate_data_value` by
compound key.

### Phase 2 — Event / stage form + list (MEDIUM)

```
GET /edge-api/v1/capture/programs/{programUid}/stages
    → [{ stageUid, displayName, repeatable, sortOrder }]

GET /edge-api/v1/capture/programs/{programUid}/stages/{stageUid}/form
    → { stageUid, repeatable,
        sections: [{ displayName,
          fields: [{ dataElementUid, displayName, valueType,
                     optionSetUid?, mandatory }] }] }

GET /edge-api/v1/capture/programs/{programUid}/events
      ?orgUnit=<uid>&from=<ISO>&to=<ISO>&limit=<n>
    → { events: [{ eventUid, programStageUid, orgUnitUid,
                   occurredAt, status, lastUpdatedAt }], nextCursor }

GET /edge-api/v1/capture/events/{eventUid}/detail
    → { event: {...}, dataValues: {"<de>": "<value>"},
        enrollment?: {...}, trackedEntity?: {...} }
```

### Phase 3 — Tracker reads (MEDIUM)

```
GET /edge-api/v1/capture/trackedEntityTypes/{uid}/attributes
    → [{ attributeUid, displayName, valueType, optionSetUid?,
          searchable, mandatoryOnCreate }]

GET /edge-api/v1/capture/programs/{uid}/trackedEntityType
    → { trackedEntityTypeUid }

GET /edge-api/v1/capture/trackedEntities/{teiUid}/enrollments
      ?programUid=<uid>
    → [{ enrollmentUid, programUid, status, enrolledAt, lastUpdatedAt }]

GET /edge-api/v1/capture/enrollments/{enrollmentUid}/events
      ?programStageUid=<uid>
    → [{ eventUid, programStageUid, occurredAt, status, lastUpdatedAt }]
```

### Response and error shape

- All envelopes are `application/json`.
- Metadata not found → `404` `{code, message}`.
- Missing / invalid required param → `400`
  `{code: "CAPTURE_PARAM_INVALID", message}`.
- Edge metadata not yet synced from central → `503`
  `{code: "METADATA_NOT_READY", message}` so the client can surface
  "sync has not yet pulled this program" instead of a stack trace.
  The Synchronisation module's status already drives the admin-ui
  *Sync overview* screen; the client can poll the same signal.
- List paging follows the EA-29 pattern: keyset `nextCursor`,
  absent when exhausted. Reuses the same base64-url
  `<observedAt>|<id>` encoding where ordering is temporal.

### Authorisation (Administration module)

- All read endpoints require an authenticated session (role gate on
  every DER controller, enforced by `SecurityConfig`).
- A new fine-grained authority `der.capture.read` is added to the
  authority catalogue. Built-in roles (ADMIN, OPERATOR, REVIEWER,
  SYNC_WORKER) receive it automatically on upgrade through a Flyway
  seed (V089); the admin-ui Roles screen already lets admins grant it
  to custom roles.
- Per-OU scoping is out of scope — tracked under the broader
  permission-policy initiative previously deferred.

### Data-module workflow linkage (optional)

When the captures originate inside an ADR-0018 workflow run, the
client may pass `workflowRunId=<uuid>` on the write side (already
supported by every write endpoint). The form endpoints themselves
are workflow-agnostic — they resolve against the same metadata
mirror whether the capture happens in a free-standing form or inside
a workflow step.

## Alternatives considered

- **Proxy to central for every form fetch.** Breaks the offline-first
  contract baked into ADR-0004 (hybrid emulation). The DHIS2 module
  mirrors metadata precisely so forms render without central; the
  capture API must honour that.
- **Client-side joins against the raw `/api/*` metadata list
  endpoints.** Technically works — every table is reachable — but
  every client re-implements the same five-table join and stays
  coupled to the underlying schema. Form assembly in one endpoint
  lets us evolve `metadata_*` shapes (V089+) without bumping every
  client.
- **Single catch-all `GET /capture/forms?type=...&uid=...`.** Avoids
  the REST path tree but loses URL-as-documentation; harder to cache
  per-resource and harder to express in OpenAPI.
- **New client-facing rules evaluation endpoint
  (`POST /capture/.../evaluateRules`).** Rejected for this ADR.
  ADR-0007 already builds a server-side Java rules engine that runs
  on every write; write-blocking actions (ASSIGN, SHOWERROR,
  ERRORONCOMPLETE, SETMANDATORYFIELD, WARNINGONCOMPLETE) fire there
  and surface as import-summary conflicts. UI-only actions
  (HIDEFIELD, HIDESECTION, HIDEPROGRAMSTAGE, DISPLAYTEXT,
  DISPLAYKEYVALUEPAIR, CREATEEVENT) are deliberately client-side —
  the rules + rule-actions are already mirrored at `metadata_*` so
  the client can run a lightweight interpreter against the
  mirrored rules + the field-change signal. Exposing the engine as
  an endpoint would duplicate the write-path logic and introduce a
  round-trip per field change; revisit as a separate ADR only if a
  thin client (e.g. embedded Android build that drops its rules
  runtime) needs it.
- **Serve forms through the DHIS2 custom-app engine (`/dhis-web-…`).**
  Mixes operator-facing DER capture flow with the DHIS2 app
  simulation layer. Keep concerns separated (same reasoning as
  ADR-0033 for the admin UI).

## Consequences

- **Data module gains a first-class server surface** aligned with the
  client's offline-first rendering needs. The existing `/api/*`
  DHIS2-wire endpoints remain untouched — any existing DHIS2 client
  (Android Capture, curl, bulk upload) keeps working through the
  ADR-0004 emulator path.
- **DHIS2 module becomes a hard dependency in-flight.** A fresh edge
  with no mirrored metadata will 503 `METADATA_NOT_READY` on every
  `/capture/*` request until `MetadataSyncService` completes a first
  pull. The admin-ui's *Sync overview* already surfaces mirror
  readiness.
- **Synchronisation module stays the single write path.** Captures
  through `/capture/*` *read* only; writes keep going through the
  existing `/api/*` and `/edge-api/v1/tracker/*` endpoints that
  already journal → drain → central. ADR-0034 (inbound pull) and
  ADR-0035 (pull-write interlock) continue to govern reconciliation.
- **Program-rule evaluation stays split.** Write-blocking rules fire
  server-side (ADR-0007); UI-affecting rules run client-side against
  the mirrored program-rule metadata. Clients get consistent write
  outcomes regardless of their rules runtime.
- **Administration module adds one authority** (`der.capture.read`)
  seeded onto every built-in role. Pre-upgrade custom roles must be
  granted the authority explicitly; the admin-ui's Roles screen is
  the configuration surface.
- **Test scope grows.** Each phase adds ~200 LOC of controller +
  repository code and 6-10 WebMvcTest cases. Existing DHIS2-proxy
  and emulator coverage is unchanged.
- **Workflow linkage is additive.** Captures inside an ADR-0018
  workflow run keep their `workflow_run_id` lineage because that
  field is set on the write side, not on form assembly.

## Verification

Per phase, before marking complete:

- Controller test (WebMvcTest) covers happy path, not-found,
  `METADATA_NOT_READY`, auth rejection, and response-shape contract.
- Repository test covers the join logic against a seeded set of
  mirror rows.
- Live-verify against the local DHIS2 2.44-SNAPSHOT: pull metadata,
  GET form, submit via the existing write endpoint, GET data back,
  confirm the cell map round-trips.
- Evidence bundle at
  `docs/evaluation/evidence/<commit>/capture-phase-<n>/` (same
  pattern as ADR-0034's inbound-pull evidence).
- Gate 33/33 PASS.
