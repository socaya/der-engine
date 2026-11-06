import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SyncStatus } from './SyncStatus';
import { renderWithProviders } from '../test/renderWithProviders';
import type { SyncJobRun } from '../api/edgeApi';

const job: SyncJobRun = {
  runId: 1,
  jobName: 'metadata-sync',
  startedAt: '2026-11-05T10:00:00Z',
  finishedAt: '2026-11-05T10:00:20Z',
  outcome: 'SUCCESS',
  durationMs: 20000,
  detail: null,
  triggeredBy: 'SCHEDULED',
};

const drift = {
  driftId: 1, capturedAt: '2026-11-05T09:00:00Z',
  snapshotFrom: 1, snapshotTo: 2,
  fingerprintFrom: 'aaaaaaaaxxxx', fingerprintTo: 'bbbbbbbbyyyy',
  deltasJson: '{}', triggeredBy: 'SCHEDULED',
};

const worker = {
  enabled: true, lastTick: '2026-11-05T10:01:00Z', lastBatchSize: 3,
  backlog: { PENDING: 2, FAILED: 0 },
};

afterEach(() => { vi.restoreAllMocks(); });

function stubApi(overrides: Record<string, unknown> = {}): never {
  return {
    listSyncJobs: vi.fn().mockResolvedValue([job]),
    latestDrift: vi.fn().mockResolvedValue(drift),
    journalWorkerHealth: vi.fn().mockResolvedValue(worker),
    ...overrides,
  } as never;
}

describe('SyncStatus', () => {
  it('renders worker + drift + jobs', async () => {
    renderWithProviders(<SyncStatus api={stubApi()} />);
    await waitFor(() =>
      expect(screen.getByTestId('sync-status-heading')).toBeInTheDocument());
    expect(screen.getByTestId('sync-worker-enabled')).toBeInTheDocument();
    expect(screen.getByTestId('sync-worker-backlog-PENDING')).toHaveTextContent('2');
    expect(screen.getByTestId('sync-drift-captured')).toHaveTextContent('2026-11-05T09:00:00Z');
    expect(screen.getByTestId('sync-job-1')).toHaveTextContent('metadata-sync');
  });

  it('shows paused tag when the worker is disabled', async () => {
    renderWithProviders(
      <SyncStatus api={stubApi({
        journalWorkerHealth: vi.fn().mockResolvedValue({ ...worker, enabled: false, lastTick: null }),
      })} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('sync-worker-paused')).toBeInTheDocument());
    expect(screen.getByTestId('sync-worker-tick')).toHaveTextContent('—');
  });

  it('shows no-drift message when driftId is missing', async () => {
    renderWithProviders(
      <SyncStatus api={stubApi({
        latestDrift: vi.fn().mockResolvedValue({ status: 'NO_SNAPSHOT', message: 'no snaps' }),
      })} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('sync-drift-none')).toHaveTextContent('no snaps'));
  });

  it('shows no-drift message even without a server-side message', async () => {
    renderWithProviders(
      <SyncStatus api={stubApi({
        latestDrift: vi.fn().mockResolvedValue({ status: 'NO_SNAPSHOT' }),
      })} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('sync-drift-none')).toBeInTheDocument());
  });

  it('shows empty state when no jobs have run', async () => {
    renderWithProviders(
      <SyncStatus api={stubApi({ listSyncJobs: vi.fn().mockResolvedValue([]) })} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('sync-jobs-empty')).toBeInTheDocument());
  });

  it('renders every outcome tag', async () => {
    const jobs: SyncJobRun[] = [
      { ...job, runId: 1, outcome: 'SUCCESS' },
      { ...job, runId: 2, outcome: 'FAILED' },
      { ...job, runId: 3, outcome: 'STARTED', durationMs: null, finishedAt: null },
      { ...job, runId: 4, outcome: 'SKIPPED' },
    ];
    renderWithProviders(
      <SyncStatus api={stubApi({ listSyncJobs: vi.fn().mockResolvedValue(jobs) })} />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('sync-job-1')).toBeInTheDocument();
    });
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getAllByText('Running').length).toBeGreaterThan(0);
    expect(screen.getByText('Skipped')).toBeInTheDocument();
    // null durationMs → "—"
    expect(screen.getByTestId('sync-job-3')).toHaveTextContent('—');
  });

  it('error state when the fetch rejects', async () => {
    renderWithProviders(
      <SyncStatus api={stubApi({
        listSyncJobs: vi.fn().mockRejectedValue(new Error('boom')),
      })} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('sync-status-error')).toBeInTheDocument());
  });

  it('non-Error rejection surfaces as string', async () => {
    renderWithProviders(
      <SyncStatus api={stubApi({
        listSyncJobs: vi.fn().mockRejectedValue('nope'),
      })} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('sync-status-error')).toBeInTheDocument());
  });
});
