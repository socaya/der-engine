#!/usr/bin/env bash
#
# FR-01-08 — reproducible, versioned install.
#
# Usage:
#   install.sh <der-version> [install-root]
#   install.sh --list [install-root]
#   install.sh --active [install-root]
#
# Idempotent:
#   * Re-running with the already-active version is a no-op.
#   * Re-running with an already-installed-but-not-active version flips
#     the symlink without re-staging the tarball.
#   * Re-running with a new version requires the tarball + its .sha256
#     sibling to be present under <root>/releases/<version>/.
#
# Companion scripts: upgrade.sh (compat-checked flip with rollback),
# rollback.sh (manual flip to a previous version). See
# docs/operations/pilot-runbook.md §Upgrade.

set -Eeuo pipefail

INSTALL_ROOT="/opt/der"
MODE="install"
VERSION=""

for arg in "$@"; do
  case "$arg" in
    --list)    MODE="list" ;;
    --active)  MODE="active" ;;
    --help|-h)
      sed -n '2,20p' "$0"; exit 0 ;;
    -*)
      echo "unknown flag: $arg" >&2; exit 2 ;;
    *)
      if [[ -z "$VERSION" && "$MODE" == "install" ]]; then
        VERSION="$arg"
      else
        INSTALL_ROOT="$arg"
      fi ;;
  esac
done

log() { printf '[install] %s\n' "$*"; }

MANIFEST="${INSTALL_ROOT}/install-log.ndjson"

# --- list / active queries ---------------------------------------------

if [[ "$MODE" == "list" ]]; then
  if [[ ! -f "$MANIFEST" ]]; then
    echo "no installs recorded under ${INSTALL_ROOT}"
    exit 0
  fi
  echo "installs under ${INSTALL_ROOT}:"
  cat "$MANIFEST"
  exit 0
fi

if [[ "$MODE" == "active" ]]; then
  if [[ ! -L "${INSTALL_ROOT}/current" ]]; then
    echo "no active release under ${INSTALL_ROOT}"
    exit 0
  fi
  readlink "${INSTALL_ROOT}/current"
  exit 0
fi

# --- install mode ------------------------------------------------------

if [[ -z "$VERSION" ]]; then
  echo "usage: $0 <der-version> [install-root]" >&2
  echo "       $0 --list | --active [install-root]" >&2
  exit 2
fi

RELEASE_DIR="${INSTALL_ROOT}/releases/${VERSION}"
TARBALL="${RELEASE_DIR}/der-${VERSION}.tar.gz"
SHA="${RELEASE_DIR}/der-${VERSION}.tar.gz.sha256"
STAGE_MARKER="${RELEASE_DIR}/.staged"

# Already active?
if [[ -L "${INSTALL_ROOT}/current" ]]; then
  ACTIVE="$(readlink "${INSTALL_ROOT}/current")"
  if [[ "$ACTIVE" == "$RELEASE_DIR" ]]; then
    log "${VERSION} already active at ${INSTALL_ROOT}/current — no-op"
    exit 0
  fi
fi

# Prerequisite check — the pilot installer owns the OS layer, but this
# script is called by both the pilot path and manual operators. A tiny
# sanity check saves a confusing "java: command not found" later.
if [[ "${DER_INSTALL_SKIP_PREREQ:-}" != "1" ]]; then
  for bin in java systemctl; do
    if ! command -v "$bin" >/dev/null 2>&1; then
      echo "install: '$bin' not on PATH — run scripts/install/bootstrap-host.sh first" >&2
      echo "install: set DER_INSTALL_SKIP_PREREQ=1 for tooling/smoke-test contexts" >&2
      exit 3
    fi
  done
fi

# Stage the release if not already staged. Pure file operations;
# the script never downloads anything. Operators place
#   <root>/releases/<version>/der-<version>.tar.gz
#   <root>/releases/<version>/der-<version>.tar.gz.sha256
# from their artefact registry.
if [[ ! -f "$STAGE_MARKER" ]]; then
  mkdir -p "$RELEASE_DIR"

  if [[ ! -f "$TARBALL" ]]; then
    echo "install: expected $TARBALL" >&2
    echo "install: place the release artefact under ${RELEASE_DIR} first" >&2
    exit 4
  fi

  if [[ ! -f "$SHA" ]]; then
    echo "install: expected $SHA (pin; same format as sha256sum output)" >&2
    exit 5
  fi

  log "verifying sha256 of ${TARBALL}"
  # Portable sha256 check — macOS sha256sum doesn't implement --check.
  # Expected pin file format: "<hex>  <relative-path>" (same as
  # GNU sha256sum output).
  EXPECTED="$(awk 'NR==1{print $1}' "$SHA")"
  if command -v sha256sum >/dev/null 2>&1; then
    ACTUAL="$(sha256sum "$TARBALL" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then
    ACTUAL="$(shasum -a 256 "$TARBALL" | awk '{print $1}')"
  else
    echo "install: neither sha256sum nor shasum on PATH — cannot verify" >&2
    exit 6
  fi
  if [[ "$EXPECTED" != "$ACTUAL" ]]; then
    echo "install: sha256 mismatch for $TARBALL" >&2
    echo "  expected: $EXPECTED" >&2
    echo "  actual:   $ACTUAL" >&2
    exit 6
  fi
  log "sha256 OK"

  log "extracting ${TARBALL}"
  tar -xzf "$TARBALL" -C "$RELEASE_DIR"

  touch "$STAGE_MARKER"
else
  log "${VERSION} already staged — reusing"
fi

# Record + flip.
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
PREV="unknown"
if [[ -L "${INSTALL_ROOT}/current" ]]; then
  PREV="$(readlink "${INSTALL_ROOT}/current")"
fi

printf '{"event":"INSTALL","version":"%s","installedAt":"%s","root":"%s","previous":"%s"}\n' \
  "$VERSION" "$TS" "$RELEASE_DIR" "$PREV" >> "$MANIFEST"

ln -sfn "$RELEASE_DIR" "${INSTALL_ROOT}/current"
log "${VERSION} active at ${INSTALL_ROOT}/current"
log "previous = ${PREV} (preserved for rollback)"
