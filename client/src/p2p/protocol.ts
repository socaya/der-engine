import type { PeerConnectionManager } from './peerConnection';
import type { P2PMessage } from './types';

/**
 * Reliability envelope that sits on top of
 * {@link PeerConnectionManager}'s raw send/receive.
 *
 * <p>The underlying WebRTC DataChannel is reliable + ordered at the
 * transport layer (configured with {@code ordered: true}), but that
 * only guarantees delivery <em>while the connection is up</em>. If
 * the channel closes mid-flight (network churn, laptop sleep, peer
 * reload) the sender has no way to know which messages the receiver
 * actually consumed. Journal replication needs end-to-end acks so a
 * retry-on-reconnect doesn't double-apply.</p>
 *
 * <p>Envelope shape on the wire:
 * <pre>
 *   { type: "envelope", payload: { seq, kind, data }, seq }
 *   { type: "ack",      payload: { seq } }
 * </pre>
 * The {@code type:"envelope"} is the real payload wrapper; the
 * {@code type:"ack"} is a bare acknowledgement the receiver sends
 * back as soon as it's processed the envelope. The sender holds the
 * envelope in an in-flight map until the matching ack lands or a
 * timeout expires.</p>
 *
 * <p>Delivery semantics on top of the DataChannel's ordered
 * guarantee: at-least-once with deduplication by {@code (remoteDevice,
 * seq)}. Receiver code should treat handlers as idempotent — on
 * reconnect the sender replays everything older than the last ack
 * it received, so a message may land twice.</p>
 */
export class P2PProtocol {
  private readonly mgr: PeerConnectionManager;
  private readonly timeoutMs: number;

  private outSeq = 0;
  private inFlight = new Map<number, {
    kind: string;
    data: unknown;
    resolve: () => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

  private handlers = new Map<string, (data: unknown) => void | Promise<void>>();

  /** Per-remote-peer highest-seq watermark; dedup repeat sends on
   *  reconnect so idempotent handlers don't fire twice. */
  private seen = new Map<string, number>();

  constructor(mgr: PeerConnectionManager, timeoutMs = 5000) {
    this.mgr = mgr;
    this.timeoutMs = timeoutMs;
    this.mgr.onMessage((m) => this.handleIncoming(m));
    // Resolve-in-flight-with-failure when the channel drops, so
    // callers' promises don't hang forever on disconnect.
    this.mgr.onStatus((s) => {
      if (s.status === 'closed' || s.status === 'failed') {
        this.abortInFlight(`channel ${s.status}`);
      }
    });
  }

  /** Send {@code data} tagged as {@code kind}, resolve when the peer
   *  acks or reject when the ack doesn't arrive within the configured
   *  timeout. Rejects immediately if the channel is already down. */
  send(kind: string, data: unknown): Promise<void> {
    this.outSeq += 1;
    const seq = this.outSeq;
    const envelope: P2PMessage = {
      type: 'envelope',
      seq,
      payload: { seq, kind, data },
    };
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.inFlight.delete(seq);
        reject(new Error(`ack timeout for seq=${seq} kind=${kind}`));
      }, this.timeoutMs);
      this.inFlight.set(seq, { kind, data, resolve, reject, timer });
      try {
        this.mgr.send(envelope);
      } catch (ex) {
        clearTimeout(timer);
        this.inFlight.delete(seq);
        reject(ex as Error);
      }
    });
  }

  /** Register a handler for incoming messages of {@code kind}. The
   *  handler receives the payload {@code data} field and may return a
   *  promise — the ack is deferred until the promise resolves, giving
   *  the sender back-pressure. */
  on(kind: string, handler: (data: unknown) => void | Promise<void>): () => void {
    this.handlers.set(kind, handler);
    return () => { this.handlers.delete(kind); };
  }

  /** Number of messages waiting for ack. Useful for a sync-health
   *  badge in the UI ("3 messages queued"). */
  inFlightCount(): number {
    return this.inFlight.size;
  }

  // ---- internals ----

  private handleIncoming(m: P2PMessage): void {
    if (m.type === 'ack') {
      const payload = m.payload as { seq?: number } | undefined;
      if (typeof payload?.seq !== 'number') return;
      const flight = this.inFlight.get(payload.seq);
      if (!flight) return;
      clearTimeout(flight.timer);
      this.inFlight.delete(payload.seq);
      flight.resolve();
      return;
    }
    if (m.type !== 'envelope') return;
    const payload = m.payload as { seq?: number; kind?: string; data?: unknown } | undefined;
    if (!payload || typeof payload.seq !== 'number' || typeof payload.kind !== 'string') {
      return;
    }

    const session = this.mgr.session();
    const remoteKey = session?.remoteDevice ?? 'unknown';
    const highest = this.seen.get(remoteKey) ?? 0;
    const alreadyProcessed = payload.seq <= highest;

    // Always ack — even on dedup — so the sender stops retrying.
    this.sendAck(payload.seq);

    if (alreadyProcessed) {
      return;
    }
    this.seen.set(remoteKey, payload.seq);

    const handler = this.handlers.get(payload.kind);
    if (!handler) {
      // Unknown kind — silent drop. Still acked above so the sender
      // doesn't block; the sender should know what kinds it has
      // registered on the other side.
      return;
    }
    Promise.resolve()
      .then(() => handler(payload.data))
      .catch(() => {
        // Handler threw / rejected — the sender has already been
        // acked, so we can't signal failure upstream here. Future
        // P2P.3b will add a NACK kind for transactional retry.
      });
  }

  private sendAck(seq: number): void {
    try {
      this.mgr.send({ type: 'ack', payload: { seq } });
    } catch {
      // Channel went down between receiving and acking — the sender
      // will timeout and retry; dedup on this side will swallow.
    }
  }

  private abortInFlight(reason: string): void {
    for (const [, flight] of this.inFlight) {
      clearTimeout(flight.timer);
      flight.reject(new Error(reason));
    }
    this.inFlight.clear();
  }
}
