#!/usr/bin/env bash
# DER pilot rollback — restore a /opt/der snapshot taken by upgrade.sh.
#
# WARNING: If Flyway applied a migration during the failed upgrade, the
# OLD jar you are restoring to will refuse to start because its schema
# fingerprint is stale. In that case use the Phase 07 backup/restore
# engine to restore the DB to the pre-upgrade state FIRST, then run
# this script. See docs/operations/pilot-runbook.md §7.
#
# Usage: rollback.sh <snapshot-suffix>
#   where <snapshot-suffix> is the timestamp upgrade.sh echoed, e.g.
#   20261022T183015Z (snapshot lives at /opt/der.<suffix>).
set -Eeuo pipefail

INSTALL_PREFIX="${INSTALL_PREFIX:-/opt/der}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "rollback.sh must run as root." >&2
  exit 2
fi

if [[ $# -lt 1 ]]; then
  echo "usage: rollback.sh <snapshot-suffix>" >&2
  echo "available snapshots:" >&2
  ls -1d "${INSTALL_PREFIX}."* 2>/dev/null || echo "  (none)" >&2
  exit 2
fi

SUFFIX="$1"
SRC="${INSTALL_PREFIX}.${SUFFIX}"
if [[ ! -d "${SRC}" ]]; then
  echo "snapshot ${SRC} not found" >&2
  exit 1
fi

log() { printf '[rollback] %s\n' "$*"; }

log "stopping der-server"
systemctl stop der-server || true

log "swapping ${INSTALL_PREFIX} <- ${SRC}"
mv "${INSTALL_PREFIX}" "${INSTALL_PREFIX}.failed.$(date -u +%Y%m%dT%H%M%SZ)"
mv "${SRC}" "${INSTALL_PREFIX}"

log "starting der-server"
if systemctl start der-server; then
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:8080/edge-api/v1/system/health" >/dev/null 2>&1; then
      log "rollback complete; health endpoint responding"
      exit 0
    fi
    sleep 2
  done
fi
log "service did not come back after rollback — check /var/log/der/server.log"
log "  the failed install is preserved at ${INSTALL_PREFIX}.failed.*"
log "  if Flyway advanced the schema, restore the DB via Phase 07 /edge-api/v1/restore"
exit 1
