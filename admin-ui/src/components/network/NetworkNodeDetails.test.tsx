import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NetworkNodeDetails } from './NetworkNodeDetails';
import type { SelectedNode } from './types';

const derNode: SelectedNode = {
  kind: 'der',
  id: 'der',
  name: 'Facility DER',
  type: 'edge',
  status: 'online',
  fingerprint: 'ab:cd:ef',
  ipAddress: '10.88.0.1',
  hostname: 'der.local',
  centralBridge: true,
};
const wanNode: SelectedNode = {
  kind: 'wan',
  status: 'degraded',
  state: 'DNS failure',
  centralDhis2Available: false,
  internetAvailable: true,
  lastProbeAt: '2026-11-03T12:00:00Z',
  centralIsLocal: false,
};
const deviceNode: SelectedNode = {
  kind: 'device',
  id: 'd-1',
  name: 'Tablet 1',
  type: 'tablet',
  formFactor: 'TABLET',
  status: 'degraded',
  lastSeen: '2026-11-03T11:00:00Z',
  userAgent: 'Chrome/120',
  firmwareVersion: '1.2.3',
  deviceStatus: 'APPROVED',
  sync: { state: 'syncing', pending: 5 },
};
const peerNode: SelectedNode = {
  kind: 'peer',
  id: 'peer-1',
  name: 'Nakivale',
  type: 'peer-edge',
  status: 'online',
  endpoint: 'https://nakivale.local',
  state: 'CONNECTED',
  trust: 'TRUSTED',
  lastHandshake: '2026-11-03T10:00:00Z',
};

describe('NetworkNodeDetails', () => {
  it('shows the empty hint when nothing selected', () => {
    render(<NetworkNodeDetails selected={null} />);
    expect(screen.getByText(/Click a node to inspect it/i)).toBeInTheDocument();
  });
  it('renders DER node rows', () => {
    render(<NetworkNodeDetails selected={derNode} />);
    expect(screen.getByText('Facility DER')).toBeInTheDocument();
    expect(screen.getByText('Facility Server')).toBeInTheDocument();
    expect(screen.getByText('10.88.0.1')).toBeInTheDocument();
    expect(screen.getByText('der.local')).toBeInTheDocument();
    expect(screen.getByText('ab:cd:ef')).toBeInTheDocument();
  });
  it('renders DER with local-only centralBridge', () => {
    render(<NetworkNodeDetails selected={{ ...derNode, centralBridge: false }} />);
    expect(screen.getByText('Local only')).toBeInTheDocument();
  });
  it('renders WAN node rows and omits null lastProbeAt', () => {
    const { unmount } = render(<NetworkNodeDetails selected={wanNode} />);
    expect(screen.getAllByText('Central DHIS2').length).toBeGreaterThan(0);
    expect(screen.getByText('DNS failure')).toBeInTheDocument();
    expect(screen.getByText('Unreachable')).toBeInTheDocument();
    expect(screen.getByText('Reachable')).toBeInTheDocument();
    unmount();
    render(<NetworkNodeDetails selected={{ ...wanNode, lastProbeAt: null }} />);
    expect(screen.queryByText('Last probe')).toBeNull();
  });
  it('renders Device node rows including Mobile labels', () => {
    render(<NetworkNodeDetails selected={deviceNode} />);
    expect(screen.getByText('Tablet 1')).toBeInTheDocument();
    expect(screen.getByText('Tablet')).toBeInTheDocument();
    expect(screen.getByText('syncing')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('APPROVED')).toBeInTheDocument();
    expect(screen.getByText('1.2.3')).toBeInTheDocument();
    expect(screen.getByText('Chrome/120')).toBeInTheDocument();
  });
  it('renders Device with no lastSeen without crashing', () => {
    render(<NetworkNodeDetails selected={{ ...deviceNode, lastSeen: null }} />);
    expect(screen.getByText('Tablet 1')).toBeInTheDocument();
  });
  it('renders Peer node rows', () => {
    render(<NetworkNodeDetails selected={peerNode} />);
    expect(screen.getByText('Nakivale')).toBeInTheDocument();
    expect(screen.getByText('https://nakivale.local')).toBeInTheDocument();
    expect(screen.getByText('CONNECTED')).toBeInTheDocument();
    expect(screen.getByText('TRUSTED')).toBeInTheDocument();
  });
  it('handles peer with null lastHandshake', () => {
    render(<NetworkNodeDetails selected={{ ...peerNode, lastHandshake: null }} />);
    expect(screen.getByText('Nakivale')).toBeInTheDocument();
  });
  it('handles device with empty formFactor edge case', () => {
    render(<NetworkNodeDetails selected={{ ...deviceNode, formFactor: '' as never }} />);
    // titleCase('') returns ''
    expect(screen.getByText('Tablet 1')).toBeInTheDocument();
  });
});
