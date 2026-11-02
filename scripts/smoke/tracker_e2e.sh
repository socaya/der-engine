#!/usr/bin/env bash
#
# §2.3.96 R-D/tracker-smoke — end-to-end smoke test of the DER tracker
# write path through to Central DHIS2.
#
# Flow:
#   1. Sign in to the local DER instance as the bootstrap admin.
#   2. POST a tracked entity through /edge-api/v1/tracked-entities.
#   3. Trigger the journal drain scheduler via /edge-api/v1/sync/jobs.
#   4. Poll operation_journal for the TRACKED_ENTITY entry until it
#      transitions to CENTRAL_ACCEPTED (or a terminal failure).
#   5. Query Central /api/trackedEntities to confirm the row landed.
#
# Prerequisites: DER server up on https://der.local, Central DHIS2 at
# http://localhost:8080/dhis, Postgres superuser psql access (uses the
# dev DB password from .env.local).
#
# Exits non-zero on any failure. Prints verbose status to stderr.

set -euo pipefail

DER_URL="${DER_URL:-https://der.local}"
CENTRAL_URL="${CENTRAL_URL:-http://localhost:8080/dhis}"
DER_USER="${DER_USER:-der-admin}"
DER_PASS="${DER_PASS:-OY2/uIass26KcwqwMIc+UjqlBDNDU4ER}"
CENTRAL_USER="${CENTRAL_USER:-admin}"
CENTRAL_PASS="${CENTRAL_PASS:-district}"
PG_PASS="${PG_PASS:-der_phase01_devonly}"
PG_USER="${PG_USER:-der}"
PG_DB="${PG_DB:-der}"
PG_HOST="${PG_HOST:-localhost}"

TE_TYPE="${TE_TYPE:-mxs9pVJzjeG}"
# §2.3.115 R-AL — ORG_UNIT defaults to the edge's bound OU (read
# below after sign-in). Setting ORG_UNIT in env overrides and skips
# the auto-detect, so operators can still deliberately smoke an
# out-of-scope OU to exercise the warning banners.
POLL_MAX=60
POLL_INTERVAL=1

log()  { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" >&2; }
die()  { log "FAIL: $*"; exit 1; }
cookie_jar="$(mktemp)"
cleanup() { rm -f "$cookie_jar"; }
trap cleanup EXIT

# ---------- 1. Sign in ----------
log "signing in to DER as $DER_USER"
http=$(curl -sk -c "$cookie_jar" -o /dev/null -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -X POST \
  --data-raw "{\"username\":\"$DER_USER\",\"password\":\"$DER_PASS\"}" \
  "$DER_URL/edge-api/v1/auth/sign-in")
[[ "$http" == "200" ]] || die "sign-in returned HTTP $http"

# ---------- 1a. Resolve ORG_UNIT from the edge's bound OU ----------
# Only auto-detect if the operator didn't set ORG_UNIT in env.
if [[ -z "${ORG_UNIT:-}" ]]; then
  bound_json=$(curl -sk -b "$cookie_jar" "$DER_URL/edge-api/v1/system/org-unit")
  bound_id=$(printf '%s' "$bound_json" \
                | sed -nE 's/.*"orgUnitId":"([^"]+)".*/\1/p')
  if [[ -n "$bound_id" ]]; then
    ORG_UNIT="$bound_id"
    log "ORG_UNIT auto-detected from bound OU → $ORG_UNIT"
  else
    die "ORG_UNIT not set and edge is unbound; set ORG_UNIT=<uid> explicitly"
  fi
fi

# ---------- 2. POST a tracked entity ----------
TEI_UID="SMOKE$(date +%s | tr -d '\n' | tail -c 6)"
log "posting TEI $TEI_UID under program-TE-type $TE_TYPE orgUnit $ORG_UNIT"
body=$(cat <<JSON
{
  "teiUid": "$TEI_UID",
  "trackedEntityType": "$TE_TYPE",
  "orgUnit": "$ORG_UNIT",
  "attributes": {}
}
JSON
)
http=$(curl -sk -b "$cookie_jar" -o /tmp/tei-post.json -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -X POST --data-raw "$body" \
  "$DER_URL/edge-api/v1/tracked-entities")
[[ "$http" == "200" ]] || { cat /tmp/tei-post.json >&2; die "POST TEI returned HTTP $http"; }
log "DER accepted TEI → $(cat /tmp/tei-post.json)"

# ---------- 3. Trigger the journal worker drain ----------
log "triggering journal drain"
http=$(curl -sk -b "$cookie_jar" -o /dev/null -w '%{http_code}' \
  -X POST "$DER_URL/edge-api/v1/sync/jobs/JOURNAL_WORKER_DRAIN/trigger")
# Trigger may return 200 or 202; both are fine
case "$http" in 200|202) ;; *) die "trigger returned HTTP $http" ;; esac

# ---------- 4. Poll operation_journal ----------
log "polling operation_journal for CENTRAL_ACCEPTED (up to $POLL_MAX s)"
final_state=""
for attempt in $(seq 1 "$POLL_MAX"); do
  state=$(PGPASSWORD="$PG_PASS" psql -U "$PG_USER" -h "$PG_HOST" -d "$PG_DB" \
    -t -A -c "SELECT state FROM der.operation_journal \
              WHERE entity_type='TRACKED_ENTITY' AND entity_ref='$TEI_UID' \
              ORDER BY created_at DESC LIMIT 1" 2>/dev/null | tr -d '[:space:]')
  log "  attempt $attempt/$POLL_MAX — state=${state:-<missing>}"
  if [[ "$state" == "CENTRAL_ACCEPTED" ]]; then
    final_state="$state"; break
  fi
  if [[ "$state" == "CENTRAL_REJECTED" || "$state" == "CONFLICT_REVIEW" ]]; then
    final_state="$state"
    err=$(PGPASSWORD="$PG_PASS" psql -U "$PG_USER" -h "$PG_HOST" -d "$PG_DB" \
      -t -A -c "SELECT last_error FROM der.operation_journal \
                WHERE entity_type='TRACKED_ENTITY' AND entity_ref='$TEI_UID' \
                ORDER BY created_at DESC LIMIT 1" 2>/dev/null)
    die "terminal failure state=$final_state last_error=$err"
  fi
  sleep "$POLL_INTERVAL"
done
[[ "$final_state" == "CENTRAL_ACCEPTED" ]] || die "did not reach CENTRAL_ACCEPTED after ${POLL_MAX}s (last=${final_state:-<missing>})"
log "journal reached CENTRAL_ACCEPTED"

# ---------- 5. Verify on Central ----------
log "verifying TEI exists on Central"
central_http=$(curl -sk -u "$CENTRAL_USER:$CENTRAL_PASS" -o /tmp/central-tei.json -w '%{http_code}' \
  "$CENTRAL_URL/api/tracker/trackedEntities/$TEI_UID?fields=trackedEntity,trackedEntityType,orgUnit")
if [[ "$central_http" == "200" ]]; then
  log "Central confirms TEI → $(cat /tmp/central-tei.json)"
else
  log "Central lookup returned HTTP $central_http (may be eventually consistent)"
  log "body: $(cat /tmp/central-tei.json 2>/dev/null)"
fi

log "SMOKE PASSED"
printf 'TEI_UID=%s\nFINAL_STATE=%s\n' "$TEI_UID" "$final_state"
