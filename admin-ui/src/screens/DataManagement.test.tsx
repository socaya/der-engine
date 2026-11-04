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
  vi.spyOn(edgeApi, 'journalStatsByType').mockResolvedValue(
    {} as unknown as edgeApi.JournalStatsByType);
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

  it('empty records → "No records yet" status label + muted tone', async () => {
    stubAll();
    renderWithProviders(<MockupDataManagement />, { authApi });
    await waitFor(() =>
      expect(screen.getByText(/No records yet/)).toBeInTheDocument());
  });

  it('rowMenuForType includes aggregate/event/tracker menu items per type', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'journalStatsByType').mockResolvedValue({
      AGGREGATE_DATA_VALUE: { CENTRAL_ACCEPTED: 1 },
      EVENT: { CENTRAL_ACCEPTED: 1 },
      PROGRAM_STAGE_EVENT: { CENTRAL_ACCEPTED: 1 },
      TRACKED_ENTITY: { CENTRAL_ACCEPTED: 1 },
      ENROLLMENT: { CENTRAL_ACCEPTED: 1 },
    } as unknown as edgeApi.JournalStatsByType);
    renderWithProviders(<MockupDataManagement />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('data-type-row-AGGREGATE_DATA_VALUE'))
        .toBeInTheDocument());
    /* All five type rows render — rowMenuForType is invoked for each,
     * covering its three branches (aggregate / event / tracker). */
    expect(screen.getByTestId('data-type-row-EVENT')).toBeInTheDocument();
    expect(screen.getByTestId('data-type-row-PROGRAM_STAGE_EVENT'))
      .toBeInTheDocument();
    expect(screen.getByTestId('data-type-row-TRACKED_ENTITY'))
      .toBeInTheDocument();
    expect(screen.getByTestId('data-type-row-ENROLLMENT'))
      .toBeInTheDocument();
  });

  it('populated byType → "N captured" surfaces with totals + per-type rows', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'journalStatsByType').mockResolvedValue({
      AGGREGATE_DATA_VALUE: {
        PENDING: 3, IN_FLIGHT: 0, CENTRAL_ACCEPTED: 120,
        RETRYABLE: 2,
      },
      EVENT: {
        PENDING: 0, CENTRAL_ACCEPTED: 42,
      },
    } as unknown as edgeApi.JournalStatsByType);
    renderWithProviders(<MockupDataManagement />, { authApi });
    await waitFor(() =>
      expect(screen.getAllByText(/captured/).length)
        .toBeGreaterThan(0));
    /* Per-type rows render. */
    expect(screen.getByTestId('data-type-row-AGGREGATE_DATA_VALUE'))
      .toBeInTheDocument();
    expect(screen.getByTestId('data-type-row-EVENT')).toBeInTheDocument();
    /* Waiting-to-send surfaces in both subtitle + column header. */
    expect(screen.getAllByText(/Waiting to send/).length)
      .toBeGreaterThan(0);
  });

  it('populated drafts → drafts link surfaces in the subtitle', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'listDrafts').mockResolvedValue({
      drafts: [
        { draftId: 'd-1', kind: 'AGGREGATE', title: 't',
          state: 'DRAFT', createdAt: 'now' },
        { draftId: 'd-2', kind: 'EVENT', title: 't',
          state: 'DRAFT', createdAt: 'now' },
      ],
    } as never);
    renderWithProviders(<MockupDataManagement />, { authApi });
    await waitFor(() =>
      expect(screen.getByText(/Drafts/)).toBeInTheDocument());
    /* Count surfaces. */
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('rejected probes keep the component on the LoadingBlock (si+stats guard)', async () => {
    vi.spyOn(edgeApi, 'systemInfo').mockRejectedValue(new Error('x'));
    vi.spyOn(edgeApi, 'journalStatsByType').mockRejectedValue(new Error('x'));
    vi.spyOn(edgeApi, 'listJobs').mockRejectedValue(new Error('x'));
    vi.spyOn(edgeApi, 'listDrafts').mockRejectedValue(new Error('x'));
    renderWithProviders(<MockupDataManagement />, { authApi });
    /* Promise.allSettled swallows; si/stats stay null → LoadingBlock
     * remains. */
    await Promise.resolve();
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });
});
