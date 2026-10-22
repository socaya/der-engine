#!/usr/bin/env bash
# DER pilot upgrade: swap the jar + SPA bundles and restart. New Flyway
# migrations run on service start. If any migration fails, the old jar
# is restored and the service is left stopped so the operator can
# triage.
#
# Prereq: the repo at $ROOT has been checked out at the new tag AND
# the server + SPAs have been rebuilt (`./server/mvnw package`,
# `npm run build` in both client/ and admin-ui/).
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL_PREFIX="${INSTALL_PREFIX:-/opt/der}"
BACKUP_SUFFIX="$(date -u +%Y%m%dT%H%M%SZ)"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "upgrade.sh must run as root." >&2
  exit 2
fi

JAR_SRC="$(find "${ROOT}/server/target" -maxdepth 1 -name 'der-server-*.jar' -not -name '*sources*' -not -name '*javadoc*' | head -n1)"
[[ -f "${JAR_SRC}" ]] || { echo "No fresh jar under server/target/"; exit 1; }
[[ -d "${ROOT}/client/dist"    ]] || { echo "client/dist missing"; exit 1; }
[[ -d "${ROOT}/admin-ui/dist"  ]] || { echo "admin-ui/dist missing"; exit 1; }

log() { printf '[upgrade] %s\n' "$*"; }

log "stopping der-server"
systemctl stop der-server || true

log "snapshotting previous install for rollback (/opt/der.${BACKUP_SUFFIX})"
cp -a "${INSTALL_PREFIX}" "${INSTALL_PREFIX}.${BACKUP_SUFFIX}"

log "swapping jar"
install -o root -g root -m 0644 "${JAR_SRC}" "${INSTALL_PREFIX}/der-server.jar"

log "swapping client SPA"
rm -rf "${INSTALL_PREFIX}/client/dist"
install -d -o root -g root -m 0755 "${INSTALL_PREFIX}/client/dist"
cp -R "${ROOT}/client/dist/." "${INSTALL_PREFIX}/client/dist/"

log "swapping admin SPA"
rm -rf "${INSTALL_PREFIX}/admin-ui/dist"
install -d -o root -g root -m 0755 "${INSTALL_PREFIX}/admin-ui/dist"
cp -R "${ROOT}/admin-ui/dist/." "${INSTALL_PREFIX}/admin-ui/dist/"

log "starting der-server"
if systemctl start der-server; then
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:8080/edge-api/v1/system/health" >/dev/null 2>&1; then
      log "health endpoint responding; upgrade complete"
      log "rollback snapshot at ${INSTALL_PREFIX}.${BACKUP_SUFFIX} — remove once stable"
      exit 0
    fi
    sleep 2
  done
  log "service started but health check never passed"
  exit 1
else
  log "systemctl start der-server returned non-zero — leaving service stopped"
  log "rollback: bash ${ROOT}/deployment/pilot/rollback.sh ${BACKUP_SUFFIX}"
  exit 1
fi
