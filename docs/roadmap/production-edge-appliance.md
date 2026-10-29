# Production-Grade DER Edge Appliance — Roadmap

**Status:** Roadmap · Draft 1 · 2026-10-29
**Owner:** DER core team
**Scope:** Everything beyond the 2.1.x stream needed to call DER a
*production-grade EDGE Appliance*.

This is a planning document, not a design doc. Each section
captures what the gap is, why it matters for a facility deployment,
and the broad shape of the fix. Detailed design lands in per-phase
ADRs when a section comes off the backlog.

---

## 0. Where we are today (2.1.98)

Already shipped across the Network module (phases N1-N5):

| Area | Status |
|---|---|
| Access Point / DHCP / Local DNS / mDNS / Firewall | ✓ (N1) |
| Device enrolment + certificates + revocation + audit | ✓ (N2) |
| Central / Internet / LAN connectivity-state machine | ✓ (N3) |
| Interface priority + WAN failover automation | ✓ (N4) |
| WireGuard peer links · Add/Edit/Connect/Remove UI | ✓ (N5 v1) |
| mDNS peer discovery · invite tokens · health monitor | ✓ (N5 v2) |
| Device-to-device messaging bus with SSE push, E2E, CRDT | ✓ (DER-MSG v2) |
| Edge-to-edge forwarding with retry + loop prevention | ✓ (DER-MSG v2) |

The gap list below is what separates "feature-complete" from
"production-grade edge appliance a non-engineer can deploy and
run for years without supervision".

---

## 1. Peer-to-peer network maturity (continues from N5 v2)

### 1.1 Mesh routing + relay-through

Today's forwarding is single-hop point-to-point. Production mesh
needs multi-hop routing with:

- Deterministic shortest-path (hop count + measured latency)
- Loop prevention (visitedEdges + MAX_HOPS, already in 2.1.98)
- Store-and-forward relay — if an intermediate edge is reachable
  but the target isn't, buffer and forward when it recovers
- Backpressure per link so one slow edge doesn't DoS the mesh

### 1.2 Operator-signed peer invites

2.1.98 ships one-shot HMAC tokens; production needs:

- Invites signed by the DER internal CA (Ed25519) so a receiving
  edge can verify provenance without consulting the issuer
- Scoped capabilities (invite grants edge:read-only vs edge:full)
- Revocation list distributed through the normal mesh

### 1.3 Mesh topology view

A fleet dashboard showing every edge, every link, latency / packet
loss / uptime per link, who's reachable from where. Served by a
central aggregator the edges periodically POST a snapshot to.

### 1.4 CRDT mesh sync

Today CRDT ops route through the message bus (one-hop). Production
needs:

- Operation-based CRDT with vector clocks per edge
- Catch-up protocol: a late joiner pulls the full op log from any
  reachable replica, then catches up live
- Compaction so op logs don't grow forever (merge-on-stable)

### 1.5 Peer-to-peer streaming

Beyond discrete messages, a production edge might stream (audio,
screen share, large file transfer) between tablets. Options:

- WebRTC data channels with DER as signalling server
- Direct TCP tunnels through the WireGuard overlay

---

## 2. Observability

### 2.1 Metrics

- **Prometheus** exposition at `/actuator/prometheus`
- Custom metrics: AP uptime, peer link latency, journal depth,
  sync drift, device enrolment rate, failed-auth rate
- **Grafana** dashboard JSON shipped under `deployment/pilot/grafana/`
- **Alertmanager** rules for AP down, peer unreachable, journal
  depth > threshold, drift > threshold

### 2.2 Structured logs

- JSON log format in production (currently plain text)
- Correlation IDs attached across HTTP request → journal entry → audit event
- Log aggregation hook (fluent-bit → Loki or similar)
- Automatic PII scrubbing in logs

### 2.3 Distributed tracing

- OpenTelemetry integration
- Trace peer-forwarded messages across the mesh
- Tail-based sampling to keep storage bounded

### 2.4 Error reporting

- Sentry (or OSS equivalent — GlitchTip) integration for
  server-side exceptions
- Admin UI reports its own crashes

### 2.5 Audit tamper detection

- Hash-chain audit log (next-hop hash)
- Daily anchor to central
- Admin UI shows chain integrity badge

---

## 3. Fleet management

### 3.1 Central inventory

- Each DER edge heartbeats to a central inventory service:
  `edge-id, version, SSID, orgUnit, lastSeen, health`
- Dashboard: `fleet.ministry.gov` showing every edge
- Bulk-op panel: push a config change to N edges at once

### 3.2 Software update

- A/B partition updates (two root filesystems, flip on success)
- Signed release artifacts (ed25519 signatures verified by boot
  loader)
- Automatic rollback if `der-manager status` fails post-update
- Staged rollouts (canary 5% → 25% → 100% with health gates)
- Delta updates to save bandwidth

### 3.3 Zero-touch provisioning (ZTP)

- First boot shows a QR with a one-shot provisioning token
- Operator scans with phone → selects facility from a list
- DER pulls its config bundle from central inventory
- Full setup under 90 seconds without touching a keyboard

### 3.4 Remote diagnostic access

- Operator-approved reverse-SSH tunnel via a central relay
- Session recorded for audit
- Automatic cutover when the operator closes the ticket

---

## 4. Hardware integration

### 4.1 Watchdog + resilience

- Hardware watchdog (systemd-run-time + `/dev/watchdog0`)
- Service self-restart on repeated health-check failure
- Automatic sleep → wake on power events (laptop lid-close safe)

### 4.2 Status display

- LED strip or small OLED showing:
  - AP state (solid / blinking)
  - Central reachability (colour)
  - Enrol pending (slow pulse)
- Buzzer for critical alerts

### 4.3 UPS integration

- `apcupsd` / `nut` integration
- Battery percentage → `/network/status` + Overview facet
- Graceful shutdown at 10%

### 4.4 Thermal management

- CPU temperature + fan RPM in Diagnostics
- Thermal throttle warning
- Alert if sustained > 70°C

### 4.5 Hardware security module (optional)

- TPM-backed key storage for the DER CA + attestation keys
- Secure boot chain (shim → GRUB → kernel → DER keystore)

---

## 5. Backup + disaster recovery

### 5.1 Schedule + retention

- Hourly incremental + daily full snapshots
- Encrypted + compressed `pg_dump` + journal + configs
- 7-day local retention + 30-day off-box

### 5.2 Off-box backup

- Objectstorage target (S3/Spaces/Backblaze)
- End-to-end encrypted — the operator holds the key, DER
  server-side never sees plaintext
- Daily anchor-only (ciphertext tag) uploaded to central for
  non-repudiation

### 5.3 One-command restore

- `der-manager restore --from <snapshot>` fetches, decrypts,
  applies migrations, and brings the service up
- Dry-run mode to verify the snapshot before touching live state

### 5.4 Point-in-time recovery

- WAL archiving + base backup
- Restore to any second within the retention window

---

## 6. Security hardening

### 6.1 Mandatory access control

- AppArmor profile for `der-server.service` restricting:
  - FS access to `/opt/der`, `/var/lib/der`, `/etc/der`
  - Network: port 8085/8443 bind + outbound to configured hosts only
  - No ptrace, no reading /proc/*/mem

### 6.2 Rate limiting + brute force

- `fail2ban` jail for repeated auth failures
- In-app rate limiter on `/edge-api/v1/auth/sign-in` (already partial)
- Account lockout after N failures with linear backoff

### 6.3 Secrets management

- Vault / HashiCorp Vault Agent integration (optional)
- Local option: `age`-encrypted secrets with a boot-time passphrase

### 6.4 FIPS mode (compliance option)

- Switch to a FIPS-validated JVM + Postgres build
- Document which operations are FIPS-restricted

### 6.5 Audit log tamper detection

- Each row carries SHA-256 of (previous row + payload)
- Daily root hash posted to central and (optionally) chained to a
  public timestamp service

---

## 7. Compliance + data governance

### 7.1 Retention policy

- Operator sets retention per data category
- Automatic purge jobs with audit trail of what was purged

### 7.2 Right to erasure

- Admin UI flow: given a patient ID, show every row across every
  table, allow operator-approved purge with a signed receipt

### 7.3 Audit export

- Signed CSV / Parquet export of the audit log for compliance
  reviewers

### 7.4 Data residency

- Config flag: "stay within country X" — refuses to upload backups
  / telemetry to endpoints that resolve outside X

---

## 8. Admin UI maturity

### 8.1 Multi-edge view

- Fleet overview page (requires central inventory from §3.1)
- Compare config diff across edges
- Bulk-apply a change

### 8.2 Operator onboarding

- Guided first-boot wizard
- "Explain this screen" overlays for new operators
- Role-based tutorials (reception vs lab vs admin)

### 8.3 Accessibility

- WCAG 2.1 AA compliance pass
- Keyboard-only navigation of every flow
- Localisation framework (English + Luganda + Swahili + French to
  start)

### 8.4 Offline-first UI

- Service worker caches the admin UI shell
- Last-known data available in read-only mode when DER itself is
  down

---

## 9. Testing + evaluation

### 9.1 Chaos tests

- Kill random services; verify auto-recovery
- Simulated packet loss on peer links
- Clock skew between edges

### 9.2 Load tests

- 50 concurrent clients on DER-MSG v2
- 1000 messages/sec publish throughput
- 10k rows / minute journal depth

### 9.3 Soak tests

- 30-day continuous run on representative hardware
- Memory leak detection
- Log rotation verification

### 9.4 Golden deployment

- A reference Ubuntu image + hardware spec that we test every
  release against
- "Works on golden" is a CI gate

---

## 10. Deployment packaging

### 10.1 Debian package

- Build + sign a proper `.deb` so operators can
  `apt install der-server`
- Reverse-dep on `postgresql-17`, `network-manager`, etc.

### 10.2 Container image

- Minimal OCI image for the server itself (no OS plumbing)
- Separate "edge-appliance" image bundles OS + server for folks
  using Podman on an edge box

### 10.3 Reference hardware kits

- Published BOM for 3 tiers:
  - **Low:** Raspberry Pi 5 + external USB Wi-Fi adapter
  - **Medium:** Intel NUC-class mini PC
  - **High:** small 1U server for district-level sites

### 10.4 Documentation site

- `docs.der.health` — operator runbook, developer SDK, API
  reference
- Searchable, versioned, offline-downloadable

---

## 11. Milestone grouping

Grouping the above into realistic releases:

| Milestone | Scope | Target |
|---|---|---|
| **2.2.x** | §1 Peer mesh maturity + §4 Hardware integration (watchdog, UPS) | Q1 2027 |
| **2.3.x** | §2 Observability + §9 Testing + evaluation harness | Q2 2027 |
| **2.4.x** | §3 Fleet management + §10 Deployment packaging | Q3 2027 |
| **2.5.x** | §5 Backup/DR + §6 Security hardening | Q4 2027 |
| **3.0.x** | §7 Compliance + §8 Admin UI maturity + ZTP + reference HW kits | Q1 2028 |

Milestones are deliberately coarse — each one is 2-3 months of
focused work and ships a demonstrable "an operator can now …"
capability.

---

## 12. Non-goals (deliberately out of scope)

Even in a production-grade edge appliance DER doesn't:

- Replace the central DHIS2 — DER stays the facility-level
  companion, not a federated DHIS2
- Implement its own HR / user directory — it reads from DHIS2
- Act as a payment system
- Host arbitrary customer code (custom-apps are DHIS2 shaped only)
- Try to be a mesh router across facilities for traffic other than
  DER's own protocols

---

## 13. Open questions

1. **Hardware target.** Pick one reference Pi variant or support
   a matrix? (Lean towards: certify the "medium" tier, best-effort
   on the others.)
2. **Central inventory.** Build in-house or integrate with DHIS2's
   own instance-registry capabilities? (Investigation needed.)
3. **Signed updates.** Rebuild the apt tooling or integrate with
   `fwupd` / `casync`? (Depends on the reference hardware answer.)
4. **CRDT engine.** Build in-house LWW-Map + OR-Set or depend on
   Automerge-Rust via JNI? (Automerge is production-tested; JNI
   is risk.)
5. **Trace storage.** Central Jaeger instance or per-edge local
   buffer flushed on operator request? (Bandwidth-dependent.)

---

## Appendix A — "Done" criteria for production-grade

For DER to be called "production-grade" we need all of:

- [ ] Can be installed by a non-engineer in <10 min
- [ ] Runs 90 days continuous without touching
- [ ] Phones see DER-EDGE without manual intervention
- [ ] Central DHIS2 outage never loses operator work
- [ ] Software update rollback never leaves the box bricked
- [ ] Audit log is tamper-evident
- [ ] Operator can restore from backup in <30 min
- [ ] Fleet dashboard shows every edge at a glance
- [ ] Pilot operators report *"it just works"*
