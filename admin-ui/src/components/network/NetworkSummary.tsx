import { NetworkStatusBadge } from './NetworkStatusBadge';
import type { TopologySummary } from './types';

/** Right-column live counts: devices, online/degraded/offline, sync queue,
 *  peers, WAN. */
export function NetworkSummary({ summary }: { summary: TopologySummary }): JSX.Element {
  return (
    <dl style={{ margin: 0, padding: 12,
                  display: 'grid', gridTemplateColumns: 'auto 1fr',
                  rowGap: 8, columnGap: 12, fontSize: 13 }}
        aria-label="Network status summary">
      <Row label="Devices"  value={summary.devices} />
      <Row label="Online"   value={summary.devicesOnline}  tone={<NetworkStatusBadge status="online" />} />
      <Row label="Degraded" value={summary.devicesDegraded} tone={summary.devicesDegraded > 0
                                                                    ? <NetworkStatusBadge status="degraded" />
                                                                    : null} />
      <Row label="Offline"  value={summary.devicesOffline} tone={summary.devicesOffline > 0
                                                                   ? <NetworkStatusBadge status="offline" />
                                                                   : null} />
      <Row label="Sync queue" value={summary.syncQueueTotal} />
      <Row label="Peers"    value={`${summary.peersConnected} / ${summary.peers}`} />
      <Row label="WAN"      tone={<NetworkStatusBadge status={summary.wanStatus} showLabel />} />
    </dl>
  );
}

function Row({ label, value, tone }:
                { label: string; value?: string | number; tone?: JSX.Element | null }): JSX.Element {
  return (
    <>
      <dt style={{ color: 'var(--der-ink-500)' }}>{label}</dt>
      <dd style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8,
                    justifyContent: 'flex-end', fontFamily: 'var(--der-mono, monospace)' }}>
        {value !== undefined && <span>{value}</span>}
        {tone}
      </dd>
    </>
  );
}
