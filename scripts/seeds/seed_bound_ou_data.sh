#!/usr/bin/env bash
#
# §2.3.115 R-AL — seed clean, bound-OU-aligned data on the local DER
# edge so operators can exercise the Aggregate / Events / Tracker
# sync pipeline end-to-end without triggering the "Out of bound OU"
# warning banners from R-AK.
#
# What this seeds (all under the edge's current bound OU):
#   1. One aggregate data value — scoped to a known dataSet + period.
#   2. One single-event — scoped to an event-only program + stage.
#   3. One TEI + one enrolment + one program-stage event — scoped to
#      a tracker program.
#
# All three are written through the normal DER edge-API capture paths
# (not the DHIS2 passthrough), so each row:
#   - lands in its local domain table,
#   - gets a workflow_run_id tag (SYSTEM capture-wrap),
#   - gets an operation_journal entry,
#   - is picked up by the sync worker on the next drain tick.
#
# Prerequisites: DER up on $DER_URL, bound to a non-null OU. Pass the
# three metadata UIDs via env if your DHIS2 instance doesn't match
# the defaults — these mirror the DHIS2 "sierra leone" demo DB and
# the DER 2.44-SNAPSHOT reference.
#
# Exit codes:
#   0 — every seed landed
#   1 — bootstrap or any seed step failed

set -euo pipefail

# §2.3.116 R-AM — --clean purges previously-seeded rows via psql
# using the UIDs we recorded in SEED_LOG. Idempotent reseed.
MODE="seed"
if [[ "${1:-}" == "--clean" ]]; then
  MODE="clean"
fi

DER_URL="${DER_URL:-http://localhost:8085}"
DER_USER="${DER_USER:-der-admin}"
DER_PASS="${DER_PASS:-OY2/uIass26KcwqwMIc+UjqlBDNDU4ER}"

# PG direct connection — only used by --clean. Matches the smoke
# script envs.
PG_HOST="${PG_HOST:-localhost}"
PG_USER="${PG_USER:-der}"
PG_PASS="${PG_PASS:-der_phase01_devonly}"
PG_DB="${PG_DB:-der}"

SEED_LOG="${SEED_LOG:-/tmp/der-seed-log.jsonl}"

# ---- metadata UIDs (override via env for your instance) ----
# Aggregate: dataset ANC 1st visit · DE ANC 1 · period 2026Q1 · value 17.
DATA_SET="${DATA_SET:-lyLU2wR22tC}"
DATA_ELEMENT="${DATA_ELEMENT:-fbfJHSPpUQD}"
PERIOD="${PERIOD:-2026Q1}"
CATEGORY_OPTION_COMBO="${CATEGORY_OPTION_COMBO:-HllvX50cXC0}"
ATTRIBUTE_OPTION_COMBO="${ATTRIBUTE_OPTION_COMBO:-HllvX50cXC0}"
AGG_VALUE="${AGG_VALUE:-17}"

# Events: single-event program "Inpatient morbidity and mortality"
# with stage of the same name.
EVENT_PROGRAM="${EVENT_PROGRAM:-eBAyeGv0exc}"
EVENT_STAGE="${EVENT_STAGE:-Zj7UnCAulEk}"
EVENT_DE="${EVENT_DE:-K6uUAvq500H}"
EVENT_DE_VALUE="${EVENT_DE_VALUE:-14}"

# Tracker: child-programme + ANC stage.
TRACKER_PROGRAM="${TRACKER_PROGRAM:-IpHINAT79UW}"
TRACKER_STAGE="${TRACKER_STAGE:-A03MvHHogjR}"
TRACKER_TE_TYPE="${TRACKER_TE_TYPE:-nEenWmSyUEp}"
TRACKER_TE_ATTR="${TRACKER_TE_ATTR:-w75KJ2mc4zz}"
TRACKER_TE_ATTR_VALUE="${TRACKER_TE_ATTR_VALUE:-SeedAlice}"
TRACKER_STAGE_DE="${TRACKER_STAGE_DE:-a3kGcGDCuk6}"
TRACKER_STAGE_DE_VALUE="${TRACKER_STAGE_DE_VALUE:-33}"

TODAY="$(date +%F)"
cookie_jar="$(mktemp)"
cleanup() { rm -f "$cookie_jar"; }
trap cleanup EXIT

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" >&2; }
die() { log "FAIL: $*"; exit 1; }

# §2.3.116 R-AM — append a seed-log entry for later --clean passes.
record_seed() {
  local kind="$1"; local uid="$2"; local ou="$3"
  printf '{"ts":"%s","kind":"%s","uid":"%s","orgUnit":"%s"}\n' \
    "$(date -u +%FT%TZ)" "$kind" "$uid" "$ou" >> "$SEED_LOG"
}

run_clean() {
  if [[ ! -s "$SEED_LOG" ]]; then
    log "no prior seeds in $SEED_LOG — nothing to clean"
    return 0
  fi
  log "purging prior seeds from $SEED_LOG via psql"
  # Collect per-kind UID lists.
  declare -a aggregate_cmt tei enr trk_evt evt
  while IFS= read -r line; do
    local kind uid
    kind=$(printf '%s' "$line" | sed -nE 's/.*"kind":"([^"]+)".*/\1/p')
    uid=$(printf '%s'  "$line" | sed -nE 's/.*"uid":"([^"]+)".*/\1/p')
    case "$kind" in
      aggregate) aggregate_cmt+=("$uid") ;;
      tei)       tei+=("$uid") ;;
      enrol)     enr+=("$uid") ;;
      trk_evt)   trk_evt+=("$uid") ;;
      evt)       evt+=("$uid") ;;
    esac
  done < "$SEED_LOG"

  export PGPASSWORD="$PG_PASS"
  local in_list=''
  if (( ${#aggregate_cmt[@]} )); then
    # Aggregate seeds carry a well-known comment prefix.
    psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c \
      "DELETE FROM der.aggregate_data_value \
       WHERE comment = 'seeded by scripts/seeds/seed_bound_ou_data.sh'" \
      >/dev/null && log "cleaned aggregate seeds"
  fi
  if (( ${#evt[@]} )); then
    in_list=$(IFS=,; printf "'%s'" "${evt[*]/,/','}")
    psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c \
      "DELETE FROM der.event_data_value WHERE event_id::text IN ($in_list)" \
      >/dev/null || true
    psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c \
      "DELETE FROM der.event WHERE event_id::text IN ($in_list)" \
      >/dev/null && log "cleaned ${#evt[@]} event seed(s)"
  fi
  if (( ${#trk_evt[@]} )); then
    in_list=$(IFS=,; printf "'%s'" "${trk_evt[*]/,/','}")
    psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c \
      "DELETE FROM der.edge_tracker_event WHERE event_uid IN ($in_list)" \
      >/dev/null && log "cleaned ${#trk_evt[@]} tracker-event seed(s)"
  fi
  if (( ${#enr[@]} )); then
    in_list=$(IFS=,; printf "'%s'" "${enr[*]/,/','}")
    psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c \
      "DELETE FROM der.edge_enrollment WHERE enrollment_uid IN ($in_list)" \
      >/dev/null && log "cleaned ${#enr[@]} enrolment seed(s)"
  fi
  if (( ${#tei[@]} )); then
    in_list=$(IFS=,; printf "'%s'" "${tei[*]/,/','}")
    psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c \
      "DELETE FROM der.tracked_entity WHERE tei_uid IN ($in_list)" \
      >/dev/null && log "cleaned ${#tei[@]} TEI seed(s)"
  fi
  : > "$SEED_LOG"
  log "clean complete; $SEED_LOG truncated"
}

# DHIS2 UID: 11 chars, first alphabetic, remainder alphanumeric.
dhis_uid() {
  local first="$(LC_ALL=C tr -dc 'A-Za-z' < /dev/urandom | head -c 1)"
  local rest="$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 10)"
  printf '%s%s' "$first" "$rest"
}

if [[ "$MODE" == "clean" ]]; then
  run_clean
  exit 0
fi

# ---- 1. Sign in ----
log "signing in to DER as $DER_USER at $DER_URL"
http=$(curl -sk -c "$cookie_jar" -o /dev/null -w '%{http_code}' \
  -H 'Content-Type: application/json' -X POST \
  --data-raw "{\"username\":\"$DER_USER\",\"password\":\"$DER_PASS\"}" \
  "$DER_URL/edge-api/v1/auth/sign-in")
[[ "$http" == "200" ]] || die "sign-in returned HTTP $http"

# ---- 2. Read bound OU ----
bound_json=$(curl -sk -b "$cookie_jar" "$DER_URL/edge-api/v1/system/org-unit")
ORG_UNIT=$(printf '%s' "$bound_json" | sed -nE 's/.*"orgUnitId":"([^"]+)".*/\1/p')
BOUND_NAME=$(printf '%s' "$bound_json" | sed -nE 's/.*"orgUnitDisplayName":"([^"]+)".*/\1/p')
[[ -n "$ORG_UNIT" ]] || die "edge is unbound — bind an OU first via /integration/organisation-unit"
log "bound OU: $BOUND_NAME ($ORG_UNIT)"

# ---- 3. Seed aggregate value (DHIS2 passthrough @ /api/dataValueSets) ----
log "seeding aggregate: dataElement=$DATA_ELEMENT period=$PERIOD value=$AGG_VALUE"
agg_body=$(cat <<JSON
{
  "dataSet":              "$DATA_SET",
  "orgUnit":              "$ORG_UNIT",
  "period":               "$PERIOD",
  "categoryOptionCombo":  "$CATEGORY_OPTION_COMBO",
  "attributeOptionCombo": "$ATTRIBUTE_OPTION_COMBO",
  "dataValues": [{
    "dataElement": "$DATA_ELEMENT",
    "value":       "$AGG_VALUE",
    "comment":     "seeded by scripts/seeds/seed_bound_ou_data.sh"
  }]
}
JSON
)
http=$(curl -sk -b "$cookie_jar" -o /tmp/agg-seed.json -w '%{http_code}' \
  -H 'Content-Type: application/json' -X POST --data-raw "$agg_body" \
  "$DER_URL/api/dataValueSets")
[[ "$http" == "200" ]] || { cat /tmp/agg-seed.json >&2; die "aggregate seed HTTP $http"; }
log "aggregate seeded → $(head -c 200 /tmp/agg-seed.json)…"
record_seed aggregate "$DATA_ELEMENT|$ORG_UNIT|$PERIOD" "$ORG_UNIT"

# ---- 4. Seed single event (DHIS2 passthrough @ /api/events) ----
log "seeding event: program=$EVENT_PROGRAM stage=$EVENT_STAGE"
EVT_UID="$(dhis_uid)"
evt_body=$(cat <<JSON
{
  "events": [{
    "event":        "$EVT_UID",
    "program":      "$EVENT_PROGRAM",
    "programStage": "$EVENT_STAGE",
    "orgUnit":      "$ORG_UNIT",
    "occurredAt":   "${TODAY}T09:00:00Z",
    "status":       "COMPLETED",
    "dataValues": [{
      "dataElement": "$EVENT_DE",
      "value":       "$EVENT_DE_VALUE"
    }]
  }]
}
JSON
)
http=$(curl -sk -b "$cookie_jar" -o /tmp/evt-seed.json -w '%{http_code}' \
  -H 'Content-Type: application/json' -X POST --data-raw "$evt_body" \
  "$DER_URL/api/events")
[[ "$http" == "200" ]] || { cat /tmp/evt-seed.json >&2; die "event seed HTTP $http"; }
log "event seeded → $EVT_UID"
record_seed evt "$EVT_UID" "$ORG_UNIT"

# ---- 5. Seed tracker TEI + enrolment + stage event ----
TEI_UID="$(dhis_uid)"
log "seeding TEI $TEI_UID + enrolment + stage event"
tei_body=$(cat <<JSON
{
  "teiUid":            "$TEI_UID",
  "trackedEntityType": "$TRACKER_TE_TYPE",
  "orgUnit":           "$ORG_UNIT",
  "attributes": { "$TRACKER_TE_ATTR": "$TRACKER_TE_ATTR_VALUE" }
}
JSON
)
http=$(curl -sk -b "$cookie_jar" -o /tmp/tei-seed.json -w '%{http_code}' \
  -H 'Content-Type: application/json' -X POST --data-raw "$tei_body" \
  "$DER_URL/edge-api/v1/tracked-entities")
[[ "$http" == "200" ]] || { cat /tmp/tei-seed.json >&2; die "TEI seed HTTP $http"; }
record_seed tei "$TEI_UID" "$ORG_UNIT"

ENR_UID="$(dhis_uid)"
enr_body=$(cat <<JSON
{
  "enrollmentUid":  "$ENR_UID",
  "teiUid":         "$TEI_UID",
  "programUid":     "$TRACKER_PROGRAM",
  "orgUnitUid":     "$ORG_UNIT",
  "status":         "ACTIVE",
  "enrollmentDate": "$TODAY"
}
JSON
)
http=$(curl -sk -b "$cookie_jar" -o /tmp/enr-seed.json -w '%{http_code}' \
  -H 'Content-Type: application/json' -X POST --data-raw "$enr_body" \
  "$DER_URL/edge-api/v1/tracker/enrollments")
[[ "$http" == "200" ]] || { cat /tmp/enr-seed.json >&2; die "enrolment seed HTTP $http"; }
record_seed enrol "$ENR_UID" "$ORG_UNIT"

TRK_EVT_UID="$(dhis_uid)"
trk_evt_body=$(cat <<JSON
{
  "eventUid":        "$TRK_EVT_UID",
  "enrollmentUid":   "$ENR_UID",
  "programUid":      "$TRACKER_PROGRAM",
  "programStageUid": "$TRACKER_STAGE",
  "orgUnitUid":      "$ORG_UNIT",
  "status":          "COMPLETED",
  "occurredDate":    "$TODAY",
  "dataValues": { "$TRACKER_STAGE_DE": "$TRACKER_STAGE_DE_VALUE" }
}
JSON
)
http=$(curl -sk -b "$cookie_jar" -o /tmp/trk-evt-seed.json -w '%{http_code}' \
  -H 'Content-Type: application/json' -X POST --data-raw "$trk_evt_body" \
  "$DER_URL/edge-api/v1/tracker/events")
[[ "$http" == "200" ]] || { cat /tmp/trk-evt-seed.json >&2; die "tracker event seed HTTP $http"; }
record_seed trk_evt "$TRK_EVT_UID" "$ORG_UNIT"

log "tracker chain seeded → TEI=$TEI_UID enrol=$ENR_UID stageEvt=$TRK_EVT_UID"
log ""
log "SEED COMPLETE — triggering sync drain to push everything to Central"
http=$(curl -sk -b "$cookie_jar" -o /tmp/trigger.json -w '%{http_code}' \
  -X POST "$DER_URL/edge-api/v1/sync/jobs/JOURNAL_WORKER_DRAIN/trigger")
[[ "$http" == "200" ]] || log "drain trigger HTTP $http (seeds remain PENDING)"

log ""
log "Browse the result at:"
log "  $DER_URL/admin/data/aggregate       — new value under $BOUND_NAME"
log "  $DER_URL/admin/data/events          — new event $EVT_UID"
log "  $DER_URL/admin/data/tracker/tei/$TEI_UID"
log "  $DER_URL/admin/data/queue           — all three in the sync queue"
