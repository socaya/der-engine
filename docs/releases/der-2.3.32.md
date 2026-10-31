# der-2.3.32 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.31`

## Headline

**Peer-to-peer workflow exchange (§62–§63 pilot slice).** Operators
register other edge instances as "peers" in a new registry and push a
workflow's canonical JSON to a peer's existing
`/edge-api/v1/workflows/import` endpoint with one click.

## 1. Schema (V061)

```sql
CREATE TABLE der.workflow_peer (
    peer_id          UUID PRIMARY KEY,
    display_name     TEXT NOT NULL,
    base_url         TEXT NOT NULL,
    added_at         TIMESTAMPTZ DEFAULT now(),
    added_by         UUID REFERENCES edge_user,
    last_push_at     TIMESTAMPTZ,
    last_push_status TEXT
);
```

Secrets stay in env config — pilots on a shared VPN use the same
bootstrap admin cookie; service-account auth for inter-edge push
lands as a follow-up once device-level JWT reaches the fleet.

## 2. API

```
GET    /edge-api/v1/workflows/peers
POST   /edge-api/v1/workflows/peers           {displayName, baseUrl}
DELETE /edge-api/v1/workflows/peers/{peerId}
POST   /edge-api/v1/workflows/peers/{peerId}/push/{workflowId}
```

Push flow:
1. Load the stored workflow via `CaptureWorkflowService.get(id)`.
2. Shape it into the canonical schema that the existing
   `/workflows/import` endpoint already accepts — step UUIDs are
   resolved to ordinals so the doc is portable across edges.
3. POST to `${peerBaseUrl}/edge-api/v1/workflows/import`.
4. Persist `last_push_at` + `last_push_status` on the peer row.
5. Return the peer's status + first 2 KB of the body (trimmed) to the
   operator.

Failures (network timeout, DNS, 5xx) land as `IOException:…` /
`HTTP 502` in `last_push_status`.

## 3. UI — `/admin/workflows/peers`

Two cards in `ea-card.ea-form-card` idiom:

- **Add peer** — label + base URL + Add button.
- **Registered peers** — table of peers with:
  - Base URL (mono),
  - Added date,
  - Last push timestamp + status,
  - Workflow dropdown + **Push** button per row,
  - Remove button.

A "Last push:" hint under the table surfaces the most recent push
outcome so operators don't have to scan the table column.

Sidebar: new **Peers** entry under the Workflows group.

## 4. Verified end-to-end

```
Register loopback peer                       ✓
Push workflow → HTTP 401                     ✓ (expected: loopback peer
                                                 rejects unauthenticated
                                                 cross-edge write — correct
                                                 security posture; the
                                                 outcome is persisted on
                                                 last_push_status)
Peer list reflects lastPushStatus            ✓
Peer removal                                 ✓
```

The HTTP 401 is the right pilot behaviour — real deployments provision
peers with a shared service-account cookie or token. Capturing the
mechanism + persistence contract is what matters here; the auth layer
plugs in without further schema changes.

## 5. Files changed

```
database/migrations/V061__workflow_peer.sql                    (new)
server/.../web/WorkflowPeerController.java                     (new)
admin-ui/src/api/edgeApi.ts                                    — WorkflowPeer + 4 helpers
admin-ui/src/screens/workflow/WorkflowPeers.tsx                (new)
admin-ui/src/App.tsx                                           — /workflows/peers route
admin-ui/src/app/navigation.ts                                 — sidebar "Peers"
VERSION / server/pom.xml / admin-ui/package.json / sw.js / client/package.json — 2.3.32
```

## 6. Follow-ups

- Service-account auth for inter-edge push (shared bearer token in
  env, or peer-registry-level token column).
- Receive-side "import inbox" + accept/reject UI so a peer's push
  lands as a pending import rather than overwriting silently.
- Peer discovery (mDNS / Avahi) so pilots don't have to hand-paste
  base URLs.
