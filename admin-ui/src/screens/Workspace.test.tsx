import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { MockupWorkspace } from './Workspace';
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

describe('MockupWorkspace', () => {
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
    renderWithProviders(<MockupWorkspace />, { authApi });
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('renders the main dashboard shell once all probes resolve', async () => {
    stubAll();
    renderWithProviders(<MockupWorkspace />, { authApi });
    /* The hero header contains the version string once render
     * clears the loading state. */
    await waitFor(() => expect(screen.queryByTestId('loading')).toBeNull());
    expect(document.body.textContent ?? '').toMatch(/2\.3\.122/);
  });
});
