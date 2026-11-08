#!/usr/bin/env bash
#
# Install the new unified `capture` app on the running DER edge and
# disable the superseded capture-event + capture-tracker apps.
#
# Run against a running DER server (expects DER_URL, DER_USER,
# DER_PASS or the matching env vars from .env.local). Requires
# `apps/capture/dist/capture.zip` to exist — build with:
#
#   cd client && node scripts/build-apps.mjs
#
# Idempotent: if the capture app is already installed, re-uploads
# as a new version (`upgrade` flow). Disabling capture-event/-tracker
# is best-effort — a missing row is logged, not fatal.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck disable=SC1091
if [[ -f "$REPO_ROOT/.env.local" ]]; then
  set -a; . "$REPO_ROOT/.env.local"; set +a
fi

DER_URL="${DER_URL:-https://localhost:8443}"
DER_USER="${DER_USER:-${DER_BOOTSTRAP_ADMIN_USERNAME:-der-admin}}"
DER_PASS="${DER_PASS:-${DER_BOOTSTRAP_ADMIN_PASSWORD:-}}"
if [[ -z "$DER_PASS" ]]; then
  echo "DER_PASS (or DER_BOOTSTRAP_ADMIN_PASSWORD) required" >&2
  exit 2
fi
ZIP="$REPO_ROOT/apps/capture/dist/capture.zip"
if [[ ! -f "$ZIP" ]]; then
  echo "capture.zip missing at $ZIP — build the apps first" >&2
  exit 2
fi

cookie_jar=$(mktemp)
trap 'rm -f "$cookie_jar"' EXIT

log()  { printf '[install-capture] %s\n' "$*"; }
die()  { printf '[install-capture] %s\n' "$*" >&2; exit 1; }

log "signing in to DER as $DER_USER"
http=$(curl -sk -c "$cookie_jar" -o /dev/null -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -X POST \
  --data-raw "{\"username\":\"$DER_USER\",\"password\":\"$DER_PASS\"}" \
  "$DER_URL/edge-api/v1/auth/sign-in")
[[ "$http" == "200" ]] || die "sign-in returned HTTP $http"

log "uploading apps/capture/dist/capture.zip to $DER_URL"
resp=$(curl -sk -b "$cookie_jar" -w '\nHTTP:%{http_code}\n' \
  -X POST \
  -F "file=@$ZIP" \
  "$DER_URL/edge-api/v1/admin/apps/install")
http=$(printf '%s' "$resp" | sed -nE 's/^HTTP:([0-9]+)$/\1/p' | tail -1)
body=$(printf '%s' "$resp" | sed '$d')
if [[ "$http" != "200" ]]; then
  echo "$body" >&2
  die "install returned HTTP $http"
fi
printf '%s\n' "$body"

# Best-effort: disable the old scaffold apps so operators don't
# see stale launcher tiles alongside the unified Capture app.
list=$(curl -sk -b "$cookie_jar" "$DER_URL/edge-api/v1/apps")
for key in capture-event capture-tracker; do
  app_id=$(python3 -c "
import json, sys
data = json.loads(sys.argv[1])
for app in data.get('apps', []):
    if app.get('appKey') == '$key':
        print(app.get('appId', ''))
        break
" "$list")
  if [[ -z "$app_id" ]]; then
    log "note: $key not installed — skipping disable"
    continue
  fi
  log "disabling superseded app $key ($app_id)"
  http=$(curl -sk -b "$cookie_jar" -o /dev/null -w '%{http_code}' \
    -X POST "$DER_URL/edge-api/v1/admin/apps/$app_id/disable")
  [[ "$http" == "200" ]] || log "  warn: disable $key returned HTTP $http"
done

log "done — launcher should now surface one 'Capture' tile at /apps/capture"
