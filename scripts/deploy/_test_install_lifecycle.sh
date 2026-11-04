#!/usr/bin/env bash
#
# FR-01-08 / FR-01-09 — install/upgrade/rollback smoke test.
#
# Runs the three scripts against a temporary install root with dummy
# tarballs. Verifies the symlink flips, sha256 verification, idempotent
# re-runs, and the install-log manifest shape. Does not need a running
# DER — upgrade.sh's health probe is not exercised here (that belongs
# in docs/evaluation/evidence/, not in the lint gate).
#
# Exit 0 — clean; non-zero — assertion failure.

set -Eeuo pipefail

# The install prereq check demands java + systemctl; the lifecycle
# smoke runs on CI + dev machines that may lack systemctl. Skip the
# check — this test is about the install state machine, not the host
# prereq enforcement (that's bootstrap-host.sh's job).
export DER_INSTALL_SKIP_PREREQ=1

ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL="${HERE}/install.sh"
ROLLBACK="${HERE}/rollback.sh"

assert() {
  if ! eval "$1"; then
    echo "FAIL: $2" >&2
    echo "  while evaluating: $1" >&2
    exit 1
  fi
  echo "ok: $2"
}

# Stage two dummy "releases". Each is a tarball with a single README.
mkstage() {
  local version="$1"
  local rel="${ROOT}/releases/${version}"
  mkdir -p "$rel"
  echo "DER ${version}" > "${rel}/README"
  tar -czf "${rel}/der-${version}.tar.gz" -C "$rel" README
  rm "${rel}/README"
  ( cd "$rel" && sha256sum "der-${version}.tar.gz" > "der-${version}.tar.gz.sha256" )
}
mkstage "1.0.0"
mkstage "1.1.0"

# --- 1. First install flips current → releases/1.0.0 ------------------
"$INSTALL" "1.0.0" "$ROOT" >/dev/null
assert '[[ -L "$ROOT/current" ]]'           'symlink created'
assert '[[ "$(readlink "$ROOT/current")" == "$ROOT/releases/1.0.0" ]]' \
       'symlink points to 1.0.0'
assert '[[ -f "$ROOT/install-log.ndjson" ]]' 'manifest written'
assert 'grep -q "\"event\":\"INSTALL\"" "$ROOT/install-log.ndjson"' \
       'INSTALL event recorded'
assert '[[ -f "$ROOT/releases/1.0.0/README" ]]' 'tarball extracted'

# --- 2. Idempotent re-run -- same version is a no-op ------------------
BEFORE="$(wc -l < "$ROOT/install-log.ndjson")"
"$INSTALL" "1.0.0" "$ROOT" >/dev/null
AFTER="$(wc -l < "$ROOT/install-log.ndjson")"
assert '[[ "$AFTER" -eq "$BEFORE" ]]' 'no-op re-run does not log'

# --- 3. Install second version flips symlink --------------------------
"$INSTALL" "1.1.0" "$ROOT" >/dev/null
assert '[[ "$(readlink "$ROOT/current")" == "$ROOT/releases/1.1.0" ]]' \
       'symlink flipped to 1.1.0'
assert 'grep -q "\"previous\":\"$ROOT/releases/1.0.0\"" "$ROOT/install-log.ndjson"' \
       'previous recorded on second install'

# --- 4. --list / --active queries -------------------------------------
assert '[[ "$("$INSTALL" --active "$ROOT")" == "$ROOT/releases/1.1.0" ]]' \
       '--active prints current target'
LIST_OUT="$("$INSTALL" --list "$ROOT")"
assert 'echo "$LIST_OUT" | grep -q "1.0.0"' '--list shows 1.0.0'
assert 'echo "$LIST_OUT" | grep -q "1.1.0"' '--list shows 1.1.0'

# --- 5. Rollback to 1.0.0 (service start/stop fail silently) ---------
"$ROLLBACK" "1.0.0" "$ROOT" >/dev/null
assert '[[ "$(readlink "$ROOT/current")" == "$ROOT/releases/1.0.0" ]]' \
       'rollback flipped symlink back'
assert 'grep -q "\"event\":\"ROLLBACK\"" "$ROOT/install-log.ndjson"' \
       'ROLLBACK event recorded'

# --- 6. Rollback no-op when already on target -------------------------
BEFORE="$(wc -l < "$ROOT/install-log.ndjson")"
"$ROLLBACK" "1.0.0" "$ROOT" >/dev/null
AFTER="$(wc -l < "$ROOT/install-log.ndjson")"
assert '[[ "$AFTER" -eq "$BEFORE" ]]' 'rollback is idempotent'

# --- 7. sha256 mismatch aborts -----------------------------------------
mkdir -p "${ROOT}/releases/1.2.0"
echo "DER 1.2.0" > "${ROOT}/releases/1.2.0/README"
tar -czf "${ROOT}/releases/1.2.0/der-1.2.0.tar.gz" \
    -C "${ROOT}/releases/1.2.0" README
rm "${ROOT}/releases/1.2.0/README"
echo "deadbeef  der-1.2.0.tar.gz" > "${ROOT}/releases/1.2.0/der-1.2.0.tar.gz.sha256"
if "$INSTALL" "1.2.0" "$ROOT" 2>/dev/null; then
  echo "FAIL: install.sh accepted a bad sha256" >&2
  exit 1
fi
echo "ok: install rejects bad sha256"

echo
echo "all install lifecycle assertions passed"
