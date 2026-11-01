import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getSimulateMode, resolveSimulate,
         subscribeSimulateMode } from '../../features/demo/simulateStore';
import { CANVAS_HEIGHT, CANVAS_WIDTH, CENTRE,
         internetPosition, layoutDevices, wanPosition } from './topologyLayout';
import { NetworkConnection } from './NetworkConnection';
import { DerCard, DeviceCard, InternetBubble, WanBubble } from './NetworkNode';
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
  const internetPos = internetPosition();
  // §2.3.74 — Simulated Internet state. The simulate preference is
  // owned by Settings (persisted in localStorage via simulateStore);
  // this component subscribes so the dashboard reacts live when the
  // operator flips the mode on the Settings page.
  //
  // Mode resolution:
  //   auto → simulate iff wan.centralIsLocal (dev/CI loopback)
  //   on   → always simulate (useful for walkthrough on real hw)
  //   off  → never simulate; show live probe truthfully
  //
  // Up-time ∈ [25, 60] s, down-time ∈ [6, 15] s. These numbers were
  // chosen so a reviewer waits long enough to see a sustained live
  // picture but never more than ~15 s to witness a drop.
  const simulateMode = useSyncExternalStore(subscribeSimulateMode, getSimulateMode);
  const simulate = resolveSimulate(simulateMode, Boolean(wan.centralIsLocal));
  const [simOnline, setSimOnline] = useState<boolean>(true);
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!simulate) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    function schedule(): void {
      // Longer dwells in ON state, shorter in OFF — matches real
      // uplinks (occasional short drops in an otherwise-ok link).
      const dwellMs = simOnline
        ? 25_000 + Math.random() * 35_000
        : 6_000 + Math.random() * 9_000;
      timerRef.current = window.setTimeout(() => {
        setSimOnline((v) => !v);
      }, dwellMs);
    }
    schedule();
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [simulate, simOnline]);

  const internetOnline = simulate ? simOnline : wan.internetAvailable;
  const internetStatus: 'online' | 'offline' = internetOnline ? 'online' : 'offline';
  // 'simulated' marks the state as a simulator value so the manual
  // chip in InternetBubble can distinguish it from the live probe.
  const internetSimulated = simulate;

  // Index of positions by node id for drawing connections.
  const pos: Record<string, { x: number; y: number }> = {
    der: CENTRE,
    wan: wanPos,
  };
  deviceLaid.forEach((d) => { pos[d.node.id] = { x: d.x, y: d.y }; });
  // Peers deliberately not laid out (see note above).

  // §2.3.71 — strict device-online gating. Clinical reality: no
  // packets leave a device that is offline, so no particles should
  // either. Flow is drawn only when every endpoint of the edge is
  // actually reachable:
  //
  //   - device↔DER edge: animates iff that device.status === 'online'
  //   - device↔device edge: animates iff BOTH devices are online
  //   - any 'offline' link status overrides to no flow
  //
  // Enrolment state (APPROVED / SUSPENDED) no longer promotes a
  // stale device to a "dim" flow — if the heartbeat is stale we
  // want admins to see a static line, same as a plug pulled out.
  const deviceById: Record<string, DeviceNode> = {};
  devices.forEach((d) => { deviceById[d.id] = d; });
  function endpointOnline(id: string): boolean {
    if (id === 'der') return der.status === 'online';
    if (id === 'wan') return wan.status === 'online';
    const d = deviceById[id];
    return d?.status === 'online';
  }
  function resolveFlow(c: Connection): 'full' | 'dim' | 'none' {
    if (c.status === 'offline') return 'none';
    if (!endpointOnline(c.source) || !endpointOnline(c.target)) return 'none';
    if (c.status === 'degraded') return 'dim';
    return 'full';
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
        {/* DER → Internet (lower half of the WAN column). Status
            = internetAvailable; particles suppressed when OFF. */}
        <NetworkConnection x1={CENTRE.x} y1={CENTRE.y}
                            x2={internetPos.x} y2={internetPos.y}
                            type="wan" status={internetStatus}
                            flow={internetOnline ? 'full' : 'none'} />
        {/* Internet → DHIS2 Central (upper half). Status mirrors
            the WAN endpoint but animation only runs when Internet
            is on AND the central endpoint is reachable. */}
        <NetworkConnection x1={internetPos.x} y1={internetPos.y}
                            x2={wanPos.x} y2={wanPos.y}
                            type="wan" status={wan.status}
                            flow={!internetOnline ? 'none'
                                  : wan.status === 'online' ? 'full'
                                  : wan.status === 'degraded' ? 'dim'
                                  : 'none'} />
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
        <InternetBubble x={internetPos.x} y={internetPos.y}
                         status={internetStatus}
                         selected={false}
                         simulated={internetSimulated}
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
