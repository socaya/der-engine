import { CANVAS_HEIGHT, CANVAS_WIDTH, CENTRE, DEVICE_RING_RADIUS,
         PEER_RING_RADIUS, ringLayout, wanPosition } from './topologyLayout';
import { NetworkConnection } from './NetworkConnection';
import { DerCard, DeviceCard, PeerCard, WanBubble } from './NetworkNode';
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
  const { der, wan, devices, peers, connections, selected, onSelect } = props;

  const deviceLaid = ringLayout(devices, DEVICE_RING_RADIUS);
  const peerLaid = ringLayout(peers, PEER_RING_RADIUS);
  const wanPos = wanPosition();

  // Index of positions by node id for drawing connections.
  const pos: Record<string, { x: number; y: number }> = {
    der: CENTRE,
    wan: wanPos,
  };
  deviceLaid.forEach((d) => { pos[d.node.id] = { x: d.x, y: d.y }; });
  peerLaid.forEach((p) => { pos[p.node.id] = { x: p.x, y: p.y }; });

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
           style={{ width: '100%', maxHeight: 620, display: 'block' }}
           preserveAspectRatio="xMidYMid meet">
        {/* Edges first so cards sit on top. */}
        {/* DER → WAN (vertical dashed, WAN-tone) */}
        <NetworkConnection x1={CENTRE.x} y1={CENTRE.y}
                            x2={wanPos.x} y2={wanPos.y}
                            type="wan" status={wan.status} />
        {connections.map((c, i) => {
          const a = pos[c.source];
          const b = pos[c.target];
          if (!a || !b) return null;
          return (
            <NetworkConnection key={`e${i}`}
                                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                                type={c.type} status={c.status} />
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

        {peerLaid.map((p) => (
          <PeerCard key={p.node.id}
                     x={p.x} y={p.y}
                     peer={p.node}
                     selected={isSel('peer', p.node.id)}
                     onSelect={() => onSelect({ kind: 'peer', ...p.node })} />
        ))}
      </svg>
    </div>
  );
}
