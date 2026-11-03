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

  it('adminLogs NO_LOG_FILE status surfaces the no-file hint', async () => {
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(systemInfoFixture());
    vi.spyOn(edgeApi, 'adminLogs').mockResolvedValue({
      status: 'NO_LOG_FILE',
      path: '/var/log/missing.log',
      entries: [], totalLines: 0,
    } as unknown as LifecycleLogs);
    renderWithProviders(<MockupAdminTasks />, { authApi });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^load$/i }));
    await waitFor(() =>
      expect(screen.getByText(/No log file at/)).toBeInTheDocument());
    expect(document.body.textContent ?? '').toMatch(/missing\.log/);
  });

  it('adminLogs error status surfaces path + error message', async () => {
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(systemInfoFixture());
    vi.spyOn(edgeApi, 'adminLogs').mockResolvedValue({
      status: 'IO_ERROR',
      path: '/var/log/der.log',
      error: 'Permission denied',
      entries: [], totalLines: 0,
    } as unknown as LifecycleLogs);
    renderWithProviders(<MockupAdminTasks />, { authApi });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^load$/i }));
    await waitFor(() =>
      expect(screen.getByText(/Could not read/)).toBeInTheDocument());
    expect(document.body.textContent ?? '').toMatch(/Permission denied/);
  });

  it('adminLogs rejection surfaces the error block', async () => {
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(systemInfoFixture());
    vi.spyOn(edgeApi, 'adminLogs').mockRejectedValue(
      new Error('log fetch denied'));
    renderWithProviders(<MockupAdminTasks />, { authApi });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^load$/i }));
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/log fetch denied/));
  });

  it('Shutdown connection-drop (EDGE_UNREACHABLE) → "process is exiting" hint', async () => {
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(systemInfoFixture());
    vi.spyOn(edgeApi, 'adminShutdown').mockRejectedValue(
      new Error('EDGE_UNREACHABLE: socket closed'));
    renderWithProviders(<MockupAdminTasks />, { authApi });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^shut down$/i }));
    await user.click(await screen.findByRole('button',
      { name: /yes, shut down der/i }));
    await waitFor(() =>
      expect(document.body.textContent ?? '')
        .toMatch(/process is exiting/));
  });

  it('Shutdown generic error surfaces the error inline', async () => {
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(systemInfoFixture());
    vi.spyOn(edgeApi, 'adminShutdown').mockRejectedValue(
      new Error('generic shutdown error'));
    renderWithProviders(<MockupAdminTasks />, { authApi });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^shut down$/i }));
    await user.click(await screen.findByRole('button',
      { name: /yes, shut down der/i }));
    await waitFor(() =>
      expect(document.body.textContent ?? '')
        .toMatch(/generic shutdown error/));
  });
});
