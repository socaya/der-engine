import { UiIcon } from '../UiIcon';
import type { UiIconId } from '../UiIcon';
import { NetworkStatusBadge, statusLabel } from './NetworkStatusBadge';
import type { DerNode, DeviceNode, PeerNode, NodeStatus } from './types';

const CARD_W = 170;
const CARD_H = 76;
const DER_W  = 220;
const DER_H  = 90;

/** Admin UI base URL — logos sit under /admin/assets/ in prod, / in
 *  dev. The main.tsx bootstrap exports __DER_ADMIN_BASE__; we use it
 *  directly here to prefix the <img src=…> attributes.
 *
 *  §2.3.76 — DER logo swapped from PNG to the official SVG exports.
 *  der-logo.svg = full brand mark + "DER" wordmark (3:1 ratio) for
 *  the facility card. der-icon.svg = square icon-only variant for
 *  smaller / icon-only contexts. */
const ADMIN_BASE = (typeof __DER_ADMIN_BASE__ !== 'undefined'
  ? __DER_ADMIN_BASE__
  : '/');
const DER_LOGO   = ADMIN_BASE + 'assets/der-logo.svg';
const DHIS2_LOGO = ADMIN_BASE + 'assets/dhis2-logo.svg';

interface Common {
  x: number;
  y: number;
  selected: boolean;
  onSelect(): void;
}

function cardBg(selected: boolean): string {
  return selected ? 'var(--der-primary-wash, #eff6ff)' : 'var(--der-raised, #ffffff)';
}

function cardStroke(selected: boolean): string {
  return selected ? 'var(--der-primary-ink, #2563eb)' : 'var(--der-border, #e5e7eb)';
}

function iconFor(formFactor: string): UiIconId {
  switch (formFactor) {
    case 'WORKSTATION': return 'workstation';
    case 'LAPTOP':      return 'laptop';
    case 'TABLET':      return 'tablet';
    case 'MOBILE':      return 'mobile';
    default:            return 'unknown-device';
  }
}

/** DER centre card (facility server, slightly larger).
 *
 *  §2.3.76 — redesign: the official DER brand mark (SVG, includes
 *  the DER wordmark) is left-aligned inside the card with the
 *  "Facility Server" subtitle underneath; the status marker lives
 *  top-right. We no longer render "DER Edge Runtime" as separate
 *  text because the wordmark is already in the logo. */
export function DerCard(props: Common & { der: DerNode }): JSX.Element {
  const { x, y, selected, onSelect, der } = props;
  return (
    <g role="button" tabIndex={0} aria-label={`DER Edge Runtime, ${statusLabel(der.status)}`}
       onClick={onSelect}
       onKeyDown={(e) => {
         if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
       }}
       style={{ cursor: 'pointer' }}>
      <rect x={x - DER_W / 2} y={y - DER_H / 2} width={DER_W} height={DER_H}
            rx={12} ry={12}
            fill={cardBg(selected)}
            stroke={cardStroke(selected)}
            strokeWidth={selected ? 2.5 : 1.5} />
      <foreignObject x={x - DER_W / 2} y={y - DER_H / 2} width={DER_W} height={DER_H}
                     style={{ pointerEvents: 'none' }}>
        <div style={{ padding: 10, position: 'relative', height: '100%',
                       display: 'flex', flexDirection: 'column',
                       justifyContent: 'center', alignItems: 'center' }}>
          <span style={{ position: 'absolute', top: 8, right: 10 }}>
            <NetworkStatusBadge status={der.status} />
          </span>
          <img src={DER_LOGO}
               alt={der.name}
               title={der.name}
               style={{ height: 40, maxWidth: DER_W - 24,
                        width: 'auto', objectFit: 'contain',
                        display: 'block' }} />
          <div style={{ fontSize: 10.5, color: 'var(--der-ink-500)',
                        marginTop: 4, letterSpacing: 0.2,
                        textAlign: 'center' }}>
            Facility Server · Edge Runtime
          </div>
        </div>
      </foreignObject>
    </g>
  );
}

/** Device card (workstation / laptop / tablet / mobile). */
export function DeviceCard(props: Common & { device: DeviceNode }): JSX.Element {
  const { x, y, selected, onSelect, device } = props;
  const syncing = device.sync.state === 'syncing' || device.sync.pending > 0;
  return (
    <g role="button" tabIndex={0}
       aria-label={`${device.name}, ${device.type}, ${statusLabel(device.status)}`
         + (syncing ? `, ${device.sync.pending} queued` : '')}
       onClick={onSelect}
       onKeyDown={(e) => {
         if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
       }}
       style={{ cursor: 'pointer' }}>
      <rect x={x - CARD_W / 2} y={y - CARD_H / 2} width={CARD_W} height={CARD_H}
            rx={10} ry={10}
            fill={cardBg(selected)}
            stroke={cardStroke(selected)}
            strokeWidth={selected ? 2.5 : 1.25} />
      <foreignObject x={x - CARD_W / 2} y={y - CARD_H / 2} width={CARD_W} height={CARD_H}
                     style={{ pointerEvents: 'none' }}>
        <div style={{ padding: 8, position: 'relative', height: '100%' }}
>
          {/* Sync indicator (top-left blue dot) */}
          {syncing && (
            <span style={{ position: 'absolute', top: 6, left: 8 }}
                  aria-label={`${device.sync.pending} queued, syncing`}
                  className="ea-sync-dot">
              <span style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                background: 'var(--der-primary-ink, #2563eb)',
              }} />
            </span>
          )}
          <span style={{ position: 'absolute', top: 6, right: 8 }}>
            <NetworkStatusBadge status={device.status} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 2, marginTop: 2 }}>
            <UiIcon icon={iconFor(device.formFactor)} size={18} />
            <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.2,
                           textAlign: 'center', maxWidth: 150, overflow: 'hidden',
                           textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {device.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--der-ink-500)' }}>
              {friendlyFormFactor(device.formFactor)}
              {device.sync.pending > 0 ? ` · ${device.sync.pending} queued` : ''}
            </div>
          </div>
        </div>
      </foreignObject>
    </g>
  );
}

/** Peer edge card. */
export function PeerCard(props: Common & { peer: PeerNode }): JSX.Element {
  const { x, y, selected, onSelect, peer } = props;
  return (
    <g role="button" tabIndex={0}
       aria-label={`Peer edge ${peer.name}, ${statusLabel(peer.status)}`}
       onClick={onSelect}
       onKeyDown={(e) => {
         if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
       }}
       style={{ cursor: 'pointer' }}>
      <rect x={x - CARD_W / 2} y={y - CARD_H / 2} width={CARD_W} height={CARD_H}
            rx={10} ry={10}
            fill={cardBg(selected)}
            stroke={cardStroke(selected)}
            strokeDasharray="3 3"
            strokeWidth={selected ? 2.5 : 1.25} />
      <foreignObject x={x - CARD_W / 2} y={y - CARD_H / 2} width={CARD_W} height={CARD_H}
                     style={{ pointerEvents: 'none' }}>
        <div style={{ padding: 8, position: 'relative', height: '100%' }}
>
          <span style={{ position: 'absolute', top: 6, right: 8 }}>
            <NetworkStatusBadge status={peer.status} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 2 }}>
            <UiIcon icon="peer" size={18} />
            <div style={{ fontWeight: 600, fontSize: 13 }}
                 title={peer.name}>{truncate(peer.name, 18)}</div>
            <div style={{ fontSize: 11, color: 'var(--der-ink-500)' }}>Peer edge</div>
          </div>
        </div>
      </foreignObject>
    </g>
  );
}

/** Internet gateway — the facility switch/router that peers the
 *  edge LAN with the WAN uplink to central DHIS2. Rendered as a
 *  rectangular network-switch card (not an oval cloud) with the
 *  `router` glyph so admins recognise it as the on-prem gateway,
 *  not the Internet "cloud" itself.
 *
 *  §2.3.74 — the Simulate toggle moved out of here and into
 *  Settings. The card now just shows status + a `· sim` chip when
 *  the simulator is driving the value. */
export function InternetBubble(
  { x, y, status, selected, onSelect, simulated }:
    Common & { status: NodeStatus; simulated: boolean }
): JSX.Element {
  const online = status === 'online';
  const w = 150;
  const h = 56;
  const tone = online ? 'var(--der-success-ink, #0f766e)'
                      : 'var(--der-danger-ink, #b91c1c)';
  return (
    <g role="button" tabIndex={0}
       aria-label={`Internet gateway, ${online ? 'ON' : 'OFF'}`
                   + (simulated ? ' (simulated)' : '')}
       onClick={onSelect}
       onKeyDown={(e) => {
         if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
       }}
       style={{ cursor: 'pointer' }}>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h}
            rx={8} ry={8}
            fill={cardBg(selected)}
            stroke={selected ? 'var(--der-primary-ink, #2563eb)' : tone}
            strokeWidth={selected ? 2.5 : 1.5} />
      <foreignObject x={x - w / 2} y={y - h / 2} width={w} height={h}
                     style={{ pointerEvents: 'none' }}>
        <div style={{ padding: 6, height: '100%',
                       display: 'flex', alignItems: 'center',
                       gap: 8, color: tone }}>
          <UiIcon icon="router" size={22} />
          <div style={{ textAlign: 'left', minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13,
                          color: 'var(--der-ink-900, #0f172a)' }}>Internet</div>
            <div style={{ fontSize: 10, display: 'flex',
                          alignItems: 'center', gap: 4,
                          color: tone, fontWeight: 600 }}>
              <span aria-hidden="true" style={{
                width: 7, height: 7, borderRadius: '50%',
                background: tone,
              }} />
              {online ? 'ON' : 'OFF'}
              {simulated && (
                <span title="Simulated — state is cycling on a random schedule"
                      style={{ color: 'var(--der-primary-ink, #2563eb)',
                               fontWeight: 500, marginLeft: 2 }}>
                  · sim
                </span>
              )}
            </div>
          </div>
        </div>
      </foreignObject>
    </g>
  );
}

/** WAN "cloud" — rendered as the real DHIS2 brand mark + wordmark
 *  (SVG served from /admin/assets/) so admins recognise the central
 *  endpoint by its logo, not a generic cloud shape. The pill is
 *  wider than before so the logo + status badge both fit without
 *  compressing the mark. */
export function WanBubble(
  { x, y, status, selected, onSelect }:
    Common & { status: NodeStatus }
): JSX.Element {
  const rx = 110;
  const ry = 32;
  return (
    <g role="button" tabIndex={0}
       aria-label={`Central DHIS2, ${statusLabel(status)}`}
       onClick={onSelect}
       onKeyDown={(e) => {
         if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
       }}
       style={{ cursor: 'pointer' }}>
      <ellipse cx={x} cy={y} rx={rx} ry={ry}
               fill={cardBg(selected)}
               stroke={cardStroke(selected)}
               strokeWidth={selected ? 2.5 : 1.25} />
      <foreignObject x={x - rx} y={y - ry} width={rx * 2} height={ry * 2}
                     style={{ pointerEvents: 'none' }}>
        <div style={{ padding: '6px 14px', position: 'relative',
                       height: '100%', display: 'flex',
                       alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ position: 'absolute', top: 6, right: 14 }}>
            <NetworkStatusBadge status={status} />
          </span>
          <img src={DHIS2_LOGO} alt="DHIS2"
               style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
        </div>
      </foreignObject>
    </g>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function friendlyFormFactor(ff: string): string {
  switch (ff) {
    case 'WORKSTATION': return 'Workstation';
    case 'LAPTOP':      return 'Laptop';
    case 'TABLET':      return 'Tablet';
    case 'MOBILE':      return 'Mobile · P2P';
    default:            return 'Device';
  }
}
