import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { MockupDataManagement } from './DataManagement';
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
  vi.spyOn(edgeApi, 'journalStatsByType').mockResolvedValue({
    byType: {}, totals: { pending: 0, inFlight: 0, central_accepted: 0,
      conflict: 0, failed_retryable: 0, failed_terminal: 0 },
    windowStart: 'now',
  } as unknown as edgeApi.JournalStatsByType);
  vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([]);
  vi.spyOn(edgeApi, 'listDrafts').mockResolvedValue({ drafts: [] });
}

describe('MockupDataManagement', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('shows LoadingBlock while the parallel probes are pending', () => {
    vi.spyOn(edgeApi, 'systemInfo').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'journalStatsByType').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'listJobs').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'listDrafts').mockImplementation(() => new Promise(() => undefined));
    renderWithProviders(<MockupDataManagement />, { authApi });
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('clears loading once all probes settle', async () => {
    stubAll();
    renderWithProviders(<MockupDataManagement />, { authApi });
    await waitFor(() => expect(screen.queryByTestId('loading')).toBeNull());
  });
});
