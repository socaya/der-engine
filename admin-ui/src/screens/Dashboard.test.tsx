import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { MockupDashboard } from './Dashboard';
import * as edgeApi from '../api/edgeApi';

const authApi = {
  session: vi.fn().mockResolvedValue({
    userId: 'u1', username: 'admin', displayName: 'Admin',
    roles: ['ADMIN'], expiresAt: '2027-01-01T00:00:00Z',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

function healthFixture(): edgeApi.HealthResponse {
  return {
    service: 'der-server', status: 'UP', version: '2.3.122',
    commit: 'abc', branch: 'main', dirty: false, buildTime: 'now',
    dhis2Integrated: true,
    dhis2Reference: { version: '2.44-SNAPSHOT' },
    timestamp: '2026-11-03T12:00:00Z',
  } as unknown as edgeApi.HealthResponse;
}

function systemInfoFixture(): edgeApi.SystemInfo {
  return {
    runtime: { heapUsedBytes: 1024, heapMaxBytes: 4096, uptimeMillis: 3600_000 },
    database: { configured: true, sessionCount: 1 },
    scheduler: { started: true, executingJobs: 0, totalJobs: 10 },
    storage: { totalBytes: 100, usableBytes: 90 },
    dhis2: { configured: true, probeReachable: true,
             probeVersion: '2.44-SNAPSHOT', baseUrl: 'x' },
    build: { version: '2.3.122', commit: 'a', branch: 'main',
             buildTime: 'now', dirty: false },
    apps: { installed: 0, enabled: 0, items: [] },
  } as unknown as edgeApi.SystemInfo;
}

function stubAll(): void {
  vi.spyOn(edgeApi, 'health').mockResolvedValue(healthFixture());
  vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(systemInfoFixture());
  vi.spyOn(edgeApi, 'compat').mockResolvedValue({
    pinnedVersion: '2.44-SNAPSHOT', probeReachable: true, snapshotId: 1,
    capturedAt: 'now', centralVersion: '2.44-SNAPSHOT',
    capabilities: {}, pingHistory: [],
  } as unknown as edgeApi.CompatSnapshot);
  vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([]);
  vi.spyOn(edgeApi, 'listConflicts').mockResolvedValue([]);
  vi.spyOn(edgeApi, 'recentActivity').mockResolvedValue({ entries: [] });
  vi.spyOn(edgeApi, 'listDevices').mockResolvedValue({ devices: [] });
  vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({ workflows: [] });
  vi.spyOn(edgeApi, 'scopeAudit').mockResolvedValue({
    scope: { kind: 'ADMIN_UNRESTRICTED', orgUnitIds: [] },
    scopeFingerprint: 'f', takenAt: 'now',
    sample: [], mismatches: [],
    mismatchCount: 0, outOfScopeCount: 0, sampleSize: 0,
    total: 0,
    countsByEntityType: {},
    countsByState: {},
  } as unknown as edgeApi.ScopeAuditSnapshot);
}

describe('MockupDashboard', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('renders a loading placeholder before probes resolve', () => {
    vi.spyOn(edgeApi, 'health').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'systemInfo').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'compat').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'listJobs').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'listConflicts').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'recentActivity').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'listDevices').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'listWorkflows').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'scopeAudit').mockImplementation(() => new Promise(() => undefined));
    renderWithProviders(<MockupDashboard />, { authApi });
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('clears loading once all parallel probes resolve', async () => {
    stubAll();
    renderWithProviders(<MockupDashboard />, { authApi });
    await waitFor(() => expect(screen.queryByTestId('loading')).toBeNull());
  });

  it('renders version text in the rendered body', async () => {
    stubAll();
    renderWithProviders(<MockupDashboard />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/2\.3\.122/));
  });
});
