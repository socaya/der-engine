# DER 1.0.0-rc.1 — Phase 09: pilot deployment runbook (release candidate)

> **Scope:** The first release packaged for pilot deployment. Topology
> is ADR-0014 (systemd-on-Debian/Ubuntu, bare metal, no containers).
> Phase 08's measurement harness runs on the pilot host and produces
> the acceptance evidence bundle; the stable `der-1.0.0` tag ships
> after a successful pilot sign-off.

**Release label:** `der-1.0.0-rc.1`
**Git tag:** `der-1.0.0-rc.1`

## New

- `ADR-0014 Pilot deployment topology` — accepted. Decision: bare
  metal + systemd + nginx + Postgres from distro. No Docker, no
  Kubernetes.
- `deployment/pilot/`:
  - `install.sh` — idempotent installer: creates `der` user, lays out
    `/opt/der`, `/etc/der`, `/var/lib/der`, `/var/log/der`, bootstraps
    Postgres role + DB, installs systemd unit and nginx server block.
  - `smoke_test.sh` — five-step post-install check (health,
    sign-in, metadata read, backup round-trip, journal worker).
  - `upgrade.sh` — snapshot `/opt/der.<ts>`, swap jar + SPAs, restart;
    Flyway advances on service start.
  - `rollback.sh <ts>` — restore the snapshot; the runbook spells
    out the pg_restore prerequisite when Flyway advanced the schema.
  - `env.pilot.example` — operator env template with every tunable
    (DHIS2 pin, bootstrap admin, backup paths, Quartz crons, JVM).
  - `systemd/der-server.service` — hardened unit with
    `MemoryMax=2G`, `TasksMax=512`, read-write path allowlist.
  - `nginx/der-edge.conf` — reverse-proxy block for `/`, `/admin/`,
    `/api/`, `/edge-api/`, `/dhis-web-*/`.
  - `postgres/bootstrap.sql` — idempotent role + database SQL.
- `docs/operations/pilot-runbook.md` — authoritative install → day-2 →
  troubleshoot → upgrade → rollback → acceptance-evidence runbook.
  Includes the TLS switch via certbot, log-rotation drop-in, and the
  RPM-family adaptation guidance.
- `docs/evaluation/evidence/phase-09/` — expected directory layout
  for the pilot acceptance bundle produced by the Phase 08 harness
  running on real hardware.

## Test state

- All 835 server tests pass; JaCoCo + SpotBugs + Checkstyle green.
- Pilot shell scripts parse cleanly (`bash -n`); the runbook
  mandates `shellcheck` as part of per-site hardening.
- No new server code — this release is runbook-only.

## Deliberate non-goals

- Container packaging (Docker/OCI image, Compose, Helm) — a
  post-pilot concern.
- Multi-node HA — the pilot host is single-tenant.
- Automatic nightly backup inside DER — operators drive the schedule
  via `cron` + `curl` (runbook §7.1). Admin-triggered on-demand
  backups remain the primary surface.
- Down-migrations. Rollback through a schema advance uses Phase 07
  restore (`POST /edge-api/v1/restore/request`), consistent with
  ADR-0012 §non-goals.

## Promotion to stable 1.0.0

Pilot operator produces an acceptance evidence bundle via
`scripts/evaluation/run_phase_08.sh` on the pilot host (runbook §11).
If the bundle shows:

- NFR-15 p95 under 2 s on the health probe,
- NFR-17 drain-to-zero for 100 and 1000 ops without `timedOut`,
- NFR-29 `backup-integrity.json.match=true`,
- NFR-18 RSS under 2 GB sustained,

the stable `der-1.0.0` tag is cut from this commit with no code
changes. If the bundle regresses, a `-rc.2` ships the fix.
