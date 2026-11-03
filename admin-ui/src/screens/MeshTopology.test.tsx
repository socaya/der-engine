import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { MeshTopology } from './MeshTopology';
import type { TopologyResponse } from '../components/network/types';

const topologyFull: TopologyResponse = {
  site: { id: 's1', name: 'Clinic' },
  wan: { status: 'online', state: 'OK',
          centralDhis2Available: true, internetAvailable: true,
          lastProbeAt: '2026-11-03T12:00:00Z', centralIsLocal: false },
  der: { id: 'der', name: 'DER-1', type: 'edge', status: 'online',
          fingerprint: 'fp', ipAddress: '10.0.0.1',
          hostname: 'der.local', centralBridge: true },
  devices: [{
    id: 'd1', name: 'Tablet 1', type: 'tablet',
    formFactor: 'TABLET', status: 'online',
    lastSeen: '2026-11-03T12:00:00Z',
    userAgent: null, firmwareVersion: null, deviceStatus: 'APPROVED',
    sync: { state: 'synced', pending: 0 },
  }],
  peers: [{
    id: 'peer-1', name: 'Peer 1', type: 'peer-edge', status: 'online',
    endpoint: 'https://p.local', state: 'CONNECTED', trust: 'TRUSTED',
    lastHandshake: '2026-11-03T11:00:00Z',
  }],
  connections: [{
    source: 'der', target: 'd1', type: 'ethernet', status: 'online',
  }],
  summary: {
    devices: 1, devicesOnline: 1, devicesDegraded: 0, devicesOffline: 0,
    syncQueueTotal: 0, peers: 1, peersConnected: 1, wanStatus: 'online',
  },
};

const topologyEmpty: TopologyResponse = {
  ...topologyFull,
  devices: [], peers: [], connections: [],
  summary: { ...topologyFull.summary,
             devices: 0, devicesOnline: 0, peers: 0, peersConnected: 0 },
};

function okResp(body: unknown): Response {
  return new Response(JSON.stringify(body),
    { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('MeshTopology screen', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  const mkFetch = (body: TopologyResponse): typeof fetch =>
    vi.fn(async (url: unknown) => {
      if (String(url).includes('/peer-mesh/adjacency')) {
        return okResp({ adjacency: [] });
      }
      return okResp(body);
    }) as never;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch' as never)
      .mockImplementation(mkFetch(topologyFull) as never) as never;
  });
  afterEach(() => { fetchSpy.mockRestore(); });

  it('mounts and renders the topology canvas on load', async () => {
    renderWithProviders(<MeshTopology />);
    await waitFor(() =>
      expect(screen.getByRole('img', { name: /Facility mesh topology/ }))
        .toBeInTheDocument());
    expect(screen.getByTestId('mesh-topology')).toBeInTheDocument();
    expect(screen.getByLabelText('Direct peers')).toBeInTheDocument();
  });
  it('shows summary line with device/peer counts', async () => {
    renderWithProviders(<MeshTopology />);
    await waitFor(() =>
      expect(screen.getByText(/1\/1 devices · 1\/1 peers · WAN online/))
        .toBeInTheDocument());
  });
  it('shows error panel when topology fetch fails', async () => {
    fetchSpy.mockImplementation(vi.fn(async (url: unknown) => {
      if (String(url).includes('/peer-mesh/adjacency')) return okResp({ adjacency: [] });
      return new Response('', { status: 500 });
    }) as never);
    renderWithProviders(<MeshTopology />);
    await waitFor(() => expect(
      screen.getByText(/Network topology unavailable/)).toBeInTheDocument());
    // Clicking retry calls reload (fetch again).
    await userEvent.click(screen.getByText('Retry'));
  });
  it('shows no-devices panel when devices + peers are both empty', async () => {
    fetchSpy.mockImplementation(mkFetch(topologyEmpty) as never);
    renderWithProviders(<MeshTopology />);
    await waitFor(() =>
      expect(screen.getByText(/No devices discovered/)).toBeInTheDocument());
  });
  it('refresh button triggers a reload', async () => {
    renderWithProviders(<MeshTopology />);
    await waitFor(() =>
      expect(screen.getByText('DER-1')).toBeInTheDocument());
    const before = fetchSpy.mock.calls.length;
    await userEvent.click(screen.getByLabelText('Refresh topology'));
    await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(before));
  });
  it('selecting a device updates the Selected node panel', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MeshTopology />);
    await waitFor(() => expect(screen.getByText('DER-1')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Tablet 1/ }));
    // The right-column panel now reflects the device name.
    expect(screen.getAllByText('Tablet 1').length).toBeGreaterThan(1);
  });
  it('renders peer rows in the direct-peers table', async () => {
    renderWithProviders(<MeshTopology />);
    await waitFor(() =>
      expect(screen.getByLabelText('Direct peers')).toBeInTheDocument());
    expect(screen.getAllByText(/CONNECTED/).length).toBeGreaterThan(0);
    expect(screen.getByText('https://p.local')).toBeInTheDocument();
    expect(screen.getByText('TRUSTED')).toBeInTheDocument();
  });
  it('renders transitive adjacency empty state', async () => {
    renderWithProviders(<MeshTopology />);
    await waitFor(() =>
      expect(screen.getByText(/No announced adjacencies yet/)).toBeInTheDocument());
  });
  it('renders transitive adjacency rows when the endpoint returns some', async () => {
    fetchSpy.mockImplementation(vi.fn(async (url: unknown) => {
      if (String(url).includes('/peer-mesh/adjacency')) {
        return okResp({
          adjacency: [{
            localPeerId: 'p1', localNodeId: 'n1',
            localEndpoint: 'https://p.local', reachableEdge: 'edge-xyzuvwqrstuvwxyz',
            hops: 2, announcedAt: '2026-11-03T12:00:00Z',
          }],
        });
      }
      return okResp(topologyFull);
    }) as never);
    renderWithProviders(<MeshTopology />);
    await waitFor(() =>
      expect(screen.getByLabelText('Transitive reachability')).toBeInTheDocument());
    expect(screen.getByText('n1')).toBeInTheDocument();
  });
});
