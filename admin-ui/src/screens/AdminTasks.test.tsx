import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { MockupAdminTasks } from './AdminTasks';
import * as edgeApi from '../api/edgeApi';
import type { LifecycleAck, LifecycleLogs, SystemInfo } from '../api/edgeApi';

const authApi = {
  session: vi.fn().mockResolvedValue({
    userId: 'u1', username: 'admin', displayName: 'Admin',
    roles: ['ADMIN'], expiresAt: '2027-01-01T00:00:00Z',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

/* AdminTasks reads a surprising number of fields off SystemInfo:
 * uptimeMillis, heap bytes, scheduler.started/executingJobs/totalJobs,
 * database.sessionCount. The fixture covers all of them. */
function systemInfoFixture(): SystemInfo {
  return {
    runtime: { uptimeMillis: 3600_000, heapUsedBytes: 1024, heapMaxBytes: 4096 },
    database: { configured: true, sessionCount: 5 },
    scheduler: { started: true, executingJobs: 0, totalJobs: 10 },
  } as unknown as SystemInfo;
}

describe('MockupAdminTasks', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('shows LoadingBlock before systemInfo resolves', () => {
    vi.spyOn(edgeApi, 'systemInfo').mockImplementation(
      () => new Promise(() => undefined /* never resolves */));
    renderWithProviders(<MockupAdminTasks />, { authApi });
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('renders Service control + Sessions + Configuration panels after load', async () => {
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(systemInfoFixture());
    renderWithProviders(<MockupAdminTasks />, { authApi });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^shut down$/i }))
        .toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^restart$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^clear all sessions$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^reload dhis2 config$/i })).toBeInTheDocument();
  });

  it('stays on LoadingBlock when systemInfo rejects', async () => {
    vi.spyOn(edgeApi, 'systemInfo').mockRejectedValue(new Error('EDGE_UNREACHABLE'));
    renderWithProviders(<MockupAdminTasks />, { authApi });
    /* AdminTasks guards 'if (!si) return <LoadingBlock>'. A load
     * failure sets err but leaves si null, so LoadingBlock stays
     * — the ErrorBlock in the main body is reserved for ACTION
     * failures (shutdown, restart, etc.). */
    await Promise.resolve();
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('Shutdown opens a confirm panel and dispatches adminShutdown on confirm', async () => {
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(systemInfoFixture());
    const shutdown = vi.spyOn(edgeApi, 'adminShutdown').mockResolvedValue(
      { status: 'ACCEPTED', effect: 'SHUTDOWN_SCHEDULED' } as unknown as LifecycleAck);
    renderWithProviders(<MockupAdminTasks />, { authApi });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^shut down$/i }));
    const confirmBtn = await screen.findByRole('button',
      { name: /yes, shut down der/i });
    await user.click(confirmBtn);
    await waitFor(() => expect(shutdown).toHaveBeenCalledTimes(1));
  });

  it('Restart opens its own confirm panel and dispatches adminRestart', async () => {
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(systemInfoFixture());
    const restart = vi.spyOn(edgeApi, 'adminRestart').mockResolvedValue(
      { status: 'ACCEPTED', effect: 'RESTART_SCHEDULED' } as unknown as LifecycleAck);
    renderWithProviders(<MockupAdminTasks />, { authApi });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^restart$/i }));
    await user.click(await screen.findByRole('button', { name: /yes, restart der/i }));
    await waitFor(() => expect(restart).toHaveBeenCalledTimes(1));
  });

  it('Clear sessions requires a confirm click and dispatches adminClearSessions', async () => {
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(systemInfoFixture());
    const clear = vi.spyOn(edgeApi, 'adminClearSessions').mockResolvedValue(
      { status: 'ACCEPTED', effect: 'SESSIONS_CLEARED' } as unknown as LifecycleAck);
    renderWithProviders(<MockupAdminTasks />, { authApi });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^clear all sessions$/i }));
    await user.click(await screen.findByRole('button', { name: /yes, revoke all sessions/i }));
    await waitFor(() => expect(clear).toHaveBeenCalledTimes(1));
  });

  it('Reload DHIS2 config dispatches adminReloadDhis2Config without a confirm', async () => {
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(systemInfoFixture());
    const reload = vi.spyOn(edgeApi, 'adminReloadDhis2Config').mockResolvedValue(
      { status: 'ACCEPTED', effect: 'CONFIG_RELOADED' } as unknown as LifecycleAck);
    renderWithProviders(<MockupAdminTasks />, { authApi });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^reload dhis2 config$/i }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('Load tails adminLogs and renders the entries', async () => {
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(systemInfoFixture());
    vi.spyOn(edgeApi, 'adminLogs').mockResolvedValue({
      status: 'OK',
      path: '/var/log/der.log',
      entries: ['[INFO] boot complete', '[WARN] slow drain'],
      totalLines: 2,
    } as unknown as LifecycleLogs);
    renderWithProviders(<MockupAdminTasks />, { authApi });
    const user = userEvent.setup();
    const loadBtn = await screen.findByRole('button', { name: /^load$/i });
    await user.click(loadBtn);
    expect(await screen.findByLabelText('server log tail'))
      .toHaveTextContent('boot complete');
  });
});
