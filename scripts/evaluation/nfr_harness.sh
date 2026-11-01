#!/usr/bin/env bash
# §2.3.44 — NFR evaluation harness. Pilot-friendly latency / throughput
# probe that produces an archivable JSON for the evidence bundle.
#
# Measures:
#   1. metadata sync time (POST /sync/metadata end-to-end)
#   2. workflow create latency (POST /workflows average over N)
#   3. queue read latency (GET /workflows/queue average over N)
#   4. contribution throughput (open run + N contributes, wall-clock)
#
# Usage:
#   nfr_harness.sh --base-url URL --username USER --password PASS \
#                   [--iterations 20] [--out docs/evaluation/evidence/]
set -euo pipefail

BASE_URL="http://localhost:8085"
USERNAME=""
PASSWORD=""
ITER=20
OUT="docs/evaluation/evidence"

usage() { cat <<EOF
usage: nfr_harness.sh [options]
  --base-url URL         DER edge base URL
  --username USER        admin user
  --password PASS        admin password
  --iterations N         iterations per op (default 20)
  --out DIR              where to write nfr-<ts>.json (default docs/evaluation/evidence)
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --base-url)   BASE_URL="$2"; shift 2 ;;
    --username)   USERNAME="$2"; shift 2 ;;
    --password)   PASSWORD="$2"; shift 2 ;;
    --iterations) ITER="$2"; shift 2 ;;
    --out)        OUT="$2"; shift 2 ;;
    -h|--help)    usage; exit 0 ;;
    *) echo "unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
  echo "need --username and --password" >&2; exit 1
fi

TS=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$OUT"
REPORT="$OUT/nfr-$TS.json"

now_ms() { python3 -c 'import time;print(int(time.time()*1000))'; }
median() { python3 -c 'import sys,statistics;xs=[int(x) for x in sys.stdin.read().split()];print(int(statistics.median(xs)) if xs else 0)'; }
p95() { python3 -c 'import sys,statistics;xs=sorted(int(x) for x in sys.stdin.read().split());print(xs[max(0,int(len(xs)*0.95)-1)] if xs else 0)'; }

COOKIE=$(curl -s -c - -X POST "$BASE_URL/edge-api/v1/auth/sign-in" \
  -H 'content-type: application/json' \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" \
  -o /dev/null | awk '/DER_SESSION/{print $NF}')
if [ -z "$COOKIE" ]; then
  echo "sign-in failed" >&2; exit 2
fi

echo "== metadata sync =="
SYNC_START=$(now_ms)
curl -s -X POST -H "Cookie: DER_SESSION=$COOKIE" \
  "$BASE_URL/edge-api/v1/sync/metadata" > /tmp/nfr-sync.json
SYNC_END=$(now_ms)
SYNC_MS=$((SYNC_END - SYNC_START))
SYNC_TOTAL=$(python3 -c 'import json; print(json.load(open("/tmp/nfr-sync.json")).get("total",0))')
echo "  elapsed: ${SYNC_MS}ms  rows: $SYNC_TOTAL"

echo "== workflow create latency ($ITER iterations) =="
CREATE_SAMPLES=""
CREATED_IDS=""
for i in $(seq 1 "$ITER"); do
  STEP_UUID=$(uuidgen | tr A-Z a-z)
  START=$(now_ms)
  RESP=$(curl -s -X POST -H "Cookie: DER_SESSION=$COOKIE" -H 'content-type: application/json' \
    "$BASE_URL/edge-api/v1/workflows" \
    -d "{\"displayName\":\"nfr-$TS-$i\",\"boundMetadataKind\":\"DATA_SET\",\"boundMetadataId\":\"NFR\",\"enabled\":true,\"steps\":[{\"stepId\":\"$STEP_UUID\",\"ordinal\":0,\"displayName\":\"A\",\"ownerRole\":\"OPERATOR\",\"stepKind\":\"CAPTURE\",\"sectionKind\":\"DATASET_SECTION\",\"sectionRef\":\"s\",\"fields\":[]}],\"dependencies\":[]}")
  END=$(now_ms)
  CREATE_SAMPLES="$CREATE_SAMPLES $((END - START))"
  WFID=$(echo "$RESP" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("workflowId",""))')
  CREATED_IDS="$CREATED_IDS $WFID"
done
CREATE_MEDIAN=$(echo "$CREATE_SAMPLES" | median)
CREATE_P95=$(echo "$CREATE_SAMPLES" | p95)
echo "  median: ${CREATE_MEDIAN}ms  p95: ${CREATE_P95}ms"

echo "== queue read latency ($ITER iterations) =="
QUEUE_SAMPLES=""
for i in $(seq 1 "$ITER"); do
  START=$(now_ms)
  curl -s -H "Cookie: DER_SESSION=$COOKIE" \
    "$BASE_URL/edge-api/v1/workflows/queue?allDevices=true" > /dev/null
  END=$(now_ms)
  QUEUE_SAMPLES="$QUEUE_SAMPLES $((END - START))"
done
QUEUE_MEDIAN=$(echo "$QUEUE_SAMPLES" | median)
QUEUE_P95=$(echo "$QUEUE_SAMPLES" | p95)
echo "  median: ${QUEUE_MEDIAN}ms  p95: ${QUEUE_P95}ms"

echo "== contribution throughput ($ITER contributions, 1 run) =="
# Pick the first created workflow + open a run on it.
FIRST_WF=$(echo "$CREATED_IDS" | awk '{print $1}')
STEP_ID=$(curl -s -H "Cookie: DER_SESSION=$COOKIE" \
  "$BASE_URL/edge-api/v1/workflows/$FIRST_WF" \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["steps"][0]["stepId"])')
RUN_ID=$(curl -s -X POST -H "Cookie: DER_SESSION=$COOKIE" -H 'content-type: application/json' \
  "$BASE_URL/edge-api/v1/workflows/$FIRST_WF/runs" \
  -d "{\"businessKey\":\"nfr-$TS\"}" \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["runId"])')
CONTRIB_START=$(now_ms)
for i in $(seq 1 "$ITER"); do
  curl -s -X POST -H "Cookie: DER_SESSION=$COOKIE" -H 'content-type: application/json' \
    "$BASE_URL/edge-api/v1/workflows/runs/$RUN_ID/steps/$STEP_ID/contribute" \
    -d "{\"payload\":\"{\\\"dataValues\\\":[{\\\"dataElement\\\":\\\"DE_$i\\\",\\\"value\\\":\\\"$i\\\"}]}\"}" \
    > /dev/null
done
CONTRIB_END=$(now_ms)
CONTRIB_MS=$((CONTRIB_END - CONTRIB_START))
CONTRIB_PER_SEC=$(python3 -c "print(round($ITER * 1000 / max(1, $CONTRIB_MS), 2))")
echo "  $ITER contributions in ${CONTRIB_MS}ms  →  ${CONTRIB_PER_SEC} ops/s"

# Clean up test workflows.
for id in $CREATED_IDS; do
  if [ -n "$id" ]; then
    curl -s -X DELETE -H "Cookie: DER_SESSION=$COOKIE" \
      "$BASE_URL/edge-api/v1/workflows/$id" > /dev/null
  fi
done

cat > "$REPORT" <<EOF
{
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "baseUrl": "$BASE_URL",
  "iterations": $ITER,
  "metadataSync": {
    "elapsedMs": $SYNC_MS,
    "rowsMirrored": $SYNC_TOTAL
  },
  "workflowCreate": {
    "medianMs": $CREATE_MEDIAN,
    "p95Ms": $CREATE_P95
  },
  "queueRead": {
    "medianMs": $QUEUE_MEDIAN,
    "p95Ms": $QUEUE_P95
  },
  "contributionThroughput": {
    "totalMs": $CONTRIB_MS,
    "opsPerSec": $CONTRIB_PER_SEC
  }
}
EOF
echo "wrote $REPORT"
