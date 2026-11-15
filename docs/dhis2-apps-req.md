# DER DHIS2 App Support — Plan & Requirements

**Document ID:** DER-APPS-DHIS2-001
**Status:** ACCEPTED (open decisions D1–D7 resolved 2026-11-15)
**Date:** 2026-11-15
**Related:** ADR-0002 (DHIS2 pin), ADR-0015 (OU binding), ADR-0018 (capture
workflows), ADR-0019 (device management), post-1.0 roadmap Initiative 3 (P2P)

---

## 1. Purpose

Enable both **DHIS2 core apps** (Capture, Tracker, Maintenance, etc.) and
**custom DHIS2 web apps** to run on DER appliances and DER client browsers,
with the offline-first + OU-bound + device-approved guarantees DER already
provides. The host must be transparent to the app — a DHIS2 app running on
DER should not require any awareness that it is not talking directly to
central.

---

## 2. Scope

### In scope
- Hosting of DHIS2 web apps alongside DER-native apps on the same catalogue
  surface
- Automated OU context for DHIS2 apps (no per-app OU-picker friction)
- Offline write absorption for DHIS2 API calls through the existing journal
- Deployment pathway for custom apps (manual upload **and** central auto-sync)
- DHIS2 emulator gap-fill for the config / i18n / tracker-jobs surfaces
  custom apps commonly touch
- Device-approval enforcement extended across both hosting models
- Preservation of workflow step device ownership for the planned
  peer-to-peer data-sharing layer

### Not in scope (deferred)
- P2P data-sharing protocol itself (needs its own ADR + Initiative 3 sitting)
- DHIS2 messaging / interpretations / visualisation APIs (on-demand
  mirroring later)
- Server-side validation rules replay (DHIS2 central runs these; DER
  surfaces conflicts post-hoc)
- Real-time push (SSE, websockets) — DER is poll-based by design
- Multi-user / multi-OU session multiplexing on one appliance (single
  bound OU remains)

---

## 3. Goals / non-goals

### Goals
- A stock DHIS2 custom app downloaded from the DHIS2 App Hub or built by a
  partner team **runs unmodified** on DER after an admin uploads or syncs
  it.
- Operators see **one app launcher** that spans DER-native apps and DHIS2
  apps; the hosting difference is invisible to the operator.
- Writes from DHIS2 apps land in DER's operation journal and sync to
  central transparently — the app receives DHIS2-shaped import summaries
  and never sees DER internals.
- OU context is automatic: a facility-bound appliance exposes one OU
  through `/api/me`; apps default to it without the operator picking from
  a list.
- Device approval (ADR-0019 slice B) covers both DER-native and DHIS2
  hosting paths.
- P2P workflow step ownership remains intact so Initiative 3 can build on
  it.

### Non-goals
- We will **not** try to render DHIS2 apps in the DER-native ESM host;
  architectural mismatch.
- We will **not** mirror DHIS2 central's full API surface. We mirror what
  custom apps actually need, and fail-closed on the rest with a diagnostic
  panel.
- We will **not** support installing DER-native apps on central or
  distributing them through the DHIS2 App Hub.
- We will **not** retire device-ownership from capture workflows — it's
  needed for P2P.

---

## 4. Architecture overview

### Hybrid app dispatcher

```
                 Admin uploads / central auto-sync
                                │
                                ▼
                 AppCatalogueController
                 (detects manifest shape at install time)
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
         DER_ESM (signed bundle)   DHIS2_IFRAME (index.html)
                    │                       │
                    │                       ▼
                    │           AppStaticHandler  (hardened)
                    │           /dhis-web-{appKey}/*
                    │                       │
                    ▼                       ▼
          Client AppHost.tsx         Client IframeHost (new)
          (dynamic import())        (sandboxed <iframe>)
                    │                       │
                    │                       │  app's XHR / fetch
                    │                       ▼
                    │           DER DHIS2 emulator  (/api/*)
                    │                       │
                    │                       │
                    │            ┌──────────┴──────────┐
                    │            │                     │
                    │            ▼                     ▼
                    │     DeviceApproval       OrgUnitScope
                    │     Interceptor          Interceptor
                    │            │                     │
                    │            └──────────┬──────────┘
                    │                       ▼
                    │           DeviceOwner EnforcementInterceptor
                    │                       │
                    ▼                       ▼
         DER-native APIs            DHIS2-shaped responses
         (/edge-api/v1/*)           + operation_journal queue
                                             │
                                             │
                                             ▼
                              Scheduled sync to central
                              (JOURNAL_WORKER_DRAIN)
```

### Catalogue provenance

Every installed app row gains:
- `host_kind: DER_ESM | DHIS2_IFRAME`
- `source: DER_BUILTIN | MANUAL_UPLOAD | CENTRAL_SYNC`
- `trust_level: SIGNED | UNSIGNED` (with per-tenant policy on whether
  UNSIGNED is allowed)
- `installed_at`, `installed_by`, optional `central_app_id`

---

## 5. Functional requirements

### FR-APP — app hosting

| # | Requirement | Priority |
|---|---|---|
| FR-APP-001 | Server detects host kind from the bundle: `derAppManifest` in `package.json` → `DER_ESM`; `manifest.webapp` without `derAppManifest` → `DHIS2_IFRAME` | P1 |
| FR-APP-002 | DHIS2 apps are served from `/dhis-web-{appKey}/*` under the authenticated session, with `index.html` as the entry point | P1 |
| FR-APP-003 | `AppStaticHandler` applies CSP (`default-src 'self'`), `X-Frame-Options: SAMEORIGIN`, and requires the DER session cookie — anonymous access returns 401 | P1 |
| FR-APP-004 | Client renders DHIS2 apps in a `<iframe sandbox="allow-scripts allow-same-origin allow-forms allow-downloads">` frame sized to its container | P1 |
| FR-APP-005 | Device-approval interceptor applies to both `/edge-api/v1/apps/*/bundle.js` and `/dhis-web-*` — unapproved devices get the same `DEVICE_NOT_APPROVED` error | P1 |
| FR-APP-006 | App launcher shows unified catalogue; iframe apps open in the same shell layout as ESM apps (header + content, no second navigation chrome) | P1 |
| FR-APP-007 | Ed25519 signing enforced on `DER_ESM` apps; optional on `DHIS2_IFRAME` apps with per-installation `trust_level` | P2 |
| FR-APP-008 | Uninstall path identical for both host kinds (one admin action removes the catalogue row + the stored bytes) | P2 |

### FR-SYNC — central app sync

| # | Requirement | Priority |
|---|---|---|
| FR-SYNC-001 | New scheduled job `APPS_SYNC_FROM_CENTRAL` runs every N hours when central is reachable (default 6h) | P1 |
| FR-SYNC-002 | Sync job calls `GET /api/apps` on central, enumerates apps, compares against local catalogue by `central_app_id` + version | P1 |
| FR-SYNC-003 | For new / updated apps, fetches bundle bytes + manifest from central and installs via existing `AppCatalogueController` path with `source=CENTRAL_SYNC` | P1 |
| FR-SYNC-004 | Per-tenant allow-list / deny-list of `central_app_id` so admins can scope "these apps auto-sync, these don't" | P2 |
| FR-SYNC-005 | Dry-run mode: list what would sync without installing — first commit ships read-only probe | P1 |
| FR-SYNC-006 | Rollback: if an auto-synced app replaces a prior version, the prior bytes + manifest are retained for 7 days so an admin can revert | P2 |
| FR-SYNC-007 | Audit event `APP_INSTALLED_FROM_CENTRAL` on every auto-sync install, with `central_app_id`, `version`, `sha256` | P1 |
| FR-SYNC-008 | If central signs its app list, DER verifies the signature against a pinned public key before trusting any install | P2 |

### FR-OU — OU context automation

| # | Requirement | Priority |
|---|---|---|
| FR-OU-001 | `MeController.java` populates `organisationUnits: [boundOrgUnit]`, `dataViewOrganisationUnits: [boundOrgUnit]`, `teiSearchOrganisationUnits: [boundOrgUnit]` when a binding exists | P1 |
| FR-OU-002 | When binding is unset, `/api/me` returns empty lists plus a `warnings: ["NO_OU_BOUND"]` shape | P1 |
| FR-OU-003 | `MetadataListController` filters `GET /api/organisationUnits` responses to the bound OU subtree when no explicit filter is given | P1 |
| FR-OU-004 | A DHIS2 app calling `/api/organisationUnits?level=1` still returns the bound OU (not the real root) so facility-picker dropdowns render a single meaningful entry | P1 |
| FR-OU-005 | `scope_assignment` table is wired: admins can narrow a user to a child OU within the bound facility. `/api/me` reflects the narrower scope when present | P2 |
| FR-OU-006 | OU-scope interceptor on writes is unchanged — it already enforces payload OU ∈ bound subtree | P0 (no work) |

### FR-EMU — DHIS2 emulator gap-fill

| # | Requirement | Priority |
|---|---|---|
| FR-EMU-001 | `GET /api/userSettings` + `POST /api/userSettings/{key}` — local per-user key/value store (new `user_setting` table) | P1 |
| FR-EMU-002 | `GET /api/systemSettings` + `POST /api/systemSettings/{key}` — local per-appliance key/value store (new `system_setting` table) | P1 |
| FR-EMU-003 | `GET /api/i18n` returns at least English strings; locale negotiation via `Accept-Language`; non-English languages stub to English with `warnings: ["I18N_FALLBACK"]` | P1 |
| FR-EMU-004 | `POST /api/tracker` returns an async job envelope; `GET /api/tracker/jobs/{id}` reads from the operation journal state and returns DHIS2-shaped job status | P1 |
| FR-EMU-005 | `If-Match` / `ETag` semantics on single-row reads+writes for optimistic concurrency on `/api/events/{id}` and `/api/trackedEntityInstances/{id}` | P2 |
| FR-EMU-006 | `GET /api/schemas` returns at minimum the schemas for data elements, programs, org units, category combos — mirror of what `MetadataListController` serves | P2 |
| FR-EMU-007 | Unmirrored DHIS2 endpoint calls return 404 with a dedicated code `EMULATOR_NOT_IMPLEMENTED` and are logged into a diagnostic panel so admins see what the installed apps actually need | P1 |

### FR-WRITE — write path (mostly already shipped; requirements for completeness)

| # | Requirement | Priority |
|---|---|---|
| FR-WRITE-001 | DHIS2-shaped `ImportSummary` response on `POST /api/dataValueSets` (already shipped) | P0 |
| FR-WRITE-002 | DHIS2-shaped job envelope on `POST /api/tracker`, async status pollable (to complete via FR-EMU-004) | P1 |
| FR-WRITE-003 | Operation journal retains payload + idempotency key + state; sync to central preserves app-provided client references | P0 (shipped) |
| FR-WRITE-004 | Conflict review surface lists central rejections with the originating app + device so operators know which custom-app submission needs attention | P1 |

### FR-WORKFLOW — capture workflow preservation for P2P

| # | Requirement | Priority |
|---|---|---|
| FR-WORKFLOW-001 | `capture_workflow_step.owner_device_id` column retained; `DeviceOwnerEnforcementInterceptor` stays active | P0 (shipped) |
| FR-WORKFLOW-002 | Audit event relabel: `DEVICE_OWNER_MISMATCH` → `WORKFLOW_DEVICE_ROUTING_REJECTED` for clearer operator semantics | P2 |
| FR-WORKFLOW-003 | `DISPATCH` step kind either implemented or formally marked `RESERVED_FOR_FUTURE` in the enum + docs | P2 |
| FR-WORKFLOW-004 | Device-ownership documentation explicitly scoped to P2P data sharing (Initiative 3) in ADR-0018 | P2 |

### FR-DIAG — operator diagnostics

| # | Requirement | Priority |
|---|---|---|
| FR-DIAG-001 | New admin screen `/system/apps` shows every installed app with `host_kind`, `source`, `trust_level`, `installed_at`, `last_opened_at`, provenance | P1 |
| FR-DIAG-002 | Same screen surfaces the DHIS2 emulator's 404 diagnostic log so admins see "appX called `/api/visualizations` 47 times — not mirrored" | P1 |
| FR-DIAG-003 | On an app's install failure, the error card renders a production-ready message (same pattern as the `DEVICE_NOT_APPROVED` error — raw code on `data-error-code`, friendly text in UI) | P1 |

---

## 6. Non-functional requirements

| # | Requirement |
|---|---|
| NFR-APPS-01 | A DHIS2 custom app of up to 20 MB (typical hub app) must install in under 15 s from manual upload, under 60 s from central auto-sync |
| NFR-APPS-02 | Catalogue list must render in under 300 ms even with 50 installed apps |
| NFR-APPS-03 | Iframe host adds no more than 10% overhead vs the ESM host on cold mount time |
| NFR-APPS-04 | Emulator gap-fill (FR-EMU) must not regress the existing `/api/dataValueSets` write p95 latency (currently ~50 ms on dev hardware) |
| NFR-APPS-05 | Central app sync must survive central disappearing mid-download: no partial installs; idempotent retry |
| NFR-APPS-06 | Every endpoint added by FR-EMU must be covered by unit + integration tests before the first alpha ships |
| NFR-APPS-07 | CSP on the iframe host must be strict enough that an XSS in a DHIS2 app cannot read DER session cookies or `localStorage` for DER-native apps |
| NFR-APPS-08 | No functional dependency on DHIS2 central reachability at app runtime — only at install time (manual upload stays always-available) |

---

## 7. Phased delivery

### Phase 1 — OU auto-fill *(smallest; unlocks most immediate value)*
Scope: FR-OU-001 .. FR-OU-004, FR-OU-006. One commit, one migration
(none required — reads only). Immediately makes many simple DHIS2
custom apps functional.
**Risk:** low. **Exit:** stock DHIS2 Capture-like app fetches `/api/me`
and sees the bound OU.

### Phase 2 — Hybrid app dispatcher
Scope: FR-APP-001 .. FR-APP-006, FR-DIAG-001, FR-DIAG-003. Introduces
iframe host, `host_kind` column (new migration V121), CSP hardening on
`AppStaticHandler`.
**Risk:** medium (iframe sandbox tuning + CSP policy). **Exit:** a real
DHIS2 Hub app installs via manual upload, renders in iframe,
device-approval gate applies.

### Phase 3 — Emulator gap-fill
Scope: FR-EMU-001 .. FR-EMU-004, FR-EMU-007, FR-DIAG-002. New tables
for `user_setting` + `system_setting` (V122). New controllers mirror
the endpoints with real persistence.
**Risk:** medium. Scope creep risk — stop at the four mandatory
endpoints; add others only on evidence from FR-EMU-007 diagnostic.

### Phase 4 — Central app sync
Scope: FR-SYNC-001 .. FR-SYNC-003, FR-SYNC-005, FR-SYNC-007. New
scheduled job + provenance fields on catalogue.
**Risk:** medium-high (depends on central reachability + sync policy
decisions). **Exit:** admin lists "these N apps would sync" in dry-run;
after approval, they install silently on cadence.

### Phase 5 — Advanced hardening
Scope: FR-APP-007, FR-SYNC-004, FR-SYNC-006, FR-SYNC-008, FR-OU-005,
FR-EMU-005, FR-EMU-006, FR-WRITE-002. Signing pins, rollback window,
user-OU override, ETag concurrency, async tracker jobs.
**Risk:** low each but wide blast surface. Deliver per-FR as drivers
emerge.

### Phase 6 — Workflow cleanup
Scope: FR-WORKFLOW-002, FR-WORKFLOW-003, FR-WORKFLOW-004. Rename audit
event, resolve DISPATCH placeholder, update ADR-0018. **Only after**
Initiative 3 (P2P) direction is set; otherwise premature.

---

## 8. Resolved decisions (D1–D7, 2026-11-15)

All seven open decisions resolved on the recommended defaults. This
section is the binding contract for Phase 1–6 implementation.

| # | Decision | **Resolution** | Implementation implications |
|---|---|---|---|
| D1 | Deployment model | **Hybrid — manual upload + central auto-sync, per-tenant allow-list** | `AppCatalogueController` accepts manual uploads (already shipped) **and** receives installs from the new `APPS_SYNC_FROM_CENTRAL` scheduled job (FR-SYNC-001..007). Per-tenant policy stored under `admin_setting` key `apps.central-sync`. |
| D2 | Signature policy for central auto-sync | **Verify against a pinned key when present; allow unsigned with admin override** | DER stores a pinned Ed25519 public key for DHIS2 central (config: `der.apps.central.signing-key`). When central ships a signed manifest, DER verifies and installs silently. When unsigned, install is **gated** by an admin-set `apps.allow-unsigned-central` flag (default **false**); when true, every unsigned install writes an `APP_UNSIGNED_CENTRAL_ACCEPTED` audit event. |
| D3 | OU auto-fill tier | **Tiers 1 + 2** — populate `/api/me` **and** filter `/api/organisationUnits` to the bound subtree | `MeController` fills `organisationUnits`, `dataViewOrganisationUnits`, `teiSearchOrganisationUnits` with `[boundOrgUnit]` (FR-OU-001). `MetadataListController` filters `GET /api/organisationUnits` to the bound subtree when no explicit filter is given (FR-OU-003/004). Tier 3 user-level scoping is deferred to Phase 5. |
| D4 | Iframe sandbox strictness | **`allow-scripts allow-same-origin allow-forms allow-downloads`** | `IframeHost` React component hard-codes this sandbox token set on the `<iframe>` element. No stricter variant (e.g. revoking `allow-same-origin`) ships without evidence. No looser variant (e.g. adding `allow-top-navigation`) without an ADR update. |
| D5 | CSP policy on `/dhis-web-*/` | **`default-src 'self'; img-src 'self' data:; connect-src 'self'`** | `AppStaticHandler` emits this exact `Content-Security-Policy` header on every response under `/dhis-web-{appKey}/*`. Apps that call third-party CDNs will fail — admins see the violation in the browser console and can request per-app CSP exceptions via a future `apps.csp-override` setting (Phase 5). |
| D6 | i18n fallback strategy | **English stub on all non-English locales** | `GET /api/i18n` returns the English bundle regardless of `Accept-Language` header value. The response body includes `warnings: ["I18N_FALLBACK"]` when the requested locale was not English, so apps that honour the warning can surface it. Localisation packs stay out of scope until a pilot demands them. |
| D7 | Unmirrored-endpoint behaviour | **404 with code `EMULATOR_NOT_IMPLEMENTED` + diagnostic log** | Any `/api/*` route not registered by the DHIS2 emulator returns `404 { code: "EMULATOR_NOT_IMPLEMENTED", endpoint: "<path>", appOrigin: "<referrer>" }`. Every miss is logged to a new `emulator_miss` table (path + referrer + timestamp + count), surfaced on the `/system/apps` admin screen (FR-DIAG-002). No proxy-to-central fallback (kills offline-first). |

---

## 9. ADR updates / new ADRs

| ADR | Action |
|---|---|
| **ADR-0002 (DHIS2 pin)** | Update: explicitly scope the pin to central integration; add note that DHIS2 app bundles run offline against DER's emulator, not against central |
| **ADR-0015 (OU binding)** | Update: section on auto-populating `/api/me` for DHIS2 apps; relationship between facility binding and future user-level scope |
| **ADR-0018 (capture workflows)** | Update: clarify step-level device ownership is retained as foundation for Initiative 3 (P2P), with FR-WORKFLOW-004 cross-reference |
| **ADR-0019 (device management)** | Update: slice B interceptor covers `/dhis-web-*` path as well as `/edge-api/v1/apps/*/bundle.js` |
| **ADR-00NN** | **New:** DHIS2 web app hosting model — hybrid dispatcher, iframe sandbox, CSP posture, signing policy |
| **ADR-00NN+1** | **New:** DER emulator surface — what's mirrored, what returns `EMULATOR_NOT_IMPLEMENTED`, policy for expansion |
| **ADR-00NN+2** | **New:** Central app sync protocol — allow-list, provenance, signature verification |

---

## 10. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Iframe sandbox breaks a popular DHIS2 Hub app | Medium | Ship Phase 2 behind a per-app `isolation_mode` setting so admins can degrade sandbox per app with audit trail |
| Central auto-sync accidentally overwrites a facility's customised app | Medium | FR-SYNC-006 rollback window + admin allow-list (FR-SYNC-004) |
| Emulator gap-fill never catches up — admins keep seeing `EMULATOR_NOT_IMPLEMENTED` | High | FR-DIAG-002 makes the gap visible; prioritise expansion by evidence of actual usage |
| CSP breaks apps that fetch from CDNs | Medium | Per-app CSP override on install; default-strict + admin loosens |
| Writing to `/api/tracker` async: apps that don't poll jobId break | Low-medium | Dual mode — DER returns both sync `ImportSummary` and the async envelope |
| Workflow device ownership causes confusion if P2P never ships | Low | Audit event relabel (FR-WORKFLOW-002) makes semantics clearer; retire in Phase 6 if Initiative 3 formally cancels |
| Operator conflates "installed from central" with "endorsed by central" when central is just acting as the distribution tap | Medium | FR-SYNC-007 audit + diagnostic surface makes provenance explicit |

---

## 11. Success criteria

Phase 1 ships successfully when:
- A DHIS2 custom app that calls `/api/me/organisationUnits` on load renders
  a facility selector with the bound OU pre-selected
- No regression in existing DER-native app behaviour
- No regression in server-side tests

Phase 2 ships successfully when:
- A downloadable DHIS2 Hub app (one of: Social Protection, Immunisation
  Analysis, WHO ANC) installs via manual upload
- Opens in the DER client without errors
- Writes a data value through `/api/dataValueSets`, lands in
  `operation_journal`, syncs to central on the next drain
- Unapproved devices cannot open the app (DEVICE_NOT_APPROVED friendly
  error)

Phase 3 ships successfully when:
- Three apps that previously threw `/api/userSettings` 404s now work
- `EMULATOR_NOT_IMPLEMENTED` diagnostic shows at most 20 unique endpoint
  calls per 24 h (indicator that we've mirrored the common surface)

Phase 4 ships successfully when:
- Dry-run lists candidate apps from central without installing
- After approval, apps install silently on the next cadence
- `app_installation.source = CENTRAL_SYNC` audits visible in the admin
  screen
