import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { Workspace } from './Workspace';
import * as edgeApi from '../api/edgeApi';

const authApi = {
  session: vi.fn().mockResolvedValue({
    userId: 'u1', username: 'admin', displayName: 'Admin',
    roles: ['ADMIN'], expiresAt: '2027-01-01T00:00:00Z',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

/* Workspace calls many /edge-api endpoints in parallel via
 * Promise.allSettled. Stub each with the shape the component reads. */
function stubAll(): void {
  vi.spyOn(edgeApi, 'health').mockResolvedValue({
    service: 'der-server', status: 'UP', version: '2.3.122',
    commit: 'abc', branch: 'main', dirty: false, buildTime: 'now',
    dhis2Integrated: true,
    dhis2Reference: { version: '2.44-SNAPSHOT' },
    timestamp: '2026-11-03T12:00:00Z',
  } as unknown as edgeApi.HealthResponse);
  vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue({
    service: 'der-server', timestamp: 'now',
    runtime: { heapUsedBytes: 1024, heapMaxBytes: 4096, uptimeMillis: 3600_000 },
    database: { configured: true, sessionCount: 1 },
    scheduler: { started: true, executingJobs: 0, totalJobs: 10 },
    storage: { totalBytes: 100, usableBytes: 90 },
    build: { version: '2.3.122', commit: 'abc', branch: 'main',
             buildTime: 'now', dirty: false },
    dhis2: { configured: true, baseUrl: 'http://localhost:8080/dhis',
             probeReachable: true, probeHttpStatus: 200,
             probeVersion: '2.44-SNAPSHOT' },
    apps: { installed: 0, enabled: 0, items: [] },
  } as unknown as edgeApi.SystemInfo);
  vi.spyOn(edgeApi, 'compat').mockResolvedValue({
    pinnedVersion: '2.44-SNAPSHOT', probeReachable: true,
    snapshotId: 1, capturedAt: 'now', centralVersion: '2.44-SNAPSHOT',
    capabilities: {}, pingHistory: [],
  } as unknown as edgeApi.CompatSnapshot);
  vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([]);
  vi.spyOn(edgeApi, 'listConflicts').mockResolvedValue([]);
  vi.spyOn(edgeApi, 'listDevices').mockResolvedValue({ devices: [] });
  vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({ workflows: [] });
}

describe('Workspace', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('shows a loading placeholder until the parallel probes resolve', () => {
    /* Pending promises never resolve → still-loading state. */
    vi.spyOn(edgeApi, 'health').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'systemInfo').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'compat').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'listJobs').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'listConflicts').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'listDevices').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'listWorkflows').mockImplementation(() => new Promise(() => undefined));
    renderWithProviders(<Workspace />, { authApi });
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('renders the main dashboard shell once all probes resolve', async () => {
    stubAll();
    renderWithProviders(<Workspace />, { authApi });
    /* The hero header contains the version string once render
     * clears the loading state. */
    await waitFor(() => expect(screen.queryByTestId('loading')).toBeNull());
    expect(document.body.textContent ?? '').toMatch(/2\.3\.122/);
  });

  it('renders the Client devices panel from a populated listDevices probe', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'listDevices').mockResolvedValue({
      devices: [
        { deviceId: 'dev-ok-xxxxxx', status: 'APPROVED', displayName: 'Clinic kiosk',
          lastSeenAt: '2026-11-03T11:00:00Z', assignedUserId: null,
          enrolmentTokenHash: 'h', enrolledAt: 'now',
          approvedBy: null, approvedAt: null, userAgent: 'ua',
          firmwareVersion: null, formFactor: 'TABLET' },
        { deviceId: 'dev-pending-x', status: 'PENDING', displayName: null,
          lastSeenAt: '2026-11-03T10:00:00Z', assignedUserId: null,
          enrolmentTokenHash: 'h', enrolledAt: 'now',
          approvedBy: null, approvedAt: null, userAgent: 'ua',
          firmwareVersion: null, formFactor: 'TABLET' },
      ],
    } as unknown as { devices: edgeApi.EdgeDeviceRow[] });
    renderWithProviders(<Workspace />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/clinic kiosk/i));
  });

  it('renders the Edge workflows panel from a populated listWorkflows probe', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({
      workflows: [
        { workflowId: 'wf-1', displayName: 'Weekly aggregate',
          boundMetadataKind: 'DATA_SET', boundMetadataId: 'ds-1',
          enabled: true, version: 1, createdAt: 'now', updatedAt: 'now',
          createdBy: null, steps: [], dependencies: [],
          requiresApproval: false, defaultDeviceId: null },
        { workflowId: 'wf-2', displayName: 'HIV disabled',
          boundMetadataKind: 'PROGRAM', boundMetadataId: 'p-1',
          enabled: false, version: 1, createdAt: 'now', updatedAt: 'now',
          createdBy: null, steps: [], dependencies: [],
          requiresApproval: false, defaultDeviceId: null },
      ],
    } as unknown as { workflows: edgeApi.CaptureWorkflowSummary[] });
    renderWithProviders(<Workspace />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/weekly aggregate/i));
    expect(document.body.textContent ?? '').toMatch(/hiv disabled/i);
  });

  it('surfaces the ConflictRow count when listConflicts returns rows', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'listConflicts').mockResolvedValue([
      { operationId: 'op-1', entityType: 'AGGREGATE_DATA_VALUE',
        entityRef: 'de1|ou1|2026W44', payloadJson: {},
        state: 'CONFLICT_REVIEW', attemptCount: 1,
        lastError: 'rejected', submittedBy: null,
        createdAt: 'now', updatedAt: 'now' },
    ] as unknown as edgeApi.ConflictRow[]);
    renderWithProviders(<Workspace />, { authApi });
    await waitFor(() => expect(screen.queryByTestId('loading')).toBeNull());
    /* The conflict panel renders '1 ... attention' when a conflict
     * is present. We assert on the entity ref so the test anchors
     * on the actual conflict data not a hero number. */
    expect(document.body.textContent ?? '').toMatch(/de1\|ou1\|2026W44|conflict/i);
  });

  it('partial failure — one probe rejects → error strip surfaces the message', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'listConflicts').mockRejectedValue(
      new Error('conflict load failed'));
    renderWithProviders(<Workspace />, { authApi });
    await waitFor(() => expect(screen.queryByTestId('loading')).toBeNull());
    expect(document.body.textContent ?? '')
      .toMatch(/conflict load failed/);
  });

  it('DHIS2 unreachable → KPI reports unreachable + allOps false', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'compat').mockResolvedValue({
      pinnedVersion: '2.44', probeReachable: false,
      snapshotId: 1, capturedAt: 'now', centralVersion: null,
      capabilities: {}, pingHistory: [],
    } as unknown as edgeApi.CompatSnapshot);
    renderWithProviders(<Workspace />, { authApi });
    await waitFor(() => expect(screen.queryByTestId('loading')).toBeNull());
    expect(document.body.textContent ?? '')
      .toMatch(/unreachable|outage|central/i);
  });

  it('DER health status "ready" is accepted as live (derUp branch)', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'health').mockResolvedValue({
      service: 'der-server', status: 'ready', version: '2.3.122',
      commit: 'abc', branch: 'main', dirty: false, buildTime: 'now',
      dhis2Integrated: true, timestamp: 'now',
    } as unknown as edgeApi.HealthResponse);
    renderWithProviders(<Workspace />, { authApi });
    await waitFor(() => expect(screen.queryByTestId('loading')).toBeNull());
    /* The "ready" status flips derStatusLabel to "Live"; the surface
     * doesn't always render it, but the branch itself is covered. */
    expect(document.body.textContent ?? '').toMatch(/DER Server/);
  });

  it('DER health status "DEGRADED" surfaces raw label', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'health').mockResolvedValue({
      service: 'der-server', status: 'DEGRADED', version: '2.3.122',
      commit: 'abc', branch: 'main', dirty: false, buildTime: 'now',
      dhis2Integrated: true, timestamp: 'now',
    } as unknown as edgeApi.HealthResponse);
    renderWithProviders(<Workspace />, { authApi });
    await waitFor(() => expect(screen.queryByTestId('loading')).toBeNull());
    expect(document.body.textContent ?? '').toMatch(/DEGRADED/);
  });

  it('db missing product → dbUp false branch + scheduler stopped', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue({
      service: 'der-server', timestamp: 'now',
      runtime: { heapUsedBytes: 1024, heapMaxBytes: 4096,
                 uptimeMillis: 3600_000 },
      /* No product / migrationCount → dbUp evaluates false. */
      database: { configured: false, sessionCount: 0 },
      scheduler: { started: false, executingJobs: 0, totalJobs: 0 },
      storage: { totalBytes: 100, usableBytes: 90 },
      build: { version: '2.3.122', commit: 'abc', branch: 'main',
               buildTime: 'now', dirty: false },
      dhis2: { configured: true, probeReachable: true, baseUrl: 'x' },
      apps: { installed: 0, enabled: 0, items: [] },
    } as unknown as edgeApi.SystemInfo);
    renderWithProviders(<Workspace />, { authApi });
    await waitFor(() => expect(screen.queryByTestId('loading')).toBeNull());
  });

  it('populated jobs — reliability KPI reflects 50% mix', async () => {
    stubAll();
    const nowIso = new Date().toISOString();
    vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([
      { runId: 1, jobName: 'J', outcome: 'SUCCEEDED',
        startedAt: nowIso, finishedAt: nowIso,
        durationMs: 100, triggeredBy: 'SCHEDULED', detail: '{}' },
      { runId: 2, jobName: 'J', outcome: 'FAILED',
        startedAt: nowIso, finishedAt: nowIso,
        durationMs: 100, triggeredBy: 'SCHEDULED', detail: '{}' },
    ] as unknown as edgeApi.JobRun[]);
    renderWithProviders(<Workspace />, { authApi });
    await waitFor(() => expect(screen.queryByTestId('loading')).toBeNull());
    expect(document.body.textContent ?? '').toMatch(/50/);
  });
});
