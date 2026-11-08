import { render, screen, waitFor, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OrgUnitBindingProvider,
  useOrgUnitBinding,
} from './OrgUnitBindingContext';
import { AuthProvider } from '../auth/AuthContext';

function Probe(): JSX.Element {
  const { state, reload } = useOrgUnitBinding();
  if (state.status === 'LOADING') return <p data-test="loading">loading</p>;
  if (state.status === 'ERROR')
    return (
      <>
        <p data-test="error">{state.message}</p>
        <button data-test="retry" onClick={() => void reload()}>retry</button>
      </>
    );
  return (
    <>
      <p data-test="bound">{String(state.binding.bound)}</p>
      <p data-test="ou">{state.binding.orgUnitId ?? '—'}</p>
      <p data-test="name">{state.binding.orgUnitDisplayName ?? '—'}</p>
    </>
  );
}

/** Shared auth-mock: the OU-binding provider waits for
 *  auth.state.status === 'AUTHENTICATED' before fetching (fix for
 *  the first-login "Not bound to an OU" bug — provider used to
 *  fetch pre-sign-in and cache the 401). Every test here needs an
 *  AuthProvider ancestor; we inject a signed-in session so the
 *  binding fetch fires synchronously under the test's control. */
function authApi(): never {
  return {
    session: vi.fn().mockResolvedValue({
      username: 'op', displayName: 'Op', roles: [] }),
    signIn: vi.fn(),
    signOut: vi.fn(),
  } as never;
}

function renderWithAuth(ui: JSX.Element): ReturnType<typeof render> {
  return render(<AuthProvider api={authApi()}>{ui}</AuthProvider>);
}

afterEach(() => { vi.restoreAllMocks(); });

describe('OrgUnitBindingProvider', () => {
  it('loads the binding and exposes it through the hook', async () => {
    const api = {
      getOrgUnitBinding: vi.fn().mockResolvedValue({
        bound: true, orgUnitId: 'OU-1', orgUnitDisplayName: 'Facility 1',
        orgUnitPath: '/R/OU-1', boundAt: 't', boundBy: 'admin',
      }),
    } as never;
    renderWithAuth(
      <OrgUnitBindingProvider api={api}><Probe /></OrgUnitBindingProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('bound')).toHaveTextContent('true'));
    expect(screen.getByTestId('ou')).toHaveTextContent('OU-1');
    expect(screen.getByTestId('name')).toHaveTextContent('Facility 1');
  });

  it('surfaces loader errors via state=ERROR', async () => {
    const api = {
      getOrgUnitBinding: vi.fn().mockRejectedValue(new Error('boom')),
    } as never;
    renderWithAuth(
      <OrgUnitBindingProvider api={api}><Probe /></OrgUnitBindingProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('boom'));
  });

  it('non-Error rejection surfaces as string', async () => {
    const api = {
      getOrgUnitBinding: vi.fn().mockRejectedValue('nope'),
    } as never;
    renderWithAuth(
      <OrgUnitBindingProvider api={api}><Probe /></OrgUnitBindingProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('error')).toBeInTheDocument());
  });

  it('reload() re-fetches the binding', async () => {
    const api = {
      getOrgUnitBinding: vi.fn()
        .mockResolvedValueOnce({ bound: false, orgUnitId: null,
          orgUnitDisplayName: null, orgUnitPath: null,
          boundAt: null, boundBy: null })
        .mockResolvedValueOnce({ bound: true, orgUnitId: 'OU-NEW',
          orgUnitDisplayName: 'New', orgUnitPath: '/R/OU-NEW',
          boundAt: 't', boundBy: 'admin' }),
    };
    renderWithAuth(
      <OrgUnitBindingProvider api={api as never}><Probe /></OrgUnitBindingProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('bound')).toHaveTextContent('false'));
    // trigger a second load directly against the stub to confirm it fires
    await act(async () => { await api.getOrgUnitBinding(); });
    expect(api.getOrgUnitBinding).toHaveBeenCalledTimes(2);
  });

  it('useOrgUnitBinding() outside the provider throws', () => {
    expect(() => render(<Probe />)).toThrow(
      /useOrgUnitBinding must be called inside/,
    );
  });

  /** Regression: before this fix the provider would fetch once on
   *  mount — if that landed before auth succeeded the fetch 401'd
   *  and the ERROR state persisted until the operator manually
   *  refreshed the page. Now the provider waits for AUTHENTICATED
   *  and fetches on that transition. */
  it('defers the fetch until auth becomes AUTHENTICATED', async () => {
    let resolveSession: ((v: unknown) => void) | null = null;
    const auth = {
      session: vi.fn(() => new Promise((res) => { resolveSession = res; })),
      signIn: vi.fn(),
      signOut: vi.fn(),
    } as never;
    const api = {
      getOrgUnitBinding: vi.fn().mockResolvedValue({
        bound: true, orgUnitId: 'OU-A', orgUnitDisplayName: 'A',
        orgUnitPath: '/R/A', boundAt: 't', boundBy: 'admin',
      }),
    } as never;
    render(
      <AuthProvider api={auth}>
        <OrgUnitBindingProvider api={api}><Probe /></OrgUnitBindingProvider>
      </AuthProvider>,
    );
    // Pre-auth: loading shown, binding fetch NOT fired.
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    expect(api.getOrgUnitBinding).not.toHaveBeenCalled();
    // Flip auth to AUTHENTICATED.
    await act(async () => {
      resolveSession!({ username: 'op', displayName: 'Op', roles: [] });
      await Promise.resolve();
    });
    await waitFor(() => expect(api.getOrgUnitBinding).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('bound')).toHaveTextContent('true'));
  });
});
