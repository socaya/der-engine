import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { SystemInformation } from './SystemInformation';
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

describe('SystemInformation', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('shows LoadingBlock before the probe resolves', () => {
    vi.spyOn(edgeApi, 'systemInfo').mockImplementation(
      () => new Promise(() => undefined));
    renderWithProviders(<SystemInformation />, { authApi });
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('shows ErrorBlock with the message when systemInfo rejects', async () => {
    vi.spyOn(edgeApi, 'systemInfo').mockRejectedValue(new Error('boom'));
    renderWithProviders(<SystemInformation />, { authApi });
    await waitFor(() => expect(screen.getByTestId('err-sysinfo'))
      .toBeInTheDocument());
    expect(screen.getByTestId('err-sysinfo')).toHaveTextContent(/boom/);
  });

  it('renders the status strip with the healthy label when all probes are up', async () => {
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(systemInfoFixture());
    renderWithProviders(<SystemInformation />, { authApi });
    await waitFor(() => expect(screen.getByText(/all subsystems healthy/i))
      .toBeInTheDocument());
  });

  it('renders a Degraded label when DHIS2 is unreachable', async () => {
    const si = systemInfoFixture();
    (si.dhis2 as unknown as { probeReachable: boolean }).probeReachable = false;
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(si);
    renderWithProviders(<SystemInformation />, { authApi });
    await waitFor(() => expect(screen.getByText(/degraded subsystem/i))
      .toBeInTheDocument());
  });

  it('database down (probeError set) flips Database to FAIL', async () => {
    const si = systemInfoFixture();
    (si.database as unknown as { probeError: string }).probeError = 'ECONNREFUSED';
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(si);
    renderWithProviders(<SystemInformation />, { authApi });
    await waitFor(() => expect(screen.getByText('FAIL')).toBeInTheDocument());
    /* probeError value surfaces in the Database panel. */
    expect(screen.getByText('ECONNREFUSED')).toBeInTheDocument();
  });

  it('scheduler stopped flips Started=no + Standby=yes branches', async () => {
    const si = systemInfoFixture();
    (si.scheduler as unknown as { started: boolean }).started = false;
    (si.scheduler as unknown as { standbyMode: boolean }).standbyMode = true;
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(si);
    renderWithProviders(<SystemInformation />, { authApi });
    await waitFor(() => expect(screen.getByText(/degraded subsystem/i))
      .toBeInTheDocument());
    /* "yes"/"no" strings surface in Scheduler panel. */
    expect(document.body.textContent ?? '').toMatch(/Started/);
    expect(document.body.textContent ?? '').toMatch(/Standby/);
  });

  it('storage ≥85% full triggers the danger-tone progress bar', async () => {
    const si = systemInfoFixture();
    (si.storage as unknown as { totalBytes: number; usableBytes: number })
      .totalBytes = 100;
    (si.storage as unknown as { totalBytes: number; usableBytes: number })
      .usableBytes = 10;  /* 90% used → >85 danger */
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(si);
    renderWithProviders(<SystemInformation />, { authApi });
    await waitFor(() => expect(screen.getByText(/Space used/))
      .toBeInTheDocument());
    expect(document.body.textContent ?? '').toMatch(/90%/);
  });

  it('storage 70-85% full triggers warning tone', async () => {
    const si = systemInfoFixture();
    (si.storage as unknown as { totalBytes: number; usableBytes: number })
      .totalBytes = 100;
    (si.storage as unknown as { totalBytes: number; usableBytes: number })
      .usableBytes = 20;  /* 80% used → warning */
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(si);
    renderWithProviders(<SystemInformation />, { authApi });
    await waitFor(() => expect(screen.getByText(/Space used/))
      .toBeInTheDocument());
    expect(document.body.textContent ?? '').toMatch(/80%/);
  });

  it('build-dirty branch — "yes" surfaces in Build & release', async () => {
    const si = systemInfoFixture();
    (si.build as unknown as { dirty: boolean }).dirty = true;
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(si);
    renderWithProviders(<SystemInformation />, { authApi });
    await waitFor(() => expect(screen.getByText(/Working tree dirty/))
      .toBeInTheDocument());
  });

  it('journal populated → KvGrid rows surface per state', async () => {
    const si = systemInfoFixture();
    (si as unknown as { journal: Record<string, number> }).journal = {
      pending: 5, in_flight: 2, central_accepted: 42,
    };
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(si);
    renderWithProviders(<SystemInformation />, { authApi });
    await waitFor(() => expect(screen.getByText('pending')).toBeInTheDocument());
    expect(screen.getByText('in_flight')).toBeInTheDocument();
    expect(screen.getByText('central_accepted')).toBeInTheDocument();
  });

  it('journal empty → "Journal is empty." fallback', async () => {
    const si = systemInfoFixture();
    (si as unknown as { journal: Record<string, number> }).journal = {};
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(si);
    renderWithProviders(<SystemInformation />, { authApi });
    await waitFor(() => expect(screen.getByText('Journal is empty.'))
      .toBeInTheDocument());
  });

  it('custom apps populated → table rows render per app', async () => {
    const si = systemInfoFixture();
    (si.apps as unknown as {
      installed: number; enabled: number;
      items: Array<{ key: string; name: string; version: string; enabled: boolean }>;
    }) = {
      installed: 2, enabled: 1,
      items: [
        { key: 'app-x', name: 'App X', version: '1.0.0', enabled: true },
        { key: 'app-y', name: 'App Y', version: '0.5.0', enabled: false },
      ],
    };
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(si);
    renderWithProviders(<SystemInformation />, { authApi });
    await waitFor(() => expect(screen.getByText('App X')).toBeInTheDocument());
    expect(screen.getByText('App Y')).toBeInTheDocument();
    expect(screen.getByText('app-x')).toBeInTheDocument();
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
  });

  it('attribution panel surfaces when attribution object is present', async () => {
    const si = systemInfoFixture();
    (si as unknown as {
      attribution: { configured: boolean; mappedUsers: number };
    }).attribution = { configured: true, mappedUsers: 7 };
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(si);
    renderWithProviders(<SystemInformation />, { authApi });
    await waitFor(() => expect(screen.getByText(/User attribution/))
      .toBeInTheDocument());
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('null/undefined optional fields fall back to em-dashes without crashing', async () => {
    const si = systemInfoFixture();
    /* Blow out all nullable fields to the fallback paths. */
    (si.runtime as unknown as {
      javaVendor: string | null; javaVersion: string | null;
      osName: string | null; osArch: string | null; hostname: string | null;
      availableProcessors: number | null; jvmStartTimeMillis: number | null;
    }) = {
      javaVendor: null, javaVersion: null, osName: null, osArch: null,
      hostname: null, availableProcessors: null, jvmStartTimeMillis: null,
    };
    (si.database as unknown as {
      product: string | null; flywayVersion: string | null;
      migrationCount: number | null; userCount: number | null;
      sessionCount: number | null; probeError: string | null;
      configured: boolean;
    }) = {
      product: null, flywayVersion: null, migrationCount: null,
      userCount: null, sessionCount: null, probeError: null,
      configured: true,
    };
    (si.scheduler as unknown as {
      name: string | null; started: boolean; standbyMode: boolean;
      executingJobs: number | null; totalJobs: number | null;
      probeError: string | null;
    }) = {
      name: null, started: true, standbyMode: false,
      executingJobs: null, totalJobs: null, probeError: null,
    };
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(si);
    renderWithProviders(<SystemInformation />, { authApi });
    await waitFor(() => expect(screen.getByText(/All subsystems healthy/i))
      .toBeInTheDocument());
    /* Multiple em-dashes surface across the nulled fields. */
    expect(screen.getAllByText('—').length).toBeGreaterThan(5);
  });
});
