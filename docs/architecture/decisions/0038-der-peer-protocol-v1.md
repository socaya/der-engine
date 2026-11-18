# ADR-0038: DER Peer Protocol v1 (DPP/1) — workflow-handoff edition

- Status: ACCEPTED
- Date: 2026-11-18
- Deciders: socaya
- Related: ADR-0036 (capture-form API), P2P.1–P2P.8 (client peer mesh)

## Context

P2P.1–P2P.8 landed a working peer-to-peer mesh between DER device
browsers over WebRTC data channels, with three hand-rolled
replicators (`JournalReplicator`, `WorkflowReplicator`,
`MetadataSyncReplicator`). That proved the transport works but
treated the mesh as a generic file-copier — the clinic-workflow
semantics DER is actually designed around (ADR-0036 service-point
routing) lived entirely server-side, inaccessible to the P2P code.

**The observation:** every DER distributed workflow is a baton
passing through service points. A patient's visit is a `run`
threaded through N steps, each step has an `owner_device_id` +
`owner_role`, and data submitted at step N should *automatically
appear* at step N+1's device without any operator reaching for
a Push button. Today that only works if both devices are reachable
through the edge server; the P2P mesh didn't carry the baton.

Without workflow-handoff in the protocol, operators have to
explicitly pick "push this to that device". With it, the clinic
mesh becomes the service-point routing fabric: nurse's tablet
auto-forwards triage data to the doctor's laptop, doctor's lab
order auto-arrives on the lab-tech's workstation, lab result
auto-lands back on the doctor's run.

Voice/video was considered + dropped — DER is a data-capture
appliance.

## Decision

Define **DPP/1** — a versioned, capability-negotiated, **run-aware**
frame protocol on top of any reliable ordered byte stream. The
protocol's primary citizen is `workflow.run-advance`: a frame that
carries one step's contribution + the next step owner, so receivers
can *either* apply the contribution locally (if they own the next
step) *or* relay it onward (if they don't) — fully automatic.

### Frame shape

Every frame on the wire is a single JSON object:

```
{
  dpp:      1,             // protocol version (integer)
  type:     "HELLO" | "WELCOME" | "DATA" | "ACK" | "NACK" | "RELAY" | "BYE",
  seq:      <number>,      // monotonic per-sender, 1-based
  ackSeq?:  <number>,      // present on ACK / NACK — the seq being acked
  resource?:<string>,      // DATA + RELAY — "workflow" | "journal" | "metadata" | "control"
  action?:  <string>,      // DATA + RELAY — resource-specific verb
  payload?: <unknown>,     // DATA + RELAY — body
  ttl?:     <number>,      // RELAY — hops remaining (default 3)
  route?:   <string>,      // RELAY — target deviceId (set when relayed)
  error?:   { code, message } // NACK
}
```

### Handshake

On channel open (both sides):

1. Send `HELLO` with `payload: {deviceId, capabilities: string[],
   ownsSteps: string[]}`. `capabilities` names the resources the
   sender's handlers support (e.g. `["workflow", "journal",
   "metadata", "control"]`). `ownsSteps` lists `step_id` UUIDs this
   device is the configured owner for — the receiver caches this
   so later `workflow.run-advance` frames can be routed.
2. Reply `WELCOME` with the capability intersection + the
   complementary `ownsSteps` from the peer.
3. After `WELCOME` on both sides, the channel is open.

### Workflow handoff — the core mechanic

Resource `workflow`, action `run-advance` payload:

```
{
  runId:          <uuid>,
  workflowId:     <uuid>,
  completedStep:  <uuid>,   // the step just finished
  nextStep:       <uuid> | null, // from capture_workflow_step.ordinal + 1
  nextOwner:      <deviceId> | null, // capture_workflow_step.owner_device_id
  contribution:   <CanonicalContribution>,  // payload of the just-finished step
  businessKey:    <string>,  // patient id / case id — carries across steps
  runSnapshot?:   <RunState> // optional full state for a cold receiver
}
```

Receiver logic:

1. If `nextOwner === localDeviceId` → **apply**: POST contribution to
   local `/edge-api/v1/workflows/runs/{runId}/contributions`, advance
   the run's `current_step_id` to `nextStep`, surface the run on the
   operator's queue. ACK back to sender.
2. Else if `nextOwner` is in the mesh (known via `HELLO.ownsSteps`
   advertisements) → **relay** a `RELAY` frame to that peer, decrement
   `ttl`. ACK the sender once the next hop ACKs us.
3. Else → **queue** locally in `workflow_import_inbox` with the
   nextOwner metadata; a future session with that device drains the
   queue. ACK the sender with status `queued`.
4. If `ttl === 0` → NACK with `RELAY_EXHAUSTED`.

This gives automatic service-point routing without any operator
intervention. One patient's visit flows nurse → doctor → lab →
pharmacy as fast as the mesh carries it.

### Other actions

| Resource   | Action           | Purpose                              |
|------------|------------------|--------------------------------------|
| `workflow` | `run-advance`    | **primary baton** — see above        |
| `workflow` | `push`           | Distribute a workflow *definition*   |
| `workflow` | `run-sync`       | Full run state (cold-receiver catch-up) |
| `journal`  | `write`          | Generic queued journal entry         |
| `metadata` | `batch` + `offer`| Catalog delta from catalog puller    |
| `control`  | `ping` + `pong`  | Liveness keepalive                   |
| `control`  | `bye`            | Graceful channel close               |

### Delivery semantics

- `DATA` frames carry monotonic `seq`. Receiver ACKs on handler
  success, NACKs with `error.code` on failure.
- `RELAY` frames additionally carry `ttl` (default 3) and `route`
  (the next-hop deviceId). Any device that receives a RELAY with
  `route !== localDeviceId` either forwards (decrement ttl) or
  NACKs with `UNKNOWN_ROUTE`.
- Idempotency: receivers dedup by `(sourceDevice, runId,
  completedStep)` so a replay-on-reconnect can't double-advance a
  run. Handlers register as idempotent.

### Version negotiation

- `dpp: 1` is the only recognised version today. `HELLO` with a
  different version gets a NACK `VERSION_UNSUPPORTED` and the
  channel closes.
- Future DPP/2 will share this spec's structure; peers speak the
  highest version both sides claim.

## Consequences

**Positive:**
- The protocol encodes DER's actual clinic model — baton routing,
  not generic file copy.
- Operators don't manually push between devices; data arrives on
  the next service point automatically as soon as the mesh forms.
- Offline resilience: a run can continue to accumulate steps on a
  device whose next-step owner is currently offline (RELAY queue);
  drains automatically when the owner comes online.
- New resources add without wire change — capability strings only.

**Negative:**
- Each device must advertise `ownsSteps` at handshake. A workflow
  with many steps makes `HELLO` larger; mitigated by capping
  advertised steps to those the receiver can actually reach (joins
  against adjacency table).
- Relaying increases hop count + ACK latency. TTL=3 is a safety
  valve against routing loops in dense meshes.

**Rollout:**
- `client/src/p2p/derPeerProtocol.ts` ships the new implementation.
- `WorkflowReplicator` migrates first (it's the most direct beneficiary).
- `JournalReplicator` + `MetadataSyncReplicator` migrate next; old
  `P2PProtocol` stays one release for mixed-version mesh.

## Reference implementation

`client/src/p2p/derPeerProtocol.ts` — ~400 LOC, no dependencies,
ships with `WorkflowReplicator` migrated to DPP/1 as validation.
