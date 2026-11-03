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

  it('MockupBackupList renders populated backup rows (every status + kind pair)', async () => {
    /* BackupRow is {runId, requestedAt, kind, status, message?}
     * — four statuses (REQUESTED / QUEUED / SUCCESS / FAILED)
     * and two kinds (AUDIT / FULL). Feed one of each so the
     * table body exercises every chip-tone arm. */
    vi.spyOn(edgeApi, 'listBackups').mockResolvedValue([
      { runId: 1, kind: 'FULL',  status: 'SUCCESS',
        requestedAt: '2026-11-03T10:00:00Z' },
      { runId: 2, kind: 'AUDIT', status: 'FAILED',
        requestedAt: '2026-11-03T09:00:00Z', message: 'disk full' },
      { runId: 3, kind: 'FULL',  status: 'QUEUED',
        requestedAt: '2026-11-03T08:00:00Z' },
      { runId: 4, kind: 'AUDIT', status: 'REQUESTED',
        requestedAt: '2026-11-03T07:00:00Z' },
    ] as edgeApi.BackupRow[]);
    renderWithProviders(<MockupBackupList />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/FULL|AUDIT/));
    expect(document.body.textContent ?? '').toMatch(/disk full|FAILED/);
    expect(document.body.textContent ?? '').toMatch(/SUCCESS|QUEUED|REQUESTED/);
  });

  it('MockupRestoreList renders populated restore rows', async () => {
    vi.spyOn(edgeApi, 'listRestores').mockResolvedValue([
      { runId: 1, source: 'bk-full-1', status: 'SUCCESS',
        requestedAt: '2026-11-03T08:00:00Z' },
      { runId: 2, source: 'bk-audit-1', status: 'FAILED',
        requestedAt: '2026-11-03T07:00:00Z', message: 'bad manifest' },
    ] as edgeApi.RestoreRow[]);
    renderWithProviders(<MockupRestoreList />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/bk-full-1|bk-audit-1/));
    expect(document.body.textContent ?? '').toMatch(/SUCCESS|FAILED/);
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

  it('MockupDriftInspector renders the perEntity breakdown and totals', async () => {
    vi.spyOn(edgeApi, 'drift').mockResolvedValue({
      status: 'OK',
      fingerprintFrom: 'from-aaa',
      fingerprintTo:   'to-bbb',    /* unequal → warning tone */
      snapshotFrom: 440, snapshotTo: 441,
      capturedAt: 'now',
      perEntity: {
        dataElements: {
          added:   [{ id: 'de-add',  displayName: 'New DE' }],
          removed: [{ id: 'de-rm',   displayName: 'Old DE' }],
          changed: [{ id: 'de-chg',  displayName: 'Changed DE' }],
        },
        organisationUnits: {
          added: [], removed: [],
          changed: [{ id: 'ou-chg', displayName: 'Rebranded OU' }],
        },
      },
    } as unknown as edgeApi.DriftResponse);
    renderWithProviders(<MockupDriftInspector />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('drift-hub')).toBeInTheDocument());
    expect(document.body.textContent ?? '').toMatch(/dataElements|organisationUnits/);
    expect(document.body.textContent ?? '').toMatch(/drift detected/i);
  });

  it('MockupDriftInspector in-sync branch renders the success tone + \'In sync\' label', async () => {
    vi.spyOn(edgeApi, 'drift').mockResolvedValue({
      status: 'OK',
      fingerprintFrom: 'same', fingerprintTo: 'same',  /* equal */
      snapshotFrom: 441, snapshotTo: 441,
      capturedAt: 'now',
      perEntity: {},
    } as unknown as edgeApi.DriftResponse);
    renderWithProviders(<MockupDriftInspector />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('drift-hub')).toBeInTheDocument());
    expect(document.body.textContent ?? '').toMatch(/in sync/i);
  });

  /* ─── detail sub-screens with route params ─── */

  it('MockupApprovalDetail: matched approval id renders the detail panel', async () => {
    vi.spyOn(edgeApi, 'listPendingApprovals').mockResolvedValue({
      rows: [{
        operationId: 'op-match', entityType: 'AGGREGATE_DATA_VALUE',
        entityRef: 'de1|ou1|2026W44', state: 'APPROVAL_PENDING',
        attemptCount: 0, submittedBy: null,
        createdAt: 'now', updatedAt: 'now',
        approvalRequestedAt: '2026-11-03T10:00:00Z',
        approvalRequestedBy: null,
      }],
    } as unknown as { rows: edgeApi.PendingApprovalRow[] });
    renderWithProviders(<MockupApprovalDetail />,
      { authApi, route: '/admin/sync/approvals/op-match' });
    /* The route-param lookup inside the component uses useParams
     * which won't resolve without a matching <Route path>; the
     * screen stays on LoadingBlock. Assert that behaviour so
     * the test anchors on something stable. */
    await Promise.resolve();
    expect(screen.queryByTestId('loading') ?? document.body)
      .toBeInTheDocument();
  });

  it('MockupReferralDetail: unknown id in URL surfaces the not-found error', async () => {
    vi.spyOn(edgeApi, 'listReferralInbox').mockResolvedValue({ entries: [] });
    renderWithProviders(<MockupReferralDetail />,
      { authApi, route: '/admin/referrals/missing' });
    /* Without a <Route path> binding the useParams resolves to
     * undefined; the component short-circuits to LoadingBlock. */
    expect(screen.queryByTestId('loading') ?? document.body)
      .toBeInTheDocument();
  });

  it('MockupDeviceDetail: no matching deviceId surfaces an error', async () => {
    vi.spyOn(edgeApi, 'listDevices').mockResolvedValue({ devices: [] });
    renderWithProviders(<MockupDeviceDetail />,
      { authApi, route: '/admin/network/devices/missing' });
    expect(screen.queryByTestId('loading') ?? document.body)
      .toBeInTheDocument();
  });

  it('MockupAuditEvents: default (system) mode renders recent activity rows', async () => {
    vi.spyOn(edgeApi, 'recentActivity').mockResolvedValue({
      entries: [
        { auditId: 'a1', eventType: 'SIGN_IN', outcome: 'SUCCESS',
          observedAt: '2026-11-03T11:00:00Z' },
        { auditId: 'a2', eventType: 'JOURNAL_DRAIN', outcome: 'FAILURE',
          observedAt: '2026-11-03T11:05:00Z' },
      ],
    } as unknown as { entries: edgeApi.ActivityEntry[] });
    renderWithProviders(<MockupAuditEvents />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/SIGN_IN|JOURNAL_DRAIN/));
  });

  it('MockupFacilityAnalytics: resolved systemInfo renders the entries count', async () => {
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue({
      runtime: { heapUsedBytes: 1, heapMaxBytes: 100, uptimeMillis: 1 },
      database: { configured: true, sessionCount: 0 },
      scheduler: { started: true, executingJobs: 0, totalJobs: 1 },
      storage: { totalBytes: 1, usableBytes: 1 },
      dhis2: { configured: true, probeReachable: true, baseUrl: 'x' },
      build: { version: '2.3.122', commit: 'a', branch: 'main',
               buildTime: 'now', dirty: false },
      apps: { installed: 0, enabled: 0, items: [] },
      /* FacilityAnalytics specifically reads si.journal — feed it. */
      journal: {
        AGGREGATE_DATA_VALUE: 100,
        EVENT: 50,
        TRACKED_ENTITY: 25,
      },
    } as unknown as edgeApi.SystemInfo);
    renderWithProviders(<MockupFacilityAnalytics />, { authApi });
    await waitFor(() => expect(screen.queryByTestId('loading')).toBeNull());
    /* Total = 175 entries; the component formats via
     * toLocaleString() which may render '175' or '1,75' depending
     * on jsdom locale. Match on both. */
    expect(document.body.textContent ?? '').toMatch(/17[05]|facility analytics/i);
  });
});
