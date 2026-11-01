import type { ConnectionType, NodeStatus } from './types';
import { statusFill } from './NetworkStatusBadge';

interface Props {
  x1: number; y1: number;
  x2: number; y2: number;
  type: ConnectionType;
  status: NodeStatus;
  /** Explicit override on how to animate flow regardless of the raw
   *  `status`. Lets the caller signal "device is part of the fleet
   *  so draw a slow dim flow" even when the heartbeat is stale.
   *  Defaults to a status-based mapping:
   *     online   → 'full'
   *     degraded → 'dim'
   *     offline  → 'none' */
  flow?: 'full' | 'dim' | 'none';
}

/** A single edge between two nodes. Colour, dash pattern, animation
 *  speed, and particle density all vary by {@link ConnectionType} so
 *  admins can tell traffic classes apart at a glance:
 *
 *   - **wan**  (DER ↔ central DHIS2) — bold navy, thick solid line.
 *     This is the sync backbone; 2 particles travel slowly along it
 *     to signal the dominant uplink.
 *   - **p2p** (DER ↔ peer edge) — teal, dashed line. 1 particle at
 *     peer-exchange speed (slower cadence than LAN).
 *   - **wifi** — amber, solid line. 1 particle at WiFi cadence
 *     (fastest — many short bursts).
 *   - **ethernet** — forest-green, solid line. 1 particle at LAN
 *     cadence.
 *   - **offline / degraded** — status tone trumps all, dashed, no
 *     particle (eye lands on the warning line, not a stale flow). */
export function NetworkConnection(
  { x1, y1, x2, y2, type, status, flow }: Props
): JSX.Element {
  const resolvedFlow: 'full' | 'dim' | 'none' = flow
    ?? (status === 'online' ? 'full'
        : status === 'degraded' ? 'dim'
        : 'none');
  const online = resolvedFlow !== 'none';
  const dim = resolvedFlow === 'dim';
  const style = edgeStyle(type);
  const dashed = status === 'offline' || status === 'degraded' || style.dashed;

  const stroke =
      status === 'offline'  ? statusFill('offline')
    : status === 'degraded' ? statusFill('degraded')
    : style.colour;

  const strokeWidth = style.width;
  const dashArray = dashed ? style.dashArray : undefined;

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
  const headSize = type === 'wan' ? 7 : 5;
  const ang = Math.atan2(ey - sy, ex - sx);
  const ah1x = ex - headSize * Math.cos(ang - Math.PI / 6);
  const ah1y = ey - headSize * Math.sin(ang - Math.PI / 6);
  const ah2x = ex - headSize * Math.cos(ang + Math.PI / 6);
  const ah2y = ey - headSize * Math.sin(ang + Math.PI / 6);

  // Animation duration proportional to length so dots travel at a
  // uniform visual speed, modulated by per-type cadence multiplier
  // (WiFi fastest → fastest, WAN slowest → slowest). Dim flows run
  // ~1.6× slower so they read as "available but idle" vs active sync.
  const baseDur = Math.max(1.5, len / 80);
  const flowFactor = dim ? 1.6 : 1.0;
  const dur = `${(baseDur * style.cadence * flowFactor).toFixed(1)}s`;
  const particleOpacity = dim ? 0.4 : 1;

  // Second particle on WAN (bidirectional feel) and shifted phase.
  const particles = online ? style.particles : 0;

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
      {/* Animated data-flow particles — count varies per type.
          Each extra particle starts with a phase offset so they
          spread along the edge instead of stacking. */}
      {Array.from({ length: particles }).map((_, i) => (
        <circle key={`fwd-${i}`} r={type === 'wan' ? 3 : 2.5}
                 fill={stroke}
                 opacity={particleOpacity}>
          <animateMotion dur={dur}
                           repeatCount="indefinite"
                           begin={`${(-baseDur * style.cadence * flowFactor * i) / particles}s`}
                           path={`M ${sx} ${sy} L ${ex} ${ey}`}
                           rotate="auto" />
        </circle>
      ))}
      {/* Reverse-direction particles — real DER↔DHIS2 sync is
          bidirectional (metadata pull + data push), same for
          device uplinks (contributions in + prefetch cues out).
          Reverse dots are smaller + a touch more transparent so
          forward flow stays dominant. */}
      {online && Array.from({ length: style.reverseParticles }).map((_, i) => (
        <circle key={`rev-${i}`} r={type === 'wan' ? 2.5 : 2}
                 fill={stroke}
                 opacity={particleOpacity * 0.75}>
          <animateMotion dur={dur}
                           repeatCount="indefinite"
                           begin={`${(-baseDur * style.cadence * flowFactor * i) / Math.max(1, style.reverseParticles) - baseDur * style.cadence * flowFactor * 0.5}s`}
                           path={`M ${ex} ${ey} L ${sx} ${sy}`}
                           rotate="auto" />
        </circle>
      ))}
    </g>
  );
}

interface EdgeStyle {
  colour: string;
  width: number;
  dashed: boolean;
  dashArray: string;
  cadence: number;            // 1.0 = baseline length-based duration; higher = slower
  particles: number;          // # forward (DER → endpoint) particles
  reverseParticles: number;   // # reverse (endpoint → DER) particles
}

/** Edge styling table — different traffic classes read as different
 *  colours + cadences so admins recognise DER↔DHIS2 sync, peer
 *  exchange, and local LAN/WiFi at a glance. Forward + reverse
 *  particle counts model bidirectional reality: WAN sync pulls
 *  metadata + pushes data; device uplinks carry contributions in +
 *  prefetch cues out. */
function edgeStyle(type: ConnectionType): EdgeStyle {
  switch (type) {
    case 'wan':
      return {
        colour: 'var(--der-primary-ink, #1d4ed8)',
        width: 2.5, dashed: false, dashArray: '6 4',
        cadence: 1.3, particles: 2, reverseParticles: 2,
      };
    case 'p2p':
      return {
        colour: 'var(--der-teal-ink, #0d9488)',
        width: 1.75, dashed: true, dashArray: '6 4',
        cadence: 1.1, particles: 1, reverseParticles: 1,
      };
    case 'wifi':
      return {
        colour: 'var(--der-warning-ink, #b45309)',
        width: 1.5, dashed: false, dashArray: '4 4',
        cadence: 0.8, particles: 1, reverseParticles: 1,
      };
    case 'ethernet':
      return {
        colour: 'var(--der-success-ink, #0f766e)',
        width: 1.5, dashed: false, dashArray: '4 4',
        cadence: 0.9, particles: 1, reverseParticles: 1,
      };
    default:
      return {
        colour: 'var(--der-ink-300, #cbd5e1)',
        width: 1.5, dashed: false, dashArray: '4 4',
        cadence: 1.0, particles: 1, reverseParticles: 0,
      };
  }
}
