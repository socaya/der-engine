import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { MockupUsersDashboard, MockupUserDetail } from './UsersDashboard';
import * as edgeApi from '../api/edgeApi';
import type { ProvisionedUser } from '../api/edgeApi';

const authApi = {
  session: vi.fn().mockResolvedValue({
    userId: 'u1', username: 'admin', displayName: 'Admin',
    roles: ['ADMIN'], expiresAt: '2027-01-01T00:00:00Z',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

function userFixture(over: Partial<ProvisionedUser> = {}): ProvisionedUser {
  return {
    userId: 'u-1', username: 'nurse.alice', displayName: 'Nurse Alice',
    origin: 'BOOTSTRAP', externalUid: null, mustChangePassword: false,
    roles: ['OPERATOR'],
    createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z',
    ...over,
  } as ProvisionedUser;
}

describe('MockupUsersDashboard', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('shows LoadingBlock while listUsers is pending', () => {
    vi.spyOn(edgeApi, 'listUsers').mockImplementation(
      () => new Promise(() => undefined));
    renderWithProviders(<MockupUsersDashboard />, { authApi });
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('renders the user list with username and role counts', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [
        userFixture({ username: 'nurse.alice' }),
        userFixture({ userId: 'u-2', username: 'nurse.bob' }),
        userFixture({ userId: 'u-3', username: 'der-admin', roles: ['ADMIN'] }),
      ],
    });
    renderWithProviders(<MockupUsersDashboard />, { authApi });
    await waitFor(() => expect(screen.getByText('nurse.alice'))
      .toBeInTheDocument());
    expect(screen.getByText('nurse.bob')).toBeInTheDocument();
    expect(screen.getByText('der-admin')).toBeInTheDocument();
  });

  it('search filter narrows the visible rows to matching users', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [
        userFixture({ userId: 'u-a', username: 'alice', displayName: 'Alice A' }),
        userFixture({ userId: 'u-b', username: 'bob',   displayName: 'Bob B' }),
      ],
    });
    renderWithProviders(<MockupUsersDashboard />, { authApi });
    await waitFor(() => expect(screen.getByText('alice'))
      .toBeInTheDocument());
    const search = screen.getByPlaceholderText(/search by name/i);
    const user = userEvent.setup();
    await user.type(search, 'ali');
    /* Each row has data-test="user-row-{userId}". Filter kept
     * alice (userId u-a) and dropped bob (userId u-b). */
    await waitFor(() => {
      expect(screen.getByTestId('user-row-u-a')).toBeInTheDocument();
      expect(screen.queryByTestId('user-row-u-b')).toBeNull();
    });
  });

  it('MockupUserDetail renders LoadingBlock while listUsers is pending', () => {
    vi.spyOn(edgeApi, 'listUsers').mockImplementation(
      () => new Promise(() => undefined));
    renderWithProviders(<MockupUserDetail />,
      { authApi, route: '/admin/provisioning/users/u-1' });
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });
});
