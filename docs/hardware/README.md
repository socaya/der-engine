# Reference hardware kits

DER is deliberately not a vertically-integrated appliance — it runs on
whatever Linux-capable hardware a site can get. These three reference
kits represent tested configurations across the price/capability curve
so operators have a starting point rather than a spec sheet.

| Kit | Best for | Est. BOM (USD) |
|---|---|---|
| [pi5-field](pi5-field.md) | facility clinic, intermittent power | ~$220 |
| [mini-n100](mini-n100.md) | district HQ, mid-size facility | ~$450 |
| [rack-1u](rack-1u.md) | regional hub, HA deployment | ~$1,800 |

## Operator rule-of-thumb

| User load | Minimum tier |
|---|---|
| ≤ 20 concurrent devices, ≤ 50k records/mo | pi5-field |
| ≤ 100 concurrent, ≤ 500k records/mo | mini-n100 |
| 100-500 concurrent, ≥ 1M records/mo, must meet HA | rack-1u |

## What's shared across tiers

- **OS:** Ubuntu 24.04 LTS, Debian 12, or RHEL 9 — any systemd-based
  distro the `der` .deb or portable tarball installs onto.
- **Postgres:** 15 / 16 / 17 bundled by the distro.
- **TLS:** nginx reverse-proxy with Let's Encrypt (if facility has DNS)
  or an internal CA.
- **Backups:** nightly `pg_dump` + WAL archiving to the chosen off-box
  target (NAS, S3-compatible object store, or airgap USB).

See `/edge-api/v1/packaging` for the current catalogue over HTTP and
the admin UI "/packaging" page for the browseable view.
