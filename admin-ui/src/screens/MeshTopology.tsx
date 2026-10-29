import { useEffect, useState } from 'react';
import { Panel, SyncStatusBar, Status, fmtAgo } from './shared';
import { UiIcon } from '../components/UiIcon';

interface TopologyPeer {
  id: string;
  nodeId: string;
  endpoint: string;
  state: string;
  trust: string;
  reachable: Array<{ edgeFingerprint: string; hops: number; announcedAt: string }>;
}

interface Topology {
  self: { fingerprint: string; role: string };
  peers: TopologyPeer[];
}

interface AdjacencyRow {
  localPeerId: string;
  localNodeId: string;
  localEndpoint: string;
  reachableEdge: string;
  hops: number;
  announcedAt: string;
}

async function j<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method, credentials: 'include',
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function MeshTopology(): JSX.Element {
  const [topology, setTopology] = useState<Topology | null>(null);
  const [adjacency, setAdjacency] = useState<AdjacencyRow[]>([]);
  async function reload(): Promise<void> {
    try { setTopology(await j<Topology>('GET', '/edge-api/v1/peer-mesh/topology')); } catch { /* */ }
    try { setAdjacency((await j<{ adjacency: AdjacencyRow[] }>('GET', '/edge-api/v1/peer-mesh/adjacency')).adjacency); } catch { /* */ }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  const connected = topology?.peers.filter((p) => p.state === 'CONNECTED').length ?? 0;
  const trusted = topology?.peers.filter((p) => p.trust === 'TRUSTED').length ?? 0;

  return (
    <div className="ea-screen" data-test="mesh-topology">
      <SyncStatusBar
        tone={connected > 0 ? 'success' : 'muted'}
        title="Mesh topology"
        statusLabel={`${connected} connected · ${trusted} trusted`}
        subtitle={<span>Direct peers + transitive reachability through the WireGuard mesh.</span>}
        actions={
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                  onClick={() => { reload().catch(() => undefined); }}>
            <UiIcon icon="refresh" size={14} /><span>Refresh</span>
          </button>
        }
      />

      {topology && (
        <Panel title={`This edge · ${topology.self.fingerprint.slice(0, 24)}…`}>
          <TopologySvg topology={topology} />
        </Panel>
      )}

      <Panel title={`Direct peers · ${topology?.peers.length ?? 0}`}>
        {!topology?.peers.length ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
            No peers configured. Add one via <strong>/network/peers</strong>.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>Node ID</th><th>Endpoint</th><th>State</th>
                <th>Trust</th><th>Reaches via mesh</th>
              </tr></thead>
              <tbody>
                {topology.peers.map((p) => (
                  <tr key={p.id}>
                    <td className="ea-mono">{p.nodeId}</td>
                    <td className="ea-mono" style={{ fontSize: 12 }}>{p.endpoint}</td>
                    <td>
                      <Status tone={p.state === 'CONNECTED' ? 'success'
                                     : p.state === 'HANDSHAKING' ? 'info'
                                     : p.state === 'ERROR' ? 'danger' : 'muted'}>
                        {p.state}
                      </Status>
                    </td>
                    <td>
                      <Status tone={p.trust === 'TRUSTED' ? 'success'
                                     : p.trust === 'UNVERIFIED' ? 'warning' : 'danger'}>
                        {p.trust}
                      </Status>
                    </td>
                    <td className="ea-text-muted">
                      {p.reachable.length === 0 ? '—'
                        : p.reachable.map((r) => `${r.edgeFingerprint.slice(0, 8)}…(h${r.hops})`).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={`Transitive reachability · ${adjacency.length}`}
             action={<span className="ea-text-muted" style={{ fontSize: 12 }}>
               Lowest-hop route wins; direct peers = hop 1.
             </span>}>
        {adjacency.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
            No announced adjacencies yet. Peers announce theirs via
            <code> POST /peer-mesh/adjacency</code>.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>Via (local peer)</th><th>Reaches</th>
                <th>Hops</th><th>Announced</th>
              </tr></thead>
              <tbody>
                {adjacency.map((a) => (
                  <tr key={a.localPeerId + a.reachableEdge}>
                    <td className="ea-mono" style={{ fontSize: 12 }}>{a.localNodeId}</td>
                    <td className="ea-mono" style={{ fontSize: 11 }}
                        title={a.reachableEdge}>
                      {a.reachableEdge.slice(0, 24)}…
                    </td>
                    <td className="ea-mono">{a.hops}</td>
                    <td className="ea-text-muted">{fmtAgo(a.announcedAt)}</td>
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

function TopologySvg({ topology }: { topology: Topology }): JSX.Element {
  const peers = topology.peers;
  const centre = { x: 300, y: 180 };
  const radius = 130;
  const nodes = peers.map((p, i) => {
    const theta = (2 * Math.PI * i) / Math.max(1, peers.length);
    return {
      peer: p,
      x: centre.x + radius * Math.cos(theta),
      y: centre.y + radius * Math.sin(theta),
    };
  });
  return (
    <svg viewBox="0 0 600 360" style={{ width: '100%', maxHeight: 360,
                                         background: 'var(--der-raised)' }}>
      {nodes.map((n) => (
        <g key={n.peer.id}>
          <line x1={centre.x} y1={centre.y} x2={n.x} y2={n.y}
                stroke={n.peer.state === 'CONNECTED' ? 'var(--der-success-ink)'
                        : 'var(--der-border)'}
                strokeWidth={n.peer.state === 'CONNECTED' ? 2 : 1}
                strokeDasharray={n.peer.state === 'CONNECTED' ? '0' : '4 3'} />
          <circle cx={n.x} cy={n.y} r={28}
                  fill={n.peer.trust === 'TRUSTED' ? 'var(--der-success-wash)'
                        : 'var(--der-raised)'}
                  stroke={n.peer.trust === 'TRUSTED' ? 'var(--der-success-ink)'
                          : 'var(--der-border)'}
                  strokeWidth={1.5} />
          <text x={n.x} y={n.y + 4} textAnchor="middle"
                fontSize={11} fontFamily="monospace" fill="var(--der-ink-900)">
            {n.peer.nodeId.slice(0, 8)}
          </text>
          <text x={n.x} y={n.y + 44} textAnchor="middle"
                fontSize={10} fill="var(--der-ink-500)">
            {n.peer.state}
          </text>
        </g>
      ))}
      <circle cx={centre.x} cy={centre.y} r={38}
              fill="var(--der-primary)" stroke="var(--der-primary-ink)" strokeWidth={2} />
      <text x={centre.x} y={centre.y - 2} textAnchor="middle"
            fontSize={13} fontWeight={600} fill="#fff">this edge</text>
      <text x={centre.x} y={centre.y + 14} textAnchor="middle"
            fontSize={10} fontFamily="monospace" fill="#fff">
        {topology.self.fingerprint.slice(0, 8)}
      </text>
    </svg>
  );
}
