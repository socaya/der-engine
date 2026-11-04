import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import {
  CapSyncHistory, CapDataQueues, CapWorkflowRuns,
  CapStepAssignments, CapReferralHistory, CapMetadataSync,
} from './CapabilityScreens';
import * as edgeApi from '../api/edgeApi';

const authApi = {
  session: vi.fn().mockResolvedValue({
    userId: 'u1', username: 'admin', displayName: 'Admin',
    roles: ['ADMIN'], expiresAt: '2027-01-01T00:00:00Z',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

/* ────────────────────────────────────────────────────────────────
 * Focused loaded-state tests for a handful of Cap* sub-screens
 * that have unique branch surfaces (filter chips, outcome
 * ternaries, backlog-tone switches). The surface-mount file
 * covered the mount-and-import path for all 30 sub-screens;
 * this file covers the specific chip-tone + filter branches
 * that it couldn't hit without a resolved API response.
 * ──────────────────────────────────────────────────────────────── */

describe('CapSyncHistory (loaded)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  function stubJobs(rows: edgeApi.JobRun[]): void {
    vi.spyOn(edgeApi, 'listJobs').mockResolvedValue(rows);
  }

  it('renders runs with each outcome chip tone', async () => {
    stubJobs([
      { runId: 1, jobName: 'METADATA_SYNC', outcome: 'SUCCEEDED',
        startedAt: '2026-11-03T10:00:00Z',
        finishedAt: '2026-11-03T10:00:30Z', durationMs: 30_000,
        triggeredBy: 'SCHEDULED', detail: '{}' },
      { runId: 2, jobName: 'JOURNAL_DRAIN', outcome: 'FAILED',
        startedAt: '2026-11-03T09:00:00Z',
        finishedAt: '2026-11-03T09:00:05Z', durationMs: 5_000,
        triggeredBy: 'MANUAL', detail: '{}' },
      /* Any-other-outcome -> info tone fallback. */
      { runId: 3, jobName: 'ANALYTICS_REFRESH', outcome: 'SKIPPED',
        startedAt: '2026-11-03T08:00:00Z',
        finishedAt: null,
        durationMs: null,       /* exercises the '—' fallback */
        triggeredBy: 'SCHEDULED', detail: '{}' },
    ] as unknown as edgeApi.JobRun[]);
    renderWithProviders(<CapSyncHistory />, { authApi });
    await waitFor(() => expect(screen.getByTestId('cap-sync-history'))
      .toBeInTheDocument());
    /* Each outcome string appears in both a filter chip and a
     * table cell, so there are multiple matches. getAllByText
     * accommodates both. */
    expect(screen.getAllByText('SUCCEEDED').length).toBeGreaterThan(0);
    expect(screen.getAllByText('FAILED').length).toBeGreaterThan(0);
    expect(screen.getByText('SKIPPED')).toBeInTheDocument();
    /* durationMs=null → em-dash. */
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('filter chips narrow to the matching outcome, empty state when no matches', async () => {
    stubJobs([
      { runId: 1, jobName: 'J1', outcome: 'SUCCEEDED',
        startedAt: 'now', finishedAt: 'now', durationMs: 1,
        triggeredBy: 'SCHEDULED', detail: '{}' },
    ] as unknown as edgeApi.JobRun[]);
    renderWithProviders(<CapSyncHistory />, { authApi });
    await waitFor(() => expect(screen.getByTestId('cap-sync-history'))
      .toBeInTheDocument());
    const user = userEvent.setup();
    /* Click the FAILED chip — no runs match → empty-state. */
    await user.click(screen.getByRole('button', { name: 'FAILED' }));
    await waitFor(() => expect(screen.getByTestId('empty-no-runs-match'))
      .toBeInTheDocument());
    /* Back to ALL — the row returns. */
    await user.click(screen.getByRole('button', { name: 'ALL' }));
    await waitFor(() => expect(screen.getByText('J1')).toBeInTheDocument());
  });

  it('surfaces ErrorBlock when listJobs rejects', async () => {
    vi.spyOn(edgeApi, 'listJobs').mockRejectedValue(new Error('boom'));
    renderWithProviders(<CapSyncHistory />, { authApi });
    await waitFor(() => expect(screen.getByTestId('err-history-load-failed'))
      .toBeInTheDocument());
  });
});

describe('CapDataQueues (loaded)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('populated backlog renders per-state rows + distinct chip tones', async () => {
    vi.spyOn(edgeApi, 'workerHealth').mockResolvedValue({
      enabled: true, probeTimestamp: 'now',
      lastTick: '2026-11-03T10:00:00Z', lastBatchSize: 5,
      backlog: {
        PENDING: 10,              /* info tone */
        IN_FLIGHT: 2,             /* fallthrough success */
        FAILED: 1,                /* danger tone */
        CENTRAL_ACCEPTED: 50,     /* success */
      },
    } as unknown as edgeApi.WorkerHealth);
    renderWithProviders(<CapDataQueues />, { authApi });
    await waitFor(() => expect(screen.getByTestId('cap-queues'))
      .toBeInTheDocument());
    /* Each backlog state surfaces as a chip. */
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getByText('IN_FLIGHT')).toBeInTheDocument();
    expect(screen.getByText('FAILED')).toBeInTheDocument();
    expect(screen.getByText('CENTRAL_ACCEPTED')).toBeInTheDocument();
    /* Running + total non-zero (10+2+1+50=63 → <100 info tone). */
    expect(screen.getByText('RUNNING')).toBeInTheDocument();
  });

  it('empty backlog renders the \'Journal empty\' state + success tone', async () => {
    vi.spyOn(edgeApi, 'workerHealth').mockResolvedValue({
      enabled: true, probeTimestamp: 'now',
      lastTick: null, lastBatchSize: 0,
      backlog: {},
    } as unknown as edgeApi.WorkerHealth);
    renderWithProviders(<CapDataQueues />, { authApi });
    await waitFor(() => expect(screen.getByTestId('empty-journal-empty'))
      .toBeInTheDocument());
  });

  it('paused worker + large backlog flips Worker stat to PAUSED + danger tone', async () => {
    vi.spyOn(edgeApi, 'workerHealth').mockResolvedValue({
      enabled: false, probeTimestamp: 'now',
      lastTick: '2026-11-03T10:00:00Z', lastBatchSize: 0,
      backlog: {
        PENDING: 200,  /* total 200 → >= 100 danger tone */
      },
    } as unknown as edgeApi.WorkerHealth);
    renderWithProviders(<CapDataQueues />, { authApi });
    await waitFor(() => expect(screen.getByTestId('cap-queues'))
      .toBeInTheDocument());
    expect(screen.getByText('PAUSED')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    /* 200 total backlog surfaces (appears twice — once in the
     * stat strip, once in the per-state row). */
    expect(screen.getAllByText('200').length).toBeGreaterThan(0);
  });

  it('surfaces ErrorBlock when workerHealth rejects', async () => {
    vi.spyOn(edgeApi, 'workerHealth').mockRejectedValue(new Error('probe boom'));
    renderWithProviders(<CapDataQueues />, { authApi });
    await waitFor(() => expect(screen.getByTestId('err-worker-probe-failed'))
      .toBeInTheDocument());
  });
});

describe('CapWorkflowRuns (loaded)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('empty workflows list surfaces the \'None yet\' label', async () => {
    vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({ workflows: [] });
    vi.spyOn(edgeApi, 'listWorkflowRuns').mockResolvedValue({ runs: [] });
    renderWithProviders(<CapWorkflowRuns />, { authApi });
    await waitFor(() => expect(screen.getByTestId('cap-wf-runs'))
      .toBeInTheDocument());
    expect(screen.getByText('None yet')).toBeInTheDocument();
  });

  it('workflows + runs populate the status bar — in-flight count surfaces when any run is non-terminal', async () => {
    vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({
      workflows: [
        { workflowId: 'wf-1', displayName: 'ANC',
          boundMetadataKind: 'DATA_SET', boundMetadataId: 'ds-1',
          enabled: true, version: 1, createdAt: 'now', updatedAt: 'now',
          createdBy: null, steps: [], dependencies: [],
          requiresApproval: false, defaultDeviceId: null },
      ],
    } as unknown as { workflows: edgeApi.CaptureWorkflowSummary[] });
    vi.spyOn(edgeApi, 'listWorkflowRuns').mockResolvedValue({
      runs: [
        /* In-flight: state is anything except COMPLETED or REJECTED. */
        { runId: 'run-active', workflowId: 'wf-1',
          businessKey: 'bk-a', businessKeyKind: 'OPERATOR_PROVIDED',
          state: 'AWAITING_INPUT', version: 1,
          startedAt: 'now', completedAt: null,
          createdBy: null, updatedAt: 'now' },
        /* Completed: hits the completed count branch. */
        { runId: 'run-done', workflowId: 'wf-1',
          businessKey: 'bk-b', businessKeyKind: 'OPERATOR_PROVIDED',
          state: 'COMPLETED', version: 1,
          startedAt: 'now', completedAt: 'now',
          createdBy: null, updatedAt: 'now' },
      ],
    } as unknown as { runs: edgeApi.CaptureWorkflowRun[] });
    renderWithProviders(<CapWorkflowRuns />, { authApi });
    await waitFor(() => expect(screen.getByTestId('cap-wf-runs'))
      .toBeInTheDocument());
    /* in-flight count = 1 shows in the status bar label. */
    expect(screen.getByText(/1 in flight/i)).toBeInTheDocument();
  });

  it('ErrorBlock surfaces when listWorkflows rejects', async () => {
    vi.spyOn(edgeApi, 'listWorkflows').mockRejectedValue(new Error('load fail'));
    renderWithProviders(<CapWorkflowRuns />, { authApi });
    await waitFor(() => expect(screen.getByTestId('err-runs-load-failed'))
      .toBeInTheDocument());
  });
});

describe('CapStepAssignments (loaded)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('populated workflows + steps render the Assignments panel', async () => {
    vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({
      workflows: [
        { workflowId: 'wf-a', displayName: 'ANC visit',
          boundMetadataKind: 'DATA_SET', boundMetadataId: 'ds-a',
          enabled: true, version: 1, createdAt: 'now', updatedAt: 'now',
          createdBy: null, requiresApproval: false, defaultDeviceId: null,
          dependencies: [],
          steps: [
            { ordinal: 1, displayName: 'Register',
              ownerRole: 'DATA_ENTRY', stepKind: 'CAPTURE',
              ownerDeviceId: null },
            { ordinal: 2, displayName: 'Review',
              ownerRole: 'DATA_SUPERVISOR', stepKind: 'APPROVE',
              ownerDeviceId: 'dev-abcdefgh-ij' },
          ],
        },
      ],
    } as unknown as { workflows: edgeApi.CaptureWorkflowSummary[] });
    renderWithProviders(<CapStepAssignments />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('cap-assignments')).toBeInTheDocument());
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/Register/);
    expect(body).toMatch(/Review/);
    expect(body).toMatch(/dev-abcd/);
  });

  it('empty workflow list surfaces the \'No steps defined\' empty-state', async () => {
    vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({ workflows: [] });
    renderWithProviders(<CapStepAssignments />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('empty-no-workflows-defined'))
        .toBeInTheDocument());
  });

  it('listWorkflows rejection surfaces ErrorBlock', async () => {
    vi.spyOn(edgeApi, 'listWorkflows').mockRejectedValue(new Error('boom'));
    renderWithProviders(<CapStepAssignments />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('err-workflow-load-failed'))
        .toBeInTheDocument());
  });
});

describe('CapReferralHistory (loaded)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('populated referrals render per-row status-tone arms', async () => {
    vi.spyOn(edgeApi, 'listReferralInbox').mockResolvedValue({
      entries: [
        { inboxId: 'ib-a', kind: 'TRACKED_ENTITY', sourceRef: 'tei-1',
          boundOrgUnit: 'ou-1', discoveredAt: '2026-11-03T10:00:00Z',
          status: 'ACCEPTED' },
        { inboxId: 'ib-b', kind: 'ENROLLMENT', sourceRef: 'enr-2',
          boundOrgUnit: 'ou-1', discoveredAt: '2026-11-03T09:00:00Z',
          status: 'DISMISSED' },
        { inboxId: 'ib-c', kind: 'EVENT', sourceRef: 'ev-3',
          boundOrgUnit: 'ou-1', discoveredAt: '2026-11-03T08:00:00Z',
          status: 'PENDING' },
      ],
    } as unknown as { entries: edgeApi.ReferralInboxRow[] });
    renderWithProviders(<CapReferralHistory />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('cap-ref-history')).toBeInTheDocument());
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/tei-1/);
    expect(body).toMatch(/enr-2/);
    expect(body).toMatch(/ev-3/);
    expect(body).toMatch(/Accepted/);
  });

  it('empty inbox surfaces \'No referrals yet\'', async () => {
    vi.spyOn(edgeApi, 'listReferralInbox').mockResolvedValue({ entries: [] });
    renderWithProviders(<CapReferralHistory />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('empty-no-referrals-yet'))
        .toBeInTheDocument());
  });

  it('listReferralInbox rejection surfaces ErrorBlock', async () => {
    vi.spyOn(edgeApi, 'listReferralInbox').mockRejectedValue(new Error('500'));
    renderWithProviders(<CapReferralHistory />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('err-referral-load-failed'))
        .toBeInTheDocument());
  });
});

describe('CapMetadataSync (loaded)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  const sysInfoOK = {
    runtime: { heapUsedBytes: 1, heapMaxBytes: 100, uptimeMillis: 1 },
    database: { configured: true, sessionCount: 0 },
    scheduler: { started: true, executingJobs: 0, totalJobs: 1 },
    storage: { totalBytes: 1, usableBytes: 1 },
    dhis2: { configured: true, probeReachable: true,
             baseUrl: 'x', centralVersion: '2.44',
             probeDurationMs: 100 },
    build: { version: '1', commit: 'a', branch: 'main',
             buildTime: 'now', dirty: false },
    apps: { installed: 0, enabled: 0, items: [] },
  } as unknown as edgeApi.SystemInfo;

  it('history + sysInfo populate Recent pulls table + lastOk → success tone', async () => {
    vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([
      { runId: 10, jobName: 'METADATA_SYNC_FULL', outcome: 'SUCCEEDED',
        startedAt: '2026-11-03T10:00:00Z',
        finishedAt: '2026-11-03T10:01:00Z', durationMs: 60_000,
        triggeredBy: 'SCHEDULED', detail: '{}' },
      { runId: 11, jobName: 'METADATA_SYNC_FULL', outcome: 'FAILED',
        startedAt: '2026-11-03T09:00:00Z',
        finishedAt: '2026-11-03T09:00:10Z', durationMs: 10_000,
        triggeredBy: 'MANUAL', detail: '{}' },
    ] as edgeApi.JobRun[]);
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(sysInfoOK);
    renderWithProviders(<CapMetadataSync />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('cap-metadata-sync')).toBeInTheDocument());
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/Succeeded|Failed/));
    expect(screen.getByTestId('trigger-run')).toBeInTheDocument();
  });

  it('empty history surfaces \'Never run on this edge\'', async () => {
    vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([] as edgeApi.JobRun[]);
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(sysInfoOK);
    renderWithProviders(<CapMetadataSync />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/Never run on this edge/));
  });

  it('central unreachable renders the offline-first hint', async () => {
    vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([] as edgeApi.JobRun[]);
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue({
      ...sysInfoOK,
      dhis2: { ...(sysInfoOK.dhis2 as object), probeReachable: false } as never,
    });
    renderWithProviders(<CapMetadataSync />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '')
        .toMatch(/Central DHIS2 is unavailable right now/));
  });
});
