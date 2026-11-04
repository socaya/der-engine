import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
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

  it('populated backlog renders rows + all-sent status tone', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'listJournalOperations').mockResolvedValue([
      /* All ACCEPTED → 'Sent' operator state → "All sent" label. */
      { operationId: 'op-ok-1', entityType: 'DATA_VALUE',
        entityRef: 'VAL-1', state: 'CENTRAL_ACCEPTED',
        attemptCount: 1, lastError: null, nextHopOrgUnitUid: null,
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-02T00:00:00Z' },
    ] as unknown as edgeApi.JournalOperation[]);
    renderWithProviders(<MockupDataQueues />, { authApi });
    /* The default filter ('ACTIVE') hides Sent rows. Switch to ALL
     * so the row renders. */
    const user = (await import('@testing-library/user-event')).default
      .setup();
    await waitFor(() =>
      expect(screen.getByTestId('sync-data')).toBeInTheDocument());
    /* Status label: no attention, no unsent, worker enabled, central
     * reachable → "All sent" success tone. */
    expect(screen.getByText('All sent')).toBeInTheDocument();
    /* Select the ALL filter to show the single ACCEPTED row. */
    const selects = document.querySelectorAll('select');
    /* second select = status filter (first is type). */
    await user.selectOptions(selects[1], 'ALL');
    await waitFor(() =>
      expect(screen.getByTestId('data-row-op-ok-1'))
        .toBeInTheDocument());
    /* 'Clean processed' button surfaces when at least one Sent row. */
    expect(screen.getByTestId('data-queue-purge')).toBeInTheDocument();
  });

  it('paused worker → status label "Paused" + muted tone', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'workerHealth').mockResolvedValue({
      enabled: false, probeTimestamp: 'now',
      backlog: {}, lastTick: null, lastBatchSize: 0,
    } as unknown as edgeApi.WorkerHealth);
    renderWithProviders(<MockupDataQueues />, { authApi });
    await waitFor(() =>
      expect(screen.getByText('Paused')).toBeInTheDocument());
    /* Push button disabled when worker paused. */
    expect(screen.getByTestId('data-push')).toBeDisabled();
  });

  it('central unreachable → status label "Central unavailable" + warning tone', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue({
      runtime: { heapUsedBytes: 1, heapMaxBytes: 100, uptimeMillis: 1 },
      database: { configured: true, sessionCount: 0 },
      scheduler: { started: true, executingJobs: 0, totalJobs: 1 },
      storage: { totalBytes: 1, usableBytes: 1 },
      dhis2: { configured: true, probeReachable: false, baseUrl: 'x' },
      build: { version: '2.3.122', commit: 'a', branch: 'main',
               buildTime: 'now', dirty: false },
      apps: { installed: 0, enabled: 0, items: [] },
    } as unknown as edgeApi.SystemInfo);
    renderWithProviders(<MockupDataQueues />, { authApi });
    await waitFor(() =>
      expect(screen.getByText('Central unavailable')).toBeInTheDocument());
  });

  it('backlog with Needs attention → danger tone label + attention count', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'listJournalOperations').mockResolvedValue([
      { operationId: 'op-conflict-1', entityType: 'DATA_VALUE',
        entityRef: 'VAL-1', state: 'CONFLICT_REVIEW',
        attemptCount: 7, lastError: 'bad', nextHopOrgUnitUid: null,
        createdAt: 'now', updatedAt: 'now' },
      { operationId: 'op-conflict-2', entityType: 'EVENT',
        entityRef: 'EV-1', state: 'CENTRAL_REJECTED',
        attemptCount: 3, lastError: 'rej', nextHopOrgUnitUid: null,
        createdAt: 'now', updatedAt: 'now' },
    ] as unknown as edgeApi.JournalOperation[]);
    renderWithProviders(<MockupDataQueues />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '')
        .toMatch(/\d need[s]? attention/));
  });

  it('unsent-only backlog → "N waiting" info tone', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'listJournalOperations').mockResolvedValue([
      { operationId: 'op-pend', entityType: 'DATA_VALUE',
        entityRef: 'VAL-1', state: 'PENDING',
        attemptCount: 0, lastError: null, nextHopOrgUnitUid: null,
        createdAt: 'now', updatedAt: 'now' },
      { operationId: 'op-pend-2', entityType: 'DATA_VALUE',
        entityRef: 'VAL-2', state: 'RETRYABLE',
        attemptCount: 1, lastError: 'r', nextHopOrgUnitUid: null,
        createdAt: 'now', updatedAt: 'now' },
    ] as unknown as edgeApi.JournalOperation[]);
    renderWithProviders(<MockupDataQueues />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '')
        .toMatch(/2 waiting/));
  });

  it('filter — searching for a non-existent id surfaces the "no matches" branch', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'listJournalOperations').mockResolvedValue([
      { operationId: 'op-active', entityType: 'DATA_VALUE',
        entityRef: 'VAL-1', state: 'PENDING',
        attemptCount: 0, lastError: null, nextHopOrgUnitUid: null,
        createdAt: 'now', updatedAt: 'now' },
    ] as unknown as edgeApi.JournalOperation[]);
    renderWithProviders(<MockupDataQueues />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('data-row-op-active'))
        .toBeInTheDocument());
    const user = (await import('@testing-library/user-event')).default
      .setup();
    await user.type(screen.getByPlaceholderText(/Search record/i),
                     'nonexistent-id');
    await waitFor(() =>
      expect(document.body.textContent ?? '')
        .toMatch(/No records match the current filters/));
  });

  it('empty-backlog state surfaces when items.length === 0', async () => {
    stubAll();
    renderWithProviders(<MockupDataQueues />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '')
        .toMatch(/outbound queue is empty/));
  });

  it('last-cleaned chip surfaces when fetchLastJournalPurge returns a row', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'fetchLastJournalPurge').mockResolvedValue({
      observedAt: '2026-11-02T10:00:00Z',
      rowsPurged: 12,
      olderThanDays: 0,
    } as never);
    renderWithProviders(<MockupDataQueues />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('data-last-cleaned')).toBeInTheDocument());
    expect(document.body.textContent ?? '').toMatch(/12 row/);
  });

  it('workflowRunId URL filter surfaces the scoped-filter chip', async () => {
    stubAll();
    renderWithProviders(<MockupDataQueues />,
      { authApi, route: '/admin/data/queue?workflowRunId=wfr-abcdef12' });
    await waitFor(() =>
      expect(screen.getByText(/Workflow run wfr-abcd/i))
        .toBeInTheDocument());
  });

  it('MockupDataDetail — populated op renders the overview + response label', async () => {
    vi.spyOn(edgeApi, 'fetchJournalOperation').mockResolvedValue({
      operationId: 'op-1', entityType: 'DATA_VALUE',
      entityRef: 'VAL-1', state: 'CENTRAL_ACCEPTED',
      attemptCount: 1, lastError: '{"status":"SUCCESS"}',
      nextHopOrgUnitUid: null,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-02T00:00:00Z',
      payload: { foo: 'bar' },
    } as unknown as edgeApi.JournalOperation);
    renderWithProviders(
      <Routes><Route path="/admin/data/queue/:operationId"
                      element={<MockupDataDetail />} /></Routes>,
      { authApi, route: '/admin/data/queue/op-1' });
    await waitFor(() =>
      expect(screen.getByTestId('sync-data-detail')).toBeInTheDocument());
    /* Entity ref surfaces in subtitle. */
    expect(screen.getAllByText('VAL-1').length).toBeGreaterThan(0);
  });

  it('MockupDataDetail — fetchJournalOperation rejection renders error panel', async () => {
    vi.spyOn(edgeApi, 'fetchJournalOperation').mockRejectedValue(
      new Error('operation-not-found'));
    renderWithProviders(
      <Routes><Route path="/admin/data/queue/:operationId"
                      element={<MockupDataDetail />} /></Routes>,
      { authApi, route: '/admin/data/queue/op-x' });
    await waitFor(() =>
      expect(screen.getByTestId('sync-data-detail-err'))
        .toBeInTheDocument());
    expect(screen.getByText(/operation-not-found/)).toBeInTheDocument();
  });

  it('MockupDataDetail — Payload tab renders JsonViewer panel', async () => {
    vi.spyOn(edgeApi, 'fetchJournalOperation').mockResolvedValue({
      operationId: 'op-payload', entityType: 'DATA_VALUE',
      entityRef: 'VAL-1', state: 'CENTRAL_ACCEPTED',
      attemptCount: 1, lastError: null,
      nextHopOrgUnitUid: null,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-02T00:00:00Z',
      payload: { dataValues: [{ de: 'DE-1', value: '42' }] },
    } as unknown as edgeApi.JournalOperation);
    renderWithProviders(
      <Routes><Route path="/admin/data/queue/:operationId"
                      element={<MockupDataDetail />} /></Routes>,
      { authApi, route: '/admin/data/queue/op-payload' });
    await waitFor(() =>
      expect(screen.getByTestId('sync-data-detail')).toBeInTheDocument());
    const user = (await import('@testing-library/user-event')).default
      .setup();
    /* Click Payload tab. */
    await user.click(screen.getByRole('tab', { name: /Payload/i }));
    /* Payload panel header surfaces. */
    await waitFor(() =>
      expect(screen.getByText(/Payload JSON/)).toBeInTheDocument());
  });

  it('MockupDataDetail — raw response toggle (Show full response)', async () => {
    vi.spyOn(edgeApi, 'fetchJournalOperation').mockResolvedValue({
      operationId: 'op-parsed', entityType: 'DATA_VALUE',
      entityRef: 'VAL-1', state: 'CENTRAL_ACCEPTED',
      attemptCount: 1,
      lastError: JSON.stringify({
        message: 'ok',
        status: 'SUCCESS',
        httpStatus: 'OK',
        httpStatusCode: 200,
        importCount: { imported: 1, updated: 0, ignored: 0, deleted: 0 },
      }),
      nextHopOrgUnitUid: null,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-02T00:00:00Z',
      payload: {},
    } as unknown as edgeApi.JournalOperation);
    renderWithProviders(
      <Routes><Route path="/admin/data/queue/:operationId"
                      element={<MockupDataDetail />} /></Routes>,
      { authApi, route: '/admin/data/queue/op-parsed' });
    await waitFor(() =>
      expect(screen.getByTestId('sync-data-detail')).toBeInTheDocument());
    const user = (await import('@testing-library/user-event')).default
      .setup();
    /* Toggle raw response on. */
    await user.click(screen.getByText('Show full response'));
    await waitFor(() =>
      expect(screen.getByText('Hide full response')).toBeInTheDocument());
    /* Toggle back off. */
    await user.click(screen.getByText('Hide full response'));
    await waitFor(() =>
      expect(screen.getByText('Show full response')).toBeInTheDocument());
  });

  it('MockupDataDetail — error-state op uses "Last error" label', async () => {
    vi.spyOn(edgeApi, 'fetchJournalOperation').mockResolvedValue({
      operationId: 'op-fail', entityType: 'DATA_VALUE',
      entityRef: 'VAL-1', state: 'CENTRAL_REJECTED',
      attemptCount: 5, lastError: 'validation failed',
      nextHopOrgUnitUid: null,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-02T00:00:00Z',
      payload: {},
    } as unknown as edgeApi.JournalOperation);
    renderWithProviders(
      <Routes><Route path="/admin/data/queue/:operationId"
                      element={<MockupDataDetail />} /></Routes>,
      { authApi, route: '/admin/data/queue/op-fail' });
    await waitFor(() =>
      expect(screen.getByTestId('sync-data-detail')).toBeInTheDocument());
  });
});
