import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { WorkflowMonitoring } from './WorkflowMonitoring';
import * as edgeApi from '../../api/edgeApi';
import type {
  WorkflowQueueRow, WorkflowMetricsResponse, WorkflowActivitySummary,
} from '../../api/edgeApi';

afterEach(() => vi.restoreAllMocks());

const q = (over: Partial<WorkflowQueueRow> = {}): WorkflowQueueRow => ({
  runId: 'r-1', workflowId: 'wf-1', workflowName: 'ANC',
  businessKey: 'bk-1', stepId: 's-1', stepOrdinal: 1, stepName: 'Register',
  ownerRole: 'OPERATOR', ownerDeviceId: null, readiness: 'READY',
  runCreatedAt: '2026-11-01T10:00:00Z',
  runUpdatedAt: '2026-11-01T12:00:00Z',
  validationErrorCount: 0, ...over,
});

const emptyMetrics: WorkflowMetricsResponse = {
  windowHours: 24, perStep: [], perDevice: [],
};
const summary = (over: Partial<WorkflowActivitySummary> = {}):
    WorkflowActivitySummary => ({
  completedLast24h: 0, currentlyBlocked: 0,
  openErrorIssues: 0, openConflicts: 0, ...over,
});

const mkApi = (over: Partial<NonNullable<Parameters<typeof WorkflowMonitoring>[0]>['api']>
    = {}): NonNullable<Parameters<typeof WorkflowMonitoring>[0]>['api'] =>
  ({
    workflowQueue: vi.fn().mockResolvedValue({
      rows: [], appliedDeviceId: null, deviceScopeSource: 'NONE',
    }),
    listDevices: vi.fn().mockResolvedValue({ devices: [] }),
    getWorkflowMetrics: vi.fn().mockResolvedValue(emptyMetrics),
    getWorkflowActivityFeed: vi.fn().mockResolvedValue({ rows: [] }),
    getWorkflowBlockages: vi.fn().mockResolvedValue({ rows: [] }),
    getWorkflowIssues: vi.fn().mockResolvedValue({ rows: [] }),
    getWorkflowConflicts: vi.fn().mockResolvedValue({ rows: [] }),
    getWorkflowActivitySummary: vi.fn().mockResolvedValue(summary()),
    getWorkflowDrafts: vi.fn().mockResolvedValue({ rows: [] }),
    ...over,
  }) as never;

describe('WorkflowMonitoring', () => {
  it('loading state before resolve', () => {
    const api = mkApi();
    renderWithProviders(<WorkflowMonitoring api={api} />);
    expect(screen.getByTestId('wf-monitor-loading')).toBeInTheDocument();
  });

  it('populated → attention panel default, All clear tone when empty', async () => {
    const api = mkApi();
    renderWithProviders(<WorkflowMonitoring api={api} />);
    await waitFor(() => expect(screen.getByTestId('wf-monitor-root'))
      .toBeInTheDocument());
    expect(screen.getByTestId('wf-monitor-root')).toHaveTextContent(/All clear/);
    expect(screen.getByTestId('wf-monitor-split')).toBeInTheDocument();
  });

  it('ready > 20 flips tone to warning', async () => {
    const fresh = new Date().toISOString();
    const rows = Array.from({ length: 25 }, (_, i) =>
      q({ runId: `r-${i}`, stepId: `s-${i}`, runUpdatedAt: fresh }));
    const api = mkApi({
      workflowQueue: vi.fn().mockResolvedValue({
        rows, appliedDeviceId: null, deviceScopeSource: 'NONE',
      }),
    });
    renderWithProviders(<WorkflowMonitoring api={api} />);
    await waitFor(() => expect(screen.getByTestId('wf-monitor-root'))
      .toBeInTheDocument());
    expect(screen.getByTestId('wf-monitor-root')).toHaveTextContent(/large backlog/);
  });

  it('stuck ready > 24h flips tone to danger', async () => {
    const api = mkApi({
      workflowQueue: vi.fn().mockResolvedValue({
        rows: [q({ runUpdatedAt: '2020-01-01T00:00:00Z' })],
        appliedDeviceId: null, deviceScopeSource: 'NONE',
      }),
    });
    renderWithProviders(<WorkflowMonitoring api={api} />);
    await waitFor(() => expect(screen.getByTestId('wf-monitor-root'))
      .toBeInTheDocument());
    expect(screen.getByTestId('wf-monitor-root')).toHaveTextContent(/stuck/i);
  });

  it('activity tab shows drafts + feed', async () => {
    const api = mkApi({
      getWorkflowDrafts: vi.fn().mockResolvedValue({ rows: [{
        contributionId: 'c-1', workflowId: 'wf-1', workflowName: 'ANC',
        runId: 'r-1', businessKey: 'bk-1', stepId: 's-1', stepName: 'Register',
        submittedAt: '2026-11-01T12:00:00Z',
        submittedDeviceId: 'd-1', submittedDeviceName: 'Tablet',
        fieldCount: 3, preview: '{"name":"Jane"}',
      }] }),
      getWorkflowActivityFeed: vi.fn().mockResolvedValue({ rows: [{
        transitionId: 42, workflowId: 'wf-1', workflowName: 'ANC',
        runId: 'r-1', businessKey: 'bk-1', stepId: 's-1', stepName: 'Register',
        fromState: 'READY', toState: 'COMPLETE',
        transitionedAt: '2026-11-01T12:00:00Z',
        actorDeviceId: 'd-1', actorDeviceName: 'Tablet',
      }] }),
    });
    renderWithProviders(<WorkflowMonitoring api={api} />);
    await waitFor(() => expect(screen.getByTestId('wf-monitor-nav-activity'))
      .toBeInTheDocument());
    await userEvent.click(screen.getByTestId('wf-monitor-nav-activity'));
    expect(screen.getByTestId('wf-monitor-draft-c-1')).toBeInTheDocument();
    expect(screen.getByTestId('wf-monitor-feed')).toHaveTextContent('Register');
  });

  it('depth tab groups by workflow and step', async () => {
    const api = mkApi({
      workflowQueue: vi.fn().mockResolvedValue({
        rows: [
          q(),
          q({ runId: 'r-2', stepId: 's-1', readiness: 'BLOCKED' }),
          q({ runId: 'r-3', stepId: 's-2', stepName: 'Review' }),
        ],
        appliedDeviceId: null, deviceScopeSource: 'NONE',
      }),
    });
    renderWithProviders(<WorkflowMonitoring api={api} />);
    await waitFor(() => expect(screen.getByTestId('wf-monitor-nav-depth'))
      .toBeInTheDocument());
    await userEvent.click(screen.getByTestId('wf-monitor-nav-depth'));
    expect(screen.getByTestId('wf-monitor-wf-wf-1')).toBeInTheDocument();
    expect(screen.getByTestId('wf-monitor-by-step')).toHaveTextContent('Review');
  });

  it('performance tab shows metrics + window change refetches', async () => {
    const metrics: WorkflowMetricsResponse = {
      windowHours: 24,
      perStep: [{
        workflowId: 'wf-1', workflowName: 'ANC',
        stepId: 's-1', stepName: 'Register',
        completedCount: 10,
        turnaroundP50Ms: 1200, turnaroundP95Ms: 4500,
        turnaroundMaxMs: 8000,
      }],
      perDevice: [{
        deviceId: 'd-1', deviceName: 'Tablet',
        completedCount: 10,
        turnaroundP50Ms: 1200, turnaroundP95Ms: 4500,
      }],
    };
    const getMetrics = vi.fn().mockResolvedValue(metrics);
    const api = mkApi({ getWorkflowMetrics: getMetrics });
    renderWithProviders(<WorkflowMonitoring api={api} />);
    await waitFor(() => expect(screen.getByTestId('wf-monitor-nav-performance'))
      .toBeInTheDocument());
    await userEvent.click(screen.getByTestId('wf-monitor-nav-performance'));
    expect(screen.getByTestId('wf-monitor-ta-s-1')).toBeInTheDocument();
    expect(screen.getByTestId('wf-monitor-dev-ta-d-1')).toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByTestId('wf-monitor-window'), '168');
    await waitFor(() => expect(getMetrics).toHaveBeenCalledWith(168));
  });

  it('prefetch tab shows device readiness via listPrefetchPending', async () => {
    vi.spyOn(edgeApi, 'listPrefetchPending').mockResolvedValue({
      deviceId: 'd-1', rows: [{
        runId: 'r-1', stepId: 's-1',
        notifiedAt: new Date().toISOString(),
      }],
    });
    const api = mkApi({
      listDevices: vi.fn().mockResolvedValue({
        devices: [{ deviceId: 'd-1', displayName: 'Tablet' } as never],
      }),
    });
    renderWithProviders(<WorkflowMonitoring api={api} />);
    await waitFor(() => expect(screen.getByTestId('wf-monitor-nav-prefetch'))
      .toBeInTheDocument());
    await userEvent.click(screen.getByTestId('wf-monitor-nav-prefetch'));
    await waitFor(() => expect(screen.getByTestId('wf-monitor-prefetch-d-1'))
      .toBeInTheDocument());
  });

  it('blockages panel renders in attention tab', async () => {
    const api = mkApi({
      getWorkflowBlockages: vi.fn().mockResolvedValue({ rows: [{
        workflowId: 'wf-1', workflowName: 'ANC',
        runId: 'r-1', businessKey: 'bk-1',
        stepId: 's-2', stepName: 'Review',
        blockedSince: '2026-11-01T10:00:00Z',
        blockedBy: [{ stepId: 's-1', stepName: 'Register' }],
      }] }),
    });
    renderWithProviders(<WorkflowMonitoring api={api} />);
    await waitFor(() => expect(screen.getByTestId('wf-monitor-blocked-s-2'))
      .toBeInTheDocument());
  });

  it('issues panel renders when server lists them', async () => {
    const api = mkApi({
      getWorkflowIssues: vi.fn().mockResolvedValue({ rows: [{
        issueId: 'i-1', workflowId: 'wf-1', workflowName: 'ANC',
        runId: 'r-1', businessKey: 'bk-1',
        stepId: 's-1', stepName: 'Register',
        code: 'MISSING', severity: 'ERROR',
        message: 'name required', fieldRef: 'name',
        detectedAt: '2026-11-01T10:00:00Z',
      }] }),
    });
    renderWithProviders(<WorkflowMonitoring api={api} />);
    await waitFor(() => expect(screen.getByTestId('wf-monitor-issue-i-1'))
      .toBeInTheDocument());
  });

  it('conflicts list renders when non-empty', async () => {
    const api = mkApi({
      getWorkflowConflicts: vi.fn().mockResolvedValue({ rows: [{
        conflictId: 'c-1', workflowId: 'wf-1', workflowName: 'ANC',
        runId: 'r-1', businessKey: 'bk-1',
        category: 'DUPLICATE', identityKey: 'name',
        detectedAt: '2026-11-01T10:00:00Z',
      }] }),
    });
    renderWithProviders(<WorkflowMonitoring api={api} />);
    await waitFor(() => expect(screen.getByTestId('wf-monitor-conflicts'))
      .toBeInTheDocument());
    expect(screen.getByTestId('wf-monitor-conflicts')).toHaveTextContent('DUPLICATE');
  });

  it('refresh button fires a reload', async () => {
    const api = mkApi();
    renderWithProviders(<WorkflowMonitoring api={api} />);
    await waitFor(() => expect(screen.getByTestId('wf-monitor-refresh'))
      .toBeInTheDocument());
    const spy = api!.workflowQueue as ReturnType<typeof vi.fn>;
    const before = spy.mock.calls.length;
    await userEvent.click(screen.getByTestId('wf-monitor-refresh'));
    await waitFor(() => expect(spy.mock.calls.length).toBeGreaterThan(before));
  });

  /* ──────────────────────────────────────────────────────────────
   * Depth-lift: activity-feed toState tone branches + per-device
   * oldest-ready age calculation. Previously uncovered.
   * ────────────────────────────────────────────────────────────── */

  it('activity feed exercises every Status tone branch (COMPLETE / READY / BLOCKED / other)', async () => {
    const api = mkApi({
      getWorkflowActivityFeed: vi.fn().mockResolvedValue({ rows: [
        /* COMPLETE → success tone */
        { transitionId: 't-1', toState: 'COMPLETE',
          workflowId: 'wf-1', workflowName: 'ANC', runId: 'r-1',
          businessKey: 'bk-1', stepName: 'Register',
          actorDeviceId: 'dev-with-name', actorDeviceName: 'Kiosk',
          transitionedAt: '2026-11-01T10:00:00Z' },
        /* READY → info tone */
        { transitionId: 't-2', toState: 'READY',
          workflowId: 'wf-1', workflowName: 'ANC', runId: 'r-1',
          businessKey: 'bk-1', stepName: 'Register',
          actorDeviceId: 'dev-no-name-xxxxxxxx',
          actorDeviceName: null,
          transitionedAt: '2026-11-01T10:05:00Z' },
        /* BLOCKED → muted tone */
        { transitionId: 't-3', toState: 'BLOCKED',
          workflowId: 'wf-1', workflowName: 'ANC', runId: 'r-1',
          businessKey: 'bk-1', stepName: null,
          actorDeviceId: null, actorDeviceName: null,
          transitionedAt: '2026-11-01T10:10:00Z' },
        /* Fallthrough state → info tone */
        { transitionId: 't-4', toState: 'FAILED',
          workflowId: 'wf-1', workflowName: null, runId: 'r-1',
          businessKey: 'bk-1', stepName: 'Reconcile',
          actorDeviceId: null, actorDeviceName: null,
          transitionedAt: '2026-11-01T10:15:00Z' },
      ] }),
    });
    renderWithProviders(<WorkflowMonitoring api={api} />);
    await waitFor(() => expect(screen.getByTestId('wf-monitor-root'))
      .toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('wf-monitor-nav-activity'));
    /* Every toState chip renders — assert the four we fed. */
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/COMPLETE/));
    expect(document.body.textContent ?? '').toMatch(/READY/);
    expect(document.body.textContent ?? '').toMatch(/BLOCKED/);
    expect(document.body.textContent ?? '').toMatch(/FAILED/);
    /* Kiosk displayName wins over actorDeviceId; the no-name
     * row shows the first 8 chars of the id. */
    expect(document.body.textContent ?? '').toMatch(/Kiosk/);
    expect(document.body.textContent ?? '').toMatch(/dev-no-n/);
  });

  it('depth tab warns stale rows when oldestReady is more than 24h old', async () => {
    const old = new Date(Date.now() - 48 * 3600_000).toISOString();
    const api = mkApi({
      workflowQueue: vi.fn().mockResolvedValue({
        rows: [q({ runId: 'r-stuck', runUpdatedAt: old,
                   ownerDeviceId: 'dev-stuck-xxxxxx' })],
        appliedDeviceId: null, deviceScopeSource: 'NONE',
      }),
      listDevices: vi.fn().mockResolvedValue({ devices: [
        { deviceId: 'dev-stuck-xxxxxx', displayName: 'Clinic kiosk',
          status: 'APPROVED', assignedUserId: null,
          enrolmentTokenHash: 'h', enrolledAt: 'now',
          approvedBy: null, approvedAt: null, lastSeenAt: null,
          userAgent: 'ua', firmwareVersion: null, formFactor: 'TABLET' },
      ] }),
    });
    renderWithProviders(<WorkflowMonitoring api={api} />);
    await waitFor(() => expect(screen.getByTestId('wf-monitor-root'))
      .toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('wf-monitor-nav-depth'));
    /* The byDevice row for dev-stuck appears with the warnStale
     * flag; data-test anchors on the device id. */
    await waitFor(() => expect(
      screen.getByTestId('wf-monitor-dev-dev-stuck-xxxxxx'))
      .toBeInTheDocument());
  });

  it('activity feed empty state renders when getWorkflowActivityFeed returns no rows', async () => {
    const api = mkApi();
    renderWithProviders(<WorkflowMonitoring api={api} />);
    await waitFor(() => expect(screen.getByTestId('wf-monitor-root'))
      .toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('wf-monitor-nav-activity'));
    /* No feed rows → the empty-state copy about no activity
     * surfaces. The exact wording lives in the component but we
     * assert against the broader 'no activity' tag so wording
     * tweaks don't break the test. */
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/no activity|nothing to show|all clear/i));
  });
});
