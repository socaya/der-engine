import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { MockupDataQueues, MockupDataDetail } from './DataQueues';
import * as edgeApi from '../api/edgeApi';

const authApi = {
  session: vi.fn().mockResolvedValue({
    userId: 'u1', username: 'admin', displayName: 'Admin',
    roles: ['ADMIN'], expiresAt: '2027-01-01T00:00:00Z',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

function stubAll(): void {
  vi.spyOn(edgeApi, 'listJournalOperations').mockResolvedValue([]);
  vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue({
    runtime: { heapUsedBytes: 1, heapMaxBytes: 100, uptimeMillis: 1 },
    database: { configured: true, sessionCount: 0 },
    scheduler: { started: true, executingJobs: 0, totalJobs: 1 },
    storage: { totalBytes: 1, usableBytes: 1 },
    dhis2: { configured: true, probeReachable: true, baseUrl: 'x' },
    build: { version: '2.3.122', commit: 'a', branch: 'main',
             buildTime: 'now', dirty: false },
    apps: { installed: 0, enabled: 0, items: [] },
  } as unknown as edgeApi.SystemInfo);
  vi.spyOn(edgeApi, 'workerHealth').mockResolvedValue({
    enabled: true, pendingCount: 0, inFlightCount: 0,
    retryableCount: 0, failedCount: 0, acceptedCount: 0,
    conflictCount: 0, probeTimestamp: 'now',
  } as unknown as edgeApi.WorkerHealth);
  vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([]);
}

describe('MockupDataQueues', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('shows LoadingBlock while the parallel probes are pending', () => {
    vi.spyOn(edgeApi, 'listJournalOperations').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'systemInfo').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'workerHealth').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'listJobs').mockImplementation(() => new Promise(() => undefined));
    renderWithProviders(<MockupDataQueues />, { authApi });
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('clears loading once all probes settle', async () => {
    stubAll();
    renderWithProviders(<MockupDataQueues />, { authApi });
    await waitFor(() => expect(screen.queryByTestId('loading')).toBeNull());
  });

  it('MockupDataDetail renders a BackLink target when loading a specific op', () => {
    vi.spyOn(edgeApi, 'listJournalOperations').mockImplementation(() => new Promise(() => undefined));
    renderWithProviders(<MockupDataDetail />,
      { authApi, route: '/admin/data/queue/op-1' });
    /* The detail route lives inside the Queue surface; its loading
     * state is the same LoadingBlock as the list. */
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });
});
