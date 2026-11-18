import type {
  PendingOffer,
  PeerChannelKind,
  PeerSessionSummary,
  RemoteIceCandidate,
} from './types';

/**
 * Abstract contract {@link PeerConnectionManager} uses for SDP + ICE
 * exchange. Two implementations:
 *
 * <ol>
 *   <li>{@link HttpSignalingBackend} — the default. Wraps the
 *       server-side WebRTC broker at {@code /edge-api/v1/webrtc/*}.
 *       Used whenever the DER server is reachable.</li>
 *   <li>{@link RelaySignalingBackend} — DBE.3b fallback. Routes
 *       the same offer / answer / ICE frames through a DPP mesh
 *       intermediary ({@code control.signal-relay}) when the HTTP
 *       broker is unreachable. Keeps new mesh sessions possible
 *       during a DER-server outage.</li>
 * </ol>
 *
 * <p>Interface aligned to the subset of {@link SignalingClient}
 * {@link PeerConnectionManager} actually calls so both backends are
 * drop-in swappable without touching the connection lifecycle.</p>
 */

export type SignalingBackendKind = 'http' | 'relay';

export interface SignalingBackend {
  /** Which transport this backend implements. UI reflects it
   *  ("signaling via peer <X>") so operators know when a session
   *  rode P-sig vs the HTTP broker. */
  readonly kind: SignalingBackendKind;

  offer(
    responderDevice: string,
    sdpOffer: string,
    kind: PeerChannelKind,
  ): Promise<string>;

  answer(sessionId: string, sdpAnswer: string): Promise<void>;

  complete(sessionId: string): Promise<void>;

  pending(): Promise<PendingOffer[]>;

  /** Full session snapshot incl. the sdpAnswer when the responder
   *  has posted it. Initiators poll this to learn when the answer
   *  has landed. */
  session(sessionId: string): Promise<
    PeerSessionSummary & { sdpOffer: string; sdpAnswer: string | null }
  >;

  postIce(
    sessionId: string,
    candidateSdp: string,
    sdpMid: string | null,
    sdpMLineIndex: number | null,
  ): Promise<void>;

  pullIce(
    sessionId: string,
    sinceId: number,
  ): Promise<RemoteIceCandidate[]>;
}
