# DER Admin UI — Terminology Glossary

**Status:** Phase-1 approved vocabulary, incremental.
**Purpose:** Single source of truth for user-visible wording across the
admin-ui. Every navigation label, screen title, button, confirmation,
error and empty-state must either match a term below or be scheduled
for the next per-screen pass.

When a term below is marked *deferred*, it is because the existing
backend contract or an in-flight migration still uses the legacy
wording; renaming the UI label alone without changing the server
contract would introduce drift and is deferred to a follow-up
alongside the matching server change.

## Core terms

| Preferred UI term | Short description shown in the view | Internal/legacy wording replaced |
|---|---|---|
| **DER Server** | Local service for data capture and synchronisation. | DER Runtime, edge runtime, control plane |
| **Overview** | DER Admin landing page answering five status questions. | Workspace, Dashboard, SystemOverview |
| **Local Data** | Records captured on this DER server (aggregate, events, tracker, drafts). | — |
| **Synchronisation** | Flow of records between DER and Central DHIS2. | Sync engine, journal |
| **Sync Queue** | Records and operations waiting to be synchronised. | Outbound queue, operation envelope |
| **Sync Service** | Background service that drains the queue to Central. | Journal worker, journal drain, sync worker |
| **Sync History** | Record of past sync runs with outcomes. | — |
| **Sync Conflicts** | Records that cannot be centrally accepted without a decision. | Attention, drift, reconciliation |
| **Conflict Resolution** | The screen/workflow for deciding a conflict. | Reconciliation strategy |
| **DHIS2 Connection** | The configured central DHIS2 server. | WAN target, central, upstream |
| **DHIS2 Compatibility** | Live result of the DHIS2 version/capability probe. | Compat probe, compatibility matrix |
| **Metadata** | Locally available DHIS2 metadata (programmes, data sets, option sets, etc.). | Metadata mirror |
| **Metadata Changes** | Differences detected between local snapshot and central. | Drift inspector, metadata drift |
| **Metadata Snapshot** | Point-in-time captured version of DHIS2 metadata. | — |
| **Connected Devices** | Capture devices registered with this DER server. | — |
| **Network Topology** | Visual layout of connections between devices, DER and peers. | Mesh topology, mesh canvas |
| **Peer Device** | Another DER server or client this DER communicates with. | Peer, node |
| **Organisation Unit Assignment** | Facility or organisation unit this DER is bound to. | OU binding, OU UID |
| **Users & Roles** | Local DER administrator accounts and the roles that grant them access. | Provisioning |
| **Audit Log** | History of security-relevant events in DER. | Security log, security events |
| **Audit Verification** | Integrity check over the audit record chain. | Hash chain, hash-chain verifier |
| **System Health** | Operational state of DER's internal services. | — |
| **Host Hardware** | OS/CPU/disk information about the machine running DER. | Hardware |
| **Storage** | Volume usage for DER's files and the PostgreSQL schema. | — |
| **Backup** | Point-in-time copy of DER's state suitable for restore. | — |
| **Restore** | Replace DER's state with a chosen backup. | — |
| **Recovery** | Advanced tools for recovering DER from a broken state. | — |
| **Settings** | DER-wide configuration (sync policy, schedule, login appearance). | — |
| **Diagnostics** | Read-only probes and traces used to debug a running DER. | — |
| **Workflows** | Named capture flows mapped to DHIS2 programmes/data sets. | Edge workflows |
| **Connection Test** | Live probe of connectivity to Central DHIS2. | WAN probe, ping |
| **Retry Sync** | Re-submit an item from the queue. Idempotent on the server. | Replay, reprocess |

## Status wording

Records move through distinct states. The admin UI must not collapse
these into a single word.

| State | UI wording | Meaning |
|---|---|---|
| Captured locally, never attempted | **Saved on DER** | Record exists on the local database only. |
| Awaiting transmission | **Waiting to synchronise** | In the sync queue; the sync service will pick it up on its next pass. |
| In flight | **Sending** | Sync service is currently transmitting this item to Central. |
| Central-acknowledged | **Accepted by Central DHIS2 at [time]** | Central returned 2xx and the acknowledgement is recorded. |
| Central-rejected | **Rejected by Central DHIS2** | Central returned 4xx with a reason; shown inline. |
| Needs decision | **Needs review** | A conflict exists; an authorised user must choose a resolution. |
| No authoritative probe | **Unknown** | The relevant probe hasn't completed yet; never defaulted to 0/healthy/offline. |
| Previously-known | **Stale** | Last observed state; a fresh probe is in flight. |

## Connectivity wording

| Combination | UI wording |
|---|---|
| DER up, Central reachable | DER is connected to Central DHIS2. |
| DER up, Central unreachable | Central DHIS2 is unavailable. Local work continues; pending changes will retry. |
| DER up, Central probe not yet run | Checking Central DHIS2 connection… |
| DER starting | DER is initialising. |
| DER not operational | DER runtime is not operational. |

## Writing rules

1. **Sentence case** for sentences; **Title Case** only for navigation primaries.
2. Use **DHIS2** (no space) consistently.
3. Never use `0 pending` when the queue count is unknown — say `Queue status unavailable. Retry.`
4. Internet reachability is **not** the same as Central DHIS2 reachability — never conflate.
5. "Success" without provenance is forbidden. Prefer `Accepted by Central DHIS2 at [time]`.
6. Error states must name: what failed, effect on local data, next safe action.
7. Avoid childish paraphrases (`Things waiting to go`, `Forms and stuff`). Keep accurate technical nouns and verbs.

## Additions from the first per-screen pass

| Preferred UI term | Short description | Internal/legacy wording replaced |
|---|---|---|
| **Needs review** | Records that cannot be centrally accepted without a human decision. | `Needs attention` (used across Sync, Data queue, Data landing) |
| **Sync service paused** | The background Sync Service is not currently draining the queue. | bare `Paused` |
| **Waiting to synchronise** | In the Sync queue awaiting the next pass. | `waiting` / `Waiting to send` |
| **Response time** | Round-trip time of a probe/check. | `RTT`, `Probe RTT` |
| **Last check** | Timestamp of the most recent probe. | `Last probe`, `Captured`, `Captured at` |
| **Connection check details** | Panel grouping the last probe's observed URL, version, timestamp and reason. | `Probe details` |
| **Default base URL** | URL that DER falls back to when no connection override is saved. | `Compiled default URL` |
| **Observed Central DHIS2 version** | Version reported by the last probe response. | `Observed version` |
| **Metadata changes detected** | The local snapshot diverges from Central. | `Drift detected` |
| **Local metadata matches Central** | No differences detected since the last check. | `Fingerprints match central` |
| **N reachable over last N check(s)** | Reachability ratio with scope and sample size. | `N% reliability over last N probe(s)` |
| **Enrolled device** | Device registered with DER via bearer token. | `DHIS2 fleet registry (edge_device) — a bearer-token enrolled device` |
| **Local-network client** | Device observed on the access point. | `Local-LAN mesh (network_client) — observed on the Access Point` |

The `OperatorState` TypeScript literal `'Needs attention'` was
renamed to `'Needs review'` across the admin-ui so the type and
the display string stay in sync. The server contract (`CONFLICT_REVIEW`,
`CENTRAL_REJECTED`, etc.) is unchanged; the rename is UI-only.

## Scope of this document

This file is incremental. Each per-screen simplification pass should:
1. Catalogue every user-visible string on the screen.
2. Map legacy wording to the table above (or extend the table).
3. Record the before→after in the per-screen PR description.

The full string-level audit across all ~140 routes is tracked in
`docs/ui/admin-ui-route-inventory.csv` under the `action` column.
