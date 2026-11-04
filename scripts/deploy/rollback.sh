#!/usr/bin/env bash
#
# FR-01-09 — rollback half of the upgrade pair.
#
# Usage:
#   rollback.sh <previous-version> [install-root]
#
# Idempotent: re-running against the already-active version is a no-op.
# Writes a ROLLBACK record to <root>/install-log.ndjson.
#
# Called automatically by upgrade.sh when the new version fails its
# health probe. Operators invoke it manually when a late-emerging
# regression appears post-upgrade.

set -Eeuo pipefail

PREV="${1:-}"
INSTALL_ROOT="${2:-/opt/der}"

if [[ -z "$PREV" ]]; then
  echo "usage: $0 <previous-version> [install-root]" >&2
  exit 2
fi

log() { printf '[rollback] %s\n' "$*"; }
MANIFEST="${INSTALL_ROOT}/install-log.ndjson"
PREV_DIR="${INSTALL_ROOT}/releases/${PREV}"

if [[ ! -d "$PREV_DIR" ]]; then
  echo "rollback: $PREV_DIR missing — cannot roll back to $PREV" >&2
  exit 3
fi

CURRENT_LINK="${INSTALL_ROOT}/current"
CURRENT_VERSION="unknown"
if [[ -L "$CURRENT_LINK" ]]; then
  CURRENT_VERSION="$(basename "$(readlink "$CURRENT_LINK")")"
fi

if [[ "$CURRENT_VERSION" == "$PREV" ]]; then
  log "already running ${PREV} — no-op"
  exit 0
fi

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

log "stopping der service"
systemctl stop der 2>/dev/null || systemctl stop der-server 2>/dev/null || true

log "flipping symlink ${CURRENT_VERSION} → ${PREV}"
ln -sfn "$PREV_DIR" "$CURRENT_LINK"

log "starting der service"
systemctl start der 2>/dev/null || systemctl start der-server 2>/dev/null || true

printf '{"event":"ROLLBACK","version":"%s","at":"%s","rolledBackFrom":"%s"}\n' \
  "$PREV" "$TS" "$CURRENT_VERSION" >> "$MANIFEST"

log "active ← ${PREV} (rolled back from ${CURRENT_VERSION})"
