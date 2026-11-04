import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../test/renderWithProviders';
import { MockupUsersDashboard, MockupUserDetail, MockupUserDhis2Mapping } from './UsersDashboard';
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

  /* MockupUserDetail reads :userId from the route params; without a
   * matched route the param stays undefined and the useEffect
   * short-circuits. Wrap in a Routes/Route block so useParams
   * returns the id. */
  function detailWithRoute(): JSX.Element {
    return (
      <Routes>
        <Route path="/provisioning/users/:userId" element={<MockupUserDetail />} />
      </Routes>
    );
  }

  it('MockupUserDetail renders LoadingBlock while listUsers is pending', () => {
    vi.spyOn(edgeApi, 'listUsers').mockImplementation(
      () => new Promise(() => undefined));
    renderWithProviders(detailWithRoute(),
      { authApi, route: '/provisioning/users/u-1' });
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('MockupUserDetail shows ErrorBlock when the user is not found', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({ users: [] });
    renderWithProviders(detailWithRoute(),
      { authApi, route: '/provisioning/users/u-missing' });
    await waitFor(() => expect(screen.getByTestId('err-user-detail'))
      .toBeInTheDocument());
    expect(screen.getByTestId('err-user-detail'))
      .toHaveTextContent(/not found/i);
  });

  it('MockupUserDetail renders the matched user and switches tabs', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [userFixture({ userId: 'u-live', username: 'alice',
                            displayName: 'Alice', roles: ['ADMIN'] })],
    });
    renderWithProviders(detailWithRoute(),
      { authApi, route: '/provisioning/users/u-live' });
    await waitFor(() => expect(screen.getByTestId('user-detail'))
      .toBeInTheDocument());
    const user = userEvent.setup();
    /* The screen opens on the Details tab; swap to Permissions
     * to exercise the role-based bullet-list render path. */
    await user.click(screen.getByRole('button', { name: /permissions/i }));
    expect(screen.getByText(/manage users, apps, settings/i))
      .toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /activity/i }));
    expect(screen.getByText(/per-user activity not yet exposed/i))
      .toBeInTheDocument();
  });

  it('MockupUsersDashboard renders Pending / Verified attention chips per row', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [userFixture()],
    });
    renderWithProviders(<MockupUsersDashboard />, { authApi });
    await waitFor(() => expect(screen.getByText('nurse.alice'))
      .toBeInTheDocument());
    /* Every row gets a Pending/Verified chip + the "Unmapped"
     * placeholder. Assert the Unmapped chip surfaces as the
     * strongest signal for the row-render path. */
    expect(screen.getAllByText(/unmapped/i).length).toBeGreaterThan(0);
  });

  it('?role= deep-link filters the list to users holding that role', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [
        userFixture({ userId: 'u-1', username: 'nurse.alice', roles: ['OPERATOR'] }),
        userFixture({ userId: 'u-2', username: 'der-admin', roles: ['ADMIN'] }),
      ],
    });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([]);
    renderWithProviders(<MockupUsersDashboard />, { authApi,
      route: '/provisioning/users?role=ADMIN' });
    await waitFor(() => expect(screen.getByText('der-admin'))
      .toBeInTheDocument());
    /* Operator-only user must be filtered out. */
    expect(screen.queryByText('nurse.alice')).toBeNull();
    /* ScopedFilterChip renders the active scope. */
    expect(screen.getByTestId('scoped-filter-chip'))
      .toHaveTextContent('role = ADMIN');
  });

  it('?role= is case-insensitive so custom role names round-trip', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [
        userFixture({ userId: 'u-c', username: 'clerk.one',
          roles: ['Clinical nurses'] as unknown as ProvisionedUser['roles'] }),
        userFixture({ userId: 'u-a', username: 'der-admin', roles: ['ADMIN'] }),
      ],
    });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([]);
    renderWithProviders(<MockupUsersDashboard />, { authApi,
      route: '/provisioning/users?role=clinical%20nurses' });
    await waitFor(() => expect(screen.getByText('clerk.one'))
      .toBeInTheDocument());
    expect(screen.queryByText('der-admin')).toBeNull();
  });

  it('?mapped=no deep-link filters to users without a DHIS2 mapping', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [
        userFixture({ userId: 'u-m', username: 'mapped.user' }),
        userFixture({ userId: 'u-u', username: 'unmapped.user' }),
      ],
    });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([
      { edgeUserId: 'u-m', dhis2UserUid: 'UID-A', dhis2Username: 'mapped.c',
        dhis2DisplayName: 'Mapped Central', mappedAt: 'now', mappedBy: 'admin',
        lastVerifiedAt: null },
    ]);
    renderWithProviders(<MockupUsersDashboard />, { authApi,
      route: '/provisioning/users?mapped=no' });
    await waitFor(() => expect(screen.getByText('unmapped.user'))
      .toBeInTheDocument());
    expect(screen.queryByText('mapped.user')).toBeNull();
    expect(screen.getByTestId('scoped-filter-chip'))
      .toHaveTextContent('not mapped to DHIS2');
  });
});

describe('MockupUserDhis2Mapping (per-user route)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  function renderAt(path: string): void {
    renderWithProviders(
      <Routes>
        <Route path="/provisioning/users/:userId/dhis2-mapping"
               element={<MockupUserDhis2Mapping />} />
      </Routes>,
      { authApi, route: path },
    );
  }

  it('shows an Unmapped status bar + Map button for a user with no mapping', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [userFixture({ userId: 'u-1', username: 'alice' })],
    });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([]);
    renderAt('/provisioning/users/u-1/dhis2-mapping');
    await waitFor(() =>
      expect(screen.getByTestId('user-dhis2-mapping')).toBeInTheDocument());
    expect(screen.getByTestId('user-dhis2-mapping-edit'))
      .toHaveTextContent('Map DHIS2 user');
    expect(document.body.textContent ?? '').toMatch(/Unmapped/);
  });

  it('shows the current mapping + Edit / Clear actions when mapped', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [userFixture({ userId: 'u-1', username: 'alice' })],
    });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([
      { edgeUserId: 'u-1', dhis2UserUid: 'ALICE123', dhis2Username: 'alice.c',
        dhis2DisplayName: 'Alice Central', mappedAt: '2026-11-04T10:00:00Z',
        mappedBy: 'admin', lastVerifiedAt: null },
    ]);
    renderAt('/provisioning/users/u-1/dhis2-mapping');
    await waitFor(() =>
      expect(screen.getByTestId('user-dhis2-mapping-current'))
        .toBeInTheDocument());
    expect(screen.getByTestId('user-dhis2-mapping-current'))
      .toHaveTextContent('alice.c');
    expect(screen.getByTestId('user-dhis2-mapping-current'))
      .toHaveTextContent('ALICE123');
    expect(screen.getByTestId('user-dhis2-mapping-edit'))
      .toHaveTextContent('Edit mapping');
    expect(screen.getByTestId('user-dhis2-mapping-clear')).toBeInTheDocument();
  });

  it('Edit opens the form and Save calls setUserDhis2Mapping', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [userFixture({ userId: 'u-1', username: 'alice',
                             displayName: 'Alice' })],
    });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([]);
    const setSpy = vi.spyOn(edgeApi, 'setUserDhis2Mapping').mockResolvedValue({
      edgeUserId: 'u-1', dhis2UserUid: 'ALICE123', dhis2Username: 'alice.c',
      dhis2DisplayName: 'Alice Central', mappedAt: 'now', mappedBy: 'admin',
      lastVerifiedAt: null,
    });
    renderAt('/provisioning/users/u-1/dhis2-mapping');
    const user = userEvent.setup();
    await user.click(await screen.findByTestId('user-dhis2-mapping-edit'));
    await waitFor(() =>
      expect(screen.getByTestId('user-dhis2-mapping-form')).toBeInTheDocument());
    /* Username is seeded from the edge username. */
    expect((screen.getByTestId('user-dhis2-mapping-input-username') as HTMLInputElement).value)
      .toBe('alice');
    await user.type(screen.getByTestId('user-dhis2-mapping-input-uid'), 'ALICE123');
    await user.click(screen.getByTestId('user-dhis2-mapping-save'));
    await waitFor(() => expect(setSpy).toHaveBeenCalledWith('u-1',
      expect.objectContaining({ dhis2UserUid: 'ALICE123' })));
  });

  it('unknown user id surfaces the not-found ErrorBlock', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({ users: [] });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([]);
    renderAt('/provisioning/users/does-not-exist/dhis2-mapping');
    await waitFor(() =>
      expect(screen.getByTestId('err-user-mapping-not-found'))
        .toBeInTheDocument());
  });

  it('mapped-user Panel action surfaces a direct Edit button', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [userFixture({ userId: 'u-1' })],
    });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([
      { edgeUserId: 'u-1', dhis2UserUid: 'ALICE', dhis2Username: 'alice.c',
        dhis2DisplayName: 'Alice Central', mappedAt: 'now', mappedBy: 'admin',
        lastVerifiedAt: null },
    ]);
    renderAt('/provisioning/users/u-1/dhis2-mapping');
    await waitFor(() =>
      expect(screen.getByTestId('user-dhis2-mapping-edit-panel'))
        .toBeInTheDocument());
    const user = userEvent.setup();
    /* Clicking Edit on the Panel header opens the form. */
    await user.click(screen.getByTestId('user-dhis2-mapping-edit-panel'));
    await waitFor(() =>
      expect(screen.getByTestId('user-dhis2-mapping-form')).toBeInTheDocument());
    /* uid + username pre-fill from the existing mapping. */
    expect((screen.getByTestId('user-dhis2-mapping-input-uid') as HTMLInputElement).value)
      .toBe('ALICE');
  });

  it('DHIS2 picker surfaces search results and a click fills the form', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [userFixture({ userId: 'u-1', username: 'local.alice' })],
    });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([]);
    const candidateSearch = vi.spyOn(edgeApi, 'searchDhis2UserCandidates')
      .mockResolvedValue({
        query: '',
        candidates: [
          { id: 'A1B2C3D4E5F', username: 'alice.c',
            displayName: 'Alice Central', disabled: false },
          { id: 'Z9yT5w1Z9Kq', username: 'bob.c',
            displayName: 'Bob Central', disabled: true },
        ],
      });
    renderAt('/provisioning/users/u-1/dhis2-mapping');
    const user = userEvent.setup();
    /* Empty state surfaces the inline Add button. */
    await user.click(await screen.findByTestId('user-dhis2-mapping-add'));
    /* Opening the picker fires the initial empty-query search. */
    await user.click(screen.getByTestId('user-dhis2-mapping-picker-input'));
    await waitFor(() => expect(candidateSearch).toHaveBeenCalled());
    const row = await screen.findByTestId('user-dhis2-mapping-picker-row-A1B2C3D4E5F');
    expect(row).toHaveTextContent('Alice Central');
    /* Disabled Bob Central row surfaces a Status warning chip. */
    expect(screen.getByTestId('user-dhis2-mapping-picker-row-Z9yT5w1Z9Kq'))
      .toHaveTextContent('Disabled');
    await user.click(row);
    expect((screen.getByTestId('user-dhis2-mapping-input-uid') as HTMLInputElement).value)
      .toBe('A1B2C3D4E5F');
    expect((screen.getByTestId('user-dhis2-mapping-input-username') as HTMLInputElement).value)
      .toBe('alice.c');
    expect((screen.getByTestId('user-dhis2-mapping-input-display-name') as HTMLInputElement).value)
      .toBe('Alice Central');
  });

  it('picker search failure surfaces a hint but keeps the inputs editable', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [userFixture({ userId: 'u-1' })],
    });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([]);
    vi.spyOn(edgeApi, 'searchDhis2UserCandidates')
      .mockRejectedValue(new Error('503 DHIS2 unreachable'));
    renderAt('/provisioning/users/u-1/dhis2-mapping');
    const user = userEvent.setup();
    await user.click(await screen.findByTestId('user-dhis2-mapping-add'));
    await user.click(screen.getByTestId('user-dhis2-mapping-picker-input'));
    /* Danger hint rendered inside the combobox menu. */
    await waitFor(() =>
      expect(document.body.textContent ?? '')
        .toMatch(/DHIS2 search failed/));
    /* Operator can still type uid manually. */
    await user.type(screen.getByTestId('user-dhis2-mapping-input-uid'), 'MANUALUID12');
    expect((screen.getByTestId('user-dhis2-mapping-input-uid') as HTMLInputElement).value)
      .toBe('MANUALUID12');
  });

  it('empty-state exposes the inline Add mapping button', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [userFixture({ userId: 'u-1' })],
    });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([]);
    renderAt('/provisioning/users/u-1/dhis2-mapping');
    const btn = await screen.findByTestId('user-dhis2-mapping-add');
    expect(btn).toHaveTextContent('Add mapping');
    const user = userEvent.setup();
    await user.click(btn);
    await waitFor(() =>
      expect(screen.getByTestId('user-dhis2-mapping-form')).toBeInTheDocument());
  });
});
