import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import {
  EASetupWelcome, EAUsersList, EAUserCreate, EACompatInspector, EACompatHistory,
  EAJobsList, EAJobTrigger, EADriftInspector, EAConflictList, EAConflictResolve,
  EAWorkerHealth, EAMetadataOverview, EAApprovalQueue, EACaptureWorkflowList,
  EACaptureWorkflowDesigner,
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

const unboundBinding = {
  bound: false, orgUnitId: null, orgUnitDisplayName: null, orgUnitPath: null,
  boundAt: null, boundBy: null,
};
const boundBinding = {
  bound: true, orgUnitId: 'ou-1', orgUnitDisplayName: 'Clinic',
  orgUnitPath: '/root/ou-1', boundAt: '2026-10-22T00:00:00Z',
  boundBy: 'u1',
};

describe('EA-01 SetupWelcome', () => {
  it('renders bound state', async () => {
    const api = {
      health: vi.fn().mockResolvedValue(health()),
      compat: vi.fn().mockResolvedValue(compatSnap),
      getOrgUnitBinding: vi.fn().mockResolvedValue(boundBinding),
      bindOrgUnit: vi.fn(),
      listOrgUnits: vi.fn(),
    };
    renderWithProviders(<EASetupWelcome api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('ea01-heading')).toBeInTheDocument());
    expect(screen.getByTestId('ea01-profile')).toHaveTextContent('V2_44');
    expect(screen.getByTestId('ea01-orgunit')).toHaveTextContent('Clinic');
  });
  it('offline banner', async () => {
    renderWithProviders(<EASetupWelcome api={{
      health: vi.fn().mockResolvedValue(health(false)),
      compat: vi.fn().mockResolvedValue(compatSnap),
      getOrgUnitBinding: vi.fn().mockResolvedValue(boundBinding),
      bindOrgUnit: vi.fn(),
      listOrgUnits: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea01-offline')).toBeInTheDocument());
  });
  it('error', async () => {
    renderWithProviders(<EASetupWelcome api={{
      health: vi.fn().mockRejectedValue('x'), compat: vi.fn(),
      getOrgUnitBinding: vi.fn(), bindOrgUnit: vi.fn(), listOrgUnits: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea01-error')).toBeInTheDocument());
  });
  it('shows orgUnit picker when unbound and lists OUs', async () => {
    const api = {
      health: vi.fn().mockResolvedValue(health()),
      compat: vi.fn().mockResolvedValue(compatSnap),
      getOrgUnitBinding: vi.fn().mockResolvedValueOnce(unboundBinding)
                                 .mockResolvedValue(boundBinding),
      bindOrgUnit: vi.fn().mockResolvedValue(boundBinding),
      listOrgUnits: vi.fn().mockResolvedValue({
        organisationUnits: [{ id: 'ou-1', displayName: 'Clinic', path: '/root/ou-1' }],
      }),
    };
    renderWithProviders(<EASetupWelcome api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('ea01-orgunit-picker')).toBeInTheDocument());
    expect(screen.getByTestId('ea01-orgunit-opt-ou-1')).toBeInTheDocument();
  });
  it('bind path happy', async () => {
    const api = {
      health: vi.fn().mockResolvedValue(health()),
      compat: vi.fn().mockResolvedValue(compatSnap),
      getOrgUnitBinding: vi.fn().mockResolvedValueOnce(unboundBinding)
                                 .mockResolvedValue(boundBinding),
      bindOrgUnit: vi.fn().mockResolvedValue(boundBinding),
      listOrgUnits: vi.fn().mockResolvedValue({
        organisationUnits: [{ id: 'ou-1', displayName: 'Clinic', path: '/root/ou-1' }],
      }),
    };
    renderWithProviders(<EASetupWelcome api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('ea01-orgunit-picker')).toBeInTheDocument());
    const sel = screen.getByTestId('ea01-orgunit-select') as HTMLSelectElement;
    sel.value = 'ou-1';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await userEvent.click(screen.getByTestId('ea01-orgunit-bind'));
    await waitFor(() => expect(api.bindOrgUnit).toHaveBeenCalledWith('ou-1', false));
  });
  it('bind error path', async () => {
    const api = {
      health: vi.fn().mockResolvedValue(health()),
      compat: vi.fn().mockResolvedValue(compatSnap),
      getOrgUnitBinding: vi.fn().mockResolvedValue(unboundBinding),
      bindOrgUnit: vi.fn().mockRejectedValue(new Error('OU_NOT_IN_MIRROR')),
      listOrgUnits: vi.fn().mockResolvedValue({
        organisationUnits: [{ id: 'ou-1', displayName: 'Clinic', path: '/root/ou-1' }],
      }),
    };
    renderWithProviders(<EASetupWelcome api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('ea01-orgunit-picker')).toBeInTheDocument());
    const sel = screen.getByTestId('ea01-orgunit-select') as HTMLSelectElement;
    sel.value = 'ou-1';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await userEvent.click(screen.getByTestId('ea01-orgunit-bind'));
    await waitFor(() => expect(screen.getByTestId('ea01-error')).toBeInTheDocument());
  });
  it('empty orgUnit list shows empty-block', async () => {
    renderWithProviders(<EASetupWelcome api={{
      health: vi.fn().mockResolvedValue(health()),
      compat: vi.fn().mockResolvedValue(compatSnap),
      getOrgUnitBinding: vi.fn().mockResolvedValue(unboundBinding),
      bindOrgUnit: vi.fn(),
      listOrgUnits: vi.fn().mockResolvedValue({ organisationUnits: [] }),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ea01-orgunit-empty')).toBeInTheDocument());
  });
  it('rebind UI accepts id + confirm', async () => {
    const api = {
      health: vi.fn().mockResolvedValue(health()),
      compat: vi.fn().mockResolvedValue(compatSnap),
      getOrgUnitBinding: vi.fn().mockResolvedValue(boundBinding),
      bindOrgUnit: vi.fn().mockResolvedValue(boundBinding),
      listOrgUnits: vi.fn(),
    };
    renderWithProviders(<EASetupWelcome api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('ea01-orgunit-rebind')).toBeInTheDocument());
    await userEvent.type(screen.getByTestId('ea01-orgunit-rebind-id'), 'ou-2');
    await userEvent.click(screen.getByTestId('ea01-orgunit-rebind-confirm'));
    await userEvent.click(screen.getByTestId('ea01-orgunit-rebind-submit'));
    await waitFor(() => expect(api.bindOrgUnit).toHaveBeenCalledWith('ou-2', true));
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

describe('EA-APR-01 ApprovalQueue', () => {
  const row = {
    operationId: '11111111-1111-1111-1111-111111111111',
    entityType: 'AGGREGATE_DATA_VALUE',
    entityRef: 'de/ou/2026Q1',
    submittedBy: 'u1',
    createdAt: '2026-10-22T00:00:00Z',
  };

  it('renders empty when nothing is pending', async () => {
    renderWithProviders(<EAApprovalQueue api={{
      listPendingApprovals: vi.fn().mockResolvedValue({ rows: [] }),
      approveOperation: vi.fn(), rejectOperation: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('apr-empty')).toBeInTheDocument());
  });

  it('renders rows', async () => {
    renderWithProviders(<EAApprovalQueue api={{
      listPendingApprovals: vi.fn().mockResolvedValue({ rows: [row] }),
      approveOperation: vi.fn(), rejectOperation: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId(`apr-row-${row.operationId}`)).toBeInTheDocument());
  });

  it('approve calls the api and reloads', async () => {
    const approve = vi.fn().mockResolvedValue({ outcome: 'APPROVED' });
    const list = vi.fn().mockResolvedValueOnce({ rows: [row] })
                        .mockResolvedValue({ rows: [] });
    renderWithProviders(<EAApprovalQueue api={{
      listPendingApprovals: list, approveOperation: approve, rejectOperation: vi.fn(),
    } as never} />);
    await userEvent.click(await screen.findByTestId(`apr-approve-${row.operationId}`));
    await waitFor(() => expect(approve).toHaveBeenCalledWith(row.operationId));
    await waitFor(() => expect(screen.getByTestId('apr-empty')).toBeInTheDocument());
  });

  it('reject sends reason and reloads', async () => {
    const reject = vi.fn().mockResolvedValue({ outcome: 'REJECTED' });
    const list = vi.fn().mockResolvedValueOnce({ rows: [row] })
                        .mockResolvedValue({ rows: [] });
    renderWithProviders(<EAApprovalQueue api={{
      listPendingApprovals: list, approveOperation: vi.fn(), rejectOperation: reject,
    } as never} />);
    await userEvent.type(await screen.findByTestId(`apr-reason-${row.operationId}`), 'bad');
    await userEvent.click(screen.getByTestId(`apr-reject-${row.operationId}`));
    await waitFor(() => expect(reject).toHaveBeenCalledWith(row.operationId, 'bad'));
  });

  it('error from list surfaces in ErrorBlock', async () => {
    renderWithProviders(<EAApprovalQueue api={{
      listPendingApprovals: vi.fn().mockRejectedValue('x'),
      approveOperation: vi.fn(), rejectOperation: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('apr-error')).toBeInTheDocument());
  });

  it('error from approve surfaces in ErrorBlock', async () => {
    const approve = vi.fn().mockRejectedValue(new Error('nope'));
    renderWithProviders(<EAApprovalQueue api={{
      listPendingApprovals: vi.fn().mockResolvedValue({ rows: [row] }),
      approveOperation: approve, rejectOperation: vi.fn(),
    } as never} />);
    await userEvent.click(await screen.findByTestId(`apr-approve-${row.operationId}`));
    await waitFor(() => expect(screen.getByTestId('apr-error')).toBeInTheDocument());
  });

  it('error from reject surfaces in ErrorBlock', async () => {
    const reject = vi.fn().mockRejectedValue('fail');
    renderWithProviders(<EAApprovalQueue api={{
      listPendingApprovals: vi.fn().mockResolvedValue({ rows: [row] }),
      approveOperation: vi.fn(), rejectOperation: reject,
    } as never} />);
    await userEvent.click(await screen.findByTestId(`apr-reject-${row.operationId}`));
    await waitFor(() => expect(screen.getByTestId('apr-error')).toBeInTheDocument());
  });
});

describe('EA-CWF-01 CaptureWorkflowList', () => {
  const sample = {
    workflowId: '11111111-1111-1111-1111-111111111111',
    displayName: 'Weekly',
    boundMetadataKind: 'DATA_SET' as const,
    boundMetadataId: 'ds1',
    enabled: true,
    version: 1,
    steps: [],
    dependencies: [],
  };

  it('renders empty state when no workflows configured', async () => {
    renderWithProviders(<EACaptureWorkflowList api={{
      listWorkflows: vi.fn().mockResolvedValue({ workflows: [] }),
      deleteWorkflow: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('cwf01-empty')).toBeInTheDocument());
  });

  it('renders a workflow row with the enabled flag', async () => {
    renderWithProviders(<EACaptureWorkflowList api={{
      listWorkflows: vi.fn().mockResolvedValue({ workflows: [sample] }),
      deleteWorkflow: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId(`cwf01-row-${sample.workflowId}`))
      .toBeInTheDocument());
    expect(screen.getByTestId(`cwf01-enabled-${sample.workflowId}`)).toHaveTextContent('yes');
  });

  it('delete calls the api and reloads', async () => {
    const list = vi.fn().mockResolvedValueOnce({ workflows: [sample] })
                        .mockResolvedValue({ workflows: [] });
    const del = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<EACaptureWorkflowList api={{
      listWorkflows: list, deleteWorkflow: del,
    } as never} />);
    await userEvent.click(await screen.findByTestId(`cwf01-delete-${sample.workflowId}`));
    await waitFor(() => expect(del).toHaveBeenCalledWith(sample.workflowId));
    await waitFor(() => expect(screen.getByTestId('cwf01-empty')).toBeInTheDocument());
  });

  it('error from list surfaces', async () => {
    renderWithProviders(<EACaptureWorkflowList api={{
      listWorkflows: vi.fn().mockRejectedValue('x'),
      deleteWorkflow: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('cwf01-error')).toBeInTheDocument());
  });

  it('error from delete surfaces', async () => {
    renderWithProviders(<EACaptureWorkflowList api={{
      listWorkflows: vi.fn().mockResolvedValue({ workflows: [sample] }),
      deleteWorkflow: vi.fn().mockRejectedValue(new Error('nope')),
    } as never} />);
    await userEvent.click(await screen.findByTestId(`cwf01-delete-${sample.workflowId}`));
    await waitFor(() => expect(screen.getByTestId('cwf01-error')).toBeInTheDocument());
  });
});

describe('EA-CWF-02 CaptureWorkflowDesigner', () => {
  const loaded = {
    workflowId: '22222222-2222-2222-2222-222222222222',
    displayName: 'Monthly',
    boundMetadataKind: 'DATA_SET' as const,
    boundMetadataId: 'ds2',
    enabled: true,
    version: 2,
    steps: [{ stepId: 's1', ordinal: 0, displayName: 'cap', ownerRole: 'OPERATOR' as const,
      stepKind: 'CAPTURE' as const, fields: [] }],
    dependencies: [],
  };

  it('new workflow renders empty form', () => {
    renderWithProviders(<EACaptureWorkflowDesigner workflowId="new" api={{
      getWorkflow: vi.fn(), saveWorkflow: vi.fn(),
    } as never} />);
    expect(screen.getByTestId('cwf02-heading')).toHaveTextContent('New workflow');
  });

  it('existing workflow loads into the form', async () => {
    const get = vi.fn().mockResolvedValue(loaded);
    renderWithProviders(<EACaptureWorkflowDesigner workflowId={loaded.workflowId} api={{
      getWorkflow: get, saveWorkflow: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('cwf02-heading'))
      .toHaveTextContent(/Monthly/));
    expect((screen.getByTestId('cwf02-name') as HTMLInputElement).value).toBe('Monthly');
  });

  it('save sends the payload and shows saved indicator', async () => {
    const save = vi.fn().mockResolvedValue(loaded);
    renderWithProviders(<EACaptureWorkflowDesigner workflowId="new" api={{
      getWorkflow: vi.fn(), saveWorkflow: save,
    } as never} />);
    await userEvent.type(screen.getByTestId('cwf02-name'), 'New wf');
    await userEvent.type(screen.getByTestId('cwf02-binding'), 'ds-new');
    await userEvent.click(screen.getByTestId('cwf02-save'));
    await waitFor(() => expect(save).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('cwf02-saved')).toBeInTheDocument());
  });

  it('save error surfaces', async () => {
    renderWithProviders(<EACaptureWorkflowDesigner workflowId="new" api={{
      getWorkflow: vi.fn(),
      saveWorkflow: vi.fn().mockRejectedValue(new Error('bad')),
    } as never} />);
    await userEvent.type(screen.getByTestId('cwf02-name'), 'x');
    await userEvent.type(screen.getByTestId('cwf02-binding'), 'ds');
    await userEvent.click(screen.getByTestId('cwf02-save'));
    await waitFor(() => expect(screen.getByTestId('cwf02-error')).toBeInTheDocument());
  });

  it('invalid JSON in steps surfaces error', async () => {
    renderWithProviders(<EACaptureWorkflowDesigner workflowId="new" api={{
      getWorkflow: vi.fn(), saveWorkflow: vi.fn(),
    } as never} />);
    await userEvent.type(screen.getByTestId('cwf02-name'), 'x');
    await userEvent.type(screen.getByTestId('cwf02-binding'), 'ds');
    await userEvent.clear(screen.getByTestId('cwf02-steps'));
    // userEvent treats "{" as a key descriptor start; "{{" produces a literal "{".
    await userEvent.type(screen.getByTestId('cwf02-steps'), '{{');
    await userEvent.click(screen.getByTestId('cwf02-save'));
    await waitFor(() => expect(screen.getByTestId('cwf02-error')).toBeInTheDocument());
  });

  it('existing-workflow fetch error surfaces', async () => {
    renderWithProviders(<EACaptureWorkflowDesigner workflowId="abc" api={{
      getWorkflow: vi.fn().mockRejectedValue('fail'),
      saveWorkflow: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('cwf02-error')).toBeInTheDocument());
  });

  it('toggles enabled checkbox', async () => {
    renderWithProviders(<EACaptureWorkflowDesigner workflowId="new" api={{
      getWorkflow: vi.fn(), saveWorkflow: vi.fn(),
    } as never} />);
    const cb = screen.getByTestId('cwf02-enabled') as HTMLInputElement;
    expect(cb.checked).toBe(true);
    await userEvent.click(cb);
    expect(cb.checked).toBe(false);
  });
});
