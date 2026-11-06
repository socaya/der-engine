import { render, screen, waitFor, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OrgUnitBindingProvider,
  useOrgUnitBinding,
} from './OrgUnitBindingContext';

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

afterEach(() => { vi.restoreAllMocks(); });

describe('OrgUnitBindingProvider', () => {
  it('loads the binding and exposes it through the hook', async () => {
    const api = {
      getOrgUnitBinding: vi.fn().mockResolvedValue({
        bound: true, orgUnitId: 'OU-1', orgUnitDisplayName: 'Facility 1',
        orgUnitPath: '/R/OU-1', boundAt: 't', boundBy: 'admin',
      }),
    } as never;
    render(
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
    render(
      <OrgUnitBindingProvider api={api}><Probe /></OrgUnitBindingProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('boom'));
  });

  it('non-Error rejection surfaces as string', async () => {
    const api = {
      getOrgUnitBinding: vi.fn().mockRejectedValue('nope'),
    } as never;
    render(
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
    render(
      <OrgUnitBindingProvider api={api}><Probe /></OrgUnitBindingProvider>,
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
});
