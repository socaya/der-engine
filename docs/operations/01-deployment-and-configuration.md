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

## Operational cautions
Do not assume `.local` domain is universally discoverable; validate mDNS or managed DNS. Do not expose PostgreSQL to end-user devices. Do not let NGINX return central endpoints as a fallback during WAN outage without explicit semantics. Verify clock drift, certificate trust and credentials before proceeding.
