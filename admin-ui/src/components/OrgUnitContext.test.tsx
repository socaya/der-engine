import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrgUnitProvider, useOrgUnit } from './OrgUnitContext';
import { AuthProvider } from '../auth/AuthContext';
import * as edgeApi from '../api/edgeApi';

/* OrgUnitContext fetches binding on auth change + exposes state via
 * useOrgUnit. Fallback outside provider returns an empty-state
 * value so test harnesses don't need to wrap. */

const authedApi = {
  session: vi.fn().mockResolvedValue({
    userId: 'u1', username: 'admin', displayName: 'Admin',
    roles: ['ADMIN'], expiresAt: '2027-01-01T00:00:00Z',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

function Probe(): JSX.Element {
  const { binding, loading, error } = useOrgUnit();
  return (
    <>
      <div data-test="binding">
        {binding ? (binding.bound ? 'bound' : 'unbound') : 'none'}
      </div>
      <div data-test="loading">{loading ? 'yes' : 'no'}</div>
      <div data-test="error">{error ?? 'ok'}</div>
    </>
  );
}

describe('OrgUnitContext', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('useOrgUnit outside provider returns empty-state fallback', () => {
    render(<Probe />);
    expect(screen.getByTestId('binding')).toHaveTextContent('none');
    expect(screen.getByTestId('loading')).toHaveTextContent('no');
    expect(screen.getByTestId('error')).toHaveTextContent('ok');
  });

  it('refresh fallback (outside provider) returns a resolved promise', async () => {
    let fallbackRefresh: (() => Promise<void>) | null = null;
    function RefProbe(): JSX.Element {
      const v = useOrgUnit();
      fallbackRefresh = v.refresh;
      return <></>;
    }
    render(<RefProbe />);
    expect(fallbackRefresh).not.toBeNull();
    await expect(fallbackRefresh!()).resolves.toBeUndefined();
  });

  it('authenticated → fetches + exposes bound binding', async () => {
    vi.spyOn(edgeApi, 'getOrgUnitBinding').mockResolvedValue({
      bound: true, orgUnitId: 'OU-1',
      orgUnitDisplayName: 'Clinic',
    } as unknown as edgeApi.OrgUnitBinding);
    render(
      <AuthProvider api={authedApi as never}>
        <OrgUnitProvider>
          <Probe />
        </OrgUnitProvider>
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('binding')).toHaveTextContent('bound'));
    expect(screen.getByTestId('error')).toHaveTextContent('ok');
  });

  it('unauthenticated → binding stays null (no fetch)', async () => {
    const spy = vi.spyOn(edgeApi, 'getOrgUnitBinding').mockResolvedValue({
      bound: true, orgUnitId: 'OU-X',
      orgUnitDisplayName: 'X',
    } as unknown as edgeApi.OrgUnitBinding);
    const unauthedApi = {
      session: vi.fn().mockRejectedValue(new Error('no session')),
      signIn: vi.fn(),
      signOut: vi.fn(),
    };
    render(
      <AuthProvider api={unauthedApi as never}>
        <OrgUnitProvider>
          <Probe />
        </OrgUnitProvider>
      </AuthProvider>,
    );
    /* Wait for auth probe to settle. */
    await act(async () => { await Promise.resolve(); });
    /* getOrgUnitBinding should NOT have been called because the user
     * isn't authenticated. */
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByTestId('binding')).toHaveTextContent('none');
  });

  it('getOrgUnitBinding rejection sets error + leaves binding null', async () => {
    vi.spyOn(edgeApi, 'getOrgUnitBinding').mockRejectedValue(
      new Error('boom'));
    render(
      <AuthProvider api={authedApi as never}>
        <OrgUnitProvider>
          <Probe />
        </OrgUnitProvider>
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent('boom'));
    expect(screen.getByTestId('binding')).toHaveTextContent('none');
  });

  it('refresh manually re-fetches the binding', async () => {
    let captured: (() => Promise<void>) | null = null;
    function RefresherProbe(): JSX.Element {
      const v = useOrgUnit();
      captured = v.refresh;
      return <></>;
    }
    const spy = vi.spyOn(edgeApi, 'getOrgUnitBinding')
      .mockResolvedValue({ bound: false, orgUnitId: null,
                           orgUnitDisplayName: null,
      } as unknown as edgeApi.OrgUnitBinding);
    render(
      <AuthProvider api={authedApi as never}>
        <OrgUnitProvider>
          <RefresherProbe />
        </OrgUnitProvider>
      </AuthProvider>,
    );
    await waitFor(() => expect(captured).not.toBeNull());
    /* First fetch from the auth-change effect. */
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    /* Trigger manual refresh. */
    await act(async () => { await captured!(); });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
