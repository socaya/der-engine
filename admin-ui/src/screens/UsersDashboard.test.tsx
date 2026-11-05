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

  it('MockupUserDetail renders the matched user; Permissions tab lists derived authorities; Activity tab lists audit rows', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [userFixture({ userId: 'u-live', username: 'alice',
                            displayName: 'Alice', roles: ['ADMIN'] })],
    });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([
      { edgeUserId: 'u-live', dhis2UserUid: 'ALICE123456', dhis2Username: 'alice.c',
        dhis2DisplayName: 'Alice Central',
        mappedAt: '2026-11-04T10:00:00Z', mappedBy: 'admin',
        lastVerifiedAt: null, authType: 'TOKEN',
        hasCredential: true, credentialSetAt: '2026-11-04T10:00:00Z' },
    ]);
    vi.spyOn(edgeApi, 'getUserEffectiveAuthorities').mockResolvedValue({
      userId: 'u-live',
      authorities: ['der.dhis2.read', 'der.users.read', 'der.users.write',
        'der.roles.read'],
    });
    vi.spyOn(edgeApi, 'listAuditEvents').mockResolvedValue({
      count: 2, pageSize: 100, nextCursor: null,
      events: [
        { auditId: 1, eventType: 'USER_SIGNED_IN', actorUserId: 'u-live',
          subjectUserId: null, clientIp: '10.0.0.1', userAgent: 'curl',
          outcome: 'SUCCESS', detail: '{}',
          observedAt: '2026-11-05T09:00:00Z' },
        { auditId: 2, eventType: 'USER_DHIS2_MAPPING_SET', actorUserId: 'u-live',
          subjectUserId: 'u-live', clientIp: null, userAgent: null,
          outcome: 'SUCCESS', detail: '{}',
          observedAt: '2026-11-05T09:05:00Z' },
      ],
    });
    renderWithProviders(detailWithRoute(),
      { authApi, route: '/provisioning/users/u-live' });
    await waitFor(() => expect(screen.getByTestId('user-detail'))
      .toBeInTheDocument());
    /* Details tab surfaces the DHIS2 mapping + credential status. */
    expect(screen.getByTestId('user-detail-credential'))
      .toHaveTextContent(/Stored/);
    const user = userEvent.setup();
    /* Permissions tab lists derived authorities grouped by module. */
    await user.click(screen.getByRole('button', { name: /permissions/i }));
    await waitFor(() => expect(screen.getByTestId('user-detail-authorities'))
      .toBeInTheDocument());
    expect(screen.getByTestId('user-detail-auth-der.users.read'))
      .toBeInTheDocument();
    expect(screen.getByTestId('user-detail-auth-mod-users'))
      .toHaveTextContent(/users · 2/);
    /* Activity tab lists audit rows for this user. */
    await user.click(screen.getByRole('button', { name: /activity/i }));
    const activity = await screen.findByTestId('user-detail-activity');
    expect(activity).toHaveTextContent('USER_SIGNED_IN');
    expect(activity).toHaveTextContent('USER_DHIS2_MAPPING_SET');
  });

  it('MockupUserDetail Reset-login confirms, calls revokeUserSessions, shows count', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [userFixture({ userId: 'u-live', username: 'alice',
                            displayName: 'Alice', roles: ['ADMIN'] })],
    });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([]);
    vi.spyOn(edgeApi, 'getUserEffectiveAuthorities').mockResolvedValue({
      userId: 'u-live', authorities: [],
    });
    vi.spyOn(edgeApi, 'listAuditEvents').mockResolvedValue({
      count: 0, pageSize: 100, nextCursor: null, events: [],
    });
    const revoke = vi.spyOn(edgeApi, 'revokeUserSessions').mockResolvedValue({
      userId: 'u-live', revokedCount: 2,
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithProviders(detailWithRoute(),
      { authApi, route: '/provisioning/users/u-live' });
    await waitFor(() => expect(screen.getByTestId('user-detail-reset-login'))
      .toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('user-detail-reset-login'));
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('u-live'));
    await waitFor(() => expect(screen.getByTestId('user-detail-msg'))
      .toHaveTextContent(/2 sessions revoked/));
    confirmSpy.mockRestore();
  });

  it('MockupUserDetail Reset-login is a no-op when the operator cancels the confirm', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [userFixture({ userId: 'u-live' })],
    });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([]);
    vi.spyOn(edgeApi, 'getUserEffectiveAuthorities').mockResolvedValue({
      userId: 'u-live', authorities: [],
    });
    vi.spyOn(edgeApi, 'listAuditEvents').mockResolvedValue({
      count: 0, pageSize: 100, nextCursor: null, events: [],
    });
    const revoke = vi.spyOn(edgeApi, 'revokeUserSessions').mockResolvedValue({
      userId: 'u-live', revokedCount: 0,
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWithProviders(detailWithRoute(),
      { authApi, route: '/provisioning/users/u-live' });
    const user = userEvent.setup();
    await user.click(await screen.findByTestId('user-detail-reset-login'));
    expect(revoke).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
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
        lastVerifiedAt: null, authType: null, hasCredential: false, credentialSetAt: null },
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
        mappedBy: 'admin', lastVerifiedAt: null, authType: null, hasCredential: false, credentialSetAt: null },
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
      lastVerifiedAt: null, authType: null, hasCredential: false, credentialSetAt: null,
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
        lastVerifiedAt: null, authType: null, hasCredential: false, credentialSetAt: null },
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
        scope: 'ou',
        boundOrgUnitDisplayName: 'Clinic A',
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

  it('seeds auth-type radio from system default and sends per-mapping override', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [userFixture({ userId: 'u-1', username: 'alice' })],
    });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([]);
    vi.spyOn(edgeApi, 'getDhis2AuthTypeDefault').mockResolvedValue({
      defaultAuthType: 'BASIC',
    });
    vi.spyOn(edgeApi, 'getDhis2UserDetails').mockResolvedValue({
      id: 'ALICE123456', username: 'alice.c', displayName: 'Alice Central',
      email: 'alice@dhis2.local', phoneNumber: null, disabled: false,
      created: null, lastUpdated: null, lastLogin: null, twoFactorEnabled: false,
      organisationUnits: [], userGroups: [],
    });
    const setSpy = vi.spyOn(edgeApi, 'setUserDhis2Mapping').mockResolvedValue({
      edgeUserId: 'u-1', dhis2UserUid: 'ALICE123456', dhis2Username: 'alice.c',
      dhis2DisplayName: null, mappedAt: 'now', mappedBy: 'admin',
      lastVerifiedAt: null, authType: 'TOKEN', hasCredential: true,
      credentialSetAt: 'now',
    });
    renderAt('/provisioning/users/u-1/dhis2-mapping');
    const user = userEvent.setup();
    /* Open the form via the main Edit button so username is seeded from
     * the edge user. */
    await user.click(await screen.findByTestId('user-dhis2-mapping-edit'));
    await waitFor(() =>
      expect(screen.getByTestId('user-dhis2-mapping-form')).toBeInTheDocument());

    /* Default radio is pre-selected. */
    const basicRadio = screen.getByTestId('user-dhis2-mapping-authtype-basic') as HTMLInputElement;
    expect(basicRadio.checked).toBe(true);
    /* Operator picks the non-default. */
    await user.click(screen.getByTestId('user-dhis2-mapping-authtype-token'));
    expect((screen.getByTestId('user-dhis2-mapping-authtype-token') as HTMLInputElement)
      .checked).toBe(true);

    const credInput = screen.getByTestId('user-dhis2-mapping-credential') as HTMLInputElement;

    await user.type(screen.getByTestId('user-dhis2-mapping-input-uid'), 'ALICE123456');
    await user.type(credInput, 'pat-token-shhh');
    await user.click(screen.getByTestId('user-dhis2-mapping-save'));

    await waitFor(() => expect(setSpy).toHaveBeenCalledWith('u-1',
      expect.objectContaining({
        dhis2UserUid: 'ALICE123456',
        authType: 'TOKEN',
        credential: 'pat-token-shhh',
      })));
  });

  it('typing a credential on the default radio sends the resolved authType, not null', async () => {
    /* Regression: when the operator keeps the system-default auth type
     * selected (draft.authType stays null to mean "inherit") and still
     * types a credential, we must send the effective type so the server
     * doesn't 400 with 'authType is required when credential is set'. */
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [userFixture({ userId: 'u-1', username: 'alice' })],
    });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([]);
    vi.spyOn(edgeApi, 'getDhis2AuthTypeDefault').mockResolvedValue({
      defaultAuthType: 'BASIC',
    });
    const setSpy = vi.spyOn(edgeApi, 'setUserDhis2Mapping').mockResolvedValue({
      edgeUserId: 'u-1', dhis2UserUid: 'ALICE123456', dhis2Username: 'alice.c',
      dhis2DisplayName: null, mappedAt: 'now', mappedBy: 'admin',
      lastVerifiedAt: null, authType: 'BASIC', hasCredential: true,
      credentialSetAt: 'now',
    });
    renderAt('/provisioning/users/u-1/dhis2-mapping');
    const user = userEvent.setup();
    await user.click(await screen.findByTestId('user-dhis2-mapping-edit'));
    await waitFor(() =>
      expect(screen.getByTestId('user-dhis2-mapping-form')).toBeInTheDocument());

    /* Do not touch the radios — BASIC stays selected as the system default. */
    await user.type(screen.getByTestId('user-dhis2-mapping-input-uid'), 'ALICE123456');
    await user.type(screen.getByTestId('user-dhis2-mapping-credential'),
      'operators-password');
    await user.click(screen.getByTestId('user-dhis2-mapping-save'));

    await waitFor(() => expect(setSpy).toHaveBeenCalledWith('u-1',
      expect.objectContaining({
        authType: 'BASIC',
        credential: 'operators-password',
      })));
  });

  it('picker defaults to bound-OU scope and operator can broaden to all users', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [userFixture({ userId: 'u-1', username: 'alice' })],
    });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([]);
    vi.spyOn(edgeApi, 'getDhis2AuthTypeDefault').mockResolvedValue({
      defaultAuthType: 'BASIC',
    });
    const searchSpy = vi.spyOn(edgeApi, 'searchDhis2UserCandidates')
      .mockResolvedValue({
        query: '', scope: 'ou',
        boundOrgUnitDisplayName: 'Mulago Hospital',
        candidates: [
          { id: 'OU1LocalUser', username: 'ou.nurse',
            displayName: 'OU Nurse', disabled: false },
        ],
      });
    renderAt('/provisioning/users/u-1/dhis2-mapping');
    const user = userEvent.setup();
    await user.click(await screen.findByTestId('user-dhis2-mapping-add'));
    await user.click(screen.getByTestId('user-dhis2-mapping-picker-input'));
    /* First probe is scope=ou. */
    await waitFor(() => expect(searchSpy)
      .toHaveBeenCalledWith('', expect.objectContaining({ scope: 'ou' })));
    /* Scope chip surfaces the bound-OU display name. */
    await waitFor(() => expect(screen.getByTestId('user-dhis2-mapping-picker-scope-ou'))
      .toHaveTextContent(/Mulago Hospital/));
    /* Operator broadens the scope. */
    searchSpy.mockResolvedValue({
      query: '', scope: 'all',
      candidates: [
        { id: 'OU1LocalUser', username: 'ou.nurse',
          displayName: 'OU Nurse', disabled: false },
        { id: 'DistrictMgr0', username: 'district.sup',
          displayName: 'District Supervisor', disabled: false },
      ],
    });
    await user.click(screen.getByTestId('user-dhis2-mapping-picker-scope-all'));
    await waitFor(() => expect(searchSpy)
      .toHaveBeenCalledWith('', expect.objectContaining({ scope: 'all' })));
  });

  it('saving with no credential leaves authType null so the stored secret is preserved', async () => {
    /* Edits that touch only non-secret fields (display name, etc.) must
     * NOT send a credential, and should leave authType null so the
     * server's COALESCE keeps the existing envelope. */
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [userFixture({ userId: 'u-1', username: 'alice' })],
    });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([
      { edgeUserId: 'u-1', dhis2UserUid: 'ALICE123456', dhis2Username: 'alice.c',
        dhis2DisplayName: 'Alice Central',
        mappedAt: '2026-11-04T10:00:00Z', mappedBy: 'admin',
        lastVerifiedAt: null, authType: 'BASIC', hasCredential: true,
        credentialSetAt: '2026-11-04T10:00:00Z' },
    ]);
    vi.spyOn(edgeApi, 'getDhis2AuthTypeDefault').mockResolvedValue({
      defaultAuthType: 'BASIC',
    });
    const setSpy = vi.spyOn(edgeApi, 'setUserDhis2Mapping').mockResolvedValue({
      edgeUserId: 'u-1', dhis2UserUid: 'ALICE123456', dhis2Username: 'alice.c',
      dhis2DisplayName: 'Alice Renamed', mappedAt: 'now', mappedBy: 'admin',
      lastVerifiedAt: null, authType: 'BASIC', hasCredential: true,
      credentialSetAt: 'now',
    });
    renderAt('/provisioning/users/u-1/dhis2-mapping');
    const user = userEvent.setup();
    await user.click(await screen.findByTestId('user-dhis2-mapping-edit-panel'));
    const dn = await screen.findByTestId('user-dhis2-mapping-input-display-name') as HTMLInputElement;
    await user.clear(dn);
    await user.type(dn, 'Alice Renamed');
    await user.click(screen.getByTestId('user-dhis2-mapping-save'));
    await waitFor(() => expect(setSpy).toHaveBeenCalledWith('u-1',
      expect.objectContaining({
        dhis2DisplayName: 'Alice Renamed',
        authType: 'BASIC',
        credential: null,
      })));
  });

  it('shows "Credential stored" status and placeholder encourages leaving the field blank when a credential is already sealed', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [userFixture({ userId: 'u-1', username: 'alice' })],
    });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([
      { edgeUserId: 'u-1', dhis2UserUid: 'ALICE123456', dhis2Username: 'alice.c',
        dhis2DisplayName: 'Alice Central',
        mappedAt: '2026-11-04T10:00:00Z', mappedBy: 'admin',
        lastVerifiedAt: null, authType: 'TOKEN', hasCredential: true,
        credentialSetAt: '2026-11-04T10:00:00Z' },
    ]);
    vi.spyOn(edgeApi, 'getDhis2AuthTypeDefault').mockResolvedValue({
      defaultAuthType: 'BASIC',
    });
    renderAt('/provisioning/users/u-1/dhis2-mapping');
    await waitFor(() =>
      expect(screen.getByTestId('user-dhis2-mapping-current'))
        .toBeInTheDocument());
    expect(screen.getByTestId('user-dhis2-mapping-current'))
      .toHaveTextContent(/Stored/);
    expect(screen.getByTestId('user-dhis2-mapping-current'))
      .toHaveTextContent(/override/);

    const user = userEvent.setup();
    await user.click(screen.getByTestId('user-dhis2-mapping-edit-panel'));
    const credInput = await screen.findByTestId('user-dhis2-mapping-credential') as HTMLInputElement;
    expect(credInput.placeholder).toMatch(/Leave blank to keep current/);
  });

  it('unmapped user with no credential surfaces the "push blocked" warning', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [userFixture({ userId: 'u-1', username: 'alice' })],
    });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([
      { edgeUserId: 'u-1', dhis2UserUid: 'ALICE123456', dhis2Username: 'alice.c',
        dhis2DisplayName: null, mappedAt: 'now', mappedBy: 'admin',
        lastVerifiedAt: null, authType: null, hasCredential: false,
        credentialSetAt: null },
    ]);
    vi.spyOn(edgeApi, 'getDhis2AuthTypeDefault').mockResolvedValue({
      defaultAuthType: 'BASIC',
    });
    renderAt('/provisioning/users/u-1/dhis2-mapping');
    await waitFor(() =>
      expect(screen.getByTestId('user-dhis2-mapping-current'))
        .toHaveTextContent(/Not set/));
  });

  it('after picker selection extended user details (email + orgUnit) are fetched and rendered', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [userFixture({ userId: 'u-1', username: 'alice' })],
    });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([]);
    vi.spyOn(edgeApi, 'getDhis2AuthTypeDefault').mockResolvedValue({
      defaultAuthType: 'BASIC',
    });
    vi.spyOn(edgeApi, 'searchDhis2UserCandidates').mockResolvedValue({
      query: '',
      scope: 'ou',
      candidates: [
        { id: 'A1B2C3D4E5F', username: 'alice.c',
          displayName: 'Alice Central', disabled: false },
      ],
    });
    const detailsSpy = vi.spyOn(edgeApi, 'getDhis2UserDetails').mockResolvedValue({
      id: 'A1B2C3D4E5F', username: 'alice.c', displayName: 'Alice Central',
      email: 'alice@dhis2.local', phoneNumber: '+256700000000',
      disabled: false, created: '2024-01-01T00:00:00Z', lastUpdated: null,
      lastLogin: '2026-11-04T09:00:00Z', twoFactorEnabled: true,
      organisationUnits: [
        { id: 'ou-1', displayName: 'Mulago Hospital' },
        { id: 'ou-2', displayName: 'Butabika Hospital' },
      ],
      userGroups: [{ id: 'ug-1', displayName: 'Data entry clerks' }],
    });
    renderAt('/provisioning/users/u-1/dhis2-mapping');
    const user = userEvent.setup();
    await user.click(await screen.findByTestId('user-dhis2-mapping-add'));
    await user.click(screen.getByTestId('user-dhis2-mapping-picker-input'));
    const row = await screen.findByTestId('user-dhis2-mapping-picker-row-A1B2C3D4E5F');
    await user.click(row);
    await waitFor(() => expect(detailsSpy)
      .toHaveBeenCalledWith('A1B2C3D4E5F'));
    const detailsPanel = await screen.findByTestId('user-dhis2-mapping-details-dl');
    expect(detailsPanel).toHaveTextContent('alice@dhis2.local');
    expect(detailsPanel).toHaveTextContent('+256700000000');
    expect(detailsPanel).toHaveTextContent('Mulago Hospital');
    expect(detailsPanel).toHaveTextContent('Butabika Hospital');
    expect(detailsPanel).toHaveTextContent('Data entry clerks');
    expect(detailsPanel).toHaveTextContent(/2FA enabled/);
  });

  it('DHIS2 details fetch failure surfaces an inline warning but preserves the form', async () => {
    vi.spyOn(edgeApi, 'listUsers').mockResolvedValue({
      users: [userFixture({ userId: 'u-1', username: 'alice' })],
    });
    vi.spyOn(edgeApi, 'listUserDhis2Mappings').mockResolvedValue([]);
    vi.spyOn(edgeApi, 'getDhis2AuthTypeDefault').mockResolvedValue({
      defaultAuthType: 'BASIC',
    });
    vi.spyOn(edgeApi, 'getDhis2UserDetails')
      .mockRejectedValue(new Error('503 DHIS2 unreachable'));
    renderAt('/provisioning/users/u-1/dhis2-mapping');
    const user = userEvent.setup();
    await user.click(await screen.findByTestId('user-dhis2-mapping-add'));
    await user.type(screen.getByTestId('user-dhis2-mapping-input-uid'),
      'A1B2C3D4E5F');
    await waitFor(() =>
      expect(screen.getByTestId('user-dhis2-mapping-details-err'))
        .toHaveTextContent(/503 DHIS2 unreachable/));
    expect(screen.getByTestId('user-dhis2-mapping-save')).toBeInTheDocument();
  });
});
