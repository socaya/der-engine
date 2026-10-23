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

Reference environment:

- **OS:** Linux 6.x (tested on Ubuntu 22.04 LTS and Fedora 40).
- **Java:** OpenJDK 21.0.4+ (any distribution; Temurin recommended).
- **PostgreSQL:** 17.x with the following roles pre-provisioned:
  `der_app` (owner), `der_ro` (optional read-only).
- **Node:** 20.x LTS for building `client/` and `admin-ui/`.
- **npm:** 10.x.

Reproducibility recipe:

```
# 1. Clone + build server.
./mvnw -f server/pom.xml verify

# 2. Build client PWA.
(cd client && npm ci && npm run build)

# 3. Build admin UI.
(cd admin-ui && npm ci && npm run build)

# 4. Initialise Postgres.
createdb der
psql -d der -c "CREATE SCHEMA der;"

# 5. Boot server.
java -jar server/target/der-server-*.jar
```

A single `scripts/deploy/install.sh <version>` wraps steps 1–5 for
operator machines (FR-01-08).

Known deviations:
- macOS works for development but is not a reference deployment
  target. The `BackupEncryption` subprocess path assumes
  `/usr/bin/openssl` availability — macOS ships 3.x by default.
- Windows is unsupported.

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
