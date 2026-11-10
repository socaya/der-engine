import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { CustomDataProvider } from '@dhis2/app-runtime';
import { render, type RenderResult } from '@testing-library/react';
import { AuthProvider } from '../auth/AuthContext';
import { OrgUnitBindingProvider } from '../orgunit/OrgUnitBindingContext';
import { vi } from 'vitest';
import type * as edgeApi from '../api/edgeApi';
import type { OrgUnitBinding } from '../api/edgeApi';

const DEFAULT_BINDING: OrgUnitBinding = {
  bound: true,
  orgUnitId: 'OU-A',
  orgUnitDisplayName: 'Facility A',
  orgUnitPath: '/ROOT/OU-A',
  boundAt: '2026-11-01T00:00:00Z',
  boundBy: 'admin',
};

/** Default authApi factory — resolves `session()` to a fake user so
 *  AuthProvider lands in AUTHENTICATED. OrgUnitBindingProvider only
 *  fetches once auth is AUTHENTICATED, so tests that don't mock
 *  auth would otherwise stall in LOADING.
 *
 *  Returned as a factory because test suites commonly call
 *  `vi.restoreAllMocks()` in afterEach, which would wipe the
 *  mockResolvedValue off a module-level stub. Each render gets a
 *  fresh instance. */
function defaultAuthApi(): Pick<typeof edgeApi, 'session' | 'signIn' | 'signOut'> {
  return {
    session: vi.fn().mockResolvedValue({
      userId: 'u-test', username: 'op', displayName: 'Op',
      roles: ['OPERATOR'], expiresAt: '2099-01-01T00:00:00Z',
    }),
    signIn: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
}

export interface RenderOptions {
  readonly route?: string;
  readonly locationState?: unknown;
  readonly dataProviderData?: Record<string, unknown>;
  readonly authApi?: Pick<typeof edgeApi, 'session' | 'signIn' | 'signOut'>;
  /**
   * Override the bound org unit the test sees. Pass `null` to simulate an
   * unbound edge; omit to use the default `OU-A`.
   */
  readonly orgUnitBinding?: OrgUnitBinding | null;
}

/**
 * Helper that wraps a UI tree in the same providers the real app uses:
 *   MemoryRouter → CustomDataProvider → AuthProvider → OrgUnitBindingProvider.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions = {},
): RenderResult {
  const data = options.dataProviderData ?? {};
  const route = options.route ?? '/';
  const entry = options.locationState === undefined
    ? route
    : { pathname: route, state: options.locationState };
  const binding = options.orgUnitBinding === null
    ? { bound: false, orgUnitId: null, orgUnitDisplayName: null,
        orgUnitPath: null, boundAt: null, boundBy: null }
    : options.orgUnitBinding ?? DEFAULT_BINDING;
  const bindingApi = { getOrgUnitBinding: vi.fn().mockResolvedValue(binding) };
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <MemoryRouter initialEntries={[entry as never]}>
      {/* CustomDataProvider typing requires CustomData which is more
          specific than Record<string,unknown>; the cast is safe because
          test fixtures supply the shape the runtime expects. */}
      <CustomDataProvider data={data as never}>
        <AuthProvider api={options.authApi ?? defaultAuthApi()}>
          <OrgUnitBindingProvider api={bindingApi}
                                   initialBinding={binding}>
            {children}
          </OrgUnitBindingProvider>
        </AuthProvider>
      </CustomDataProvider>
    </MemoryRouter>
  );
  return render(ui, { wrapper });
}
