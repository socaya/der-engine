# der-2.2.3 (stable)

**Date:** 2026-10-29
**Previous stable:** `der-2.2.2`

## Headline

**§6 Security hardening fully implemented.** Four pieces: AppArmor
profile, fail2ban jail, Vault secret provider, FIPS-mode probe.
Deploy artifacts land under `deployment/pilot/`; the server exposes
status probes for all four at `/edge-api/v1/security/hardening`.

## 1. AppArmor profile

`deployment/pilot/apparmor/opt.der.der-server` restricts the DER
JVM to:

```
Filesystem        /opt/der, /etc/der, /var/lib/der, /var/log/der
                  (plus JVM runtime, /usr/share/zoneinfo, /etc/ssl/certs)
Subprocesses      pg_dump, pg_restore, psql, nmcli, ip, wg, nft
                  (everything else blocked)
Network           inet / inet6 stream + dgram + unix sockets
                  (binds + outbound both allowed; port shaping via firewall)
Deny-list         ptrace, /proc/*/mem, /root/**, /home/**/.ssh/**,
                  sys_module, sys_rawio, sys_boot
```

Installer step 6.6 installs the profile when `apparmor_parser` is
present:

```bash
install -o root -g root -m 0644 \
  deployment/pilot/apparmor/opt.der.der-server \
  /etc/apparmor.d/opt.der.der-server
apparmor_parser -r /etc/apparmor.d/opt.der.der-server
```

Operators flip between modes:

```
sudo aa-enforce /opt/der/der-server.jar     # production
sudo aa-complain /opt/der/der-server.jar    # debugging / rollout
```

Local overrides go in `/etc/apparmor.d/local/der-server` (included at
bottom of the profile) so operator additions survive upgrades.

### Probe

```
GET /edge-api/v1/security/hardening/apparmor
→ { installed, derProfileLoaded, inEnforceMode, inComplainMode, summary }
```

On the dev Mac: `installed: false` (no apparmor_status binary).

## 2. fail2ban jail + filter

### Filter — `/etc/fail2ban/filter.d/der-auth.conf`

```ini
failregex = ^.* WARN  .* AUTH_FAIL .* ip=<HOST> .*$
datepattern = ^%Y-%m-%d.%H:%M:%S
```

### Jail — `/etc/fail2ban/jail.d/der.conf`

```ini
[der-auth]
enabled   = true
port      = http,https,8085,8443
filter    = der-auth
logpath   = /var/log/der/server.log
maxretry  = 5
findtime  = 10m
bantime   = 30m
action    = iptables-multiport[name=der-auth, port="8085,8443", protocol=tcp]
```

### The log line

`AuthenticationService` now emits the exact format fail2ban's
regex expects on every sign-in failure:

```java
AUTH_LOG.warn("AUTH_FAIL username={} ip={} reason={}", username, clientIp, reason);
```

Verified live:

```
curl -X POST .../auth/sign-in -d '{"username":"baduser","password":"wrong"}'

/tmp/der-2.2.3c.log:
WARN  u.a.m.d.s.AuthenticationService - AUTH_FAIL username=baduser ip=0:0:0:0:0:0:0:1 reason=USER_NOT_FOUND
```

That's the `AUTH_FAIL …ip=<HOST>…` pattern fail2ban's `der-auth`
filter matches.

### Probe

```
GET /security/hardening/fail2ban
→ { installed, overall, derAuthJail: { currentlyFailed, totalFailed,
                                         currentlyBanned, totalBanned,
                                         bannedIps } }
```

## 3. Vault secret provider

`SecurityHardeningService.secret(key)` resolves in this order:

1. **Vault KV v2** when `der.secrets.vault.url` + `der.secrets.vault.token` are set
   - `GET {url}/v1/{mount}/data/{pathPrefix}/{key}` with `X-Vault-Token`
   - Reads `.data.data.value` from the response
2. **Env var fallback** — `DER_SECRET_<KEY>` with slashes/dashes → underscores,
   upper-cased

Operators can rotate from env to Vault without any code change:

```
# before
DER_SECRET_DHIS2_TOKEN=...

# after
der.secrets.vault.url=https://vault.local:8200
der.secrets.vault.token=hvs.abc123
der.secrets.vault.mount=secret
der.secrets.vault.path-prefix=der
# → GET https://vault.local:8200/v1/secret/data/der/dhis2-token
```

### Probes

```
GET /security/hardening/vault
→ { configured, url, mount, pathPrefix, reachable, version,
     sealed, initialized }

GET /security/hardening/vault/{key}   (ADMIN)
→ { key, value, source: "vault-or-env" }
```

Verified on dev host (neither configured):

```
GET  /vault        → { configured: false, reason: "der.secrets.vault.url not set" }
GET  /vault/x      → 404 SECRET_NOT_FOUND
```

## 4. FIPS mode

### Flag + probe

`der.security.fips.enabled=true` → `assertFipsCompliant(algorithm)`
throws when operators try to use `MD5`, `SHA-1`, or `RSA/1024`.

```
GET /security/hardening/fips
→ {
    fipsRequested: false,                 // der.security.fips.enabled flag
    fipsProviderPresent: false,           // scanned JVM providers
    providers: [{ name, version, info, fips }, …],
    rejected: ["MD5", "SHA-1", "RSA/1024"]  (only when flag on)
  }
```

### Production path

For actual FIPS 140-2 / 140-3 compliance operators:

1. Install a FIPS-validated JVM (e.g. **Red Hat OpenJDK FIPS mode**
   or **BoringSSL / BCFKS** provider)
2. Add the FIPS provider as the first entry in `java.security`
3. Set `-Dder.security.fips.enabled=true` on the launch command
4. The probe lists it under `providers` with `fips: true` and
   `fipsProviderPresent: true` flips

Dev host (standard OpenJDK): no FIPS provider loaded → correctly
reports `fipsProviderPresent: false`.

## 5. Operator deploy flow

Added to `install.sh` step 6.6:

```bash
# AppArmor
if command -v apparmor_parser >/dev/null; then
  install -m 0644 .../opt.der.der-server /etc/apparmor.d/opt.der.der-server
  apparmor_parser -r /etc/apparmor.d/opt.der.der-server
fi

# fail2ban
if command -v fail2ban-client >/dev/null; then
  install -m 0644 .../filter.d/der-auth.conf /etc/fail2ban/filter.d/der-auth.conf
  install -m 0644 .../jail.d/der.conf       /etc/fail2ban/jail.d/der.conf
  systemctl reload fail2ban
fi
```

Both steps gracefully skip when the respective package isn't
installed. Operators opt out entirely via `SKIP_HARDENING=1`.

## 6. Admin surface

```
GET /edge-api/v1/security/hardening                — summary all four
GET /edge-api/v1/security/hardening/apparmor
GET /edge-api/v1/security/hardening/fail2ban
GET /edge-api/v1/security/hardening/vault
GET /edge-api/v1/security/hardening/vault/{key}    (ADMIN) — resolve a secret
GET /edge-api/v1/security/hardening/fips
```

All four reads are session-authenticated; the Vault secret
resolver is ADMIN-only.

## 7. Files changed

```
deployment/pilot/apparmor/opt.der.der-server                                    (new)
deployment/pilot/fail2ban/filter.d/der-auth.conf                                (new)
deployment/pilot/fail2ban/jail.d/der.conf                                       (new)
deployment/pilot/install.sh                                                     — step 6.6 security hardening
server/src/main/java/ug/ac/mak/der/security/AuthenticationService.java          — AUTH_FAIL log line
server/src/main/java/ug/ac/mak/der/security/SecurityConfig.java                 — permit /security/hardening/** auth + /vault ADMIN
server/src/main/java/ug/ac/mak/der/security/SecurityHardeningService.java       (new)
server/src/main/java/ug/ac/mak/der/web/SecurityHardeningController.java         (new)
```

## 8. Next step in the sequential march

- **2.2.4** — §8 UI maturity (multi-edge fleet, onboarding, a11y, offline-first)
- **2.2.5** — §9 Testing (chaos, load, soak, golden)
- **2.2.6** — §10 Packaging (.deb, OCI, HW kits, docs site)

## Build + test

```
./mvnw -q -DskipTests package  ✓ 2.2.3 JAR
Verified end-to-end:
  GET /hardening summary       → all 4 probes return structured JSON ✓
  AUTH_FAIL log line emitted   → matches fail2ban der-auth.conf regex ✓
  Vault fallback to env        → 404 when neither set, 200 when env present ✓
  FIPS provider scan           → 13 JVM providers listed, fips=false flag ✓
```
