import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import type * as edgeApi from '../api/edgeApi';
import {
  EASetupWelcome, EAUsersList, EAUserCreate, EACompatInspector, EACompatHistory,
  EAJobsList, EAJobTrigger, EADriftInspector, EAConflictList, EAConflictResolve,
  EAWorkerHealth, EAMetadataOverview, EAApprovalQueue, EACaptureWorkflowList,
  EACaptureWorkflowDesigner, EADeviceFleet, EAFacilityAnalytics,
  EAAuditVerify,
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

  it('renders device reference panel when listDevices returns rows (ADR-0022)', async () => {
    renderWithProviders(<EACaptureWorkflowDesigner workflowId="new" api={{
      getWorkflow: vi.fn(), saveWorkflow: vi.fn(),
      listDevices: vi.fn().mockResolvedValue({ devices: [{
        deviceId: 'dvc-1', assignedUserId: null,
        enrolledAt: '2026-10-22T00:00:00Z', approvedBy: null, approvedAt: null,
        lastSeenAt: null, userAgent: 'Chrome', firmwareVersion: null,
        status: 'APPROVED',
      }] }),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('cwf02-devices')).toBeInTheDocument());
    expect(screen.getByTestId('cwf02-device-dvc-1')).toHaveTextContent('Chrome');
  });

  it('device panel hidden when listDevices returns empty', async () => {
    renderWithProviders(<EACaptureWorkflowDesigner workflowId="new" api={{
      getWorkflow: vi.fn(), saveWorkflow: vi.fn(),
      listDevices: vi.fn().mockResolvedValue({ devices: [] }),
    } as never} />);
    expect(screen.queryByTestId('cwf02-devices')).not.toBeInTheDocument();
  });

  it('device panel falls back to deviceId slice when userAgent is null', async () => {
    renderWithProviders(<EACaptureWorkflowDesigner workflowId="new" api={{
      getWorkflow: vi.fn(), saveWorkflow: vi.fn(),
      listDevices: vi.fn().mockResolvedValue({ devices: [{
        deviceId: '12345678-aaaa-bbbb-cccc-dddddddddddd', assignedUserId: null,
        enrolledAt: '2026-10-22T00:00:00Z', approvedBy: null, approvedAt: null,
        lastSeenAt: null, userAgent: null, firmwareVersion: null,
        status: 'PENDING',
      }] }),
    } as never} />);
    const row = await screen.findByTestId(
      'cwf02-device-12345678-aaaa-bbbb-cccc-dddddddddddd');
    expect(row).toHaveTextContent('12345678');
  });

  it('listDevices null response treated as empty', async () => {
    renderWithProviders(<EACaptureWorkflowDesigner workflowId="new" api={{
      getWorkflow: vi.fn(), saveWorkflow: vi.fn(),
      listDevices: vi.fn().mockResolvedValue({ devices: null }),
    } as never} />);
    expect(screen.queryByTestId('cwf02-devices')).not.toBeInTheDocument();
  });

  it('binding-kind select switches to PROGRAM (ADR-0024)', async () => {
    const save = vi.fn().mockResolvedValue(loaded);
    renderWithProviders(<EACaptureWorkflowDesigner workflowId="new" api={{
      getWorkflow: vi.fn(), saveWorkflow: save,
    } as never} />);
    await userEvent.type(screen.getByTestId('cwf02-name'), 'wf');
    await userEvent.type(screen.getByTestId('cwf02-binding'), 'p1');
    await userEvent.selectOptions(screen.getByTestId('cwf02-binding-kind'), 'PROGRAM');
    await userEvent.click(screen.getByTestId('cwf02-save'));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][0]).toMatchObject({ boundMetadataKind: 'PROGRAM' });
  });

  it('export button shows only when loaded + populates textarea', async () => {
    const exportFn = vi.fn().mockResolvedValue({
      schemaVersion: 1, displayName: 'Monthly', boundMetadataKind: 'DATA_SET',
      boundMetadataId: 'ds2', enabled: true, steps: [], dependencies: [],
    });
    renderWithProviders(<EACaptureWorkflowDesigner workflowId={loaded.workflowId} api={{
      getWorkflow: vi.fn().mockResolvedValue(loaded),
      saveWorkflow: vi.fn(),
      exportWorkflow: exportFn,
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('cwf02-export')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('cwf02-export'));
    await waitFor(() => expect(screen.getByTestId('cwf02-export-output'))
      .toBeInTheDocument());
    expect(exportFn).toHaveBeenCalledWith(loaded.workflowId);
  });

  it('export section hidden on new workflow', () => {
    renderWithProviders(<EACaptureWorkflowDesigner workflowId="new" api={{
      getWorkflow: vi.fn(), saveWorkflow: vi.fn(),
    } as never} />);
    expect(screen.queryByTestId('cwf02-export-section')).not.toBeInTheDocument();
  });

  it('export error surfaces', async () => {
    renderWithProviders(<EACaptureWorkflowDesigner workflowId={loaded.workflowId} api={{
      getWorkflow: vi.fn().mockResolvedValue(loaded),
      saveWorkflow: vi.fn(),
      exportWorkflow: vi.fn().mockRejectedValue(new Error('nope')),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('cwf02-export')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('cwf02-export'));
    await waitFor(() => expect(screen.getByTestId('cwf02-error')).toBeInTheDocument());
  });

  it('import dry-run surfaces warnings', async () => {
    const imp = vi.fn().mockResolvedValue({
      dryRun: true, warnings: ['w1'],
      workflow: { ...loaded, workflowId: 'new-id' },
    });
    renderWithProviders(<EACaptureWorkflowDesigner workflowId="new" api={{
      getWorkflow: vi.fn(), saveWorkflow: vi.fn(),
      importWorkflow: imp,
    } as never} />);
    const payload = JSON.stringify({
      schemaVersion: 1, displayName: 'x', boundMetadataKind: 'DATA_SET',
      boundMetadataId: 'ds', enabled: true, steps: [], dependencies: [],
    });
    const area = screen.getByTestId('cwf02-import-input') as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: payload } });
    area.dispatchEvent(new Event('input', { bubbles: true }));
    await userEvent.click(screen.getByTestId('cwf02-import-dry'));
    await waitFor(() => expect(screen.getByTestId('cwf02-import-warnings'))
      .toHaveTextContent('w1'));
    expect(imp).toHaveBeenCalledWith(expect.any(Object), true);
  });

  it('import apply flips status to saved', async () => {
    const imp = vi.fn().mockResolvedValue({
      dryRun: false, warnings: [], workflow: loaded,
    });
    renderWithProviders(<EACaptureWorkflowDesigner workflowId="new" api={{
      getWorkflow: vi.fn(), saveWorkflow: vi.fn(),
      importWorkflow: imp,
    } as never} />);
    const area = screen.getByTestId('cwf02-import-input') as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: '{"ok":true}' } });
    area.dispatchEvent(new Event('input', { bubbles: true }));
    await userEvent.click(screen.getByTestId('cwf02-import-apply'));
    await waitFor(() => expect(screen.getByTestId('cwf02-saved')).toBeInTheDocument());
    expect(imp).toHaveBeenCalledWith(expect.any(Object), false);
  });

  it('import JSON parse error surfaces', async () => {
    renderWithProviders(<EACaptureWorkflowDesigner workflowId="new" api={{
      getWorkflow: vi.fn(), saveWorkflow: vi.fn(),
      importWorkflow: vi.fn(),
    } as never} />);
    const area = screen.getByTestId('cwf02-import-input') as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: 'not json' } });
    area.dispatchEvent(new Event('input', { bubbles: true }));
    await userEvent.click(screen.getByTestId('cwf02-import-dry'));
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

describe('EA-DVC-01 DeviceFleet', () => {
  const device = (status: edgeApi.DeviceStatus = 'PENDING') => ({
    deviceId: '33333333-3333-3333-3333-333333333333',
    assignedUserId: null,
    enrolledAt: '2026-10-22T00:00:00Z',
    approvedBy: null, approvedAt: null, lastSeenAt: null,
    userAgent: 'chrome', firmwareVersion: null,
    status,
  });

  it('renders empty', async () => {
    renderWithProviders(<EADeviceFleet api={{
      listDevices: vi.fn().mockResolvedValue({ devices: [] }),
      approveDevice: vi.fn(), suspendDevice: vi.fn(),
      revokeDevice: vi.fn(), deleteDevice: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('dvc01-empty')).toBeInTheDocument());
  });

  it('renders a row with Approve + Revoke buttons when PENDING', async () => {
    renderWithProviders(<EADeviceFleet api={{
      listDevices: vi.fn().mockResolvedValue({ devices: [device('PENDING')] }),
      approveDevice: vi.fn(), suspendDevice: vi.fn(),
      revokeDevice: vi.fn(), deleteDevice: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('dvc01-row-33333333-3333-3333-3333-333333333333'))
      .toBeInTheDocument());
    expect(screen.getByTestId('dvc01-approve-33333333-3333-3333-3333-333333333333'))
      .toBeInTheDocument();
    expect(screen.getByTestId('dvc01-revoke-33333333-3333-3333-3333-333333333333'))
      .toBeInTheDocument();
  });

  it('approved row shows Suspend', async () => {
    renderWithProviders(<EADeviceFleet api={{
      listDevices: vi.fn().mockResolvedValue({ devices: [device('APPROVED')] }),
      approveDevice: vi.fn(), suspendDevice: vi.fn(),
      revokeDevice: vi.fn(), deleteDevice: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('dvc01-suspend-33333333-3333-3333-3333-333333333333'))
      .toBeInTheDocument());
  });

  it('revoked row shows Delete', async () => {
    renderWithProviders(<EADeviceFleet api={{
      listDevices: vi.fn().mockResolvedValue({ devices: [device('REVOKED')] }),
      approveDevice: vi.fn(), suspendDevice: vi.fn(),
      revokeDevice: vi.fn(), deleteDevice: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('dvc01-delete-33333333-3333-3333-3333-333333333333'))
      .toBeInTheDocument());
  });

  it('approve action calls api and reloads', async () => {
    const list = vi.fn().mockResolvedValueOnce({ devices: [device('PENDING')] })
                        .mockResolvedValue({ devices: [device('APPROVED')] });
    const approve = vi.fn().mockResolvedValue({ outcome: 'OK' });
    renderWithProviders(<EADeviceFleet api={{
      listDevices: list, approveDevice: approve, suspendDevice: vi.fn(),
      revokeDevice: vi.fn(), deleteDevice: vi.fn(),
    } as never} />);
    await userEvent.click(await screen.findByTestId(
      'dvc01-approve-33333333-3333-3333-3333-333333333333'));
    await waitFor(() => expect(approve).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('dvc01-status-33333333-3333-3333-3333-333333333333'))
      .toHaveTextContent('APPROVED'));
  });

  it('revoke action error surfaces', async () => {
    const list = vi.fn().mockResolvedValue({ devices: [device('APPROVED')] });
    renderWithProviders(<EADeviceFleet api={{
      listDevices: list, approveDevice: vi.fn(),
      suspendDevice: vi.fn(),
      revokeDevice: vi.fn().mockRejectedValue(new Error('fail')),
      deleteDevice: vi.fn(),
    } as never} />);
    await userEvent.click(await screen.findByTestId(
      'dvc01-revoke-33333333-3333-3333-3333-333333333333'));
    await waitFor(() => expect(screen.getByTestId('dvc01-error')).toBeInTheDocument());
  });

  it('list error surfaces', async () => {
    renderWithProviders(<EADeviceFleet api={{
      listDevices: vi.fn().mockRejectedValue('x'),
      approveDevice: vi.fn(), suspendDevice: vi.fn(),
      revokeDevice: vi.fn(), deleteDevice: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('dvc01-error')).toBeInTheDocument());
  });
});

describe('EA-ANA-01 FacilityAnalytics', () => {
  const row = (kind: edgeApi.AnalyticsKind, period: string, n: number) => ({
    orgUnitId: 'ou1', period, kind, n, refreshedAt: '2026-10-22T00:00:00Z',
  });

  it('renders empty state when the view is empty', async () => {
    renderWithProviders(<EAFacilityAnalytics api={{
      analyticsSummary: vi.fn().mockResolvedValue({ rows: [], lastRefreshedAt: null }),
      analyticsRejections: vi.fn().mockResolvedValue({ count: 0 }),
      analyticsRefresh: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ana01-empty')).toBeInTheDocument());
  });

  it('renders totals and table', async () => {
    renderWithProviders(<EAFacilityAnalytics api={{
      analyticsSummary: vi.fn().mockResolvedValue({
        rows: [row('AGGREGATE', '202604', 10), row('EVENT', '2026-10-22', 3)],
        lastRefreshedAt: '2026-10-22T00:00:00Z',
      }),
      analyticsRejections: vi.fn().mockResolvedValue({ count: 2 }),
      analyticsRefresh: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ana01-count-aggregate'))
      .toHaveTextContent('10'));
    expect(screen.getByTestId('ana01-count-event')).toHaveTextContent('3');
    expect(screen.getByTestId('ana01-count-rejections')).toHaveTextContent('2');
  });

  it('refresh calls api and reloads', async () => {
    const list = vi.fn().mockResolvedValueOnce({ rows: [], lastRefreshedAt: null })
                        .mockResolvedValue({
                          rows: [row('AGGREGATE', '202604', 1)],
                          lastRefreshedAt: '2026-10-22T00:00:00Z',
                        });
    const refresh = vi.fn().mockResolvedValue({ outcome: 'OK' });
    renderWithProviders(<EAFacilityAnalytics api={{
      analyticsSummary: list,
      analyticsRejections: vi.fn().mockResolvedValue({ count: 0 }),
      analyticsRefresh: refresh,
    } as never} />);
    await userEvent.click(await screen.findByTestId('ana01-refresh'));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('ana01-count-aggregate'))
      .toHaveTextContent('1'));
  });

  it('error from summary surfaces', async () => {
    renderWithProviders(<EAFacilityAnalytics api={{
      analyticsSummary: vi.fn().mockRejectedValue('x'),
      analyticsRejections: vi.fn(),
      analyticsRefresh: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ana01-error')).toBeInTheDocument());
  });

  it('error from refresh surfaces', async () => {
    renderWithProviders(<EAFacilityAnalytics api={{
      analyticsSummary: vi.fn().mockResolvedValue({ rows: [], lastRefreshedAt: null }),
      analyticsRejections: vi.fn().mockResolvedValue({ count: 0 }),
      analyticsRefresh: vi.fn().mockRejectedValue(new Error('boom')),
    } as never} />);
    await userEvent.click(await screen.findByTestId('ana01-refresh'));
    await waitFor(() => expect(screen.getByTestId('ana01-error')).toBeInTheDocument());
  });

  it('shows last-refreshed value when present', async () => {
    renderWithProviders(<EAFacilityAnalytics api={{
      analyticsSummary: vi.fn().mockResolvedValue({
        rows: [row('AGGREGATE', '202604', 1)],
        lastRefreshedAt: '2026-10-22T00:00:00Z',
      }),
      analyticsRejections: vi.fn().mockResolvedValue({ count: 0 }),
      analyticsRefresh: vi.fn(),
    } as never} />);
    await waitFor(() => expect(screen.getByTestId('ana01-last-refreshed'))
      .toHaveTextContent('2026-10-22T00:00:00Z'));
  });
});

describe('EA-AUD-01 AuditVerify', () => {
  it('renders heading before run', () => {
    renderWithProviders(<EAAuditVerify api={{ verifyAuditChain: vi.fn() } as never} />);
    expect(screen.getByTestId('aud01-heading')).toBeInTheDocument();
  });

  it('reports OK result', async () => {
    renderWithProviders(<EAAuditVerify api={{
      verifyAuditChain: vi.fn().mockResolvedValue({
        ok: true, totalRows: 10, firstBreakAuditId: null, firstBreakReason: null,
      }),
    } as never} />);
    await userEvent.click(screen.getByTestId('aud01-run'));
    await waitFor(() => expect(screen.getByTestId('aud01-status'))
      .toHaveTextContent('OK'));
    expect(screen.getByTestId('aud01-total')).toHaveTextContent('10');
  });

  it('reports a break', async () => {
    renderWithProviders(<EAAuditVerify api={{
      verifyAuditChain: vi.fn().mockResolvedValue({
        ok: false, totalRows: 50,
        firstBreakAuditId: 7, firstBreakReason: 'ROW_HASH_MISMATCH',
      }),
    } as never} />);
    await userEvent.click(screen.getByTestId('aud01-run'));
    await waitFor(() => expect(screen.getByTestId('aud01-status'))
      .toHaveTextContent('BROKEN'));
    expect(screen.getByTestId('aud01-break-id')).toHaveTextContent('7');
    expect(screen.getByTestId('aud01-break-reason'))
      .toHaveTextContent('ROW_HASH_MISMATCH');
  });

  it('shows error on failure', async () => {
    renderWithProviders(<EAAuditVerify api={{
      verifyAuditChain: vi.fn().mockRejectedValue(new Error('boom')),
    } as never} />);
    await userEvent.click(screen.getByTestId('aud01-run'));
    await waitFor(() => expect(screen.getByTestId('aud01-error')).toBeInTheDocument());
  });

  it('non-Error rejection stringifies', async () => {
    renderWithProviders(<EAAuditVerify api={{
      verifyAuditChain: vi.fn().mockRejectedValue('x'),
    } as never} />);
    await userEvent.click(screen.getByTestId('aud01-run'));
    await waitFor(() => expect(screen.getByTestId('aud01-error')).toBeInTheDocument());
  });
});
