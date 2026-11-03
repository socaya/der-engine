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

  it('MockupReferralInbox renders a populated listReferralInbox probe', async () => {
    /* ReferralInboxRow uses inboxId/sourceRef/status (not
     * operationId/entityRef/state). */
    vi.spyOn(edgeApi, 'listReferralInbox').mockResolvedValue({
      entries: [
        { inboxId: 'ib-1', kind: 'TRACKED_ENTITY',
          sourceRef: 'tei-abc', boundOrgUnit: 'ou-1',
          discoveredAt: '2026-11-03T11:00:00Z', status: 'PENDING' },
        { inboxId: 'ib-2', kind: 'ENROLLMENT',
          sourceRef: 'enr-xyz', boundOrgUnit: 'ou-1',
          discoveredAt: '2026-11-03T10:00:00Z', status: 'ACCEPTED' },
      ],
    } as unknown as { entries: edgeApi.ReferralInboxRow[] });
    renderWithProviders(<MockupReferralInbox />, { authApi });
    await waitFor(() => expect(document.body.textContent ?? '')
      .toMatch(/tei-abc|enr-xyz|1 pending/i));
  });

  it('MockupReferralInbox renders an empty-state when the inbox is empty', async () => {
    vi.spyOn(edgeApi, 'listReferralInbox').mockResolvedValue({ entries: [] });
    renderWithProviders(<MockupReferralInbox />, { authApi });
    await waitFor(() => expect(screen.queryByTestId('loading')).toBeNull());
    /* The empty-state copy varies ("No referrals" / "No pending"
     * / "Inbox empty") so match on the broader empty pattern. */
    expect(document.body.textContent ?? '').toMatch(/no referrals|no pending|empty|all clear/i);
  });

  it('MockupBackupList renders populated backup rows', async () => {
    vi.spyOn(edgeApi, 'listBackups').mockResolvedValue([
      { backupId: 'bk-full-1', kind: 'FULL', status: 'SUCCEEDED',
        startedAt: '2026-11-03T10:00:00Z', completedAt: '2026-11-03T10:01:00Z',
        requestedBy: null, requestedAt: 'now',
        destinationPath: '/tmp/bk-full-1',
        sizeBytes: 10_000_000, errorMessage: null },
      { backupId: 'bk-audit-1', kind: 'AUDIT', status: 'FAILED',
        startedAt: '2026-11-03T09:00:00Z', completedAt: '2026-11-03T09:00:30Z',
        requestedBy: null, requestedAt: 'now',
        destinationPath: '/tmp/bk-audit-1',
        sizeBytes: null, errorMessage: 'disk full' },
    ] as unknown as edgeApi.BackupRow[]);
    renderWithProviders(<MockupBackupList />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/bk-full-1|FULL/i));
    expect(document.body.textContent ?? '').toMatch(/disk full|FAILED/i);
  });

  it('MockupRestoreList renders populated restore rows', async () => {
    vi.spyOn(edgeApi, 'listRestores').mockResolvedValue([
      { restoreId: 'rs-1', kind: 'LOCAL', status: 'SUCCEEDED',
        startedAt: '2026-11-03T08:00:00Z', completedAt: '2026-11-03T08:05:00Z',
        requestedBy: null, requestedAt: 'now',
        sourcePath: '/tmp/bk-full-1', errorMessage: null },
    ] as unknown as edgeApi.RestoreRow[]);
    renderWithProviders(<MockupRestoreList />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/rs-1|LOCAL|SUCCEEDED/i));
  });

  it('MockupCompatInspector renders details from a resolved compat probe', async () => {
    vi.spyOn(edgeApi, 'compat').mockResolvedValue({
      status: 'OK', snapshotId: 442,
      capturedAt: '2026-11-03T10:00:00Z',
      centralVersion: '2.44-SNAPSHOT',
      profileName: 'V2_44', probeReachable: true,
      probeDurationMs: 927, engineVersion: '1.0.0',
      capabilities: { trackerApi: 'TRACKER_ONLY' },
      pinnedVersion: '2.44-SNAPSHOT', pingHistory: [],
    } as unknown as edgeApi.CompatSnapshot);
    renderWithProviders(<MockupCompatInspector />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/2\.44|V2_44|TRACKER_ONLY/));
  });

  it('MockupApprovalQueue renders populated approvals', async () => {
    vi.spyOn(edgeApi, 'listPendingApprovals').mockResolvedValue({
      rows: [
        { operationId: 'op-approve-1', entityType: 'AGGREGATE_DATA_VALUE',
          entityRef: 'de1|ou1|2026W44', state: 'APPROVAL_PENDING',
          attemptCount: 0, submittedBy: null,
          createdAt: 'now', updatedAt: 'now',
          approvalRequestedAt: '2026-11-03T10:00:00Z',
          approvalRequestedBy: null },
      ],
    } as unknown as { rows: edgeApi.PendingApprovalRow[] });
    renderWithProviders(<MockupApprovalQueue />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/op-approve-1|de1\|ou1/));
  });

  it('MockupWorkerHealth with worker disabled surfaces the pause-flag path', async () => {
    vi.spyOn(edgeApi, 'workerHealth').mockResolvedValue({
      enabled: false, probeTimestamp: 'now',
      backlog: { PENDING: 2, IN_FLIGHT: 1, RETRYABLE: 0,
                 CONFLICT_REVIEW: 3, CENTRAL_REJECTED: 1 },
    } as unknown as edgeApi.WorkerHealth);
    renderWithProviders(<MockupWorkerHealth />, { authApi });
    await waitFor(() => expect(screen.queryByTestId('loading')).toBeNull());
    /* The disabled-worker branch surfaces 'Resume' as the action
     * verb; the enabled branch is already covered elsewhere. */
    expect(document.body.textContent ?? '').toMatch(/resume|disabled|paused/i);
  });
});
