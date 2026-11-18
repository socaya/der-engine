import type { DerPeerProtocol, DppResource } from './derPeerProtocol';
import { DppError } from './derPeerProtocol';
import type { PeerMeshManager } from './mesh';

/**
 * DBE.3 — peer-as-signaling (P-sig).
 *
 * <p>When the DER server is unreachable the WebRTC signaling broker
 * at {@code /edge-api/v1/webrtc/*} is also unreachable, so new
 * sessions can't form the normal way. P-sig closes that gap by
 * using the existing mesh as an SDP + ICE relay: if device A has a
 * live session with B, and B has a live session with C, then A can
 * reach C transitively via B just long enough to establish a
 * direct A↔C data channel.</p>
 *
 * <p>Wire protocol — one new DPP resource {@code control} with
 * action {@code signal-relay}:
 * <pre>
 *   kind: "offer" | "answer" | "ice"
 *   from: deviceId (originator)
 *   target: deviceId (final receiver)
 *   sessionId: string (correlates offer with later answer + ICE)
 *   sdp?: string (set on kind=offer|answer)
 *   candidate?, sdpMid?, sdpMLineIndex? (set on kind=ice)
 * </pre>
 * The intermediary peer receives the frame, looks up a direct
 * session to the target, forwards the frame unchanged through
 * that session, and forwards any reply back to the originator
 * via the inbound session. Idempotent; carries sessionId so a
 * duplicate frame doesn't re-apply.</p>
 *
 * <p>This module ships the forwarder + reachability lookup. The
 * follow-up DBE.3b wires it into {@link PeerConnectionManager} so
 * clicking Connect in the UI falls back to P-sig when the HTTP
 * broker rejects.</p>
 */

export type SignalRelayKind = 'offer' | 'answer' | 'ice';

export interface SignalRelayPayload {
  readonly kind: SignalRelayKind;
  readonly from: string;
  readonly target: string;
  readonly sessionId: string;
  readonly sdp?: string;
  readonly candidate?: string;
  readonly sdpMid?: string | null;
  readonly sdpMLineIndex?: number | null;
}

export type SignalRelayLocalHandler =
  (payload: SignalRelayPayload) => void | Promise<void>;

/**
 * Attaches to every DerPeerProtocol in a mesh + a single mesh
 * instance. Owns the {@code control.signal-relay} fan-out logic:
 * on every incoming frame, either deliver locally (when we're the
 * target) or forward to whichever session reaches the target.
 */
export class PeerSignalingRelay {
  private readonly mesh: PeerMeshManager;
  private readonly localDeviceId: string;
  private readonly dppBySession: () => ReadonlyMap<string, DerPeerProtocol>;
  /** Per-sessionId local delivery callbacks — registered by
   *  P-sig session attempts so inbound answers / ICE candidates
   *  land back in the originator's {@code RTCPeerConnection}
   *  without blind-forwarding on. */
  private readonly localHandlers = new Map<string, SignalRelayLocalHandler>();
  /** Short-TTL dedup so a frame echoed through multiple intermediaries
   *  doesn't re-process. Keyed by (sessionId, kind, candidate-or-sdp-hash). */
  private readonly seen = new Set<string>();

  constructor(
    mesh: PeerMeshManager,
    localDeviceId: string,
    dppBySession: () => ReadonlyMap<string, DerPeerProtocol>,
  ) {
    this.mesh = mesh;
    this.localDeviceId = localDeviceId;
    this.dppBySession = dppBySession;
  }

  /** Attach the control.signal-relay handler to a specific DPP
   *  protocol instance. Called by DevicePeers / the mesh wiring
   *  once per session's protocol construction (same place
   *  JournalReplicator et al are wired). */
  attachTo(dpp: DerPeerProtocol): () => void {
    return dpp.on('control', 'signal-relay', async (frame) => {
      const payload = frame.payload as SignalRelayPayload;
      if (!payload || !payload.kind || !payload.target
          || !payload.from || !payload.sessionId) {
        throw new DppError('SIGNAL_RELAY_MALFORMED',
          'signal-relay requires {kind, from, target, sessionId}');
      }
      const dedup = this.dedupKey(payload);
      if (this.seen.has(dedup)) return;
      this.seen.add(dedup);
      // Bound the dedup set — it's per-process + short-lived so
      // 1k entries is a comfortable ceiling.
      if (this.seen.size > 1000) this.seen.clear();

      if (payload.target === this.localDeviceId) {
        await this.deliverLocally(payload);
        return;
      }
      await this.forward(payload);
    });
  }

  /** Register a local handler for one signaling session — called by
   *  a DBE.3b P-sig initiator that's waiting on answers / ICE for
   *  a specific sessionId. Returns an unregister function. */
  onSession(sessionId: string, handler: SignalRelayLocalHandler): () => void {
    this.localHandlers.set(sessionId, handler);
    return () => this.localHandlers.delete(sessionId);
  }

  /** Fire a P-sig frame toward a target device. The caller picks
   *  the intermediary — usually by walking mesh.sessions() looking
   *  for a session whose DPP {@link DerPeerProtocol#peerCanReach}
   *  the target. Returns the ack promise from the protocol. */
  async sendVia(
    intermediary: DerPeerProtocol,
    payload: SignalRelayPayload,
  ): Promise<void> {
    await intermediary.send(
      'control' as DppResource,
      'signal-relay',
      payload,
    );
  }

  /** Walk every live session; return the first protocol whose
   *  remote claims a direct connection to {@code targetDevice}, or
   *  null when no transitive path is known. */
  findIntermediaryFor(
    targetDevice: string,
    dppBySession: ReadonlyMap<string, DerPeerProtocol>,
  ): DerPeerProtocol | null {
    for (const [, dpp] of dppBySession) {
      if (dpp.peerCanReach(targetDevice)) return dpp;
    }
    return null;
  }

  // ---- internals ----

  private async deliverLocally(payload: SignalRelayPayload): Promise<void> {
    const handler = this.localHandlers.get(payload.sessionId);
    if (!handler) {
      // No local registration — might be an answer that arrived
      // before the originator's listener was ready. We drop; the
      // originator will retry.
      return;
    }
    await handler(payload);
  }

  private async forward(payload: SignalRelayPayload): Promise<void> {
    // Direct session to the target first (one-hop forward).
    const targetMgr = this.mesh.sessionFor(payload.target);
    if (targetMgr) {
      const targetSessionId = targetMgr.session()?.sessionId;
      const dpp = targetSessionId
        ? this.dppBySession().get(targetSessionId) : undefined;
      if (dpp) {
        await this.sendVia(dpp, payload);
        return;
      }
    }
    // Transitive hop — look for an intermediary that claims to
    // reach the target. Prevents routing loops by excluding
    // sessions that already claim the originator.
    const intermediary = this.findIntermediaryFor(
      payload.target,
      this.dppBySession(),
    );
    if (!intermediary) {
      throw new DppError('NO_PATH_TO_TARGET',
        `no direct or transitive session to ${payload.target}`);
    }
    await this.sendVia(intermediary, payload);
  }

  private dedupKey(payload: SignalRelayPayload): string {
    const content = payload.sdp
      ?? payload.candidate
      ?? '';
    // Simple hash — session + kind + first 32 chars of content is
    // enough to dedup identical replays without a real digest.
    return `${payload.sessionId}:${payload.kind}:${content.slice(0, 32)}`;
  }
}
