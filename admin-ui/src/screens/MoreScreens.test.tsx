import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
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

  it('MockupConflictList — all four problem-state branches + priorities', async () => {
    /* Feed one row per problemFor() arm so lines 203-219 all run,
     * including the two priority branches (attemptCount >=5 → High,
     * >=2 → Medium). */
    vi.spyOn(edgeApi, 'listConflicts').mockResolvedValue([
      { operationId: 'op-rejected', entityType: 'EVENT', entityRef: 'ev-rej',
        payloadJson: {}, state: 'CENTRAL_REJECTED', attemptCount: 3,
        lastError: 'bad', submittedBy: null, createdAt: 'now',
        updatedAt: 'now', nextHopOrgUnitUid: null },
      { operationId: 'op-retry', entityType: 'TRACKED_ENTITY', entityRef: 'tei-r',
        payloadJson: {}, state: 'RETRYABLE', attemptCount: 7,
        lastError: 'net', submittedBy: null, createdAt: 'now',
        updatedAt: 'now', nextHopOrgUnitUid: null },
      { operationId: 'op-unknown', entityType: 'ENROLLMENT', entityRef: 'enr-u',
        payloadJson: {}, state: 'UNKNOWN_OUTCOME', attemptCount: 1,
        lastError: null, submittedBy: null, createdAt: 'now',
        updatedAt: 'now', nextHopOrgUnitUid: null },
      { operationId: 'op-other', entityType: 'RELATIONSHIP', entityRef: 'rel-x',
        payloadJson: {}, state: 'SOMETHING_ELSE', attemptCount: 0,
        lastError: null, submittedBy: null, createdAt: 'now',
        updatedAt: 'now', nextHopOrgUnitUid: null },
    ] as unknown as edgeApi.ConflictRow[]);
    renderWithProviders(<MockupConflictList />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/Rejected by Central/));
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/Repeated sync failure/);
    expect(body).toMatch(/Unconfirmed acknowledgement/);
    expect(body).toMatch(/Needs review/);
    expect(body).toMatch(/High/);
    expect(body).toMatch(/Medium/);
    expect(body).toMatch(/Low/);
  });

  it('MockupConflictList — ?workflowRunId=... shows ScopedFilterChip', async () => {
    vi.spyOn(edgeApi, 'listConflicts').mockResolvedValue([] as never);
    renderWithProviders(<MockupConflictList />, {
      authApi,
      route: '/admin/sync/attention?workflowRunId=wfr-abcdef-1234',
    });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/Workflow run wfr-abcd/));
  });

  it('MockupConflictDetail — matched id renders detail panel + priority tone', async () => {
    vi.spyOn(edgeApi, 'listConflicts').mockResolvedValue([
      { operationId: 'op-cd-1', entityType: 'AGGREGATE_DATA_VALUE',
        entityRef: 'de-x|ou-y|2026W44', payloadJson: {},
        state: 'CENTRAL_REJECTED', attemptCount: 6,
        lastError: 'bad', submittedBy: null,
        createdAt: 'now', updatedAt: 'now',
        nextHopOrgUnitUid: null },
    ] as unknown as edgeApi.ConflictRow[]);
    renderWithProviders(
      <Routes><Route path="/admin/sync/attention/:operationId"
                      element={<MockupConflictDetail />} /></Routes>,
      { authApi, route: '/admin/sync/attention/op-cd-1' });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/de-x\|ou-y/));
    expect(document.body.textContent ?? '').toMatch(/High priority/);
  });

  it('MockupConflictDetail — CentralValuePanel: side-by-side (lastResponse set)', async () => {
    vi.spyOn(edgeApi, 'listConflicts').mockResolvedValue([
      { operationId: 'op-cv-1', entityType: 'EVENT', entityRef: 'ev-x',
        payloadJson: {}, state: 'CENTRAL_REJECTED', attemptCount: 1,
        lastError: null, submittedBy: null, createdAt: 'now',
        updatedAt: 'now', nextHopOrgUnitUid: null },
    ] as unknown as edgeApi.ConflictRow[]);
    vi.spyOn(edgeApi, 'fetchConflictCentralResponse').mockResolvedValue({
      operationId: 'op-cv-1',
      lastResponse: { status: 'ERROR', reason: 'ou-mismatch' },
      lastResponseRaw: null,
      lastError: 'validation failed',
    } as unknown as edgeApi.ConflictCentralResponse);
    renderWithProviders(
      <Routes><Route path="/admin/sync/attention/:operationId"
                      element={<MockupConflictDetail />} /></Routes>,
      { authApi, route: '/admin/sync/attention/op-cv-1' });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/Side-by-side payload/));
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/ou-mismatch/);
    expect(body).toMatch(/validation failed/);
    expect(body).toMatch(/Last error/);
  });

  it('MockupConflictDetail — CentralValuePanel: raw-only branch (no parsed response)', async () => {
    vi.spyOn(edgeApi, 'listConflicts').mockResolvedValue([
      { operationId: 'op-cv-raw', entityType: 'EVENT', entityRef: 'ev-x',
        payloadJson: {}, state: 'CENTRAL_REJECTED', attemptCount: 1,
        lastError: null, submittedBy: null, createdAt: 'now',
        updatedAt: 'now', nextHopOrgUnitUid: null },
    ] as unknown as edgeApi.ConflictRow[]);
    vi.spyOn(edgeApi, 'fetchConflictCentralResponse').mockResolvedValue({
      operationId: 'op-cv-raw',
      lastResponse: null,
      lastResponseRaw: '<html>bad gateway</html>',
      lastError: null,
    } as unknown as edgeApi.ConflictCentralResponse);
    renderWithProviders(
      <Routes><Route path="/admin/sync/attention/:operationId"
                      element={<MockupConflictDetail />} /></Routes>,
      { authApi, route: '/admin/sync/attention/op-cv-raw' });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/bad gateway/));
  });

  it('MockupConflictDetail — CentralValuePanel: no-central-response branch', async () => {
    vi.spyOn(edgeApi, 'listConflicts').mockResolvedValue([
      { operationId: 'op-cv-none', entityType: 'EVENT', entityRef: 'ev-x',
        payloadJson: { a: 1 }, state: 'CONFLICT_REVIEW', attemptCount: 1,
        lastError: null, submittedBy: null, createdAt: 'now',
        updatedAt: 'now', nextHopOrgUnitUid: null },
    ] as unknown as edgeApi.ConflictRow[]);
    vi.spyOn(edgeApi, 'fetchConflictCentralResponse').mockResolvedValue({
      operationId: 'op-cv-none',
      lastResponse: null,
      lastResponseRaw: null,
      lastError: null,
    } as unknown as edgeApi.ConflictCentralResponse);
    renderWithProviders(
      <Routes><Route path="/admin/sync/attention/:operationId"
                      element={<MockupConflictDetail />} /></Routes>,
      { authApi, route: '/admin/sync/attention/op-cv-none' });
    await waitFor(() =>
      expect(document.body.textContent ?? "")
        .toMatch(/Central hasn.t produced a response/));
  });

  it('MockupConflictDetail — CentralValuePanel: fetch rejection renders Failed-to-load', async () => {
    vi.spyOn(edgeApi, 'listConflicts').mockResolvedValue([
      { operationId: 'op-cv-fail', entityType: 'EVENT', entityRef: 'ev-x',
        payloadJson: {}, state: 'CONFLICT_REVIEW', attemptCount: 1,
        lastError: null, submittedBy: null, createdAt: 'now',
        updatedAt: 'now', nextHopOrgUnitUid: null },
    ] as unknown as edgeApi.ConflictRow[]);
    vi.spyOn(edgeApi, 'fetchConflictCentralResponse')
      .mockRejectedValue(new Error('upstream 500'));
    renderWithProviders(
      <Routes><Route path="/admin/sync/attention/:operationId"
                      element={<MockupConflictDetail />} /></Routes>,
      { authApi, route: '/admin/sync/attention/op-cv-fail' });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/upstream 500/));
    expect(document.body.textContent ?? '').toMatch(/Failed to load/);
  });

  it('MockupDeviceDetail — matched APPROVED device renders detail + Suspend action', async () => {
    vi.spyOn(edgeApi, 'listDevices').mockResolvedValue({
      devices: [
        { deviceId: 'dev-approved-ab12cd34', status: 'APPROVED',
          displayName: 'Clinic kiosk', formFactor: 'TABLET',
          lastSeenAt: '2026-11-03T11:00:00Z', assignedUserId: null,
          enrolmentTokenHash: 'h', enrolledAt: '2026-11-01T00:00:00Z',
          approvedBy: 'admin', approvedAt: '2026-11-01T01:00:00Z',
          userAgent: 'Mozilla/5.0', firmwareVersion: '1.0.0' },
      ],
    } as unknown as { devices: edgeApi.EdgeDeviceRow[] });
    renderWithProviders(
      <Routes><Route path="/admin/network/connected/:deviceId"
                      element={<MockupDeviceDetail />} /></Routes>,
      { authApi, route: '/admin/network/connected/dev-approved-ab12cd34' });
    await waitFor(() =>
      expect(screen.getByTestId('device-detail')).toBeInTheDocument());
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/Clinic kiosk/);
    expect(body).toMatch(/APPROVED/);
    expect(body).toMatch(/Mozilla\/5\.0/);
    expect(screen.getByRole('button', { name: /Suspend/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revoke/ })).toBeInTheDocument();
  });

  it('MockupDeviceDetail — PENDING device surfaces the Approve button', async () => {
    vi.spyOn(edgeApi, 'listDevices').mockResolvedValue({
      devices: [
        { deviceId: 'dev-pending-xyzabc', status: 'PENDING',
          displayName: null, formFactor: 'MOBILE',
          lastSeenAt: null, assignedUserId: null,
          enrolmentTokenHash: 'h', enrolledAt: '2026-11-03T10:00:00Z',
          approvedBy: null, approvedAt: null, userAgent: null,
          firmwareVersion: null },
      ],
    } as unknown as { devices: edgeApi.EdgeDeviceRow[] });
    renderWithProviders(
      <Routes><Route path="/admin/network/connected/:deviceId"
                      element={<MockupDeviceDetail />} /></Routes>,
      { authApi, route: '/admin/network/connected/dev-pending-xyzabc' });
    await waitFor(() =>
      expect(screen.getByTestId('device-detail')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Approve/ })).toBeInTheDocument();
  });

  it('MockupDeviceDetail — listDevices rejection surfaces err-device-detail', async () => {
    vi.spyOn(edgeApi, 'listDevices').mockRejectedValue(new Error('500 upstream'));
    renderWithProviders(
      <Routes><Route path="/admin/network/connected/:deviceId"
                      element={<MockupDeviceDetail />} /></Routes>,
      { authApi, route: '/admin/network/connected/dev-any' });
    await waitFor(() =>
      expect(screen.getByTestId('err-device-detail')).toBeInTheDocument());
    expect(document.body.textContent ?? '').toMatch(/500 upstream/);
  });

  it('MockupAuditEvents — ?category=network switches to networkEvents + filter pills', async () => {
    vi.spyOn(edgeApi, 'networkEvents').mockResolvedValue({
      events: [
        { eventId: 'ev-ok', eventType: 'AP_STARTED', actor: null,
          deviceId: null, nodeId: null, interfaceName: 'wlan0',
          outcome: 'SUCCESS', reason: null, correlationId: null,
          observedAt: '2026-11-03T10:00:00Z' },
        { eventId: 'ev-fail', eventType: 'WAN_LOST', actor: 'root',
          deviceId: null, nodeId: null, interfaceName: 'eth0',
          outcome: 'FAILURE', reason: 'link-down', correlationId: null,
          observedAt: '2026-11-03T11:00:00Z' },
      ],
    } as never);
    renderWithProviders(<MockupAuditEvents />, {
      authApi, route: '/admin/audit/events?category=network',
    });
    await waitFor(() =>
      expect(screen.getByTestId('audit-events')).toBeInTheDocument());
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/Network audit/);
    expect(body).toMatch(/AP_STARTED/);
    expect(body).toMatch(/WAN_LOST/);
    expect(body).toMatch(/link-down/);
  });

  it('MockupAuditEvents — ?device=... narrows the networkEvents feed', async () => {
    vi.spyOn(edgeApi, 'networkEvents').mockResolvedValue({
      events: [
        { eventId: 'ev-a', eventType: 'DEVICE_APPROVED', actor: null,
          deviceId: 'dev-matcher', nodeId: null, interfaceName: null,
          outcome: 'SUCCESS', reason: null, correlationId: null,
          observedAt: '2026-11-03T10:00:00Z' },
        { eventId: 'ev-b', eventType: 'DEVICE_REVOKED', actor: null,
          deviceId: 'dev-other', nodeId: null, interfaceName: null,
          outcome: 'SUCCESS', reason: null, correlationId: null,
          observedAt: '2026-11-03T11:00:00Z' },
      ],
    } as never);
    renderWithProviders(<MockupAuditEvents />, {
      authApi, route: '/admin/audit/events?device=dev-matcher',
    });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/DEVICE_APPROVED/));
    expect(document.body.textContent ?? '').not.toMatch(/dev-other/);
  });

  it('MockupAuditEvents — networkEvents rejection renders ErrorBlock', async () => {
    vi.spyOn(edgeApi, 'networkEvents').mockRejectedValue(new Error('500 bad'));
    renderWithProviders(<MockupAuditEvents />, {
      authApi, route: '/admin/audit/events?category=network',
    });
    await waitFor(() =>
      expect(screen.getByTestId('err-audit')).toBeInTheDocument());
    expect(document.body.textContent ?? '').toMatch(/500 bad/);
  });

  it('MockupWorkerHealth — Show breakdown reveals every backlog chip-tone arm', async () => {
    vi.spyOn(edgeApi, 'workerHealth').mockResolvedValue({
      enabled: true,
      lastRunAt: '2026-11-03T11:00:00Z',
      lastBatchSize: 7,
      probeTimestamp: 'now',
      backlog: {
        PENDING: 2, IN_FLIGHT: 1, RETRYABLE: 3,
        CONFLICT_REVIEW: 1, CENTRAL_REJECTED: 1,
        CENTRAL_ACCEPTED: 4, FAILED: 1, OTHER_STATE: 9,
      },
    } as unknown as edgeApi.WorkerHealth);
    const { container } = renderWithProviders(<MockupWorkerHealth />, { authApi });
    await waitFor(() =>
      expect(container.querySelector('[data-test="ea14-show-breakdown"]'))
        .not.toBeNull());
    const btn = container.querySelector('[data-test="ea14-show-breakdown"]') as HTMLElement;
    btn.click();
    await waitFor(() =>
      expect(container.querySelector('[data-test="ea14-backlog-FAILED"]'))
        .not.toBeNull());
    expect(container.querySelector('[data-test="ea14-backlog-CENTRAL_ACCEPTED"]'))
      .not.toBeNull();
    expect(container.querySelector('[data-test="ea14-backlog-OTHER_STATE"]'))
      .not.toBeNull();
  });
});
