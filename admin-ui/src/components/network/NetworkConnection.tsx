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
 *  Solid gray = healthy LAN; dashed gray = P2P; dashed in offline tone
 *  when either endpoint is down. */
export function NetworkConnection(
  { x1, y1, x2, y2, type, status }: Props
): JSX.Element {
  const dashed = type === 'p2p' || status === 'offline' || status === 'degraded';
  const stroke = status === 'offline' ? statusFill('offline')
    : status === 'degraded' ? statusFill('degraded')
    : 'var(--der-ink-300, #cbd5e1)';
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={stroke}
          strokeWidth={status === 'offline' ? 1.5 : 1.5}
          strokeDasharray={dashed ? '6 4' : undefined}
          aria-hidden="true" />
  );
}
