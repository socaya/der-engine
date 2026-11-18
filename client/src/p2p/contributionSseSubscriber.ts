import { broadcastRunAdvance } from './bus';

/**
 * EventSource subscription to
 * {@code GET /edge-api/v1/workflows/runs/events/stream}. Each
 * {@code contribution.completed} event becomes a
 * {@code workflow.run-advance} DPP/1 broadcast via {@link broadcastRunAdvance},
 * so a step submitted on this device auto-arrives at the next-step
 * owner's device without any operator intervention.
 *
 * <p>Design:
 * <ul>
 *   <li>One subscriber per browser tab. Opens on module load (see
 *       {@link startContributionSubscriber}), reconnects on error
 *       with exponential backoff capped at 30s.</li>
 *   <li>The contribution event already has {@code nextStep + nextOwner}
 *       resolved server-side, so the browser doesn't need to re-query
 *       readiness. The {@code contribution} payload field is kept empty
 *       here — the receiving device re-fetches from its own edge
 *       server once it has the {@code runId}. Trades one HTTP round-
 *       trip for a smaller DPP frame.</li>
 * </ul></p>
 */

let eventSource: EventSource | null = null;
let backoffMs = 1000;
const MAX_BACKOFF_MS = 30_000;

export function startContributionSubscriber(): void {
  if (eventSource) return;
  connect();
}

export function stopContributionSubscriber(): void {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

function connect(): void {
  try {
    eventSource = new EventSource(
      '/edge-api/v1/workflows/runs/events/stream',
      { withCredentials: true } as EventSourceInit,
    );
  } catch {
    // Browser without EventSource support — nothing to do.
    return;
  }
  eventSource.addEventListener('ready', () => {
    backoffMs = 1000;
  });
  eventSource.addEventListener('contribution.completed', (ev) => {
    const msg = ev as MessageEvent<string>;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(msg.data) as Record<string, unknown>;
    } catch {
      return;
    }
    const runId = payload.runId as string | undefined;
    const workflowId = payload.workflowId as string | undefined;
    const completedStep = payload.completedStep as string | undefined;
    if (!runId || !workflowId || !completedStep) {
      return;
    }
    const nextStep = (payload.nextStep as string | null) ?? null;
    const nextOwner = (payload.nextOwner as string | null) ?? null;
    const businessKey = (payload.businessKey as string | null) ?? '';

    // Fire-and-forget. Any mesh errors surface in per-session UI;
    // this subscriber doesn't need to block on them.
    void broadcastRunAdvance({
      runId,
      workflowId,
      completedStep,
      nextStep,
      nextOwner,
      businessKey,
      // Receiver re-fetches the contribution body from its local
      // edge server using runId + completedStep. Keeps DPP frames
      // small + avoids re-serialising large multi-field payloads.
      contribution: null,
    });
  });
  eventSource.onerror = () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    const delay = backoffMs;
    backoffMs = Math.min(MAX_BACKOFF_MS, backoffMs * 2);
    setTimeout(() => {
      if (!eventSource) connect();
    }, delay);
  };
}
