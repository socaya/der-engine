#!/usr/bin/env bash
# der-manager.sh — unified CLI for installing + operating a DER edge
# on Ubuntu Server. Wraps the pilot installer, systemd units, and the
# live /edge-api/v1/network/* management endpoints into one script so
# operators don't have to remember which flag lives where.
#
# Usage:
#   sudo der-manager install           # full install incl. network stack
#   sudo der-manager install --skip-network-stack
#   sudo der-manager start             # systemctl start der-server
#   sudo der-manager stop
#   sudo der-manager restart
#   sudo der-manager status            # systemctl + /system/health
#       der-manager ap-status          # GET /network/access-point
#   sudo der-manager ap-start          # POST /network/ap/start (admin)
#   sudo der-manager ap-stop
#   sudo der-manager ap-rotate-key
#   sudo der-manager logs              # journalctl -f der-server
#   sudo der-manager version
#   sudo der-manager backup            # POST /backup trigger local
#   sudo der-manager backup --remote   # also push to configured destination
#   sudo der-manager backup list       # GET /backup/runs
#   sudo der-manager restore <runId>   # POST /restore from a local snapshot
#   sudo der-manager pitr <timestamp>  # POST /backup/pitr/plan for a target time
#   sudo der-manager verify            # POST /backup/pitr/verify/run
#
# Env:
#   DER_HOST    (default http://localhost:8085)
#   DER_USER    (default admin)
#   DER_PASS    (from /etc/der/pilot.env on install hosts; prompt otherwise)
#
# Idempotent — safe to re-run install.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PILOT_INSTALL="${ROOT}/deployment/pilot/install.sh"
PILOT_UPGRADE="${ROOT}/deployment/pilot/upgrade.sh"
PILOT_SMOKE="${ROOT}/deployment/pilot/smoke_test.sh"

DER_HOST="${DER_HOST:-http://localhost:8085}"
DER_USER="${DER_USER:-admin}"

usage() {
  sed -n '2,30p' "$0"
}

need_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "der-manager $1 must run as root (sudo)." >&2
    exit 2
  fi
}

load_pass() {
  if [[ -n "${DER_PASS:-}" ]]; then
    return
  fi
  if [[ -r /etc/der/pilot.env ]]; then
    DER_PASS="$(. /etc/der/pilot.env && echo "${DER_BOOTSTRAP_ADMIN_PASSWORD}")"
  fi
  if [[ -z "${DER_PASS:-}" ]]; then
    read -r -s -p "Password for ${DER_USER}: " DER_PASS
    echo
  fi
}

api() {
  local method="$1" path="$2" body="${3:-}"
  load_pass
  local args=(-sS -u "${DER_USER}:${DER_PASS}" -H 'Accept: application/json' \
              -o /tmp/der-manager.out -w '%{http_code}' -X "${method}" \
              "${DER_HOST}${path}")
  if [[ -n "${body}" ]]; then
    args+=(-H 'Content-Type: application/json' -d "${body}")
  fi
  local code
  code="$(curl "${args[@]}" || true)"
  cat /tmp/der-manager.out
  echo
  [[ "${code}" == 2* ]]
}

cmd_install() {
  need_root install
  shift
  bash "${PILOT_INSTALL}" "$@"
}

cmd_start()   { need_root start;   systemctl start   der-server; }
cmd_stop()    { need_root stop;    systemctl stop    der-server; }
cmd_restart() { need_root restart; systemctl restart der-server; }

cmd_status() {
  systemctl status der-server --no-pager --lines=5 || true
  echo
  echo "=== /system/health ==="
  curl -sS "${DER_HOST}/edge-api/v1/system/health" || echo "DER not reachable"
  echo
  echo "=== /network/status ==="
  api GET /edge-api/v1/network/status
}

cmd_ap_status()      { api GET  /edge-api/v1/network/access-point; }
cmd_ap_start()       { api POST /edge-api/v1/network/ap/start; }
cmd_ap_stop()        { api POST /edge-api/v1/network/ap/stop; }
cmd_ap_rotate_key()  { api POST /edge-api/v1/network/ap/rotate-key; }

cmd_logs() { journalctl -u der-server -f --no-pager; }

cmd_version() {
  cat "${ROOT}/VERSION"
}

cmd_backup() {
  shift || true
  local sub="${1:-trigger}"
  case "${sub}" in
    list)
      api GET /edge-api/v1/backup/runs ;;
    trigger|--remote|'')
      local kind='LOCAL'
      if [[ "${sub}" == '--remote' ]]; then kind='UPLOAD'; fi
      api POST /edge-api/v1/backup "{\"kind\":\"${kind}\"}" ;;
    *) echo "unknown backup subcommand: ${sub}" >&2; exit 1 ;;
  esac
}

cmd_restore() {
  local runId="${2:-}"
  if [[ -z "${runId}" ]]; then
    echo "usage: der-manager restore <runId>" >&2
    exit 1
  fi
  api POST "/edge-api/v1/restore" "{\"backupRunId\":${runId},\"kind\":\"LOCAL\"}"
}

cmd_pitr() {
  local target="${2:-}"
  if [[ -z "${target}" ]]; then
    echo "usage: der-manager pitr <ISO-8601-timestamp>" >&2
    echo "       e.g. der-manager pitr 2026-10-29T14:00:00Z" >&2
    exit 1
  fi
  api POST /edge-api/v1/backup/pitr/plan "{\"target\":\"${target}\"}"
}

cmd_verify() {
  api POST /edge-api/v1/backup/pitr/verify/run
}

case "${1:-}" in
  install)         cmd_install        "$@" ;;
  start)           cmd_start                ;;
  stop)            cmd_stop                 ;;
  restart)         cmd_restart              ;;
  status)          cmd_status               ;;
  ap-status)       cmd_ap_status            ;;
  ap-start)        cmd_ap_start             ;;
  ap-stop)         cmd_ap_stop              ;;
  ap-rotate-key)   cmd_ap_rotate_key        ;;
  logs)            cmd_logs                 ;;
  version)         cmd_version              ;;
  backup)          cmd_backup           "$@" ;;
  restore)         cmd_restore          "$@" ;;
  pitr)            cmd_pitr             "$@" ;;
  verify)          cmd_verify               ;;
  -h|--help|help|'') usage ;;
  *) echo "unknown command: $1" >&2; usage; exit 1 ;;
esac
