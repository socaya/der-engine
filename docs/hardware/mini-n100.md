# mini-n100 — Intel N100 mini-PC

**Best for:** district HQ, mid-size facility (OPD + maternity + lab),
sites with mains power + a backup inverter.

## Bill of materials

| Component | Spec | Notes |
|---|---|---|
| CPU | Intel N100 (4 cores, 4 threads, Alder Lake-N) | AES-NI accelerates WG + TLS |
| RAM | 16 GB DDR4-3200 SO-DIMM | 8 GB works but Postgres page cache suffers |
| Storage | 512 GB NVMe M.2 2280 | SATA SSD acceptable for data vol only |
| Network | 2× Intel i226-V 2.5 GbE | one WAN, one LAN for the facility SSID |
| Backup power | USB-UPS (CyberPower CP900AVR) | 15-30 min at 20 W idle |
| Enclosure | Any N100 mini-PC chassis | Beelink, Minisforum, GMKtec all tested |

## Capacity expectations

- JVM heap: 4 GB.
- Postgres shared_buffers: 2 GB.
- Measured: 100+ concurrent device sessions, 150 ms p95 on `/sync/*`,
  journal drain p95 ≤ 300 ms at 10× burst.

## Install path

1. Ubuntu Server 24.04 LTS amd64 or Debian 12 amd64.
2. Same package set as the Pi 5 kit, plus `intel-microcode`.
3. DER .deb install.
4. Enable the WireGuard mesh route in `/etc/der/pilot.env` for peer
   backup replication.

## Known caveats

- N100 has one physical NVMe slot — plan backups to an external USB
  3.2 Gen2 enclosure or the WireGuard mesh.
- Thermal throttle begins ~85 °C sustained; the chassis fan matters
  more than the CPU cooler.
