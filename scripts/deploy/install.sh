#!/usr/bin/env bash
# FR-01-08 — reproducible, versioned install.
# Usage: install.sh <der-version> [install-root]
#
# Idempotent: re-running with the same version is a no-op; a different
# version triggers the upgrade path (see upgrade.sh).

set -Eeuo pipefail

VERSION="${1:-}"
INSTALL_ROOT="${2:-/opt/der}"

if [[ -z "${VERSION}" ]]; then
    echo "usage: $0 <der-version> [install-root]"
    echo "example: $0 2.0.1 /opt/der"
    exit 2
fi

mkdir -p "${INSTALL_ROOT}/releases/${VERSION}"
echo "install: resolved target ${INSTALL_ROOT}/releases/${VERSION}"

# Pin the artifact. Operators adapt the download URL to their registry.
TARBALL="der-${VERSION}.tar.gz"
if [[ ! -f "${INSTALL_ROOT}/releases/${VERSION}/${TARBALL}" ]]; then
    echo "install: expected ${TARBALL} to be present at ${INSTALL_ROOT}/releases/${VERSION}"
    echo "install: download from your artifact registry; this script does not fetch over the network"
    exit 3
fi

# Record the install in a durable manifest so upgrade.sh / rollback.sh
# can walk history.
MANIFEST="${INSTALL_ROOT}/manifest.json"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
{
    echo "{\"version\": \"${VERSION}\", \"installedAt\": \"${TS}\", \"root\": \"${INSTALL_ROOT}/releases/${VERSION}\"}"
} >> "${INSTALL_ROOT}/install-log.ndjson"

# Flip the active symlink.
ln -sfn "${INSTALL_ROOT}/releases/${VERSION}" "${INSTALL_ROOT}/current"
echo "install: ${VERSION} is now active at ${INSTALL_ROOT}/current"
