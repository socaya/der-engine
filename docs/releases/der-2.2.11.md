# der-2.2.11 (stable)

**Date:** 2026-10-30
**Previous stable:** `der-2.2.10`

## Headline

**`https://der.local` just works** — on macOS dev hosts and on Ubuntu
pilots. The DER server listens on 8443 (non-privileged), and this
release adds the two things needed to make the bare `https://der.local`
URL reach it without a port number:

1. Trust the DER self-signed cert in the system trust store (so the
   browser shows a green lock).
2. Redirect port 443 → 8443 at the kernel level (so no `:8443` in the
   URL and the server stays unprivileged).

## 1. macOS dev — `scripts/dev/macos_der_local.sh`

One-shot script, idempotent, runs in ~5 s with two sudo prompts:

```bash
bash scripts/dev/macos_der_local.sh
```

Steps:

1. **Exports** the DER cert from `~/.der/der-local.p12` to PEM.
2. **Installs** it into `/Library/Keychains/System.keychain` with
   `security add-trusted-cert -d -r trustRoot -p ssl -p basic`.
3. **Installs** a `pf` (packet filter) rule at `/etc/pf.anchors/der.local`:
   ```
   rdr pass on lo0 inet proto tcp from any to 127.0.0.1 port 443 -> 127.0.0.1 port 8443
   ```
4. **Patches** `/etc/pf.conf` once with `rdr-anchor` + `load anchor`
   directives (idempotent — won't duplicate).
5. **Verifies** with `curl https://der.local/edge-api/v1/system/health`.

Uninstall:

```bash
bash scripts/dev/macos_der_local.sh --uninstall
```

Fingerprint-shift aware — if the DER keystore is regenerated, re-running
the script replaces the previous keychain entry.

## 2. Ubuntu pilot — baked into `install.sh` + new `der-manager local-tls`

### `deployment/pilot/install.sh` §6.5b (new)

Runs during `der-manager install` on Ubuntu. Does two things:

- Installs `deployment/pilot/nftables/der-local-tls.nft` to
  `/etc/nftables.d/`:
  ```
  table ip der_local_tls {
      chain prerouting {
          type nat hook prerouting priority dstnat; policy accept;
          tcp dport 443 redirect to :8443
      }
      chain output {
          type nat hook output priority -100; policy accept;
          ip daddr 127.0.0.1 tcp dport 443 redirect to :8443
      }
  }
  ```
  and adds `include "/etc/nftables.d/der-local-tls.nft"` to
  `/etc/nftables.conf` (once).

- Exports the DER cert from the pilot keystore (`/etc/der/der-local.p12`
  or `/opt/der/der-local.p12`), writes it to
  `/usr/local/share/ca-certificates/der-local.crt`, and runs
  `update-ca-certificates` so `curl` / `wget` / `apt` / Java all trust
  it system-wide.

Skip either half with `SKIP_LOCAL_TLS=1` env var when running
`install.sh`.

### `der-manager local-tls` (new subcommand)

```bash
sudo der-manager local-tls
```

Re-runs the same two steps outside the full installer — use it after:

- Cert rotation (keystore regenerated, trust store needs refreshing)
- Fresh host that was installed with `SKIP_LOCAL_TLS=1`
- Debugging a broken redirect (`nft list ruleset` after)

Logs each step and verifies with
`curl --resolve der.local:443:127.0.0.1 https://der.local/.../health`
at the end.

## 3. Why this layout

- Keeping the Spring Boot listener on 8443 means it never needs root,
  which plays well with AppArmor + systemd hardening (§6).
- Kernel-level redirect (`pf` on macOS, `nftables` on Ubuntu) is
  invisible to the server and reversible without redeploying.
- Both scripts are idempotent and expose uninstall / skip paths —
  nothing is one-way.

## 4. Files changed

```
scripts/dev/macos_der_local.sh                            (new, +x)
deployment/pilot/nftables/der-local-tls.nft               (new)
deployment/pilot/install.sh                               — §6.5b local-tls step
scripts/der-manager.sh                                    — local-tls subcommand + usage
docs/releases/der-2.2.11.md                               (this file)
```

No server-side changes — the HTTPS listener was already there since
2.0.x. This release is pure dev/ops ergonomics.

## 5. How to use

### macOS dev

```bash
# Make sure the DER server has booted at least once so it writes
# ~/.der/der-local.p12.
bash scripts/dev/macos_der_local.sh
open https://der.local/admin/
```

### Ubuntu pilot (fresh install)

```bash
sudo bash deployment/pilot/install.sh   # or sudo der-manager install
# ... server starts, cert is auto-generated at /etc/der/der-local.p12
sudo der-manager local-tls              # install trust + nftables redirect
open https://der.local/admin/           # from a facility device
```

### Verify

```bash
curl -fsS https://der.local/edge-api/v1/system/health | jq .
# { "service": "der-server", "status": "UP", ... }
```
