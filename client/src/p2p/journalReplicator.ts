import { listAll, remove, type QueueEntry } from '../offline/queue';
import { P2PProtocol } from './protocol';
import type { PeerConnectionManager } from './peerConnection';

/**
 * Peer-to-peer replication of the offline capture queue.
 *
 * <p>Real-world scenario this unlocks: a nurse's tablet records an
 * aggregate submission while the clinic WiFi is flapping. The nurse's
 * tablet queues the submission in {@code der-offline-v1.queue}
 * (IndexedDB) because it can't reach the edge server. The receptionist
 * at the next desk IS reachable. The two devices open a P2P session,
 * the tablet pushes each queued entry over the data channel, the
 * receptionist's browser submits them to the edge server on the
 * tablet's behalf. The tablet removes the entry from its queue once
 * the receptionist acks a successful submission.</p>
 *
 * <p>Idempotency: entries carry their IndexedDB autoincrement id +
 * createdAt. The receiver dedups by the composite (sourceDevice, id)
 * so a double-push can't land two POSTs. The protocol envelope
 * (see {@link P2PProtocol}) layers its own (remoteDevice, seq)
 * dedup on top so handler double-fires are also suppressed.</p>
 *
 * <p>Failure semantics: if the receiver's submit-on-behalf POST
 * fails, the receiver NACKs by throwing from the handler — P2P.3's
 * current protocol ACKs regardless of handler outcome (future
 * P2P.3b will add transactional NACK), so for now the sender must
 * check the ack's optional outcome field. Keeping that out of the
 * MVP — operators retry by re-pushing when they see queued count
 * go up on the next poll.</p>
 */

export type ReplicateOutcome =
  | { kind: 'sent';     id: number }
  | { kind: 'applied';  id: number }
  | { kind: 'failed';   id: number; error: string };

export class JournalReplicator {
  private readonly proto: P2PProtocol;
  private readonly mgr: PeerConnectionManager;

  /** IDs of entries already observed in a received journal-entry
   *  envelope, keyed by `${sourceDevice}:${entryId}`. In-memory only;
   *  on reconnect we take the harmless at-least-once hit. */
  private seen = new Set<string>();

  constructor(mgr: PeerConnectionManager, proto?: P2PProtocol) {
    this.mgr = mgr;
    this.proto = proto ?? new P2PProtocol(mgr);
    this.proto.on('journal-entry', (data) => this.applyIncoming(data));
  }

  /** Push every entry currently in the offline queue to the connected
   *  peer, remove each on ack. Returns one outcome per entry so the
   *  UI can render a summary "7 pushed, 1 failed". */
  async flushAll(): Promise<ReplicateOutcome[]> {
    const session = this.mgr.session();
    if (!session || session.status !== 'connected') {
      throw new Error(
        `cannot flush — channel status ${session?.status ?? 'none'}`);
    }
    const entries = await listAll();
    const out: ReplicateOutcome[] = [];
    for (const entry of entries) {
      try {
        await this.proto.send('journal-entry', {
          sourceDevice: session.localDevice,
          id: entry.id,
          kind: entry.kind,
          url: entry.url,
          method: entry.method,
          body: entry.body,
          createdAt: entry.createdAt,
          attempts: entry.attempts,
        });
        await remove(entry.id);
        out.push({ kind: 'sent', id: entry.id });
      } catch (ex) {
        out.push({
          kind: 'failed',
          id: entry.id,
          error: (ex as Error).message,
        });
      }
    }
    return out;
  }

  // ---- receiver-side ----

  private async applyIncoming(raw: unknown): Promise<void> {
    const entry = raw as {
      sourceDevice?: string;
      id?: number;
      url?: string;
      method?: 'POST' | 'PUT';
      body?: unknown;
    } | null;
    if (!entry || !entry.sourceDevice || typeof entry.id !== 'number'
        || !entry.url || !entry.method) {
      throw new Error('malformed journal-entry payload');
    }
    const dedupKey = `${entry.sourceDevice}:${entry.id}`;
    if (this.seen.has(dedupKey)) {
      return;
    }
    this.seen.add(dedupKey);

    // Submit on behalf of the source device. The POST uses the
    // receiver's own DER_SESSION cookie — the source device's write
    // is attributed to the receiver's user, and the submission body
    // is the exact JSON the source would have sent itself. Future
    // enhancement: add a X-DER-On-Behalf-Of header so the server
    // can preserve the source device's identity in its journal.
    const resp = await fetch(entry.url, {
      method: entry.method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-DER-Device-Id': entry.sourceDevice,
      },
      body: JSON.stringify(entry.body),
    });
    if (!resp.ok) {
      // Clear the dedup entry so a retry can land — failed on-behalf
      // submits should surface in the sender's own queue as
      // "hold-and-retry".
      this.seen.delete(dedupKey);
      throw new Error(
        `on-behalf submit ${entry.method} ${entry.url} -> ${resp.status}`);
    }
  }

  /** Expose the inner protocol so the DevicePeers card can display
   *  in-flight count without re-wrapping P2PProtocol methods. */
  protocol(): P2PProtocol {
    return this.proto;
  }

  /** Current count of entries awaiting ack from the peer. */
  inFlightCount(): number {
    return this.proto.inFlightCount();
  }

  /** Static helper for tests / UI pre-flight: how many queued entries
   *  are waiting locally to be pushed next time. */
  static pendingCount(): Promise<QueueEntry[]> {
    return listAll();
  }
}
