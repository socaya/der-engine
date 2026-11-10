import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import {
  EARecoveryTools, EAEvaluationReports,
  EAAppsList, EADiagnostics, EASettings,
} from './EARemainderScreens';

afterEach(() => vi.restoreAllMocks());

describe('EA-19 RecoveryTools', () => {
  it('runs each action', async () => {
    const api = {
      triggerJob: vi.fn().mockResolvedValue({ triggered: 'METADATA_SYNC_FULL' }),
      drift: vi.fn().mockResolvedValue({}),
      listConflicts: vi.fn().mockResolvedValue([]),
    };
    // The metadata resync is gated by confirmThenRun (destructive op).
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithProviders(<EARecoveryTools api={api as never} />);
    await userEvent.click(screen.getByTestId('ea19-metadata-resync'));
    await waitFor(() => expect(screen.getByTestId('ea19-metadata-status'))
      .toHaveTextContent('done'));
    await userEvent.click(screen.getByTestId('ea19-drift-refresh'));
    await waitFor(() => expect(screen.getByTestId('ea19-drift-status'))
      .toHaveTextContent('done'));
    await userEvent.click(screen.getByTestId('ea19-conflicts-refresh'));
    await waitFor(() => expect(screen.getByTestId('ea19-conflicts-status'))
      .toHaveTextContent('done'));
  });
  it('error path', async () => {
    const api = {
      triggerJob: vi.fn().mockRejectedValue(new Error('bad')),
      drift: vi.fn(),
      listConflicts: vi.fn(),
    };
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithProviders(<EARecoveryTools api={api as never} />);
    await userEvent.click(screen.getByTestId('ea19-metadata-resync'));
    await waitFor(() => expect(screen.getByTestId('ea19-error')).toBeInTheDocument());
    /* Status chip flips to Error tone. */
    expect(screen.getByTestId('ea19-metadata-status-chip')).toHaveTextContent('Error');
  });

  it('metadata-resync confirm declined is a no-op', async () => {
    const api = {
      triggerJob: vi.fn(),
      drift: vi.fn(),
      listConflicts: vi.fn(),
    };
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWithProviders(<EARecoveryTools api={api as never} />);
    await userEvent.click(screen.getByTestId('ea19-metadata-resync'));
    expect(api.triggerJob).not.toHaveBeenCalled();
    expect(screen.getByTestId('ea19-metadata-status-chip')).toHaveTextContent('Idle');
  });

  it('drift run populates a last-run timestamp', async () => {
    const api = {
      triggerJob: vi.fn(),
      drift: vi.fn().mockResolvedValue({}),
      listConflicts: vi.fn(),
    };
    renderWithProviders(<EARecoveryTools api={api as never} />);
    await userEvent.click(screen.getByTestId('ea19-drift-refresh'));
    await waitFor(() =>
      expect(screen.getByTestId('ea19-drift-last-run')).toBeInTheDocument());
  });
});

/* EA-23 BackupList and EA-25 RestoreList stubs removed with the EA-30/31
 * overhaul; the canonical screens (BackupList / RestoreList
 * in MoreScreens.tsx) are covered by MoreScreens.test.tsx. */

describe('EA-27 EvaluationReports', () => {
  it('aggregates outcomes + backlog', async () => {
    renderWithProviders(<EAEvaluationReports api={{
      listJobs: vi.fn().mockResolvedValue([
        { runId: 1, jobName: 'J', startedAt: 'n', finishedAt: null, outcome: 'SUCCESS',
          durationMs: null, detail: null, triggeredBy: 'x' },
        { runId: 2, jobName: 'J', startedAt: 'n', finishedAt: null, outcome: 'SUCCESS',
          durationMs: null, detail: null, triggeredBy: 'x' },
        { runId: 3, jobName: 'J', startedAt: 'n', finishedAt: null, outcome: 'FAILED',
          durationMs: null, detail: null, triggeredBy: 'x' },
      ]),
      workerHealth: vi.fn().mockResolvedValue({ enabled: true, lastTick: null,
        lastBatchSize: 0, backlog: { PENDING: 5, IN_FLIGHT: 1 } }),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea27-outcome-SUCCESS'))
      .toHaveTextContent('SUCCESS: 2'));
    expect(screen.getByTestId('ea27-outcome-FAILED')).toHaveTextContent('FAILED: 1');
    expect(screen.getByTestId('ea27-backlog-PENDING')).toHaveTextContent('PENDING: 5');
  });
  it('error', async () => {
    renderWithProviders(<EAEvaluationReports api={{
      listJobs: vi.fn().mockRejectedValue(new Error('x')),
      workerHealth: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea27-error')).toBeInTheDocument());
  });
});

describe('EA-31 AppsList', () => {
  it('toggle and uninstall', async () => {
    const api = {
      listInstalledApps: vi.fn()
        .mockResolvedValueOnce([{ appId: 'a1', appKey: 'k', version: '1', displayName: 'App',
          enabled: true, installedAt: 'now' }])
        .mockResolvedValueOnce([{ appId: 'a1', appKey: 'k', version: '1', displayName: 'App',
          enabled: false, installedAt: 'now' }])
        .mockResolvedValueOnce([]),
      setAppEnabled: vi.fn().mockResolvedValue({}),
      uninstallApp: vi.fn().mockResolvedValue(undefined),
    };
    renderWithProviders(<EAAppsList api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('ea31-app-a1')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('ea31-toggle-a1'));
    await waitFor(() => expect(screen.getByTestId('ea31-state-a1')).toHaveTextContent('disabled'));
    await userEvent.click(screen.getByTestId('ea31-delete-a1'));
    await waitFor(() => expect(screen.getByTestId('ea31-empty')).toBeInTheDocument());
  });
  it('error on list', async () => {
    renderWithProviders(<EAAppsList api={{
      listInstalledApps: vi.fn().mockRejectedValue('x'),
      setAppEnabled: vi.fn(), uninstallApp: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea31-error')).toBeInTheDocument());
  });
  it('error on toggle', async () => {
    const api = {
      listInstalledApps: vi.fn().mockResolvedValue([{ appId: 'a', appKey: 'k', version: '1',
        displayName: 'A', enabled: true, installedAt: 'now' }]),
      setAppEnabled: vi.fn().mockRejectedValue(new Error('e')),
      uninstallApp: vi.fn(),
    };
    renderWithProviders(<EAAppsList api={api as never} />);
    await userEvent.click(await screen.findByTestId('ea31-toggle-a'));
    await waitFor(() => expect(screen.getByTestId('ea31-error')).toBeInTheDocument());
  });
  it('error on delete', async () => {
    const api = {
      listInstalledApps: vi.fn().mockResolvedValue([{ appId: 'a', appKey: 'k', version: '1',
        displayName: 'A', enabled: true, installedAt: 'now' }]),
      setAppEnabled: vi.fn(),
      uninstallApp: vi.fn().mockRejectedValue('e'),
    };
    renderWithProviders(<EAAppsList api={api as never} />);
    await userEvent.click(await screen.findByTestId('ea31-delete-a'));
    await waitFor(() => expect(screen.getByTestId('ea31-error')).toBeInTheDocument());
  });
});

describe('EA-35 Diagnostics', () => {
  it('renders values', async () => {
    renderWithProviders(<EADiagnostics api={{
      diagnostics: vi.fn().mockResolvedValue({ memoryMb: 512, uptimeSeconds: 3600,
        schedulerBacklog: 2, journalBacklog: { PENDING: 3 } }),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea35-mem')).toHaveTextContent('512'));
    /* Journal row now splits state (Status chip) and count (mono td);
     * match either substring individually. */
    const journalRow = screen.getByTestId('ea35-journal-PENDING');
    expect(journalRow).toHaveTextContent('PENDING');
    expect(journalRow).toHaveTextContent('3');
  });
  it('error', async () => {
    renderWithProviders(<EADiagnostics api={{
      diagnostics: vi.fn().mockRejectedValue('x'),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea35-error')).toBeInTheDocument());
  });
});

describe('EA-36 Settings', () => {
  it('edits + saves', async () => {
    const settings = {
      cron: { 'der.sync.metadata.cron': '0 0 */4 * * ?' },
      featureFlags: { strictRules: true },
      roles: ['ADMIN', 'OPERATOR'],
    };
    const api = {
      readSettings: vi.fn().mockResolvedValue(settings),
      saveSettings: vi.fn().mockResolvedValue(settings),
    };
    renderWithProviders(<EASettings api={api as never} />);
    await waitFor(() => expect(
      screen.getByTestId('ea36-cron-der.sync.metadata.cron')).toBeInTheDocument());
    await userEvent.clear(screen.getByTestId('ea36-cron-der.sync.metadata.cron'));
    await userEvent.type(screen.getByTestId('ea36-cron-der.sync.metadata.cron'), '0 */5 * * * ?');
    await userEvent.click(screen.getByTestId('ea36-flag-strictRules'));
    await userEvent.click(screen.getByTestId('ea36-save'));
    await waitFor(() => expect(screen.getByTestId('ea36-saved')).toBeInTheDocument());
  });
  it('load error', async () => {
    renderWithProviders(<EASettings api={{
      readSettings: vi.fn().mockRejectedValue('x'),
      saveSettings: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea36-error')).toBeInTheDocument());
  });
  it('save error', async () => {
    const api = {
      readSettings: vi.fn().mockResolvedValue({ cron: {}, featureFlags: {}, roles: [] }),
      saveSettings: vi.fn().mockRejectedValue(new Error('x')),
    };
    renderWithProviders(<EASettings api={api as never} />);
    await userEvent.click(await screen.findByTestId('ea36-save'));
    await waitFor(() => expect(screen.getByTestId('ea36-save-error')).toBeInTheDocument());
  });
});
