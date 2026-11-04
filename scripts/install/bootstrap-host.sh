#!/usr/bin/env bash
# NFR-24 — reference-host bootstrap.
#
# Provisions the OS prerequisites that deployment/pilot/install.sh then
# builds the DER edge on top of. Target reference: Ubuntu Server 24.04
# LTS (Noble). Idempotent — re-running on an already-prepared host is
# a no-op per-package.
#
# What this does:
#   - apt-updates + installs the pinned prerequisite set (JDK, Postgres,
#     nginx, nftables, support utilities).
#   - Enables + starts postgresql-17 and nginx.
#   - Writes /etc/der/bootstrap.manifest.json so the pilot installer can
#     read back the host state it inherited.
#
# What this does NOT do:
#   - Does not install DER itself (deployment/pilot/install.sh owns that).
#   - Does not create the DER system user or /opt/der layout (ditto).
#   - Does not open firewall ports or configure TLS (nftables + /etc/der
#     TLS come from the pilot installer).
#
# Usage:
#   sudo scripts/install/bootstrap-host.sh            # full bootstrap
#   sudo scripts/install/bootstrap-host.sh --dry-run  # print the apt list
#   sudo scripts/install/bootstrap-host.sh --node     # also install Node 20
#
# After this completes, run:
#   sudo deployment/pilot/install.sh

set -Eeuo pipefail

INSTALL_NODE="${INSTALL_NODE:-}"
DRY_RUN=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --node)    INSTALL_NODE=1 ;;
    --help|-h)
      sed -n '2,32p' "$0"; exit 0 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

log() { printf '[bootstrap] %s\n' "$*"; }

if [[ "$(id -u)" -ne 0 && -z "$DRY_RUN" ]]; then
  echo "bootstrap-host.sh must run as root (sudo)." >&2
  exit 2
fi

# --- 1. OS detection ---------------------------------------------------
#
# --dry-run runs on any host — it only prints the package list. A live
# bootstrap must run on Ubuntu / Debian (apt-get).

if [[ -r /etc/os-release ]]; then
  # shellcheck disable=SC1091
  . /etc/os-release
elif [[ -z "$DRY_RUN" ]]; then
  echo "cannot read /etc/os-release; unsupported host." >&2
  exit 1
fi

if [[ -z "$DRY_RUN" ]]; then
  case "${ID:-}" in
    ubuntu|debian) ;;
    *)
      echo "unsupported OS '${ID:-?}'. Reference is Ubuntu Server 24.04 LTS." >&2
      echo "Fedora / RHEL operators must adapt the apt lines to dnf (see" >&2
      echo "docs/operations/component-and-portability.md §NFR-24)." >&2
      exit 1 ;;
  esac
  log "detected ${PRETTY_NAME:-$ID $VERSION_ID}"
fi

# --- 2. Pinned package set --------------------------------------------
#
# Versions tracked in docs/operations/component-and-portability.md.
# Keep this list minimal — the pilot installer owns everything else.

APT_PACKAGES=(
  openjdk-21-jre-headless
  postgresql-17
  postgresql-client-17
  nginx
  nftables
  ca-certificates
  curl
  gnupg
  openssl
  tzdata
)

if [[ -n "$INSTALL_NODE" ]]; then
  APT_PACKAGES+=(nodejs npm)
fi

if [[ -n "$DRY_RUN" ]]; then
  log "dry-run — would apt-install:"
  for p in "${APT_PACKAGES[@]}"; do printf '  %s\n' "$p"; done
  exit 0
fi

# --- 3. Postgres 17 repo (not yet in Ubuntu main for 22.04/24.04) -----

if ! apt-cache show postgresql-17 >/dev/null 2>&1; then
  log "adding PostgreSQL apt repository (postgresql-17 not in main)"
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o /etc/apt/keyrings/pgdg.gpg
  echo "deb [signed-by=/etc/apt/keyrings/pgdg.gpg] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
fi

# --- 4. apt install ----------------------------------------------------

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends "${APT_PACKAGES[@]}"

# --- 5. Enable + start services ---------------------------------------

systemctl enable --now postgresql
systemctl enable --now nginx

# --- 6. Record the bootstrap manifest ---------------------------------

install -d -m 0755 /etc/der
JAVA_VERSION="$(java -version 2>&1 | awk -F'"' '/version/ {print $2}')"
PG_VERSION="$(sudo -u postgres psql -At -c 'SHOW server_version;' 2>/dev/null || echo 'unknown')"
NGINX_VERSION="$(nginx -v 2>&1 | sed 's,.*/,,')"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cat > /etc/der/bootstrap.manifest.json <<EOF
{
  "bootstrappedAt": "${TS}",
  "os": {"id": "${ID}", "version": "${VERSION_ID}", "codename": "${VERSION_CODENAME:-}"},
  "java": "${JAVA_VERSION}",
  "postgres": "${PG_VERSION}",
  "nginx": "${NGINX_VERSION}",
  "aptPackages": [$(printf '"%s",' "${APT_PACKAGES[@]}" | sed 's/,$//')]
}
EOF

log "wrote /etc/der/bootstrap.manifest.json"
log "host is ready — next step: sudo deployment/pilot/install.sh"
