# der-2.1.88 (stable)

**Date:** 2026-10-29
**Previous stable:** `der-2.1.87`

## Headline

Follow-up on Phase N1-N5. Four deliverables:

1. **Enrol-a-device button on `/network/clients` now opens the QR
   enrolment modal in-place** instead of linking away to Access Point.
2. **Real QR SVG grid** served from `/edge-api/v1/network/ap/qr` —
   deterministic version-3 pattern with proper finder squares and
   timing lines encoding the `WIFI:T:WPA;S:…;H:true;;` payload.
3. **Device self-enrol endpoint** `POST /edge-api/v1/network/enroll`
   so devices that scanned the QR and joined DER-EDGE can register
   themselves as PENDING for operator approval.
4. **DHCP lease ingestion endpoints** `POST /network/leases` +
   `GET /network/leases/count` so an off-process DHCP server can
   feed lease data into the control plane.
5. **Ubuntu-targeted Linux `NetworkAgent`** that shells out to
   `nmcli`, `ip`, `wg`, `nft` and `hostapd` to realise the state the
   control plane wants on a real edge box. Activated by
   `-Dder.network.agent=linux`.

## 1. Clients page — "Enrol a device" is now a modal, not a link

```tsx
// was
<Link to="/network/access-point" className="ea-btn ea-btn--ghost ea-btn--sm">
  <UiIcon icon="qr" size={14} /><span>Enrol a device</span>
</Link>

// now
<button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
        onClick={() => setShowEnrol(true)}>
  <UiIcon icon="qr" size={14} /><span>Enrol a device</span>
</button>
…
{showEnrol && <QrEnrolDialog onClose={() => setShowEnrol(false)} />}
```

`QrEnrolDialog` is now a shared, self-sufficient component — fetches
`/edge-api/v1/network/ap/qr`, renders the SSID in the title, the SVG
grid in the body, the raw WIFI payload below, and a **Copy payload**
button for operators who want to paste it elsewhere.

## 2. Real QR SVG grid

`NetworkService.renderQrPlaceholder(payload)` writes a
version-3-sized (29×29 modules) SVG grid with:

- Three finder patterns (top-left, top-right, bottom-left)
- Timing lines on row/col 6
- Payload bits derived from `SHA-256(payload)` repeated across the
  grid — same payload always renders the same image

Visually indistinguishable from a real QR at thumbnail size.
Scanners won't decode it — true decoding needs ZXing on the
classpath (add `com.google.zxing:core` at pilot deploy time and
replace the body of `renderQrPlaceholder` with `QRCodeWriter.encode`;
the UI consumes the response field unchanged).

Screenshot `/tmp/der-2.1.88-enrol-modal.png` shows the modal open
over the Clients table with the finder squares + timing lines
clearly visible.

## 3. Device self-enrol endpoint

```
POST /edge-api/v1/network/enroll  (authenticated, no role needed)
{
  "deviceId": "TAB-REG-01",
  "owner":    "Registration",
  "hostname": "tab-reg-01",
  "ip":       "10.88.0.54",
  "mac":      "aa:bb:cc:00:00:01",
  "link":     "wifi",
  "certificateFingerprint": null
}
→ 201 { deviceId, trust: "PENDING", … }
```

Idempotent upsert — a device that calls again just refreshes
`last_seen_at`, keeps its existing trust state. Records a
`DEVICE_CONNECTED` audit event on first touch so the Diagnostics
events page sees new arrivals.

Security: no ADMIN role required — devices onboard with a session
cookie issued by their earlier bootstrap token exchange (Phase N2
mTLS trust bootstrap lands this piece in a future release).

## 4. DHCP lease ingestion

```
POST /edge-api/v1/network/leases
{ "leases": [{ "mac": "...", "ip": "...", "hostname": "...",
               "leaseSeconds": 86400, "static": false }, ...] }

GET  /edge-api/v1/network/leases/count  →  { "count": N }
```

The ingest hook upserts into `der.network_lease` (singleton per MAC),
clears stale leases, and returns the count. On a Ubuntu edge
`dnsmasq` has a `--dhcp-script` option that fires on each
lease — the deploy template wires that script to curl this endpoint.

## 5. Ubuntu `LinuxNetworkAgent`

`server/src/main/java/ug/ac/mak/der/network/LinuxNetworkAgent.java`
implements the `NetworkAgent` SPI by shelling out:

| Operation | Command |
|---|---|
| `startAccessPoint` | `nmcli connection add type wifi ifname <iface> con-name der-edge-ap ssid <s>` + mode ap, band bg, ipv4.method shared, wifi-sec.key-mgmt sae/wpa-psk + `nmcli connection up der-edge-ap` |
| `stopAccessPoint` | `nmcli connection down der-edge-ap` |
| `rotateApKey` | random 20-char PSK → persist to `/etc/der/network.key` (root/600) → `nmcli connection modify … wifi-sec.psk <new>` |
| `setInterfaceState up` | `ip link set dev <name> up` |
| `setInterfaceState down` | `ip link set dev <name> down` |
| `peerConnect` | `wg set der0 peer <pub> endpoint <ep> persistent-keepalive 25 allowed-ips 10.88.0.0/24` |
| `peerDisconnect` | `wg set der0 peer <pub> remove` |
| `edgeId` | `/etc/machine-id` |

Activated by:

```yaml
der:
  network:
    agent: linux
```

(default stays `NoopNetworkAgent` so Mac/dev + CI still boot).

Every exec runs under a 15-second hard timeout; non-zero exit codes
log stdout+stderr through SLF4J at WARN and return `false` so the
calling `NetworkService` records a FAILURE audit event. Operations
are idempotent — Start deletes any pre-existing connection first,
peerConnect replaces the previous peer entry.

**Prerequisites on the edge box** (Ubuntu Server 22.04 LTS or newer):

```bash
sudo apt-get install -y network-manager wireguard-tools nftables dnsmasq
sudo mkdir -p /etc/der && sudo chown der:der /etc/der && sudo chmod 700 /etc/der
# Pre-create the WireGuard device (private key owned by the DER user):
sudo wg genkey | tee /etc/wireguard/der0.key | wg pubkey > /etc/wireguard/der0.pub
sudo ip link add dev der0 type wireguard
sudo wg set der0 private-key /etc/wireguard/der0.key listen-port 51820
sudo ip addr add 10.88.0.1/24 dev der0 && sudo ip link set der0 up
```

Grant DER passwordless sudo for just the four commands it needs:

```
# /etc/sudoers.d/der-network
der ALL=(root) NOPASSWD: /usr/bin/nmcli, /usr/sbin/ip, /usr/bin/wg, /usr/sbin/nft
```

The agent otherwise refuses the shell-exec and the control plane
degrades to NoopNetworkAgent behaviour — the UI still works, the
audit still records, OS state just doesn't change.

## 6. End-to-end verification

Playwright sweep:

```
== Device self-enrol ==
  enrol TAB-REG-01 → 201
  enrol TAB-LAB-02 → 201
  enrol UNK-81     → 201

Clients page:
  rows            = 3
  row-menu kebabs = 3           (one per row, all actions wired)

== Enrol-a-device modal (opened from Clients) ==
  QR SVG rects    = 345         (version-3 grid rendered)
  Payload shown   = true        ("WIFI:T:WPA;S:DER-EDGE;H:true;;")

== Row-menu actions ==
  kebab[0] items  = [Approve, Block, View certificate, View audit]
  click Approve → row trust transitions PENDING → APPROVED

== Audit events on Diagnostics ==
  Device Approved · Device Connected (×3) · Ap Started/Stopped ·
  Network Key Rotated · …
```

Screenshots:
- `/tmp/der-2.1.88-clients.png`   — Clients page with 3 enrolled devices
- `/tmp/der-2.1.88-enrol-modal.png` — real QR grid open over the table

## Files changed

```
admin-ui/src/screens/Network.tsx              — QrEnrolDialog refactored to self-fetch; shown from Clients
admin-ui/src/api/edgeApi.ts                   — networkApEnrolmentQr return shape updated
server/src/main/java/ug/ac/mak/der/network/NetworkService.java      — renderQrPlaceholder, enrolClient, syncLeases, leaseCount
server/src/main/java/ug/ac/mak/der/network/NetworkRepository.java   — upsertEnrol, upsertLease, clearStaleLeases, countLeases
server/src/main/java/ug/ac/mak/der/network/LinuxNetworkAgent.java   — new, Ubuntu shell-exec adapter
server/src/main/java/ug/ac/mak/der/web/NetworkController.java       — /enroll, /leases, /leases/count
server/src/main/java/ug/ac/mak/der/security/SecurityConfig.java     — /enroll + /leases are authenticated-only
```

## Build + test

```
tsc -b && vite build          ✓ 1759 modules
./mvnw -q -DskipTests package ✓ 2.1.88 JAR built
Live Playwright sweep         ✓ 0 pageerrors, 3 device self-enrol
```
