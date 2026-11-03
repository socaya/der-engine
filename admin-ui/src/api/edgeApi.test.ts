import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from './edgeApi';

type FetchMock = ReturnType<typeof vi.fn>;
let fetchMock: FetchMock;

beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function respond(status: number, body?: unknown, text = ''): Response {
  const payload = text || (body === undefined ? '' : JSON.stringify(body));
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => payload,
  } as unknown as Response;
}

describe('EdgeApiError', () => {
  it('carries status + code + message', () => {
    const err = new api.EdgeApiError(500, 'EDGE_UNREACHABLE', 'down');
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(500);
    expect(err.code).toBe('EDGE_UNREACHABLE');
    expect(err.message).toBe('down');
    expect(err.name).toBe('EdgeApiError');
  });
});

describe('edgeApi.request error mapping (through health)', () => {
  it('wraps network failures as EDGE_UNREACHABLE', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(api.health()).rejects.toMatchObject({ code: 'EDGE_UNREACHABLE', status: 0 });
  });
  it('maps 401 to INVALID_CREDENTIALS', async () => {
    fetchMock.mockResolvedValue(respond(401));
    await expect(api.health()).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });
  it('maps 429 to RATE_LIMITED', async () => {
    fetchMock.mockResolvedValue(respond(429));
    await expect(api.health()).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
  it('maps 500 to EDGE_UNREACHABLE', async () => {
    fetchMock.mockResolvedValue(respond(500));
    await expect(api.health()).rejects.toMatchObject({ code: 'EDGE_UNREACHABLE' });
  });
  it('maps 418 (other 4xx) to UNKNOWN', async () => {
    fetchMock.mockResolvedValue(respond(418));
    await expect(api.health()).rejects.toMatchObject({ code: 'UNKNOWN' });
  });
  it('returns undefined on 204', async () => {
    fetchMock.mockResolvedValue(respond(204));
    await expect(api.signOut()).resolves.toBeUndefined();
  });
  it('returns undefined on 2xx + empty body', async () => {
    fetchMock.mockResolvedValue(respond(200, undefined, ''));
    await expect(api.signOut()).resolves.toBeUndefined();
  });
});

// Table-driven: each row is [function, args, expectedPath, expectedMethod, expectedBody?]
type Row = [string, () => Promise<unknown>, string, string, unknown?];

describe('edgeApi route coverage', () => {
  // GET-shaped reads
  const okJson = { any: 'thing' };

  it.each<Row>([
    ['signIn',            () => api.signIn('u', 'p'),            '/edge-api/v1/auth/sign-in',           'POST',   { username: 'u', password: 'p' }],
    ['signOut',           () => api.signOut(),                   '/edge-api/v1/auth/sign-out',          'POST',   undefined],
    ['session',           () => api.session(),                   '/edge-api/v1/auth/session',           'GET',    undefined],
    ['triggerMetadataSync', () => api.triggerMetadataSync(),     '/edge-api/v1/sync/metadata',          'POST',   undefined],
    ['health',            () => api.health(),                    '/edge-api/v1/system/health',          'GET',    undefined],
    ['recentActivity',    () => api.recentActivity(10),          '/edge-api/v1/activity/recent?limit=10', 'GET',  undefined],
    ['metadataList',      () => api.metadataList('dataSets'),    '/api/dataSets?fields=id%2CdisplayName%2CshortName%2Ccode%2ClastUpdated&paging=false', 'GET', undefined],
    ['submitAggregate',   () => api.submitAggregate({ dataValues: [] }), '/api/dataValueSets',          'POST',   { dataValues: [] }],
    ['listDrafts',        () => api.listDrafts(),                '/edge-api/v1/drafts',                 'GET',    undefined],
    ['saveDraft',         () => api.saveDraft({ kind: 'K', title: 'T', payload: {} }), '/edge-api/v1/drafts', 'POST', { kind: 'K', title: 'T', payload: {} }],
    ['deleteDraft',       () => api.deleteDraft('d1'),           '/edge-api/v1/drafts/d1',              'DELETE', undefined],
    ['compat',            () => api.compat(),                    '/edge-api/v1/compat',                 'GET',    undefined],
    ['compatHistory',     () => api.compatHistory(5),            '/edge-api/v1/compat/history?limit=5', 'GET',    undefined],
    ['refreshCompat',     () => api.refreshCompat(),             '/edge-api/v1/compat/refresh',         'POST',   undefined],
    ['listJobs',          () => api.listJobs(25),                '/edge-api/v1/sync/jobs?limit=25',     'GET',    undefined],
    ['triggerJob',        () => api.triggerJob('metadata'),      '/edge-api/v1/sync/jobs/metadata/trigger', 'POST', undefined],
    ['drift',             () => api.drift(true),                 '/edge-api/v1/sync/drift?refresh=true', 'GET',   undefined],
    ['drift(no args)',    () => api.drift(),                     '/edge-api/v1/sync/drift?refresh=false', 'GET',  undefined],
    ['listConflicts',     () => api.listConflicts(42),           '/edge-api/v1/journal/conflicts?limit=42', 'GET', undefined],
    ['resolveConflict',   () => api.resolveConflict('op1', 'ACCEPTED', 'ok'), '/edge-api/v1/journal/conflicts/op1/resolve', 'POST', { outcome: 'ACCEPTED', rationale: 'ok' }],
    ['reJournalConflict', () => api.reJournalConflict('op2'),    '/edge-api/v1/journal/conflicts/op2/re-journal', 'POST', undefined],
    ['workerHealth',      () => api.workerHealth(),              '/edge-api/v1/journal/worker',         'GET',    undefined],
    ['pauseWorker',       () => api.pauseWorker(),               '/edge-api/v1/journal/worker/pause',   'POST',   undefined],
    ['resumeWorker',      () => api.resumeWorker(),              '/edge-api/v1/journal/worker/resume',  'POST',   undefined],
    ['listUsers',         () => api.listUsers(),                 '/edge-api/v1/provisioning/users',     'GET',    undefined],
    ['createUser',        () => api.createUser({ username: 'u', displayName: 'U', password: 'p', roles: ['OPERATOR'] }), '/edge-api/v1/provisioning/users', 'POST', { username: 'u', displayName: 'U', password: 'p', roles: ['OPERATOR'] }],
    ['listApps',          () => api.listApps(),                  '/edge-api/v1/apps',                   'GET',    undefined],
    ['setAppEnabled',     () => api.setAppEnabled('a', true),    '/edge-api/v1/apps/a/enable?enabled=true', 'POST', undefined],
    ['uninstallApp',      () => api.uninstallApp('a'),           '/edge-api/v1/apps/a',                 'DELETE', undefined],
    ['listBackups',       () => api.listBackups(),               '/edge-api/v1/backup/runs',            'GET',    undefined],
    ['requestBackup',     () => api.requestBackup('FULL'),       '/edge-api/v1/backup/request',         'POST',   { kind: 'FULL' }],
    ['listRestores',      () => api.listRestores(),              '/edge-api/v1/restore/runs',           'GET',    undefined],
    ['requestRestore',    () => api.requestRestore('/a/b.dump'), '/edge-api/v1/restore/request',        'POST',   { source: '/a/b.dump' }],
    ['diagnostics',       () => api.diagnostics(),               '/edge-api/v1/admin/diagnostics',      'GET',    undefined],
    ['readSettings',      () => api.readSettings(),              '/edge-api/v1/admin/settings',         'GET',    undefined],
    ['saveSettings',      () => api.saveSettings({ cron: { x: '0' }, featureFlags: {}, roles: [] }), '/edge-api/v1/admin/settings', 'POST', { cron: { x: '0' }, featureFlags: {}, roles: [] }],
    ['getOrgUnitBinding', () => api.getOrgUnitBinding(),         '/edge-api/v1/system/org-unit',        'GET',    undefined],
    ['bindOrgUnit',       () => api.bindOrgUnit('ou-1'),         '/edge-api/v1/system/org-unit',        'POST',   { orgUnitId: 'ou-1', confirm: false }],
    ['bindOrgUnit confirm', () => api.bindOrgUnit('ou-2', true), '/edge-api/v1/system/org-unit',        'POST',   { orgUnitId: 'ou-2', confirm: true }],
    ['listOrgUnits',      () => api.listOrgUnits(),              '/api/organisationUnits?fields=id%2CdisplayName%2Ccode%2Cpath%2Clevel%2Cparent%5Bid%2CdisplayName%5D%2CorganisationUnitGroups%5Bid%2CdisplayName%5D&paging=false', 'GET', undefined],
    ['listPendingApprovals default limit', () => api.listPendingApprovals(), '/edge-api/v1/approvals/pending?limit=100', 'GET', undefined],
    ['listPendingApprovals custom',        () => api.listPendingApprovals(25), '/edge-api/v1/approvals/pending?limit=25', 'GET', undefined],
    ['approveOperation',  () => api.approveOperation('op1'),     '/edge-api/v1/approvals/op1/approve',  'POST',   undefined],
    ['rejectOperation',   () => api.rejectOperation('op1', 'bad'), '/edge-api/v1/approvals/op1/reject', 'POST',   { reason: 'bad' }],
    ['listWorkflows',     () => api.listWorkflows(),             '/edge-api/v1/workflows',              'GET',    undefined],
    ['getWorkflow',       () => api.getWorkflow('wf-1'),         '/edge-api/v1/workflows/wf-1',         'GET',    undefined],
    ['saveWorkflow new',  () => api.saveWorkflow({
      displayName: 'wf', boundMetadataId: 'ds1', enabled: true,
      steps: [], dependencies: [],
    }), '/edge-api/v1/workflows', 'POST', {
      displayName: 'wf', boundMetadataId: 'ds1', enabled: true,
      steps: [], dependencies: [],
    }],
    ['saveWorkflow update',  () => api.saveWorkflow({
      workflowId: 'wf-7', displayName: 'wf', boundMetadataId: 'ds1', enabled: true,
    }), '/edge-api/v1/workflows/wf-7', 'PUT', {
      workflowId: 'wf-7', displayName: 'wf', boundMetadataId: 'ds1', enabled: true,
    }],
    ['deleteWorkflow',    () => api.deleteWorkflow('wf-1'),      '/edge-api/v1/workflows/wf-1',         'DELETE', undefined],
    ['listWorkflowRuns',  () => api.listWorkflowRuns('wf-1'),    '/edge-api/v1/workflows/wf-1/runs',    'GET',    undefined],
    ['listDevices',       () => api.listDevices(),               '/edge-api/v1/devices',                'GET',    undefined],
    ['approveDevice',     () => api.approveDevice('dvc'),        '/edge-api/v1/devices/dvc/approve',    'POST',   undefined],
    ['suspendDevice',     () => api.suspendDevice('dvc'),        '/edge-api/v1/devices/dvc/suspend',    'POST',   undefined],
    ['revokeDevice',      () => api.revokeDevice('dvc'),         '/edge-api/v1/devices/dvc/revoke',     'POST',   undefined],
    ['deleteDevice',      () => api.deleteDevice('dvc'),         '/edge-api/v1/devices/dvc',            'DELETE', undefined],
    ['analyticsSummary no args', () => api.analyticsSummary(),   '/edge-api/v1/analytics/summary',      'GET',    undefined],
    ['analyticsSummary filtered', () => api.analyticsSummary('ou-1', 'AGGREGATE'), '/edge-api/v1/analytics/summary?orgUnit=ou-1&kind=AGGREGATE', 'GET', undefined],
    ['analyticsRejections', () => api.analyticsRejections(100),   '/edge-api/v1/analytics/rejections?limit=100', 'GET', undefined],
    ['analyticsRefresh',  () => api.analyticsRefresh(),          '/edge-api/v1/analytics/refresh',      'POST',   undefined],
    ['verifyAuditChain',  () => api.verifyAuditChain(),          '/edge-api/v1/security/audit/verify',  'GET',    undefined],
    ['exportWorkflow',    () => api.exportWorkflow('wf-7'),      '/edge-api/v1/workflows/wf-7/export',  'GET',    undefined],
    ['importWorkflow dry',() => api.importWorkflow({
      schemaVersion: 1, displayName: 'x', boundMetadataKind: 'DATA_SET',
      boundMetadataId: 'ds', enabled: true, steps: [], dependencies: [],
    }, true), '/edge-api/v1/workflows/import?dryRun=true', 'POST', {
      schemaVersion: 1, displayName: 'x', boundMetadataKind: 'DATA_SET',
      boundMetadataId: 'ds', enabled: true, steps: [], dependencies: [],
    }],
    ['importWorkflow apply',() => api.importWorkflow({
      schemaVersion: 1, displayName: 'y', boundMetadataKind: 'PROGRAM',
      boundMetadataId: 'p1', enabled: true, steps: [], dependencies: [],
    }), '/edge-api/v1/workflows/import?dryRun=false', 'POST', {
      schemaVersion: 1, displayName: 'y', boundMetadataKind: 'PROGRAM',
      boundMetadataId: 'p1', enabled: true, steps: [], dependencies: [],
    }],
    ['listWorkflowContributions', () => api.listWorkflowContributions('run-9'),
      '/edge-api/v1/workflows/runs/run-9/contributions', 'GET', undefined],
    ['setJournalNextHop', () => api.setJournalNextHop('op-7', 'ou-dest'),
      '/edge-api/v1/journal/op-7/next-hop', 'POST', { orgUnitUid: 'ou-dest' }],
    ['listReferralInbox', () => api.listReferralInbox(50),
      '/edge-api/v1/referral/inbox?limit=50', 'GET', undefined],
    ['acceptReferralInbox', () => api.acceptReferralInbox('ib-9'),
      '/edge-api/v1/referral/inbox/ib-9/accept', 'POST', undefined],
    ['dismissReferralInbox', () => api.dismissReferralInbox('ib-9'),
      '/edge-api/v1/referral/inbox/ib-9/dismiss', 'POST', undefined],
  ])('%s hits the expected URL + method', async (_name, call, path, method, expectedBody) => {
    fetchMock.mockResolvedValue(respond(200, okJson));
    await call();
    const [actualPath, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(actualPath).toBe(path);
    expect(init.method).toBe(method);
    expect(init.credentials).toBe('include');
    if (expectedBody !== undefined) {
      expect(JSON.parse(init.body as string)).toEqual(expectedBody);
    } else {
      expect(init.body).toBeUndefined();
    }
  });
});

describe('edgeApi defaults', () => {
  it('recentActivity defaults limit to 20', async () => {
    fetchMock.mockResolvedValue(respond(200, { entries: [] }));
    await api.recentActivity();
    expect(fetchMock.mock.calls[0]![0]).toBe('/edge-api/v1/activity/recent?limit=20');
  });
  it('listConflicts defaults limit to 100', async () => {
    fetchMock.mockResolvedValue(respond(200, []));
    await api.listConflicts();
    expect(fetchMock.mock.calls[0]![0]).toBe('/edge-api/v1/journal/conflicts?limit=100');
  });
  it('listJobs defaults limit to 50', async () => {
    fetchMock.mockResolvedValue(respond(200, []));
    await api.listJobs();
    expect(fetchMock.mock.calls[0]![0]).toBe('/edge-api/v1/sync/jobs?limit=50');
  });
  it('compatHistory defaults limit to 20', async () => {
    fetchMock.mockResolvedValue(respond(200, { snapshots: [] }));
    await api.compatHistory();
    expect(fetchMock.mock.calls[0]![0]).toBe('/edge-api/v1/compat/history?limit=20');
  });
  it('readAggregateValues builds the orgUnit+period query', async () => {
    fetchMock.mockResolvedValue(respond(200, { dataValues: [] }));
    await api.readAggregateValues('ou-1', '202604');
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('orgUnit=ou-1');
    expect(url).toContain('period=202604');
    expect(url).toContain('limit=500');
  });
  it('listEvents + listTrackerEvents build the program+orgUnit query', async () => {
    fetchMock.mockResolvedValue(respond(200, { events: [], total: 0 }));
    await api.listEvents('prg', 'ou');
    expect(fetchMock.mock.calls[0]![0]).toContain('/api/events?');

    fetchMock.mockResolvedValue(respond(200, { instances: [], total: 0 }));
    await api.listTrackerEvents('prg', 'ou', 25);
    expect(fetchMock.mock.calls[1]![0]).toContain('/api/tracker/events?');
    expect(fetchMock.mock.calls[1]![0]).toContain('pageSize=25');
  });
  it('resolveConflict allows omitting rationale', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.resolveConflict('x', 'REJECTED');
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ outcome: 'REJECTED' });
  });
});

/* Batch request-wrapper tests for untested helpers. */
describe('edgeApi wrappers — batch coverage', () => {
  it('signIn POSTs credentials to /auth/login', async () => {
    fetchMock.mockResolvedValue(respond(200, { userId: 'u1' }));
    await api.signIn('alice', 'password');
    expect(fetchMock.mock.calls[0]![0]).toBe('/edge-api/v1/auth/sign-in');
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string))
      .toEqual({ username: 'alice', password: 'password' });
  });

  it('signOut POSTs to /auth/logout', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.signOut();
    expect(fetchMock.mock.calls[0]![0]).toBe('/edge-api/v1/auth/sign-out');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('session GETs /auth/session', async () => {
    fetchMock.mockResolvedValue(respond(200, { userId: 'u1' }));
    await api.session();
    expect(fetchMock.mock.calls[0]![0]).toBe('/edge-api/v1/auth/session');
  });

  it('triggerMetadataSync POSTs to /sync/metadata', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.triggerMetadataSync();
    expect(fetchMock.mock.calls[0]![0])
      .toBe('/edge-api/v1/sync/metadata');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('compat GETs /compat', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.compat();
    expect(fetchMock.mock.calls[0]![0]).toBe('/edge-api/v1/compat');
  });

  it('dhis2Ping GETs /dhis2/ping', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.dhis2Ping();
    expect(fetchMock.mock.calls[0]![0]).toBe('/edge-api/v1/dhis2/ping');
  });

  it('refreshCompat POSTs to /compat/refresh', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.refreshCompat();
    expect(fetchMock.mock.calls[0]![0]).toBe('/edge-api/v1/compat/refresh');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('drift GETs /sync/drift (with refresh query)', async () => {
    fetchMock.mockResolvedValue(respond(200, { snapshots: [] }));
    await api.drift();
    expect(fetchMock.mock.calls[0]![0])
      .toContain('/edge-api/v1/sync/drift');
  });

  it('getJobRun GETs /sync/jobs/<runId>', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.getJobRun(42);
    expect(fetchMock.mock.calls[0]![0]).toBe('/edge-api/v1/sync/jobs/42');
  });

  it('triggerJob POSTs to /sync/jobs/<name>/trigger', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.triggerJob('JOURNAL_WORKER_DRAIN');
    expect(fetchMock.mock.calls[0]![0])
      .toBe('/edge-api/v1/sync/jobs/JOURNAL_WORKER_DRAIN/trigger');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('fetchJournalOperation GETs /journal/operations/<id>', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.fetchJournalOperation('op-123');
    expect(fetchMock.mock.calls[0]![0])
      .toBe('/edge-api/v1/journal/operations/op-123');
  });

  it('retryOperation POSTs to /admin/ops/journal/<id>/retry', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.retryOperation('op-xyz');
    expect(fetchMock.mock.calls[0]![0])
      .toContain('/op-xyz');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('listDrafts GETs /drafts', async () => {
    fetchMock.mockResolvedValue(respond(200, { drafts: [] }));
    await api.listDrafts();
    expect(fetchMock.mock.calls[0]![0]).toBe('/edge-api/v1/drafts');
  });

  it('deleteDraft DELETEs /drafts/<id>', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.deleteDraft('d-1');
    expect(fetchMock.mock.calls[0]![0]).toBe('/edge-api/v1/drafts/d-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('DELETE');
  });

  it('publishDraft POSTs to /drafts/<id>/publish', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.publishDraft('d-1');
    expect(fetchMock.mock.calls[0]![0])
      .toBe('/edge-api/v1/drafts/d-1/publish');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('cancelDraftSchedule DELETEs the draft schedule', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.cancelDraftSchedule('d-1');
    expect(fetchMock.mock.calls[0]![0])
      .toBe('/edge-api/v1/drafts/d-1/schedule');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('DELETE');
  });

  it('listConflicts respects a custom limit', async () => {
    fetchMock.mockResolvedValue(respond(200, []));
    await api.listConflicts(25);
    expect(fetchMock.mock.calls[0]![0])
      .toBe('/edge-api/v1/journal/conflicts?limit=25');
  });

  it('listJobs respects a custom limit', async () => {
    fetchMock.mockResolvedValue(respond(200, []));
    await api.listJobs(10);
    expect(fetchMock.mock.calls[0]![0])
      .toBe('/edge-api/v1/sync/jobs?limit=10');
  });

  it('listLocalAggregate builds querystring from filter fields', async () => {
    fetchMock.mockResolvedValue(respond(200, { pipeline: {}, rows: [] }));
    await api.listLocalAggregate({
      period: '202411', dataSet: 'ds-1',
      workflowRunId: 'wfr-1', limit: 200,
    });
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('period=202411');
    expect(url).toContain('dataSet=ds-1');
    expect(url).toContain('workflowRunId=wfr-1');
    expect(url).toContain('limit=200');
  });

  it('getLocalAggregate GETs the value id', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.getLocalAggregate('val-1');
    expect(fetchMock.mock.calls[0]![0])
      .toContain('/edge-api/v1/data/aggregate/val-1');
  });

  it('getLocalEvent GETs the event id', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.getLocalEvent('ev-1');
    expect(fetchMock.mock.calls[0]![0])
      .toContain('/edge-api/v1/data/events/ev-1');
  });

  it('getLocalTei GETs the tei uid', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.getLocalTei('tei-1');
    expect(fetchMock.mock.calls[0]![0])
      .toContain('/edge-api/v1/data/tracker/tei/tei-1');
  });

  it('listLocalEvents builds querystring from filter fields', async () => {
    fetchMock.mockResolvedValue(respond(200, { rows: [] }));
    await api.listLocalEvents({
      program: 'PROG-1', programStage: 'PS-1',
      status: 'ACTIVE', limit: 100,
    });
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('program=PROG-1');
    expect(url).toContain('programStage=PS-1');
    expect(url).toContain('status=ACTIVE');
    expect(url).toContain('limit=100');
  });

  it('listLocalTracker builds querystring with kind + program filters', async () => {
    fetchMock.mockResolvedValue(respond(200, { rows: [] }));
    await api.listLocalTracker({
      kind: 'TEI', program: 'PROG-1', limit: 50,
    });
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('kind=TEI');
    expect(url).toContain('program=PROG-1');
    expect(url).toContain('limit=50');
  });

  it('aggregateRowPayload GETs the row-payload endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.aggregateRowPayload('val-1');
    expect(fetchMock.mock.calls[0]![0])
      .toContain('/edge-api/v1/data/aggregate/val-1/payload');
  });

  it('eventRowPayload GETs the event payload endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.eventRowPayload('ev-1');
    expect(fetchMock.mock.calls[0]![0])
      .toContain('/edge-api/v1/data/events/ev-1/payload');
  });

  it('teiRowPayload GETs the tei payload endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.teiRowPayload('tei-1');
    expect(fetchMock.mock.calls[0]![0])
      .toContain('/edge-api/v1/data/tracker/tei/tei-1/payload');
  });

  it('listJournalOperations respects a custom limit', async () => {
    fetchMock.mockResolvedValue(respond(200, []));
    await api.listJournalOperations(42);
    expect(fetchMock.mock.calls[0]![0])
      .toContain('/edge-api/v1/journal/operations?limit=42');
  });

  it('metadataList GETs the resource endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.metadataList('dataSets');
    expect(fetchMock.mock.calls[0]![0])
      .toContain('/dataSets');
  });

  it('reachabilityStatus GETs /dhis2/reachability', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.reachabilityStatus();
    expect(fetchMock.mock.calls[0]![0])
      .toBe('/edge-api/v1/dhis2/reachability');
  });

  it('scopeAudit GETs the scope-audit endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.scopeAudit();
    expect(fetchMock.mock.calls[0]![0])
      .toContain('scope');
  });

  it('fetchLastJournalPurge GETs the last-purge endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, null));
    await api.fetchLastJournalPurge();
    expect(fetchMock.mock.calls[0]![0])
      .toContain('purge');
  });

  it('fetchDataPullCursors GETs the cursors endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { cursors: [] }));
    await api.fetchDataPullCursors();
    expect(fetchMock.mock.calls[0]![0])
      .toContain('cursor');
  });

  it('retryBatch POSTs an array of operation ids', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.retryBatch(['op-1', 'op-2']);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string))
      .toMatchObject({ operationIds: ['op-1', 'op-2'] });
  });

  it('retryRun POSTs to the run retry endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.retryRun('run-1');
    expect(fetchMock.mock.calls[0]![0]).toContain('run-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('journalStatsByType GETs the stats endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.journalStatsByType();
    expect(fetchMock.mock.calls[0]![0])
      .toContain('journal');
  });

  it('listReferralInbox GETs /referrals/inbox', async () => {
    fetchMock.mockResolvedValue(respond(200, { entries: [] }));
    await api.listReferralInbox();
    expect(fetchMock.mock.calls[0]![0]).toContain('referral');
  });

  it('acceptReferralInbox POSTs to accept endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.acceptReferralInbox('inbox-1');
    expect(fetchMock.mock.calls[0]![0]).toContain('inbox-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('workerHealth GETs the worker status endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.workerHealth();
    expect(fetchMock.mock.calls[0]![0]).toContain('worker');
  });

  it('pauseWorker POSTs to the pause endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.pauseWorker();
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
    expect(fetchMock.mock.calls[0]![0]).toContain('pause');
  });

  it('resumeWorker POSTs to the resume endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.resumeWorker();
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
    expect(fetchMock.mock.calls[0]![0]).toContain('resume');
  });

  it('listUsers GETs the users endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { users: [] }));
    await api.listUsers();
    expect(fetchMock.mock.calls[0]![0]).toContain('user');
  });

  it('listApps GETs the apps endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { apps: [] }));
    await api.listApps();
    expect(fetchMock.mock.calls[0]![0]).toContain('app');
  });

  it('setAppEnabled POSTs enabled state', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.setAppEnabled('app-1', true);
    expect(fetchMock.mock.calls[0]![0]).toContain('app-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('listBackups GETs the backups endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { runs: [] }));
    await api.listBackups();
    expect(fetchMock.mock.calls[0]![0]).toContain('backup');
  });

  it('requestBackup POSTs a backup kind', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.requestBackup('FULL');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
    expect(fetchMock.mock.calls[0]![0]).toContain('backup');
  });

  it('listRestores GETs the restores endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { runs: [] }));
    await api.listRestores();
    expect(fetchMock.mock.calls[0]![0]).toContain('restore');
  });

  it('diagnostics GETs the diagnostics endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.diagnostics();
    expect(fetchMock.mock.calls[0]![0]).toContain('diagnost');
  });

  it('systemInfo GETs /system/info', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.systemInfo();
    expect(fetchMock.mock.calls[0]![0]).toBe('/edge-api/v1/system/info');
  });

  it('readSettings GETs /settings', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.readSettings();
    expect(fetchMock.mock.calls[0]![0]).toContain('setting');
  });

  it('saveSettings PUTs settings body', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.saveSettings({ foo: 'bar' } as never);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toMatch(/PUT|POST/);
    expect(JSON.parse(init.body as string)).toEqual({ foo: 'bar' });
  });

  it('listOrgUnitLevels GETs /organisationUnitLevels', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.listOrgUnitLevels();
    expect(fetchMock.mock.calls[0]![0]).toContain('organisationUnitLevels');
  });

  it('adminShutdown POSTs to the shutdown endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.adminShutdown();
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
    expect(fetchMock.mock.calls[0]![0]).toContain('shutdown');
  });

  it('adminRestart POSTs to the restart endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.adminRestart();
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
    expect(fetchMock.mock.calls[0]![0]).toContain('restart');
  });

  it('adminClearSessions POSTs to the clear-sessions endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.adminClearSessions();
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
    expect(fetchMock.mock.calls[0]![0]).toContain('session');
  });

  it('adminLogs GETs the log tail endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { entries: [] }));
    await api.adminLogs(50);
    expect(fetchMock.mock.calls[0]![0]).toContain('log');
  });

  it('getOrgUnitBinding GETs the org-unit endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.getOrgUnitBinding();
    expect(fetchMock.mock.calls[0]![0]).toContain('org-unit');
  });

  it('bindOrgUnit POSTs the orgUnit id', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.bindOrgUnit('OU-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('listOrgUnits GETs the OU list', async () => {
    fetchMock.mockResolvedValue(respond(200, { items: [] }));
    await api.listOrgUnits();
    expect(fetchMock.mock.calls[0]![0]).toContain('organisation');
  });

  it('listPendingApprovals GETs the approvals endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { rows: [] }));
    await api.listPendingApprovals();
    expect(fetchMock.mock.calls[0]![0]).toContain('approval');
  });

  it('listWorkflows GETs the workflows endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { workflows: [] }));
    await api.listWorkflows();
    expect(fetchMock.mock.calls[0]![0]).toContain('workflow');
  });

  it('getWorkflow GETs by id', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.getWorkflow('wf-1');
    expect(fetchMock.mock.calls[0]![0]).toContain('wf-1');
  });
});
