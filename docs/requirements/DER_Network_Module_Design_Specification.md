# DER Network Module Design Specification

**Project:** DHIS2 Edge Runtime (DER)  
**Module:** DER Network & Connectivity Manager (`der-network`)  
**Purpose:** Provide secure local connectivity, Access Point services, device admission, discovery, monitoring, routing, and controlled peer connectivity for offline-first DER deployments.

## 1. Purpose

The DER Network Module provides the trusted local network environment in which DER-supported workflows continue to operate when connectivity to Central DHIS2 is unavailable.

The module should support:

- DER-hosted Wi-Fi Access Point services;
- wired and wireless LAN connectivity;
- local DHCP and DNS;
- DER service discovery;
- secure device enrolment;
- client isolation;
- local HTTPS/TLS;
- device identity;
- network health monitoring;
- WAN and Central DHIS2 connectivity detection;
- route management;
- controlled peer-to-peer connectivity where required;
- network security and audit.

The DER server remains the primary site-level execution environment and shared local data authority.

## 2. Design Principle

> **DER acts as the local network anchor, while peer-to-peer connectivity is treated as a controlled fallback rather than the normal workflow topology.**

This preserves the core DER model:

- users operate through DER;
- locally accepted records are stored on DER;
- DER provides the shared working state;
- DER manages the durable synchronization journal;
- DER coordinates synchronization with Central DHIS2;
- DER performs conflict detection and reconciliation.

Peer connectivity must not automatically become peer-to-peer data replication.

## 3. High-Level Architecture

```text
                    INTERNET / WAN
                          |
                          |
                  Central DHIS2
                          |
                    HTTPS / TLS
                          |
                   WAN interface
                          |
                 +----------------+
                 |   DER Server   |
                 |                |
                 | DER Runtime    |
                 | PostgreSQL     |
                 | Sync Engine    |
                 | Network Module |
                 +--------+-------+
                          |
                DER Local Network
                 Wi-Fi / Ethernet
                          |
        +-----------------+-----------------+
        |                 |                 |
    Device A           Device B          Device C
  Registration        Clinical          Pharmacy
```

When WAN connectivity is lost:

```text
       Central DHIS2
             X
             X WAN unavailable
             X
        DER Server
          | | |
          | | | LAN still operational
          | | |
        A   B   C
```

Local workflows remain available as long as the DER server and the local network remain operational.

## 4. DER Network Module Responsibilities

| Capability | Purpose |
|---|---|
| Wi-Fi Access Point | Allow authorised devices to connect directly to DER |
| Ethernet/LAN support | Work with existing site networking where available |
| DHCP | Provide predictable local IP configuration |
| Local DNS | Allow clients to reach DER using a stable local hostname |
| Service discovery | Help clients locate DER automatically |
| Device enrolment | Approve trusted devices |
| Device identity | Assign cryptographic identity to managed clients |
| TLS | Protect application traffic on the local network |
| Firewall | Restrict unnecessary client and administrative access |
| Client isolation | Prevent unrestricted device-to-device traffic |
| Connectivity probes | Detect LAN, Internet and Central DHIS2 state |
| Route policy | Control local and WAN traffic |
| Peer connectivity | Provide optional secure direct links |
| Monitoring | Report AP, interfaces, clients and connectivity state |
| Audit | Record network events and security-relevant actions |

## 5. Recommended Linux Network Stack

```text
NetworkManager
hostapd
dnsmasq or NetworkManager DHCP
nftables
Avahi / mDNS
systemd-resolved or equivalent local DNS
DER Network Agent
```

The DER Network Agent should orchestrate these components and expose a controlled internal API.

The administration UI must not execute arbitrary shell commands directly.

```text
Admin UI
   |
DER Server API
   |
DER Network Service
   |
NetworkManager / hostapd / nftables
```

## 6. Interface Model

A production-capable DER appliance should ideally use separate interfaces for local and upstream connectivity.

```text
wlan0  -> DER Local Access Point
eth0   -> Facility LAN / WAN
wlan1  -> Optional upstream Wi-Fi
wwan0  -> Optional LTE/5G fallback
```

Where practical, DER should avoid depending on a single radio for both local Access Point services and upstream Wi-Fi.

## 7. Local Addressing

Example:

```text
Network:        10.88.0.0/24
DER Gateway:    10.88.0.1
DHCP Range:     10.88.0.50 - 10.88.0.200
```

The subnet should be configurable.

Clients should reach DER using a local hostname where possible:

```text
https://der.local
```

or:

```text
https://edge.der.local
```

A known IP address may remain available as a fallback.

## 8. Service Discovery

DER should support more than one discovery method.

### 8.1 Local DNS

```text
der.local
edge.local
```

### 8.2 DNS-SD / mDNS

```text
_der._tcp.local
```

Possible metadata:

```text
edge-id=DER-UG-0017
version=1.0
https-port=443
```

### 8.3 Static fallback

```text
https://10.88.0.1
```

DER should not depend exclusively on multicast discovery.

## 9. Access Point Design

DER may provide a local Access Point when the site has no reliable networking infrastructure.

Example SSID:

```text
DER-EDGE-0017
```

Recommended security:

- WPA3-SAE where supported;
- WPA2 fallback only where compatibility requires it;
- strong credential rotation;
- optional QR-based enrolment.

Network access remains separate from application authorization.

## 10. Security Separation

```text
Can join DER network
        !=
Can access DER application/data
```

Security layers:

```text
Layer 1: Wi-Fi / Ethernet connectivity
Layer 2: Network admission
Layer 3: Device identity
Layer 4: TLS / encrypted tunnel
Layer 5: DER user authentication
Layer 6: DHIS2-derived authorization
Layer 7: Workflow/record access rules
Layer 8: Audit
```

## 11. HTTPS/TLS

DER should use HTTPS even on the local LAN.

```text
Client
   |
 HTTPS/TLS
   |
DER
```

For controlled deployments, DER may use a local site CA and provision trust during device enrolment.

## 12. Device Enrolment

Recommended flow:

```text
1. Device joins DER network
2. Device opens DER enrolment endpoint
3. DER records a pending device request
4. Administrator reviews and approves the device
5. DER issues device identity
6. Device securely stores its key/certificate
7. Device can access permitted DER services
```

User identity remains separate from device identity.

```text
Device Identity
+
User Identity
+
Authorization
```

## 13. Device Identity Model

Recommended fields:

```text
deviceId
publicKey
certificate
issuedAt
expiresAt
status
owner
siteId
lastSeen
```

A lost or compromised device can be revoked independently of a user account.

## 14. Network Segmentation and Firewall

Recommended default policy:

```text
Clients -> DER HTTPS       ALLOW
Clients -> DER DNS         ALLOW
Clients -> DER DHCP        ALLOW

Client -> Client           DENY by default
Client -> DER PostgreSQL   DENY
Client -> DER SSH          DENY
Client -> Admin API        CONTROLLED
```

Normal application communication should remain:

```text
Client A -> DER
Client B -> DER
```

not unrestricted client-to-client communication.

## 15. Network State Detection

The Network Module should distinguish:

```text
LOCAL_AP_AVAILABLE
LOCAL_LAN_AVAILABLE
INTERNET_AVAILABLE
CENTRAL_DHIS2_AVAILABLE
```

Example:

```text
AP       ✓
LAN      ✓
Internet ✗
Central  ✗
```

Expected operator state:

> Offline-First Mode — Local workflows available.

Another valid state is:

```text
AP       ✓
LAN      ✓
Internet ✓
Central  ✗
```

This means general Internet access exists but Central DHIS2 is unavailable.

## 16. Connectivity State Machine

```text
CONNECTED
    |
    | Central lost
    v
OFFLINE_FIRST
    |
    | Central restored
    v
RECOVERING
    |
    | backlog reconciled
    v
CONNECTED
```

Additional states may include:

```text
LOCAL_NETWORK_DEGRADED
EDGE_NETWORK_UNAVAILABLE
CENTRAL_AUTH_FAILURE
DNS_FAILURE
CERTIFICATE_FAILURE
```

## 17. Peer-to-Peer Connectivity

Peer-to-peer networking should remain optional.

> **Peer-to-peer network connectivity does not imply peer-to-peer data synchronization.**

The preferred application flow remains:

```text
Device A
   |
   v
DER
   ^
   |
Device B
```

This preserves one shared local state, authorization, transaction control, durable journaling, conflict detection, audit, and later synchronization with Central DHIS2.

## 18. Wi-Fi Direct

Wi-Fi Direct may be tested for fallback scenarios.

```text
Device A
   |
Wi-Fi Direct
   |
Device B
```

or:

```text
DER
 |
Wi-Fi Direct Group
 +-- Device A
 +-- Device B
```

Because platform support varies, Wi-Fi Direct should not be a DER v1 dependency.

## 19. Secure Peer Overlay

A future implementation may use WireGuard-style encrypted peer links.

```text
DER
 |
 | encrypted tunnel
 |
Device A
```

This should remain optional and should not replace DER as the shared local authority.

## 20. DER Secure Mesh — Future Direction

A later phase could support a controlled secure mesh:

```text
                 DER Secure Mesh

        +---------------------------+
        |                           |
     Edge DER ---------------- Device A
        |                           |
        |                           |
     Device B ---------------- Device C
        |
     DER Relay
        +---------------------------+
```

Each node could carry:

```text
Node ID
Public Key
Site ID
Allowed Services
Expiry
Trust State
```

## 21. DER Network API

Read APIs:

```text
GET /edge-api/v1/network/status
GET /edge-api/v1/network/interfaces
GET /edge-api/v1/network/access-point
GET /edge-api/v1/network/clients
GET /edge-api/v1/network/routes
GET /edge-api/v1/network/peers
GET /edge-api/v1/network/events
```

Administrative actions:

```text
POST /edge-api/v1/network/ap/start
POST /edge-api/v1/network/ap/stop
POST /edge-api/v1/network/ap/rotate-key

POST /edge-api/v1/network/devices/{id}/approve
POST /edge-api/v1/network/devices/{id}/revoke

POST /edge-api/v1/network/peers/{id}/connect
DELETE /edge-api/v1/network/peers/{id}
```

Sensitive actions should require elevated DER administrative authorization.

## 22. Proposed Server Components

```text
server/
  network/
    NetworkManager
    AccessPointService
    DhcpService
    DnsService
    DiscoveryService
    DeviceEnrollmentService
    NetworkIdentityService
    ConnectivityProbeService
    RoutePolicyService
    FirewallService
    PeerService
    NetworkAuditService
```

Possible package structure:

```text
org.der.network
org.der.network.ap
org.der.network.discovery
org.der.network.device
org.der.network.security
org.der.network.peer
org.der.network.monitoring
```

## 23. Configuration Model

```yaml
network:
  mode: managed

  lan:
    subnet: 10.88.0.0/24
    gateway: 10.88.0.1

  accessPoint:
    enabled: true
    interface: wlan0
    ssid: DER-EDGE
    security: WPA3-SAE

  dhcp:
    enabled: true
    start: 10.88.0.50
    end: 10.88.0.200

  discovery:
    mdns: true
    hostname: der.local

  peer:
    enabled: false

  firewall:
    clientIsolation: true

  central:
    probeIntervalSeconds: 30
```

Secrets must not be committed to source control.

## 24. DER Admin UI — Network Module

Recommended navigation:

```text
Network
  Overview
  Access Point
  Connected Devices
  Interfaces
  Peers
  Security
  Diagnostics
  Settings
```

## 25. Network Overview

Example:

```text
DER Network                Healthy

Local Access Point         Running
SSID                       DER-EDGE-0017
Connected devices          14
LAN                        Available
Internet                   Available
Central DHIS2              Connected
Peer links                 0
```

The page should also show operating mode, subnet, active interface, last Central probe, warnings, and recent network events.

## 26. Access Point Page

```text
Access Point
--------------------------------

Status              Running
Interface           wlan0
SSID                DER-EDGE-0017
Band                5 GHz
Channel             44
Security            WPA3-SAE
Clients             14
Gateway             10.88.0.1
DHCP                 Active
```

Actions:

```text
Restart AP
Rotate Network Key
Show QR Enrolment
```

## 27. Connected Devices

| Device | User/Owner | IP | Link | Signal | Trust | Last Seen |
|---|---|---|---|---|---|---|
| TAB-REG-01 | Registration | 10.88.0.54 | Wi-Fi | -49 dBm | Approved | now |
| TAB-LAB-02 | Laboratory | 10.88.0.61 | Wi-Fi | -68 dBm | Approved | now |
| UNKNOWN-81 | — | 10.88.0.73 | Wi-Fi | -55 dBm | Pending | 1 min |

Actions:

```text
Approve
Block
Revoke
View Certificate
```

## 28. Network Diagnostics

Diagnostics should answer:

```text
Can client reach DER?
Can DER reach gateway?
Can DER resolve DNS?
Can DER reach Internet?
Can DER reach Central DHIS2?
Is the TLS certificate valid?
Can the synchronization API authenticate?
```

Visual path:

```text
Client
  ✓
DER LAN
  ✓
DER Runtime
  ✓
WAN
  ✓
Central DHIS2
```

## 29. Network Audit Events

Useful event types:

```text
AP_STARTED
AP_STOPPED
AP_RESTARTED
DEVICE_CONNECTED
DEVICE_DISCONNECTED
DEVICE_APPROVED
DEVICE_REVOKED
NETWORK_KEY_ROTATED
WAN_LOST
WAN_RESTORED
CENTRAL_UNREACHABLE
CENTRAL_RESTORED
PEER_CONNECTED
PEER_DISCONNECTED
TLS_FAILURE
DNS_FAILURE
```

Events should include timestamp, actor, device/node, interface, outcome, reason, and correlation ID where available.

## 30. Recommended Implementation Phases

### Phase N1 — Core Local Network

Implement:

```text
Access Point
DHCP
Local DNS
mDNS discovery
Firewall
Network status
Connected-client inventory
```

Goal: DER can create and manage its own local network.

### Phase N2 — Secure Managed Devices

Add:

```text
Device enrolment
Device certificates
Device revocation
TLS trust bootstrap
Client isolation
Network audit
```

Goal: only trusted devices can access protected DER services.

### Phase N3 — Offline-First Network Awareness

Add:

```text
Central probe
Internet probe
LAN/AP health
Connectivity state machine
CONNECTED
OFFLINE_FIRST
RECOVERING
Admin UI integration
```

Goal: DER clearly distinguishes local availability from Central DHIS2 availability.

### Phase N4 — Network Resilience

Add:

```text
Multiple interfaces
Ethernet / Wi-Fi WAN failover
Optional LTE/5G
Automatic route selection
Interface priorities
```

### Phase N5 — Peer Connectivity Research

Prototype:

```text
Wi-Fi Direct
or
WireGuard peer links
or
Local relay
```

Goal: evaluate whether direct secure peer connectivity adds resilience without changing DER into a peer-replicated data system.

## 31. MSc Scope Boundary

### In Scope

- DER-hosted Access Point;
- wired/wireless LAN management;
- DHCP;
- local DNS;
- service discovery;
- device enrolment;
- network isolation;
- HTTPS/TLS;
- network monitoring;
- connectivity-state detection;
- offline-first operating mode;
- WAN recovery integration.

### Optional / Experimental

- WireGuard overlay;
- Wi-Fi Direct;
- peer tunnels;
- local peer relay.

### Out of Core Scope

- peer-to-peer record synchronization;
- CRDT-based client mesh replication;
- automatic multi-edge failover;
- distributed consensus between client devices;
- nationwide mesh networking.

## 32. Architectural Boundary

> **The DER Network Module provides connectivity. It does not replace DER as the shared local application and data authority.**

Clients may communicate over different transports, but supported workflow operations should continue to be coordinated through DER unless a future research phase explicitly introduces another replication model.

## 33. Recommended Technical Stack

| Layer | Recommended Technology |
|---|---|
| OS | Ubuntu Server / Linux |
| Interface Management | NetworkManager |
| Wi-Fi AP | hostapd or NetworkManager AP mode |
| DHCP | NetworkManager or dnsmasq |
| Local DNS | dnsmasq / system resolver |
| Discovery | mDNS / DNS-SD |
| Firewall | nftables |
| Local Application Security | HTTPS/TLS |
| Device Identity | DER-issued key/certificate |
| User Authentication | DER/DHIS2 identity model |
| Advanced Peer Option | WireGuard |
| Monitoring | DER Network Agent + system metrics |

## 34. Recommended Architecture Decision

> **A DER subsystem that establishes and manages the trusted local network on which edge workflows operate. It provides local Access Point and LAN services, device discovery and enrolment, network isolation, secure DER-client communication, connectivity monitoring and WAN-state detection. Peer connectivity may be supported as a secondary resilience mechanism, while DER remains the primary site-level execution and shared-data authority.**

## 35. Acceptance Criteria

- [ ] DER can create a local Wi-Fi Access Point.
- [ ] DER can provide DHCP addresses to connected clients.
- [ ] Clients can resolve and reach DER using a local hostname.
- [ ] DER application traffic is protected by TLS.
- [ ] Devices can be enrolled, approved and revoked.
- [ ] Client-to-client communication is denied by default.
- [ ] PostgreSQL and SSH are not exposed to ordinary clients.
- [ ] DER distinguishes LAN, Internet and Central DHIS2 state.
- [ ] DER exposes Connected, Offline-First and Recovering states.
- [ ] Network state is visible in the administration console.
- [ ] Connected devices can be monitored.
- [ ] Network configuration changes are auditable.
- [ ] Sensitive actions require elevated authorization.
- [ ] WAN loss does not stop supported local DER workflows.
- [ ] WAN restoration transitions DER into recovery/reconciliation.
- [ ] Peer connectivity, if enabled, does not bypass DER authorization or data coordination.

## 36. Recommended Next Development Step

Implement in this order:

1. Network status and interface discovery
2. Access Point control
3. DHCP and local DNS
4. Firewall and client isolation
5. Connected-device inventory
6. Connectivity-state engine
7. Admin UI
8. Device enrolment and certificate identity
9. WAN failover
10. Experimental peer connectivity
