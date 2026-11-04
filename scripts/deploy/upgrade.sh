#!/usr/bin/env bash
#
# FR-01-09 — compatibility-checked upgrade with auto-rollback.
#
# Usage: upgrade.sh <new-version> [install-root]
#
# Preconditions:
#   * install.sh has staged <root>/releases/<new-version>/ (tarball +
#     verified sha256 extracted).
#   * The currently-active release is in <root>/current.
#
# Flow:
#   1. Capture upgrade intent — append UPGRADE_START to install-log.
#   2. Trigger a FULL backup via /edge-api/v1/admin/ops/backup/trigger.
#   3. Probe the running DER's /edge-api/v1/compat — abort if the
#      current profile is already in a bad state.
#   4. systemctl stop der; flip the symlink; systemctl start der.
#   5. Poll /system/health for up to 60s.
#   6. On failure, exec rollback.sh with the previously-active release.
#   7. On success, append UPGRADE_SUCCESS to install-log.
#
# Env:
#   DER_BASE_URL       default http://localhost:8080
#   DER_ADMIN_COOKIE   session cookie for the backup trigger
#   DER_SKIP_BACKUP    1 to skip step 2 (use only with a verified prior backup)

set -Eeuo pipefail

NEW="${1:-}"
INSTALL_ROOT="${2:-/opt/der}"
BASE_URL="${DER_BASE_URL:-http://localhost:8080}"

if [[ -z "$NEW" ]]; then
  echo "usage: $0 <new-version> [install-root]" >&2
  exit 2
fi

log() { printf '[upgrade] %s\n' "$*"; }
MANIFEST="${INSTALL_ROOT}/install-log.ndjson"
record() {
  local event="$1"
  local detail="${2:-}"
  local ts
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '{"event":"%s","version":"%s","at":"%s","detail":%s}\n' \
    "$event" "$NEW" "$ts" "${detail:-null}" >> "$MANIFEST"
}

# --- 0. Resolve previous ----------------------------------------------

if [[ ! -L "${INSTALL_ROOT}/current" ]]; then
  echo "upgrade: no current install detected — run install.sh first" >&2
  exit 3
fi
PREVIOUS_DIR="$(readlink "${INSTALL_ROOT}/current")"
PREVIOUS_VERSION="$(basename "$PREVIOUS_DIR")"
NEW_DIR="${INSTALL_ROOT}/releases/${NEW}"

if [[ ! -d "$NEW_DIR" ]]; then
  echo "upgrade: $NEW_DIR missing — run install.sh ${NEW} first" >&2
  exit 4
fi

if [[ "$PREVIOUS_VERSION" == "$NEW" ]]; then
  log "already running ${NEW} — no-op"
  exit 0
fi

log "upgrading ${PREVIOUS_VERSION} → ${NEW}"
record "UPGRADE_START" "{\"previous\":\"${PREVIOUS_VERSION}\"}"

# --- 1. Pre-upgrade backup --------------------------------------------

if [[ "${DER_SKIP_BACKUP:-}" != "1" ]]; then
  log "requesting FULL backup before flip"
  BACKUP_RESP="$(curl -sS -X POST \
    -H 'Content-Type: application/json' \
    -b "${DER_ADMIN_COOKIE:-}" \
    -d '{"kind":"FULL"}' \
    "${BASE_URL}/edge-api/v1/admin/ops/backup/trigger" 2>&1 || true)"
  log "backup response: ${BACKUP_RESP}"
  if ! echo "$BACKUP_RESP" | grep -q '"runId"'; then
    echo "upgrade: backup trigger did not acknowledge — aborting" >&2
    record "UPGRADE_ABORT" "{\"reason\":\"backup_unavailable\"}"
    exit 5
  fi
else
  log "DER_SKIP_BACKUP=1 — skipping pre-upgrade backup"
fi

# --- 2. Compat sanity -------------------------------------------------

log "probing /edge-api/v1/compat before flip"
COMPAT="$(curl -sS "${BASE_URL}/edge-api/v1/compat" 2>&1 || true)"
if ! echo "$COMPAT" | grep -q 'profileName'; then
  echo "upgrade: compat probe failed — ${COMPAT}" >&2
  record "UPGRADE_ABORT" "{\"reason\":\"compat_probe_failed\"}"
  exit 6
fi

# --- 3. Flip ----------------------------------------------------------

log "stopping der service"
systemctl stop der 2>/dev/null || systemctl stop der-server 2>/dev/null || true

log "flipping symlink → ${NEW_DIR}"
ln -sfn "$NEW_DIR" "${INSTALL_ROOT}/current"

log "starting der service"
systemctl start der 2>/dev/null || systemctl start der-server 2>/dev/null || true

# --- 4. Health probe --------------------------------------------------

log "polling /edge-api/v1/system/health for up to 60s"
for _ in $(seq 1 30); do
  if curl -sSf "${BASE_URL}/edge-api/v1/system/health" >/dev/null 2>&1; then
    log "${NEW} healthy"
    record "UPGRADE_SUCCESS" "{\"previous\":\"${PREVIOUS_VERSION}\"}"
    exit 0
  fi
  sleep 2
done

# --- 5. Auto-rollback -------------------------------------------------

log "${NEW} failed health probe — triggering rollback to ${PREVIOUS_VERSION}"
record "UPGRADE_ROLLBACK" "{\"previous\":\"${PREVIOUS_VERSION}\",\"reason\":\"health_probe_timeout\"}"
exec "$(dirname "$0")/rollback.sh" "$PREVIOUS_VERSION" "$INSTALL_ROOT"
