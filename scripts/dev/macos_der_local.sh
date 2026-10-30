#!/usr/bin/env bash
# scripts/dev/macos_der_local.sh — make https://der.local "just work" on macOS.
#
# What this does:
#   1. Exports the DER self-signed cert from ~/.der/der-local.p12 to PEM.
#   2. Installs it into the macOS System Keychain + marks it "always trust"
#      so Chrome / Safari show a green lock on https://der.local.
#   3. Installs a persistent pf (packet-filter) rule that redirects
#      127.0.0.1:443 → 127.0.0.1:8443 so a bare `https://der.local`
#      URL hits the DER HTTPS listener without needing to run as root.
#
# All three steps are idempotent — safe to re-run.
#
# Needs sudo once (keychain + pf). Uninstall with the `--uninstall` flag.

set -Eeuo pipefail

KEYSTORE="${HOME}/.der/der-local.p12"
KS_PASS="${DER_HTTPS_PASSWORD:-changeit}"
KS_ALIAS="${DER_HTTPS_ALIAS:-der-local}"
PEM_OUT="${HOME}/.der/der-local.pem"

PF_ANCHOR="/etc/pf.anchors/der.local"
PF_CONF_LINE='rdr-anchor "der.local"'
PF_LOAD_LINE='load anchor "der.local" from "/etc/pf.anchors/der.local"'

usage() {
    cat <<EOF
usage: $(basename "$0") [--uninstall]

Make https://der.local work on macOS by trusting the DER self-signed
cert and port-forwarding 443 → 8443. Run from any directory.
EOF
}

ok()   { printf '  \033[0;32mOK\033[0m   %s\n' "$1"; }
fail() { printf '  \033[0;31mFAIL\033[0m %s\n' "$1" >&2; exit 1; }
step() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage; exit 0
fi

if [[ "${1:-}" == "--uninstall" ]]; then
    step "Removing pf anchor + trust"
    sudo rm -f "${PF_ANCHOR}"
    sudo sed -i '' "\\|${PF_CONF_LINE}|d" /etc/pf.conf 2>/dev/null || true
    sudo sed -i '' "\\|${PF_LOAD_LINE}|d" /etc/pf.conf 2>/dev/null || true
    sudo pfctl -f /etc/pf.conf >/dev/null 2>&1 || true
    # Remove trusted cert if present.
    SHA="$(openssl x509 -in "${PEM_OUT}" -noout -fingerprint -sha1 2>/dev/null \
               | sed 's/.*=//;s/://g')" || true
    if [[ -n "${SHA:-}" ]]; then
        sudo security delete-certificate -Z "${SHA}" /Library/Keychains/System.keychain 2>/dev/null || true
    fi
    ok "removed. https://der.local → nothing (back to default)."
    exit 0
fi

# ─── 1. Export cert ────────────────────────────────────────────
step "1. Export self-signed cert"
if [[ ! -f "${KEYSTORE}" ]]; then
    fail "no keystore at ${KEYSTORE} — start the DER server once so it provisions one."
fi
"$(/usr/libexec/java_home)/bin/keytool" -list -keystore "${KEYSTORE}" \
    -storepass "${KS_PASS}" -alias "${KS_ALIAS}" >/dev/null 2>&1 \
    || fail "keystore exists but no alias '${KS_ALIAS}' inside it"

openssl pkcs12 -in "${KEYSTORE}" -passin "pass:${KS_PASS}" \
    -clcerts -nokeys -out "${PEM_OUT}" 2>/dev/null
ok "wrote ${PEM_OUT}"
openssl x509 -in "${PEM_OUT}" -noout -subject -dates \
    | sed 's/^/     /'

# ─── 2. Trust in System Keychain ───────────────────────────────
step "2. Install into System Keychain (needs sudo)"
if security find-certificate -c "der.local" /Library/Keychains/System.keychain \
        >/dev/null 2>&1; then
    # Fingerprint shift detection — reinstall if cert in keychain != our cert.
    EXISTING="$(sudo security find-certificate -c "der.local" -p \
                 /Library/Keychains/System.keychain 2>/dev/null \
               | openssl x509 -noout -fingerprint -sha1 \
               | sed 's/.*=//;s/://g')"
    OUR_FP="$(openssl x509 -in "${PEM_OUT}" -noout -fingerprint -sha1 \
                | sed 's/.*=//;s/://g')"
    if [[ "${EXISTING}" == "${OUR_FP}" ]]; then
        ok "cert already trusted (fingerprint matches)"
    else
        sudo security delete-certificate -c "der.local" \
             /Library/Keychains/System.keychain >/dev/null
        sudo security add-trusted-cert -d -r trustRoot \
             -p ssl -p basic -k /Library/Keychains/System.keychain "${PEM_OUT}"
        ok "replaced previous cert (fingerprint changed)"
    fi
else
    sudo security add-trusted-cert -d -r trustRoot \
         -p ssl -p basic -k /Library/Keychains/System.keychain "${PEM_OUT}"
    ok "installed + marked trustRoot for SSL"
fi

# ─── 3. pf port-forward 443 → 8443 ─────────────────────────────
step "3. pf port-forward 443 → 8443"
ANCHOR_BODY='# DER dev: redirect https://der.local (443) → DER TLS listener (8443)
rdr pass on lo0 inet proto tcp from any to 127.0.0.1 port 443 -> 127.0.0.1 port 8443
'
sudo tee "${PF_ANCHOR}" >/dev/null <<<"${ANCHOR_BODY}"
ok "wrote ${PF_ANCHOR}"

# Patch /etc/pf.conf once (idempotent).
if ! grep -qF "${PF_CONF_LINE}" /etc/pf.conf; then
    # rdr-anchor must be in the right spot (after rdr-anchor "com.apple/*").
    sudo sed -i '' "/rdr-anchor \"com.apple\/\*\"/a\\
${PF_CONF_LINE}
" /etc/pf.conf
    ok "added rdr-anchor to /etc/pf.conf"
fi
if ! grep -qF "${PF_LOAD_LINE}" /etc/pf.conf; then
    echo "${PF_LOAD_LINE}" | sudo tee -a /etc/pf.conf >/dev/null
    ok "added load anchor to /etc/pf.conf"
fi

sudo pfctl -ef /etc/pf.conf >/dev/null 2>&1 || true
ok "pf ruleset loaded"

# ─── 4. Verify ─────────────────────────────────────────────────
step "4. Verify"
if curl -fsS --resolve der.local:443:127.0.0.1 \
        "https://der.local/edge-api/v1/system/health" -o /dev/null; then
    ok "curl https://der.local → 200 (trusted)"
else
    printf '  \033[0;33mWARN\033[0m DER server does not appear to be listening on 8443.\n'
    printf '       Start it: java -jar server/target/der-server-*.jar\n'
    printf '       Then re-run: open https://der.local\n'
fi

step "Done"
cat <<'EOF'
Open:
    https://der.local/admin/

If the browser still says "Not secure" the first time, fully quit it
and reopen — Chrome caches cert trust per-process. Safari picks up
the Keychain trust immediately.

Uninstall:
    scripts/dev/macos_der_local.sh --uninstall
EOF
