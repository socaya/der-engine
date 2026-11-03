import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
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
