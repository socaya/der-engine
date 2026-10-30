import type { ConnectionType, NodeStatus } from './types';
import { statusFill } from './NetworkStatusBadge';

interface Props {
  x1: number; y1: number;
  x2: number; y2: number;
  type: ConnectionType;
  status: NodeStatus;
}

/** A single edge between two nodes.
 *
 *  - LAN / Wi-Fi : solid grey line
 *  - P2P         : dashed grey line
 *  - WAN         : thicker blue line (DER ↔ central DHIS2) — distinct
 *                   from facility edges so operators spot WAN state
 *                   at a glance
 *  - any status offline / degraded promotes the stroke to the status
 *    tone, so an unhealthy link reads first on colour. */
export function NetworkConnection(
  { x1, y1, x2, y2, type, status }: Props
): JSX.Element {
  const isWan = type === 'wan';
  const dashed = (!isWan && type === 'p2p')
    || status === 'offline'
    || status === 'degraded';

  const stroke =
      status === 'offline'  ? statusFill('offline')
    : status === 'degraded' ? statusFill('degraded')
    : isWan                 ? 'var(--der-primary-ink, #2563eb)'
    : 'var(--der-ink-300, #cbd5e1)';

  const strokeWidth = isWan ? 2.5 : 1.5;
  // WAN stays solid when online so it reads as the dominant backbone;
  // only goes dashed when degraded / offline (handled by `dashed`).
  const dashArray = dashed ? '6 4' : undefined;

  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={dashArray}
          aria-hidden="true" />
  );
}
