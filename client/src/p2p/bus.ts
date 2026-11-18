import type { PeerMeshManager } from './mesh';
import type { DerPeerProtocol, DppRouteTable } from './derPeerProtocol';
import type { HandoffResult, RunAdvancePayload } from './workflowHandoff';
import { WorkflowHandoff } from './workflowHandoff';

/**
 * Process-wide singleton the Peers screen registers its active mesh
 * with, so any part of the client (SSE listeners, Capture screens,
 * admin tools) can fire workflow baton events without reaching into
 * React component state.
 *
 * <p>Minimal on purpose: one mesh registration, one broadcast
 * function, one unregister. No React dependencies so plain-TS
 * modules (the SSE subscriber below) can call it.</p>
 */

export interface MeshRegistration {
  readonly mesh: PeerMeshManager;
  readonly localDeviceId: string;
  /** Lookup from sessionId → DerPeerProtocol. Lets broadcast reach
   *  every live session's protocol without the mesh having to know
   *  about DPP/1 directly. */
  readonly protocolBySession: Map<string, DerPeerProtocol>;
  readonly routeTable: DppRouteTable;
}

let active: MeshRegistration | null = null;

export function setActiveMesh(reg: MeshRegistration | null): void {
  active = reg;
}

export function activeMesh(): MeshRegistration | null {
  return active;
}

/**
 * Fire a workflow.run-advance frame through every live session. The
 * `WorkflowHandoff.applyIncoming` logic on the receiver side picks
 * the right action (apply / relay / queue), so this function is just
 * an outer fan-out loop. Returns one {@link HandoffResult} per
 * session so the caller can report per-peer status.
 *
 * <p>No-op when no mesh is registered (operator hasn't opened the
 * Peers screen yet) — returns an empty array so SSE subscribers
 * stay happy during boot.</p>
 */
export async function broadcastRunAdvance(
  payload: RunAdvancePayload,
): Promise<HandoffResult[]> {
  const reg = active;
  if (!reg) return [];
  const results: HandoffResult[] = [];
  for (const session of reg.mesh.sessions()) {
    if (session.status !== 'connected') continue;
    const dpp = reg.protocolBySession.get(session.sessionId);
    if (!dpp) continue;
    const handoff = new WorkflowHandoff(
      reg.mesh.manager(session.sessionId)!,
      {
        deviceId: reg.localDeviceId,
        capabilities: ['workflow', 'journal', 'metadata', 'control'],
        ownsSteps: [],
      },
      reg.routeTable,
      dpp,
    );
    try {
      results.push(await handoff.pushRunAdvance(payload));
    } catch (ex) {
      results.push({
        runId: payload.runId,
        status: 'failed',
        error: (ex as Error).message,
      });
    }
  }
  return results;
}
