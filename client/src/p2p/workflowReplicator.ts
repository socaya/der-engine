import { P2PProtocol } from './protocol';
import type { PeerConnectionManager } from './peerConnection';

/**
 * P2P workflow handoff — browser-to-browser equivalent of
 * {@code WorkflowPeerController.push()}, which today requires every
 * peer to have a routable {@code base_url} and HTTP creds in
 * {@code workflow_peer}. The P2P path drops both requirements: two
 * operator browsers negotiate a WebRTC data channel via the signaling
 * broker, exchange the canonical workflow doc directly, and the
 * receiver drops it into its own {@code workflow_import_inbox} for
 * review — all without either DER server being reachable from the
 * other.
 *
 * <p>Use case this unlocks: nurse on a tablet designs a draft capture
 * workflow in the field, wants to hand it to the supervisor's laptop
 * for review before publishing. Today the supervisor's laptop needs
 * to be addressable from the tablet (VPN / shared LAN / port-forward);
 * with P2P the two devices just open a session and push over the
 * data channel.</p>
 *
 * <p>Message shape:
 * <pre>
 *   kind: "workflow-push"
 *   data: {
 *     workflowId: string,
 *     fromLabel: string,          // display name of the source device
 *     canonical: CanonicalWorkflow // the full /workflows/{id}/export body
 *   }
 * </pre>
 * The receiver POSTs {@code canonical} to its local
 * {@code /edge-api/v1/workflows/import?inbox=true&fromLabel=<src>}
 * so the receiving operator can review + accept via the normal
 * import-inbox flow.</p>
 *
 * <p>Idempotency: dedup by {@code (sourceDevice, workflowId)} —
 * re-pushing the same workflow from the same source on a reconnect
 * doesn't spawn two inbox rows. Operators can force a replay by
 * closing + re-opening the session (dedup is in-memory).</p>
 */

export interface PushWorkflowResult {
  readonly workflowId: string;
  readonly importId?: string;
  readonly displayName?: string;
  readonly status: 'accepted' | 'failed';
  readonly error?: string;
}

export class WorkflowReplicator {
  private readonly proto: P2PProtocol;
  private readonly mgr: PeerConnectionManager;
  /** (sourceDevice:workflowId) → true once applied. */
  private readonly seen = new Set<string>();

  constructor(mgr: PeerConnectionManager, proto?: P2PProtocol) {
    this.mgr = mgr;
    this.proto = proto ?? new P2PProtocol(mgr);
    this.proto.on('workflow-push', (data) => this.applyIncoming(data));
  }

  /** Fetch the canonical JSON for {@code workflowId} from the local
   *  DER server, push it over the data channel to the peer, resolve
   *  when the peer acks (receiver may still reject during review). */
  async push(workflowId: string, fromLabel: string): Promise<PushWorkflowResult> {
    const session = this.mgr.session();
    if (!session || session.status !== 'connected') {
      throw new Error(
        `cannot push — channel status ${session?.status ?? 'none'}`);
    }
    // Pull canonical from local server — the same endpoint the
    // server-to-server push flow uses (CaptureWorkflowController
    // GET /{id}/export).
    const resp = await fetch(
      `/edge-api/v1/workflows/${encodeURIComponent(workflowId)}/export`,
      {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      },
    );
    if (!resp.ok) {
      throw new Error(`local export ${workflowId} -> HTTP ${resp.status}`);
    }
    const canonical = await resp.json() as unknown;
    try {
      await this.proto.send('workflow-push', {
        workflowId,
        fromLabel,
        canonical,
      });
      return { workflowId, status: 'accepted' };
    } catch (ex) {
      return {
        workflowId,
        status: 'failed',
        error: (ex as Error).message,
      };
    }
  }

  // ---- receiver ----

  private async applyIncoming(raw: unknown): Promise<void> {
    const entry = raw as {
      workflowId?: string;
      fromLabel?: string;
      canonical?: unknown;
    } | null;
    if (!entry || !entry.workflowId || !entry.canonical) {
      throw new Error('malformed workflow-push payload');
    }
    const sourceDevice = this.mgr.session()?.remoteDevice ?? 'unknown';
    const dedupKey = `${sourceDevice}:${entry.workflowId}`;
    if (this.seen.has(dedupKey)) {
      return;
    }
    this.seen.add(dedupKey);

    // POST to our own DER server's import inbox. inbox=true means the
    // receiving operator reviews + accepts in the import-inbox UI
    // before the workflow lands as a real capture_workflow row — the
    // sender can't blind-write another operator's edge.
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
      throw new Error(
        `inbox import ${entry.workflowId} -> HTTP ${resp.status}`);
    }
  }

  /** Expose the underlying protocol so the DevicePeers card can read
   *  inFlightCount() without re-wrapping P2PProtocol methods. */
  protocol(): P2PProtocol {
    return this.proto;
  }
}
