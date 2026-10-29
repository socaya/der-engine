# Install

Two supported paths — pick whichever the host distro favours.

## 1. Debian / Ubuntu — .deb package

```bash
# One-time dependencies.
sudo apt install openjdk-21-jre-headless postgresql-17 nginx fail2ban apparmor

# Create the DER database.
sudo -u postgres createdb der
sudo -u postgres createuser der --pwprompt     # remember the password

# Install the package.
sudo dpkg -i der_<version>_all.deb

# Edit the environment file.
sudo editor /etc/der/pilot.env                  # set DER_DB_URL + DER_SESSION_SECRET

# Start.
sudo systemctl start der-server
sudo journalctl -u der-server -f                # watch the first boot
```

The `postinst` script creates the `der` system user, lays out
`/opt/der`, `/etc/der`, `/var/lib/der`, `/var/log/der`, installs the
systemd unit + AppArmor profile + fail2ban jail (best-effort — any
missing packages are skipped).

## 2. Any systemd distro — portable tarball

```bash
tar -xzf der-<version>-portable.tar.gz
cd der-<version>
sudo ./install.sh
sudo editor /etc/der/pilot.env
sudo systemctl start der-server
```

No .deb dependencies — the installer is distro-agnostic.

## Required environment variables

The template at `/etc/der/pilot.env.example` lists everything, but the
minimum four that must be set before first start:

```
DER_DB_URL=jdbc:postgresql://localhost:5432/der
DER_DB_USERNAME=der
DER_DB_PASSWORD=<password you chose>
DER_SESSION_SECRET=<48+ random bytes, base64>
```

Generate a session secret with:

```bash
openssl rand -base64 48
```

## Verify

```bash
curl -sf http://localhost:8085/edge-api/v1/system/health | jq .
# expect: status=UP, version=<installed>, dhis2Integrated=false
```

Sign in to the admin UI at `https://<host>/admin/` using the bootstrap
admin credentials printed on first boot in `journalctl`.
