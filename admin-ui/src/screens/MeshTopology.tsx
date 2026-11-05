import { useEffect, useMemo, useState } from 'react';
import { Panel, SyncStatusBar, Status, fmtAgo } from './shared';
import { UiIcon } from '../components/UiIcon';
import { NetworkLegend } from '../components/network/NetworkLegend';
import { NetworkSummary } from '../components/network/NetworkSummary';
import { NetworkNodeDetails } from '../components/network/NetworkNodeDetails';
import { TopologyCanvas } from '../components/network/TopologyCanvas';
import { useMeshTopology } from '../components/network/useMeshTopology';
import type { SelectedNode } from '../components/network/types';

interface AdjacencyRow {
  localPeerId: string;
  localNodeId: string;
  localEndpoint: string;
  reachableEdge: string;
  hops: number;
  announcedAt: string;
}

/** Facility mesh — DER centre + facility devices + peer edges + WAN.
 *  Spec: docs/media/DER Mesh Topology — Claude Implementation Instruction.md */
export function MeshTopology(): JSX.Element {
  const { topology, loading, error, reload } = useMeshTopology(15000);
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [adjacency, setAdjacency] = useState<AdjacencyRow[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/edge-api/v1/peer-mesh/adjacency', { credentials: 'include' });
        if (r.ok) {
          const body = await r.json() as { adjacency?: AdjacencyRow[] };
          setAdjacency(body.adjacency ?? []);
        }
      } catch { /* ignore */ }
    })();
  }, [topology]);

  // On first topology arrival, default-select the DER node so the right
  // panel has content immediately.
  useEffect(() => {
    if (topology !== null && selected === null) {
      setSelected({ kind: 'der', ...topology.der });
    }
  }, [topology, selected]);

  const summary = topology?.summary ?? null;
  const headerTone = useMemo(() => {
    if (!summary) return 'muted';
    if (summary.devicesOffline > 0) return 'warning';
    if (summary.devicesOnline > 0) return 'success';
    return 'muted';
  }, [summary]);

  return (
    <div className="ea-screen" data-test="mesh-topology">
      <SyncStatusBar
        tone={headerTone}
        title="Facility Mesh"
        statusLabel={summary
          ? `${summary.devicesOnline}/${summary.devices} devices · ${summary.peersConnected}/${summary.peers} peers · WAN ${summary.wanStatus}`
          : (loading ? 'loading…' : 'no topology data')}
        actions={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
            <NetworkLegend />
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    aria-label="Refresh topology"
                    onClick={() => { reload().catch(() => undefined); }}>
              <UiIcon icon="refresh" size={14} /><span>Refresh</span>
            </button>
          </span>
        }
      />

      {error && (
        <Panel title="Network topology unavailable">
          <p style={{ margin: 0, padding: 12 }}>
            The DER network monitoring service could not be reached ({error}).
            <br />
            <button type="button" className="ea-btn ea-btn--sm" style={{ marginTop: 8 }}
                    onClick={() => { reload().catch(() => undefined); }}>Retry</button>
          </p>
        </Panel>
      )}

      {!error && topology && (
        <div className="ea-mesh-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2.3fr) minmax(260px, 1fr)',
          gap: 16,
        }}>
          <Panel title="Live topology">
            <TopologyCanvas
              der={topology.der}
              wan={topology.wan}
              devices={topology.devices}
              peers={topology.peers}
              connections={topology.connections}
              selected={selected}
              onSelect={setSelected}
            />
          </Panel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Network status">
              {summary && <NetworkSummary summary={summary} />}
            </Panel>
            <Panel title="Selected node">
              <NetworkNodeDetails selected={selected} />
            </Panel>
          </div>
        </div>
      )}

      {!error && topology !== null && topology.devices.length === 0 && topology.peers.length === 0 && (
        <Panel title="No devices discovered">
          <p style={{ margin: 0, padding: 12 }}>
            DER is running, but no client devices are currently visible on the facility network.
            Enrol a device at <strong>/devices</strong>.
          </p>
        </Panel>
      )}

      {/* Legacy tables kept for machine-readable detail. */}
      <Panel title={`Direct peers · ${topology?.peers.length ?? 0}`}>
        {(topology?.peers.length ?? 0) === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
            No peers configured. Add one via <strong>/network/peers</strong>.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense" aria-label="Direct peers">
              <thead><tr>
                <th scope="col">Node ID</th>
                <th scope="col">Endpoint</th>
                <th scope="col">State</th>
                <th scope="col">Trust</th>
                <th scope="col">Last handshake</th>
              </tr></thead>
              <tbody>
                {(topology?.peers ?? []).map((p) => (
                  <tr key={p.id}>
                    <td className="ea-mono">{p.name}</td>
                    <td className="ea-mono" style={{ fontSize: 12 }}>{p.endpoint}</td>
                    <td>
                      <Status tone={p.status === 'online' ? 'success'
                                     : p.status === 'degraded' ? 'warning' : 'danger'}>
                        {(p.state ?? 'UNKNOWN').toUpperCase()}
                      </Status>
                    </td>
                    <td>
                      <Status tone={p.trust === 'TRUSTED' ? 'success'
                                     : p.trust === 'UNVERIFIED' ? 'warning' : 'danger'}>
                        {p.trust ?? '—'}
                      </Status>
                    </td>
                    <td className="ea-text-muted">
                      {p.lastHandshake ? fmtAgo(p.lastHandshake) : '—'}
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
            No announced adjacencies yet.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense" aria-label="Transitive reachability">
              <thead><tr>
                <th scope="col">Via (local peer)</th>
                <th scope="col">Reaches</th>
                <th scope="col">Hops</th>
                <th scope="col">Announced</th>
              </tr></thead>
              <tbody>
                {adjacency.map((a) => (
                  <tr key={a.localPeerId + a.reachableEdge}>
                    <td className="ea-mono" style={{ fontSize: 12 }}>{a.localNodeId}</td>
                    <td className="ea-mono" style={{ fontSize: 11 }} title={a.reachableEdge}>
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
