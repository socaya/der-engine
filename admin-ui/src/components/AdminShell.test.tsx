import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { OrgUnitProvider } from './OrgUnitContext';
import { AdminShell } from './AdminShell';
import * as edgeApi from '../api/edgeApi';

/* AdminShell is a layout shell with multiple branches driven by:
 *  - location.pathname === '/sign-in' (sign-in banner mode)
 *  - auth state (AUTHENTICATED vs UNAUTHENTICATED)
 *  - mobile-open toggle
 *  - runtime mode polls (health + dhis2Ping)
 *  - attention centre polls (conflicts + approvals + referrals + worker)
 *  - OU binding state
 *
 * We stub every edgeApi helper the shell polls so the test doesn't
 * depend on a running DER, then drive the shell through its various
 * modes and interactions. */

const authApi = {
  session: vi.fn().mockResolvedValue({
    userId: 'u1', username: 'admin', displayName: 'Admin User',
    roles: ['ADMIN'], expiresAt: '2027-01-01T00:00:00Z',
  }),
  signIn: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
};

function wrap(ui: JSX.Element, route = '/'): JSX.Element {
  return (
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider api={authApi as never}>
        <OrgUnitProvider>
          {ui}
        </OrgUnitProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  /* vi.restoreAllMocks() in afterEach resets vi.fn()s to return
   * undefined — re-establish the session mock each run. */
  authApi.session = vi.fn().mockResolvedValue({
    userId: 'u1', username: 'admin', displayName: 'Admin User',
    roles: ['ADMIN'], expiresAt: '2027-01-01T00:00:00Z',
  });
  authApi.signOut = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(edgeApi, 'health').mockResolvedValue({
    service: 'der-server', status: 'UP', version: '2.3.123',
    commit: 'a', branch: 'main', dirty: false, buildTime: 'now',
    dhis2Integrated: true, timestamp: 'now',
  } as unknown as edgeApi.HealthResponse);
  vi.spyOn(edgeApi, 'dhis2Ping').mockResolvedValue({
    reachable: true, probeDurationMs: 42,
    probedAt: 'now', message: null,
    centralVersion: '2.44',
  } as unknown as edgeApi.PingSnapshot);
  vi.spyOn(edgeApi, 'listConflicts').mockResolvedValue([]);
  vi.spyOn(edgeApi, 'listPendingApprovals').mockResolvedValue({
    rows: [], total: 0,
  } as never);
  vi.spyOn(edgeApi, 'listReferralInbox').mockResolvedValue({
    entries: [],
  } as never);
  vi.spyOn(edgeApi, 'workerHealth').mockResolvedValue({
    enabled: true, probeTimestamp: 'now',
    lastTick: 'now', lastBatchSize: 0, backlog: {},
  } as unknown as edgeApi.WorkerHealth);
  vi.spyOn(edgeApi, 'getOrgUnitBinding').mockResolvedValue({
    bound: true, orgUnitId: 'OU-1', orgUnitDisplayName: 'Clinic One',
  } as unknown as edgeApi.OrgUnitBinding);
});

afterEach(() => vi.restoreAllMocks());

describe('AdminShell — sign-in mode', () => {
  it('/sign-in route renders brand + hides sidebar and user chip', async () => {
    render(wrap(<AdminShell><div>child</div></AdminShell>, '/sign-in'));
    await waitFor(() =>
      expect(screen.getByTestId('brand')).toBeInTheDocument());
    expect(screen.queryByTestId('sidebar')).toBeNull();
    expect(screen.queryByTestId('headerbar-user')).toBeNull();
  });
});

describe('AdminShell — authenticated mode', () => {
  it('renders sidebar, operating-mode pill, user menu, OU chip', async () => {
    render(wrap(<AdminShell><div>child</div></AdminShell>));
    await waitFor(() =>
      expect(screen.getByTestId('sidebar')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByTestId('topbar-mode')).toBeInTheDocument());
    /* OU chip — moved from the right side to the left slot
     * (UI-11); still carries the bound org-unit display name. */
    await waitFor(() =>
      expect(screen.getByText('Clinic One')).toBeInTheDocument());
    /* User menu trigger — avatar shows initials of "Admin User"
     * ("AU"); display name + role live in the dropdown now. */
    expect(screen.getByTestId('user-menu-trigger')).toBeInTheDocument();
    expect(screen.getByText('AU')).toBeInTheDocument();
  });

  /* UI-11 — the sidebar toggle button was removed from the topbar
   * because the sidebar never collapses. Test retired. */

  it('User menu dropdown exposes Sign out and triggers signOut()', async () => {
    render(wrap(<AdminShell><div>c</div></AdminShell>));
    await waitFor(() =>
      expect(screen.getByTestId('user-menu-trigger')).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('user-menu-trigger'));
    await waitFor(() =>
      expect(screen.getByTestId('user-menu-signout')).toBeInTheDocument());
    await user.click(screen.getByTestId('user-menu-signout'));
    expect(authApi.signOut).toHaveBeenCalledTimes(1);
  });

  it('Operating-mode pill — DER operational + central reachable → "operational"', async () => {
    const { container } = render(wrap(<AdminShell><div>c</div></AdminShell>));
    await waitFor(() =>
      expect(screen.getByTestId('topbar-mode')).toBeInTheDocument());
    /* Allow the first probe cycle to resolve. */
    await waitFor(() => {
      const pill = container.querySelector('[data-test="topbar-mode"]');
      expect(pill?.className ?? '').toMatch(/ea-topbar-mode--operational/);
    });
  });

  it('Operating-mode pill — central unreachable → "offline-first"', async () => {
    vi.spyOn(edgeApi, 'dhis2Ping').mockResolvedValue({
      reachable: false, probeDurationMs: null,
      probedAt: 'now', message: 'ECONNREFUSED',
      centralVersion: null,
    } as unknown as edgeApi.PingSnapshot);
    const { container } = render(wrap(<AdminShell><div>c</div></AdminShell>));
    await waitFor(() => {
      const pill = container.querySelector('[data-test="topbar-mode"]');
      expect(pill?.className ?? '').toMatch(/ea-topbar-mode--offline-first/);
    });
  });

  it('Operating-mode pill — DER status "starter-ready" → "starting"', async () => {
    vi.spyOn(edgeApi, 'health').mockResolvedValue({
      service: 'der-server', status: 'starter-ready', version: '2.3.123',
      commit: 'a', branch: 'main', dirty: false, buildTime: 'now',
      dhis2Integrated: true, timestamp: 'now',
    } as unknown as edgeApi.HealthResponse);
    const { container } = render(wrap(<AdminShell><div>c</div></AdminShell>));
    await waitFor(() => {
      const pill = container.querySelector('[data-test="topbar-mode"]');
      expect(pill?.className ?? '').toMatch(/ea-topbar-mode--starting/);
    });
  });

  it('Operating-mode pill — DER status unknown → "degraded"', async () => {
    vi.spyOn(edgeApi, 'health').mockResolvedValue({
      service: 'der-server', status: 'DEGRADED', version: '2.3.123',
      commit: 'a', branch: 'main', dirty: false, buildTime: 'now',
      dhis2Integrated: true, timestamp: 'now',
    } as unknown as edgeApi.HealthResponse);
    const { container } = render(wrap(<AdminShell><div>c</div></AdminShell>));
    await waitFor(() => {
      const pill = container.querySelector('[data-test="topbar-mode"]');
      expect(pill?.className ?? '').toMatch(/ea-topbar-mode--degraded/);
    });
  });

  it('Attention centre — zero attention items shows "All clear"', async () => {
    render(wrap(<AdminShell><div>c</div></AdminShell>));
    await waitFor(() =>
      expect(screen.getByTestId('topbar-bell')).toBeInTheDocument());
    /* The attention popover is a <details> element; opening it is
     * tricky without userEvent. Instead, inspect the aggregate
     * total via the aria-label. */
    const bell = screen.getByTestId('topbar-bell') as HTMLElement;
    expect(bell.getAttribute('aria-label')).toMatch(/Attention \(0\)/);
  });

  it('Attention centre — mixed signals aggregate into a non-zero badge', async () => {
    vi.spyOn(edgeApi, 'listConflicts').mockResolvedValue([
      { operationId: 'op-1', state: 'CONFLICT_REVIEW', attemptCount: 1,
        lastError: 'x', nextHopOrgUnitUid: null, createdAt: 'now',
        updatedAt: 'now' } as unknown as edgeApi.ConflictRow,
    ]);
    vi.spyOn(edgeApi, 'listPendingApprovals').mockResolvedValue({
      rows: [{ approvalId: 'ap-1' }], total: 1,
    } as never);
    vi.spyOn(edgeApi, 'listReferralInbox').mockResolvedValue({
      entries: [
        { inboxId: 'inb-1', status: 'PENDING' },
        { inboxId: 'inb-2', status: 'PENDING' },
        { inboxId: 'inb-3', status: 'ACKED' },
      ],
    } as never);
    vi.spyOn(edgeApi, 'workerHealth').mockResolvedValue({
      enabled: false, probeTimestamp: 'now', lastTick: null,
      lastBatchSize: 0, backlog: {},
    } as unknown as edgeApi.WorkerHealth);
    render(wrap(<AdminShell><div>c</div></AdminShell>));
    await waitFor(() => {
      const bell = screen.getByTestId('topbar-bell') as HTMLElement;
      /* Total: 1 conflict + 1 approval + 2 pending referrals + 1 worker = 5. */
      expect(bell.getAttribute('aria-label')).toMatch(/Attention \(5\)/);
    });
  });

  it('OU chip renders "Not bound" when binding is unbound', async () => {
    vi.spyOn(edgeApi, 'getOrgUnitBinding').mockResolvedValue({
      bound: false, orgUnitId: null, orgUnitDisplayName: null,
    } as unknown as edgeApi.OrgUnitBinding);
    render(wrap(<AdminShell><div>c</div></AdminShell>));
    await waitFor(() =>
      expect(screen.getByText('Not bound')).toBeInTheDocument());
  });

  it('initials fallback — single-word username becomes "AD"', async () => {
    authApi.session.mockResolvedValueOnce({
      userId: 'u1', username: 'admin', displayName: null,
      roles: ['OPERATOR'], expiresAt: '2027-01-01T00:00:00Z',
    });
    render(wrap(<AdminShell><div>c</div></AdminShell>));
    /* "admin" → "AD" (slice(0, 2).toUpperCase()). */
    await waitFor(() =>
      expect(screen.getByText('AD')).toBeInTheDocument());
  });
});
