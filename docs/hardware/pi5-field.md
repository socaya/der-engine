# pi5-field — Raspberry Pi 5 field kit

**Best for:** facility clinic, intermittent-power sites, remote
deployments where parts replacement by courier is realistic.

## Bill of materials

| Component | Spec | Notes |
|---|---|---|
| SBC | Raspberry Pi 5 (8 GB) | arm64 — DER JAR is architecture-independent |
| Storage | 128 GB NVMe via Pi 5 M.2 HAT | avoid SD cards for the data volume |
| Network | PoE+ HAT (802.3at) | single-cable to a PoE switch for signal + power |
| Backup power | UPS HAT (18650 ×2) | ≥ 60 min runtime at idle |
| Wireless (optional) | USB Wi-Fi 6 dongle | if facility runs its own SSID |
| Case | Argon ONE V3 M.2 | adequate thermal headroom at sustained 70 °C |

## Capacity expectations

- JVM heap: 1.5 GB (`MemoryMax=2G` in the systemd unit).
- Postgres shared_buffers: 512 MB.
- Measured: ~20 concurrent device-client sessions sustained, 500 ms
  p95 latency on `/sync/metadata` snapshots up to ~50 MB.

## Install path

1. Flash Ubuntu Server 24.04 LTS arm64 to NVMe.
2. `apt install postgresql-17 openjdk-21-jre-headless nginx fail2ban`.
3. Install the DER .deb or the portable tarball.
4. Follow `docs/site/install.md` for TLS + nginx config.

## Known caveats

- WireGuard mesh works but ARM NEON crypto path is the bottleneck —
  ≤ 50 Mb/s peer-to-peer vs. the mini-n100's 500+ Mb/s.
- No HSM slot; `der.secrets.vault.*` for secret rotation.
