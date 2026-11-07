import { NetworkStatusBadge, statusLabel } from './NetworkStatusBadge';
import type { SelectedNode } from './types';
import { fmtAgo } from '../../screens/shared';
import * as edgeApi from '../../api/edgeApi';

/** Duplicated from Network.tsx's module-local helper — admins
 *  confirm, we fire, we toast + call back. Keeps NodeDetails
 *  self-contained. */
function runAction(prompt: string, fn: () => Promise<unknown>,
  after?: () => void): void {
  if (!window.confirm(prompt)) return;
  fn().then(() => { after?.(); })
    .catch((err: unknown) => {
      window.alert(`Action failed: ${(err as Error)?.message ?? 'unknown error'}`);
    });
}

/** Right-column details for the currently-selected node. Fields hide when
 *  the underlying data isn't present so the panel stays compact. */
export function NetworkNodeDetails(
  { selected, onDeleted }:
  { selected: SelectedNode | null;
    onDeleted?: () => void },
): JSX.Element {
  if (selected === null) {
    return (
      <p className="ea-text-muted" style={{ margin: 0, padding: 12, fontSize: 13 }}>
        Click a node to inspect it.
      </p>
    );
  }

  const title =
    selected.kind === 'der' ? selected.name
      : selected.kind === 'wan' ? 'Central DHIS2'
      : selected.name;

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}
         aria-live="polite">
      <div style={{ display: 'flex', alignItems: 'center',
                     justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
        <NetworkStatusBadge status={selected.status} showLabel />
      </div>
      <dl style={{ margin: 0, display: 'grid',
                    gridTemplateColumns: 'auto 1fr', rowGap: 6, columnGap: 12,
                    fontSize: 12 }}>
        {rowsFor(selected).map(([k, v], i) => (
          <Row key={`${k}-${i}`} label={k} value={v} />
        ))}
      </dl>
      {selected.kind === 'device' && (
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button"
                  className="ea-btn ea-btn--danger ea-btn--sm"
                  data-test="mesh-delete-device"
                  onClick={() => {
                    runAction(
                      `Delete device ${selected.id}? It will be removed from both `
                        + 'the clients list and the mesh topology.',
                      () => edgeApi.networkDeviceDelete(selected.id),
                      () => onDeleted?.());
                  }}>
            Delete device
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number | null }): JSX.Element {
  if (value === null || value === '' || value === undefined) {
    return <></>;
  }
  return (
    <>
      <dt style={{ color: 'var(--der-ink-500)' }}>{label}</dt>
      <dd style={{ margin: 0, fontFamily: label === 'Fingerprint' || label === 'Address'
                     ? 'var(--der-mono, monospace)' : undefined,
                    fontSize: label === 'Fingerprint' ? 11 : undefined }}>
        {value}
      </dd>
    </>
  );
}

type Row = [string, string | number | null];

function rowsFor(n: SelectedNode): Row[] {
  if (n.kind === 'der') {
    return [
      ['Type', 'Facility Server'],
      ['Address', n.ipAddress],
      ['Hostname', n.hostname],
      ['Status', statusLabel(n.status)],
      ['Central bridge', n.centralBridge ? 'Online' : 'Local only'],
      ['Fingerprint', n.fingerprint],
    ];
  }
  if (n.kind === 'wan') {
    return [
      ['Status', statusLabel(n.status)],
      ['State', n.state],
      ['Central DHIS2', n.centralDhis2Available ? 'Reachable' : 'Unreachable'],
      ['Internet', n.internetAvailable ? 'Reachable' : 'Unreachable'],
      ['Last probe', n.lastProbeAt ? fmtAgo(n.lastProbeAt) : null],
    ];
  }
  if (n.kind === 'device') {
    return [
      ['Type', titleCase(n.formFactor)],
      ['Status', statusLabel(n.status)],
      ['Sync state', n.sync.state],
      ['Pending', n.sync.pending],
      ['Last seen', n.lastSeen ? fmtAgo(n.lastSeen) : null],
      ['Enrolment', n.deviceStatus],
      ['Firmware', n.firmwareVersion],
      ['User agent', n.userAgent],
    ];
  }
  // peer
  return [
    ['Endpoint', n.endpoint],
    ['Status', statusLabel(n.status)],
    ['State', n.state],
    ['Trust', n.trust],
    ['Last handshake', n.lastHandshake ? fmtAgo(n.lastHandshake) : null],
  ];
}

function titleCase(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
