import { CANVAS_HEIGHT, CANVAS_WIDTH, CENTRE,
         layoutDevices, wanPosition } from './topologyLayout';
import { NetworkConnection } from './NetworkConnection';
import { DerCard, DeviceCard, WanBubble } from './NetworkNode';
import type { Connection, DerNode, DeviceNode, PeerNode, SelectedNode,
                WanInfo } from './types';

interface Props {
  der: DerNode;
  wan: WanInfo;
  devices: DeviceNode[];
  peers: PeerNode[];
  connections: Connection[];
  selected: SelectedNode | null;
  onSelect(node: SelectedNode | null): void;
}

/** Pure SVG canvas rendering centre + rings + edges. */
export function TopologyCanvas(props: Props): JSX.Element {
  // §2.3.69 — pilot scope is Devices → DER → DHIS2. Peer edges
  // (DER-to-DER) are suppressed from the canvas; the server may
  // still carry them in the response but the view intentionally
  // doesn't surface them.
  const { der, wan, devices, connections, selected, onSelect } = props;

  const deviceLaid = layoutDevices(devices);
  const wanPos = wanPosition();

  // Index of positions by node id for drawing connections.
  const pos: Record<string, { x: number; y: number }> = {
    der: CENTRE,
    wan: wanPos,
  };
  deviceLaid.forEach((d) => { pos[d.node.id] = { x: d.x, y: d.y }; });
  // Peers deliberately not laid out (see note above).

  // §2.3.70 — flow resolution. An enrolled APPROVED device whose
  // heartbeat is stale still participates in the workflow fabric;
  // its device-DER edge gets a dim slow flow so admins see the
  // device is part of the fleet. SUSPENDED/REVOKED devices show no
  // flow at all; devices with a live heartbeat get the normal
  // status-based animation.
  const deviceById: Record<string, DeviceNode> = {};
  devices.forEach((d) => { deviceById[d.id] = d; });
  function resolveFlow(c: Connection): 'full' | 'dim' | 'none' {
    const targetDev = deviceById[c.target];
    const sourceDev = deviceById[c.source];
    if (c.status === 'online') return 'full';
    if (c.status === 'degraded') return 'dim';
    // Edge is offline — fall back to deviceStatus if either endpoint
    // is an approved device so the fleet connectivity still reads.
    if (targetDev?.deviceStatus === 'APPROVED'
        || sourceDev?.deviceStatus === 'APPROVED') return 'dim';
    return 'none';
  }

  const isSel = (kind: SelectedNode['kind'], id: string): boolean =>
    selected !== null && selected.kind === kind
      && (kind === 'der' ? true
          : kind === 'wan' ? true
          : (selected as { id: string }).id === id);

  return (
    <div style={{ background: 'var(--der-raised)', border: '1px solid var(--der-border)',
                   borderRadius: 6, overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
           role="img"
           aria-label="Facility mesh topology"
           style={{ width: '100%', maxHeight: 760, display: 'block' }}
           preserveAspectRatio="xMidYMid meet">
        {/* Edges first so cards sit on top. */}
        {/* DER → WAN (vertical dashed, WAN-tone) */}
        <NetworkConnection x1={CENTRE.x} y1={CENTRE.y}
                            x2={wanPos.x} y2={wanPos.y}
                            type="wan" status={wan.status} />
        {connections
          // §2.3.70 — pilot scope is Devices → DER → DHIS2 for the
          // edge-to-edge layer. We drop EDGE-level peer links only
          // (DER-to-peer, where source or target is a `peer-*` node);
          // device-to-device p2p adjacencies between facility devices
          // remain visible so admins see short-range links (e.g. WiFi
          // Direct, BT) between stations.
          .filter((c) =>
            !(c.source === 'der' && c.target.startsWith('peer-'))
            && !c.source.startsWith('peer-')
            && !c.target.startsWith('peer-'))
          .map((c, i) => {
            const a = pos[c.source];
            const b = pos[c.target];
            if (!a || !b) return null;
            return (
              <NetworkConnection key={`e${i}`}
                                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                                  type={c.type} status={c.status}
                                  flow={resolveFlow(c)} />
            );
          })}

        {/* Cards */}
        <WanBubble x={wanPos.x} y={wanPos.y}
                    status={wan.status}
                    selected={isSel('wan', '')}
                    onSelect={() => onSelect({ kind: 'wan', ...wan })} />

        <DerCard x={CENTRE.x} y={CENTRE.y}
                  der={der}
                  selected={isSel('der', '')}
                  onSelect={() => onSelect({ kind: 'der', ...der })} />

        {deviceLaid.map((d) => (
          <DeviceCard key={d.node.id}
                       x={d.x} y={d.y}
                       device={d.node}
                       selected={isSel('device', d.node.id)}
                       onSelect={() => onSelect({ kind: 'device', ...d.node })} />
        ))}

        {/* Peer cards suppressed — pilot scope is Devices → DER → DHIS2. */}
      </svg>
    </div>
  );
}
