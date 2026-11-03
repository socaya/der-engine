import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { MockupSystemInformation } from './SystemInformation';
import * as edgeApi from '../api/edgeApi';
import type { SystemInfo } from '../api/edgeApi';

const authApi = {
  session: vi.fn().mockResolvedValue({
    userId: 'u1', username: 'admin', displayName: 'A',
    roles: ['ADMIN'], expiresAt: '2027-01-01T00:00:00Z',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

function systemInfoFixture(): SystemInfo {
  return {
    service: 'der-server',
    timestamp: '2026-11-03T12:00:00Z',
    build: { version: '2.3.122', commit: 'abc1234', branch: 'main',
             buildTime: '2026-11-03T06:00:00Z', dirty: false },
    runtime: { heapUsedBytes: 1024 * 1024, heapMaxBytes: 4 * 1024 * 1024,
               uptimeMillis: 3600_000, jvm: 'OpenJDK',
               javaVersion: '21', javaVendor: 'OpenJDK',
               osName: 'macOS', osArch: 'arm64',
               hostname: 'der-dev', availableProcessors: 8,
               jvmStartTimeMillis: Date.parse('2026-11-03T11:00:00Z') },
    database: { configured: true, probeError: null, probeTimeMs: 2,
                url: 'jdbc:postgresql://localhost', username: 'der',
                sessionCount: 3, product: 'PostgreSQL',
                flywayVersion: '10.17.0', migrationCount: 85, userCount: 4 },
    scheduler: { name: 'DerSched', started: true, standbyMode: false,
                 threadCount: 4, jobCount: 10, triggerCount: 10,
                 executingJobs: 0, totalJobs: 10, probeError: null },
    storage: { totalBytes: 100 * 1024 * 1024, usableBytes: 90 * 1024 * 1024,
               warnBytes: 10 * 1024 * 1024, root: '/', status: 'OK' },
    dhis2: { configured: true, baseUrl: 'http://localhost:8080/dhis',
             probeReachable: true, probeHttpStatus: 200,
             probeVersion: '2.44-SNAPSHOT' },
    apps: { installed: 0, enabled: 0, items: [] },
  } as unknown as SystemInfo;
}

describe('MockupSystemInformation', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('shows LoadingBlock before the probe resolves', () => {
    vi.spyOn(edgeApi, 'systemInfo').mockImplementation(
      () => new Promise(() => undefined));
    renderWithProviders(<MockupSystemInformation />, { authApi });
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('shows ErrorBlock with the message when systemInfo rejects', async () => {
    vi.spyOn(edgeApi, 'systemInfo').mockRejectedValue(new Error('boom'));
    renderWithProviders(<MockupSystemInformation />, { authApi });
    await waitFor(() => expect(screen.getByTestId('err-sysinfo'))
      .toBeInTheDocument());
    expect(screen.getByTestId('err-sysinfo')).toHaveTextContent(/boom/);
  });

  it('renders the status strip with the healthy label when all probes are up', async () => {
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(systemInfoFixture());
    renderWithProviders(<MockupSystemInformation />, { authApi });
    await waitFor(() => expect(screen.getByText(/all subsystems healthy/i))
      .toBeInTheDocument());
  });

  it('renders a Degraded label when DHIS2 is unreachable', async () => {
    const si = systemInfoFixture();
    (si.dhis2 as unknown as { probeReachable: boolean }).probeReachable = false;
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(si);
    renderWithProviders(<MockupSystemInformation />, { authApi });
    await waitFor(() => expect(screen.getByText(/degraded subsystem/i))
      .toBeInTheDocument());
  });
});
