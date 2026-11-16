# DER — Next-Fixes Gap Review

**Status:** Working document · drafted 2026-11-16 at commit `0e12d7fe`
**Owner:** core team
**Scope:** What remains after the `der-2.4.0-alpha.1` tag / `VERSION
2.3.122` snapshot — the authoritative state is
[`docs/implementation_status.md`](implementation_status.md); this
document ranks the leftovers and sketches the shape of each fix.

Current scorecard at this snapshot:

| Dimension             | DONE | Total | % |
|---                    |---:  |---:  |---:|
| UI screens            | 54   | 54   | 100% |
| FR / NFR requirements | ~181 | 211  | ~86% |

Remaining partials: **4 FRs** (auth reconciliation band) and **9
NFRs** (evidence-driven). Code debt scan finds **0** TODO/FIXME
markers and **0** disabled tests across `server/src/`. Server test
state at this commit: **2726 passing** (`mvn -DskipITs test`).

---

## Priority buckets

- **P0 — code gaps:** things that need DER source changes before they
  can be marked DONE. These are the real backlog.
- **P1 — evidence runs:** code is in place; what's missing is a
  measurement run on pilot hardware or a seeded fixture corpus.
  Operators drive these, not the code.
- **P2 — nice-to-haves surfaced during the recent session:**
  defensive improvements that aren't tied to a specific FR but would
  reduce operator surprise.

---

## P0 — ~~code gaps~~ ✅ ALL SHIPPED

The four P0 FRs in the authentication-reconciliation band are all
flipped DONE:

- **FR-02-02** — `UserSyncService` daily pull + upsert (commit `aef26d26`)
- **FR-02-08** — lifecycle disable + tombstone sweep (same commit)
- **FR-02-01** — flipped by evidence after 02-02 landed; DHIS2-origin
  users now mirror in from central and sign in offline through the
  existing auth path.
- **FR-02-09** — service was already shipped; closed by adding
  §7.4 runbook + smoke-test step 6 in this commit.

The P0 column is empty. Remaining work is all P1 evidence runs
below.

### ~~FR-02-02~~ — Identity provisioning ✅ DONE at `aef26d26`

### FR-02-02 — Identity provisioning  *(blocking)*

**Requirement:** Synchronise permitted user identity and credential
material using an approved secure mechanism.

**Current state:** The metadata-sync pipeline pulls `userGroups` and
`userRoles` (`MetadataSyncService.java:353`) but does **not** pull
user records themselves. `BootstrapAdminProvisioner` creates one
admin on first boot and never runs again. `EdgeUser` rows with
`origin=DHIS2` can only exist if someone provisioned them manually
through the SQL layer.

**Shape of the fix:**

1. New `UserPuller` (sibling to the existing `AggregatePuller` /
   `EventPuller` / `TrackerPuller`). Calls DHIS2
   `GET /api/users?fields=id,username,surname,firstName,userRoles,disabled,…`
   with the stored admin credentials or PAT.
2. Upsert into `edge_user` via the existing
   `EdgeUserRepository.upsert` path, keyed on `external_uid =
   dhis2_user_uid`. Credential material is NOT mirrored — users
   authenticate against the central-issued password through the
   DHIS2 proxy during the FIRST online sign-in, at which point the
   verifier is derived locally and stored in `edge_credential`.
   This is the "approved secure mechanism" the FR asks for.
3. New `der.security.user-sync.enabled` config (default true) +
   `der.security.user-sync.cron` (suggested 02:00 UTC daily, to
   precede the compliance 03:00 sweep).
4. Audit `USER_SYNC_*` events per upsert / disable / role change.

**Estimated size:** 1 slice (~1 commit). Depends on nothing;
unblocks FR-02-08.

### ~~FR-02-08~~ — User lifecycle ✅ DONE at `aef26d26`

**Requirement:** Update or disable locally provisioned users upon
central change and record effective scope.

**Current state:** No central → local reconciliation exists. A user
disabled at central still signs in locally until FR-02-06's
offline-credential-age gate (now 30 days default) fires. That's
weeks of tolerance for a revoked account.

**Shape of the fix:**

1. Extend the `UserPuller` above with:
   - `disabled: true` → set `edge_user.disabled = true` and revoke
     all active sessions for that user via
     `EdgeSessionRepository.revokeAllForUser`.
   - Role delta → `edge_role` upsert / delete.
   - Missing from central → tombstone, not hard delete. Mark
     `disabled=true`, audit `USER_RECONCILIATION_REMOVED`,
     retain the row for 90 days before cleanup (matches
     `JournalRetentionService` retention knob).
2. Emit `USER_RECONCILIATION_*` audit events with structured
   detail (before/after roles, before/after disabled).
3. Update the `last_central_sync_at` column (V127) on every
   successful upsert — ties the two FRs together: user-sync is the
   primary witness refresh path, not just sign-in while REACHABLE.

**Estimated size:** Same commit as FR-02-02 or immediate follow-up.

### ~~FR-02-01~~ — Offline login ✅ DONE (flipped by evidence post-02-02)

**Requirement:** Authenticate previously provisioned and authorised
users without central availability.

**Current state:** The sign-in path works, including FR-02-06
offline credential-age gate and FR-02-07 first-time-offline policy.
What's missing to flip DONE: a path to *become* "previously
provisioned" without manual SQL — exactly what FR-02-02 ships.

**Shape of the fix:** No new code. Flip to DONE once FR-02-02 lands,
with evidence that a user mirrored from central can sign in offline
while the WAN is down.

### ~~FR-02-09~~ — Emergency-access procedure ✅ DONE

**Requirement:** Support a formally configured, audited
emergency-access policy only if approved.

**Current state:** `BreakGlassService` + `BreakGlassController` +
token-file gate + audit event (`BREAK_GLASS_RECOVER`) + constant-
time token compare + one-use token deletion — all shipped. The
PARTIAL note just says "bootstrap admin provisioner" which refers
to the fallback path when break-glass isn't configured.

**Shape of the fix:** Two small additions to flip DONE:

1. A runbook snippet in
   [`docs/operations/pilot-runbook.md`](operations/pilot-runbook.md)
   documenting the operator procedure (where the token file lives,
   how to generate a token, where to read the rotated password
   from, how to clear the token file post-use).
2. A smoke-test entry in
   `deployment/pilot/smoke_test.sh` that exercises the
   `POST /edge-api/v1/break-glass/recover` path against a disposable
   token to prove the installer wires it correctly.

**Estimated size:** 1 doc commit + 1 smoke-test commit.

---

## P1 — evidence-driven NFRs

These NFRs are **code-complete** at this snapshot. They're PARTIAL
because they require a measurement run that can only happen on
pilot hardware or against a seeded reference corpus that doesn't
exist yet. No code changes are expected; the tasks are:

### NFR-05 — 100% forbidden access rejected

Spring Security filter chain is in place with role + scope
interceptors (`OrgUnitScopeInterceptor`, `SecurityConfig`). Gap:
no exhaustive test matrix proving the *100%* claim.

**Next fix:** Build
`scripts/evaluation/forbidden_access_matrix.py` — walks every
controller + method + role combination from the OpenAPI spec and
asserts the response is 401/403 when the role doesn't carry the
required authority. Ship as a gate step in `run_phase_08.sh`.

### NFR-06 — Transport + credential + log + storage protection

ADR-0017 Part 1 shipped the controls (TLS enforce option, PII
masking, backup encryption, audit hash chain). Gap: no single
evidence bundle that shows all four knobs tripped and holding.

**Next fix:** Extend `run_phase_08.sh` with
`evidence/nfr-06-coverage.json` that captures: TLS cipher list,
PII-masking test output (regex over sample audit rows), backup
encryption on (envelope sealed), hash chain verification pass.

### ~~NFR-07~~ — Every acknowledged commit retrievable by second client ✅ DONE

The journal design supports it (local commits are durable before
the drain). Gap: no dedicated test that spins up two clients, has
client A commit, and has client B read without the WAN.

**Next fix:** Playwright scenario under
`tests/scenarios/two-client-retrieval.spec.ts` — two
`browserContext` instances, client A posts to
`/api/dataValueSets`, client B reads back. Assert agreement on
value, timestamp, `storedBy`.

### NFR-09 — Reference comparison set (100% agreement)

Needs the reference corpus itself. The FR layer references
`scripts/evaluation/fixtures/` but no oracle corpus has been
built.

**Next fix:** Seed
`scripts/evaluation/fixtures/reference-corpus/` with ~50 known
input/output pairs covering aggregate + event + tracker flows,
plus a comparison runner that reports agreement %.

### ~~NFR-14~~ — Offline privilege + credential freshness ✅ DONE

`SessionValidationService` enforces the policy at runtime
(expiry, revocation, `last_central_sync_at` window after
FR-02-06). Gap: no end-to-end scenario that demonstrates the
policy actually denies after N days offline.

**Next fix:** Time-travel scenario in `tests/scenarios/` using the
test `Clock` bean — advance 31 days, hit `/auth/sign-in`, assert
403 with `DER-Offline-Credential-Expired` header.

### ~~NFR-30~~ — Fail-safe acceptance under storage pressure ✅ DONE

`StorageAdmissionInterceptor` already returns 507 when
`StorageHealthProbe` reports REJECT (FR-14-09). Gap: no
fault-injection evidence proving writes aren't silently
acknowledged when the disk fills.

**Next fix:** Fault-injection scenario — fill a tmpfs mount to
~99%, POST to `/api/dataValueSets`, assert 507 + no row in
`operation_journal`. Capture as `evidence/nfr-30-storage.json`.

### NFR-31 — Synthetic data for experiments

`scripts/evaluation/fixtures/` exists but doesn't ship a
documented synthetic-data generator. Gap: statement of what's
synthetic and how the generator parameterises it.

**Next fix:** Document existing fixture generation in
`scripts/evaluation/fixtures/README.md` + one additional
parameterised generator for TEI / enrollment / event payloads.

### ~~NFR-32~~ — No central coupling ✅ DONE

Code-level: every local operation writes to the local journal and
returns. Gap: no measurement proving there's no blocking call on
the critical path (e.g., a metadata-mirror lookup that falls
through to central on cache miss).

**Next fix:** Instrument the aggregate + event + tracker write
paths with a span tag; extend `der_bench.py` to assert no span
calls out to the configured central baseUrl during the write
transaction. Fail the run if any span crosses the boundary.

### ~~NFR-33~~ — Metadata safety (no silent reinterpretation) ✅ DONE

Shipped the mechanism in FR-05-10..12 (`JournalWorker` auto-
quarantines drifted entries before publish). Gap: evidence under
test that proves an unacknowledged op isn't silently reinterpreted
when metadata drifts.

**Next fix:** Scenario — commit op against metadata snapshot N,
simulate metadata drift to N+1, trigger drain, assert the op lands
in `metadata/drift/pending` with the correct `drift_fields` detail
and `operation_journal.state = CONFLICT_REVIEW`.

---

## P2 — defensive improvements noticed in-flight

### Durable admin-password reset surface

Noticed while repairing `der-admin` login after the earlier break-
glass rotation. The current path requires `jshell` + manual SQL.
We already have a working `BreakGlassService` that mints a new
password and audits it — the gap is that `.env.local` stays stale
afterwards and the operator has no in-product way to realign.

**Options:**

1. Add an ADMIN-gated `POST /edge-api/v1/admin/users/{userId}
   /password-reset` that generates a password, stores it hashed,
   returns the plaintext once (like break-glass does). Lowest
   risk; matches established pattern.
2. Teach the bootstrap provisioner to resync the env password on
   every boot (**risky** — would silently unroll any legit
   rotation). Rejected.

**Next fix:** Ship option 1, with a UI screen under
`/access/credentials` in admin-ui.

### Cross-entity journal ordering

Documented as a known trade-off in
`OperationJournalRepository.findPendingReadyToDrain` as part of
FR-11-10. Today same-entity chains are enforced in-query via the
`supersedes` guard; cross-entity chains (TEI → ENROLLMENT →
PROGRAM_STAGE_EVENT → ENROLMENT_NOTE / RELATIONSHIP) rely on the
`TrackerGraphReconciler` post-hoc. If a pilot surfaces a bug, the
fix is a new predicate that joins the TEI / enrollment references
out of `payload_json` — not a Java check in the drain worker.

**Next fix:** Only if a pilot reports the symptom. Otherwise keep
as documented trade-off.

### Expired-cookie ban-list

`SessionValidationService` already emits
`SESSION_VALIDATION_REJECTED` with a reason tag (FR-02-10). A
single malicious client with an old cookie could still generate
unbounded audit volume. The rate-limiter guards `/auth/sign-in`
but not the cookie-presenting path.

**Next fix:** Extend `RateLimiter` with a per-IP cookie-rejection
scope. Drop silently (no audit, no 401) after N consecutive
failures from the same IP in a window. Needs a design call on
window + N.

### Admin UI doesn't expose the DHIS2 app installer (ADR-0005)

**Symptom:** Operator opens `https://<host>/admin/apps`, chooses a
standard DHIS2 `.zip` (manifest.webapp at root), hits Install, and
gets a 400 — the endpoint it calls expects a signed DER bundle,
not a DHIS2 custom app.

**Root cause:** `AppCatalogue.tsx` wires only the ADR-0037 signed-
bundle flow at `POST /edge-api/v1/admin/apps/install`. The legacy
DHIS2 custom-app endpoint `POST /edge-api/v1/apps/install`
(`AppsController` + `AppInstaller`, ADR-0005) has no UI surface.
Operators can call it with `curl -F file=@app.zip` but that's not
discoverable.

**Shape of the fix:**

1. Admin UI change: either a second button on `/admin/apps` ("Install
   DHIS2 app (.zip)") or a sibling route under `/apps/dhis2` that
   calls `/edge-api/v1/apps/install`. Keep the two flows visually
   distinct so operators don't confuse signed-bundle semantics with
   DHIS2 app semantics.
2. Pre-upload detection: if the chosen zip has `manifest.webapp` at
   root, route it to the DHIS2 installer; if it has `bundle.js` at
   root, route it to the signed-bundle installer. The parser in
   `AppCatalogue.tsx` already reads `manifest.webapp` to pre-fill
   form fields — this is 30 lines of branching, not a new screen.
3. Document both flows in the installer docs once UI lands.

**Why it matters:** DHIS2 custom apps (Capture, Tracker Capture,
Data Entry) are the most common thing an operator will try to
install on an edge box. The gap makes DER look like it rejects
DHIS2 apps when the capability is actually shipped — just unwired.

### ~~Bundled app zip files are committed~~ — ✅ DONE

~~`apps/data-entry/dist/data-entry.zip` and
`apps/workflow-capture/dist/workflow-capture.zip` are always
unstaged in `git status` — the build step rewrites them.~~

Shipped: `.gitignore` now carries an explicit `apps/*/dist/`
entry and the two tracked zips were `git rm --cached`'d so the
worktree stays clean after each local build. The broad `dist/`
rule already matched them, but the explicit entry is there so a
future refactor that drops the broad rule still ignores them.

---

## Delivery order suggestion

1. **`FR-02-02 + FR-02-08`** — one commit. New `UserPuller` + the
   lifecycle reconciliation branches. Flips FR-02-01 by evidence.
2. **`FR-02-09` runbook + smoke-test** — one small commit. Clears
   the auth-section PARTIAL band entirely.
3. **P2 — durable password-reset surface** — one commit. Avoids the
   next `jshell` incident.
4. **NFR-14 scenario** — one test commit. Cheap pin.
5. **NFR-07 Playwright scenario** — one test commit. Cheap pin.
6. **NFR-33 scenario** — one test commit. Cheap pin.
7. **NFR-32 instrumentation + assertion** — one commit.
8. **NFR-05 matrix + NFR-06 coverage + NFR-30 fault inject + NFR-09
   corpus + NFR-31 generator** — these become `run_phase_08.sh`
   additions shipped as Phase-08 extensions, not per-FR commits.

After step 2, the P0 column is empty and the project is `der-2.4.0`
candidate (not alpha). Steps 3-7 land under `der-2.4.0-alpha.*` and
step 8 becomes the Phase-08 evidence pass that unlocks a stable
`der-2.4.0`.

---

## Snapshot anchor

| Artifact | Value |
|---|---|
| VERSION | `2.3.122` |
| Latest tag | `der-2.4.0-alpha.1` |
| HEAD commit | `0e12d7fe` (README rewrite) |
| Server tests | 2726 passing |
| ADRs | 37 (0001 … 0037) |
| Flyway migrations | V001 … V127 |
| Code size | 537 server Java files; 104 controllers |
| Scorecard | 54/54 UI, ~181/211 FR+NFR DONE |

Supersede this document the next time the scorecard shifts by more
than ~5 FRs; otherwise just strike through items as they land.
