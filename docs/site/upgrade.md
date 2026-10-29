# Upgrade

DER is Flyway-managed — upgrading is "stop, replace JAR, start":

```bash
sudo systemctl stop der-server
sudo dpkg -i der_<new-version>_all.deb      # or re-run install.sh from the new tarball
sudo systemctl start der-server
```

The new JAR auto-applies any pending migrations on boot (see
`journalctl -u der-server` for the `Flyway … applied N migrations` line).

## Rollback

If the new release misbehaves, the Flyway history is forward-only but
the previous JAR + a WAL-based PITR cover the practical rollback:

```bash
sudo systemctl stop der-server
sudo dpkg -i der_<old-version>_all.deb
# restore the Postgres snapshot captured just before the upgrade.
sudo /opt/der/der-manager.sh restore <snapshot-id>
sudo systemctl start der-server
```

See [recovery.md](recovery.md) for the restore details.

## Zero-downtime caveat

DER is single-node by design. Zero-downtime upgrades require the §1 peer
mesh: upgrade the quieter edge first, confirm sync drains, then upgrade
the other.
