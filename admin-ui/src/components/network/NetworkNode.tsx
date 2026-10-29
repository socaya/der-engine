import { UiIcon } from '../UiIcon';
import type { UiIconId } from '../UiIcon';
import { NetworkStatusBadge, statusLabel } from './NetworkStatusBadge';
import type { DerNode, DeviceNode, PeerNode, NodeStatus } from './types';

const CARD_W = 170;
const CARD_H = 76;
const DER_W  = 220;
const DER_H  = 90;

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

/** DER centre card (facility server, slightly larger). */
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
        <div style={{ padding: 10, position: 'relative', height: '100%' }}
>
          <span style={{ position: 'absolute', top: 8, right: 10 }}>
            <NetworkStatusBadge status={der.status} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 2, height: '100%' }}>
            <UiIcon icon="facility-server" size={22} />
            <div style={{ fontWeight: 600, fontSize: 14 }}>{der.name}</div>
            <div style={{ fontSize: 11, color: 'var(--der-ink-500)' }}>Facility Server</div>
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

/** WAN cloud (centre-top). */
export function WanBubble(
  { x, y, status, selected, onSelect }:
    Common & { status: NodeStatus }
): JSX.Element {
  return (
    <g role="button" tabIndex={0}
       aria-label={`WAN connection, ${statusLabel(status)}`}
       onClick={onSelect}
       onKeyDown={(e) => {
         if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
       }}
       style={{ cursor: 'pointer' }}>
      <ellipse cx={x} cy={y} rx={90} ry={30}
               fill={cardBg(selected)}
               stroke={cardStroke(selected)}
               strokeWidth={selected ? 2.5 : 1.25} />
      <foreignObject x={x - 90} y={y - 30} width={180} height={60}
                     style={{ pointerEvents: 'none' }}>
        <div style={{ padding: 8, position: 'relative', height: '100%',
                       display: 'flex', alignItems: 'center', justifyContent: 'center',
                       gap: 8 }}
>
          <NetworkStatusBadge status={status} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Central DHIS2</div>
            <div style={{ fontSize: 11, color: 'var(--der-ink-500)' }}>WAN</div>
          </div>
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
