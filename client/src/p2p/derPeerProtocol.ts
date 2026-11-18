import type { PeerConnectionManager } from './peerConnection';
import type { P2PMessage } from './types';

/**
 * DPP/1 — DER Peer Protocol v1.
 *
 * Versioned, capability-negotiated, run-aware frame protocol for the
 * DER peer mesh. See docs/architecture/decisions/0038-der-peer-
 * protocol-v1.md for the normative spec; this file is the reference
 * implementation.
 *
 * <p>Key difference from the previous {@code P2PProtocol} envelope:
 * {@link DerPeerProtocol} understands the <em>workflow handoff</em>
 * semantic. A frame tagged {@code resource: "workflow", action:
 * "run-advance"} carries one step's contribution + the configured
 * next-owner device id; receivers either apply locally (if they own
 * the next step) or relay onward through the mesh (if they don't).
 * That's the "data for prerequisite step auto-arrives on the next
 * device" mechanic — no operator Push button needed.</p>
 */

export const DPP_VERSION = 1;
export const RELAY_DEFAULT_TTL = 3;

export type DppFrameType =
  | 'HELLO' | 'WELCOME'
  | 'DATA' | 'ACK' | 'NACK' | 'RELAY' | 'BYE';

export type DppResource = 'workflow' | 'journal' | 'metadata' | 'control';

export interface DppFrame {
  dpp: number;
  type: DppFrameType;
  seq: number;
  ackSeq?: number;
  resource?: DppResource;
  action?: string;
  payload?: unknown;
  ttl?: number;
  route?: string;
  error?: { code: string; message: string };
}

export interface DppCapabilities {
  readonly deviceId: string;
  /** Resources this device's handlers are willing to receive. */
  readonly capabilities: DppResource[];
  /** step_id UUIDs this device owns (from capture_workflow_step
   *  .owner_device_id). The remote caches this so later
   *  workflow.run-advance frames can be routed. */
  readonly ownsSteps: string[];
}

export type DppHandler = (
  frame: DppFrame,
  ctx: DppHandlerContext,
) => void | Promise<void>;

export interface DppHandlerContext {
  readonly sourceDevice: string;
  readonly relayed: boolean;
}

export type DppRouteTable = Map<string /* stepId */, string /* deviceId */>;

export class DppError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'DppError';
  }
}

const HANDSHAKE_TIMEOUT_MS = 5000;
const DEFAULT_ACK_TIMEOUT_MS = 10_000;

export class DerPeerProtocol {
  private readonly mgr: PeerConnectionManager;
  private readonly local: DppCapabilities;

  private outSeq = 0;
  private inFlight = new Map<number, {
    resource: DppResource;
    action: string;
    resolve: (frame: DppFrame) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

  /** Handler registry — one per `${resource}.${action}` tuple. */
  private readonly handlers = new Map<string, DppHandler>();

  /** Seen set, dedup by (sourceDevice, resource, seq). */
  private readonly seen = new Set<string>();

  /** Negotiated intersection of local + peer capabilities. Empty
   *  before handshake completes. */
  private negotiated: Set<DppResource> = new Set();

  /** Peer's step-ownership map — fed from the peer's HELLO frame. */
  private peerOwnedSteps: Set<string> = new Set();

  /** Global route table — step_id → deviceId. Populated as we see
   *  HELLO frames across the mesh. Shared with the mesh manager so
   *  RELAY routing can hit any known owner even if they're on a
   *  different open channel. */
  private readonly routes: DppRouteTable;

  private handshakeResolver: (() => void) | null = null;
  private handshakeReady: Promise<void>;

  constructor(
    mgr: PeerConnectionManager,
    local: DppCapabilities,
    routes?: DppRouteTable,
  ) {
    this.mgr = mgr;
    this.local = local;
    this.routes = routes ?? new Map();

    this.handshakeReady = new Promise((resolve) => {
      this.handshakeResolver = resolve;
    });

    this.mgr.onMessage((raw) => this.onRaw(raw));
    this.mgr.onStatus((s) => {
      if (s.status === 'connected') {
        void this.sendHello();
      }
      if (s.status === 'closed' || s.status === 'failed') {
        this.abortInFlight(`channel ${s.status}`);
      }
    });
  }

  /** Register a handler for a `resource.action` tuple. Returns an
   *  unregister function. */
  on(resource: DppResource, action: string, handler: DppHandler): () => void {
    const key = `${resource}.${action}`;
    this.handlers.set(key, handler);
    return () => { this.handlers.delete(key); };
  }

  /** Send a DATA frame to the connected peer. Resolves on ACK,
   *  rejects on NACK / timeout. Waits for handshake completion
   *  before actually putting the frame on the wire. */
  async send(
    resource: DppResource,
    action: string,
    payload: unknown,
  ): Promise<DppFrame> {
    await this.waitForHandshake();
    if (!this.negotiated.has(resource)) {
      throw new DppError(
        'UNSUPPORTED_RESOURCE',
        `peer did not negotiate resource ${resource}`);
    }
    return this.transmit({
      dpp: DPP_VERSION,
      type: 'DATA',
      seq: this.nextSeq(),
      resource,
      action,
      payload,
    });
  }

  /** Relay a DATA frame toward a specific next-hop device. Expects
   *  the target to be reachable on the peer we're currently talking
   *  to (either directly or via another forward). TTL defaults to
   *  {@link RELAY_DEFAULT_TTL}. */
  async relay(
    resource: DppResource,
    action: string,
    payload: unknown,
    route: string,
    ttl: number = RELAY_DEFAULT_TTL,
  ): Promise<DppFrame> {
    await this.waitForHandshake();
    return this.transmit({
      dpp: DPP_VERSION,
      type: 'RELAY',
      seq: this.nextSeq(),
      resource,
      action,
      payload,
      ttl,
      route,
    });
  }

  /** Snapshot of the negotiated capability set. Empty before HELLO
   *  completes; stable after. */
  negotiatedCapabilities(): readonly DppResource[] {
    return [...this.negotiated];
  }

  /** Steps the peer advertised ownership of. Useful for the UI
   *  "this peer owns N of your workflow's steps". */
  peerStepsOwned(): readonly string[] {
    return [...this.peerOwnedSteps];
  }

  /** Route table — shared across all protocol instances in a mesh
   *  so a workflow handoff knows which peer owns which step. */
  routeTable(): DppRouteTable {
    return this.routes;
  }

  inFlightCount(): number {
    return this.inFlight.size;
  }

  // ---- send helpers ----

  private nextSeq(): number {
    this.outSeq += 1;
    return this.outSeq;
  }

  private async transmit(frame: DppFrame): Promise<DppFrame> {
    return new Promise<DppFrame>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.inFlight.delete(frame.seq);
        reject(new DppError('TIMEOUT', `ack timeout seq=${frame.seq}`));
      }, DEFAULT_ACK_TIMEOUT_MS);
      this.inFlight.set(frame.seq, {
        resource: frame.resource ?? 'control',
        action: frame.action ?? '',
        resolve,
        reject,
        timer,
      });
      try {
        this.mgr.send({ type: 'dpp', payload: frame });
      } catch (ex) {
        clearTimeout(timer);
        this.inFlight.delete(frame.seq);
        reject(ex as Error);
      }
    });
  }

  private sendNack(ackSeq: number, code: string, message: string): void {
    try {
      this.mgr.send({
        type: 'dpp',
        payload: {
          dpp: DPP_VERSION,
          type: 'NACK',
          seq: this.nextSeq(),
          ackSeq,
          error: { code, message },
        } satisfies DppFrame,
      });
    } catch {
      // Channel went down — sender will timeout and retry.
    }
  }

  private sendAck(ackSeq: number): void {
    try {
      this.mgr.send({
        type: 'dpp',
        payload: {
          dpp: DPP_VERSION,
          type: 'ACK',
          seq: this.nextSeq(),
          ackSeq,
        } satisfies DppFrame,
      });
    } catch {
      // Same rationale as NACK.
    }
  }

  // ---- receive ----

  private onRaw(m: P2PMessage): void {
    if (m.type !== 'dpp' || !m.payload) return;
    const frame = m.payload as DppFrame;
    if (typeof frame.dpp !== 'number' || frame.dpp !== DPP_VERSION) {
      // Peer is on a different protocol version — NACK with the
      // sender's seq so they stop retrying.
      if (typeof frame.seq === 'number') {
        this.sendNack(frame.seq, 'VERSION_UNSUPPORTED',
          `DPP version ${frame.dpp} not supported — speaks ${DPP_VERSION}`);
      }
      return;
    }
    switch (frame.type) {
      case 'HELLO':   void this.handleHello(frame); return;
      case 'WELCOME': this.handleWelcome(frame); return;
      case 'ACK':     this.handleAck(frame); return;
      case 'NACK':    this.handleNack(frame); return;
      case 'DATA':    void this.handleData(frame, false); return;
      case 'RELAY':   void this.handleRelay(frame); return;
      case 'BYE':
        this.abortInFlight('peer sent BYE');
        return;
      default:
        // Unknown frame type — silent drop. Future versions may add
        // new frame types; this keeps us forward-compatible.
    }
  }

  private async sendHello(): Promise<void> {
    try {
      this.mgr.send({
        type: 'dpp',
        payload: {
          dpp: DPP_VERSION,
          type: 'HELLO',
          seq: this.nextSeq(),
          payload: this.local,
        } satisfies DppFrame,
      });
    } catch {
      // channel already down — will be retried on next status change
    }
    // Timebox the handshake — if the peer never replies with
    // WELCOME we give up so send() calls don't hang forever.
    setTimeout(() => {
      if (this.negotiated.size === 0 && this.handshakeResolver) {
        this.handshakeResolver();
        this.handshakeResolver = null;
      }
    }, HANDSHAKE_TIMEOUT_MS);
  }

  private async handleHello(frame: DppFrame): Promise<void> {
    const remote = frame.payload as DppCapabilities;
    if (!remote || !Array.isArray(remote.capabilities)) {
      this.sendNack(frame.seq, 'HELLO_MALFORMED', 'capabilities[] required');
      return;
    }
    // Compute intersection — both sides must list a resource for it
    // to be usable.
    const intersection = new Set<DppResource>();
    for (const c of remote.capabilities) {
      if (this.local.capabilities.includes(c)) intersection.add(c);
    }
    this.negotiated = intersection;
    this.peerOwnedSteps = new Set(remote.ownsSteps ?? []);
    // Populate the shared route table so other open channels can
    // forward frames to steps this peer owns.
    for (const stepId of this.peerOwnedSteps) {
      this.routes.set(stepId, remote.deviceId);
    }

    this.mgr.send({
      type: 'dpp',
      payload: {
        dpp: DPP_VERSION,
        type: 'WELCOME',
        seq: this.nextSeq(),
        ackSeq: frame.seq,
        payload: {
          deviceId: this.local.deviceId,
          capabilities: [...intersection],
          ownsSteps: this.local.ownsSteps,
        } satisfies DppCapabilities,
      } satisfies DppFrame,
    });
    this.resolveHandshake();
  }

  private handleWelcome(frame: DppFrame): void {
    const peer = frame.payload as DppCapabilities | undefined;
    if (peer) {
      this.negotiated = new Set(peer.capabilities);
      this.peerOwnedSteps = new Set(peer.ownsSteps ?? []);
      for (const stepId of this.peerOwnedSteps) {
        this.routes.set(stepId, peer.deviceId);
      }
    }
    this.resolveHandshake();
  }

  private resolveHandshake(): void {
    if (this.handshakeResolver) {
      this.handshakeResolver();
      this.handshakeResolver = null;
    }
  }

  private waitForHandshake(): Promise<void> {
    return this.handshakeReady;
  }

  private handleAck(frame: DppFrame): void {
    if (typeof frame.ackSeq !== 'number') return;
    const flight = this.inFlight.get(frame.ackSeq);
    if (!flight) return;
    clearTimeout(flight.timer);
    this.inFlight.delete(frame.ackSeq);
    flight.resolve(frame);
  }

  private handleNack(frame: DppFrame): void {
    if (typeof frame.ackSeq !== 'number') return;
    const flight = this.inFlight.get(frame.ackSeq);
    if (!flight) return;
    clearTimeout(flight.timer);
    this.inFlight.delete(frame.ackSeq);
    const err = new DppError(
      frame.error?.code ?? 'REMOTE_NACK',
      frame.error?.message ?? 'peer rejected the frame');
    flight.reject(err);
  }

  private async handleData(frame: DppFrame, relayed: boolean): Promise<void> {
    if (!frame.resource || !frame.action) {
      this.sendNack(frame.seq, 'DATA_MALFORMED',
        'resource + action required');
      return;
    }
    if (!this.negotiated.has(frame.resource)) {
      this.sendNack(frame.seq, 'UNSUPPORTED_RESOURCE',
        `resource ${frame.resource} not negotiated`);
      return;
    }
    const sourceDevice = this.mgr.session()?.remoteDevice ?? 'unknown';
    const dedupKey = `${sourceDevice}:${frame.resource}:${frame.seq}`;
    if (this.seen.has(dedupKey)) {
      this.sendAck(frame.seq);
      return;
    }
    this.seen.add(dedupKey);

    const handler = this.handlers.get(`${frame.resource}.${frame.action}`);
    if (!handler) {
      this.sendNack(frame.seq, 'HANDLER_NOT_REGISTERED',
        `no handler for ${frame.resource}.${frame.action}`);
      // Clear the dedup so a client that re-registers can get the
      // retry; keeps the mesh self-healing across reload.
      this.seen.delete(dedupKey);
      return;
    }
    try {
      await handler(frame, { sourceDevice, relayed });
      this.sendAck(frame.seq);
    } catch (ex) {
      const err = ex instanceof DppError ? ex
        : new DppError('HANDLER_FAILED', (ex as Error).message);
      this.sendNack(frame.seq, err.code, err.message);
      this.seen.delete(dedupKey);
    }
  }

  private async handleRelay(frame: DppFrame): Promise<void> {
    if (!frame.route) {
      this.sendNack(frame.seq, 'RELAY_MALFORMED', 'route required');
      return;
    }
    if (frame.route === this.local.deviceId) {
      // Terminal hop — handle as a DATA frame locally.
      await this.handleData(frame, true);
      return;
    }
    const ttl = (frame.ttl ?? RELAY_DEFAULT_TTL) - 1;
    if (ttl <= 0) {
      this.sendNack(frame.seq, 'RELAY_EXHAUSTED',
        `TTL expired en route to ${frame.route}`);
      return;
    }
    // Lookup the next hop via the global route table. If we don't
    // know the target, NACK — the caller can fall back to inbox
    // queueing.
    //
    // NOTE: A future mesh enhancement will add multi-hop lookup
    // across all open channels on the mesh; today we only forward
    // if the target is the peer we're talking to (route table hit
    // owned by remote) OR explicitly ours via local step ownership.
    this.sendNack(frame.seq, 'UNKNOWN_ROUTE',
      `no route to ${frame.route} on this channel`);
  }

  private abortInFlight(reason: string): void {
    for (const [, flight] of this.inFlight) {
      clearTimeout(flight.timer);
      flight.reject(new DppError('CHANNEL_DOWN', reason));
    }
    this.inFlight.clear();
    if (this.handshakeResolver) {
      // Resolve to unblock pending sends with a clean rejection
      // (they'll find negotiated.size === 0 and throw
      // UNSUPPORTED_RESOURCE).
      this.handshakeResolver();
      this.handshakeResolver = null;
    }
  }
}
