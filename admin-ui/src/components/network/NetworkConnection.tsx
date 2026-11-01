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
 *    tone, so an unhealthy link reads first on colour.
 *
 *  §2.3.68 — healthy edges get an arrow-head mid-line + an animated
 *  dot traveling from source to destination so admins can see data
 *  flow at a glance. Direction is drawn as DER → endpoint (device /
 *  peer / WAN) which matches how DER publishes outbound traffic;
 *  bidirectional reality is understood from context. */
export function NetworkConnection(
  { x1, y1, x2, y2, type, status }: Props
): JSX.Element {
  const isWan = type === 'wan';
  const dashed = (!isWan && type === 'p2p')
    || status === 'offline'
    || status === 'degraded';
  const online = status !== 'offline' && status !== 'degraded';

  const stroke =
      status === 'offline'  ? statusFill('offline')
    : status === 'degraded' ? statusFill('degraded')
    : isWan                 ? 'var(--der-primary-ink, #2563eb)'
    : 'var(--der-ink-300, #cbd5e1)';

  const strokeWidth = isWan ? 2.5 : 1.5;
  const dashArray = dashed ? '6 4' : undefined;

  // Direction: edges originate from (x1,y1) which is always DER in
  // TopologyCanvas's layout, pointing outward to (x2,y2).
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  // Pull endpoints in a touch so the arrow head doesn't dive under
  // the destination node card.
  const inset = 24;
  const sx = x1 + (dx / len) * 10;
  const sy = y1 + (dy / len) * 10;
  const ex = x2 - (dx / len) * inset;
  const ey = y2 - (dy / len) * inset;

  // Arrow head glyph — small triangle at the end of the line.
  const headSize = isWan ? 7 : 5;
  const ang = Math.atan2(ey - sy, ex - sx);
  const ah1x = ex - headSize * Math.cos(ang - Math.PI / 6);
  const ah1y = ey - headSize * Math.sin(ang - Math.PI / 6);
  const ah2x = ex - headSize * Math.cos(ang + Math.PI / 6);
  const ah2y = ey - headSize * Math.sin(ang + Math.PI / 6);

  // Animation duration proportional to length so dots travel at a
  // uniform visual speed across short + long edges.
  const dur = `${Math.max(1.5, len / 80).toFixed(1)}s`;

  return (
    <g aria-hidden="true">
      <line x1={sx} y1={sy} x2={ex} y2={ey}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            strokeLinecap="round" />
      {/* Arrow head — rendered for every edge so direction reads
          immediately, including when offline. */}
      <polyline points={`${ah1x},${ah1y} ${ex},${ey} ${ah2x},${ah2y}`}
                 fill="none"
                 stroke={stroke}
                 strokeWidth={strokeWidth}
                 strokeLinecap="round"
                 strokeLinejoin="round" />
      {/* Animated data-flow dot — only when the link is online. The
          dot travels from source → endpoint and loops; multiple
          edges stay roughly in sync via `begin="0s"`. */}
      {online && (
        <circle r={isWan ? 3 : 2.5} fill={stroke}>
          <animateMotion dur={dur}
                           repeatCount="indefinite"
                           path={`M ${sx} ${sy} L ${ex} ${ey}`}
                           rotate="auto" />
        </circle>
      )}
    </g>
  );
}
