#!/usr/bin/env bash
# FR-01-09 — rollback half of the upgrade pair.
# Usage: rollback.sh <previous-version> [install-root]
set -Eeuo pipefail
PREV="${1:-}"
INSTALL_ROOT="${2:-/opt/der}"
if [[ -z "${PREV}" ]]; then echo "usage: $0 <previous-version>"; exit 2; fi

echo "rollback: stopping DER…"
systemctl stop der || true
ln -sfn "${INSTALL_ROOT}/releases/${PREV}" "${INSTALL_ROOT}/current"
systemctl start der || true

echo "rollback: active ← ${PREV}"
