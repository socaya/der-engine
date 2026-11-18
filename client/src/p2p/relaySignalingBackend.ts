import type { DerPeerProtocol } from './derPeerProtocol';
import type { PeerSignalingRelay, SignalRelayPayload } from './peerSignaling';
import type { SignalingBackend } from './signalingBackend';
import type {
  PendingOffer,
  PeerChannelKind,
  PeerSessionSummary,
  RemoteIceCandidate,
} from './types';

/**
 * {@link SignalingBackend} that routes SDP + ICE through a DPP
 * {@code control.signal-relay} intermediary instead of the server-
 * side WebRTC broker. Used when the DER server is unreachable but
 * the mesh still has a transitive path to the target device.
 *
 * <p>Model: this backend is paired with one specific intermediary
 * {@link DerPeerProtocol} at construction time (DevicePeers picks
 * the intermediary by scanning {@link DerPeerProtocol#peerCanReach}
 * across the open mesh). Outbound frames go out through that peer;
 * inbound frames (answer + ICE) arrive via the relay's
 * {@code onSession} callback and buffer here until the
 * {@link PeerConnectionManager}'s polling loop reads them.</p>
 *
 * <p>Deliberately mimics the HTTP backend's polling shape rather
 * than pushing directly into the RTCPeerConnection — keeps
 * PeerConnectionManager's lifecycle logic identical regardless of
 * which backend is wired. One new entry point in the connection
 * manager (constructor option) + one new backend class = whole
 * P-sig path with zero changes to the state machine.</p>
 */
export class RelaySignalingBackend implements SignalingBackend {
  readonly kind = 'relay' as const;

  private readonly localDeviceId: string;
  private readonly remoteDeviceId: string;
  private readonly intermediary: DerPeerProtocol;
  private readonly relay: PeerSignalingRelay;

  /** Allocated eagerly so initiator offer() returns an id even
   *  before the first roundtrip. */
  private readonly sessionId: string;

  /** Latest answer SDP received for this session — pollers read it
   *  via {@link #session}. */
  private answerSdp: string | null = null;
  /** Sent offer SDP for the initiator case. Null on responder. */
  private offerSdp: string | null = null;

  /** Buffered inbound ICE candidates with a monotonic id so the
   *  caller's {@code pullIce(sinceId)} contract works. */
  private iceBuffer: RemoteIceCandidate[] = [];
  private iceSeq = 0;

  private unregister: (() => void) | null = null;

  constructor(
    localDeviceId: string,
    remoteDeviceId: string,
    intermediary: DerPeerProtocol,
    relay: PeerSignalingRelay,
  ) {
    this.localDeviceId = localDeviceId;
    this.remoteDeviceId = remoteDeviceId;
    this.intermediary = intermediary;
    this.relay = relay;
    this.sessionId = generateSessionId();
    this.unregister = this.relay.onSession(this.sessionId,
      (payload) => this.onInbound(payload));
  }

  async offer(
    responderDevice: string,
    sdpOffer: string,
    _kind: PeerChannelKind,
  ): Promise<string> {
    this.offerSdp = sdpOffer;
    const payload: SignalRelayPayload = {
      kind: 'offer',
      from: this.localDeviceId,
      target: responderDevice,
      sessionId: this.sessionId,
      sdp: sdpOffer,
    };
    await this.relay.sendVia(this.intermediary, payload);
    return this.sessionId;
  }

  async answer(sessionId: string, sdpAnswer: string): Promise<void> {
    const payload: SignalRelayPayload = {
      kind: 'answer',
      from: this.localDeviceId,
      target: this.remoteDeviceId,
      sessionId,
      sdp: sdpAnswer,
    };
    await this.relay.sendVia(this.intermediary, payload);
  }

  async complete(_sessionId: string): Promise<void> {
    // No completion frame in the P-sig path — once the data channel
    // is open the relay has done its job and the originator stops
    // polling. Dispose our inbound handler so the callback map
    // doesn't leak.
    this.unregister?.();
    this.unregister = null;
  }

  /** Relay backends don't surface pending offers — a P-sig
   *  responder is told about the incoming offer when its onInbound
   *  fires, not through a periodic poll. */
  async pending(): Promise<PendingOffer[]> {
    return [];
  }

  async session(sessionId: string): Promise<
    PeerSessionSummary & { sdpOffer: string; sdpAnswer: string | null }
  > {
    return {
      sessionId,
      initiatorDevice: this.localDeviceId,
      responderDevice: this.remoteDeviceId,
      state: this.answerSdp ? 'ANSWERED' : 'OFFERED',
      kind: 'data',
      createdAt: new Date().toISOString(),
      completedAt: null,
      sdpOffer: this.offerSdp ?? '',
      sdpAnswer: this.answerSdp,
    };
  }

  async postIce(
    sessionId: string,
    candidateSdp: string,
    sdpMid: string | null,
    sdpMLineIndex: number | null,
  ): Promise<void> {
    const payload: SignalRelayPayload = {
      kind: 'ice',
      from: this.localDeviceId,
      target: this.remoteDeviceId,
      sessionId,
      candidate: candidateSdp,
      sdpMid, sdpMLineIndex,
    };
    await this.relay.sendVia(this.intermediary, payload);
  }

  async pullIce(
    _sessionId: string,
    sinceId: number,
  ): Promise<RemoteIceCandidate[]> {
    return this.iceBuffer.filter((c) => c.candidateId > sinceId);
  }

  /** Handler registered with the PeerSignalingRelay — called when
   *  an inbound frame arrives for this sessionId. Routes to the
   *  answer / ICE buffers so the polling loop picks it up on its
   *  next tick. */
  private onInbound(payload: SignalRelayPayload): void {
    if (payload.kind === 'answer' && payload.sdp) {
      this.answerSdp = payload.sdp;
      return;
    }
    if (payload.kind === 'ice' && payload.candidate) {
      this.iceSeq += 1;
      this.iceBuffer.push({
        candidateId: this.iceSeq,
        fromDevice: payload.from,
        candidateSdp: payload.candidate,
        sdpMid: payload.sdpMid ?? null,
        sdpMLineIndex: payload.sdpMLineIndex ?? null,
        createdAt: new Date().toISOString(),
      });
    }
  }
}

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for very old browsers — UUID-v4 shape without the
  // v4-bit discipline. Good enough for a transient signaling key.
  const rand = (n: number): string => Math.random()
    .toString(16).slice(2, 2 + n);
  return `${rand(8)}-${rand(4)}-${rand(4)}-${rand(4)}-${rand(12)}`;
}
