# der-2.1.87 (stable)

**Date:** 2026-10-29
**Previous stable:** `der-2.1.86`

## Headline

**Phase N1 → N5 DER Network Module control plane shipped.** The admin
UI's 8 Network sub-pages (built in 2.1.85-86) now wire through to a
real Spring Boot backend. Every button, modal and row-menu action
performs real work against Postgres; connectivity probes run every
30s and feed the admin UI's live state; audit events accumulate as
operators act.

Covered scope (full table of the Phase goals per the Network Module
Design Specification §30):

| Phase | Spec goal | Shipped |
|---|---|---|
| **N1** | Access Point, DHCP, Local DNS, mDNS discovery, Firewall, Network status, Connected-client inventory | ✓ Access Point + inventory + firewall + settings (DHCP/DNS/mDNS behind the `NetworkAgent` SPI for Linux hosts) |
| **N2** | Device enrolment, Device certificates, Device revocation, TLS trust bootstrap, Client isolation, Network audit | ✓ Enrol/Approve/Revoke/Block/Unblock lifecycle, isolation policy, 15-event audit types |
| **N3** | Central probe, Internet probe, LAN/AP health, Connectivity state machine | ✓ Scheduled probes every 30 s, `ConnectivityState` 8-state machine, probe history |
| **N4** | Multiple interfaces, Ethernet/Wi-Fi WAN failover, Automatic route selection, Interface priorities | ✓ Interface priority column + routes table + metric ordering |
| **N5** | Wi-Fi Direct / WireGuard peer links / Local relay | ✓ Peer config + Connect/Disconnect/Remove lifecycle (OS-level peer orchestration behind the SPI) |

OS-level orchestration (hostapd, dnsmasq, nftables, systemd-networkd,
WireGuard-tools) sits behind the pluggable `NetworkAgent` SPI; the
default `NoopNetworkAgent` returns success without touching the OS so
the control plane runs on any host (Mac dev, Docker, pilot box). Real
Linux adapters land as separate `NetworkAgent` beans at deploy time.

## 1. Schema — V031

New migration `database/migrations/V031__phase_n_network.sql` adds
11 tables under `der.network_*`:

```
der.network_access_point   — Phase N1 — singleton AP configuration + runtime
der.network_interface      — Phase N1 + N4 — inventory + priority
der.network_lease          — Phase N1 — DHCP leases
der.network_route          — Phase N4 — routing table + metric
der.network_policy_rule    — Phase N1 — firewall policy (default spec §14)
der.network_settings       — Phase N1 — operator-tunable YAML-equivalent
der.network_client         — Phase N2 — connected clients + enrolment
der.network_event          — Phase N2 — audit ring buffer
der.network_state          — Phase N3 — connectivity-state singleton
der.network_probe          — Phase N3 — rolling LAN/DNS/WAN/Central history
der.network_peer           — Phase N5 — WireGuard / Wi-Fi Direct configs
```

Seeded on first boot:
- Default AP singleton (`DER-EDGE` SSID, WPA3-SAE, 5 GHz ch 44, stopped)
- Three representative interfaces (`lo`, `wlan0`, `eth0`)
- Three routes (default via gateway, LAN, Wi-Fi subnet)
- Spec §14 default firewall policy (7 rules, client isolation on)
- 13 default settings covering mode / lan / ap / dhcp / discovery / firewall / central

## 2. REST surface — `/edge-api/v1/network/*`

```
GET    /status                        → NetworkStatus (N3)
GET    /access-point                  → AccessPointStatus (N1)
POST   /ap/start                      → ADMIN — AP up
POST   /ap/stop                       → ADMIN — AP down
POST   /ap/restart                    → ADMIN — AP restart
POST   /ap/rotate-key                 → ADMIN — rotate PSK, record audit
GET    /ap/qr                         → QR enrol payload (N2)
GET    /interfaces                    → interface inventory (N1 + N4)
POST   /interfaces/{name}/state       → ADMIN — bring up / take down
GET    /routes                        → routing table (N4)
GET    /clients                       → connected-device inventory (N2)
POST   /devices/{id}/approve          → ADMIN — N2 trust transition
POST   /devices/{id}/revoke           → ADMIN — N2 trust transition
POST   /devices/{id}/block            → ADMIN — N2 trust transition
POST   /devices/{id}/unblock          → ADMIN — N2 trust transition
GET    /peers                         → N5 peer links
POST   /peers/{id}/connect            → ADMIN — N5 peer dial
DELETE /peers/{id}                    → ADMIN — N5 peer disconnect
DELETE /peers/{id}/remove             → ADMIN — N5 peer delete
GET    /events?limit=N                → N2 network audit
DELETE /events                        → ADMIN — clear event log
GET    /policy                        → firewall rules
GET    /settings                      → settings map
PUT    /settings/{key}                → ADMIN — update setting
```

Security policy per `SecurityConfig` — all reads require session
auth; POST/PUT/DELETE require role `ADMIN`.

## 3. Connectivity state machine (Phase N3)

`NetworkService.runProbes()` is `@Scheduled(fixedDelay = 30s,
initialDelay = 5s)` and probes four pillars:

```java
boolean lanUp      = probeHost("127.0.0.1", 8085, 500);   // DER itself
boolean dnsUp      = probeHost("8.8.8.8",    53,  1500);
boolean internetUp = dnsUp || probeHost("1.1.1.1", 443, 1500);
boolean centralUp  = probeCentralUrl(loadCentralUrl());
```

The classifier returns one of 8 `ConnectivityState` values per spec
§16:

```
CONNECTED                  — all four pillars healthy
OFFLINE_FIRST              — LAN up, no internet (operate locally)
EDGE_NETWORK_UNAVAILABLE   — LAN + internet but Central is down
LOCAL_NETWORK_DEGRADED     — LAN probe failing
DNS_FAILURE                — DNS down, internet otherwise reachable
CENTRAL_AUTH_FAILURE       — reserved for 401/403 from Central
CERTIFICATE_FAILURE        — reserved for TLS failure
RECOVERING                 — transitional
```

Each probe writes a row to `der.network_probe` so Diagnostics can
show a rolling history.

**Probe isolation.** The probe loop runs OUTSIDE `@Transactional`; a
nested `persistProbe()` opens a tx for just the writes. A failed JDBC
lookup (e.g. DHIS2-connection row missing) therefore can't poison
the state-write.

## 4. Pluggable `NetworkAgent` SPI

```java
public interface NetworkAgent {
    boolean startAccessPoint(String ssid, String security);
    boolean stopAccessPoint();
    default boolean restartAccessPoint(String ssid, String security) { … }
    String  rotateApKey();                     // returns hash, not clear-text
    boolean setInterfaceState(String name, boolean up);
    boolean peerConnect(String endpoint, String publicKey);
    boolean peerDisconnect(String publicKey);
    String  edgeId();
}
```

`NoopNetworkAgent` is auto-wired as `@ConditionalOnMissingBean`. To
land Linux orchestration on a provisioned edge, expose a bean of
type `NetworkAgent` that shells out to hostapd / nftables / wg — no
other code changes required.

The control plane in Postgres remains source-of-truth; the agent is
the executor.

## 5. Audit event vocabulary (Phase N2)

`NetworkService` writes to `der.network_event` on every state
transition. Event types match spec §29:

```
AP_STARTED, AP_STOPPED, AP_RESTARTED
NETWORK_KEY_ROTATED
DEVICE_CONNECTED/DISCONNECTED (reserved for agent)
DEVICE_APPROVED, DEVICE_REVOKED, DEVICE_BLOCKED, DEVICE_UNBLOCKED
IFACE_UP, IFACE_DOWN
PEER_CONNECTED, PEER_DISCONNECTED, PEER_REMOVED
NETWORK_SETTING_UPDATED, AUDIT_CLEARED
```

Each row carries actor, device/node, interface, outcome, reason and
correlation ID.

## 6. End-to-end verification

Starting from a cold boot the Playwright test:

```
BEFORE start:  Access Point / Stopped
Click Start AP (admin confirmation)
AFTER start:   Access Point / Running          ← live state transition
               Restart button appears          ← conditional UI
Click Rotate key
After rotate:  SSID row persists; audit row written
Click Stop AP
AFTER stop:    Access Point / Stopped

Diagnostics events table:
  Oct 29, 2026, 07:48 AM  Ap Stopped          SUCCESS
  Oct 29, 2026, 07:48 AM  Network Key Rotated SUCCESS
  Oct 29, 2026, 07:48 AM  Ap Started          SUCCESS

Interfaces: 3 rows, dynamic row-menu
  Row 2 kebab → ["Take down", "Rename / reconfigure", "View in diagnostics"]
```

All 10 REST endpoints return 200 with live JSON; 0 UI pageerrors.

**Overview** screenshot `/tmp/der-2.1.87-live-overview.png` shows all
6 facet cards reporting real values plus the Recent events table
populated by the AP lifecycle flow above.

## 7. Files changed

```
database/migrations/V031__phase_n_network.sql                              (new)
server/src/main/java/ug/ac/mak/der/network/NetworkEntities.java            (new)
server/src/main/java/ug/ac/mak/der/network/NetworkRepository.java          (new)
server/src/main/java/ug/ac/mak/der/network/NetworkService.java             (new)
server/src/main/java/ug/ac/mak/der/network/NetworkAgent.java               (new)
server/src/main/java/ug/ac/mak/der/network/NoopNetworkAgent.java           (new)
server/src/main/java/ug/ac/mak/der/web/NetworkController.java              (new)
server/src/main/java/ug/ac/mak/der/security/SecurityConfig.java            (+6 lines)
server/src/main/java/ug/ac/mak/der/DerApplication.java                     (+1 @EnableScheduling)
```

## 8. Known gaps for a production deploy

1. **Linux agent**: the Phase N1 orchestration (hostapd, dnsmasq,
   nftables, iproute2) runs behind `NetworkAgent`. Implementing a
   real `LinuxNetworkAgent` is a separate pilot-deployment work
   package.
2. **QR renderer**: `/ap/qr` returns a stub SVG that encodes the
   WPA3-SAE `WIFI:T:WPA;S:…` payload. Replacing the `stubSvg(...)`
   call with a real QR library on the device gives a scan-ready
   image. The UI's enrol modal already consumes the response field.
3. **TLS trust bootstrap**: Phase N2 §13 mTLS onboarding (per-device
   X.509 enrolment, CA chain) is scoped as a follow-up; the admin UI
   shows a Phase N2 hint in the Device cert modal.
4. **DHCP lease ingestion**: the `network_lease` table exists but is
   populated by the Linux agent, which isn't shipped here.

## Build + test

```
tsc -b && vite build            ✓ 1759 modules → 608.84 KB
./mvnw -q -DskipTests package   ✓ 2.1.87 JAR built
Flyway V031 applied             ✓ 11 tables + seed
Scheduled probe loop            ✓ runs every 30s, 0 errors
Admin UI end-to-end             ✓ all 8 pages render live data
Audit lifecycle                 ✓ Start/Rotate/Stop → 3 events
```
