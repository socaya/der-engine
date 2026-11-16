# DER — DHIS2 Edge Runtime

> **Project baseline:** Design and Implementation of a Conflict-Aware
> Edge Synchronisation Runtime for Offline-First Distributed DHIS2
> Workflows. **DHIS2 reference range:** 2.41 – 2.44+ (compat engine
> auto-routes per version, ADR-0006). **Audience:** student developer,
> supervisor, reviewers, future maintainers, pilot operators.

A research prototype that lets a Local Area Network keep running DHIS2
workflows even when the Wide Area Network goes dark. The edge runtime
emulates DHIS2's `/api/*` surface at every clinic, speaks the DHIS2
shape to standard DHIS2 apps and devices, journals every change,
resolves conflicts explicitly, drains back to a central DHIS2
installation when connectivity returns, pulls data back the other way
to reconcile, and ships a reproducible backup/restore engine plus a
bare-metal pilot deployment runbook.

> _No WAN, no problem._ WAN disconnection does not interrupt supported
> local operations; everything the staff capture is durable, auditable,
> and sync-ready.

---

## Current release

- **VERSION file:** `2.3.122`
- **Latest tag:** `der-2.4.0-alpha.1`
- **DHIS2 reference range:** 2.41 – 2.44 (compat engine ADR-0006).
- **Local verification against:** DHIS2 2.44-SNAPSHOT on Tomcat 10 +
  PostgreSQL 17.
- **Server test state:** **2726 tests green** (`mvn -DskipITs test`);
  JaCoCo + SpotBugs + Checkstyle in the gate.
- **Code scope:** 537 server Java files across 104 controllers;
  127 Flyway migrations (V001 → V127); 37 ADRs (ADR-0001 → ADR-0037).

### Implementation scorecard (`docs/implementation_status.md`)

| Dimension             | DONE | Total | % |
|---                    |---:  |---:  |---:|
| UI screens            | 54   | 54   | 100% |
| FR / NFR requirements | ~181 | 211  | ~86% |

Remaining partials are tracked explicitly in
[`docs/implementation_status.md`](docs/implementation_status.md): 4 FRs
in the auth-reconciliation band (FR-02-01, 02-02, 02-08, 02-09) and 9
NFRs that need pilot-hardware evidence runs rather than code.

### Supported workflows

- Aggregate reporting (`POST`/`GET /api/dataValueSets`) with locally
  journalled audit chain, conflict review and approved-merge path.
- Event programs (`POST /api/events`, legacy + tracker shape) with
  divergence classification (`IN_SYNC` / `CENTRAL_DIVERGED` /
  `CENTRAL_DELETED` / `DUPLICATE_LOCAL`).
- Tracker programs: TEI + enrollment + events + relationships, with
  local unique-attribute collision check (FR-08-08) and central-side
  409 routing through the publisher's response classifier.
- Program-rule execution at the edge (ADR-0007) — ASSIGN, SHOWERROR,
  SHOWWARNING, WARNINGONCOMPLETE, ERRORONCOMPLETE, SETMANDATORYFIELD.
- Scheduled metadata resync + drift detection + pre-publish
  drift-quarantine (ADR-0008, FR-05-10..12).
- Durable journal worker draining edge → central with same-entity
  supersedes ordering (ADR-0010 / FR-11-10).
- Inbound pull from central (`AggregatePuller` / `EventPuller` /
  `TrackerPuller`) with central-deletion sweeps that emit
  `*_DIVERGENCE_CENTRAL_DELETED` audit events (ADR-0034 / FR-13-08).
- Workflow runs — device-owned steps, program binding, graph
  reconciliation (ADR-0022..0026).
- Central referral / next-hop hub chain (ADR-0027, ADR-0031).
- Custom DHIS2 app hosting via `.zip` install with signing policy
  (ADR-0005 / ADR-0037) and central-sync of the installed set.
- Edge device management (ADR-0019) with device-approval policy,
  break-glass admin recovery (FR-02-09), TOTP MFA (ADR-0028).
- Site-level analytics (ADR-0020) with verified columnar lifecycle,
  Delta + RLE codecs, planner feedback consumer.
- Hash-chained security audit (ADR-0021) + CMS-wrapped uploads.
- Pre-flight readiness bundle `GET /system/preflight` (FR-01-04) —
  seven probes (time / dns / certs / storage / database / network /
  dependencies).
- `pg_dump` / `pg_restore` backup engine (ADR-0012) with:
  - optional S3-compatible offsite upload + envelope encryption,
  - weekly shadow-restore verification,
  - daily lightweight SHA-256 integrity probe (FR-14-06..10),
  - PITR via WAL-archive tracking.
- Reproducible NFR evaluation harness (ADR-0013) producing timestamped
  evidence bundles under `docs/evaluation/evidence/`.
- Bare-metal pilot deployment runbook (ADR-0014) with idempotent
  `install.sh`, smoke test, snapshot-based `upgrade.sh` / `rollback.sh`.

See [`docs/implementation_status.md`](docs/implementation_status.md)
for the per-FR / per-NFR current state and
[`docs/releases/`](docs/releases/) for every intermediate release
(the `der-2.3.*` stream covers `2.3.9` → `2.3.122`, plus
`der-2.4.0-alpha.1`).

---

## Architecture at a glance

```
                      ┌──────────────────────────────────────────┐
                      │                CENTRAL                   │
                      │   DHIS2 2.4x server + Postgres           │
                      └────────────────────┬─────────────────────┘
                                           │  edge → central drain (ADR-0010)
                                           │  central → edge pull     (ADR-0034)
                                           │  next-hop referral       (ADR-0027)
                                           │  optional S3 archive push
                                           │
┌──────────────────────────────┐   ┌───────┴────────────────────────┐
│  Device Client               │   │  DER Edge Node                 │
│  React 18 / @dhis2/ui        ├──►│  Spring Boot 3.5 / Java 21     │
│  (DC-01..18)                 │   │  Quartz + Postgres JobStore    │
│  Offline PWA shell           │   │  Flyway V001..V127             │
└──────────────────────────────┘   │  Spring Security + Argon2id    │
                                   │  TOTP (ADR-0028) + hash-chain  │
┌──────────────────────────────┐   │    audit (ADR-0021)            │
│  Admin UI (same-origin)      ├──►│  Compat engine (ADR-0006)      │
│  React 18 / plain-HTML       │   │  Rules engine (ADR-0007)       │
│  (EA-01..36)                 │   │  Backup + PITR (ADR-0012)      │
└──────────────────────────────┘   │  Device mgmt (ADR-0019)        │
                                   │  Analytics (ADR-0020)          │
┌──────────────────────────────┐   │  Workflow runs (ADR-0022..26)  │
│  Capacitor Android wrap      ├──►│  Capture-form API (ADR-0036)   │
│  (ADR-0030)                  │   │                                │
└──────────────────────────────┘   │  Serves /api/* (DHIS2 shape)   │
                                   │  Serves /dhis-web-<key>/** apps│
                                   │  Serves /edge-api/v1/* (admin) │
                                   └────────────────────────────────┘
                                           │
                                           │  pg_dump + WAL archives
                                           ▼
                               /var/lib/der/backups
                               /var/lib/der/wal_archive
                               /var/lib/der/uploads
```

Hybrid per
[ADR-0004](docs/architecture/decisions/0004-hybrid-dhis2-edge-emulation.md):
DHIS2 Core runs on central only; DER emulates `/api/*` at the edge so
stock DHIS2 clients (and custom apps installed via ADR-0005) can keep
working offline.

Pilot topology per
[ADR-0014](docs/architecture/decisions/0014-pilot-deployment-topology.md):
bare-metal systemd on Debian/Ubuntu LTS, Postgres from the distro,
nginx reverse-proxy serving `/`, `/admin/`, `/api/`, `/edge-api/`,
`/dhis-web-*`.

---

## Repository layout

| Path | Role |
|---|---|
| `server/` | Spring Boot 3.5 coordination service (`ug.ac.mak.der`). JDBC + Flyway + Spring Security + Quartz Postgres JobStore. 104 controllers / 537 Java files. |
| `client/` | React 18 / TypeScript device client. DC-01..18 screens using `@dhis2/ui`. Offline PWA shell. |
| `admin-ui/` | React 18 / TypeScript admin console. EA-01..36 screens with plain-HTML + `data-test` semantics. Same-origin per ADR-0033. |
| `apps/` | Custom DHIS2 apps installed into the edge (`data-entry`, `workflow-capture`, …). Built per ADR-0005; central-synced (ADR-0037 signing policy). |
| `agents/dhis2-edge-agent/` | On-DHIS2 helper agent (ADR-0029) — queue → pull bridge for edge pulls. |
| `analytics-store/` | Verified columnar analytics store (ADR-0020). |
| `database/migrations/` | DER-owned Flyway migrations `V001..V127`. |
| `deployment/` | NGINX, systemd, PostgreSQL bootstrap, DHIS2 reference install. |
| `deployment/pilot/` | Pilot installer, smoke test, upgrade/rollback, systemd unit, nginx server block, Postgres bootstrap, env template (ADR-0014). |
| `scripts/evaluation/` | NFR measurement harness: `der_bench.py`, `backlog_recovery.py`, `resource_sampler.py`, `backup_integrity.py`, `run_phase_08.sh` (ADR-0013). |
| `tests/` | Compatibility, concurrency, recovery, performance, security scenario specs. |
| `docs/` | Authoritative design baseline: 176 FRs, 35 NFRs, 54 screen specs, 37 ADRs, verification matrix. |
| `docs/operations/pilot-runbook.md` | Authoritative install / day-2 / troubleshoot / upgrade / rollback / acceptance-evidence runbook. |
| `docs/architecture/decisions/` | ADR-0001 … ADR-0037. |
| `scripts/` | Repeatable project checks (`run_all_checks.sh`), release automation, dev helpers (`scripts/dev/restart_der_server.sh`). |

---

## Key architecture decisions

The ADR catalogue has grown to 37 records. Highlights:

| ADR | Title | Status |
|---|---|---|
| [ADR-0004](docs/architecture/decisions/0004-hybrid-dhis2-edge-emulation.md) | Hybrid DHIS2 edge emulation | Accepted |
| [ADR-0005](docs/architecture/decisions/0005-custom-dhis2-apps-at-the-edge.md) | Custom DHIS2 apps on the edge | Accepted |
| [ADR-0006](docs/architecture/decisions/0006-dhis2-compatibility-engine.md) | Dynamic DHIS2 compatibility engine | Accepted |
| [ADR-0007](docs/architecture/decisions/0007-program-rules-at-the-edge.md) | Program-rule execution at the edge | Accepted |
| [ADR-0008](docs/architecture/decisions/0008-scheduled-sync-and-drift.md) | Scheduled metadata resync + drift via Quartz | Accepted |
| [ADR-0010](docs/architecture/decisions/0010-journal-worker.md) | Durable journal worker for edge → central drain | Accepted |
| [ADR-0012](docs/architecture/decisions/0012-backup-and-restore-engine.md) | Backup / restore engine | Accepted |
| [ADR-0017](docs/architecture/decisions/0017-security-hardening-part1.md) | Security hardening part 1 | Accepted |
| [ADR-0019](docs/architecture/decisions/0019-edge-device-management.md) | Edge device management | Accepted |
| [ADR-0020](docs/architecture/decisions/0020-site-level-analytics.md) | Site-level analytics | Accepted |
| [ADR-0021](docs/architecture/decisions/0021-hash-chained-audit-and-cms-wrapped-uploads.md) | Hash-chained audit + CMS uploads | Accepted |
| [ADR-0022..0026](docs/architecture/decisions/) | Workflow runs (device-owned steps, enforcement, import/export, reconciler, state + ingest) | Accepted |
| [ADR-0027](docs/architecture/decisions/0027-chain-via-hub-referral.md) | Chain-via-hub referral | Accepted |
| [ADR-0028](docs/architecture/decisions/0028-totp-mfa.md) | TOTP MFA | Accepted |
| [ADR-0029](docs/architecture/decisions/0029-dhis2-edge-agent.md) | DHIS2 edge-side helper agent | Accepted |
| [ADR-0030](docs/architecture/decisions/0030-android-capacitor-wrap.md) | Android Capacitor wrap | Accepted |
| [ADR-0032](docs/architecture/decisions/0032-client-user-attribution.md) | Client-user attribution engine | Accepted |
| [ADR-0033](docs/architecture/decisions/0033-admin-ui-same-origin.md) | Admin UI same-origin | Accepted |
| [ADR-0034](docs/architecture/decisions/0034-inbound-data-pull.md) | Inbound data pull | Accepted |
| [ADR-0035](docs/architecture/decisions/0035-pull-write-interlock.md) | Pull-write interlock | Accepted |
| [ADR-0036](docs/architecture/decisions/0036-capture-form-api.md) | Capture-form API | Accepted |
| [ADR-0037](docs/architecture/decisions/0037-dhis2-app-signing-policy.md) | DHIS2 app signing policy | Accepted |

Full ADR index: [`docs/architecture/decisions/`](docs/architecture/decisions/).

---

## Design baseline

The authoritative design package lives under [`docs/`](docs/):

- Project charter and scope: [`docs/project/`](docs/project/)
- 176 functional requirements:
  [`docs/requirements/source-functional-register.csv`](docs/requirements/source-functional-register.csv)
- 35 non-functional requirements:
  [`docs/requirements/source-nonfunctional-register.csv`](docs/requirements/source-nonfunctional-register.csv)
- Current implementation state:
  [`docs/implementation_status.md`](docs/implementation_status.md)
- 54 UI screen specifications: [`docs/ui/screens/`](docs/ui/screens/)
  (18 DC + 36 EA)
- DHIS2 version-endpoint matrix:
  [`docs/verification/compatibility/version-endpoint-matrix.csv`](docs/verification/compatibility/version-endpoint-matrix.csv)
- Architecture + ADRs: [`docs/architecture/`](docs/architecture/)
- Interfaces, security, operations:
  [`docs/interfaces/`](docs/interfaces/),
  [`docs/security/`](docs/security/),
  [`docs/operations/`](docs/operations/)
- Verification matrix + scenario suites:
  [`docs/verification/`](docs/verification/)
- Delivery, phases, versioning policy: [`docs/delivery/`](docs/delivery/)
- NFR evaluation methodology:
  [`docs/evaluation/phase-08-methodology.md`](docs/evaluation/phase-08-methodology.md)
- Pilot operator runbook:
  [`docs/operations/pilot-runbook.md`](docs/operations/pilot-runbook.md)
- Per-phase evidence:
  [`docs/evaluation/evidence/<phase>/<commit>/`](docs/evaluation/evidence/)

---

## Quick start (development)

**Prerequisites:** Java 21, Maven (bundled wrapper or system `mvn`),
Node 20+, PostgreSQL 17, Python 3.11+. Local DHIS2 2.4x for live
integration (ADR-0004 — DHIS2 does **not** run on the edge).

```bash
# 1. Prepare the DER Postgres database.
psql -h localhost -U postgres \
     -f deployment/postgresql/der-db-bootstrap.sql

# 2. Configure environment.
cp .env.local.example .env.local
# Edit DER_DB_URL, DER_SESSION_SECRET,
# DER_BOOTSTRAP_ADMIN_USERNAME / _PASSWORD,
# DER_DHIS2_CENTRAL_URL / _USER / _PASSWORD,
# (optional) DER_SECURITY_SECRET_KEY to enable SecretEnvelope sealing.

# 3. Build + run server. The restart helper copies the jar to
#    ~/.der/current-der-server.jar before launching so gate
#    rebuilds don't wedge the JVM.
cd server && mvn -q -DskipTests package && cd ..
bash scripts/dev/restart_der_server.sh
# -> http://localhost:8085/edge-api/v1/system/health
# -> http://localhost:8085/edge-api/v1/system/preflight (public FR-01-04 bundle)

# 4. Dev loops (two more terminals).
cd client   && npm install && npm run dev
# -> http://localhost:5174/

cd admin-ui && npm install && npm run dev
# -> http://localhost:5173/
```

Sign in as the bootstrap admin, then from the launcher:

- **Device client** (`:5174`): dataset entry (DC-06/07), event programs
  (DC-08–10), tracker (DC-11–15), review & drafts (DC-16/17), captured
  workflow runs (DC-18).
- **Admin console** (`:5173`): setup overview, provisioning,
  compatibility, scheduler, drift, conflict review, journal worker,
  metadata overview, recovery, backup intent + integrity probe,
  evaluation reports, custom-app management, device-approval policy,
  site-level analytics, access cluster, device cluster, diagnostics.

If you need to run an interactive shell command yourself (e.g.
`gcloud auth login`), prefix it with `!` in the terminal so the output
lands in this conversation.

---

## Pilot install (bare metal)

Per
[ADR-0014](docs/architecture/decisions/0014-pilot-deployment-topology.md).
Authoritative runbook:
[`docs/operations/pilot-runbook.md`](docs/operations/pilot-runbook.md).

```bash
# On a build host (dev laptop) with Java 21 + Node 20:
cd server    && mvn -q -DskipTests package && cd ..
cd client    && npm ci && npm run build && cd ..
cd admin-ui  && npm ci && npm run build && cd ..

# Rsync the repository checkout to the pilot host:
rsync -azP ./ pilot-host:/tmp/der-source/

# On the pilot host (Debian 12 / Ubuntu 24.04 LTS):
sudo apt install openjdk-21-jre-headless postgresql-17 nginx
cd /tmp/der-source
sudo bash deployment/pilot/install.sh

# Edit /etc/der/pilot.env (DHIS2 URL, admin + DB passwords), then:
sudo systemctl start der-server
sudo bash deployment/pilot/smoke_test.sh
```

The installer is idempotent — it creates the `der` system user, lays
out `/opt/der`, `/etc/der`, `/var/lib/der`, `/var/log/der`, installs
the systemd unit and nginx server block, bootstraps the Postgres role
+ database, and runs Flyway V001..V127 on first service start.

Upgrade / rollback:

```bash
sudo bash deployment/pilot/upgrade.sh        # snapshot /opt/der.<ts>, swap, restart
sudo bash deployment/pilot/rollback.sh <ts>  # restore the snapshot
```

---

## REST surfaces served by DER

### DHIS2-shaped `/api/*` (ADR-0004 emulation)

- `GET /api/system/info` — version reflected from the resolved compat
  snapshot.
- `GET /api/me`, `GET /api/metadata`, `GET /api/organisationUnits`,
  `/api/dataElements`, `/api/dataSets`, `/api/programs`,
  `/api/programStages`, `/api/trackedEntityTypes`,
  `/api/trackedEntityAttributes`, `/api/categoryOptionCombos`,
  `/api/programRules`.
- `POST`/`GET /api/dataValueSets` — aggregate writes + readback.
- `POST /api/events`, `POST /api/tracker` — event + tracker writes with
  rules executed at the edge.
- `GET /api/events`, `GET /api/tracker/events` — read-back from the
  local store.
- Everything else routes through the `Dhis2ApiProxyController` with a
  unified error taxonomy (`EMULATOR_NOT_IMPLEMENTED` /
  `INVALID_REQUEST` / `UPSTREAM_UNAVAILABLE` / `UPSTREAM_INTERRUPTED`,
  FR-04-06).

### DER-only `/edge-api/v1/*`

System + readiness (public):

- `GET /system/health`
- `GET /system/preflight` — FR-01-04 bundle (7 probes)
- `GET /system/device-approval-mode`
- `POST /auth/sign-in`, `POST /auth/sign-out`, `GET /auth/session`
- `POST /break-glass/recover` (FR-02-09)

Operator admin (ADMIN-gated):

- `GET /admin/metrics`, `GET /admin/metrics/clock`,
  `POST /admin/metrics/clock/report` (FR-02-10, NFR-28)
- `POST /admin/ops/backup/trigger`, `GET /admin/ops/backup/verify`
- `POST /admin/ops/backup/integrity/check`,
  `GET /admin/ops/backup/integrity/history` (FR-14-06..10)
- `POST /admin/ops/journal/purge`,
  `GET /admin/ops/journal/purge/history` (FR-09-10)
- `POST /admin/ops/journal/{opId}/quarantine`,
  `POST /admin/ops/journal/{opId}/retry`,
  `POST /admin/ops/journal/retry-run`,
  `POST /admin/ops/journal/retry-batch`,
  `POST /admin/ops/journal/aggregate/replay`
- `GET /admin/ops/users/scope`, `GET /admin/ops/scope/audit`
- `GET /admin/ops/settings`, `POST /admin/ops/settings`
- `GET /admin/ops/support-bundle`,
  `GET /admin/ops/reports/operational`
- `POST /admin/ops/decommission`
- `GET /admin/users/dhis2-mappings`,
  `PUT /admin/users/dhis2-mappings/{userId}`,
  `DELETE /admin/users/dhis2-mappings/{userId}` (ADR-0032)

Sync + reconciliation:

- `/sync/metadata`, `/sync/jobs`, `/sync/jobs/{name}/trigger`,
  `/sync/drift`, `/sync/notify`
- `/compat`, `/compat/history`, `/compat/refresh`
- `/journal/conflicts`, `/journal/conflicts/{id}/resolve`,
  `/journal/conflicts/{id}/re-journal`
- `/journal/worker`, `/journal/worker/{pause,resume}`
- `/events/divergence/recent` (FR-07-08)
- `/metadata/drift/pending` (FR-05-10..12)

Apps:

- `/apps`, `/apps/install`, `/apps/{id}/{enable,disable,…}`
- `/admin/apps/central-sync/*` (ADR-0037)
- `/dhis-web-<app-key>/**` — custom DHIS2 app static assets

Backups:

- `/backup/request`, `/backup/runs`, `/backup/runs/{id}`,
  `/backup/runs/{id}/archive`
- `/restore/request`, `/restore/upload`, `/restore/runs`,
  `/restore/runs/{id}`

Device + network:

- `/network/*` (status, access-point, interfaces, routes, clients,
  enrol-tokens, leases)
- `/devices/*` (list, approve, revoke, ownership, diagnostics)

Workflows + referrals:

- `/workflows/*`, `/workflow-runs/*`, `/capture-form/*`
- `/referrals/*`

Analytics:

- `/analytics/*` (site-level columnar queries, ADR-0020)

---

## NFR evaluation harness

Per
[ADR-0013](docs/architecture/decisions/0013-nfr-evaluation-harness.md).
Python-stdlib-only measurement scripts under `scripts/evaluation/`.

```bash
export DER_ADMIN_COOKIE="DER_SESSION=<token>"
export DER_DATA_DIR=/var/lib/postgresql/17/main   # optional, for disk growth
bash scripts/evaluation/run_phase_08.sh
```

Each run writes a timestamped bundle under
`docs/evaluation/evidence/<phase>/<run>/`:

- `bench-health.json`, `bench-metadata.json` — latency p50/p95/p99 +
  throughput at concurrency 1/5/10/20 (NFR-15, NFR-16, NFR-19).
- `backlog-100.json`, `backlog-1000.json` — journal drain-to-zero time
  (NFR-17).
- `resource-sample.json` — RSS/CPU/disk time series + hardware
  fingerprint (NFR-18, NFR-35).
- `backup-integrity.json` — backup/restore round-trip verification
  (NFR-29).
- `manifest.json` — run ID, seed, versions, timing (NFR-27, NFR-35).

The methodology and interpretation guidance live at
[`docs/evaluation/phase-08-methodology.md`](docs/evaluation/phase-08-methodology.md).

---

## Verification and gating

Every release ships with:

1. `mvn verify` — unit + integration tests, JaCoCo gate, SpotBugs,
   Checkstyle (server; **2726 tests** at this snapshot).
2. `cd client && npm test -- --coverage` — Vitest, V8 coverage.
3. `cd admin-ui && npm test -- --coverage` — Vitest, V8 coverage.
4. `scripts/run_all_checks.sh` — orchestrates the gate and writes an
   evidence bundle to `docs/evaluation/evidence/<phase>/<commit>/`.
5. Live verification against DHIS2 2.44-SNAPSHOT captured as JSON
   evidence under `docs/evaluation/evidence/phase-*/*/live-*.json`.
6. `scripts/evaluation/run_phase_08.sh` — NFR measurement bundle
   (opt-in; mandatory for pilot acceptance).

No phase advances unless the gate report records a `PASS` decision.

---

## Recent release lineage

The project has shipped continuously through the `der-2.x` stream.
Representative milestones:

- **`der-2.3.122`** — current stable snapshot captured in `VERSION`.
  Cumulative cluster-UI polish, security-chain hardening, pre-flight
  bundle, backup integrity probe, session-expiry audit, offline
  credential-age gate.
- **`der-2.4.0-alpha.1`** — most recent annotated tag; latest alpha.
- **`der-2.3.123`** (admin cluster UI polish) — nine admin-side screens
  flipped to DER UI standards; new DHIS2 mappings screen.
- **`der-2.3.99..121`** — iterative admin-ui + security hardening,
  TOTP MFA, device-approval policy, workflow-runs, inbound pull.
- **`der-2.0.x`** — ADR-0019 / ADR-0020 / ADR-0021 landed
  (device management, site analytics, hash-chained audit).
- **`der-1.0.0-rc.1`** — Phase 09 pilot release candidate
  (bare-metal installer, systemd + nginx + Postgres bootstrap).
- **`der-0.1.0..0.8.0-alpha.1`** — Phase 00 → Phase 08 evolution.

See [`CHANGELOG.md`](CHANGELOG.md) and
[`docs/releases/`](docs/releases/) for every intermediate release
(the `docs/releases/` directory carries notes for every stable and
alpha tag).

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the branch, PR, commit
and quality rules enforced by the gate.

Commit convention: single-author commits by the project maintainer
(`socaya`). No AI co-authorship appears in commit messages or release
artefacts.

---

## Academic integrity

The project follows the academic integrity policy in `docs/project/`.
All data in experiments is synthetic. The repository is the single
source of truth; no external systems or private channels carry
authoritative requirement, test, or evidence state.
