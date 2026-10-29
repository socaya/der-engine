#!/usr/bin/env bash
# §10 Packaging — build the DER .deb.
#
# Assumes server + admin-ui are already built:
#   cd server    && ./mvnw -q -DskipTests package
#   cd admin-ui  && DER_ADMIN_UI_BASE=/admin/ npm run build
#
# Env:
#   OUT_DIR  default dist/
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${OUT_DIR:-${ROOT}/dist}"
VERSION="$(cat "${ROOT}/VERSION" | tr -d '[:space:]')"
STAGING="$(mktemp -d)"
PKG_NAME="der_${VERSION}_all"

trap 'rm -rf "${STAGING}"' EXIT

echo "deb/build: version=${VERSION} staging=${STAGING}"

# 1. Lay out the package tree.
cp -r "${ROOT}/packaging/deb/DEBIAN" "${STAGING}/"
mkdir -p "${STAGING}/opt/der" "${STAGING}/etc/der" \
         "${STAGING}/etc/systemd/system" \
         "${STAGING}/etc/apparmor.d" \
         "${STAGING}/etc/fail2ban/filter.d" \
         "${STAGING}/etc/fail2ban/jail.d"

JAR="${ROOT}/server/target/der-server-${VERSION}.jar"
[[ -f "${JAR}" ]] || { echo "no server JAR at ${JAR}" >&2; exit 2; }
cp "${JAR}" "${STAGING}/opt/der/der-server.jar"

ADMIN_DIST="${ROOT}/admin-ui/dist"
[[ -d "${ADMIN_DIST}" ]] || { echo "no admin UI dist at ${ADMIN_DIST}" >&2; exit 2; }
cp -r "${ADMIN_DIST}" "${STAGING}/opt/der/admin-ui-dist"

# 2. systemd + supporting configs — all optional, best-effort.
cp "${ROOT}/deployment/pilot/systemd/der-server.service" \
   "${STAGING}/etc/systemd/system/der-server.service"
if [[ -f "${ROOT}/deployment/pilot/apparmor/opt.der.der-server" ]]; then
    cp "${ROOT}/deployment/pilot/apparmor/opt.der.der-server" \
       "${STAGING}/etc/apparmor.d/opt.der.der-server"
fi
if [[ -f "${ROOT}/deployment/pilot/fail2ban/filter.d/der-auth.conf" ]]; then
    cp "${ROOT}/deployment/pilot/fail2ban/filter.d/der-auth.conf" \
       "${STAGING}/etc/fail2ban/filter.d/der-auth.conf"
    cp "${ROOT}/deployment/pilot/fail2ban/jail.d/der.conf" \
       "${STAGING}/etc/fail2ban/jail.d/der.conf"
fi
cp "${ROOT}/deployment/pilot/env.pilot.example" "${STAGING}/etc/der/pilot.env.example"

# 3. Resolve @VERSION@ in control.
sed -i.bak "s/@VERSION@/${VERSION}/g" "${STAGING}/DEBIAN/control"
rm -f "${STAGING}/DEBIAN/control.bak"
chmod 0755 "${STAGING}/DEBIAN/postinst" "${STAGING}/DEBIAN/prerm"

# 4. Build.
mkdir -p "${OUT_DIR}"
OUT="${OUT_DIR}/${PKG_NAME}.deb"
if command -v dpkg-deb >/dev/null 2>&1; then
    dpkg-deb --build --root-owner-group "${STAGING}" "${OUT}"
    echo "deb/build: wrote ${OUT}"
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "${OUT}"
    else
        shasum -a 256 "${OUT}"
    fi
else
    # Portable fallback for mac dev hosts — produce a tar-equivalent.
    OUT="${OUT_DIR}/${PKG_NAME}.tar.gz"
    tar -czf "${OUT}" -C "${STAGING}" .
    echo "deb/build: dpkg-deb unavailable; wrote ${OUT} (install on a Debian host)"
    shasum -a 256 "${OUT}"
fi

echo "deb/build: done"
