#!/usr/bin/env bash
# DER pilot installer (ADR-0014).
#
# Idempotent — safe to re-run. Takes the current repository as source of
# truth (expected to have been built with `./server/mvnw package` and
# `cd client && npm run build` + `cd admin-ui && npm run build` already),
# and lays everything out under /opt/der + /etc/der + /var/lib/der +
# /var/log/der.
#
# Must run as root on a Debian/Ubuntu LTS host. Fedora/RHEL operators
# adapt the apt invocation (see docs/operations/pilot-runbook.md §2).
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

INSTALL_PREFIX="${INSTALL_PREFIX:-/opt/der}"
CONFIG_DIR="${CONFIG_DIR:-/etc/der}"
DATA_DIR="${DATA_DIR:-/var/lib/der}"
LOG_DIR="${LOG_DIR:-/var/log/der}"
USER_NAME="${USER_NAME:-der}"
GROUP_NAME="${GROUP_NAME:-der}"
NGINX_SITE="${NGINX_SITE:-der-edge}"
SKIP_PG="${SKIP_PG:-}"
SKIP_NGINX="${SKIP_NGINX:-}"
SKIP_SYSTEMD="${SKIP_SYSTEMD:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "install.sh must run as root (sudo)." >&2
  exit 2
fi

log() { printf '[install] %s\n' "$*"; }

# --- 1. Prereq check ---------------------------------------------------
log "checking prerequisites"
if ! command -v java >/dev/null 2>&1; then
  echo "java not found; install openjdk-21-jre-headless first." >&2
  exit 1
fi
JAVA_MAJOR="$(java -version 2>&1 | awk -F'"' '/version/ {print $2}' | awk -F. '{print $1}')"
if [[ "${JAVA_MAJOR}" -lt 21 ]]; then
  echo "Java 21+ required (found ${JAVA_MAJOR})." >&2
  exit 1
fi
if [[ -z "${SKIP_PG}" ]] && ! command -v psql >/dev/null 2>&1; then
  echo "psql not found; install postgresql-17 (or set SKIP_PG=1 if remote)." >&2
  exit 1
fi

SERVER_JAR="${ROOT}/server/target/der-server-$(cat "${ROOT}/VERSION" | tr -d '[:space:]').jar"
if [[ ! -f "${SERVER_JAR}" ]]; then
  CANDIDATE="$(find "${ROOT}/server/target" -maxdepth 1 -name 'der-server-*.jar' -not -name '*sources*' -not -name '*javadoc*' 2>/dev/null | head -n1 || true)"
  if [[ -z "${CANDIDATE}" ]]; then
    echo "No built der-server jar under server/target/. Run ./server/mvnw package first." >&2
    exit 1
  fi
  SERVER_JAR="${CANDIDATE}"
fi
log "using jar: ${SERVER_JAR}"

CLIENT_DIST="${ROOT}/client/dist"
ADMIN_DIST="${ROOT}/admin-ui/dist"
for d in "${CLIENT_DIST}" "${ADMIN_DIST}"; do
  if [[ ! -d "${d}" ]]; then
    echo "Missing SPA build output: ${d}. Run 'npm run build' first." >&2
    exit 1
  fi
done

# --- 2. User + layout --------------------------------------------------
if ! id -u "${USER_NAME}" >/dev/null 2>&1; then
  log "creating system user ${USER_NAME}"
  useradd --system --home-dir "${INSTALL_PREFIX}" --shell /usr/sbin/nologin "${USER_NAME}"
fi

install -d -o root -g root -m 0755 "${INSTALL_PREFIX}" "${CONFIG_DIR}"
install -d -o "${USER_NAME}" -g "${GROUP_NAME}" -m 0750 \
  "${DATA_DIR}" "${DATA_DIR}/backups" "${DATA_DIR}/uploads" "${LOG_DIR}"

# --- 3. Copy artifacts -------------------------------------------------
log "copying server jar"
install -o root -g root -m 0644 "${SERVER_JAR}" "${INSTALL_PREFIX}/der-server.jar"

log "copying client SPA"
install -d -o root -g root -m 0755 "${INSTALL_PREFIX}/client/dist"
cp -R "${CLIENT_DIST}/." "${INSTALL_PREFIX}/client/dist/"

log "copying admin SPA"
install -d -o root -g root -m 0755 "${INSTALL_PREFIX}/admin-ui/dist"
cp -R "${ADMIN_DIST}/." "${INSTALL_PREFIX}/admin-ui/dist/"

# --- 4. Env file -------------------------------------------------------
if [[ ! -f "${CONFIG_DIR}/pilot.env" ]]; then
  log "seeding ${CONFIG_DIR}/pilot.env (edit before first start)"
  install -o root -g "${GROUP_NAME}" -m 0640 \
    "${ROOT}/deployment/pilot/env.pilot.example" "${CONFIG_DIR}/pilot.env"
else
  log "preserving existing ${CONFIG_DIR}/pilot.env"
fi

# --- 5. Postgres bootstrap --------------------------------------------
if [[ -z "${SKIP_PG}" ]]; then
  DB_PASS="$(. "${CONFIG_DIR}/pilot.env" && echo "${SPRING_DATASOURCE_PASSWORD}")"
  if [[ -z "${DB_PASS}" || "${DB_PASS}" == "change-me-pilot" ]]; then
    echo "SPRING_DATASOURCE_PASSWORD in ${CONFIG_DIR}/pilot.env is unset or at default — refusing to seed Postgres role." >&2
    echo "Set a real password, then re-run with SKIP_PG=1 to skip Postgres bootstrap." >&2
    exit 1
  fi
  log "bootstrapping Postgres role + database"
  TMP_SQL="$(mktemp)"
  sed "s/__DER_DB_PASSWORD__/${DB_PASS//\//\\/}/g" \
    "${ROOT}/deployment/pilot/postgres/bootstrap.sql" > "${TMP_SQL}"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -f "${TMP_SQL}" >/dev/null
  rm -f "${TMP_SQL}"
else
  log "skipping Postgres bootstrap (SKIP_PG=1)"
fi

# --- 6. systemd unit --------------------------------------------------
if [[ -z "${SKIP_SYSTEMD}" ]]; then
  log "installing systemd unit"
  install -o root -g root -m 0644 \
    "${ROOT}/deployment/pilot/systemd/der-server.service" \
    /etc/systemd/system/der-server.service
  systemctl daemon-reload
  systemctl enable der-server.service >/dev/null
  log "enabled der-server.service (not yet started; edit env then: systemctl start der-server)"
else
  log "skipping systemd install (SKIP_SYSTEMD=1)"
fi

# --- 7. nginx ----------------------------------------------------------
if [[ -z "${SKIP_NGINX}" ]] && command -v nginx >/dev/null 2>&1; then
  log "installing nginx server block"
  install -o root -g root -m 0644 \
    "${ROOT}/deployment/pilot/nginx/der-edge.conf" \
    "/etc/nginx/sites-available/${NGINX_SITE}.conf"
  ln -sf "/etc/nginx/sites-available/${NGINX_SITE}.conf" \
         "/etc/nginx/sites-enabled/${NGINX_SITE}.conf"
  if nginx -t >/dev/null 2>&1; then
    systemctl reload nginx || log "nginx reload returned non-zero (check: nginx -t)"
  else
    log "nginx -t failed; left the site enabled but did not reload"
  fi
else
  log "skipping nginx (SKIP_NGINX=1 or nginx not installed)"
fi

log "install complete."
log "next:"
log "  1. edit ${CONFIG_DIR}/pilot.env (DHIS2 URL, admin password, DB password)"
log "  2. systemctl start der-server"
log "  3. bash ${ROOT}/deployment/pilot/smoke_test.sh"
