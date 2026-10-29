#!/usr/bin/env bash
# DER portable release — distro-agnostic installer.
#
# Run as root. Lays out /opt/der + /etc/der + /var/lib/der + /var/log/der,
# creates the der system user, installs systemd unit, AppArmor profile
# and fail2ban jail (best-effort). Does NOT install Java or Postgres —
# those come from the host distro.
set -Eeuo pipefail

if [[ "$(id -u)" != "0" ]]; then
    echo "install.sh: must run as root" >&2
    exit 2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_NAME=der

if ! getent passwd "${USER_NAME}" >/dev/null; then
    if command -v adduser >/dev/null; then
        adduser --system --group --home /nonexistent --no-create-home \
                --shell /usr/sbin/nologin "${USER_NAME}" 2>/dev/null \
          || useradd --system --home-dir /nonexistent --no-create-home \
                     --shell /usr/sbin/nologin "${USER_NAME}"
    else
        useradd --system --home-dir /nonexistent --no-create-home \
                --shell /usr/sbin/nologin "${USER_NAME}"
    fi
fi

install -d -m 0755 /opt/der
install -d -m 0755 /etc/der
install -d -m 0750 -o "${USER_NAME}" -g "${USER_NAME}" /var/lib/der
install -d -m 0750 -o "${USER_NAME}" -g "${USER_NAME}" /var/log/der

cp "${ROOT}/opt/der/der-server.jar" /opt/der/der-server.jar
rm -rf /opt/der/admin-ui-dist
cp -r "${ROOT}/opt/der/admin-ui-dist" /opt/der/admin-ui-dist
chown -R root:root /opt/der

install -m 0644 "${ROOT}/etc/systemd/system/der-server.service" \
                 /etc/systemd/system/der-server.service

if [[ -f "${ROOT}/etc/apparmor.d/opt.der.der-server" ]] && [[ -d /etc/apparmor.d ]]; then
    install -m 0644 "${ROOT}/etc/apparmor.d/opt.der.der-server" \
                     /etc/apparmor.d/opt.der.der-server
    command -v apparmor_parser >/dev/null && apparmor_parser -r /etc/apparmor.d/opt.der.der-server || true
fi

if [[ -d /etc/fail2ban ]] && [[ -f "${ROOT}/etc/fail2ban/filter.d/der-auth.conf" ]]; then
    install -m 0644 "${ROOT}/etc/fail2ban/filter.d/der-auth.conf" \
                     /etc/fail2ban/filter.d/der-auth.conf
    install -m 0644 "${ROOT}/etc/fail2ban/jail.d/der.conf" \
                     /etc/fail2ban/jail.d/der.conf
    command -v fail2ban-client >/dev/null && fail2ban-client reload || true
fi

if [[ ! -f /etc/der/pilot.env ]]; then
    install -m 0640 -o root -g "${USER_NAME}" \
            "${ROOT}/etc/der/pilot.env.example" /etc/der/pilot.env
    echo "install.sh: copied example pilot.env — edit /etc/der/pilot.env before starting."
fi

systemctl daemon-reload || true
systemctl enable der-server.service || true

echo
echo "install.sh: DER installed. Edit /etc/der/pilot.env then:"
echo "    systemctl start der-server"
