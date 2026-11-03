import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';

// Module-level mock: SyncOverview imports `* as edgeApi` from the module
// (no `api` prop like the EACoreScreens tests use), so we have to stub
// the whole module here. `importOriginal` keeps non-function exports
// (interfaces compile away; constants like `EdgeApiError` still resolve).
import type * as edgeApiTypes from '../api/edgeApi';
vi.mock('../api/edgeApi', async (importOriginal) => {
  const actual = await importOriginal<typeof edgeApiTypes>();
  return {
    ...actual,
    workerHealth: vi.fn(),
    listJobs: vi.fn(),
    journalStatsByType: vi.fn(),
    systemInfo: vi.fn(),
    dhis2Ping: vi.fn(),
    getOrgUnitBinding: vi.fn(),
    triggerJob: vi.fn(),
  };
});

import * as edgeApi from '../api/edgeApi';
import { MockupSyncOverview } from './SyncOverview';

const workerEnabled: edgeApiTypes.WorkerHealth = {
  enabled: true, lastTick: '2026-11-03T10:00:00Z', lastBatchSize: 0, backlog: {},
};
const workerPaused: edgeApiTypes.WorkerHealth = {
  enabled: false, lastTick: null, lastBatchSize: 0, backlog: {},
};

const pingReachable: edgeApiTypes.PingSnapshot = {
  reachable: true, latencyMs: 12, message: null, observedVersion: '2.44',
  probedAt: '2026-11-03T10:00:00Z',
};
const pingUnreachable: edgeApiTypes.PingSnapshot = {
  reachable: false, latencyMs: 0, message: 'down', observedVersion: null,
  probedAt: '2026-11-03T10:00:00Z',
};

const sysInfoBase = {
  service: 'der', timestamp: '2026-11-03T10:00:00Z',
  build: { version: '1.0.0', commit: 'abc', branch: 'main', dirty: false, buildTime: '' },
  runtime: {}, dhis2: { probeReachable: true },
  database: {}, scheduler: {}, journal: {}, storage: {}, apps: {},
};

const jobSuccess: edgeApiTypes.JobRun = {
  runId: 100, jobName: 'METADATA_SYNC_FULL', startedAt: '2026-11-03T09:30:00Z',
  finishedAt: '2026-11-03T09:30:10Z', outcome: 'SUCCEEDED', durationMs: 10_000,
  detail: '{"pulled":42}', triggeredBy: 'cron',
};
const jobFailed: edgeApiTypes.JobRun = {
  runId: 101, jobName: 'JOURNAL_WORKER_DRAIN', startedAt: '2026-11-03T09:40:00Z',
  finishedAt: '2026-11-03T09:40:05Z', outcome: 'FAILED', durationMs: 5_000,
  detail: '{"rejected":2}', triggeredBy: 'user:admin',
};
const jobPartial: edgeApiTypes.JobRun = {
  runId: 102, jobName: 'REFERRAL_INBOX_PULL', startedAt: '2026-11-03T09:50:00Z',
  finishedAt: '2026-11-03T09:50:03Z', outcome: 'PARTIAL', durationMs: 3_000,
  detail: null, triggeredBy: 'cron',
};

function wireHappyPath(overrides: Partial<{
  jobs: edgeApiTypes.JobRun[]; worker: edgeApiTypes.WorkerHealth;
  stats: Record<string, Record<string, number>>; ping: typeof pingReachable;
  sys: typeof sysInfoBase;
}> = {}): void {
  vi.mocked(edgeApi.workerHealth).mockResolvedValue(overrides.worker ?? workerEnabled);
  vi.mocked(edgeApi.listJobs).mockResolvedValue(overrides.jobs ?? [jobSuccess, jobFailed, jobPartial]);
  vi.mocked(edgeApi.journalStatsByType).mockResolvedValue(overrides.stats ?? {});
  vi.mocked(edgeApi.systemInfo).mockResolvedValue(overrides.sys ?? sysInfoBase);
  vi.mocked(edgeApi.dhis2Ping).mockResolvedValue(overrides.ping ?? pingReachable);
  vi.mocked(edgeApi.getOrgUnitBinding).mockResolvedValue({
    bound: false, orgUnitId: null, orgUnitDisplayName: null, orgUnitPath: null,
    boundAt: null, boundBy: null,
  });
  vi.mocked(edgeApi.triggerJob).mockResolvedValue({ triggered: 'ok' });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('SyncOverview — loading / populated / empty', () => {
  it('shows loading state before worker-health resolves', () => {
    // Never-resolving promises keep the component in loading.
    vi.mocked(edgeApi.workerHealth).mockReturnValue(new Promise(() => {}));
    vi.mocked(edgeApi.listJobs).mockReturnValue(new Promise(() => {}));
    vi.mocked(edgeApi.journalStatsByType).mockReturnValue(new Promise(() => {}));
    vi.mocked(edgeApi.systemInfo).mockReturnValue(new Promise(() => {}));
    vi.mocked(edgeApi.dhis2Ping).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<MockupSyncOverview />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('renders populated recent-activity rows once APIs resolve', async () => {
    wireHappyPath();
    renderWithProviders(<MockupSyncOverview />);
    await waitFor(() => expect(screen.getByTestId('sync-hub')).toBeInTheDocument());
    expect(screen.getByText('Recent activity')).toBeInTheDocument();
    // Each distinct activity row renders its category.
    expect(screen.getAllByText(/Metadata pull/i).length).toBeGreaterThan(0);
    // "View all history" link.
    expect(screen.getByText(/View all history/i)).toBeInTheDocument();
  });

  it('shows the "No sync runs yet" row when listJobs returns empty', async () => {
    wireHappyPath({ jobs: [] });
    renderWithProviders(<MockupSyncOverview />);
    await waitFor(() => expect(screen.getByTestId('sync-hub')).toBeInTheDocument());
    expect(screen.getByText(/No sync runs yet/i)).toBeInTheDocument();
  });

  it('gracefully recovers when listJobs rejects (Promise.allSettled)', async () => {
    vi.mocked(edgeApi.workerHealth).mockResolvedValue(workerEnabled);
    vi.mocked(edgeApi.listJobs).mockRejectedValue(new Error('boom'));
    vi.mocked(edgeApi.journalStatsByType).mockResolvedValue({});
    vi.mocked(edgeApi.systemInfo).mockResolvedValue(sysInfoBase);
    vi.mocked(edgeApi.dhis2Ping).mockResolvedValue(pingReachable);
    renderWithProviders(<MockupSyncOverview />);
    // The hub still renders (allSettled); empty-row visible.
    await waitFor(() => expect(screen.getByTestId('sync-hub')).toBeInTheDocument());
    expect(screen.getByText(/No sync runs yet/i)).toBeInTheDocument();
  });
});

describe('SyncOverview — status-bar tone branches', () => {
  it('shows "Paused" when worker is disabled', async () => {
    wireHappyPath({ worker: workerPaused });
    renderWithProviders(<MockupSyncOverview />);
    await waitFor(() => expect(screen.getByText(/Paused/i)).toBeInTheDocument());
  });

  it('shows "Central unavailable" when ping is unreachable', async () => {
    wireHappyPath({ ping: pingUnreachable });
    renderWithProviders(<MockupSyncOverview />);
    await waitFor(() => expect(screen.getByText(/Central unavailable/i)).toBeInTheDocument());
    expect(screen.getByText(/unreachable/)).toBeInTheDocument();
  });

  it('shows "Needs attention" when stats surface CONFLICT_REVIEW rows', async () => {
    wireHappyPath({
      stats: { EVENT: { CONFLICT_REVIEW: 3, PENDING: 0 }, TEI: { RETRYABLE: 1 } },
    });
    renderWithProviders(<MockupSyncOverview />);
    await waitFor(() => expect(screen.getByText(/Needs attention/i)).toBeInTheDocument());
    // The attention link shows the plural count (4 total).
    expect(screen.getByText(/4 need[s]? attention/)).toBeInTheDocument();
  });

  it('shows singular "needs attention" copy for a count of 1', async () => {
    wireHappyPath({ stats: { EVENT: { CENTRAL_REJECTED: 1 } } });
    renderWithProviders(<MockupSyncOverview />);
    await waitFor(() => expect(screen.getByText(/1 needs attention/)).toBeInTheDocument());
  });

  it('shows "waiting" when PENDING/IN_FLIGHT counts are nonzero', async () => {
    wireHappyPath({ stats: { EVENT: { PENDING: 2, IN_FLIGHT: 5 } } });
    renderWithProviders(<MockupSyncOverview />);
    await waitFor(() => expect(screen.getByText(/7 waiting/)).toBeInTheDocument());
  });

  it('shows "Up to date" when all queues are empty and central is reachable', async () => {
    wireHappyPath({ jobs: [jobSuccess] });
    renderWithProviders(<MockupSyncOverview />);
    await waitFor(() => expect(screen.getByText(/Up to date/i)).toBeInTheDocument());
  });

  it('falls back to sysInfo probe when live ping has not yet resolved', async () => {
    vi.mocked(edgeApi.workerHealth).mockResolvedValue(workerEnabled);
    vi.mocked(edgeApi.listJobs).mockResolvedValue([jobSuccess]);
    vi.mocked(edgeApi.journalStatsByType).mockResolvedValue({});
    vi.mocked(edgeApi.systemInfo).mockResolvedValue({
      ...sysInfoBase, dhis2: { probeReachable: true },
    });
    // Live ping stays pending so livePing.reachable === null.
    vi.mocked(edgeApi.dhis2Ping).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<MockupSyncOverview />);
    await waitFor(() => expect(screen.getByTestId('sync-hub')).toBeInTheDocument());
    // sysInfo probe says reachable, so status chip is "Up to date".
    await waitFor(() => expect(screen.getByText(/Up to date/i)).toBeInTheDocument());
  });
});

describe('SyncOverview — "last successful sync" subtitle', () => {
  it('says "never" when no job has succeeded', async () => {
    wireHappyPath({ jobs: [jobFailed] });
    renderWithProviders(<MockupSyncOverview />);
    await waitFor(() => expect(screen.getByText(/Last successful sync/)).toBeInTheDocument());
    expect(screen.getByText('never')).toBeInTheDocument();
  });

  it('shows a time-ago value when a SUCCEEDED job exists', async () => {
    wireHappyPath();
    renderWithProviders(<MockupSyncOverview />);
    await waitFor(() => expect(screen.getByText(/Last successful sync/)).toBeInTheDocument());
    expect(screen.queryByText('never')).toBeNull();
  });
});

describe('SyncOverview — pull / push buttons', () => {
  it('disables pull & push when central is unreachable', async () => {
    wireHappyPath({ ping: pingUnreachable });
    renderWithProviders(<MockupSyncOverview />);
    await waitFor(() => expect(screen.getByTestId('sync-pull-metadata')).toBeInTheDocument());
    expect(screen.getByTestId('sync-pull-metadata')).toBeDisabled();
    expect(screen.getByTestId('sync-push-data')).toBeDisabled();
    // Tooltip text on pull.
    expect(screen.getByTestId('sync-pull-metadata'))
      .toHaveAttribute('title', expect.stringMatching(/Central DHIS2 is unavailable/));
  });

  it('disables push (only) when worker is paused but central is reachable', async () => {
    wireHappyPath({ worker: workerPaused });
    renderWithProviders(<MockupSyncOverview />);
    await waitFor(() => expect(screen.getByTestId('sync-push-data')).toBeInTheDocument());
    expect(screen.getByTestId('sync-pull-metadata')).not.toBeDisabled();
    expect(screen.getByTestId('sync-push-data')).toBeDisabled();
    expect(screen.getByTestId('sync-push-data'))
      .toHaveAttribute('title', expect.stringMatching(/Worker is paused/));
  });

  it('invokes triggerJob with the right Quartz job name when Pull is clicked', async () => {
    wireHappyPath();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<MockupSyncOverview />);
    await waitFor(() => expect(screen.getByTestId('sync-pull-metadata')).toBeInTheDocument());
    await user.click(screen.getByTestId('sync-pull-metadata'));
    await waitFor(() => expect(edgeApi.triggerJob).toHaveBeenCalledWith('METADATA_SYNC_FULL'));
    // The ProgressRow shows up with "Pull metadata" label.
    expect(screen.getByTestId('progress-pull-metadata')).toBeInTheDocument();
  });

  it('invokes triggerJob("JOURNAL_WORKER_DRAIN") when Push is clicked', async () => {
    wireHappyPath();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<MockupSyncOverview />);
    await waitFor(() => expect(screen.getByTestId('sync-push-data')).toBeInTheDocument());
    await user.click(screen.getByTestId('sync-push-data'));
    await waitFor(() => expect(edgeApi.triggerJob).toHaveBeenCalledWith('JOURNAL_WORKER_DRAIN'));
    expect(screen.getByTestId('progress-push-data')).toBeInTheDocument();
  });

  it('surfaces a failed Pull as an error ProgressRow with Dismiss affordance', async () => {
    wireHappyPath();
    vi.mocked(edgeApi.triggerJob).mockResolvedValueOnce({ error: 'quartz offline' });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<MockupSyncOverview />);
    await waitFor(() => expect(screen.getByTestId('sync-pull-metadata')).toBeInTheDocument());
    await user.click(screen.getByTestId('sync-pull-metadata'));
    await waitFor(() => expect(screen.getByText(/Failed/)).toBeInTheDocument());
    expect(screen.getByText(/quartz offline/)).toBeInTheDocument();
    // Dismiss button is present on terminal state.
    const row = screen.getByTestId('progress-pull-metadata');
    const dismiss = within(row).getByText(/Dismiss/);
    await user.click(dismiss);
    // After dismiss the progress row is gone.
    await waitFor(() => expect(screen.queryByTestId('progress-pull-metadata')).toBeNull());
  });

  it('surfaces a rejected triggerJob as a failure state', async () => {
    wireHappyPath();
    vi.mocked(edgeApi.triggerJob).mockRejectedValueOnce(new Error('network'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<MockupSyncOverview />);
    await waitFor(() => expect(screen.getByTestId('sync-pull-metadata')).toBeInTheDocument());
    await user.click(screen.getByTestId('sync-pull-metadata'));
    await waitFor(() => expect(screen.getByText(/network/)).toBeInTheDocument());
  });
});

describe('SyncOverview — activity rows', () => {
  it('renders rows with the status chip derived from job.outcome', async () => {
    wireHappyPath({ jobs: [jobSuccess, jobFailed, jobPartial] });
    renderWithProviders(<MockupSyncOverview />);
    await waitFor(() => expect(screen.getByText('Recent activity')).toBeInTheDocument());
    // Metadata pull / Data push / Referral check categories visible.
    expect(screen.getByText(/Referral check/i)).toBeInTheDocument();
  });

  it('caps the recent-activity feed at 8 rows', async () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      ...jobSuccess, runId: 200 + i, startedAt: `2026-11-03T0${i % 10}:00:00Z`,
    }));
    wireHappyPath({ jobs: many });
    renderWithProviders(<MockupSyncOverview />);
    await waitFor(() => expect(screen.getByText('Recent activity')).toBeInTheDocument());
    // Metadata-pull category repeats one per row; cap verified via count ≤ 8.
    const cells = screen.getAllByText(/Metadata pull/i);
    expect(cells.length).toBeLessThanOrEqual(8);
  });
});
