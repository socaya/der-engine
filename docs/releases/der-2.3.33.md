# der-2.3.33 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.32`

## Headline

**Pilot deployment runbook + evidence bundle generator.** Everything a
pilot site needs to go from a bare Ubuntu Server VM to a running DER
edge, plus a weekly-cron-friendly script that snapshots the live
state into an archivable tarball.

## 1. `docs/pilot/README.md`

Six operational sections:

1. **Prerequisites** — Ubuntu 22.04, Postgres 17, OpenJDK 21, Nginx, DHIS2 2.44+.
2. **One-time install** — Postgres init + `.deb` install + `/etc/der/pilot.env`.
3. **First login + workflow authoring** — sign-in → sync → wizard →
   pin to snapshot.
4. **Operating a workflow** — queue, device auto-scope, program-rule
   validation.
5. **Metadata hygiene** — snapshots, pins, diffs, drift warnings.
6. **Peer-to-peer sharing** — register peers, push workflows.
7. **Evidence bundle** — weekly archive via the new script.
8. **What's NOT in this runbook** — central DHIS2 install, NFR
   evaluation, compliance paperwork (pointers to other docs).

## 2. `scripts/evaluation/evidence_bundle.sh`

Reads the live server state and writes a timestamped tarball:

```
evidence-<ts>/
  version
  system-health.json
  workflows.json
  workflows-canonical/*.json         (one per workflow)
  snapshots.json
  snapshot-diff-<prev>-<latest>.json
  devices.json
  queue.json
  peers.json
  rule-action-mix.txt                (when psql + PGPASSWORD present)
  manifest.json                      (SHA-256 of every file in the bundle)
```

Usage:

```
scripts/evaluation/evidence_bundle.sh \
    --base-url http://localhost:8085 \
    --username der-admin --password '<pass>' \
    --out /var/lib/der/evidence/
```

Or reuse an existing session:

```
scripts/evaluation/evidence_bundle.sh \
    --base-url http://localhost:8085 \
    --session-cookie "$DER_SESSION" \
    --out ./ev
```

Verified against the live edge: produced a 24 KB tarball with 20+
workflow canonical JSONs + manifest hashes.

## 3. Verified

```
bash scripts/evaluation/evidence_bundle.sh …   ✓ wrote evidence-<ts>.tar.gz
tar -tzf …                                      ✓ 20+ canonical workflow files
                                                   + system-health, workflows,
                                                   snapshots, queue, devices,
                                                   peers, manifest.json
Runbook has 8 operational sections                     ✓
```

## 4. Files changed

```
docs/pilot/README.md                             (new)
scripts/evaluation/evidence_bundle.sh            (new, executable)
VERSION / server/pom.xml / admin-ui/package.json / sw.js / client/package.json — 2.3.33
```

## 5. Follow-ups

- Scheduler-triggered weekly cron that runs the bundle script and
  rsyncs the archive off-host.
- Signed bundles — add GPG signature over `manifest.json` so the
  archive is provably untampered.
- Phase-08 integration — fold the bundle format into
  `docs/evaluation/phase-08-methodology.md` so NFR runs capture the
  same snapshot.
