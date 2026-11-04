# DER component separation + portability + time correctness

Companion to NFR-23 (component separation), NFR-24 (portability /
reproducibility), NFR-28 (time correctness).

## NFR-23 — component separation

```
┌───────────────────┐   ┌────────────────────────────┐
│ client/           │   │ admin-ui/                  │
│  React PWA (DC-*) │   │  React admin console (EA-*)│
└─────────┬─────────┘   └──────────────┬─────────────┘
          │                             │
          │  HTTPS cookie-session       │  HTTPS cookie-session
          │                             │
┌─────────▼─────────────────────────────▼─────────────┐
│                     server/                          │
│   Spring Boot 3.3  —  ug.ac.mak.der.*                │
│                                                      │
│   web/        REST surface (controllers)             │
│   security/   Argon2id, sessions, RBAC, MFA, audit   │
│   metadata/   DHIS2 mirror + sync service            │
│   workflows/  aggregate, events, journal, backup,    │
│               capture-workflow, referral             │
│   scheduler/  Quartz jobs (JDBC JobStore)            │
│   dhis2/      compatibility probe + profile matrix   │
│   orgunit/    binding + scope interceptor            │
│   analytics/  materialised view + refresh job        │
│   approval/   per-op approval queue                  │
│   device/     edge-device registry                   │
│                                                      │
│   PostgreSQL 17                                      │
└───────────────────────────┬──────────────────────────┘
                            │ /api/dataValueSets, /api/events, /sync/notify
                            │ /api/metadata (pull), /api/system/info
                            │
                   ┌────────▼─────────┐
                   │ Central DHIS2    │
                   │  (external)      │
                   └──────────────────┘
```

Each package is independently testable; no cross-package circular
dependencies (verified: a Checkstyle rule rejects
`workflows → web` imports). The sync worker runs in its own Quartz
thread pool and never blocks the capture path (ADR-0004,
ADR-0010).

**Separation evidence:**
- `server/pom.xml` JaCoCo per-package coverage shows each package
  carries its own tests.
- `scripts/run_all_checks.sh` runs server + client + admin-ui test
  suites independently.
- `agents/dhis2-edge-agent/` is an independent Maven module (not
  the DER server JAR) — fulfils "integration separation" from the
  roadmap.

## NFR-24 — portability

DER is deployed **bare-metal / VM on reference Linux**. Container
orchestration is intentionally out of scope — pilot sites run
single-tenant edges where a systemd + nginx + Postgres stack is the
operational baseline.

### Reference environment (pinned)

| Component      | Pinned version              | Source                                        |
|---              |---                         |---                                            |
| OS              | **Ubuntu Server 24.04 LTS** | Canonical ISO — `ubuntu-24.04-live-server-amd64.iso` |
| Kernel          | Linux 6.8.x                 | shipped with 24.04                            |
| Java            | **OpenJDK 21** (headless)   | `openjdk-21-jre-headless`                     |
| PostgreSQL      | **17.x**                    | `postgresql-17` from the PGDG apt repo        |
| nginx           | **1.24.x**                  | `nginx` from Ubuntu main                      |
| nftables        | 1.0.9+                      | `nftables` from Ubuntu main                   |
| Node (build-side) | **20.x LTS**              | `nodejs` from Ubuntu main                     |
| npm             | **10.x**                    | ships with Node 20                            |
| systemd         | 255.x                       | ships with 24.04                              |

Known-good minor-version floor is enforced at install time by
`deployment/pilot/install.sh`; newer minors of each component pass
the gate but downgrade is not supported.

### Reproducibility recipe (3 steps)

Start from a fresh Ubuntu 24.04 LTS install (ISO install or cloud
image). The three commands below take a bare host to a running
DER edge:

```bash
# 1. Host prerequisites — Java, Postgres, nginx, nftables, support utils.
#    Idempotent; records an audit manifest at /etc/der/bootstrap.manifest.json.
sudo scripts/install/bootstrap-host.sh

# 2. Build the three deliverables from the pinned source tree.
./server/mvnw -f server/pom.xml -q package -DskipTests
( cd client && npm ci && npm run build )
( cd admin-ui && npm ci && npm run build )

# 3. Lay out /opt/der + /etc/der + /var/lib/der, wire the systemd unit,
#    configure nginx, bootstrap the Postgres role + schema.
sudo deployment/pilot/install.sh
```

`bootstrap-host.sh --dry-run` prints the apt list without touching the
system; this is the format you hand to an infosec reviewer before
running on a real host. `bootstrap-host.sh --node` also installs the
Node 20 toolchain when the build happens on the same host as the
runtime.

### Deployment artifacts under version control

- `scripts/install/bootstrap-host.sh` — NFR-24 OS prerequisites (new).
- `deployment/pilot/install.sh` — pilot deployer (FR-01-08).
- `deployment/systemd/der.service.example` — systemd unit.
- `deployment/postgresql/der-db-bootstrap.sql` — role + schema init.
- `deployment/nginx/` — reverse-proxy site config + TLS sketches.
- `deployment/pilot/nftables/`, `apparmor/`, `fail2ban/` — hardening.
- `scripts/deploy/{install,upgrade,rollback}.sh` — artefact lifecycle.

### Non-reference platforms

- **macOS** works as a dev loop (see `README.md` §Local DHIS2 2.44)
  but is not a deployment target. `BackupEncryption` calls
  `/usr/bin/openssl`; macOS ships OpenSSL 3.x, which is API-compatible
  but the audit evidence for restore (NFR-29) is only captured on
  the reference Linux build.
- **Fedora / RHEL** — the DER code runs, but operators must substitute
  `dnf` + the PGDG RPM repo for the `apt` lines in `bootstrap-host.sh`.
  Tested informally on Fedora 40; not in CI.
- **Windows** is unsupported.

## NFR-28 — time correctness

- The server is set to **UTC internally**; all timestamps in schema
  and journal payloads are UTC (`TIMESTAMPTZ`).
- Operator-side NTP is **required** — `install.sh` prints a warning
  if the system clock has drifted more than 60s from `time.google.com`
  on install.
- A runtime clock-drift probe is exposed at
  `GET /edge-api/v1/system/health` — the response's `timestamp`
  field can be compared against the caller's clock to detect skew.
- Session issuance uses `Instant.now(clock)` with the Spring-managed
  `Clock` bean — tests inject fixed clocks for repeatability
  (NFR-27).

## NFR-25 — local vs. central-accepted distinction

- Every captured record carries a `state` field in
  `operation_journal` (`PENDING / IN_FLIGHT / CENTRAL_ACCEPTED /
  CENTRAL_REJECTED / RETRYABLE / UNKNOWN_OUTCOME / CONFLICT_REVIEW`).
- Client UIs (DC-17 Drafts, EA-ANA-01 analytics) render a status
  pill for each state via `components/StatusPill.tsx`
  (`CENTRAL_ACCEPTED` → green; `PENDING` / `RETRYABLE` → amber;
  `CENTRAL_REJECTED` / `CONFLICT_REVIEW` → red).
- The admin EA-10 Journal view (EACoreScreens) exposes the same
  distinction with a tooltip explaining each state.

## NFR-26 — accessibility

- Admin UI builds use `@dhis2/ui` primitives that ship WAI-ARIA
  attributes.
- Playwright `axe-core` sweep runs per screen (`admin-ui/e2e/axe.spec.ts`)
  and gates CI; zero violations today across the 19 shipped EA
  screens.
- Keyboard navigation verified via Playwright's `page.keyboard`
  for the primary flows (sign-in, approve queue, inbox resolve).
- Known gap: the embedded capture-workflow JSON textarea is a
  single large text region — screen readers read it as code. A
  structured step editor is slated for a 2.1.0 UI pass.
