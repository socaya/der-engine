import { NetworkStatusBadge } from './NetworkStatusBadge';

/** Legend lives top-right in the SyncStatusBar actions slot. */
export function NetworkLegend(): JSX.Element {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center',
                    gap: 14, fontSize: 12 }}
          role="list" aria-label="Topology legend">
      <span role="listitem"><NetworkStatusBadge status="online"   showLabel /></span>
      <span role="listitem"><NetworkStatusBadge status="degraded" showLabel /></span>
      <span role="listitem"><NetworkStatusBadge status="offline"  showLabel /></span>
      <span role="listitem" aria-label="LAN / Wi-Fi link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <svg width="24" height="4" aria-hidden="true" focusable={false}>
          <line x1="1" y1="2" x2="23" y2="2"
                stroke="var(--der-ink-500, #6b7280)" strokeWidth="2" />
        </svg>
        <span>LAN</span>
      </span>
      <span role="listitem" aria-label="Peer-to-peer link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <svg width="24" height="4" aria-hidden="true" focusable={false}>
          <line x1="1" y1="2" x2="23" y2="2"
                stroke="var(--der-ink-500, #6b7280)"
                strokeWidth="2" strokeDasharray="4 3" />
        </svg>
        <span>P2P</span>
      </span>
    </span>
  );
}
