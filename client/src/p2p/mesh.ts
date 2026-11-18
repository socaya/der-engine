import { PeerConnectionManager, type P2POptions } from './peerConnection';
import type {
  P2PMessage,
  P2PSession,
  PeerChannelKind,
  PendingOffer,
} from './types';

/**
 * Composition layer over N {@link PeerConnectionManager} instances —
 * one per active peer. Unlocks the "clinic with three devices all
 * concurrently connected" shape that the single-manager model
 * couldn't express.
 *
 * <p>Keyed by sessionId (not remoteDevice) because the WebRTC
 * broker assigns a fresh sessionId per handshake — a later
 * reconnect to the same peer creates a new session with new ICE
 * candidates, and the old session should hang around momentarily
 * for graceful drain. The UI dedups by remoteDevice when deciding
 * whether to offer Connect vs Reconnect.</p>
 *
 * <p>Message fan-out: a single onMessage listener receives every
 * incoming envelope + the sessionId it came in on, so one
 * JournalReplicator instance can service every connected peer
 * through the same handler without the mesh having to track
 * per-peer subscriptions.</p>
 */

export type MeshMessageListener =
  (sessionId: string, msg: P2PMessage) => void;
export type MeshStatusListener =
  (sessionId: string, session: P2PSession) => void;
export type MeshErrorListener =
  (sessionId: string, err: Error, phase: string) => void;

export class PeerMeshManager {
  private readonly localDevice: string;
  private readonly opts: P2POptions;

  private readonly byId = new Map<string, PeerConnectionManager>();
  /** Reverse index: remoteDevice → sessionId. Lets the UI decide
   *  Connect vs Reconnect without walking the byId map. */
  private readonly byRemote = new Map<string, string>();

  private messageListeners = new Set<MeshMessageListener>();
  private statusListeners = new Set<MeshStatusListener>();
  private errorListeners = new Set<MeshErrorListener>();

  constructor(localDevice: string, opts: P2POptions = {}) {
    this.localDevice = localDevice;
    this.opts = opts;
  }

  /** Initiator: open a channel to {@code remoteDevice}. Returns the
   *  sessionId once the SDP offer lands on the broker. */
  async connectTo(
    remoteDevice: string,
    kind: PeerChannelKind = 'data',
  ): Promise<string> {
    // If a session for this peer is already live, hand back its id
    // — connect is idempotent from the UI's point of view.
    const existing = this.byRemote.get(remoteDevice);
    if (existing) {
      const mgr = this.byId.get(existing);
      if (mgr && mgr.session()?.status !== 'closed') {
        return existing;
      }
    }
    const mgr = new PeerConnectionManager(this.localDevice, this.opts);
    await mgr.connectTo(remoteDevice, kind);
    const sessionId = mgr.session()!.sessionId;
    this.register(sessionId, remoteDevice, mgr);
    return sessionId;
  }

  /** Responder: accept a specific pending offer. Returns the
   *  sessionId that was accepted. */
  async acceptOffer(offer: PendingOffer): Promise<string> {
    const mgr = new PeerConnectionManager(this.localDevice, this.opts);
    await mgr.acceptOffer(
      offer.sessionId,
      offer.initiatorDevice,
      offer.sdpOffer,
      offer.kind,
    );
    this.register(offer.sessionId, offer.initiatorDevice, mgr);
    return offer.sessionId;
  }

  /** Reliable-ish send on a specific channel. Throws when the
   *  session isn't known or its channel isn't open. */
  send(sessionId: string, msg: P2PMessage): void {
    const mgr = this.require(sessionId);
    mgr.send(msg);
  }

  close(sessionId: string): void {
    const mgr = this.byId.get(sessionId);
    if (!mgr) return;
    const remote = mgr.session()?.remoteDevice;
    mgr.close();
    this.byId.delete(sessionId);
    if (remote && this.byRemote.get(remote) === sessionId) {
      this.byRemote.delete(remote);
    }
  }

  closeAll(): void {
    for (const sessionId of [...this.byId.keys()]) {
      this.close(sessionId);
    }
  }

  /** Snapshot of every live session. Walks byId once; returns a new
   *  array so React setState doesn't share references. */
  sessions(): P2PSession[] {
    const out: P2PSession[] = [];
    for (const mgr of this.byId.values()) {
      const s = mgr.session();
      if (s) out.push({ ...s });
    }
    return out;
  }

  /** Manager for a given session, exposed so higher-level primitives
   *  (JournalReplicator, workflow replicators) can bind their own
   *  P2PProtocol directly to the underlying channel. */
  manager(sessionId: string): PeerConnectionManager | null {
    return this.byId.get(sessionId) ?? null;
  }

  onMessage(listener: MeshMessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onStatus(listener: MeshStatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onError(listener: MeshErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  // ---- internals ----

  private register(
    sessionId: string,
    remoteDevice: string,
    mgr: PeerConnectionManager,
  ): void {
    this.byId.set(sessionId, mgr);
    this.byRemote.set(remoteDevice, sessionId);
    mgr.onStatus((s) => {
      for (const l of this.statusListeners) l(sessionId, s);
      if (s.status === 'closed' || s.status === 'failed') {
        // Clean up index once the manager admits terminal state.
        this.byId.delete(sessionId);
        if (this.byRemote.get(remoteDevice) === sessionId) {
          this.byRemote.delete(remoteDevice);
        }
      }
    });
    mgr.onMessage((m) => {
      for (const l of this.messageListeners) l(sessionId, m);
    });
    mgr.onError((err, phase) => {
      for (const l of this.errorListeners) l(sessionId, err, phase);
    });
  }

  private require(sessionId: string): PeerConnectionManager {
    const mgr = this.byId.get(sessionId);
    if (!mgr) throw new Error(`no session ${sessionId}`);
    return mgr;
  }
}
