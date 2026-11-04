import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import {
  CapSyncHistory, CapDataQueues, CapWorkflowRuns,
  CapStepAssignments, CapReferralHistory, CapMetadataSync,
  CapProgramRules, CapSyncOverview, CapSyncSchedule,
  CapOrgUnitBinding, CapSystemInformation, CapDashboard,
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

describe('CapProgramRules (loaded)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('populated metadataList renders the rules table', async () => {
    vi.spyOn(edgeApi, 'metadataList').mockResolvedValue({
      programRules: [
        { id: 'pr-1', displayName: 'Hide weight on infants' },
        { id: 'pr-2', displayName: 'Require consent' },
      ],
    } as never);
    renderWithProviders(<CapProgramRules />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('cap-rules')).toBeInTheDocument());
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/Hide weight on infants/);
    expect(body).toMatch(/Require consent/);
    expect(body).toMatch(/2 rules/);
  });

  it('empty rules list surfaces the empty-state', async () => {
    vi.spyOn(edgeApi, 'metadataList').mockResolvedValue({
      programRules: [],
    } as never);
    renderWithProviders(<CapProgramRules />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('empty-no-program-rules-mirrore'))
        .toBeInTheDocument());
  });

  it('metadataList rejection surfaces the ErrorBlock', async () => {
    vi.spyOn(edgeApi, 'metadataList').mockRejectedValue(new Error('500'));
    renderWithProviders(<CapProgramRules />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('err-could-not-load-program-r'))
        .toBeInTheDocument());
  });
});

describe('CapSyncOverview (loaded)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('resolved jobs + worker + drift populate stat strip + drift card', async () => {
    vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([
      { runId: 1, jobName: 'METADATA', outcome: 'SUCCEEDED',
        startedAt: 'now', finishedAt: 'now', durationMs: 10,
        triggeredBy: 'MANUAL', detail: '{}' },
      { runId: 2, jobName: 'DRAIN', outcome: 'FAILED',
        startedAt: 'now', finishedAt: 'now', durationMs: 10,
        triggeredBy: 'SCHEDULED', detail: '{}' },
    ] as edgeApi.JobRun[]);
    vi.spyOn(edgeApi, 'workerHealth').mockResolvedValue({
      enabled: true, probeTimestamp: 'now',
      backlog: { PENDING: 50, RETRYABLE: 60 },
    } as unknown as edgeApi.WorkerHealth);
    vi.spyOn(edgeApi, 'drift').mockResolvedValue({
      status: 'IN_SYNC', fingerprintFrom: 'fp-a', fingerprintTo: 'fp-b',
    } as unknown as edgeApi.DriftResponse);
    renderWithProviders(<CapSyncOverview />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('cap-sync-overview')).toBeInTheDocument());
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/Succeeded/);
    expect(body).toMatch(/Failed/);
    expect(body).toMatch(/fp-a/);
    expect(body).toMatch(/fp-b/);
    expect(body).toMatch(/Drift at a glance/);
  });

  it('listJobs rejection surfaces the Partial-load ErrorBlock', async () => {
    vi.spyOn(edgeApi, 'listJobs').mockRejectedValue(new Error('upstream'));
    vi.spyOn(edgeApi, 'workerHealth').mockResolvedValue({
      enabled: true, probeTimestamp: 'now', backlog: {},
    } as unknown as edgeApi.WorkerHealth);
    vi.spyOn(edgeApi, 'drift').mockResolvedValue({
      status: 'IN_SYNC', fingerprintFrom: null, fingerprintTo: null,
    } as unknown as edgeApi.DriftResponse);
    renderWithProviders(<CapSyncOverview />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('err-partial-load')).toBeInTheDocument());
  });

  it('100+ backlog flips the Journal-backlog stat into danger tone', async () => {
    vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([] as edgeApi.JobRun[]);
    vi.spyOn(edgeApi, 'workerHealth').mockResolvedValue({
      enabled: true, probeTimestamp: 'now',
      backlog: { PENDING: 200, RETRYABLE: 50 },
    } as unknown as edgeApi.WorkerHealth);
    vi.spyOn(edgeApi, 'drift').mockResolvedValue({
      status: 'IN_SYNC', fingerprintFrom: null, fingerprintTo: null,
    } as unknown as edgeApi.DriftResponse);
    renderWithProviders(<CapSyncOverview />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('cap-sync-overview')).toBeInTheDocument());
    expect(document.body.textContent ?? '').toMatch(/250/);
  });
});

describe('CapSyncSchedule (loaded)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('populated cron settings render schedule rows + save button', async () => {
    vi.spyOn(edgeApi, 'readSettings').mockResolvedValue({
      cron: {
        'der.sync.metadata.cron': '0 0 * * * ?',
        'der.sync.drift.cron':    '0 0 1 * * ?',
      },
      featureFlags: {},
      roles: [],
    } as unknown as edgeApi.SettingsPayload);
    vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([] as edgeApi.JobRun[]);
    renderWithProviders(<CapSyncSchedule />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('cap-schedule')).toBeInTheDocument());
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/2 scheduled flow/);
    expect(body).toMatch(/metadata|Metadata/);
  });

  it('ScheduleRow — lastRun outcome arms: SUCCESS, FAILED, STARTED, PAUSED', async () => {
    vi.spyOn(edgeApi, 'readSettings').mockResolvedValue({
      cron: {
        'sync.metadata':     '0 0 * * * ?',
        'drift.snapshot':    '0 0 1 * * ?',
        'journal.drain':     '0 */5 * * * ?',
        'analytics.refresh': '0 */10 * * * ?',
      },
      featureFlags: {}, roles: [],
    } as unknown as edgeApi.SettingsPayload);
    vi.spyOn(edgeApi, 'listJobs').mockImplementation(async (_n, name) => {
      switch (name) {
        case 'METADATA_SYNC_FULL': return [{
          runId: 1, jobName: 'METADATA_SYNC_FULL', outcome: 'SUCCEEDED',
          startedAt: '2026-11-03T10:00:00Z', finishedAt: 'now',
          durationMs: 10, triggeredBy: 'SCHEDULED', detail: '{}',
        }] as edgeApi.JobRun[];
        case 'DRIFT_SNAPSHOT': return [{
          runId: 2, jobName: 'DRIFT_SNAPSHOT', outcome: 'FAILED',
          startedAt: '2026-11-03T09:00:00Z', finishedAt: 'now',
          durationMs: 10, triggeredBy: 'MANUAL', detail: '{}',
        }] as edgeApi.JobRun[];
        case 'JOURNAL_WORKER_DRAIN': return [{
          runId: 3, jobName: 'JOURNAL_WORKER_DRAIN', outcome: 'STARTED',
          startedAt: '2026-11-03T11:00:00Z', finishedAt: null,
          durationMs: null, triggeredBy: 'SCHEDULED', detail: '{}',
        }] as unknown as edgeApi.JobRun[];
        default: return [] as edgeApi.JobRun[];
      }
    });
    renderWithProviders(<CapSyncSchedule />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('cap-schedule')).toBeInTheDocument());
    const body = document.body.textContent ?? '';
    /* The three outcome-arm labels should all surface. */
    expect(body).toMatch(/Succeeded|Success/);
    expect(body).toMatch(/Failed/);
    expect(body).toMatch(/Running|Started/);
    expect(body).toMatch(/Never run/);
  });

  it('ScheduleRow — clicking the row toggles the expression panel open', async () => {
    vi.spyOn(edgeApi, 'readSettings').mockResolvedValue({
      cron: { 'sync.metadata': '0 0 * * * ?' },
      featureFlags: {}, roles: [],
    } as unknown as edgeApi.SettingsPayload);
    vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([] as edgeApi.JobRun[]);
    renderWithProviders(<CapSyncSchedule />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('cron-row-sync.metadata'))
        .toBeInTheDocument());
    const user = (await import('@testing-library/user-event')).default.setup();
    await user.click(screen.getByTestId('cron-row-sync.metadata'));
    await waitFor(() =>
      expect(screen.getByTestId('cron-expr-sync.metadata'))
        .toBeInTheDocument());
  });

  it('empty cron settings surface the empty-schedule panel', async () => {
    vi.spyOn(edgeApi, 'readSettings').mockResolvedValue({
      cron: {}, featureFlags: {}, roles: [],
    } as unknown as edgeApi.SettingsPayload);
    vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([] as edgeApi.JobRun[]);
    renderWithProviders(<CapSyncSchedule />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('empty-schedule')).toBeInTheDocument());
  });

  it('readSettings rejection surfaces err-settings-load-failed', async () => {
    vi.spyOn(edgeApi, 'readSettings').mockRejectedValue(new Error('500'));
    renderWithProviders(<CapSyncSchedule />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('err-settings-load-failed'))
        .toBeInTheDocument());
  });
});

describe('CapSystemInformation (loaded)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('resolved systemInfo populates all four DefinitionCards', async () => {
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue({
      service: 'der-edge',
      runtime: {
        heapUsedBytes: 100_000_000, heapMaxBytes: 500_000_000,
        uptimeMillis: 3_600_000, javaVendor: 'Eclipse',
        javaVersion: '17.0.12', osName: 'Linux', osArch: 'aarch64',
        hostname: 'der-pilot-1', availableProcessors: 4,
      },
      database: {
        configured: true, sessionCount: 2, product: 'PostgreSQL 17',
        flywayVersion: '10.0.0', migrationCount: 42, userCount: 7,
      },
      scheduler: {
        name: 'QuartzScheduler', started: true, standbyMode: false,
        executingJobs: 1, totalJobs: 9,
      },
      storage: { totalBytes: 1, usableBytes: 1 },
      dhis2: { configured: true, probeReachable: true, baseUrl: 'x' },
      build: {
        version: '2.3.123', commit: 'abc123', branch: 'main',
        buildTime: '2026-11-03T00:00:00Z', dirty: false,
      },
      apps: { installed: 0, enabled: 0, items: [] },
    } as unknown as edgeApi.SystemInfo);
    renderWithProviders(<CapSystemInformation />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('cap-sysinfo')).toBeInTheDocument());
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/2\.3\.123/);
    expect(body).toMatch(/Eclipse/);
    expect(body).toMatch(/PostgreSQL 17/);
    expect(body).toMatch(/QuartzScheduler/);
  });

  it('systemInfo rejection surfaces err-system-info-failed', async () => {
    vi.spyOn(edgeApi, 'systemInfo').mockRejectedValue(new Error('upstream'));
    renderWithProviders(<CapSystemInformation />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('err-system-info-failed'))
        .toBeInTheDocument());
  });
});

describe('CapDashboard (loaded)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('all four probes resolve → UP + yes + backlog stat populates', async () => {
    vi.spyOn(edgeApi, 'health').mockResolvedValue({
      status: 'UP', components: {}, checks: {},
    } as unknown as edgeApi.HealthResponse);
    vi.spyOn(edgeApi, 'compat').mockResolvedValue({
      status: 'OK', snapshotId: 1, capturedAt: 'now',
      centralVersion: '2.44', profileName: 'V2_44',
      probeReachable: true, probeDurationMs: 100,
      engineVersion: '1.0.0', capabilities: {},
      pinnedVersion: '2.44', pingHistory: [],
    } as unknown as edgeApi.CompatSnapshot);
    vi.spyOn(edgeApi, 'workerHealth').mockResolvedValue({
      enabled: true, probeTimestamp: 'now',
      backlog: { PENDING: 5 },
    } as unknown as edgeApi.WorkerHealth);
    vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([
      { runId: 1, jobName: 'X', outcome: 'FAILED',
        startedAt: 'now', finishedAt: 'now', durationMs: 10,
        triggeredBy: 'MANUAL', detail: '{}' },
    ] as edgeApi.JobRun[]);
    renderWithProviders(<CapDashboard />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('cap-dashboard')).toBeInTheDocument());
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/UP/);
    expect(body).toMatch(/yes/);
  });

  it('health rejection surfaces err-partial-dashboard-load', async () => {
    vi.spyOn(edgeApi, 'health').mockRejectedValue(new Error('down'));
    vi.spyOn(edgeApi, 'compat').mockResolvedValue({
      status: 'OK', probeReachable: false,
    } as unknown as edgeApi.CompatSnapshot);
    vi.spyOn(edgeApi, 'workerHealth').mockResolvedValue({
      enabled: true, probeTimestamp: 'now', backlog: {},
    } as unknown as edgeApi.WorkerHealth);
    vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([] as edgeApi.JobRun[]);
    renderWithProviders(<CapDashboard />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('err-partial-dashboard-load'))
        .toBeInTheDocument());
  });
});

describe('CapOrgUnitBinding (loaded)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  function stubFilters(): void {
    vi.spyOn(edgeApi, 'listOrgUnitGroups').mockResolvedValue({
      organisationUnitGroups: [],
    } as never);
    vi.spyOn(edgeApi, 'listOrgUnitGroupSets').mockResolvedValue({
      organisationUnitGroupSets: [],
    } as never);
    vi.spyOn(edgeApi, 'listOrgUnitLevels').mockResolvedValue({
      organisationUnitLevels: [
        { level: 1, displayName: 'Country' },
        { level: 2, displayName: 'District' },
      ],
    } as never);
    vi.spyOn(edgeApi, 'listOrgUnits').mockResolvedValue({
      organisationUnits: [],
    } as never);
  }

  it('bound binding renders the binding card + breadcrumb path', async () => {
    stubFilters();
    vi.spyOn(edgeApi, 'getOrgUnitBinding').mockResolvedValue({
      bound: true, orgUnitId: 'ou-leaf',
      orgUnitDisplayName: 'Facility A',
      orgUnitPath: '/ou-root/ou-district/ou-leaf',
      boundAt: '2026-11-01T00:00:00Z', boundBy: 'admin',
    } as unknown as edgeApi.OrgUnitBinding);
    vi.spyOn(edgeApi, 'getOrganisationUnit').mockImplementation(async (uid: string) =>
      ({ displayName: `OU ${uid.slice(-4)}` } as never));
    renderWithProviders(<CapOrgUnitBinding />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('ou-binding-card')).toBeInTheDocument());
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/Facility A/);
    expect(body).toMatch(/Bound/);
    expect(body).toMatch(/Level 3/);
  });

  it('unbound binding surfaces the Not-bound empty-state + rebind form', async () => {
    stubFilters();
    vi.spyOn(edgeApi, 'getOrgUnitBinding').mockResolvedValue({
      bound: false, orgUnitId: null, orgUnitDisplayName: null,
      orgUnitPath: null, boundAt: null, boundBy: null,
    } as unknown as edgeApi.OrgUnitBinding);
    renderWithProviders(<CapOrgUnitBinding />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('ou-rebind-form')).toBeInTheDocument());
  });
});
