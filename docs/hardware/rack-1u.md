# rack-1u — Rack appliance

**Best for:** regional hub, high-availability deployment, sites that
can staff a cold-swap replacement within an SLA window.

## Bill of materials

| Component | Spec | Notes |
|---|---|---|
| Chassis | 1U short-depth rackmount | Supermicro SYS-110P-FRN2T or equivalent |
| CPU | Intel Xeon E-2378 (8c/16t) | ECC-capable, AES-NI, SGX for FIPS kits |
| RAM | 32 GB DDR4-3200 ECC UDIMM | ECC required for 24/7 operation |
| Storage | 2× 1 TB NVMe M.2 RAID1 | md-raid or ZFS mirror |
| Network | 2× 10 GbE SFP+ or 1 GbE | one WAN, one WG mesh |
| Power | Redundant 350 W PSU | hot-swap in the field |
| HSM (optional) | YubiHSM 2 or TPM 2.0 | §6 `der.security.hardening.vault` |

## Capacity expectations

- JVM heap: 8 GB.
- Postgres shared_buffers: 8 GB, `effective_cache_size` 20 GB.
- Measured: 500 concurrent sessions, 100 ms p95 on `/sync/metadata`,
  60 ms p95 on `/activity/recent`, journal drain under 100 ms at
  50× burst.

## Install path

1. RHEL 9 or Ubuntu Server 24.04 LTS LTS.
2. `dnf install java-21-openjdk-headless postgresql17-server nginx fail2ban`.
3. Install the DER portable tarball (the .deb targets Debian derivatives).
4. Configure WAL archiving to an off-box SFTP + S3-compatible bucket
   per `docs/site/backup.md`.

## HA notes

- DER itself is active-active between two rack-1u units — the §1 peer
  mesh + CRDT catch-up keeps metadata consistent.
- Postgres HA (streaming replication, failover) is out of scope for
  DER; use `pg_auto_failover` or Patroni as the pattern.
