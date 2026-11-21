import type {
  PendingOffer,
  PeerChannelKind,
  PeerSessionSummary,
  RemoteIceCandidate,
} from './types';
import { SignalingError } from './types';
import type { SignalingBackend } from './signalingBackend';

/**
 * Thin wrapper over the DER WebRTC signaling broker at
 * {@code /edge-api/v1/webrtc/*}. The broker only shuttles SDP + ICE
 * candidates — no media / data ever flows through DER after the
 * connection is established.
 *
 * <p>Design choices:
 * <ul>
 *   <li>Credentials are cookie-based (same DER_SESSION cookie as the
 *       rest of the app), so every call uses {@code credentials:
 *       'include'}. No tokens in request bodies.</li>
 *   <li>ICE candidates are fetched incrementally via {@code
 *       since=<lastCandidateId>} so trickle polling stays O(delta)
 *       instead of refetching the full list each poll.</li>
 *   <li>Polling cadence is injected by the caller — the manager
 *       picks 500ms during handshake and backs off after
 *       connected.</li>
 * </ul>
 */
export class SignalingClient implements SignalingBackend {
  readonly kind = 'http' as const;

  private readonly deviceId: string;

  constructor(deviceId: string) {
    if (!deviceId) {
      throw new Error('deviceId is required');
    }
    this.deviceId = deviceId;
  }

  /** Initiator → broker: post the local SDP offer. Returns the newly
   *  created sessionId which both peers use for every subsequent
   *  signaling call. */
  async offer(
    responderDevice: string,
    sdpOffer: string,
    kind: PeerChannelKind = 'data',
  ): Promise<string> {
    const body = JSON.stringify({
      initiatorDevice: this.deviceId,
      responderDevice,
      sdpOffer,
      kind,
    });
    const r = await this.send('POST', '/edge-api/v1/webrtc/offer', body);
    return r.sessionId as string;
  }

  /** Responder → broker: post the SDP answer DER will relay to the
   *  initiator on its next session lookup. */
  async answer(sessionId: string, sdpAnswer: string): Promise<void> {
    await this.send(
      'POST',
      `/edge-api/v1/webrtc/${sessionId}/answer`,
      JSON.stringify({ sdpAnswer }),
    );
  }

  /** Flip state to COMPLETED on the broker once the data channel has
   *  opened — the broker stops listing the session in future /pending
   *  polls once this fires. */
  async complete(sessionId: string): Promise<void> {
    await this.send('POST', `/edge-api/v1/webrtc/${sessionId}/complete`, '');
  }

  /** Poll — fetch every offer addressed to this device that hasn't
   *  yet been answered. Returns an empty list when idle. */
  async pending(): Promise<PendingOffer[]> {
    const r = await this.send(
      'GET',
      `/edge-api/v1/webrtc/pending?deviceId=${encodeURIComponent(this.deviceId)}`,
    );
    const rows = Array.isArray(r.sessions) ? r.sessions : [];
    return rows.map((row: Record<string, unknown>) => ({
      sessionId: String(row.session_id ?? row.sessionId ?? ''),
      initiatorDevice: String(row.initiator_device ?? row.initiatorDevice ?? ''),
      sdpOffer: String(row.sdp_offer ?? row.sdpOffer ?? ''),
      kind: (row.kind ?? 'data') as PeerChannelKind,
      createdAt: String(row.created_at ?? row.createdAt ?? ''),
    }));
  }

  /** Full session snapshot, including the sdpAnswer when the responder
   *  has posted it. Initiator polls this to learn when the answer has
   *  landed on the broker. */
  async session(sessionId: string): Promise<PeerSessionSummary & { sdpOffer: string; sdpAnswer: string | null }> {
    const r = await this.send('GET', `/edge-api/v1/webrtc/${sessionId}`);
    return {
      sessionId: String(r.session_id ?? r.sessionId ?? sessionId),
      initiatorDevice: String(r.initiator_device ?? r.initiatorDevice ?? ''),
      responderDevice: String(r.responder_device ?? r.responderDevice ?? ''),
      state: String(r.state ?? 'OFFERED') as PeerSessionSummary['state'],
      kind: (r.kind ?? 'data') as PeerChannelKind,
      createdAt: String(r.created_at ?? r.createdAt ?? ''),
      completedAt: r.completed_at as string | null ?? null,
      sdpOffer: String(r.sdp_offer ?? r.sdpOffer ?? ''),
      // Server returns sdpAnswer (camelCase). The snake_case variant
      // is kept for robustness against pre-controller shape changes
      // or alternate serializers but never actually fires in prod —
      // without this fix the initiator never saw the responder's
      // answer and stayed stuck in have-local-offer forever,
      // observed in the P2P e2e verify.
      sdpAnswer: (r.sdpAnswer ?? r.sdp_answer ?? null) as string | null,
    };
  }

  /** Recent sessions involving any device — used by the admin peer
   *  console to debug stuck handshakes. */
  async recent(limit = 50): Promise<PeerSessionSummary[]> {
    const r = await this.send('GET', `/edge-api/v1/webrtc/sessions?limit=${limit}`);
    const rows = Array.isArray(r.sessions) ? r.sessions : [];
    return rows.map((row: Record<string, unknown>) => ({
      sessionId: String(row.session_id ?? ''),
      initiatorDevice: String(row.initiator_device ?? ''),
      responderDevice: String(row.responder_device ?? ''),
      state: String(row.state ?? 'OFFERED') as PeerSessionSummary['state'],
      kind: (row.kind ?? 'data') as PeerChannelKind,
      createdAt: String(row.created_at ?? ''),
      completedAt: (row.completed_at as string | null) ?? null,
    }));
  }

  /** Trickle one local ICE candidate up to the broker. The remote
   *  peer picks it up on its next /ice poll. */
  async postIce(
    sessionId: string,
    candidateSdp: string,
    sdpMid: string | null,
    sdpMLineIndex: number | null,
  ): Promise<void> {
    // Server's WebRtcController.IceBody expects the field name
    // {@code candidate} (plus fromDevice + sdpMid + sdpMLineIndex).
    // Sending candidateSdp triggers a 400 CANDIDATE_REQUIRED and
    // ICE never reaches the peer — observed in the two-browser
    // e2e probe where both sides stuck at "connecting" forever.
    // Both names are sent for forward-compat; the server only
    // reads `candidate`.
    await this.send(
      'POST',
      `/edge-api/v1/webrtc/${sessionId}/ice`,
      JSON.stringify({
        fromDevice: this.deviceId,
        candidate: candidateSdp,
        sdpMid,
        sdpMLineIndex,
      }),
    );
  }

  /** Drain new ICE candidates from the other side.
   *
   *  @param sinceId  highest candidate id already applied locally;
   *                  zero on first call. */
  async pullIce(sessionId: string, sinceId: number): Promise<RemoteIceCandidate[]> {
    const r = await this.send(
      'GET',
      `/edge-api/v1/webrtc/${sessionId}/ice?deviceId=${encodeURIComponent(this.deviceId)}&since=${sinceId}`,
    );
    const rows = Array.isArray(r.candidates) ? r.candidates : [];
    return rows.map((row: Record<string, unknown>) => ({
      // Server emits camelCase from WebRtcSignallingService; snake_case
      // fallbacks kept for forward-compat with alternate serializers.
      // Server also uses `candidate` (not `candidateSdp`) as the key.
      candidateId: Number(row.candidateId ?? row.candidate_id ?? 0),
      fromDevice: String(row.fromDevice ?? row.from_device ?? ''),
      candidateSdp: String(row.candidate ?? row.candidateSdp
        ?? row.candidate_sdp ?? ''),
      sdpMid: (row.sdpMid ?? row.sdp_mid ?? null) as string | null,
      sdpMLineIndex: ((row.sdpMLineIndex ?? row.sdp_m_line_index
        ?? null) as number | null),
      createdAt: String(row.createdAt ?? row.created_at ?? ''),
    }));
  }

  // ---- private ----

  private async send(
    method: string,
    path: string,
    body?: string,
  ): Promise<Record<string, unknown>> {
    const init: RequestInit = {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-DER-Device-Id': this.deviceId,
      },
    };
    if (body != null && body !== '') {
      init.body = body;
    }
    const r = await fetch(path, init);
    if (!r.ok) {
      let code = 'SIGNALING_ERROR';
      let message = `${method} ${path} -> ${r.status}`;
      try {
        const j = (await r.json()) as Record<string, unknown>;
        if (typeof j.code === 'string') code = j.code;
        if (typeof j.message === 'string') message = j.message;
      } catch {
        // non-JSON body — keep the default message
      }
      throw new SignalingError(r.status, code, message);
    }
    if (r.status === 204) {
      return {};
    }
    const ct = r.headers.get('content-type') ?? '';
    if (!ct.includes('json')) {
      return {};
    }
    return (await r.json()) as Record<string, unknown>;
  }
}
