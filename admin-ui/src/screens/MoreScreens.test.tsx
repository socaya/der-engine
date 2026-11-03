import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import {
  MockupDriftInspector,
  MockupConflictList,
  MockupConflictDetail,
  MockupWorkerHealth,
  MockupDeviceFleet,
  MockupDeviceDetail,
  MockupApprovalQueue,
  MockupApprovalDetail,
  MockupReferralInbox,
  MockupReferralDetail,
  MockupBackupList,
  MockupRestoreList,
  MockupCompatInspector,
  MockupAuditEvents,
  MockupFacilityAnalytics,
} from './MoreScreens';
import * as edgeApi from '../api/edgeApi';

const authApi = {
  session: vi.fn().mockResolvedValue({
    userId: 'u1', username: 'admin', displayName: 'Admin',
    roles: ['ADMIN'], expiresAt: '2027-01-01T00:00:00Z',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

/* Each sub-screen owns its own pending useState([null]). Before any
 * mocked API resolves, the component is in a LoadingBlock. Making
 * every API return a never-resolving promise forces the loading
 * state for every exported screen so the test asserts the import
 * + mount path works end-to-end without crashing.
 *
 * This gives us line coverage of the import graph without having to
 * fabricate response shapes for 15 unrelated endpoints — the deeper
 * per-sub-screen behaviour belongs in a focused test if that
 * sub-screen is ever extracted. */
function stubEverythingPending(): void {
  const noop = (): Promise<never> => new Promise(() => undefined);
  const mod = edgeApi as unknown as Record<string, unknown>;
  for (const key of Object.keys(mod)) {
    if (typeof mod[key] === 'function') {
      try {
        (vi.spyOn(mod, key as never) as { mockImplementation(impl: unknown): unknown })
          .mockImplementation(noop);
      } catch { /* some exports (session, EdgeApiError) can't be spied */ }
    }
  }
}

interface MountCase { name: string; component: () => JSX.Element; route?: string }

const screens: MountCase[] = [
  { name: 'MockupDriftInspector', component: MockupDriftInspector },
  { name: 'MockupConflictList',   component: MockupConflictList },
  { name: 'MockupConflictDetail', component: MockupConflictDetail,
    route: '/admin/sync/attention/op-1' },
  { name: 'MockupWorkerHealth',   component: MockupWorkerHealth },
  { name: 'MockupDeviceFleet',    component: MockupDeviceFleet },
  { name: 'MockupDeviceDetail',   component: MockupDeviceDetail,
    route: '/admin/network/connected/dev-1' },
  { name: 'MockupApprovalQueue',  component: MockupApprovalQueue },
  { name: 'MockupApprovalDetail', component: MockupApprovalDetail,
    route: '/admin/sync/approvals/op-1' },
  { name: 'MockupReferralInbox',  component: MockupReferralInbox },
  { name: 'MockupReferralDetail', component: MockupReferralDetail,
    route: '/admin/referrals/ref-1' },
  { name: 'MockupBackupList',     component: MockupBackupList },
  { name: 'MockupRestoreList',    component: MockupRestoreList },
  { name: 'MockupCompatInspector', component: MockupCompatInspector },
  { name: 'MockupAuditEvents',    component: MockupAuditEvents },
  { name: 'MockupFacilityAnalytics', component: MockupFacilityAnalytics },
];

describe('MoreScreens — surface mount test', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  for (const sc of screens) {
    it(`${sc.name} mounts without throwing`, () => {
      stubEverythingPending();
      const Comp = sc.component;
      const { container } = renderWithProviders(<Comp />,
        { authApi, route: sc.route ?? '/' });
      /* Everything's either LoadingBlock or the component's own
       * empty fallback — the key assertion is 'did it render any
       * node without throwing'. */
      expect(container.firstChild).not.toBeNull();
    });
  }

  it('MockupWorkerHealth responds to a resolved workerHealth probe', async () => {
    vi.spyOn(edgeApi, 'workerHealth').mockResolvedValue({
      enabled: true, probeTimestamp: 'now',
      backlog: { PENDING: 0, IN_FLIGHT: 0, RETRYABLE: 0,
                 CONFLICT_REVIEW: 0, CENTRAL_REJECTED: 0 },
    } as unknown as edgeApi.WorkerHealth);
    renderWithProviders(<MockupWorkerHealth />, { authApi });
    await waitFor(() => expect(screen.queryByTestId('loading')).toBeNull());
  });

  it('MockupConflictList renders ErrorBlock when listConflicts rejects', async () => {
    vi.spyOn(edgeApi, 'listConflicts').mockRejectedValue(new Error('rejected'));
    renderWithProviders(<MockupConflictList />, { authApi });
    await waitFor(() => expect(screen.getByTestId('err-conflicts'))
      .toBeInTheDocument());
    expect(screen.getByTestId('err-conflicts')).toHaveTextContent(/rejected/i);
  });

  it('MockupConflictList renders rows from a populated listConflicts probe', async () => {
    vi.spyOn(edgeApi, 'listConflicts').mockResolvedValue([
      { operationId: 'op-1', entityType: 'AGGREGATE_DATA_VALUE',
        entityRef: 'de1|ou1|2026W44', payloadJson: {},
        state: 'CONFLICT_REVIEW', attemptCount: 1,
        lastError: 'central rejected', submittedBy: null,
        createdAt: 'now', updatedAt: 'now',
        nextHopOrgUnitUid: null },
    ] as unknown as edgeApi.ConflictRow[]);
    renderWithProviders(<MockupConflictList />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/de1\|ou1\|2026W44/));
  });

  it('MockupDeviceFleet renders a populated listDevices probe', async () => {
    vi.spyOn(edgeApi, 'listDevices').mockResolvedValue({
      devices: [
        { deviceId: 'dev-approved-123456', status: 'APPROVED',
          displayName: 'Clinic kiosk', formFactor: 'TABLET',
          lastSeenAt: '2026-11-03T11:00:00Z', assignedUserId: null,
          enrolmentTokenHash: 'h', enrolledAt: 'now',
          approvedBy: null, approvedAt: null, userAgent: 'ua',
          firmwareVersion: null },
        { deviceId: 'dev-pending-xyzabc', status: 'PENDING',
          displayName: null, formFactor: 'MOBILE',
          lastSeenAt: '2026-11-03T10:00:00Z', assignedUserId: null,
          enrolmentTokenHash: 'h', enrolledAt: 'now',
          approvedBy: null, approvedAt: null, userAgent: 'ua',
          firmwareVersion: null },
      ],
    } as unknown as { devices: edgeApi.EdgeDeviceRow[] });
    renderWithProviders(<MockupDeviceFleet />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/clinic kiosk/i));
  });
});
