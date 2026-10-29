import { useEffect, useState } from 'react';
import { Panel, SyncStatusBar, Status, fmtAgo } from './shared';
import { UiIcon } from '../components/UiIcon';

interface EdgeRow {
  edgeId: string;
  displayName: string | null;
  siteId: string | null;
  role: 'self' | 'peer';
  firstSeenAt: string;
  lastSeenAt: string;
  announcedVersion: string | null;
  tags: string | null;
}

interface PeerHealth {
  peerId: string;
  nodeId: string | null;
  endpoint: string;
  state: string;
  trust: string;
  lastOutcome: string | null;
  lastLatencyMs: number | null;
  remoteVersion: string | null;
  samples24h: number;
  up24h: number;
  uptime24h: number | null;
}

interface FleetResponse {
  summary: {
    edgeCount?: number; peerCount?: number; peersUp24h?: number;
    latestHealthProbeAt?: string | null;
    self: { edgeId: string };
  };
  edges: EdgeRow[];
  peers: PeerHealth[];
}

async function fetchJson<T>(path: string): Promise<T> {
  const r = await fetch(path, { credentials: 'include' });
  const t = await r.text();
  return (t ? JSON.parse(t) : undefined) as T;
}

export function Fleet(): JSX.Element {
  const [data, setData] = useState<FleetResponse | null>(null);

  async function reload(): Promise<void> {
    try { setData(await fetchJson<FleetResponse>('/edge-api/v1/fleet')); }
    catch { /* ignore */ }
  }
  useEffect(() => {
    reload().catch(() => undefined);
    const t = setInterval(() => reload().catch(() => undefined), 30000);
    return () => clearInterval(t);
  }, []);

  const edgeCount  = data?.summary.edgeCount ?? 0;
  const peerCount  = data?.summary.peerCount ?? 0;
  const peersUp24h = data?.summary.peersUp24h ?? 0;

  return (
    <div className="ea-screen" data-test="fleet">
      <SyncStatusBar
        tone={peerCount === 0 ? 'muted' : peersUp24h > 0 ? 'success' : 'warning'}
        title="Fleet"
        statusLabel={`${edgeCount} edges · ${peersUp24h}/${peerCount} peers up 24 h`}
        subtitle={<span>Every edge this edge knows about — this one in the centre, peers around it with 24-hour uptime.</span>}
        actions={
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                  aria-label="Refresh fleet"
                  onClick={() => { reload().catch(() => undefined); }}>
            <UiIcon icon="refresh" size={14} /><span>Refresh</span>
          </button>
        }
      />

      <Panel title={`Fleet roster · ${edgeCount}`}>
        {!data?.edges.length ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
            Fleet roster is empty. On first boot the scheduled refresh populates
            self + any peers; it runs every 5 min.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense" aria-label="Fleet roster">
              <thead><tr>
                <th scope="col">Edge ID</th>
                <th scope="col">Role</th>
                <th scope="col">Display name</th>
                <th scope="col">Site</th>
                <th scope="col">Version</th>
                <th scope="col">First seen</th>
                <th scope="col">Last seen</th>
              </tr></thead>
              <tbody>
                {data.edges.map((e) => (
                  <tr key={e.edgeId}>
                    <td className="ea-mono" style={{ fontSize: 11 }}
                        title={e.edgeId}>{e.edgeId.slice(0, 20)}…</td>
                    <td>
                      <Status tone={e.role === 'self' ? 'info' : 'muted'}>
                        {e.role.toUpperCase()}
                      </Status>
                    </td>
                    <td>{e.displayName ?? '—'}</td>
                    <td className="ea-mono" style={{ fontSize: 12 }}>{e.siteId ?? '—'}</td>
                    <td className="ea-mono" style={{ fontSize: 12 }}>{e.announcedVersion ?? '—'}</td>
                    <td className="ea-text-muted">{fmtAgo(e.firstSeenAt)}</td>
                    <td className="ea-text-muted">{fmtAgo(e.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={`Peer health · ${data?.peers.length ?? 0}`}>
        {!data?.peers.length ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
            No peers configured. Add one at <strong>/network/peers</strong>.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense" aria-label="Peer health">
              <thead><tr>
                <th scope="col">Node</th>
                <th scope="col">Endpoint</th>
                <th scope="col">Trust</th>
                <th scope="col">Last outcome</th>
                <th scope="col">Latency</th>
                <th scope="col">Remote version</th>
                <th scope="col">24-h uptime</th>
                <th scope="col">Samples 24 h</th>
              </tr></thead>
              <tbody>
                {data.peers.map((p) => (
                  <tr key={p.peerId}>
                    <td className="ea-mono">{p.nodeId ?? '—'}</td>
                    <td className="ea-mono" style={{ fontSize: 12 }}>{p.endpoint}</td>
                    <td>
                      <Status tone={p.trust === 'TRUSTED' ? 'success' : 'warning'}>
                        {p.trust}
                      </Status>
                    </td>
                    <td>
                      <Status tone={p.lastOutcome === 'UP' ? 'success'
                                     : p.lastOutcome === 'DEGRADED' ? 'warning'
                                     : p.lastOutcome ? 'danger' : 'muted'}>
                        {p.lastOutcome ?? '—'}
                      </Status>
                    </td>
                    <td className="ea-mono">{p.lastLatencyMs != null ? p.lastLatencyMs + ' ms' : '—'}</td>
                    <td className="ea-mono" style={{ fontSize: 12 }}>{p.remoteVersion ?? '—'}</td>
                    <td className="ea-mono">
                      {p.uptime24h == null ? '—' : p.uptime24h + ' %'}
                    </td>
                    <td className="ea-mono">{p.samples24h}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
