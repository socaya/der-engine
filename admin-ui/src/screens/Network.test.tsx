import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import {
  NetworkOverview,
  NetworkAccessPoint,
  NetworkConnectedDevices,
  NetworkInterfaces,
  NetworkPeers,
  NetworkSecurity,
  NetworkDiagnostics,
  NetworkSettings,
} from './Network';
import type { NetworkInterface, NetworkPeer, NetworkRoute } from '../api/edgeApi';
import * as edgeApi from '../api/edgeApi';

const authApi = {
  session: vi.fn().mockResolvedValue({
    userId: 'u1', username: 'admin', displayName: 'Admin',
    roles: ['ADMIN'], expiresAt: '2027-01-01T00:00:00Z',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

/* The Network screens hit a lot of /edge-api/v1/network/* endpoints
 * each. Give every spy-able edgeApi function a never-resolving stub
 * so each sub-component sits in its loading state; the key assertion
 * is that the import + mount path works end-to-end. */
function stubEverythingPending(): void {
  const noop = (): Promise<never> => new Promise(() => undefined);
  const mod = edgeApi as unknown as Record<string, unknown>;
  for (const key of Object.keys(mod)) {
    if (typeof mod[key] === 'function') {
      try {
        (vi.spyOn(mod, key as never) as { mockImplementation(impl: unknown): unknown })
          .mockImplementation(noop);
      } catch { /* some exports (EdgeApiError, non-function helpers) can't be spied */ }
    }
  }
}

interface MountCase { name: string; component: () => JSX.Element; route?: string }

const screens: MountCase[] = [
  { name: 'NetworkOverview', component: NetworkOverview },
  { name: 'NetworkAccessPoint', component: NetworkAccessPoint },
  { name: 'NetworkConnectedDevices', component: NetworkConnectedDevices },
  { name: 'NetworkInterfaces', component: NetworkInterfaces },
  { name: 'NetworkPeers', component: NetworkPeers },
  { name: 'NetworkSecurity', component: NetworkSecurity },
  { name: 'NetworkDiagnostics', component: NetworkDiagnostics },
  { name: 'NetworkSettings', component: NetworkSettings },
];

describe('Network — sub-screen surface mount test', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  for (const sc of screens) {
    it(`${sc.name} mounts without throwing`, () => {
      stubEverythingPending();
      const Comp = sc.component;
      const { container } = renderWithProviders(<Comp />,
        { authApi, route: sc.route ?? '/' });
      expect(container.firstChild).not.toBeNull();
    });
  }
});

describe('NetworkOverview — loaded branches', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  function stubAgentPending(): void {
    /* Agent unavailable: every probe rejects → "service missing" hint. */
    const mod = edgeApi as unknown as Record<string, unknown>;
    for (const key of Object.keys(mod)) {
      if (typeof mod[key] === 'function') {
        try {
          (vi.spyOn(mod, key as never) as { mockRejectedValue(e: unknown): unknown })
            .mockRejectedValue(new Error('agent not deployed'));
        } catch { /* skip */ }
      }
    }
  }

  function stubAgentHealthy(stateOverride?: string): void {
    vi.spyOn(edgeApi, 'networkStatus').mockResolvedValue({
      state: stateOverride ?? 'CONNECTED',
      centralDhis2Available: true,
      wanInterface: 'eth0',
      lanInterface: 'wlan0',
      lastTickAt: '2026-11-03T12:00:00Z',
    } as unknown as edgeApi.NetworkStatus);
    vi.spyOn(edgeApi, 'networkAccessPoint').mockResolvedValue({
      running: true, ssid: 'DER-EDGE',
      channel: 6, hidden: false, bssid: 'aa:bb:cc:dd:ee:ff',
    } as unknown as edgeApi.AccessPointStatus);
    vi.spyOn(edgeApi, 'networkEvents').mockResolvedValue({
      events: [
        { eventType: 'CLIENT_CONNECT', occurredAt: '2026-11-03T11:00:00Z',
          severity: 'INFO', detail: '{"mac":"aa:bb"}' },
      ],
    } as never);
    vi.spyOn(edgeApi, 'networkClients').mockResolvedValue({
      clients: [
        { mac: 'aa:bb', ip: '10.0.0.5', hostname: 'tab-01',
          lastSeenAt: '2026-11-03T11:00:00Z',
          signalDbm: -55, rxBytes: 0, txBytes: 0 },
      ],
    } as never);
    vi.spyOn(edgeApi, 'networkPeers').mockResolvedValue({
      peers: [{ peerId: 'peer-1', displayName: 'Peer edge',
                 endpoint: '10.0.1.1:51820',
                 lastHandshakeAt: 'now', state: 'CONNECTED' }],
    } as never);
    vi.spyOn(edgeApi, 'dhis2Ping').mockResolvedValue({
      reachable: true, probeDurationMs: 42, latencyMs: 42,
      probedAt: 'now', message: null, centralVersion: '2.44',
    } as unknown as edgeApi.PingSnapshot);
  }

  it('all probes reject → service-missing hint', async () => {
    stubAgentPending();
    renderWithProviders(<NetworkOverview />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('network-service-missing'))
        .toBeInTheDocument());
  });

  it('CONNECTED state + agent probes resolve → success tone + stats', async () => {
    stubAgentHealthy('CONNECTED');
    renderWithProviders(<NetworkOverview />, { authApi });
    await waitFor(() =>
      expect(screen.getByText('Running')).toBeInTheDocument());
    /* Access-point running + SSID + peer count surface. */
    expect(screen.getByText('DER-EDGE')).toBeInTheDocument();
  });

  it('OFFLINE_FIRST state → warning tone label', async () => {
    stubAgentHealthy('OFFLINE_FIRST');
    renderWithProviders(<NetworkOverview />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('network-overview'))
        .toBeInTheDocument());
    /* The state name surfaces as part of the humanState label. */
    expect(document.body.textContent ?? '').toMatch(/Offline/i);
  });

  it('RECOVERING state → warning tone', async () => {
    stubAgentHealthy('RECOVERING');
    renderWithProviders(<NetworkOverview />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('network-overview'))
        .toBeInTheDocument());
    expect(document.body.textContent ?? '').toMatch(/Recovering/i);
  });

  it('unknown state value → danger tone fallback', async () => {
    stubAgentHealthy('DEGRADED');
    renderWithProviders(<NetworkOverview />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('network-overview'))
        .toBeInTheDocument());
  });

  it('access-point stopped but status loaded → "Stopped" label', async () => {
    stubAgentHealthy('CONNECTED');
    vi.spyOn(edgeApi, 'networkAccessPoint').mockResolvedValue({
      running: false, ssid: null, channel: null, hidden: false,
      bssid: null,
    } as unknown as edgeApi.AccessPointStatus);
    renderWithProviders(<NetworkOverview />, { authApi });
    await waitFor(() =>
      expect(screen.getByText('Stopped')).toBeInTheDocument());
    expect(screen.getByText(/SSID not configured/))
      .toBeInTheDocument();
  });

  it('Refresh button triggers a second load', async () => {
    stubAgentHealthy('CONNECTED');
    renderWithProviders(<NetworkOverview />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('network-overview'))
        .toBeInTheDocument());
    const before = (edgeApi.networkStatus as unknown as
      ReturnType<typeof vi.fn>).mock.calls.length;
    const user = (await import('@testing-library/user-event')).default
      .setup();
    await user.click(screen.getByRole('button', { name: /Refresh/ }));
    await waitFor(() => {
      const after = (edgeApi.networkStatus as unknown as
        ReturnType<typeof vi.fn>).mock.calls.length;
      expect(after).toBeGreaterThan(before);
    });
  });

  it('Export status button triggers downloadBlob (invokes URL.createObjectURL)', async () => {
    stubAgentHealthy('CONNECTED');
    /* downloadBlob uses URL.createObjectURL internally — stub it so
     * the test doesn't crash on jsdom (which may not implement it). */
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const createSpy = vi.fn(() => 'blob:test');
    const revokeSpy = vi.fn();
    (URL as unknown as { createObjectURL: typeof URL.createObjectURL })
      .createObjectURL = createSpy as unknown as typeof URL.createObjectURL;
    (URL as unknown as { revokeObjectURL: typeof URL.revokeObjectURL })
      .revokeObjectURL = revokeSpy as unknown as typeof URL.revokeObjectURL;
    try {
      renderWithProviders(<NetworkOverview />, { authApi });
      await waitFor(() =>
        expect(screen.getByTestId('network-overview'))
          .toBeInTheDocument());
      const user = (await import('@testing-library/user-event')).default
        .setup();
      await user.click(screen.getByRole('button', { name: /Export status/ }));
      expect(createSpy).toHaveBeenCalled();
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });
});

describe('NetworkAccessPoint — loaded branches', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  const runningAp: edgeApi.AccessPointStatus = {
    running: true, interface: 'wlan0', ssid: 'DER-pilot',
    band: '5GHz', channel: 44, security: 'WPA3-SAE',
    clients: 3, gateway: '10.88.0.1', subnet: '10.88.0.0/24',
    dhcpActive: true, edgeId: 'edge-abc', startedAt: '2026-11-03T10:00:00Z',
  };

  it('running AP → "Running" label + Stop AP button visible', async () => {
    vi.spyOn(edgeApi, 'networkAccessPoint').mockResolvedValue(runningAp);
    renderWithProviders(<NetworkAccessPoint />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('network-ap')).toBeInTheDocument());
    expect(document.body.textContent ?? '').toMatch(/Running/);
    expect(document.body.textContent ?? '').toMatch(/DER-pilot/);
    expect(screen.getByRole('button', { name: /Stop AP/ })).toBeInTheDocument();
  });

  it('stopped AP → "Stopped" label + Start AP button visible', async () => {
    vi.spyOn(edgeApi, 'networkAccessPoint').mockResolvedValue({
      ...runningAp, running: false,
    });
    renderWithProviders(<NetworkAccessPoint />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('network-ap')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Start AP/ })).toBeInTheDocument();
  });

  it('rejected AP probe → missing + empty-ap panel', async () => {
    vi.spyOn(edgeApi, 'networkAccessPoint').mockRejectedValue(new Error('404'));
    renderWithProviders(<NetworkAccessPoint />, { authApi });
    await waitFor(() =>
      expect(screen.queryByTestId('empty-ap')).toBeInTheDocument());
  });

  it('Edit AP opens the ApEditDialog', async () => {
    vi.spyOn(edgeApi, 'networkAccessPoint').mockResolvedValue(runningAp);
    renderWithProviders(<NetworkAccessPoint />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('network-ap')).toBeInTheDocument());
    const user = (await import('@testing-library/user-event')).default.setup();
    await user.click(screen.getByRole('button', { name: /Edit AP/ }));
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/Edit Access Point/));
  });

  it('Show QR opens the QrEnrolDialog', async () => {
    vi.spyOn(edgeApi, 'networkAccessPoint').mockResolvedValue(runningAp);
    renderWithProviders(<NetworkAccessPoint />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('network-ap')).toBeInTheDocument());
    const user = (await import('@testing-library/user-event')).default.setup();
    await user.click(screen.getByRole('button', { name: /Show QR/ }));
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/QR|enrol|Enrol/i));
  });
});

describe('NetworkConnectedDevices — loaded branches', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  const clientRow = (overrides: Partial<edgeApi.NetworkClient> = {})
    : edgeApi.NetworkClient => ({
    deviceId: 'dev-1', derDeviceId: null as unknown as string,
    owner: 'Alice', hostname: null, ip: '10.88.0.11',
    link: 'wifi', signalDbm: -55, trust: 'APPROVED',
    lastSeenAt: '2026-11-03T11:00:00Z',
    bytesTx: 100, bytesRx: 200,
    ...overrides,
  }) as edgeApi.NetworkClient;

  it('populated client list → all trust-tone arms render', async () => {
    vi.spyOn(edgeApi, 'networkClients').mockResolvedValue({
      clients: [
        clientRow({ deviceId: 'dev-approved', trust: 'APPROVED' }),
        clientRow({ deviceId: 'dev-pending', trust: 'PENDING', owner: 'Bob' }),
        clientRow({ deviceId: 'dev-blocked', trust: 'BLOCKED' }),
        clientRow({ deviceId: 'dev-revoked', trust: 'REVOKED' }),
        clientRow({ deviceId: 'dev-unknown', trust: 'UNKNOWN',
                    link: 'ethernet', signalDbm: null }),
      ],
    });
    renderWithProviders(<NetworkConnectedDevices />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('network-clients')).toBeInTheDocument());
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/dev-approved/);
    expect(body).toMatch(/dev-pending/);
    expect(body).toMatch(/dev-blocked/);
    expect(body).toMatch(/Ethernet/);
    expect(body).toMatch(/Pending/);
  });

  it('search-filter prunes the rendered client set', async () => {
    vi.spyOn(edgeApi, 'networkClients').mockResolvedValue({
      clients: [
        clientRow({ deviceId: 'dev-alice', owner: 'Alice' }),
        clientRow({ deviceId: 'dev-bob',   owner: 'Bob' }),
      ],
    });
    renderWithProviders(<NetworkConnectedDevices />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/dev-alice/));
    const user = (await import('@testing-library/user-event')).default.setup();
    const input = screen.getByPlaceholderText(/Search by ID/i);
    await user.type(input, 'alice');
    await waitFor(() =>
      expect(document.body.textContent ?? '').not.toMatch(/dev-bob/));
  });

  it('empty-client-list after rejection → empty-net-clients panel', async () => {
    vi.spyOn(edgeApi, 'networkClients').mockRejectedValue(new Error('500'));
    renderWithProviders(<NetworkConnectedDevices />, { authApi });
    await waitFor(() =>
      expect(screen.queryByTestId('empty-net-clients')).toBeInTheDocument());
  });

  it('empty filter → "No devices on the local network" message', async () => {
    vi.spyOn(edgeApi, 'networkClients').mockResolvedValue({
      clients: [clientRow({ deviceId: 'dev-only' })],
    });
    renderWithProviders(<NetworkConnectedDevices />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/dev-only/));
    const user = (await import('@testing-library/user-event')).default.setup();
    const input = screen.getByPlaceholderText(/Search by ID/i);
    await user.type(input, 'nonexistent');
    await waitFor(() =>
      expect(document.body.textContent ?? '')
        .toMatch(/No devices on the local network/));
  });
});

describe('NetworkInterfaces — loaded branches', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  const iface = (overrides: Partial<NetworkInterface> = {}): NetworkInterface => ({
    name: 'wlan0', kind: 'wifi', state: 'up',
    address: '10.88.0.1', mac: 'aa:bb:cc:dd:ee:ff',
    rxBytes: 100, txBytes: 50, linkSpeed: '150 Mbps',
    purpose: 'local-ap', priority: 10,
    ...overrides,
  }) as NetworkInterface;

  it('populated interfaces render every state-tone arm', async () => {
    vi.spyOn(edgeApi, 'networkInterfaces').mockResolvedValue({
      interfaces: [
        iface({ name: 'wlan0', state: 'up' }),
        iface({ name: 'eth0', kind: 'ethernet', state: 'degraded',
                purpose: 'facility-lan' }),
        iface({ name: 'wwan0', kind: 'cellular', state: 'down',
                purpose: 'cellular-fallback' }),
        iface({ name: 'lo', kind: 'loopback', state: 'unknown',
                purpose: 'unknown' }),
      ],
    });
    vi.spyOn(edgeApi, 'networkLeases').mockResolvedValue({ leases: [] });
    vi.spyOn(edgeApi, 'networkRoutes').mockResolvedValue({
      routes: [
        { id: 'r1', destination: '0.0.0.0/0', gateway: '10.88.0.1',
          interface: 'eth0', metric: 100, source: 'static', active: true },
        { id: 'r2', destination: '10.88.0.0/24', gateway: null,
          interface: 'wlan0', metric: 50, source: 'kernel', active: false },
      ] as unknown as NetworkRoute[],
    });
    renderWithProviders(<NetworkInterfaces />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('network-interfaces')).toBeInTheDocument());
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/wlan0/);
    expect(body).toMatch(/eth0/);
    expect(body).toMatch(/wwan0/);
    expect(body).toMatch(/0\.0\.0\.0\/0/);
  });

  it('rejected interfaces probe → empty-net-ifaces panel', async () => {
    vi.spyOn(edgeApi, 'networkInterfaces').mockRejectedValue(new Error('500'));
    vi.spyOn(edgeApi, 'networkLeases').mockResolvedValue({ leases: [] });
    vi.spyOn(edgeApi, 'networkRoutes').mockResolvedValue({ routes: [] });
    renderWithProviders(<NetworkInterfaces />, { authApi });
    await waitFor(() =>
      expect(screen.queryByTestId('empty-net-ifaces')).toBeInTheDocument());
  });

  it('empty routes section shows the "No routes." muted hint', async () => {
    vi.spyOn(edgeApi, 'networkInterfaces').mockResolvedValue({
      interfaces: [iface()],
    });
    vi.spyOn(edgeApi, 'networkLeases').mockResolvedValue({ leases: [] });
    vi.spyOn(edgeApi, 'networkRoutes').mockResolvedValue({ routes: [] });
    renderWithProviders(<NetworkInterfaces />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/No routes/));
  });
});

describe('NetworkPeers — loaded branches', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  const peer = (overrides: Partial<NetworkPeer> = {}): NetworkPeer => ({
    id: 'p1', nodeId: 'node-a', siteId: 'site-1',
    endpoint: '10.88.0.5:51820', state: 'CONNECTED',
    lastHandshake: '2026-11-03T11:00:00Z',
    rxBytes: 100, txBytes: 50, trust: 'TRUSTED',
    ...overrides,
  }) as NetworkPeer;

  it('populated peers render every state + trust arm', async () => {
    vi.spyOn(edgeApi, 'networkPeers').mockResolvedValue({
      peers: [
        peer({ id: 'p-conn', state: 'CONNECTED', trust: 'TRUSTED' }),
        peer({ id: 'p-shake', nodeId: 'node-b', state: 'HANDSHAKING',
               trust: 'UNVERIFIED', lastHandshake: null }),
        peer({ id: 'p-err', nodeId: 'node-c', state: 'ERROR',
               trust: 'REVOKED' }),
        peer({ id: 'p-off', nodeId: 'node-d', state: 'DISCONNECTED',
               trust: 'UNVERIFIED', siteId: null }),
      ],
    });
    renderWithProviders(<NetworkPeers />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('network-peers')).toBeInTheDocument());
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/node-a/);
    expect(body).toMatch(/node-b/);
    expect(body).toMatch(/HANDSHAKING/);
    expect(body).toMatch(/REVOKED/);
  });

  it('rejected peers probe → empty-net-peers panel', async () => {
    vi.spyOn(edgeApi, 'networkPeers').mockRejectedValue(new Error('404'));
    renderWithProviders(<NetworkPeers />, { authApi });
    await waitFor(() =>
      expect(screen.queryByTestId('empty-net-peers')).toBeInTheDocument());
  });

  it('empty peers list → empty-net-peers panel', async () => {
    vi.spyOn(edgeApi, 'networkPeers').mockResolvedValue({ peers: [] });
    renderWithProviders(<NetworkPeers />, { authApi });
    await waitFor(() =>
      expect(screen.queryByTestId('empty-net-peers')).toBeInTheDocument());
  });
});

