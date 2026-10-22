# ADR-0014: Pilot deployment topology

- Status: **ACCEPTED**
- Date decided: 2026-10-22
- Deciders: socaya
- Related: ADR-0001 (Postgres-only), ADR-0004 (hybrid edge), ADR-0012
  (backup engine), ADR-0013 (NFR evaluation)

## Context

Phase 09 ships DER to pilot operators. The question is **how** — bare
metal via systemd, containers via Docker, or Kubernetes. The pilot
hardware fingerprint (Phase 08 methodology §1) is a modest Debian/Ubuntu
box with no container runtime pre-installed; adding Docker/K8s doubles
the install footprint and the surface area that must be documented and
secured.

## Decision

Pilot deployment is **systemd-on-Debian/Ubuntu LTS, bare metal**, with
PostgreSQL 17 installed from the distro repo and the DER server + two
SPAs served through nginx. No Docker, no Kubernetes, no process
supervisor other than systemd.

### Topology

```
┌───────────────────────────────────────────────────────────────┐
│ Pilot host (Debian 12 / Ubuntu 24.04 LTS)                     │
│                                                               │
│  nginx :8080  ────┬──> /         client SPA (dist on disk)    │
│                   ├──> /admin/   admin-ui SPA (dist on disk)  │
│                   ├──> /api/     der-server :8085 (localhost) │
│                   └──> /edge-api/ der-server :8085            │
│                                                               │
│  der-server.service (systemd)                                 │
│    │ Java 21 fat jar at /opt/der/der-server.jar               │
│    │ env file at /etc/der/pilot.env                           │
│    │ writes archives to /var/lib/der/backups                  │
│    │ writes logs to /var/log/der                              │
│    │                                                          │
│    ▼                                                          │
│  postgresql.service (distro package)                          │
│    │ roles: der (owner), der_app (login)                      │
│    │ database: der                                            │
│                                                               │
└───────────────────────────────────────────────────────────────┘
                             │ outbound HTTPS only
                             ▼
                     DHIS2 central server
                     (not deployed on this host)
```

### Why bare metal

- Pilot hardware: 2–4 vCPU, 4–8 GB RAM. Docker overhead + an extra
  TCP hop (host → container network → host) measurably costs on
  arm64 boards running Ubuntu. Phase 08 numbers must be portable.
- One package per service. `apt install postgresql-17`, `apt install
  openjdk-21-jre-headless`, drop a jar. Operator can read every file.
- systemd gives us journald integration + `Restart=on-failure` +
  resource-limit knobs without extra tooling.
- Backup archives (ADR-0012) land on the host filesystem, not a
  mounted container volume operators forget to persist.

### Install sequence

The `deployment/pilot/install.sh` idempotent installer handles all of:

1. Prereq check (Debian/Ubuntu, systemd, Java 21, Postgres 17 reachable).
2. Create `der` system user; lay out `/opt/der`, `/etc/der`,
   `/var/lib/der`, `/var/log/der` with the right owner/mode.
3. Install the DER server fat jar + both SPA `dist/` bundles.
4. Install the systemd unit (`der-server.service`) and nginx server
   block.
5. Create the Postgres role + database via `psql` (idempotent via
   `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object ... END $$`).
6. First-run: DER starts, Flyway applies V001..V011, bootstrap admin
   is created from env.
7. Smoke test (`deployment/pilot/smoke_test.sh`) verifies /health,
   admin sign-in, and a backup round-trip.

### Upgrade and rollback

- **Upgrade** is swap-the-jar-and-restart. New migrations apply on
  restart (`spring.flyway.enabled=true`); Flyway failures leave the
  previous schema version in place so the old jar can be restored.
- **Rollback** is swap the previous jar back. If a Flyway migration
  ran, forward-only rollback via the Phase 07 backup/restore engine —
  we do **not** ship a down-migration path (ADR-0012 §non-goals).

### Not in scope

- Container packaging (Docker/OCI image) — a post-pilot concern.
- Kubernetes manifests, Helm charts.
- Multi-node HA — a single pilot host has no concept of leader
  election; horizontal scaling is Phase 10+ work.
- TLS termination inside DER — nginx handles it with a certbot
  cert; the included server block is HTTP-on-:8080 for the LAN
  topology (TLS runbook under `deployment/tls/README.md`).

## Consequences

- Operators who want Docker fork the `deployment/pilot/` tree and
  write their own Dockerfile. The runbook in `docs/operations/pilot-runbook.md`
  stays bare-metal.
- The installer assumes `apt`. The runbook has a "RPM-family manual
  adaptation" section pointing at the equivalent steps for Fedora/RHEL.
- The Phase 08 NFR numbers are measured on bare metal and are
  valid for Phase 09 acceptance without a Docker-overhead correction.
