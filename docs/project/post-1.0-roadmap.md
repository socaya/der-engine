# DER post-1.0 roadmap

> **Status:** Planning document. No ADRs are accepted here — this file
> scopes **nine** new initiatives, surfaces the architectural decisions
> each one forces, and proposes a release sequence. Each initiative
> becomes a real ADR + phase plan when the maintainer approves its
> scope.
>
> **Dated:** 2026-10-22, against `der-1.0.0-rc.1`.

## Where we are

`der-1.0.0-rc.1` ships the ten phases in `docs/releases/`. The pilot
acceptance evidence bundle (Phase 09, §11 of the pilot runbook) is the
sole remaining gate for stable `der-1.0.0`. Everything on this page
sits **after** that cut.

The nine initiatives on this page push past the hub-and-spoke edge
topology that ADR-0004 established. Three of them (peer-to-peer chains,
Android client, DHIS2 broadcast agent) are large enough to deserve
their own major-version bump; the others fit into one or two
minor-version releases on top of 1.0.

Initiative 10 — DER-defined capture workflow configuration — is the
largest conceptual addition. It lets edge admins compose capture
workflows that **DHIS2 does not natively model** (section-level
owners, cross-form dependencies, local-only approval chains) and
re-aligns the captured data to DHIS2's native shape at drain time.
This is the core enabler for the "distributed DHIS2 workflows"
narrative in the project proposal.

---

## 1.0.0 remaining gates — status

Four of the five 1.0.0 gaps landed in `der-1.0.0-rc.2`. Only **G1**
remains blocking stable `der-1.0.0`.

| # | Gap | Status | Shipped in |
|---|---|---|---|
| G1 | Pilot acceptance evidence bundle on real hardware | **OPEN — people-and-hardware step** | — |
| G2 | Server JaCoCo waivers | ✅ Done — 7 excluded classes → 1 (`BackupWorker` only; lift at `der-1.1.0` with Testcontainers-Postgres) | rc.2 |
| G3 | Client Vitest thresholds | ✅ Done — 97/85/84/97 → 99/94/95/99; every file ≥ 100% line + statement | rc.2 |
| G4 | admin-ui Vitest thresholds | ✅ Done — 75/70/55/75 → 100/91/99/100; new suites for `edgeApi`, `AuthContext`, `RequireAuth`, `App` routing | rc.2 |
| G5 | Playwright E2E per screen | ✅ Done (shipped-component subset) — 18 DC + 19 EA specs via `page.route()` mocking; the 17 EA register IDs bundled into siblings per Phase 06 share their parent's spec | rc.2 |

**To cut stable `der-1.0.0`:** pilot operator produces the acceptance
evidence bundle at `docs/evaluation/evidence/phase-09/<run>/` by running
`scripts/evaluation/run_phase_08.sh` on the pilot host; the bundle
must clear NFR-15 p95 ≤ 2 s @ c=20, NFR-17 drain-to-zero for 100 and
1000 ops, NFR-18 RSS ≤ 2 GB, NFR-29 backup round-trip match. Then
`der-1.0.0` cuts from `der-1.0.0-rc.2` with no code changes.

---

## Initiative 1 — Edge device-client management

**Current state.** Phase 02 shipped user-level provisioning. A "device"
today is just a logged-in browser session; there is no first-class
device-identity concept, no enrolment approval, no fleet view.

**Gap, per your ask.** Enrol site-level clients, express workflow
dependencies between them, approve/monitor from the admin UI.

**Proposed shape.**

- New Flyway `V012__phase10_device_management.sql`:
  - `edge_device(device_id UUID PK, assigned_user_id FK, enrolment_token_hash, enrolled_at, approved_by, approved_at, last_seen_at, user_agent, firmware_version, status TEXT CHECK IN ('PENDING','APPROVED','SUSPENDED','REVOKED'))`.
  - `edge_device_dependency(device_id FK, depends_on_device_id FK, dependency_kind TEXT CHECK IN ('APPROVES','FORWARDS','SUPERVISES'))`.
- Server surface: `/edge-api/v1/devices/{enroll,approve,heartbeat,list,{id}}` under role `ADMIN` (approve/revoke) and `OPERATOR` (self-heartbeat).
- Admin screens: `EA-07/EA-08` already exist as scheduler views; add two new ones (`EA-DVC-01` fleet list + approval, `EA-DVC-02` dependency editor).
- Device-client: on first launch, generate an installation UUID, submit `POST /devices/enroll` with a short-lived operator token; display "awaiting approval" until the admin approves.

**Decisions needed.**

1. **Device identity source.** Installation UUID generated at first launch (easy; survives nothing), hardware fingerprint (fragile; privacy issues), or a per-device TLS client certificate signed by the edge (strong; needs cert distribution)?
2. **Approval model.** Auto-approve from a configured LAN CIDR (fast pilot, lower assurance) or require admin click-through for every device (slow, high assurance)?
3. **"Workflow dependencies"** — concrete semantics. Does "A depends on B" mean (a) A's drafts don't drain until B signs off (approval chain), (b) A can only submit when B is online (reachability), or (c) B gets notified when A commits (fan-out notification)? Each one is a different implementation; a single DEPENDENCY_KIND enum covers them if we design for all three up front.

**Effort.** Phase 10 (one minor release — `der-1.1.0-alpha.1`).
Prerequisite for Initiative 3 (peer-to-peer chains) and interacts
tightly with Initiative 4 (approval).

---

## Initiative 2 — Central → edge broadcast (DHIS2 Edge Agent)

**Current state.** ADR-0008: edge pulls metadata on cron every 4 hours
+ on-demand via `/sync/metadata`. The central DHIS2 cannot push.

**Gap.** When a metadata change happens centrally (new dataSet, program
rule edit, user disabled), connected edges should learn about it in
seconds, not hours.

**Options.**

| | Edge long-poll | DHIS2 app agent + webhook | Pull-only (status quo) | Full event bus |
|---|---|---|---|---|
| Central changes | None | Install Agent as a DHIS2 Core app or server plugin | None | Add NATS/Kafka to central |
| Edge changes | Keep an open HTTP connection to central | New `/edge-api/v1/sync/notify` receiver | None | Edge becomes a subscriber |
| Delivery guarantee | Best effort | At-least-once (idempotent via metadata version) | Pull-only; up to 4 h stale | At-least-once |
| Install cost | Low | Medium (new DHIS2 app to maintain) | Zero | High |
| Falls back when WAN flaps | Yes — resumes on reconnect | Yes — edge still pulls on cron | — | Depends on broker config |

**Recommendation.** DHIS2 Edge App Agent (option B). Lives as a DHIS2
Core app (`dhis-web-der-agent/`) built with the DHIS2 app platform;
runs server-side listeners (metadata-change hooks), maintains an edge
registry, fans out webhook calls to each registered edge, retries with
exponential backoff. Edge receives on `/edge-api/v1/sync/notify`,
which schedules an immediate `MetadataSyncJob` fire with the specific
object IDs. Pull cron stays as a safety net exactly like
`BackupDrainJob` (lesson from Phase 07 perf fix).

**Decisions needed.**

1. **Agent runtime.** DHIS2 Core server plugin (Java, deep access to
   AuditedObject lifecycle hooks) vs. DHIS2 app-platform JS app
   (sandboxed, easier to install, limited event hooks)? Server plugin
   wins on correctness; app wins on install ease.
2. **Registration flow.** How does an edge enrol with the Agent?
   Admin pastes a bootstrap URL + token, or Agent discovers via a
   service registry entry we add to DER's startup?
3. **Delivery guarantees.** Idempotent by metadata-object version
   (DHIS2 already carries `lastUpdated`) — do we accept at-least-once
   and dedupe on the edge, or try for exactly-once with ack rounds?

**Effort.** Phase 11+ (two major-version chunks):
- `der-1.3.0` ships the Edge App Agent as its own repository, under
  `agents/dhis2-edge-agent/`.
- `der-1.4.0` wires the edge-side `/sync/notify` receiver.

---

## Initiative 3 — Peer-to-peer workflow chains (A → B → C → D → E)

**Current state.** Hub-and-spoke (ADR-0004). Edges never talk to each
other; central is the only hub.

**Gap, per your ask.** Workflow devices form a chain — e.g. community
health worker → facility nurse → district pharmacy → regional lab →
referral hospital. Each hop pairs with the next; data flows along the
chain without round-tripping to central.

**This is a major architectural change.** Three different shapes fit
your description, and the right one depends on the actual workflow:

| Shape | Example use case | Topology |
|---|---|---|
| **A. Chain-via-hub** | Referral records that must land at central eventually | A tags record with `next_hop=B`; A → central → B pulls records targeted at itself. Zero direct edge-edge contact. |
| **B. Direct TLS mesh** | On-premises LAN of edges in a hospital with no reliable WAN | A — mTLS → B — mTLS → C. Each edge is a mini client-and-server. Pairing is a mutual-trust ceremony stored in a `peer_edge` table. |
| **C. Local MQTT broker** | Supply chain where many devices subscribe to the same topic | A publishes to `facility/orgUnit/next-hop`; B subscribes; broker-mediated. Needs a broker daemon on the LAN. |

**Decisions needed before scoping.**

1. **Topology choice.** A, B, or C? Each has fundamentally different
   security + ops implications.
2. **Pairing authority.** Who approves A↔B pairing — the central
   admin at one site, both edges simultaneously (double opt-in), or
   out-of-band (QR code scanned in person)?
3. **Scope of data flowing P2P.** Just workflow records (the referral
   case / lab result), or does metadata flow P2P too? If just records,
   the design is a lot simpler.
4. **Conflict precedence when P2P and central disagree.** If A writes
   X, forwards to B, and central's copy from B's drain diverges from
   central's copy from A's drain — who wins?

**Risk.** This is a bigger shift than Phase 07 was. ADR-0004 was
chosen specifically because hub-and-spoke keeps the audit chain
simple. Direct edge-edge adds a lot of attack surface and the
conflict-resolution matrix multiplies.

**Recommendation.** Start with option A (chain-via-hub) in Phase 10 —
it works with the existing journal, needs only a `next_hop` column on
operation_journal, and matches 80% of referral workflows I've seen in
DHIS2 country deployments. Option B goes to Phase 12 as a design
spike with a formal ADR.

**Effort.** Option A: Phase 10 (one minor release). Option B / C:
Phase 12+ pending design spike.

---

## Initiative 4 — Data approval + sync workflows

**Current state.** Journal drains every committed operation
automatically (ADR-0010). No approval gate.

**Gap, per your ask.** When enabled, sync waits for approval.

**Proposed shape.**

- Flyway `V013__phase10_approval.sql`:
  - `operation_journal` adds `requires_approval BOOLEAN`,
    `approved_by UUID`, `approved_at TIMESTAMPTZ`, `rejected_by UUID`,
    `rejected_at TIMESTAMPTZ`, `rejection_reason TEXT`.
- `JournalWorker.drainBatch` SQL filter adds
  `AND (requires_approval = FALSE OR approved_at IS NOT NULL)`.
- Config: `der.sync.require-approval.{aggregate,event,tracker}=bool`.
  Default: all false (backwards compatible).
- New `APPROVER` role; `/edge-api/v1/journal/pending-approval` list +
  `/approve/{id}` + `/reject/{id}` endpoints.
- Admin screen `EA-APR-01` — pending-approval queue (bundled into
  EACoreScreens.tsx).

**Decisions needed.**

1. **Approver identity.** New role `APPROVER` separate from `ADMIN`,
   or just reuse `ADMIN`? Separate role is better separation-of-duties
   but is more complexity.
2. **Approval triggers.** Config-level toggle (`require-approval
   for all events`), per-programme flag pulled from DHIS2 metadata, or
   data-element threshold rule (e.g. "require approval if value >
   100")? The threshold rule overlaps with program rules — tempting
   to re-use ADR-0007 engine for this.
3. **Reject semantics.** Does rejection remove the record locally
   (undo), re-journal it with a correction, or just mark it rejected
   and leave the local commit untouched?

**Effort.** Phase 10 (one minor release — `der-1.1.0-alpha.2`).

---

## Initiative 5 — Edge-to-single-orgUnit binding (with UI)

**Current state.** V001 shipped the `edge_node` singleton table with
`display_name` and `site_name`, but **no `org_unit` column**. Any
site_name is accepted. There is no OU picker during setup.

**Gap, per your ask.** Each edge must be registered to **exactly one**
orgUnit, obtained from central DHIS2 at setup.

**Proposed shape.**

- Flyway `V012__phase10_orgunit_binding.sql`:
  - `ALTER TABLE edge_node ADD COLUMN org_unit_id TEXT`.
  - `ALTER TABLE edge_node ADD COLUMN org_unit_display_name TEXT`.
  - `ALTER TABLE edge_node ADD COLUMN org_unit_path TEXT` (the DHIS2
    `/path` for ancestor-aware authz).
- `OrgUnitBindingService` — resolves and persists the OU; subsequent
  writes carry OU authz checks against this binding.
- EA-01 "Setup welcome" (currently inside `EACoreScreens.tsx`) gets a
  live orgUnit picker — reads `/api/organisationUnits?paging=false&
  fields=id,displayName,path,level` from central, offers a tree
  selector, writes the chosen OU to `edge_node`.
- Server-side guard: all aggregate / event / tracker writes reject
  with HTTP 403 if the payload's `orgUnit` is not under
  `edge_node.org_unit_path`.

**Decisions needed.**

1. **Sub-tree vs. leaf.** Can an edge serve its OU + descendants
   (e.g. a clinic + its outreach posts), or exactly one leaf OU? I'd
   recommend sub-tree with a `max_depth` cap, matching how DHIS2 scopes
   its own user OU auth.
2. **Change-of-OU.** Rebind requires wiping the local store (new OU =
   different data scope)? Or allow one rebind inside a maintenance
   window with an audit entry?
3. **Enforcement timing.** The OU check runs at the service layer
   (fast) or at an interceptor (safe for all paths including custom
   DHIS2 apps installed via ADR-0005). Interceptor is safer.

**Effort.** Phase 10 (half of one minor release — `der-1.1.0-alpha.3`).
Smallest of the eight initiatives.

---

## Initiative 6 — Android Edge Client App

**Current state.** The device-client is a React 18 / `@dhis2/ui` SPA
in `client/`. Browser-only; no installable artefact.

**Gap, per your ask.** A native-feeling Android client (tablets +
phones) that respects the existing DC-01..DC-18 UI contract and the
ADR-0005 custom-app hosting.

**Options.**

| | Capacitor wrap | React Native | Native Kotlin + Compose | Flutter |
|---|---|---|---|---|
| Shares code with current client | ~95% (reuses SPA bundle) | ~60% (ports React) | 0% (new codebase) | 0% (new codebase) |
| Native UX fidelity | Low (webview) | High | Highest | High |
| APK size | Medium (webview + bundle) | Medium | Smallest | Medium |
| Camera / scanner / BT | Via plugins | Via native modules | Direct | Via plugins |
| Offline-sync queue reuse | Reuses browser `IndexedDB` | Need to port | New Room DB | New sqflite DB |
| Time-to-APK | Days | Weeks | Months | Months |

**Recommendation.** Phase A — Capacitor wrap of the existing `client/`
SPA. Shippable in days; gives a side-loadable APK for pilot
operators; retains all 18 DC screens and ADR-0005 custom apps.
Phase B (post-pilot) — lift the hot paths to native Kotlin (camera
capture, large-form data entry) if NFR evidence shows the webview is a
bottleneck.

**Decisions needed.**

1. **Target API level.** Android 10+ (API 29, 95%+ of in-service
   devices) or Android 8+ (API 26, matches most government kiosks)?
2. **Distribution.** Play Store (requires certification + ongoing
   compliance work), MDM push (Scalefusion / Mobile Iron / in-country
   solution), or sideload APK (simplest, lowest assurance)?
3. **Device policy.** Lock to kiosk mode, allow user-installed apps,
   or treat as a general-purpose device? Interacts with Initiative 1.
4. **Camera / barcode / fingerprint.** Phase 06 DC screens don't use
   any of these; Initiative 6 is the chance to add them. In-scope
   or Phase B?

**Effort.** Phase 13 (`der-2.0.0-alpha.1`) for Capacitor wrap. Phase
14+ for native lift.

---

## Initiative 7 — DER site-level analytics engine

**Current state.** Journal + aggregate + event tables hold local data,
exposed through DHIS2-shaped read endpoints. No analytics layer; a
clinic cannot see "my coverage this month" without going to central.

**Proposed shape.**

- Flyway `V014__phase11_analytics_views.sql`:
  - Materialised views over `aggregate_data_value` (coverage %),
    `event` (completion timeliness), `tracker_entity` (enrolment flow).
  - Refresh on an aggressive cron (default every 5 min) via a new
    `AnalyticsRefreshJob` Quartz job.
- `/edge-api/v1/analytics/{coverage,timeliness,quality}` read endpoints.
- Admin screens: `EA-ANA-01` dashboard with coverage / timeliness /
  quality cards and a configurable date range.
- Chart library: `recharts` (already in the admin-ui dep tree via
  `@dhis2/ui`? verify) — small bundle, declarative.

**Decisions needed.**

1. **Which analytics domains ship first?** Coverage % by dataset is
   the easiest; data-quality rules + timeliness come next; completeness
   is already in DHIS2's domain so maybe skip.
2. **Who sees analytics.** Operators and admins, or admins only? And
   does the device-client get an analytics tile too, or is this
   admin-only?
3. **Refresh cadence.** 5 min default is cheap; some facilities will
   want near-live.

**Effort.** Phase 11 (one minor release — `der-1.2.0-alpha.1`).

---

## Initiative 8 — Edge data security hardening

**Current state (strengths).** Argon2id password hashing; opaque hashed
sessions; Spring Security role matrix; `security_audit` append-only
JSONB; env-driven secrets; rate limiter; TLS termination via the
documented runbook.

**Gaps versus what you asked for.**

| Gap | Fix | Priority |
|---|---|---|
| No at-rest encryption for `~/.der/backups/` (ADR-0012 explicit non-goal) | Wrap pg_dump pipe in `openssl enc -aes-256-gcm`; publish keys via `/etc/der/pilot.env` and KMS later | P0 for 1.1 |
| HTTPS not enforced by the server (acceptable per LAN pilot runbook) | Add `der.security.require-tls=true` config that rejects HTTP in prod profiles | P0 for 1.1 |
| No MFA on admin sign-in | TOTP via a Spring Security add-on | P1 — 1.3 |
| PII in server logs when payloads log at WARN+ | Introduce a `@PiiSafe` log adapter; mask known fields | P0 for 1.1 |
| `security_audit` is append-only but not tamper-evident | Hash-chain each row (`prev_hash` column) | P1 — 1.2 |
| Backup archives on S3 unencrypted at rest | Document GPG wrapping; add `der.backup.remote.encrypt=true` | P1 — 1.2 |
| No automated secret rotation | Phase 15+ with a KMS; manual rotation documented today | P2 |

**Decisions needed.**

1. **TLS enforcement in prod profile.** Hard-fail the service start
   if `require-tls=true` and no cert configured, or warn?
2. **Encryption-at-rest key management.** Simple env-var key (today's
   `.env`), separate key file with 0400 perms, or a KMS integration
   (Vault / AWS KMS)? KMS is the right answer long-term but is a
   whole-ass initiative on its own.
3. **MFA scope.** Admins only or all users? And TOTP (standard but
   needs enrollment UX) vs. WebAuthn (hardware keys, higher
   assurance, pilot operators may lack hardware).

**Effort.** Split across phases:
- Phase 10 (`der-1.1.0`): TLS enforcement, PII log masking, archive
  at-rest encryption.
- Phase 11 (`der-1.2.0`): hash-chained security_audit, S3 GPG wrap.
- Phase 13 (`der-1.3.0`): MFA.

---

## Initiative 10 — DER capture-workflow configuration management

**Current state.** DER mirrors DHIS2 metadata (datasets, programs,
sections, program stages, categoryOptionCombos) via ADR-0006/0008 and
executes program rules at the edge via ADR-0007. The capture surface
is one-to-one with DHIS2's: a dataset is a form, a program stage is a
set of events, a section is a visual grouping.

**Gap, per your ask.** DHIS2 does not model *distributed capture
workflows* — the common clinic reality where one person captures the
dataset's "antenatal" section, hands it to a second person who
captures "laboratory", who passes to a third for "pharmacy", with
cross-section field dependencies and a sign-off step that doesn't
exist upstream. The project proposal frames this as the core
"distributed DHIS2 workflow" problem. DER needs an edge-only
configuration layer that composes DHIS2 metadata into these
workflows and transparently re-aligns the data at drain time so the
central DHIS2 sees exactly the shape it expects.

**Proposed shape.**

- Flyway `V015__phase11_capture_workflow_config.sql`:
  - `capture_workflow(workflow_id UUID PK, display_name, bound_metadata_kind TEXT CHECK IN ('DATA_SET','PROGRAM','PROGRAM_STAGE'), bound_metadata_id TEXT, enabled BOOL, created_at, updated_at)` — one workflow per DHIS2 metadata object the admin chooses to augment.
  - `capture_workflow_step(step_id UUID PK, workflow_id FK, ordinal INT, display_name, owner_role TEXT, owner_device_id FK?, section_filter JSONB, step_kind TEXT CHECK IN ('CAPTURE','REVIEW','APPROVE','DISPATCH'))` — ordered steps per workflow, each scoped to a subset of fields/sections.
  - `capture_workflow_field(step_id FK, field_ref TEXT, requirement TEXT CHECK IN ('REQUIRED','OPTIONAL','READONLY','HIDDEN'))` — per-step overrides on top of the DHIS2 metadata.
  - `capture_workflow_dependency(step_id FK, depends_on_step_id FK, dependency_kind TEXT CHECK IN ('COMPLETES_BEFORE','VALUE_EQ','VALUE_GT','ANY_VALUE'))` — cross-step predicates that gate advancement.
  - `capture_workflow_run(run_id UUID PK, workflow_id FK, business_key TEXT, current_step_id FK, state TEXT CHECK IN ('OPEN','AWAITING','COMPLETED','REJECTED'), created_at, updated_at)` — one row per in-flight workflow instance (one dataValueSet / event / enrollment).
- `CaptureWorkflowService` — resolves the applicable workflow for an
  incoming write; routes the write to the correct step; blocks drain
  until the final step reaches `COMPLETED`.
- `CaptureWorkflowReconciler` — the drain-time re-alignment layer.
  Takes an `OPERATION_JOURNAL` row that originated inside a workflow
  and projects it onto DHIS2's native shape (collapses per-step field
  partitions back into a single dataValueSet / event payload). Writes
  the reconciled version to the journal publisher; the pre-reconciled
  version stays local only.
- Admin screens (bundled into `EACoreScreens.tsx`):
  - `EA-CWF-01` — Workflow catalogue (list, enable/disable).
  - `EA-CWF-02` — Workflow designer (pick DHIS2 metadata binding, add
    steps, assign owners, draw dependencies).
  - `EA-CWF-03` — In-flight workflow runs (operational monitor).
- Device-client (`client/src/screens/`):
  - `DC-CWF-01` — My step (shows only the fields the current step
    covers; blocks until predecessors complete).
  - `DC-CWF-02` — Hand-off (dispatches a workflow run to the next
    owner — pairs with Initiative 1 device management and Initiative 3
    peer-to-peer chains).

### Why this interacts with existing initiatives

- **Initiative 1 (device management)** — owner_device_id on a
  workflow step uses the device identity Initiative 1 introduces.
  Workflows are therefore a hard prerequisite for the full
  device-oriented workflow experience; a reduced form of workflows
  that uses only `owner_role` ships first.
- **Initiative 3 (peer-to-peer chains)** — the A → B → C → D → E
  chain is a workflow with four `DISPATCH` steps. Initiative 10
  defines the model; Initiative 3 provides the transport.
- **Initiative 4 (data approval)** — an `APPROVE` step is the same
  construct as the approval queue in Initiative 4. Unify by making
  Initiative 4's approval queue the UI for workflows that contain
  exactly one `APPROVE` step.

### Why re-alignment matters

The project proposal's distributed-workflow story only works if the
upstream DHIS2 server doesn't need any changes. The reconciler's job
is to make every acknowledged edge commit indistinguishable from a
single-user commit to central. Specifically:

- Multiple capture steps compose into a single dataValueSet with the
  union of all step contributions.
- A step that marks a field `HIDDEN` writes DHIS2's "no value"
  encoding (empty-string + comment) rather than a null-vs-missing
  distinction that DHIS2 doesn't model.
- Local-only `REVIEW` / `APPROVE` steps produce no payload — they
  only gate the drain.

### Decisions needed

1. **Workflow binding granularity.** Bind workflows to a dataset,
   dataset section, program, program stage, or any of them? The DB
   schema above supports all four; the UI complexity doubles if we
   expose every combination.
2. **Section flexibility.** You wrote "could dataset sections, etc.,
   BE very flexible across all DHIS2 Metadata." Confirm the intent is
   that one DER workflow can span **multiple** DHIS2 objects (e.g.
   capture an aggregate section + a related program event in the
   same workflow), or stay within one metadata root?
3. **Workflow authoring role.** Any `ADMIN` can define a workflow, or
   introduce a dedicated `WORKFLOW_DESIGNER` role so facility
   operators can author without full admin rights?
4. **Reconciler failure semantics.** If the reconciler cannot project
   a workflow run onto DHIS2's shape (e.g. a workflow allowed values
   DHIS2 would reject), does the run (a) stay OPEN and surface in
   EA-14-style conflict review, (b) auto-rollback locally, or (c)
   drain with a loss-of-fidelity note?
5. **Workflow versioning.** If the admin edits a workflow mid-flight,
   do in-flight runs keep the old definition or migrate to the new
   one? Mid-flight migration is a non-trivial reconciliation problem.
6. **Workflow export/import.** Should workflows be portable between
   edges (ship a JSON definition that another edge imports), or stay
   edge-local? Portability enables fleet-wide standardisation but
   needs schema stability guarantees.
7. **Workflow priority when DHIS2 metadata changes.** If a dataset
   section is removed centrally mid-flight, does the workflow still
   use it (grace period) or abort the run? Interacts with ADR-0006
   compat engine's drift surface.

### Effort

Phase 11 (first slice) and Phase 12 (full) — one major release:
- **`der-1.2.0-alpha.1`** — schema + CaptureWorkflowService (role-based
  owners only; no device-level owners); workflow designer EA-CWF-01/02;
  single-metadata-root bindings only; reconciler for aggregate
  dataValueSets.
- **`der-1.2.0-alpha.2`** — device-level owners (post-Initiative 1);
  cross-metadata bindings; reconciler for events + tracker; workflow
  export/import.

This is a **larger** initiative than any single prior phase — on
the order of Phase 05 (scheduler + drift + conflict review combined).
Breaking it into two alpha slices keeps the review surface tractable.

---

## Initiative 9 — Playwright per-screen E2E suite (mostly done in rc.2)

The main per-screen E2E suite landed in `der-1.0.0-rc.2` ahead of
schedule — 18 DC specs + 19 EA specs via `page.route()` mocking,
replacing the stale Phase 00 smoke specs.

**Remaining work:**

1. **Lift to mandatory in `scripts/run_all_checks.sh`.** Playwright is
   currently invoked only when `DER_RUN_E2E=true`; the pilot runbook
   pulls it in, but the local gate still records it as "NOT RUN"
   otherwise. Make it mandatory at the `der-1.2.0` cut.
2. **Split the 17 bundled EA register IDs into their own specs.** The
   Phase 06 R2/R3 implementation bundled EA-09/12/13/15/16/17/20..22/
   24/26/28..30/32..34 into their siblings; if pilot feedback splits
   any back out, add their specs then.
3. **Real-browser axe-core sweep.** The specs rely on `page.route()`
   mocks; add `AxeBuilder` assertions once the suite is mandatory.

**Effort.** Half a day for item 1; items 2–3 are driven by pilot
feedback.

---

## Recommended sequence

```
der-1.0.0-rc.2   ← G2/G3/G4/G5 landed (coverage lifts + per-screen Playwright)
    │
    ▼
der-1.0.0        ← pilot acceptance evidence bundle (G1); no code changes
    │
    ▼
der-1.1.0        ← Initiative 5 (orgUnit binding),
                   Initiative 4 (approval workflows),
                   Initiative 8 part 1 (TLS enforce, PII log, backup encrypt),
                   Initiative 9 cleanup (lift Playwright to mandatory,
                     add axe-core sweep)
    │
    ▼
der-1.2.0        ← Initiative 10 slice A (capture workflow config,
                     role-owners, aggregate reconciler),
                   Initiative 1 (device management),
                   Initiative 7 (analytics),
                   Initiative 8 part 2 (hash-chain audit, S3 GPG)
    │
    ▼
der-1.3.0        ← Initiative 10 slice B (device-owners, event/tracker
                     reconciler, workflow import/export),
                   Initiative 2 part 1 (DHIS2 Edge Agent server plugin),
                   Initiative 3 option A (chain-via-hub referral),
                   Initiative 8 part 3 (MFA)
    │
    ▼
der-2.0.0        ← Initiative 6 (Android client — Capacitor wrap),
                   Initiative 2 part 2 (edge-side /sync/notify receiver),
                   Initiative 3 design-spike + option B/C decision
```

---

## Decisions required to unblock Phase 10

A green-light answer to each unlocks the matching initiative. Several
of these are the kind of judgement call that only you can make.

| # | Decision | Blocks |
|---|---|---|
| D1 | OU scope: single leaf OU vs. sub-tree-with-cap? | Initiative 5 |
| D2 | Approval role: new `APPROVER` or reuse `ADMIN`? | Initiative 4 |
| D3 | Approval trigger: config toggle vs. program-rule based? | Initiative 4 |
| D4 | TLS enforcement: hard-fail or warn in prod profile? | Initiative 8 part 1 |
| D5 | Playwright per-screen: fold into stable 1.0.0 or defer to 1.1? | 1.0.0 gate |
| D6 | Device identity source: installation UUID / hardware / cert? | Initiative 1 |
| D7 | Approval model: auto-approve from LAN / manual admin? | Initiative 1 |
| D8 | Workflow-dependency semantics: approval chain / reachability / fan-out notify? | Initiative 1 + 3 |
| D9 | DHIS2 Edge Agent runtime: Core plugin (Java) or app-platform (JS)? | Initiative 2 |
| D10 | P2P topology: A (chain-via-hub) / B (direct mTLS) / C (MQTT broker)? | Initiative 3 |
| D11 | Android: Capacitor wrap first, native later? Confirm. | Initiative 6 |
| D12 | KMS strategy: env-var / 0400 keyfile / Vault / AWS KMS? | Initiative 8 part 1 |
| D13 | Workflow binding granularity: dataset / section / program / stage / any? | Initiative 10 |
| D14 | One workflow spans multiple DHIS2 metadata roots, or stays within one? | Initiative 10 |
| D15 | Dedicated `WORKFLOW_DESIGNER` role or reuse `ADMIN`? | Initiative 10 |
| D16 | Reconciler failure semantics (conflict / rollback / lossy drain)? | Initiative 10 |
| D17 | Workflow versioning (grandfather in-flight runs or migrate)? | Initiative 10 |
| D18 | Workflow export/import across edges? | Initiative 10 |
| D19 | Workflow handling when DHIS2 metadata changes under the workflow? | Initiative 10 |

---

## Scope sanity-check — what this roadmap does **not** promise

- No commitment to all eight landing before the thesis deadline;
  the sequencing above is **~12 months** of work at the current cadence.
- No Docker/Kubernetes packaging (consistent with ADR-0014).
- No multi-tenant hosting; each edge stays single-tenant.
- No DHIS2 Core patches — the Edge Agent app lives in its own repo
  and installs via the DHIS2 app platform.
- No breaking changes to the public `/api/*` or `/edge-api/v1/*`
  contracts without a documented SemVer major bump.
