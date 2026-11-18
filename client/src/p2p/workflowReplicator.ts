import { DerPeerProtocol, DppError } from './derPeerProtocol';
import type { PeerConnectionManager } from './peerConnection';

/**
 * Workflow DEFINITION handoff over DPP/1. This replicator covers the
 * "I just designed a new capture workflow, please review on your
 * device" flow — distinct from {@link WorkflowHandoff} which covers
 * the per-step baton for a RUNNING workflow.
 *
 * <p>Resource {@code workflow}, action {@code push}: sender fetches
 * the canonical JSON from
 * {@code GET /edge-api/v1/workflows/{id}/export}, ships it as the
 * payload, receiver POSTs to its own
 * {@code /edge-api/v1/workflows/import?inbox=true} so the receiving
 * operator reviews + accepts in the normal flow — the sender cannot
 * blind-write another operator's edge.</p>
 *
 * <p>DPP/1 features used here:
 * <ul>
 *   <li>NACK with error.code when the receiver's inbox write fails
 *       — surfaces as a clear error in the sender's UI instead of
 *       silently succeeding as the old P2PProtocol did.</li>
 *   <li>UNSUPPORTED_RESOURCE check: a peer that opted out of
 *       workflow pushes (e.g. a kiosk) never gets probed.</li>
 *   <li>Shared handshake with the journal + metadata replicators via
 *       one DerPeerProtocol per session.</li>
 * </ul></p>
 */

export interface PushWorkflowResult {
  readonly workflowId: string;
  readonly importId?: string;
  readonly displayName?: string;
  readonly status: 'accepted' | 'failed';
  readonly error?: string;
}

export class WorkflowReplicator {
  private readonly dpp: DerPeerProtocol;
  private readonly mgr: PeerConnectionManager;
  private readonly seen = new Set<string>();

  constructor(mgr: PeerConnectionManager, dpp: DerPeerProtocol) {
    this.mgr = mgr;
    this.dpp = dpp;
    this.dpp.on('workflow', 'push', async (frame, ctx) => {
      await this.applyIncoming(frame.payload, ctx.sourceDevice);
    });
  }

  async push(workflowId: string, fromLabel: string): Promise<PushWorkflowResult> {
    const session = this.mgr.session();
    if (!session || session.status !== 'connected') {
      throw new Error(
        `cannot push — channel status ${session?.status ?? 'none'}`);
    }
    const resp = await fetch(
      `/edge-api/v1/workflows/${encodeURIComponent(workflowId)}/export`,
      { method: 'GET', credentials: 'include',
        headers: { Accept: 'application/json' } });
    if (!resp.ok) {
      return {
        workflowId,
        status: 'failed',
        error: `local export -> HTTP ${resp.status}`,
      };
    }
    const canonical = await resp.json() as unknown;
    try {
      await this.dpp.send('workflow', 'push', {
        workflowId, fromLabel, canonical,
      });
      return { workflowId, status: 'accepted' };
    } catch (ex) {
      return {
        workflowId,
        status: 'failed',
        error: ex instanceof DppError
          ? `${ex.code}: ${ex.message}`
          : (ex as Error).message,
      };
    }
  }

  protocol(): DerPeerProtocol {
    return this.dpp;
  }

  // ---- receiver ----

  private async applyIncoming(raw: unknown, sourceDevice: string): Promise<void> {
    const entry = raw as {
      workflowId?: string;
      fromLabel?: string;
      canonical?: unknown;
    } | null;
    if (!entry || !entry.workflowId || !entry.canonical) {
      throw new DppError('PAYLOAD_MALFORMED',
        'workflow.push requires {workflowId, fromLabel, canonical}');
    }
    const dedupKey = `${sourceDevice}:${entry.workflowId}`;
    if (this.seen.has(dedupKey)) {
      return;
    }
    this.seen.add(dedupKey);

    const fromLabel = entry.fromLabel ?? sourceDevice.slice(0, 8);
    const query = `?inbox=true&fromLabel=${encodeURIComponent(fromLabel)}`;
    const resp = await fetch(`/edge-api/v1/workflows/import${query}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-DER-Device-Id': this.mgr.session()?.localDevice ?? '',
        'X-DER-On-Behalf-Of': sourceDevice,
      },
      body: JSON.stringify(entry.canonical),
    });
    if (!resp.ok) {
      this.seen.delete(dedupKey);
      throw new DppError('INBOX_IMPORT_FAILED',
        `workflow inbox -> HTTP ${resp.status}`);
    }
  }
}
