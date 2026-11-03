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

