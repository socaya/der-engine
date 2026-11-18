/** P2P wire types mirroring der.webrtc_session / der.webrtc_ice_candidate.
 *  Kept in one file so the signaling client + peer manager + hook share
 *  one shape vocabulary instead of drifting over time. */

/** Lifecycle state tracked on the server side (webrtc_session.state). */
export type PeerSessionState = 'OFFERED' | 'ANSWERED' | 'COMPLETED' | 'FAILED';

/** Channel kind — `data` is a reliable WebRTC DataChannel (sync /
 *  journal replication). `audio`/`video` reserved for future live
 *  comms between clinic devices; signaling is the same. */
export type PeerChannelKind = 'data' | 'audio' | 'video';

export interface PeerSessionSummary {
  readonly sessionId: string;
  readonly initiatorDevice: string;
  readonly responderDevice: string;
  readonly state: PeerSessionState;
  readonly kind: PeerChannelKind;
  readonly createdAt: string;
  readonly completedAt?: string | null;
}

/** Pending offer surfaced to a responder device by GET /pending. */
export interface PendingOffer {
  readonly sessionId: string;
  readonly initiatorDevice: string;
  readonly sdpOffer: string;
  readonly kind: PeerChannelKind;
  readonly createdAt: string;
}

/** Trickle-ICE candidate as persisted server-side. */
export interface RemoteIceCandidate {
  readonly candidateId: number;
  readonly fromDevice: string;
  readonly candidateSdp: string;
  readonly sdpMid: string | null;
  readonly sdpMLineIndex: number | null;
  readonly createdAt: string;
}

/** Local connection-state exposed to UI. Narrower than
 *  RTCPeerConnectionState so hooks can route badge colour by it. */
export type P2PConnectionStatus =
  | 'idle'
  | 'signaling-offer'
  | 'signaling-answer'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed'
  | 'closed';

export interface P2PSession {
  readonly sessionId: string;
  readonly localDevice: string;
  readonly remoteDevice: string;
  readonly kind: PeerChannelKind;
  readonly role: 'initiator' | 'responder';
  readonly status: P2PConnectionStatus;
  /** ISO timestamp of the last state transition. */
  readonly lastChangeAt: string;
}

/** Payload sent / received over the data channel. Wrapping gives the
 *  protocol layer room to add envelope fields (seq, ack, mime) without
 *  churning every call-site. */
export interface P2PMessage {
  readonly type: string;
  readonly payload: unknown;
  readonly seq?: number;
}

/** Thrown by SignalingClient when the server returns a 4xx/5xx. */
export class SignalingError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'SignalingError';
  }
}
