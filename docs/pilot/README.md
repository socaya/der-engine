# DER Pilot Deployment Runbook

**Status:** stable as of der-2.3.33
**Target audience:** facility IT lead + implementing partner

This runbook walks a pilot operator from a bare Ubuntu Server VM to
an edge instance that captures routine data, enforces program-rule
validation, and can be swapped between workflow definitions without
redeploying.

For richer architecture context see `docs/architecture/` and the
spec at `docs/requirements/DER_Workflow_Module_Comprehensive.md`.

---

## 0. Prerequisites

| Component            | Version        | Where it lives                       |
|---                   |---             |---                                   |
| Ubuntu Server        | 22.04 LTS      | pilot facility host (bare metal or VM) |
| Postgres             | 17             | same host, Unix-socket preferred      |
| OpenJDK              | 21             | DER server JVM                        |
| Nginx                | 1.24+          | TLS termination + /admin + /          |
| Node 20              | npm 10         | for client / admin-ui builds (dev only) |
| DHIS2                | 2.44 or newer  | central (anywhere reachable; TCP-only ok) |

The host needs ~2 GB RAM minimum (4 GB recommended) and 50 GB disk
for the mirror, journal and operation history.

---

## 1. One-time install

Everything below is scripted in `scripts/der-manager.sh`. Running it
by hand looks like:

```bash
# As root on the pilot host.
apt update
apt install -y postgresql-17 openjdk-21-jre-headless nginx tar jq curl

sudo -u postgres psql <<'SQL'
CREATE USER der WITH PASSWORD '<generate-and-store>';
CREATE DATABASE der OWNER der;
GRANT ALL PRIVILEGES ON DATABASE der TO der;
SQL

# Install DER package (built by scripts/release.sh).
dpkg -i der_<version>_amd64.deb

# One-shot config file.
cat >/etc/der/pilot.env <<EOF
DER_DB_URL=jdbc:postgresql://localhost:5432/der
DER_DB_USERNAME=der
DER_DB_PASSWORD=<the-password>
DER_SESSION_SECRET=$(openssl rand -base64 48)
DER_BOOTSTRAP_ADMIN_USERNAME=der-admin
DER_BOOTSTRAP_ADMIN_PASSWORD=$(openssl rand -base64 24)
DER_DHIS2_CENTRAL_URL=https://dhis2.example.gov
DER_DHIS2_USER=der-pilot
DER_DHIS2_PASSWORD=<the-dhis2-password>
EOF

systemctl enable --now der-server
```

Verify:

```bash
curl -s http://localhost:8085/edge-api/v1/system/health | jq .status
# "UP"
```

TLS + hostname go through `scripts/der-manager.sh ssl` (see that
script for details).

---

## 2. First login + workflow authoring

1. Browse to `https://der.<facility>.local/admin/sign-in`, sign in
   with the bootstrap admin credentials from `/etc/der/pilot.env`.
2. Open **DHIS2 → Metadata**, trigger a sync. Wait until the sync
   status shows **UP** and the counters match what you expect
   (programs, dataElements, programRules).
3. Open **Workflows → New**. The three-step wizard:
   - Step 1: pick the capture type (Aggregate / Event / Tracker).
   - Step 2: name the workflow + pick the DataSet or Program by name.
   - Step 3: tick which sections / stages are captured, assign a
     role + device per step, flip the Approval / Enabled toggles,
     add explicit dependencies if the default linear chain is wrong.
4. Save → the workflow appears in **Workflows**. Operators can now
   open runs against it.

Pin the workflow to the current snapshot via the **Metadata pin**
panel in step 3 — this locks its schema even if a later upstream
metadata change renames a field.

---

## 3. Operating a workflow

- Operators pick up assigned steps via **My queue**. The queue
  auto-scopes to their preferred device after the first pick.
- The server runs §35 program rules and §36 progressive validation
  on every contribute. ERROR findings block completion; WARNINGs
  surface in the per-run validation page.
- Approval-gated workflows require a REVIEWER to sign off on the
  compiled payload before it writes to the DHIS2 outbound journal.

---

## 4. Metadata hygiene

- **Snapshots** page lists every sync. Pin workflows to known-good
  snapshots; retire obsolete ones.
- **Compare** column opens the per-UID diff: added / removed /
  changed per resource (programs, dataElements, programRules …).
- Program-rule validation findings labelled `PINNED_SNAPSHOT_DRIFT`
  mean the pin has gone stale (a later sync overwrote the pinned
  row); the evaluator falls back to the live mirror automatically.

---

## 5. Peer-to-peer sharing (optional)

If the pilot runs across two or more facilities:

1. On each edge, open **Workflows → Peers** and register the others.
2. Push a workflow by picking it from the row and clicking **Push**.
3. On the receiving edge the canonical JSON lands via
   `/workflows/import` and appears in the catalogue.

Service-account auth for inter-edge push is a follow-up — pilots on
a shared VPN use a shared bootstrap cookie.

---

## 6. Evidence bundle

Every DER release ships `scripts/evaluation/evidence_bundle.sh`
which snapshots the running system into a tarball. Run it once a
week:

```bash
sudo -u der scripts/evaluation/evidence_bundle.sh \
     --base-url http://localhost:8085 \
     --session-cookie "$(cat /etc/der/pilot.cookie)" \
     --out /var/lib/der/evidence/
```

The resulting tarball contains:

```
evidence-<ts>/
  version
  system-health.json
  workflows.json
  workflows-canonical/*.json
  snapshots.json
  devices.json
  queue.json
  rule-action-mix.txt
  manifest.json
```

Store the tarball off the host. On incident the bundle plus the
server log answers "what was running when it happened".

---

## 7. What's deliberately NOT in this runbook

- The DHIS2 central install itself (upstream has its own guide).
- Hardware procurement, UPS sizing, LAN topology — see
  `docs/hardware/`.
- Compliance paperwork — see `docs/compliance/`.
- NFR evaluation (phase 08) is a dedicated process; this runbook is
  for day-two operations.

---

## 8. Who to call

- Workflow / rule questions → DER engineering team.
- DHIS2 upstream questions → central MOH DHIS2 team.
- Infrastructure (networking, TLS, storage) → facility IT lead.

Keep a copy of `/etc/der/pilot.env`'s session secret + admin
password in the facility's break-glass vault. Rotate quarterly.
