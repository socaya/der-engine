import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Launcher } from './Launcher';
import { renderWithProviders } from '../test/renderWithProviders';
import type { SignInResponse } from '../api/edgeApi';

const operator: SignInResponse = {
  userId: 'u', username: 'alice', displayName: 'A', roles: ['OPERATOR'], expiresAt: 'x',
};
const admin: SignInResponse = {
  userId: 'u', username: 'admin', displayName: 'A', roles: ['ADMIN'], expiresAt: 'x',
};

type FetchMock = ReturnType<typeof vi.fn>;
let fetchMock: FetchMock;
beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => vi.restoreAllMocks());

function respond(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('Launcher', () => {
  it('renders the tile grid', async () => {
    renderWithProviders(<Launcher />, {
      authApi: { session: vi.fn().mockResolvedValue(operator), signIn: vi.fn(), signOut: vi.fn() },
    });
    await waitFor(() => expect(screen.getByTestId('launcher-heading')).toBeInTheDocument());
    for (const id of ['tile-ou', 'tile-ds', 'tile-de', 'tile-prg', 'tile-tet', 'tile-recent', 'tile-session']) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
  });

  it('does not render the sync card for non-admins', async () => {
    renderWithProviders(<Launcher />, {
      authApi: { session: vi.fn().mockResolvedValue(operator), signIn: vi.fn(), signOut: vi.fn() },
    });
    await waitFor(() => expect(screen.getByTestId('launcher-heading')).toBeInTheDocument());
    expect(screen.queryByTestId('sync-card')).toBeNull();
  });

  it('renders the sync card for admins and shows success', async () => {
    fetchMock.mockResolvedValue(respond(200, {
      status: 'OK', snapshotId: 1, total: 874,
      organisationUnits: 484, dataElements: 358, dataSets: 0, programs: 31, trackedEntityTypes: 1,
      centralVersion: '2.44-SNAPSHOT', centralRevision: 'r', fingerprint: 'f', message: null,
    }));
    renderWithProviders(<Launcher />, {
      authApi: { session: vi.fn().mockResolvedValue(admin), signIn: vi.fn(), signOut: vi.fn() },
    });
    await waitFor(() => expect(screen.getByTestId('sync-card')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('sync-button'));
    await waitFor(() => expect(screen.getByTestId('sync-result')).toBeInTheDocument());
    expect(screen.getByText(/Snapshot id/)).toBeInTheDocument();
    expect(screen.getByText(/2\.44-SNAPSHOT/)).toBeInTheDocument();
  });

  it('shows a sync-error message when triggerMetadataSync rejects', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    renderWithProviders(<Launcher />, {
      authApi: { session: vi.fn().mockResolvedValue(admin), signIn: vi.fn(), signOut: vi.fn() },
    });
    await waitFor(() => expect(screen.getByTestId('sync-card')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('sync-button'));
    await waitFor(() => expect(screen.getByTestId('sync-error')).toBeInTheDocument());
  });

  it('shows a sync-error message when triggerMetadataSync rejects with non-Error', async () => {
    const api = {
      session: vi.fn().mockResolvedValue(admin),
      signIn: vi.fn(),
      signOut: vi.fn(),
    };
    // Make fetch throw a non-Error reject value through the EdgeApi path.
    fetchMock.mockImplementationOnce(() => Promise.reject('plain-string-reject' as unknown as Error));
    renderWithProviders(<Launcher />, { authApi: api });
    await waitFor(() => expect(screen.getByTestId('sync-card')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('sync-button'));
    await waitFor(() => expect(screen.getByTestId('sync-error')).toBeInTheDocument());
  });
});
