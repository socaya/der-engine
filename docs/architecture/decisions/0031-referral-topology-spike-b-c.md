# ADR-0031 — Initiative 3 topology spike (option B / option C)

- **Status:** Accepted (Phase 14 / der-2.0.0-alpha.2) — design-spike
  only, no code change.
- **Related:** ADR-0027 (option A, shipped in 1.4.0)
- **Roadmap:** Initiative 3 design-spike + option B/C decision

## Context

ADR-0027 shipped option A (chain-via-hub) in 1.4.0. That covers the
~80% of referral workflows that need "A tags, central routes, B
pulls." Two scenarios aren't covered:

1. On-premises LAN of edges in a hospital with no reliable WAN —
   referrals must flow A → B directly without central round-trip.
   This is **option B (direct TLS mesh)**.
2. Supply-chain scenarios where many devices subscribe to the same
   referral topic — pub/sub semantics via a local broker. This is
   **option C (local MQTT broker)**.

## Decisions

### D-TOP-1 — Option B (direct TLS mesh) is the next buildout

Scenario coverage justifies the implementation cost: no-WAN LAN
pilots have been raised by two of the three target deployment
sites. Option C (MQTT) remains theoretically interesting but no
confirmed site needs it; defer indefinitely.

### D-TOP-2 — Option B shape

- Each edge pairs with 1..N peers via a mutual-trust ceremony:
  admin at site A generates a pairing QR code; admin at site B
  scans and confirms. Both sides persist the peer certificate
  fingerprint in a new `peer_edge` table.
- A new `/peer-api/v1/receive` endpoint on each edge accepts
  authenticated POSTs from paired peers (TLS client-cert auth,
  no shared cookie session).
- A new `PeerDispatcher` service, triggered by workflow steps of
  `kind=DISPATCH_PEER`, sends the payload to the paired peer and
  awaits an ack before marking the step complete.
- No central round-trip for peer-routed records; central is
  updated by whichever edge is last in the chain through its
  normal drain.

### D-TOP-3 — Option C (MQTT) is on hold

If a future deployment confirms the pub/sub need, we'll revisit
with a new ADR. Not scheduled.

### D-TOP-4 — No code in this alpha

ADR-0031 is a design document. The option-B implementation requires:

- V024+ migration (`peer_edge` + its pairing ceremony tables).
- mTLS wiring on a new `/peer-api/**` sub-tree in `SecurityConfig`.
- Pairing QR flow in the admin UI.
- `PeerDispatcher` service + `DISPATCH_PEER` step kind on
  `capture_workflow_step`.
- Playwright coverage of the pairing ceremony.

That's a multi-alpha chunk. It ships in a dedicated 2.1.0 train.

## Non-goals

- Option B implementation in this alpha.
- Option C.
- Multi-edge replication of DER state (edges still own their own
  local store).
- Automated peer discovery (mDNS / Bonjour). Pairing is deliberate.
- Peer-to-peer encryption key rotation (same lifecycle as the TLS
  cert — operator-driven).
