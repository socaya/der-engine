import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import {
  EASetupWelcome, EAUsersList, EAUserCreate, EACompatInspector, EACompatHistory,
  EAJobsList, EAJobTrigger, EADriftInspector, EAConflictList, EAConflictResolve,
  EAWorkerHealth, EAMetadataOverview,
} from './EACoreScreens';

afterEach(() => vi.restoreAllMocks());

const health = (ok = true) => ({
  service: 's', status: 'ok', version: '0',
  dhis2Integrated: ok, dhis2Reference: { version: '2.44' }, timestamp: 'n',
});

const compatSnap = {
  status: 'OK', profileName: 'V2_44', centralVersion: '2.44', probeReachable: true,
  capabilities: {},
};

describe('EA-01 SetupWelcome', () => {
  it('renders', async () => {
    const api = { health: vi.fn().mockResolvedValue(health()),
                  compat: vi.fn().mockResolvedValue(compatSnap) };
    renderWithProviders(<EASetupWelcome api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('ea01-heading')).toBeInTheDocument());
    expect(screen.getByTestId('ea01-profile')).toHaveTextContent('V2_44');
  });
  it('offline banner', async () => {
    renderWithProviders(<EASetupWelcome api={{
      health: vi.fn().mockResolvedValue(health(false)),
      compat: vi.fn().mockResolvedValue(compatSnap),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea01-offline')).toBeInTheDocument());
  });
  it('error', async () => {
    renderWithProviders(<EASetupWelcome api={{
      health: vi.fn().mockRejectedValue('x'), compat: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea01-error')).toBeInTheDocument());
  });
});

describe('EA-02 UsersList', () => {
  it('shows users', async () => {
    renderWithProviders(<EAUsersList api={{
      listUsers: vi.fn().mockResolvedValue({ users: [{
        userId: 'u1', username: 'alice', displayName: 'Alice', roles: ['ADMIN'],
      }] }),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea02-user-u1')).toBeInTheDocument());
  });
  it('empty + error', async () => {
    renderWithProviders(<EAUsersList api={{
      listUsers: vi.fn().mockResolvedValue({ users: [] }),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea02-empty')).toBeInTheDocument());
    renderWithProviders(<EAUsersList api={{
      listUsers: vi.fn().mockRejectedValue(new Error('x')),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea02-error')).toBeInTheDocument());
  });
});

describe('EA-03 UserCreate', () => {
  it('submits', async () => {
    const api = { createUser: vi.fn().mockResolvedValue({ userId: 'u' } as never) };
    renderWithProviders(<EAUserCreate api={api as never} />);
    await userEvent.type(screen.getByTestId('ea03-username'), 'alice');
    await userEvent.type(screen.getByTestId('ea03-display'), 'Alice');
    await userEvent.type(screen.getByTestId('ea03-password'), 'pw');
    await userEvent.selectOptions(screen.getByTestId('ea03-role'), 'ADMIN');
    await userEvent.click(screen.getByTestId('ea03-submit'));
    await waitFor(() => expect(screen.getByTestId('ea03-saved')).toBeInTheDocument());
  });
  it('error', async () => {
    renderWithProviders(<EAUserCreate api={{
      createUser: vi.fn().mockRejectedValue('nope'),
    } as never} />);
    await userEvent.type(screen.getByTestId('ea03-username'), 'alice');
    await userEvent.type(screen.getByTestId('ea03-password'), 'pw');
    await userEvent.click(screen.getByTestId('ea03-submit'));
    await waitFor(() => expect(screen.getByTestId('ea03-error')).toBeInTheDocument());
  });
});

describe('EA-04 CompatInspector', () => {
  it('loads and refreshes', async () => {
    const api = { compat: vi.fn().mockResolvedValue(compatSnap),
                  refreshCompat: vi.fn().mockResolvedValue({ ...compatSnap, profileName: 'V2_43' }) };
    renderWithProviders(<EACompatInspector api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('ea04-profile')).toHaveTextContent('V2_44'));
    await userEvent.click(screen.getByTestId('ea04-refresh'));
    await waitFor(() => expect(screen.getByTestId('ea04-profile')).toHaveTextContent('V2_43'));
  });
  it('error', async () => {
    renderWithProviders(<EACompatInspector api={{
      compat: vi.fn().mockRejectedValue(new Error('x')),
      refreshCompat: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea04-error')).toBeInTheDocument());
  });
  it('refresh error', async () => {
    const api = { compat: vi.fn().mockResolvedValue(compatSnap),
                  refreshCompat: vi.fn().mockRejectedValue('x') };
    renderWithProviders(<EACompatInspector api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('ea04-profile')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('ea04-refresh'));
    await waitFor(() => expect(screen.getByTestId('ea04-error')).toBeInTheDocument());
  });
});

describe('EA-05 CompatHistory', () => {
  it('rows', async () => {
    renderWithProviders(<EACompatHistory api={{
      compatHistory: vi.fn().mockResolvedValue({ snapshots: [compatSnap] }),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea05-row-profile-0')).toHaveTextContent('V2_44'));
  });
  it('empty', async () => {
    renderWithProviders(<EACompatHistory api={{
      compatHistory: vi.fn().mockResolvedValue({ snapshots: [] }),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea05-empty')).toBeInTheDocument());
  });
  it('error', async () => {
    renderWithProviders(<EACompatHistory api={{
      compatHistory: vi.fn().mockRejectedValue('x'),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea05-error')).toBeInTheDocument());
  });
});

describe('EA-06 JobsList', () => {
  it('rows', async () => {
    renderWithProviders(<EAJobsList api={{
      listJobs: vi.fn().mockResolvedValue([{ runId: 1, jobName: 'J', startedAt: 'now',
        finishedAt: null, outcome: 'STARTED', durationMs: null, detail: null, triggeredBy: 'x' }]),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea06-row-job-1')).toBeInTheDocument());
  });
  it('empty + error', async () => {
    renderWithProviders(<EAJobsList api={{
      listJobs: vi.fn().mockResolvedValue([]),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea06-empty')).toBeInTheDocument());
    renderWithProviders(<EAJobsList api={{ listJobs: vi.fn().mockRejectedValue('x') } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea06-error')).toBeInTheDocument());
  });
});

describe('EA-07 JobTrigger', () => {
  it('fires', async () => {
    renderWithProviders(<EAJobTrigger api={{
      triggerJob: vi.fn().mockResolvedValue({ triggered: 'METADATA_SYNC_FULL' }),
    } as never} />);
    await userEvent.click(screen.getByTestId('ea07-fire'));
    await waitFor(() => expect(screen.getByTestId('ea07-ok')).toBeInTheDocument());
  });
  it('error from body', async () => {
    renderWithProviders(<EAJobTrigger api={{
      triggerJob: vi.fn().mockResolvedValue({ error: 'unknown job' }),
    } as never} />);
    await userEvent.click(screen.getByTestId('ea07-fire'));
    await waitFor(() => expect(screen.getByTestId('ea07-error')).toBeInTheDocument());
  });
  it('error from reject', async () => {
    renderWithProviders(<EAJobTrigger api={{
      triggerJob: vi.fn().mockRejectedValue('x'),
    } as never} />);
    await userEvent.click(screen.getByTestId('ea07-fire'));
    await waitFor(() => expect(screen.getByTestId('ea07-error')).toBeInTheDocument());
  });
});

describe('EA-08 DriftInspector', () => {
  it('equal', async () => {
    renderWithProviders(<EADriftInspector api={{
      drift: vi.fn().mockResolvedValue({ snapshotFrom: 1, snapshotTo: 2,
        fingerprintFrom: 'f', fingerprintTo: 'f', perEntity: {} }),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea08-same')).toHaveTextContent('equal'));
  });
  it('refresh branch', async () => {
    const api = { drift: vi.fn().mockResolvedValue({ snapshotFrom: 1, snapshotTo: 2,
      fingerprintFrom: 'a', fingerprintTo: 'b', perEntity: {} }) };
    renderWithProviders(<EADriftInspector api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('ea08-same')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('ea08-refresh'));
    expect(api.drift).toHaveBeenCalledTimes(2);
  });
  it('no snapshot', async () => {
    renderWithProviders(<EADriftInspector api={{
      drift: vi.fn().mockResolvedValue({ status: 'NO_SNAPSHOT' }),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea08-empty')).toBeInTheDocument());
  });
  it('error', async () => {
    renderWithProviders(<EADriftInspector api={{
      drift: vi.fn().mockRejectedValue('x'),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea08-error')).toBeInTheDocument());
  });
});

describe('EA-10 ConflictList', () => {
  it('rows', async () => {
    renderWithProviders(<EAConflictList api={{
      listConflicts: vi.fn().mockResolvedValue([{ operationId: 'op-1', entityType: 'EVENT',
        entityRef: 'x', state: 'CONFLICT_REVIEW', attemptCount: 1, createdAt: 'now' }]),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea10-row-op-1')).toBeInTheDocument());
  });
  it('empty + error', async () => {
    renderWithProviders(<EAConflictList api={{
      listConflicts: vi.fn().mockResolvedValue([]),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea10-empty')).toBeInTheDocument());
    renderWithProviders(<EAConflictList api={{
      listConflicts: vi.fn().mockRejectedValue('x'),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea10-error')).toBeInTheDocument());
  });
});

describe('EA-11 ConflictResolve', () => {
  it('resolves', async () => {
    const api = { resolveConflict: vi.fn().mockResolvedValue({}),
                  reJournalConflict: vi.fn() };
    renderWithProviders(<EAConflictResolve api={api as never} operationId="op-1" />);
    await userEvent.selectOptions(screen.getByTestId('ea11-outcome'), 'REJECTED');
    await userEvent.type(screen.getByTestId('ea11-rationale'), 'bad');
    await userEvent.click(screen.getByTestId('ea11-resolve'));
    await waitFor(() => expect(screen.getByTestId('ea11-done')).toBeInTheDocument());
    expect(api.resolveConflict).toHaveBeenCalledWith('op-1', 'REJECTED', 'bad');
  });
  it('re-journals', async () => {
    const api = { resolveConflict: vi.fn(),
                  reJournalConflict: vi.fn().mockResolvedValue({}) };
    renderWithProviders(<EAConflictResolve api={api as never} operationId="op-1" />);
    await userEvent.click(screen.getByTestId('ea11-rejournal'));
    await waitFor(() => expect(screen.getByTestId('ea11-done')).toBeInTheDocument());
  });
  it('error paths', async () => {
    renderWithProviders(<EAConflictResolve api={{
      resolveConflict: vi.fn().mockRejectedValue(new Error('r')),
      reJournalConflict: vi.fn(),
    } as never} operationId="op-1" />);
    await userEvent.click(screen.getByTestId('ea11-resolve'));
    await waitFor(() => expect(screen.getByTestId('ea11-error')).toBeInTheDocument());

    renderWithProviders(<EAConflictResolve api={{
      resolveConflict: vi.fn(),
      reJournalConflict: vi.fn().mockRejectedValue('x'),
    } as never} operationId="op-1" />);
    await userEvent.click(screen.getAllByTestId('ea11-rejournal')[1]);
    await waitFor(() => expect(screen.getAllByTestId('ea11-error').length).toBeGreaterThanOrEqual(1));
  });
});

describe('EA-14 WorkerHealth', () => {
  it('running + pause', async () => {
    const api = {
      workerHealth: vi.fn()
        .mockResolvedValueOnce({ enabled: true, lastTick: null, lastBatchSize: 0, backlog: { PENDING: 2 } })
        .mockResolvedValueOnce({ enabled: false, lastTick: null, lastBatchSize: 0, backlog: {} }),
      pauseWorker: vi.fn().mockResolvedValue({ enabled: false }),
      resumeWorker: vi.fn(),
    };
    renderWithProviders(<EAWorkerHealth api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('ea14-enabled')).toHaveTextContent('running'));
    expect(screen.getByTestId('ea14-backlog-PENDING')).toHaveTextContent('PENDING: 2');
    await userEvent.click(screen.getByTestId('ea14-toggle'));
    await waitFor(() => expect(screen.getByTestId('ea14-enabled')).toHaveTextContent('paused'));
  });
  it('paused + resume', async () => {
    const api = {
      workerHealth: vi.fn()
        .mockResolvedValueOnce({ enabled: false, lastTick: 'now', lastBatchSize: 1, backlog: {} })
        .mockResolvedValueOnce({ enabled: true, lastTick: 'now', lastBatchSize: 1, backlog: {} }),
      pauseWorker: vi.fn(),
      resumeWorker: vi.fn().mockResolvedValue({ enabled: true }),
    };
    renderWithProviders(<EAWorkerHealth api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('ea14-enabled')).toHaveTextContent('paused'));
    await userEvent.click(screen.getByTestId('ea14-toggle'));
    await waitFor(() => expect(screen.getByTestId('ea14-enabled')).toHaveTextContent('running'));
  });
  it('error', async () => {
    renderWithProviders(<EAWorkerHealth api={{
      workerHealth: vi.fn().mockRejectedValue('x'),
      pauseWorker: vi.fn(), resumeWorker: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea14-error')).toBeInTheDocument());
  });
  it('toggle error', async () => {
    const api = {
      workerHealth: vi.fn().mockResolvedValue({ enabled: true, lastTick: null,
        lastBatchSize: 0, backlog: {} }),
      pauseWorker: vi.fn().mockRejectedValue(new Error('x')),
      resumeWorker: vi.fn(),
    };
    renderWithProviders(<EAWorkerHealth api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('ea14-toggle')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('ea14-toggle'));
    await waitFor(() => expect(screen.getByTestId('ea14-error')).toBeInTheDocument());
  });
});

describe('EA-18 MetadataOverview', () => {
  it('counts', async () => {
    const api = {
      metadataList: vi.fn()
        .mockResolvedValueOnce({ dataSets: [{ id: 'a' }] })
        .mockResolvedValueOnce({ dataElements: [{ id: 'b' }, { id: 'c' }] })
        .mockResolvedValueOnce({ organisationUnits: [] })
        .mockResolvedValueOnce({ programs: [{ id: 'd' }] })
        .mockResolvedValueOnce({ trackedEntityTypes: [{ id: 'e' }] }),
    };
    renderWithProviders(<EAMetadataOverview api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('ea18-count-dataSets'))
      .toHaveTextContent('dataSets: 1'));
    expect(screen.getByTestId('ea18-count-dataElements')).toHaveTextContent('dataElements: 2');
  });
  it('error', async () => {
    renderWithProviders(<EAMetadataOverview api={{
      metadataList: vi.fn().mockRejectedValue('x'),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea18-error')).toBeInTheDocument());
  });
});
