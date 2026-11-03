import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TopologyCanvas } from './TopologyCanvas';
import type { Connection, DerNode, DeviceNode, PeerNode,
               SelectedNode, WanInfo } from './types';

const der: DerNode = {
  id: 'der', name: 'DER',
  type: 'edge', status: 'online', fingerprint: 'fp',
  ipAddress: '1.1.1.1', hostname: 'der', centralBridge: true,
};
const wan: WanInfo = {
  status: 'online', state: 'OK', centralDhis2Available: true,
  internetAvailable: true, lastProbeAt: null, centralIsLocal: false,
};
function dev(id: string, status: DeviceNode['status']): DeviceNode {
  return {
    id, name: `Tablet ${id}`, type: 'tablet',
    formFactor: 'TABLET', status, lastSeen: null,
    userAgent: null, firmwareVersion: null, deviceStatus: 'APPROVED',
    sync: { state: 'synced', pending: 0 },
  };
}
const peer: PeerNode = {
  id: 'peer-1', name: 'Peer1', type: 'peer-edge', status: 'online',
  endpoint: 'https://p', state: 'CONNECTED', trust: 'TRUSTED',
  lastHandshake: null,
};

describe('TopologyCanvas', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('renders DER, WAN, and device cards', () => {
    const devices = [dev('d1', 'online'), dev('d2', 'offline')];
    render(<TopologyCanvas der={der} wan={wan} devices={devices}
                            peers={[]} connections={[]} selected={null}
                            onSelect={() => {}} />);
    expect(screen.getByRole('img', { name: /Facility mesh topology/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /DER Edge Runtime/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Central DHIS2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tablet d1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tablet d2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Internet gateway/ })).toBeInTheDocument();
  });
  it('filters peer-prefixed connections from the drawn edges', () => {
    const connections: Connection[] = [
      { source: 'der', target: 'peer-1', type: 'p2p', status: 'online' },
      { source: 'peer-1', target: 'der', type: 'p2p', status: 'online' },
      { source: 'der', target: 'd1', type: 'ethernet', status: 'online' },
    ];
    render(<TopologyCanvas der={der} wan={wan} devices={[dev('d1', 'online')]}
                            peers={[peer]} connections={connections}
                            selected={null} onSelect={() => {}} />);
    // Peer cards should NOT render (pilot scope suppresses them).
    expect(screen.queryByRole('button', { name: /Peer edge/ })).toBeNull();
  });
  it('calls onSelect when DER card is clicked', () => {
    const onSelect = vi.fn<(sel: SelectedNode | null) => void>();
    render(<TopologyCanvas der={der} wan={wan} devices={[]} peers={[]}
                            connections={[]} selected={null}
                            onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /DER Edge Runtime/ }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'der', id: 'der' }));
  });
  it('calls onSelect when a device card is clicked', () => {
    const onSelect = vi.fn();
    render(<TopologyCanvas der={der} wan={wan} devices={[dev('d1', 'online')]}
                            peers={[]} connections={[]} selected={null}
                            onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Tablet d1/ }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'device', id: 'd1' }));
  });
  it('calls onSelect when WAN bubble clicked', () => {
    const onSelect = vi.fn();
    render(<TopologyCanvas der={der} wan={wan} devices={[]} peers={[]}
                            connections={[]} selected={null}
                            onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Central DHIS2/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ kind: 'wan' }));
  });
  it('reflects selected prop on DER card', () => {
    const selected: SelectedNode = { kind: 'der', ...der };
    render(<TopologyCanvas der={der} wan={wan} devices={[]} peers={[]}
                            connections={[]} selected={selected}
                            onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: /DER Edge Runtime/ })).toBeInTheDocument();
  });
  it('reflects selected prop on a device', () => {
    const d = dev('dX', 'online');
    const selected: SelectedNode = { kind: 'device', ...d };
    render(<TopologyCanvas der={der} wan={wan} devices={[d]} peers={[]}
                            connections={[]} selected={selected}
                            onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: /Tablet dX/ })).toBeInTheDocument();
  });
  it('resolves degraded edge to dim flow', () => {
    const connections: Connection[] = [
      { source: 'der', target: 'd1', type: 'wifi', status: 'degraded' },
    ];
    render(<TopologyCanvas der={der} wan={wan} devices={[dev('d1', 'online')]}
                            peers={[]} connections={connections}
                            selected={null} onSelect={() => {}} />);
    // Just renders without error — animation detail is in NetworkConnection.
    expect(screen.getByRole('img', { name: /Facility mesh/ })).toBeInTheDocument();
  });
  it('offline endpoint suppresses flow particles', () => {
    const connections: Connection[] = [
      { source: 'der', target: 'd1', type: 'wifi', status: 'online' },
    ];
    render(<TopologyCanvas der={der} wan={wan} devices={[dev('d1', 'offline')]}
                            peers={[]} connections={connections}
                            selected={null} onSelect={() => {}} />);
    expect(screen.getByRole('img', { name: /Facility mesh/ })).toBeInTheDocument();
  });
  it('ignores connection where endpoint position is missing', () => {
    const connections: Connection[] = [
      { source: 'ghost', target: 'der', type: 'wifi', status: 'online' },
    ];
    render(<TopologyCanvas der={der} wan={wan} devices={[]} peers={[]}
                            connections={connections} selected={null}
                            onSelect={() => {}} />);
    expect(screen.getByRole('img', { name: /Facility mesh/ })).toBeInTheDocument();
  });
});
