# Deployment and configuration guide

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

## Recommended reference deployment
One Linux edge host / VM with PostgreSQL, version-pinned local DHIS2 Core, DER Spring Boot service, NGINX and static frontend assets. Central DHIS2 in a separate reachable test environment. Two LAN clients; controllable WAN firewall rules that preserve local service and DNS. Record OS, CPU, RAM, disk, PostgreSQL, DHIS2 patch, JDK, Tomcat and DER version.

## Installation sequence
1. Install supported OS, patch system, create dedicated service accounts and a time service.
2. Configure LAN DNS/hostname and device-trusted TLS; restrict admin and database ports.
3. Install version-compatible PostgreSQL, create DHIS2 and DER-owned stores with least privileges.
4. Install verified local DHIS2 distribution and supported runtime; confirm health independently.
5. Apply audited DER migrations; install `der-server.jar` and secrets external to source tree.
6. Build and serve frontend bundles; route client DHIS2 URLs and management endpoints separately.
7. Register edge site and authorised OU scope; bootstrap compatible metadata and test fixtures.
8. Run end-to-end online, then WAN-isolated offline tests before enabling real usage.

## Example layout (illustrative, not executed)
`/opt/der/der-server.jar`, `/etc/der/application.yml`, `/var/lib/der/`, `/var/log/der/`; DHIS2 Core in its own application-server context; PostgreSQL as system service. `deployment/nginx`, `deployment/systemd`, `deployment/scripts` contain actual maintained assets.

## Secret-at-rest key (`DER_SECURITY_SECRET_KEY`)
DER seals DHIS2 per-user service credentials (`der.edge_user_dhis2_mapping.credential_cipher`) with AES-256-GCM via `SecretEnvelope`. The key is read from `der.security.secret-key` (env var `DER_SECURITY_SECRET_KEY`), a base64-encoded 32-byte value.

**When unset, `SecretEnvelope.seal()` is a pass-through and credentials land as plaintext in the DB** — documented fallback for dev convenience, not for pilot or production. Generate and set the key before onboarding real operator credentials:

```
openssl rand -base64 32
# append to the server's environment, e.g.:
#   DER_SECURITY_SECRET_KEY=<base64>
```

Key rotation currently requires re-saving each mapping with the new key active (old ciphertext is not re-wrapped automatically). Keep the key out of the source tree; the standard DER layout places it in `/etc/der/application.yml` or the systemd unit's `EnvironmentFile`, mode 0600, owned by the service account.

## Local dev: restart after gate rebuilds

Spring Boot's fat-jar Launcher reads `server/target/der-server-<version>.jar` lazily — new classes load on first use. Running `scripts/run_all_checks.sh` (or any `./mvnw verify / package`) rewrites that file in place, which invalidates the open file handle in the running JVM. The server then appears UP on `/system/health` but 15-second hangs on any request that triggers a class load that wasn't resolved before the rebuild.

`scripts/dev/restart_der_server.sh` copies the fresh jar to `~/.der/current-der-server.jar` before launching, so gate reruns of `server/target/...` never touch the file the running JVM holds open. Use it in place of `java -jar server/target/...` for local dev:

```
bash scripts/dev/restart_der_server.sh
```

It kills any existing DER java process, copies the latest jar, sources `.env.local`, launches in the background, waits for `/system/health` to respond, and prints the commit hash.

## Operational cautions
Do not assume `.local` domain is universally discoverable; validate mDNS or managed DNS. Do not expose PostgreSQL to end-user devices. Do not let NGINX return central endpoints as a fallback during WAN outage without explicit semantics. Verify clock drift, certificate trust and credentials before proceeding.
