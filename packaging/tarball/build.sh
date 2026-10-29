#!/usr/bin/env bash
# §10 Packaging — portable release tarball.
#
# Produces der-<version>-portable.tar.gz with everything an operator
# needs on a non-Debian host (RHEL, Alpine on bare metal, ARM boards
# running Fedora, etc.) — the JAR, the admin UI, the config template,
# the systemd unit, the AppArmor profile, and an install.sh.
#
# Prereqs: server + admin-ui already built.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${OUT_DIR:-${ROOT}/dist}"
VERSION="$(cat "${ROOT}/VERSION" | tr -d '[:space:]')"
STAGING="$(mktemp -d)"
PKG_ROOT="${STAGING}/der-${VERSION}"
mkdir -p "${PKG_ROOT}"
trap 'rm -rf "${STAGING}"' EXIT

echo "tarball/build: version=${VERSION}"

# 1. Layout.
mkdir -p "${PKG_ROOT}/opt/der" "${PKG_ROOT}/etc/der" \
         "${PKG_ROOT}/etc/systemd/system" \
         "${PKG_ROOT}/etc/apparmor.d" \
         "${PKG_ROOT}/etc/fail2ban/filter.d" \
         "${PKG_ROOT}/etc/fail2ban/jail.d"

JAR="${ROOT}/server/target/der-server-${VERSION}.jar"
[[ -f "${JAR}" ]] || { echo "no server JAR at ${JAR}" >&2; exit 2; }
cp "${JAR}" "${PKG_ROOT}/opt/der/der-server.jar"

ADMIN_DIST="${ROOT}/admin-ui/dist"
[[ -d "${ADMIN_DIST}" ]] || { echo "no admin UI dist at ${ADMIN_DIST}" >&2; exit 2; }
cp -r "${ADMIN_DIST}" "${PKG_ROOT}/opt/der/admin-ui-dist"

cp "${ROOT}/deployment/pilot/systemd/der-server.service" \
   "${PKG_ROOT}/etc/systemd/system/der-server.service"
if [[ -f "${ROOT}/deployment/pilot/apparmor/opt.der.der-server" ]]; then
    cp "${ROOT}/deployment/pilot/apparmor/opt.der.der-server" \
       "${PKG_ROOT}/etc/apparmor.d/opt.der.der-server"
fi
if [[ -f "${ROOT}/deployment/pilot/fail2ban/filter.d/der-auth.conf" ]]; then
    cp "${ROOT}/deployment/pilot/fail2ban/filter.d/der-auth.conf" \
       "${PKG_ROOT}/etc/fail2ban/filter.d/der-auth.conf"
    cp "${ROOT}/deployment/pilot/fail2ban/jail.d/der.conf" \
       "${PKG_ROOT}/etc/fail2ban/jail.d/der.conf"
fi
cp "${ROOT}/deployment/pilot/env.pilot.example" "${PKG_ROOT}/etc/der/pilot.env.example"

# 2. install.sh — distro-agnostic installer baked into the archive.
cp "${ROOT}/packaging/tarball/install.sh" "${PKG_ROOT}/install.sh"
chmod 0755 "${PKG_ROOT}/install.sh"
cat > "${PKG_ROOT}/README.txt" <<EOF
DER ${VERSION} — portable appliance release

Install on any systemd-based Linux (RHEL 9, Fedora, Alpine init, Ubuntu
without the .deb, etc.):

    sudo ./install.sh

Then edit /etc/der/pilot.env and:
    sudo systemctl start der-server

Expects Java 21+ and PostgreSQL 15/16/17 to be installed by the host.
EOF

# 3. Archive.
mkdir -p "${OUT_DIR}"
OUT="${OUT_DIR}/der-${VERSION}-portable.tar.gz"
tar -czf "${OUT}" -C "${STAGING}" "der-${VERSION}"
echo "tarball/build: wrote ${OUT}"
if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${OUT}"
else
    shasum -a 256 "${OUT}"
fi
