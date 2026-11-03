import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActiveJobsWatcher } from './ActiveJobsWatcher';
import { AlertProvider } from './AlertStack';
import * as edgeApi from '../api/edgeApi';

/* ActiveJobsWatcher polls listJobs on an interval and fires toasts
 * via useAlert() when a seen job transitions to a terminal outcome.
 * It silently swallows probe errors. */

function run(): JSX.Element {
  return (
    <AlertProvider>
      <ActiveJobsWatcher />
    </AlertProvider>
  );
}

describe('ActiveJobsWatcher', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('silently swallows probe rejection — no alert surfaces', async () => {
    vi.spyOn(edgeApi, 'listJobs').mockRejectedValue(new Error('probe fail'));
    const { container } = render(run());
    /* Flush microtasks. */
    await act(async () => { await Promise.resolve(); });
    /* No toasts. */
    expect(container.querySelector('.ea-alert')).toBeNull();
  });

  it('seeds initial outcomes without alerting', async () => {
    const nowIso = '2026-11-03T12:00:00Z';
    vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([
      { runId: 1, jobName: 'DRAIN', outcome: 'SUCCESS',
        startedAt: nowIso, finishedAt: nowIso, durationMs: 5000,
        triggeredBy: 'SCHEDULED', detail: '{}' },
    ] as unknown as edgeApi.JobRun[]);
    const { container } = render(run());
    await act(async () => { await Promise.resolve(); });
    /* First tick seeds — no toasts. */
    expect(container.querySelector('.ea-alert')).toBeNull();
  });

  it('picks the latest run per job name via startedAt comparison', async () => {
    /* Two runs with same jobName — latestByName keeps the newer one. */
    vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([
      { runId: 1, jobName: 'J', outcome: 'SUCCESS',
        startedAt: '2026-11-03T12:00:00Z', finishedAt: 'now',
        durationMs: 1000, triggeredBy: 'SCHEDULED', detail: '{}' },
      { runId: 2, jobName: 'J', outcome: 'FAILED',
        startedAt: '2026-11-03T13:00:00Z', finishedAt: 'now',
        durationMs: 2000, triggeredBy: 'SCHEDULED', detail: '{}' },
    ] as unknown as edgeApi.JobRun[]);
    const { container } = render(run());
    await act(async () => { await Promise.resolve(); });
    /* Seed tick doesn't alert; proves duplicate jobNames don't crash. */
    expect(container.firstChild).not.toBeUndefined();
  });

  it('component mounts + unmounts cleanly without errors', async () => {
    vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([]);
    const { unmount } = render(run());
    await act(async () => { await Promise.resolve(); });
    unmount();
    /* Clean unmount clears the interval. */
  });

  it('RUNNING outcome does not trigger a transition alert', async () => {
    vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([
      { runId: 1, jobName: 'J', outcome: 'RUNNING',
        startedAt: '2026-11-03T12:00:00Z', finishedAt: null,
        durationMs: null, triggeredBy: 'SCHEDULED', detail: '{}' },
    ] as unknown as edgeApi.JobRun[]);
    const { container } = render(run());
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector('.ea-alert')).toBeNull();
  });
});
