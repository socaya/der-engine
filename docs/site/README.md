# DER docs site

Operator-facing documentation for installing, running, and recovering
a DER appliance. Markdown-only — rendered as GitHub pages or served
in-place from the admin UI under `/admin/docs/`.

## Install

- [install.md](install.md) — fresh install on Ubuntu / Debian / RHEL
- [upgrade.md](upgrade.md) — in-place upgrade across releases
- [hardware](../hardware/README.md) — reference HW kits

## Operate

- [backup.md](backup.md) — nightly `pg_dump` + WAL archiving
- [recovery.md](recovery.md) — point-in-time restore
- [troubleshooting.md](troubleshooting.md) — common issues
- [security.md](security.md) — AppArmor + fail2ban + Vault

## Design references

- [`docs/releases/`](../releases/) — per-release notes
- [`docs/ui/screens/`](../ui/screens/) — authoritative per-screen specs
- [`docs/verification/`](../verification/) — traceability matrix
