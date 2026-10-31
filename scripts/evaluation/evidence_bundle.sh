#!/usr/bin/env bash
# §2.3.33 — DER evidence bundle generator.
#
# Snapshots the live server state into a tarball suitable for the
# weekly pilot evidence archive described in docs/pilot/README.md.
#
# Usage:
#   evidence_bundle.sh --base-url URL --session-cookie VAL --out DIR
#   evidence_bundle.sh --base-url URL --username USER --password PASS --out DIR
#
# Produces: $OUT/evidence-<timestamp>.tar.gz
set -euo pipefail

BASE_URL="http://localhost:8085"
COOKIE=""
USERNAME=""
PASSWORD=""
OUT="./evidence-bundles"

usage() {
  cat <<'EOF'
usage: evidence_bundle.sh [options]
  --base-url URL          DER edge base URL (default http://localhost:8085)
  --session-cookie VAL    reuse an existing DER_SESSION cookie value
  --username USER         sign in with these admin credentials (alt to --session-cookie)
  --password PASS
  --out DIR               where to write the tarball (default ./evidence-bundles)
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --base-url)        BASE_URL="$2"; shift 2 ;;
    --session-cookie)  COOKIE="$2"; shift 2 ;;
    --username)        USERNAME="$2"; shift 2 ;;
    --password)        PASSWORD="$2"; shift 2 ;;
    --out)             OUT="$2"; shift 2 ;;
    -h|--help)         usage; exit 0 ;;
    *)                 echo "unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

if [ -z "$COOKIE" ] && [ -z "$USERNAME" ]; then
  echo "need either --session-cookie or --username/--password" >&2
  exit 1
fi

if [ -z "$COOKIE" ]; then
  COOKIE=$(curl -s -c - -X POST "$BASE_URL/edge-api/v1/auth/sign-in" \
    -H 'content-type: application/json' \
    -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" \
    -o /dev/null | awk '/DER_SESSION/{print $NF}')
  if [ -z "$COOKIE" ]; then
    echo "sign-in failed — bad credentials or server unreachable" >&2
    exit 2
  fi
fi

TS=$(date -u +%Y%m%dT%H%M%SZ)
STAGE=$(mktemp -d -t der-evidence-XXXX)
BUNDLE="$STAGE/evidence-$TS"
mkdir -p "$BUNDLE" "$BUNDLE/workflows-canonical"

fetch() {
  local path="$1"
  local out="$2"
  curl -s -H "Cookie: DER_SESSION=$COOKIE" "$BASE_URL$path" > "$out" || true
}

# 1. Headline facts.
curl -s "$BASE_URL/edge-api/v1/system/health" > "$BUNDLE/system-health.json"
printf '%s\n' "$(jq -r '.version // "unknown"' < "$BUNDLE/system-health.json")" \
  > "$BUNDLE/version"

# 2. Workflow catalogue + each workflow's canonical export.
fetch "/edge-api/v1/workflows" "$BUNDLE/workflows.json"
if command -v jq >/dev/null 2>&1; then
  jq -r '.workflows[].workflowId' < "$BUNDLE/workflows.json" | while read -r wf; do
    [ -z "$wf" ] && continue
    fetch "/edge-api/v1/workflows/$wf/export" \
          "$BUNDLE/workflows-canonical/$wf.json"
  done
fi

# 3. Metadata snapshots + per-UID diff of the two most recent (if any).
fetch "/edge-api/v1/metadata/snapshots" "$BUNDLE/snapshots.json"
if command -v jq >/dev/null 2>&1; then
  LATEST=$(jq -r '.snapshots[0].snapshotId // empty' < "$BUNDLE/snapshots.json")
  PREV=$(jq -r '.snapshots[1].snapshotId // empty' < "$BUNDLE/snapshots.json")
  if [ -n "$LATEST" ] && [ -n "$PREV" ]; then
    fetch "/edge-api/v1/metadata/snapshots/$PREV/diff/$LATEST" \
          "$BUNDLE/snapshot-diff-$PREV-$LATEST.json"
  fi
fi

# 4. Devices, operator queue state, peers.
fetch "/edge-api/v1/devices"               "$BUNDLE/devices.json"
fetch "/edge-api/v1/workflows/queue?allDevices=true" "$BUNDLE/queue.json"
fetch "/edge-api/v1/workflows/peers"       "$BUNDLE/peers.json"

# 5. Program-rule action mix — a quick health check that rules are
#    actually populating.
if command -v psql >/dev/null 2>&1 && [ -n "${PGPASSWORD:-}" ]; then
  PGPASSWORD="${PGPASSWORD:-}" psql -h "${PGHOST:-localhost}" \
    -U "${PGUSER:-der}" -d "${PGDATABASE:-der}" \
    -c "SELECT action_type, count(*) FROM der.metadata_program_rule_action GROUP BY action_type ORDER BY 2 DESC" \
    > "$BUNDLE/rule-action-mix.txt" 2>/dev/null || true
fi

# 6. Manifest with checksums.
(
  echo "{"
  echo "  \"generatedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
  echo "  \"baseUrl\": \"$BASE_URL\","
  echo "  \"version\": \"$(cat "$BUNDLE/version")\","
  echo "  \"files\": {"
  cd "$BUNDLE"
  first=1
  find . -type f ! -name manifest.json | sed 's|^./||' | sort | while read -r f; do
    sum=$(shasum -a 256 "$f" | awk '{print $1}')
    if [ $first -eq 1 ]; then first=0; else echo ","; fi
    printf '    "%s": "%s"' "$f" "$sum"
  done
  echo
  echo "  }"
  echo "}"
) > "$BUNDLE/manifest.json"

# 7. Tarball.
mkdir -p "$OUT"
TAR="$OUT/evidence-$TS.tar.gz"
tar -C "$STAGE" -czf "$TAR" "evidence-$TS"
rm -rf "$STAGE"

echo "wrote $TAR"
echo "contents:"
tar -tzf "$TAR" | sed 's/^/  /'
