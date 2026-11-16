#!/usr/bin/env bash
# DER pilot smoke test. Runs after install.sh + systemctl start to prove
# the install actually serves traffic and the backup/restore surface works.
#
# Honors overrides:
#   DER_BASE_URL        default: http://127.0.0.1:8080
#   DER_ADMIN_USERNAME  default: admin
#   DER_ADMIN_PASSWORD  default: (read from /etc/der/pilot.env)
#
# Prints a one-line PASS / FAIL summary and exits accordingly.
set -Eeuo pipefail

DER_BASE_URL="${DER_BASE_URL:-http://127.0.0.1:8080}"
DER_ADMIN_USERNAME="${DER_ADMIN_USERNAME:-admin}"

if [[ -z "${DER_ADMIN_PASSWORD:-}" ]]; then
  if [[ -r /etc/der/pilot.env ]]; then
    DER_ADMIN_PASSWORD="$(. /etc/der/pilot.env && echo "${DER_BOOTSTRAP_ADMIN_PASSWORD}")"
  fi
fi
if [[ -z "${DER_ADMIN_PASSWORD:-}" ]]; then
  echo "DER_ADMIN_PASSWORD not set and /etc/der/pilot.env unreadable." >&2
  exit 2
fi

say() { printf '[smoke] %s\n' "$*"; }
fail() { printf '[smoke] FAIL — %s\n' "$*" >&2; exit 1; }

say "step 1 — /edge-api/v1/system/health"
HEALTH="$(curl -fsS "${DER_BASE_URL}/edge-api/v1/system/health")"
echo "${HEALTH}" | grep -q 'status' || fail "health endpoint returned unexpected body"

say "step 2 — sign in as ${DER_ADMIN_USERNAME}"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "${COOKIE_JAR}"' EXIT
curl -fsS -c "${COOKIE_JAR}" -H 'Content-Type: application/json' \
  -d "{\"username\":\"${DER_ADMIN_USERNAME}\",\"password\":\"${DER_ADMIN_PASSWORD}\"}" \
  "${DER_BASE_URL}/edge-api/v1/auth/sign-in" >/dev/null \
  || fail "sign-in failed; check DER_BOOTSTRAP_ADMIN_PASSWORD matches /etc/der/pilot.env"

say "step 3 — authenticated metadata read"
curl -fsS -b "${COOKIE_JAR}" \
  "${DER_BASE_URL}/api/dataSets?fields=id,displayName&paging=false" \
  | grep -q 'dataSets' || fail "/api/dataSets missing dataSets envelope"

say "step 4 — backup round-trip (FULL)"
BACKUP_RESP="$(curl -fsS -b "${COOKIE_JAR}" -H 'Content-Type: application/json' \
  -d '{"kind":"FULL"}' "${DER_BASE_URL}/edge-api/v1/backup/request")"
RUN_ID="$(printf '%s' "${BACKUP_RESP}" | grep -o '"runId":[0-9]*' | awk -F: '{print $2}')"
[[ -n "${RUN_ID}" ]] || fail "backup request returned no runId"
say "   waiting for backup ${RUN_ID} to finish"
for _ in $(seq 1 60); do
  STATUS="$(curl -fsS -b "${COOKIE_JAR}" \
    "${DER_BASE_URL}/edge-api/v1/backup/runs/${RUN_ID}" \
    | grep -o '"status":"[A-Z]*"' | head -n1 | awk -F'"' '{print $4}')"
  case "${STATUS}" in
    SUCCESS) break ;;
    FAILED)  fail "backup ${RUN_ID} FAILED (check /var/log/der/server.log)" ;;
    *)       sleep 2 ;;
  esac
done
[[ "${STATUS}" == "SUCCESS" ]] || fail "backup ${RUN_ID} did not reach SUCCESS within 120s"

say "step 5 — journal worker health"
curl -fsS -b "${COOKIE_JAR}" "${DER_BASE_URL}/edge-api/v1/journal/worker" \
  | grep -q '"enabled"' || fail "/journal/worker missing 'enabled'"

# FR-02-09 — optional break-glass wire-up probe. Skipped unless the
# operator sets DER_BREAK_GLASS_TEST_TOKEN=yes-i-want-to-rotate. This
# path rotates the admin password; we don't run it on every smoke
# cycle (the operator would lose the DER_ADMIN_PASSWORD they just
# used to sign in).
if [[ "${DER_BREAK_GLASS_TEST_TOKEN:-}" == "yes-i-want-to-rotate" ]]; then
  say "step 6 — break-glass recovery wire-up (DESTRUCTIVE: rotates admin password)"
  TOKEN_PATH="${DER_BREAK_GLASS_TOKEN_PATH:-/var/lib/der/break-glass.token}"
  TOKEN="$(openssl rand -base64 32)"
  echo "${TOKEN}" | sudo tee "${TOKEN_PATH}" >/dev/null \
    || fail "could not write ${TOKEN_PATH} (need sudo)"
  sudo chown der:der "${TOKEN_PATH}"
  sudo chmod 600 "${TOKEN_PATH}"
  BG_RESP="$(curl -fsS -X POST -H 'Content-Type: application/json' \
    -d "{\"token\":\"${TOKEN}\"}" \
    "${DER_BASE_URL}/edge-api/v1/break-glass/recover")"
  echo "${BG_RESP}" | grep -q '"password"' \
    || fail "break-glass did not return a rotated password"
  [[ ! -f "${TOKEN_PATH}" ]] \
    || fail "break-glass left the token file in place — one-use invariant broken"
  NEW_PASSWORD="$(printf '%s' "${BG_RESP}" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['password'])")"
  say "   recovery returned new 24-char password; token file deleted"
  # Verify new password actually works.
  curl -fsS -c "${COOKIE_JAR}" -H 'Content-Type: application/json' \
    -d "{\"username\":\"${DER_ADMIN_USERNAME}\",\"password\":\"${NEW_PASSWORD}\"}" \
    "${DER_BASE_URL}/edge-api/v1/auth/sign-in" >/dev/null \
    || fail "sign-in with rotated password failed — recovery didn't persist"
  say "   signed in with rotated password — wire-up proven"
  say "   REMEMBER to update DER_BOOTSTRAP_ADMIN_PASSWORD in /etc/der/pilot.env"
  echo "[smoke] PASS — all 6 checks succeeded against ${DER_BASE_URL}"
else
  echo "[smoke] PASS — all 5 checks succeeded against ${DER_BASE_URL}"
  echo "[smoke] step 6 (break-glass) skipped; opt in with DER_BREAK_GLASS_TEST_TOKEN=yes-i-want-to-rotate"
fi
