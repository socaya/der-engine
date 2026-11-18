import { listAll, remove, type QueueEntry } from '../offline/queue';
import { DerPeerProtocol, DppError } from './derPeerProtocol';
import type { PeerConnectionManager } from './peerConnection';

/**
 * Peer-to-peer replication of the offline capture queue, migrated to
 * DPP/1 (ADR-0038). Resource {@code journal}, action {@code write}:
 * each in-flight entry is one frame, sender awaits ACK/NACK per
 * item.
 *
 * <p>Clinic scenario (unchanged from P2P.4): a nurse's tablet records
 * an aggregate submission while the clinic WiFi flaps. The nurse's
 * tablet queues the submission in {@code der-offline-v1.queue}
 * because the edge server is unreachable. The receptionist next door
 * IS reachable. The two devices open a P2P session, DPP/1 handshakes,
 * the tablet flushes each queued entry over the data channel, the
 * receptionist's browser submits them to the edge server with
 * {@code X-DER-On-Behalf-Of: <nurse>} so attribution + audit stay
 * faithful to the source device.</p>
 *
 * <p>What DPP/1 gives us over the old envelope:
 * <ul>
 *   <li>Real NACK when the receiver's submit-on-behalf fails — the
 *       sender's queue entry stays, operator sees a clear retry
 *       signal (previously the old protocol always ACKed, even on
 *       handler failure, so the entry was lost).</li>
 *   <li>Capability check: a peer that can't receive journal writes
 *       (older release / hardened kiosk) NACKs on handshake, we
 *       don't even try the push.</li>
 *   <li>One protocol instance per session shared with the workflow
 *       + metadata replicators, so the per-session HELLO handshake
 *       only runs once.</li>
 * </ul></p>
 */

export type ReplicateOutcome =
  | { kind: 'sent';    id: number }
  | { kind: 'failed';  id: number; error: string };

export class JournalReplicator {
  private readonly dpp: DerPeerProtocol;
  private readonly mgr: PeerConnectionManager;
  private readonly seen = new Set<string>();

  constructor(mgr: PeerConnectionManager, dpp: DerPeerProtocol) {
    this.mgr = mgr;
    this.dpp = dpp;
    this.dpp.on('journal', 'write', async (frame, ctx) => {
      await this.applyIncoming(frame.payload, ctx.sourceDevice);
    });
  }

  /** Push every entry currently in the offline queue to the connected
   *  peer, remove each on ACK, leave each on NACK / timeout for
   *  retry. Returns one outcome per entry so the UI can render a
   *  summary "7 pushed, 1 failed". */
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
        await this.dpp.send('journal', 'write', {
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
          error: ex instanceof DppError
            ? `${ex.code}: ${ex.message}`
            : (ex as Error).message,
        });
      }
    }
    return out;
  }

  // ---- receiver ----

  private async applyIncoming(raw: unknown, sourceDevice: string): Promise<void> {
    const entry = raw as {
      sourceDevice?: string;
      id?: number;
      url?: string;
      method?: 'POST' | 'PUT';
      body?: unknown;
    } | null;
    if (!entry || !entry.sourceDevice || typeof entry.id !== 'number'
        || !entry.url || !entry.method) {
      throw new DppError('PAYLOAD_MALFORMED',
        'journal.write requires {sourceDevice, id, url, method, body}');
    }
    const dedupKey = `${entry.sourceDevice}:${entry.id}`;
    if (this.seen.has(dedupKey)) {
      return;
    }
    this.seen.add(dedupKey);

    const resp = await fetch(entry.url, {
      method: entry.method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-DER-Device-Id': this.mgr.session()?.localDevice ?? '',
        'X-DER-On-Behalf-Of': sourceDevice,
      },
      body: JSON.stringify(entry.body),
    });
    if (!resp.ok) {
      this.seen.delete(dedupKey);
      throw new DppError('ON_BEHALF_SUBMIT_FAILED',
        `${entry.method} ${entry.url} -> HTTP ${resp.status}`);
    }
  }

  /** Expose the underlying protocol so the UI can show in-flight
   *  count on the session card. */
  protocol(): DerPeerProtocol {
    return this.dpp;
  }

  static pendingCount(): Promise<QueueEntry[]> {
    return listAll();
  }
}
