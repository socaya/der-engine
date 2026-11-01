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
      <span role="listitem" aria-label="DER to DHIS2 sync link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <svg width="24" height="4" aria-hidden="true" focusable={false}>
          <line x1="1" y1="2" x2="23" y2="2"
                stroke="var(--der-primary-ink, #1d4ed8)" strokeWidth="2.5" />
        </svg>
        <span>Sync</span>
      </span>
      <span role="listitem" aria-label="Ethernet LAN link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <svg width="24" height="4" aria-hidden="true" focusable={false}>
          <line x1="1" y1="2" x2="23" y2="2"
                stroke="var(--der-success-ink, #0f766e)" strokeWidth="2" />
        </svg>
        <span>Ethernet</span>
      </span>
      <span role="listitem" aria-label="Wi-Fi link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <svg width="24" height="4" aria-hidden="true" focusable={false}>
          <line x1="1" y1="2" x2="23" y2="2"
                stroke="var(--der-warning-ink, #b45309)" strokeWidth="2" />
        </svg>
        <span>Wi-Fi</span>
      </span>
    </span>
  );
}
