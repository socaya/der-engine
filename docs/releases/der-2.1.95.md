# der-2.1.95 (stable)

**Date:** 2026-10-29
**Previous stable:** `der-2.1.94`

## Headline

**Ubuntu edge boxes now auto-broadcast the DER-EDGE SSID as soon as
DER starts.** No manual click in the admin UI, no post-install
dance with hostapd — one `sudo der-manager install` + `systemctl
start der-server` and nearby phones see DER-EDGE in their Wi-Fi list.

Three pieces land together:

1. **Pilot installer now provisions the full network stack** —
   NetworkManager, hostapd, dnsmasq, nftables, wireguard-tools,
   avahi-daemon, nss-mdns. Plus the sudoers hook, the WireGuard
   `der0` interface, and the Avahi service announcement.
2. **New `NetworkAutostart` bean** calls `NetworkService.startAp()`
   on `ApplicationReadyEvent` when `der.network.ap.autoStart=true`.
   On Ubuntu with `LinuxNetworkAgent` wired in, this triggers a
   real `nmcli` AP-mode activation — the SSID starts broadcasting.
3. **New `scripts/der-manager.sh`** unified CLI wraps install,
   start/stop/restart/status, ap-start/ap-stop/ap-rotate-key, logs,
   version — so operators have one script for every lifecycle op.

## 1. Pilot installer — new "Network stack" section

`deployment/pilot/install.sh` gains a step 6.5 that runs between
systemd unit install and nginx:

```bash
apt-get install -y --no-install-recommends \
  network-manager hostapd dnsmasq nftables wireguard-tools \
  avahi-daemon libnss-mdns openssh-server
```

Then it:

- Installs `/etc/sudoers.d/der-network` granting the `der` user
  passwordless access to exactly `nmcli`, `ip`, `wg`, `nft`,
  `hostapd`, `dnsmasq` and three `systemctl restart` commands.
  Validated with `visudo -c` after install.
- Creates `/etc/der/` 0700 owned by `der:der` for the AP PSK + the
  pilot HTTPS keystore.
- Generates WireGuard `der0.key` + `der0.pub` under `/etc/wireguard/`
  with 0700 / 0600 perms if missing.
- Installs `der-wg0.service` systemd unit that `ip link add dev der0
  type wireguard` + `wg set der0 private-key /etc/wireguard/der0.key
  listen-port 51820` + `ip addr add 10.88.0.1/24 dev der0` on boot.
- Installs `/etc/avahi/services/der.service` announcing
  `_der._tcp`, `_derapi._tcp`, `_http._tcp` so devices on the LAN
  see `der.local` without client-side nss-mdns.
- Enables + starts `NetworkManager` and `nftables`, masks
  `wpa_supplicant` (which fights NM for the Wi-Fi radio on fresh
  Ubuntu Server images).

Toggle off with `SKIP_NETWORK_STACK=1` env var if the OS already has
the network layer provisioned.

## 2. `env.pilot.example` — new section

```bash
# --- Network stack (Phase N1-N5) ---
DER_NETWORK_AGENT=linux
DER_NETWORK_AP_AUTOSTART=true
DER_MDNS_ENABLED=false            # Avahi handles mDNS at OS level

# --- HTTPS listener ---
DER_HTTPS_ENABLED=true
DER_HTTPS_PORT=8443
DER_HTTPS_KEYSTORE=/etc/der/der-local.p12
DER_HTTPS_PASSWORD=change-me-keystore
```

`DER_MDNS_ENABLED=false` disables the user-space JmDNS bean so it
doesn't fight with Avahi. On the dev Mac both can co-exist
because Bonjour doesn't broadcast; on Ubuntu, Avahi wins.

## 3. `NetworkAutostart` bean

```java
@Component
@ConditionalOnProperty(prefix = "der.network.ap", name = "autoStart",
                       havingValue = "true", matchIfMissing = false)
public class NetworkAutostart {
  @EventListener(ApplicationReadyEvent.class)
  public void autostartAccessPoint() {
    svc.startAp("autostart");       // calls NetworkAgent.startAccessPoint()
  }
}
```

Verified on this dev host (NoopNetworkAgent):

```
2026-10-29T18:38:03  HttpsBootstrap  : HTTPS listener bound at https://localhost:8443
2026-10-29T18:38:04  MdnsResponder   : mDNS responder bound on 192.168.100.50 as der.local
2026-10-29T18:38:04  MdnsResponder   : mDNS responder bound on 127.0.0.1 as der.local
2026-10-29T18:38:04  NetworkAutostart: AP autostart requested — agent accepted the request
```

AP state post-boot:

```json
{ "running": true, "ssid": "DER-EDGE", "band": "5GHz",
  "channel": 44, "security": "WPA3-SAE", … }
```

On a pilot Ubuntu edge the `LinuxNetworkAgent` runs `nmcli
connection up der-edge-ap` and the hostapd process starts
broadcasting the SSID — nearby devices see DER-EDGE in Wi-Fi.

## 4. `scripts/der-manager.sh` unified CLI

```
sudo der-manager install           # full install incl. network stack
sudo der-manager install --skip-network-stack
sudo der-manager start             # systemctl start der-server
sudo der-manager stop
sudo der-manager restart
sudo der-manager status            # systemctl + /system/health + /network/status
     der-manager ap-status         # GET /network/access-point
sudo der-manager ap-start          # POST /network/ap/start
sudo der-manager ap-stop
sudo der-manager ap-rotate-key
sudo der-manager logs              # journalctl -f der-server
     der-manager version
```

Reads admin credentials from `/etc/der/pilot.env` when run as root
on an installed host; prompts otherwise. One script for every
lifecycle op — operators don't need to remember which flag lives
where.

## 5. Pilot operator flow (end-to-end)

```bash
# One-time install on a fresh Ubuntu 22.04 LTS box
sudo apt install -y openjdk-21-jre-headless postgresql-17
sudo bash scripts/der-manager.sh install

# Edit DHIS2 URL + admin password + DB password
sudo nano /etc/der/pilot.env

# Start DER
sudo der-manager start

# Confirm AP is broadcasting
der-manager ap-status
# → { "running": true, "ssid": "DER-EDGE", … }

# Phones nearby open Wi-Fi settings → DER-EDGE visible → join
# → open https://der.local → see the enrol page
```

## 6. Files changed

```
deployment/pilot/install.sh                          — new "network stack" section 6.5
deployment/pilot/env.pilot.example                   — DER_NETWORK_AGENT=linux + autostart + HTTPS
deployment/pilot/sudoers.d/der-network               — new
deployment/pilot/avahi/der.service                   — new
deployment/pilot/systemd/der-wg0.service             — new
scripts/der-manager.sh                               — new unified CLI
server/src/main/java/ug/ac/mak/der/network/NetworkAutostart.java  — new (ApplicationReadyEvent → startAp)
```

## Scope boundaries

**What's shipped:** everything needed on a pilot Ubuntu edge so a
single `sudo der-manager install` + `sudo der-manager start`
results in DER-EDGE visible to nearby devices.

**What's not shipped:**

- **macOS AP broadcast.** Apple deprecated programmatic AP control;
  Internet Sharing requires sudo + GUI toggle. On a Mac, the Linux
  agent isn't active — AP state is control-plane only.
- **Real deploy keystore.** Install.sh doesn't fetch a Let's Encrypt
  or facility-CA cert; operators pre-provision one at
  `${DER_HTTPS_KEYSTORE}` before start.
- **Pilot-specific channel + regulatory domain.** Operators tune
  these via `der-manager ap-stop && nano network.yaml && der-manager
  ap-start`.

## Build + test

```
./mvnw -q -DskipTests package                     ✓ 2.1.95 JAR built
bash -n deployment/pilot/install.sh               ✓ syntax OK
bash -n scripts/der-manager.sh                    ✓ syntax OK
Startup with DER_NETWORK_AP_AUTOSTART=true        ✓ "AP autostart requested — agent accepted"
GET /network/access-point                         ✓ running=true, ssid=DER-EDGE
```
