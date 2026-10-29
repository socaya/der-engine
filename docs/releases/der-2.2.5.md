# der-2.2.5 (stable)

**Date:** 2026-10-30
**Previous stable:** `der-2.2.4`

## Headline

**§9 Testing — operator-triggered chaos / load / soak / golden-deploy.**

- `der.testing_run` table captures every run with aggregate latency +
  outcome.
- In-process **load**, **soak**, and non-destructive **chaos** scenarios
  run server-side via `/testing/*`.
- Destructive chaos (postgres restart, network flap) + golden-deploy
  verification run from `scripts/evaluation/*.sh` and post results back
  via `POST /testing/runs` so the audit history is complete.
- Admin UI `/testing` page under **System** group — one-click triggers +
  live run history.

## 1. Schema (V041)

```sql
der.testing_run (
  run_id             uuid primary key,
  kind               CHAOS | LOAD | SOAK | GOLDEN,
  scenario           text,
  started_at         timestamptz,
  finished_at        timestamptz,
  outcome            RUNNING | PASS | FAIL | ABORTED,
  duration_ms        bigint,
  requests_total     bigint,
  requests_failed    bigint,
  latency_p50_ms     bigint,
  latency_p95_ms     bigint,
  latency_p99_ms     bigint,
  throughput_rps     double precision,
  details            jsonb,
  triggered_by       text
)
```

Indexes on `(kind, started_at desc)` and `(outcome)`.

## 2. In-process load / soak / chaos

`TestingHarnessService` runs a thread pool against the health endpoint,
collects per-request latency, and persists aggregate percentiles.

- **LOAD** — short bursts (clamped 1–60 s), used by `load.sh`.
- **SOAK** — longer sustained probes (clamped 1–600 s), used by `soak.sh`.
- **CHAOS `pool-saturation`** — 24 workers × 3 s to validate connection
  pool recovery; proves degradation + recovery under oversubscription.
- **CHAOS `slow-start`** — single-threaded trickle; validates cold-cache
  latency.

Only one run executes at a time (`ReentrantLock#tryLock`) so an operator
clicking twice gets a 500 rather than confused interleaving.

## 3. Script-driven destructive chaos

`scripts/evaluation/chaos.sh` adds scenarios the in-process harness
cannot do:

- `pg-restart` — stops postgres, starts it, probes `/system/health`
  recovery for up to 30 s, records duration + outcome.
- `network-flap` — cycles loopback (safe surrogate for upstream NIC
  flap on real hardware).

Each posts the final totals to `POST /testing/runs` so the admin UI
history shows all runs regardless of trigger.

## 4. Golden deployment verifier

`scripts/evaluation/golden_deploy.sh` asserts a fresh install matches
the known-good state:

- `/edge-api/v1/system/health` returns 200.
- `/edge-api/v1/fleet`, `/compat`, `/activity/recent` all 200 behind
  admin cookie.
- `/admin/` + `/admin/sw.js` both 200.
- Tiny load probe (c=2, d=2 s) PASS.
- Final GOLDEN run with outcome=PASS recorded.

Any failure exits non-zero and prints the failing step — CI gate for
packaging in 2.2.6.

## 5. Endpoints

```
GET  /edge-api/v1/testing                — summary + last 50 runs
GET  /edge-api/v1/testing/runs?limit=N   — just the rows
POST /edge-api/v1/testing/load?concurrency=&durationSec=
POST /edge-api/v1/testing/soak?concurrency=&durationSec=
POST /edge-api/v1/testing/chaos?scenario=pool-saturation|slow-start
POST /edge-api/v1/testing/runs           — record a script-driven run
```

All ADMIN-gated.

## 6. UI — `/testing` page

Three one-click triggers (Load, Chaos, Soak) + live history table with
outcome chip, duration, request totals, p50/p95/p99, rps, operator.

Added to the **System** group between Evaluation and Alerts.

## 7. Verified live

```
summary.totalRuns:     0 → 16 across the sweep
runs recorded:         CHAOS, GOLDEN, LOAD, SOAK (all PASS)
load (c=4, d=2s):      19,814 req, 0 failed, 9,897 rps
chaos pool-saturation: 69,142 req, 0 failed → PASS (no connection drops)
soak (c=1, d=2s):      14,907 req, 0 failed
script-driven GOLDEN:  recorded via POST /testing/runs with triggered_by=der-admin
UI page:               screen rendered, btn-load / btn-chaos / btn-soak present, 16 rows
pageerrors:            0
```

## 8. Files changed

```
database/migrations/V041__phase_prod_testing.sql                           (new)
server/src/main/java/ug/ac/mak/der/testing/TestingHarnessService.java      (new)
server/src/main/java/ug/ac/mak/der/web/TestingController.java              (new)
server/src/main/java/ug/ac/mak/der/security/SecurityConfig.java            — permit /testing/** for ADMIN
scripts/evaluation/chaos.sh                                                 (new)
scripts/evaluation/load.sh                                                  (new)
scripts/evaluation/soak.sh                                                  (new)
scripts/evaluation/golden_deploy.sh                                         (new)
admin-ui/src/screens/Testing.tsx                                            (new)
admin-ui/src/App.tsx                                                        — /testing route
admin-ui/src/app/navigation.ts                                              — Testing sub-tab under System
admin-ui/public/sw.js                                                       — SW_VERSION → 2.2.5
```

## 9. Next step in the sequential march

- **2.2.6** — §10 Packaging (.deb, OCI, HW kits, docs site)

## Build + test

```
tsc -b && vite build                          ✓ 80 modules
./mvnw -q -DskipTests clean package           ✓ 2.2.5 JAR + V041 applied
E2E Playwright sweep                          ✓ 16 runs recorded, 0 pageerrors
```
