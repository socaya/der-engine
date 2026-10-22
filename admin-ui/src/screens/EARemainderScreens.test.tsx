import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import {
  EARecoveryTools, EABackupList, EARestoreList, EAEvaluationReports,
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
    renderWithProviders(<EARecoveryTools api={api as never} />);
    await userEvent.click(screen.getByTestId('ea19-metadata-resync'));
    await waitFor(() => expect(screen.getByTestId('ea19-error')).toBeInTheDocument());
  });
});

describe('EA-23 BackupList', () => {
  it('lists and requests', async () => {
    const api = {
      listBackups: vi.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ runId: 1, requestedAt: 'now', kind: 'AUDIT' as const,
          status: 'REQUESTED' as const }]),
      requestBackup: vi.fn().mockResolvedValue({ runId: 1, requestedAt: 'now',
        kind: 'AUDIT', status: 'REQUESTED' }),
    };
    renderWithProviders(<EABackupList api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('ea23-empty')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('ea23-request-audit'));
    await waitFor(() => expect(screen.getByTestId('ea23-row-1')).toBeInTheDocument());
  });
  it('request full', async () => {
    const api = {
      listBackups: vi.fn().mockResolvedValue([]),
      requestBackup: vi.fn().mockResolvedValue({ runId: 2, requestedAt: 'now',
        kind: 'FULL', status: 'REQUESTED' }),
    };
    renderWithProviders(<EABackupList api={api as never} />);
    await userEvent.click(await screen.findByTestId('ea23-request-full'));
    expect(api.requestBackup).toHaveBeenCalledWith('FULL');
  });
  it('error on load', async () => {
    renderWithProviders(<EABackupList api={{
      listBackups: vi.fn().mockRejectedValue('x'),
      requestBackup: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea23-error')).toBeInTheDocument());
  });
  it('error on request', async () => {
    const api = {
      listBackups: vi.fn().mockResolvedValue([]),
      requestBackup: vi.fn().mockRejectedValue(new Error('nope')),
    };
    renderWithProviders(<EABackupList api={api as never} />);
    await userEvent.click(await screen.findByTestId('ea23-request-audit'));
    await waitFor(() => expect(screen.getByTestId('ea23-error')).toBeInTheDocument());
  });
});

describe('EA-25 RestoreList', () => {
  it('requests restore', async () => {
    const api = {
      listRestores: vi.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ runId: 5, requestedAt: 'now', source: 's3://x',
          status: 'REQUESTED' as const }]),
      requestRestore: vi.fn().mockResolvedValue({ runId: 5, requestedAt: 'now',
        source: 's3://x', status: 'REQUESTED' }),
    };
    renderWithProviders(<EARestoreList api={api as never} />);
    await userEvent.type(await screen.findByTestId('ea25-source'), 's3://x');
    await userEvent.click(screen.getByTestId('ea25-request'));
    await waitFor(() => expect(screen.getByTestId('ea25-row-5')).toBeInTheDocument());
  });
  it('error on load', async () => {
    renderWithProviders(<EARestoreList api={{
      listRestores: vi.fn().mockRejectedValue('x'),
      requestRestore: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea25-error')).toBeInTheDocument());
  });
  it('error on request', async () => {
    renderWithProviders(<EARestoreList api={{
      listRestores: vi.fn().mockResolvedValue([]),
      requestRestore: vi.fn().mockRejectedValue(new Error('x')),
    } as never} />);
    await userEvent.type(await screen.findByTestId('ea25-source'), 's');
    await userEvent.click(screen.getByTestId('ea25-request'));
    await waitFor(() => expect(screen.getByTestId('ea25-error')).toBeInTheDocument());
  });
});

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
      listApps: vi.fn()
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
      listApps: vi.fn().mockRejectedValue('x'),
      setAppEnabled: vi.fn(), uninstallApp: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea31-error')).toBeInTheDocument());
  });
  it('error on toggle', async () => {
    const api = {
      listApps: vi.fn().mockResolvedValue([{ appId: 'a', appKey: 'k', version: '1',
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
      listApps: vi.fn().mockResolvedValue([{ appId: 'a', appKey: 'k', version: '1',
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
    expect(screen.getByTestId('ea35-journal-PENDING')).toHaveTextContent('PENDING: 3');
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
