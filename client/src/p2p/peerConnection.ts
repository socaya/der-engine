import type {
  P2PConnectionStatus,
  P2PMessage,
  P2PSession,
  PeerChannelKind,
  RemoteIceCandidate,
} from './types';
import { SignalingClient } from './signaling';
import type { SignalingBackend } from './signalingBackend';

/**
 * Lifecycle manager for a single WebRTC peer connection.
 *
 * Wraps RTCPeerConnection + a single reliable DataChannel + the
 * SignalingClient polling loop. Exposes a narrow event interface
 * (onStatus / onMessage / onError) so a React hook can mirror
 * status to UI without leaking RTCPeerConnection internals.
 *
 * <p>On-edge posture: an operator-deployed cluster of clinic
 * devices is typically on a flat LAN. The ICE server config
 * defaults to the public Google STUN so public-IP nodes still
 * work; sites with a local coturn can override via
 * {@link P2POptions#iceServers}. No TURN by default — relayed
 * traffic through TURN would defeat the point of edge P2P.</p>
 */

export interface P2POptions {
  /** Explicit ICE server list. Defaults to Google STUN. Pass empty
   *  array to force host-candidate-only (pure LAN). */
  readonly iceServers?: RTCIceServer[];
  /** Milliseconds between /pending + /ice polls during the handshake
   *  phase. Default 500ms. Backs off to 5s once connected. */
  readonly pollIntervalMs?: number;
  /** Data-channel label — purely diagnostic. Default `der`. */
  readonly channelLabel?: string;
  /** DBE.3b — SDP/ICE transport. Default is the HTTP broker at
   *  /edge-api/v1/webrtc/*; pass a {@link RelaySignalingBackend}
   *  to route signaling through a DPP mesh intermediary when the
   *  server-side broker is unreachable. */
  readonly signaling?: SignalingBackend;
}

export type P2PStatusListener = (session: P2PSession) => void;
export type P2PMessageListener = (msg: P2PMessage) => void;
export type P2PErrorListener = (err: Error, phase: string) => void;

const DEFAULT_OPTS: Required<Omit<P2POptions, 'signaling'>> = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  pollIntervalMs: 500,
  channelLabel: 'der',
};

export class PeerConnectionManager {
  private readonly signaling: SignalingBackend;
  private readonly localDevice: string;
  private readonly opts: Required<Omit<P2POptions, 'signaling'>>;

  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private sessionId: string | null = null;
  private remoteDevice: string | null = null;
  private role: 'initiator' | 'responder' | null = null;
  private kind: PeerChannelKind = 'data';

  private status: P2PConnectionStatus = 'idle';
  private lastChangeAt = new Date().toISOString();
  private lastIceId = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  private statusListeners = new Set<P2PStatusListener>();
  private messageListeners = new Set<P2PMessageListener>();
  private errorListeners = new Set<P2PErrorListener>();

  constructor(localDevice: string, opts: P2POptions = {}) {
    this.localDevice = localDevice;
    const { signaling, ...rest } = opts;
    this.opts = { ...DEFAULT_OPTS, ...rest };
    this.signaling = signaling ?? new SignalingClient(localDevice);
  }

  /** Initiator path — create offer, post it, start polling for answer + ICE. */
  async connectTo(remoteDevice: string, kind: PeerChannelKind = 'data'): Promise<void> {
    if (this.pc) {
      throw new Error('already connected or connecting; call close() first');
    }
    this.remoteDevice = remoteDevice;
    this.role = 'initiator';
    this.kind = kind;
    this.setStatus('signaling-offer');

    this.pc = this.newPc();
    this.channel = this.pc.createDataChannel(this.opts.channelLabel, {
      ordered: true,
    });
    this.wireChannel(this.channel);

    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      // Wait for ICE gathering to complete OR timeout — some browsers
      // never fire `icegatheringstatechange = complete` on LAN-only.
      await this.waitForIceComplete(1500);
      this.sessionId = await this.signaling.offer(
        remoteDevice,
        this.pc.localDescription!.sdp,
        kind,
      );
      this.startPolling();
    } catch (ex) {
      this.emitError(ex, 'offer');
      this.setStatus('failed');
      this.close();
      throw ex;
    }
  }

  /** Responder path — accept a specific pending offer (SDP body supplied
   *  by the signaling /pending poll). */
  async acceptOffer(
    sessionId: string,
    initiatorDevice: string,
    sdpOffer: string,
    kind: PeerChannelKind = 'data',
  ): Promise<void> {
    if (this.pc) {
      throw new Error('already connected or connecting; call close() first');
    }
    this.sessionId = sessionId;
    this.remoteDevice = initiatorDevice;
    this.role = 'responder';
    this.kind = kind;
    this.setStatus('signaling-answer');

    this.pc = this.newPc();
    this.pc.ondatachannel = (ev) => {
      this.channel = ev.channel;
      this.wireChannel(this.channel);
    };

    try {
      await this.pc.setRemoteDescription({ type: 'offer', sdp: sdpOffer });
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      await this.waitForIceComplete(1500);
      await this.signaling.answer(sessionId, this.pc.localDescription!.sdp);
      this.setStatus('connecting');
      this.startPolling();
    } catch (ex) {
      this.emitError(ex, 'answer');
      this.setStatus('failed');
      this.close();
      throw ex;
    }
  }

  send(msg: P2PMessage): void {
    if (!this.channel || this.channel.readyState !== 'open') {
      throw new Error(`channel not open (state=${this.channel?.readyState ?? 'none'})`);
    }
    this.channel.send(JSON.stringify(msg));
  }

  close(): void {
    this.stopPolling();
    if (this.channel) {
      try {
        this.channel.close();
      } catch { /* already closed */ }
      this.channel = null;
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch { /* already closed */ }
      this.pc = null;
    }
    if (this.sessionId) {
      this.signaling.complete(this.sessionId).catch(() => undefined);
    }
    this.setStatus('closed');
  }

  session(): P2PSession | null {
    if (!this.sessionId || !this.remoteDevice || !this.role) {
      return null;
    }
    return {
      sessionId: this.sessionId,
      localDevice: this.localDevice,
      remoteDevice: this.remoteDevice,
      kind: this.kind,
      role: this.role,
      status: this.status,
      lastChangeAt: this.lastChangeAt,
    };
  }

  onStatus(listener: P2PStatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onMessage(listener: P2PMessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onError(listener: P2PErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  // ---- internals ----

  private newPc(): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: [...this.opts.iceServers] });
    pc.onicecandidate = (ev) => {
      if (!ev.candidate || !this.sessionId) {
        return;
      }
      // Trickle: push each candidate as it arrives instead of waiting
      // for gathering to finish. Keeps handshake snappy on LAN.
      this.signaling
        .postIce(
          this.sessionId,
          ev.candidate.candidate,
          ev.candidate.sdpMid ?? null,
          ev.candidate.sdpMLineIndex ?? null,
        )
        .catch((ex) => this.emitError(ex, 'postIce'));
    };
    pc.oniceconnectionstatechange = () => {
      switch (pc.iceConnectionState) {
        case 'checking':
          this.setStatus('connecting');
          break;
        case 'connected':
        case 'completed':
          this.setStatus('connected');
          this.slowPolling();
          break;
        case 'disconnected':
          this.setStatus('reconnecting');
          break;
        case 'failed':
          this.setStatus('failed');
          this.close();
          break;
        case 'closed':
          this.setStatus('closed');
          break;
      }
    };
    return pc;
  }

  private wireChannel(ch: RTCDataChannel): void {
    ch.onopen = () => {
      this.setStatus('connected');
      if (this.sessionId) {
        this.signaling.complete(this.sessionId).catch(() => undefined);
      }
    };
    ch.onclose = () => this.setStatus('disconnected');
    ch.onerror = (ev) => this.emitError(
      new Error('data channel error'),
      `channel:${(ev as RTCErrorEvent).error?.errorDetail ?? 'unknown'}`,
    );
    ch.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.data)) as P2PMessage;
        if (parsed && typeof parsed.type === 'string') {
          for (const l of this.messageListeners) l(parsed);
        }
      } catch (ex) {
        this.emitError(ex as Error, 'messageParse');
      }
    };
  }

  private async waitForIceComplete(timeoutMs: number): Promise<void> {
    const pc = this.pc;
    if (!pc) return;
    if (pc.iceGatheringState === 'complete') return;
    await new Promise<void>((resolve) => {
      const done = () => {
        pc.removeEventListener('icegatheringstatechange', onChange);
        clearTimeout(timer);
        resolve();
      };
      const onChange = () => {
        if (pc.iceGatheringState === 'complete') done();
      };
      const timer = setTimeout(done, timeoutMs);
      pc.addEventListener('icegatheringstatechange', onChange);
    });
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => this.pollOnce(), this.opts.pollIntervalMs);
    // Fire once immediately so we don't wait a full interval for the
    // first answer / ICE drain.
    this.pollOnce();
  }

  private slowPolling(): void {
    this.stopPolling();
    // After connect we still poll ICE so late-arriving candidates can
    // stabilise the stream after network churn — just at 5s.
    this.pollTimer = setInterval(() => this.pollOnce(), 5000);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async pollOnce(): Promise<void> {
    if (!this.pc || !this.sessionId) return;
    try {
      // Initiator path: watch for SDP answer landing on the broker.
      if (this.role === 'initiator'
          && this.pc.signalingState === 'have-local-offer') {
        const s = await this.signaling.session(this.sessionId);
        if (s.sdpAnswer) {
          await this.pc.setRemoteDescription({
            type: 'answer', sdp: s.sdpAnswer,
          });
          this.setStatus('connecting');
        }
      }
      // Drain new ICE candidates on both sides.
      const cands = await this.signaling.pullIce(this.sessionId, this.lastIceId);
      for (const c of cands) {
        this.lastIceId = Math.max(this.lastIceId, c.candidateId);
        await this.addRemoteIce(c);
      }
    } catch (ex) {
      this.emitError(ex as Error, 'poll');
    }
  }

  private async addRemoteIce(c: RemoteIceCandidate): Promise<void> {
    if (!this.pc) return;
    try {
      await this.pc.addIceCandidate({
        candidate: c.candidateSdp,
        sdpMid: c.sdpMid ?? undefined,
        sdpMLineIndex: c.sdpMLineIndex ?? undefined,
      });
    } catch (ex) {
      this.emitError(ex as Error, 'addIceCandidate');
    }
  }

  private setStatus(next: P2PConnectionStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.lastChangeAt = new Date().toISOString();
    const snap = this.session();
    if (snap) {
      for (const l of this.statusListeners) l(snap);
    }
  }

  private emitError(ex: unknown, phase: string): void {
    const err = ex instanceof Error ? ex : new Error(String(ex));
    for (const l of this.errorListeners) l(err, phase);
  }
}
