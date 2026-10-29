# der-2.2.1 (stable)

**Date:** 2026-10-29
**Previous stable:** `der-2.2.0`

## Headline

**§4 Hardware integration — fully implemented.** Third slice of
the production roadmap. Five features ship:

1. **systemd watchdog** via sd_notify Unix-domain socket
2. **Thermal sensors** from `/sys/class/thermal/thermal_zone*/temp`
3. **UPS integration** via `upsc` (nut client)
4. **Status LEDs API** so a tiny Pi-side daemon drives physical LEDs
5. **TPM/file-sealed secrets** with tpm2-tools when `/dev/tpm0` is
   present, PBKDF2-of-machine-id fallback otherwise

All five degrade gracefully on dev hosts (Mac): no `/sys/class/thermal`,
no `upsc`, no `NOTIFY_SOCKET` → empty responses instead of errors.

## 1. Schema (V038)

```
der.hardware_sensor_sample  — rolling thermal / UPS / fan samples
der.watchdog_state          — singleton last-ping + ping-count + failure state
der.status_led_zone         — primary / secondary / attention LED state
der.tpm_sealed_secret       — registry of sealed blobs on disk
+ retention_policy row for hardware_sensor_sample (7 days)
```

Seeded LED defaults:

```
primary   = green / solid / "DER running"
secondary = blue  / off   / "sync idle"
attention = off   / off   / "no alerts"
```

## 2. systemd watchdog

`HardwareService.pingWatchdog()` runs every 10 s (configurable via
`der.hardware.watchdog.interval`). Reads `NOTIFY_SOCKET` env var:

- When DER is launched by systemd with `Type=notify` + `WatchdogSec=30s`,
  this is a Unix-domain socket path
- `SocketChannel.open(UNIX)` opens it, writes `WATCHDOG=1\n`
- Abstract sockets (`@foo`) → prefix with `\0`

Pilot systemd unit updated (`deployment/pilot/systemd/der-server.service`):

```ini
[Service]
Type=notify
NotifyAccess=main
WatchdogSec=30s
```

If DER hangs for >30 s with no ping, systemd kills + restarts it.

### Admin view

```
GET /edge-api/v1/system/hardware/watchdog
→ { enabled, underSystemd, lastPingAt, pingCount,
     lastFailureAt, lastFailureMsg, notifySocket }
```

Verified on dev host (no systemd, so `underSystemd=false`, no pings):

```
{ enabled: true, underSystemd: false, pingCount: 0 }
```

## 3. Thermal sensors

Every 30 s the service reads `/sys/class/thermal/thermal_zone{0,1}/temp`
(configurable via `der.hardware.thermal.zones`), divides by 1000 for
°C, and inserts a row.

```
GET /system/hardware/thermal
→ { available, zones: [{ zone, celsius, sampledAt }] }

GET /system/hardware/thermal?history=true&limit=120
→ { samples: [{ zone, celsius, sampledAt }, …] }
```

Admin page's **Thermal** panel colour-codes rows: green `≤60°C`,
warning `>60°C`, danger `>75°C`.

## 4. UPS via nut

Set `DER_HARDWARE_UPS_NAME` (e.g. `apc@localhost`). The service
shells to `upsc <name>` every 30 s and parses the key:value output:

```
battery.charge:   77
battery.runtime:  3540
ups.status:       OL
input.voltage:    229.4
ups.model:        Smart-UPS 1500
```

```
GET /system/hardware/ups
→ { available, upsName, status, batteryChargePct,
     batteryRuntimeSec, inputVoltage, model, serial }
```

Admin page shows battery %, runtime in minutes, input voltage,
status (`OL` = success, else warning).

## 5. Status LEDs API

Public read endpoint for a Pi-side daemon:

```
GET /system/hardware/leds         (unauthenticated — operator restricts via LAN/firewall)
→ { zones: [{ zone, color, pattern, periodMs, label }] }

POST /system/hardware/leds/{zone}  (ADMIN)
     body: { color, pattern, periodMs?, label? }
```

Patterns: `solid`, `pulse`, `blink`, `off`.

Admin page shows the three zones with inline edit (colour swatch
preview + pattern dropdown).

### Verified round-trip

```
POST /leds/primary  { color: "orange", pattern: "blink", periodMs: 500, label: "TEST" }
GET  /leds          → primary now: orange / blink / 500 ms
```

### Pi-side daemon (operator-written)

```bash
#!/usr/bin/env bash
# tiny Pi-side LED poll loop — operators drop under /etc/systemd
while :; do
  curl -s https://der.local:8443/edge-api/v1/system/hardware/leds \
    | jq -r '.zones[] | "\(.zone) \(.color) \(.pattern)"' \
    | while read zone color pattern; do
        drive_led "$zone" "$color" "$pattern"
      done
  sleep 2
done
```

(Operators integrate with GPIO / APA102 / WS2812 as suits their
LED hardware.)

## 6. TPM / file-sealed secrets

Two code paths, picked at runtime by probing `/dev/tpm0` +
`tpm2_create` on PATH:

### With TPM (`/dev/tpm0` + `tpm2-tools`)

1. Generate random AES-256 key
2. AES-GCM-encrypt the plaintext
3. `tpm2_create -C o -Gaes256 -i <key> -u <pub> -r <priv>` seals
   the AES key to the TPM owner hierarchy
4. Blob format: `TPM2SEAL\n<base64 pub>\n<base64 priv>\n<base64 nonce>\n<base64 ct>\n`

Unseal reverses: `tpm2_load` → `tpm2_unseal` → AES-GCM decrypt.

### Without TPM (fallback)

1. Derive KEK via `PBKDF2WithHmacSHA256(/etc/machine-id, salt=der-sealing-salt, 100k)`
2. AES-GCM encrypt
3. Blob format: `DERSEAL1\n<base64 nonce>\n<base64 ct>\n`

Reasonable protection against casual filesystem copy (binds to
`/etc/machine-id`) but not against root compromise. For real
threat models operators replace this with Vault / HSM — the
service layer is pluggable.

### Verified round-trip

```
POST /sealed  { secretId: "dhis2-token-test", plaintext: "super-secret-value-12345" }
→ { sealed: true, sealedPath: "~/.der/sealed/dhis2-token-test.sealed",
    algorithm: "pbkdf2-aes256-gcm", tpmBacked: false }

GET  /sealed/dhis2-token-test
→ 200 { plaintext: "super-secret-value-12345" }   ✓ matches input
```

### Admin page

Lists every sealed secret with:

- Secret ID
- Algorithm (`tpm2-sealed-aes256-gcm` or `pbkdf2-aes256-gcm`)
- Sealed-at timestamp
- Unseal count
- Last unseal timestamp
- Description

**Seal secret** modal takes `secretId / description / plaintext` and
calls POST. Plaintext never comes back to the UI after sealing.

## 7. New admin page

`/system/hardware` ships with five panels:

```
Watchdog              — enabled / underSystemd / last ping / notify socket
Thermal · N zones     — tone-coloured temperatures
UPS                   — battery / runtime / voltage / status
Status LEDs · 3       — inline-edit colour / pattern per zone
TPM-sealed secrets · N — one row per secret with algorithm + unseal count
```

Linked under **System** nav group between Health and Metrics.

## 8. Files changed

```
database/migrations/V038__phase_prod_hardware.sql                                 (new)
server/src/main/java/ug/ac/mak/der/hardware/HardwareService.java                  (new)
server/src/main/java/ug/ac/mak/der/web/HardwareController.java                    (new)
server/src/main/java/ug/ac/mak/der/security/SecurityConfig.java                   — /system/hardware/** auth + /leds GET permitAll + POST ADMIN
deployment/pilot/systemd/der-server.service                                       — Type=notify + WatchdogSec=30s
admin-ui/src/screens/Hardware.tsx                                                 (new)
admin-ui/src/App.tsx                                                              — /system/hardware route
admin-ui/src/app/navigation.ts                                                    — Hardware item under System
```

## 9. Next step in the sequential march

- **2.2.2** — §5 Backup + DR (schedule, off-box via rclone, one-command restore, PITR)
- **2.2.3** — §6 Security hardening (AppArmor, fail2ban, Vault, FIPS)
- **2.2.4** — §8 UI maturity (multi-edge fleet, onboarding, a11y, offline-first)
- **2.2.5** — §9 Testing (chaos, load, soak, golden)
- **2.2.6** — §10 Packaging (.deb, OCI, HW kits, docs site)

## Build + test

```
./mvnw -q -DskipTests clean package  ✓ 2.2.1 JAR + V038 applied
Verified end-to-end:
  LED update              primary = orange/blink/500ms ✓
  Seal + unseal           pbkdf2-aes256-gcm algorithm, plaintext matches ✓
  UI page                 5 panels present, 0 pageerrors ✓
```
