import type { PeerConnectionManager } from './peerConnection';
import { DerPeerProtocol, type DppCapabilities, type DppRouteTable } from './derPeerProtocol';

/**
 * Workflow handoff over DPP/1 — the DER-native distributed-workflow
 * baton as described in ADR-0038.
 *
 * <p>Clinic reality: a patient's visit is one {@code capture_workflow_run}
 * threaded through N steps; each step's {@code owner_device_id} picks
 * the service point (nurse's tablet, doctor's laptop, lab-tech
 * workstation, pharmacy screen). Today the baton can only pass if
 * every service point can reach the edge server. With this
 * replicator, the baton rides the WebRTC mesh: whichever device
 * completes step K auto-sends the contribution to the device owning
 * step K+1, who auto-applies and advances the run.</p>
 *
 * <p>Message flow:
 * <pre>
 *   Device A completes step K on run R
 *       │
 *       ├─▶ pushRunAdvance(R, K, contribution, nextOwner=B)
 *       │
 *       ▼
 *   DPP frame: resource=workflow action=run-advance
 *       │                                    payload={runId, workflowId,
 *       │                                             completedStep, nextStep,
 *       │                                             nextOwner, contribution,
 *       │                                             businessKey}
 *       ▼
 *   If connected directly to B → DATA frame; B applies locally.
 *   If B not directly connected → RELAY frame to a known intermediary.
 *   If no route → ACK status=queued; sender keeps the contribution
 *                 locally for later drain.
 * </pre>
 */

export interface RunAdvancePayload {
  readonly runId: string;
  readonly workflowId: string;
  readonly completedStep: string;
  readonly nextStep: string | null;
  readonly nextOwner: string | null;
  readonly contribution: unknown;
  readonly businessKey: string;
  /** Optional full run state — set when the receiver might be a
   *  cold catch-up (first time seeing this run). */
  readonly runSnapshot?: unknown;
}

export interface HandoffResult {
  readonly runId: string;
  readonly status: 'applied' | 'relayed' | 'queued' | 'failed';
  readonly error?: string;
}

export interface DppLookup {
  /** Returns the DerPeerProtocol bound to a session with the given
   *  remote device, or null if no such session exists. Used for
   *  mesh-wide RELAY routing in DPP.3 — when the current channel's
   *  peer isn't the next-step owner, we hop through whichever
   *  session reaches the owner directly. */
  readonly dppFor: (deviceId: string) => DerPeerProtocol | null;
}

export class WorkflowHandoff {
  private readonly dpp: DerPeerProtocol;
  private readonly mgr: PeerConnectionManager;
  private readonly lookup: DppLookup | null;

  constructor(
    mgr: PeerConnectionManager,
    local: DppCapabilities,
    routes?: DppRouteTable,
    dpp?: DerPeerProtocol,
    lookup?: DppLookup,
  ) {
    this.mgr = mgr;
    this.dpp = dpp ?? new DerPeerProtocol(mgr, local, routes);
    this.lookup = lookup ?? null;
    this.dpp.on('workflow', 'run-advance',
      (frame, ctx) => this.applyIncoming(
        frame.payload as RunAdvancePayload, ctx.sourceDevice));
  }

  /** Push a step-complete event to the peer currently on the other
   *  end of the channel. If the peer owns {@code nextOwner}'s step
   *  it applies locally; otherwise it NACKs with routing info and
   *  the caller falls back to inbox queueing.
   *
   *  Returns one {@link HandoffResult} describing what happened. */
  async pushRunAdvance(payload: RunAdvancePayload): Promise<HandoffResult> {
    try {
      await this.dpp.send('workflow', 'run-advance', payload);
      return { runId: payload.runId, status: 'applied' };
    } catch (ex) {
      const code = (ex as { code?: string }).code ?? 'FAILED';
      if (code === 'UNKNOWN_ROUTE' || code === 'RELAY_EXHAUSTED') {
        // Caller should queue in workflow_import_inbox for later.
        return {
          runId: payload.runId,
          status: 'queued',
          error: (ex as Error).message,
        };
      }
      return {
        runId: payload.runId,
        status: 'failed',
        error: (ex as Error).message,
      };
    }
  }

  protocol(): DerPeerProtocol {
    return this.dpp;
  }

  // ---- receiver ----

  /**
   * Apply an incoming {@link RunAdvancePayload} according to the
   * ADR-0038 flow:
   *
   * <ol>
   *   <li>If {@code nextOwner === localDeviceId} → POST the
   *       contribution to our own DER server, advance the run.</li>
   *   <li>If {@code nextOwner} is a step we know is owned by another
   *       peer in the mesh → re-send as a RELAY frame to that peer.</li>
   *   <li>Otherwise → POST to the local workflow_import_inbox as
   *       PENDING with the nextOwner metadata; drain when that peer
   *       comes online.</li>
   * </ol>
   */
  private async applyIncoming(
    payload: RunAdvancePayload,
    sourceDevice: string,
  ): Promise<void> {
    const localDevice = this.mgr.session()?.localDevice;
    if (!payload || !payload.runId) {
      throw new DppishError('PAYLOAD_MALFORMED',
        'runId required on run-advance');
    }

    if (payload.nextOwner && payload.nextOwner === localDevice) {
      // Case 1 — we own the next step. Apply locally.
      await this.applyLocally(payload, sourceDevice);
      return;
    }

    if (payload.nextOwner && payload.nextStep) {
      const route = this.dpp.routeTable().get(payload.nextStep)
        ?? payload.nextOwner;
      if (route && route !== localDevice) {
        // Case 2 — a peer in the mesh owns the next step. Prefer
        // the session that peer is directly on (true one-hop relay);
        // fall back to the current channel's dpp when we don't have
        // a direct session but the broker might route further.
        const targetDpp = this.lookup?.dppFor(route) ?? this.dpp;
        try {
          await targetDpp.relay('workflow', 'run-advance', payload, route);
          return;
        } catch {
          // Fall through to Case 3 — queue locally for the owner to
          // pick up when they reconnect.
        }
      }
    }

    // Case 3 — park in the import inbox so the eventual owner picks
    // it up when the mesh brings them online. The existing inbox
    // review flow (CaptureWorkflowController /import-inbox) handles
    // apply when the operator accepts.
    await this.queueToInbox(payload, sourceDevice);
  }

  private async applyLocally(
    payload: RunAdvancePayload,
    sourceDevice: string,
  ): Promise<void> {
    const url = `/edge-api/v1/workflows/runs/${encodeURIComponent(payload.runId)}/contributions`;
    const resp = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-DER-Device-Id': this.mgr.session()?.localDevice ?? '',
        'X-DER-On-Behalf-Of': sourceDevice,
      },
      body: JSON.stringify({
        stepId: payload.completedStep,
        payload: payload.contribution,
        businessKey: payload.businessKey,
      }),
    });
    if (!resp.ok) {
      throw new DppishError('CONTRIBUTION_FAILED',
        `POST ${url} -> HTTP ${resp.status}`);
    }
  }

  private async queueToInbox(
    payload: RunAdvancePayload,
    sourceDevice: string,
  ): Promise<void> {
    const fromLabel = `relay-${sourceDevice.slice(0, 8)}`;
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
      body: JSON.stringify({
        runId: payload.runId,
        workflowId: payload.workflowId,
        completedStep: payload.completedStep,
        nextStep: payload.nextStep,
        nextOwner: payload.nextOwner,
        contribution: payload.contribution,
        businessKey: payload.businessKey,
        snapshot: payload.runSnapshot,
      }),
    });
    if (!resp.ok) {
      throw new DppishError('INBOX_QUEUE_FAILED',
        `inbox queue -> HTTP ${resp.status}`);
    }
  }
}

/** Thrown-and-rethrown error carrying a DPP-style code; the
 *  surrounding {@link DerPeerProtocol#handleData} catch-site unwraps
 *  this into a {@code NACK} back to the sender. */
class DppishError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'DppishError';
  }
}
