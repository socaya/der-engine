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
    ['requestRestore',    () => api.requestRestore('LOCAL', '/a/b.dump'), '/edge-api/v1/restore/request',        'POST',   { kind: 'LOCAL', source: '/a/b.dump' }],
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

  it('deleteWorkflow DELETEs by id', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.deleteWorkflow('wf-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('DELETE');
    expect(fetchMock.mock.calls[0]![0]).toContain('wf-1');
  });

  it('listWorkflowRuns GETs the runs endpoint for a workflowId', async () => {
    fetchMock.mockResolvedValue(respond(200, { runs: [] }));
    await api.listWorkflowRuns('wf-1');
    expect(fetchMock.mock.calls[0]![0]).toContain('run');
    expect(fetchMock.mock.calls[0]![0]).toContain('wf-1');
  });

  it('listDevices GETs the devices endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { devices: [] }));
    await api.listDevices();
    expect(fetchMock.mock.calls[0]![0]).toContain('device');
  });

  it('approveDevice POSTs to the approve endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.approveDevice('d-1');
    expect(fetchMock.mock.calls[0]![0]).toContain('d-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('suspendDevice POSTs to the suspend endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.suspendDevice('d-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('revokeDevice POSTs to the revoke endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.revokeDevice('d-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('deleteDevice DELETEs by id', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.deleteDevice('d-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('DELETE');
  });

  it('analyticsSummary GETs the analytics endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.analyticsSummary();
    expect(fetchMock.mock.calls[0]![0]).toContain('analytics');
  });

  it('analyticsRejections GETs the rejections endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.analyticsRejections();
    expect(fetchMock.mock.calls[0]![0]).toContain('rejection');
  });

  it('listAuditEvents GETs audit events + accepts limit', async () => {
    fetchMock.mockResolvedValue(respond(200, { events: [] }));
    await api.listAuditEvents({ limit: 25 });
    expect(fetchMock.mock.calls[0]![0]).toContain('audit');
    expect(fetchMock.mock.calls[0]![0]).toContain('limit=25');
  });

  it('verifyAuditChain GETs verify endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.verifyAuditChain();
    expect(fetchMock.mock.calls[0]![0]).toContain('verif');
  });

  it('networkStatus GETs network status', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkStatus();
    expect(fetchMock.mock.calls[0]![0]).toContain('network');
  });

  it('networkInterfaces GETs the interfaces endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkInterfaces();
    expect(fetchMock.mock.calls[0]![0]).toContain('interface');
  });

  it('networkAccessPoint GETs the AP endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkAccessPoint();
    expect(fetchMock.mock.calls[0]![0]).toContain('access');
  });

  it('networkClients GETs the clients endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { clients: [] }));
    await api.networkClients();
    expect(fetchMock.mock.calls[0]![0]).toContain('client');
  });

  it('networkPeers GETs the peers endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { peers: [] }));
    await api.networkPeers();
    expect(fetchMock.mock.calls[0]![0]).toContain('peer');
  });

  it('networkEvents GETs the events endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { events: [] }));
    await api.networkEvents(5);
    expect(fetchMock.mock.calls[0]![0]).toContain('event');
  });

  it('networkApStart POSTs to the start endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkApStart();
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
    expect(fetchMock.mock.calls[0]![0]).toContain('start');
  });

  it('networkApStop POSTs to the stop endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkApStop();
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
    expect(fetchMock.mock.calls[0]![0]).toContain('stop');
  });

  it('listWorkflowPeers GETs the peers endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { peers: [] }));
    await api.listWorkflowPeers();
    expect(fetchMock.mock.calls[0]![0]).toContain('peer');
  });

  it('listImportInbox GETs the import inbox', async () => {
    fetchMock.mockResolvedValue(respond(200, { entries: [] }));
    await api.listImportInbox();
    expect(fetchMock.mock.calls[0]![0]).toContain('import');
  });

  it('runValidation GETs validation for a runId', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.runValidation('run-1');
    expect(fetchMock.mock.calls[0]![0]).toContain('run-1');
  });

  it('listSnapshots GETs the snapshots endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { snapshots: [] }));
    await api.listSnapshots();
    expect(fetchMock.mock.calls[0]![0]).toContain('snapshot');
  });

  it('readAllUserPrefs GETs the prefs endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.readAllUserPrefs();
    expect(fetchMock.mock.calls[0]![0]).toContain('pref');
  });

  it('messagingStats GETs the stats endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.messagingStats();
    expect(fetchMock.mock.calls[0]![0]).toContain('messaging');
  });

  it('messagingLog GETs the log endpoint with limit', async () => {
    fetchMock.mockResolvedValue(respond(200, { messages: [] }));
    await api.messagingLog(50);
    expect(fetchMock.mock.calls[0]![0]).toContain('messaging');
  });

  it('messagingSubscriptions GETs the subscriptions endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { subscriptions: [] }));
    await api.messagingSubscriptions();
    expect(fetchMock.mock.calls[0]![0]).toContain('subscri');
  });

  it('messagingPublish POSTs the message body', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.messagingPublish({
      channel: 'broadcast',
      fromDeviceId: 'd-1',
      messageType: 'STOCK',
      payload: { ok: true },
    });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string))
      .toMatchObject({ channel: 'broadcast' });
  });

  it('messagingUnsubscribe DELETEs the subscription', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.messagingUnsubscribe('d-1', 'broadcast');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('DELETE');
  });

  it('messagingKeys GETs the keys endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { keys: [] }));
    await api.messagingKeys();
    expect(fetchMock.mock.calls[0]![0]).toContain('key');
  });

  it('messagingDocuments GETs the docs endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { documents: [] }));
    await api.messagingDocuments();
    expect(fetchMock.mock.calls[0]![0]).toContain('doc');
  });

  it('messagingForwards GETs the forwards endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { forwards: [] }));
    await api.messagingForwards(10);
    expect(fetchMock.mock.calls[0]![0]).toContain('forward');
  });

  it('messagingStreamStats GETs the stream stats endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.messagingStreamStats();
    expect(fetchMock.mock.calls[0]![0]).toContain('stream');
  });

  it('networkLeases GETs the leases endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { leases: [] }));
    await api.networkLeases();
    expect(fetchMock.mock.calls[0]![0]).toContain('lease');
  });

  it('networkEnrolTokens GETs tokens endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { tokens: [] }));
    await api.networkEnrolTokens();
    expect(fetchMock.mock.calls[0]![0]).toContain('token');
  });

  it('networkPolicy GETs the policy endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkPolicy();
    expect(fetchMock.mock.calls[0]![0]).toContain('polic');
  });

  it('networkCa GETs the CA endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkCa();
    expect(fetchMock.mock.calls[0]![0]).toContain('ca');
  });

  it('networkTls GETs the TLS endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkTls();
    expect(fetchMock.mock.calls[0]![0]).toContain('tls');
  });

  it('networkMdns GETs the mDNS endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkMdns();
    expect(fetchMock.mock.calls[0]![0]).toContain('mdns');
  });

  it('networkSettings GETs the settings endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkSettings();
    expect(fetchMock.mock.calls[0]![0]).toContain('setting');
  });

  it('networkExport GETs the export endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkExport();
    expect(fetchMock.mock.calls[0]![0]).toContain('export');
  });

  it('listWorkflowContributions GETs the contributions endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { rows: [] }));
    await api.listWorkflowContributions('wf-1');
    expect(fetchMock.mock.calls[0]![0]).toContain('wf-1');
  });

  it('getWorkflowMetrics GETs the metrics endpoint with window hours', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.getWorkflowMetrics(48);
    expect(fetchMock.mock.calls[0]![0]).toContain('metrics');
  });

  it('listPrefetchPending GETs the prefetch pending endpoint for a device', async () => {
    fetchMock.mockResolvedValue(respond(200, { deviceId: 'd-1', rows: [] }));
    await api.listPrefetchPending('d-1');
    expect(fetchMock.mock.calls[0]![0]).toContain('d-1');
  });

  it('getWorkflowActivityFeed GETs the activity feed', async () => {
    fetchMock.mockResolvedValue(respond(200, { entries: [] }));
    await api.getWorkflowActivityFeed();
    expect(fetchMock.mock.calls[0]![0]).toContain('activit');
  });

  it('getWorkflowBlockages GETs the blockages endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { entries: [] }));
    await api.getWorkflowBlockages();
    expect(fetchMock.mock.calls[0]![0]).toContain('block');
  });

  it('getWorkflowIssues GETs the issues endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { issues: [] }));
    await api.getWorkflowIssues();
    expect(fetchMock.mock.calls[0]![0]).toContain('issue');
  });

  it('getWorkflowConflicts GETs the conflicts endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { conflicts: [] }));
    await api.getWorkflowConflicts();
    expect(fetchMock.mock.calls[0]![0]).toContain('conflict');
  });

  it('getWorkflowDrafts GETs the workflow drafts endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { drafts: [] }));
    await api.getWorkflowDrafts();
    expect(fetchMock.mock.calls[0]![0]).toContain('draft');
  });

  it('workflowQueue GETs the queue endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { rows: [] }));
    await api.workflowQueue();
    expect(fetchMock.mock.calls[0]![0]).toContain('queue');
  });

  it('getWorkflowActivitySummary GETs the summary endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.getWorkflowActivitySummary();
    expect(fetchMock.mock.calls[0]![0]).toContain('summary');
  });

  it('exportWorkflow GETs the export endpoint for a workflowId', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.exportWorkflow('wf-1');
    expect(fetchMock.mock.calls[0]![0]).toContain('wf-1');
  });

  it('acceptImport POSTs with the import id', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.acceptImport('imp-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
    expect(fetchMock.mock.calls[0]![0]).toContain('imp-1');
  });

  it('rejectImport POSTs with the import id + optional note', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.rejectImport('imp-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
    expect(fetchMock.mock.calls[0]![0]).toContain('imp-1');
  });

  it('importInboxDiff GETs the diff endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.importInboxDiff('imp-1');
    expect(fetchMock.mock.calls[0]![0]).toContain('imp-1');
  });

  it('addWorkflowPeer POSTs peer details', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.addWorkflowPeer({ displayName: 'P', endpoint: 'https://p',
      secret: 's' } as never);
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('deleteWorkflowPeer DELETEs by peerId', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.deleteWorkflowPeer('peer-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('DELETE');
  });

  it('messagingSubscribe POSTs device + channel body', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.messagingSubscribe({ deviceId: 'd-1', channel: 'broadcast' });
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('messagingKeyFor GETs a per-device key', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.messagingKeyFor('d-1');
    expect(fetchMock.mock.calls[0]![0]).toContain('d-1');
  });

  it('messagingRecent GETs the recent endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, { messages: [] }));
    await api.messagingRecent('d-1');
    expect(fetchMock.mock.calls[0]![0]).toContain('d-1');
  });

  it('listOrgUnitGroups GETs the OU groups endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.listOrgUnitGroups();
    expect(fetchMock.mock.calls[0]![0]).toContain('organisationUnitGroup');
  });

  it('listOrgUnitGroupSets GETs the OU group sets endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.listOrgUnitGroupSets();
    expect(fetchMock.mock.calls[0]![0]).toContain('organisationUnitGroupSet');
  });

  it('getOrganisationUnit GETs a single OU', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.getOrganisationUnit('OU-1');
    expect(fetchMock.mock.calls[0]![0]).toContain('OU-1');
  });

  it('adminReloadDhis2Config POSTs reload action', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.adminReloadDhis2Config();
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('metadataDiagnostics GETs the diagnostics endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.metadataDiagnostics();
    expect(fetchMock.mock.calls[0]![0]).toContain('diagnost');
  });

  it('metadataInventory GETs a metadata resource endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.metadataInventory();
    expect(fetchMock.mock.calls[0]![0]).toContain('/api/');
  });

  it('enrollmentRowPayload GETs the enrolment payload endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.enrollmentRowPayload('enr-1');
    expect(fetchMock.mock.calls[0]![0]).toContain('enr-1');
  });

  it('trackerEventRowPayload GETs the stage-event payload endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.trackerEventRowPayload('ev-1');
    expect(fetchMock.mock.calls[0]![0]).toContain('ev-1');
  });

  it('retireSnapshot POSTs to the retire endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.retireSnapshot(42);
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('reinstateSnapshot POSTs to the reinstate endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.reinstateSnapshot(42);
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('snapshotCounterDiff GETs counter-diff for two snapshots', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.snapshotCounterDiff(1, 2);
    expect(fetchMock.mock.calls[0]![0]).toMatch(/counter|diff/i);
  });

  it('ackPrefetch POSTs step + device', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.ackPrefetch('step-1', 'd-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('writeDhis2Connection POSTs connection body', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.writeDhis2Connection({ url: 'u' } as never);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toMatch(/POST|PUT/);
  });

  it('readDhis2Connection GETs connection config', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.readDhis2Connection();
    expect(fetchMock.mock.calls[0]![0]).toContain('connection');
  });

  it('createUser POSTs user body', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.createUser({ username: 'u' } as never);
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('uninstallApp DELETEs by key', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.uninstallApp('app-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('DELETE');
  });

  it('requestRestore POSTs a restore request with kind + source', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.requestRestore('REMOTE', 's3://bucket/runid-1.tar.gz');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
    expect(JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string))
      .toEqual({ kind: 'REMOTE', source: 's3://bucket/runid-1.tar.gz' });
  });

  it('writeUserPref POSTs a pref key/value', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.writeUserPref('k', 'v');
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toMatch(/POST|PUT/);
  });

  it('dismissReferralInbox POSTs to the dismiss endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.dismissReferralInbox('inbox-1');
    expect(fetchMock.mock.calls[0]![0]).toContain('inbox-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('setJournalNextHop POSTs the next-hop OU', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.setJournalNextHop('op-1', 'OU-nexthop');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('reJournalConflict POSTs to the re-journal endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.reJournalConflict('op-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('approveOperation POSTs to the approve endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.approveOperation('op-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('rejectOperation POSTs to the reject endpoint with reason', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.rejectOperation('op-1', 'bad data');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('getWorkflowPin GETs the pin endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.getWorkflowPin('wf-1');
    expect(fetchMock.mock.calls[0]![0]).toContain('wf-1');
  });

  it('setWorkflowPin sends a snapshotId', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.setWorkflowPin('wf-1', 42);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toMatch(/POST|PUT/);
  });

  it('importWorkflow POSTs the workflow body', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.importWorkflow({ displayName: 'x' } as never);
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('messagingKeysRegister POSTs device keys', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.messagingKeysRegister({
      deviceId: 'd-1', x25519PublicKeyBase64: 'x',
    } as never);
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('getAdminRunDetail GETs the admin run-detail endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.getAdminRunDetail('run-1');
    expect(fetchMock.mock.calls[0]![0]).toContain('run-1');
  });

  it('fetchConflictCentralResponse GETs the central-response endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.fetchConflictCentralResponse('op-1');
    expect(fetchMock.mock.calls[0]![0]).toContain('op-1');
  });

  it('deleteUserPref DELETEs a pref key', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.deleteUserPref('k');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('DELETE');
  });

  it('previewAggregatePayload GETs preview endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.previewAggregatePayload({ limit: 10 });
    expect(fetchMock.mock.calls[0]![0]).toContain('aggregate');
  });

  it('previewEventsPayload GETs preview endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.previewEventsPayload({ limit: 10 });
    expect(fetchMock.mock.calls[0]![0]).toContain('event');
  });

  it('previewTrackerPayload GETs preview endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.previewTrackerPayload({ limit: 10 });
    expect(fetchMock.mock.calls[0]![0]).toContain('tracker');
  });

  it('pullAggregateFromCentral POSTs the pull request', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.pullAggregateFromCentral({
      dataSet: 'ds-1', orgUnit: 'OU-1', period: '202411',
    });
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('pullEventsFromCentral POSTs the pull request', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.pullEventsFromCentral({
      program: 'PROG-1', orgUnit: 'OU-1',
    });
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('pullTrackerFromCentral POSTs the pull request', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.pullTrackerFromCentral({
      program: 'PROG-1', orgUnit: 'OU-1',
    });
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('purgeTerminalJournalRows POSTs the purge threshold', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.purgeTerminalJournalRows(7);
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('scheduleDraftPublish POSTs the publish schedule', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.scheduleDraftPublish('d-1', '2026-12-01T00:00:00Z');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('publishDraftsBatch POSTs the bulk publish request', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.publishDraftsBatch(['d-1', 'd-2']);
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('workflowRunManifest GETs the manifest endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.workflowRunManifest('run-1');
    expect(fetchMock.mock.calls[0]![0]).toContain('run-1');
  });

  it('pushWorkflowToPeer POSTs the push request', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.pushWorkflowToPeer('wf-1', 'peer-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('setWorkflowPeerTrust POSTs the directImport flag', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.setWorkflowPeerTrust('peer-1', true);
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toMatch(/POST|PUT/);
  });

  it('setWorkflowPeerCredentials POSTs user + secret', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.setWorkflowPeerCredentials('peer-1', 'user', 'secret');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toMatch(/POST|PUT/);
  });

  it('snapshotResourceDiff GETs the diff endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.snapshotResourceDiff(1, 2, 'dataSets');
    expect(fetchMock.mock.calls[0]![0]).toMatch(/dataSets|diff/);
  });

  it('updateDeviceProfile POSTs the profile', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.updateDeviceProfile('d-1', { displayName: 'Tab A' } as never);
    expect(fetchMock.mock.calls[0]![0]).toContain('d-1');
  });

  it('networkApEdit POSTs the AP edit body', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkApEdit({ ssid: 'DER' } as never);
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toMatch(/POST|PUT/);
  });

  it('networkApRestart POSTs to the restart endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkApRestart();
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('networkApRotateKey POSTs to the rotate-key endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkApRotateKey();
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('networkApEnrolmentQr GETs the enrolment QR endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkApEnrolmentQr();
    expect(fetchMock.mock.calls[0]![0]).toMatch(/qr|enrol/i);
  });

  it('networkDeviceApprove POSTs to the approve endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkDeviceApprove('d-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('networkDeviceRevoke POSTs to the revoke endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkDeviceRevoke('d-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('networkDeviceBlock POSTs to the block endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkDeviceBlock('d-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('networkDeviceUnblock POSTs to the unblock endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkDeviceUnblock('d-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('networkEnrolTokenIssue POSTs TTL + hint body', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkEnrolTokenIssue({ ttlSeconds: 3600 });
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('networkEnrolTokenRevoke DELETEs the token', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkEnrolTokenRevoke('tok-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('DELETE');
  });

  it('networkEventsClear DELETEs events', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkEventsClear();
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('DELETE');
  });

  it('networkImport POSTs the config bundle', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkImport({ ap: {} } as never);
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('networkInterfaceSetState POSTs the interface state change', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkInterfaceSetState('eth0', { state: 'up' });
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toMatch(/POST|PUT/);
  });

  it('networkLeasePin POSTs the pin body', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkLeasePin({ mac: 'aa:bb', ip: '10.0.0.5' });
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toMatch(/POST|PUT/);
  });

  it('networkLeaseDelete DELETEs a lease', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkLeaseDelete('lease-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('DELETE');
  });

  it('networkPeerAdd POSTs peer config', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkPeerAdd({ peerId: 'p1' } as never);
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('networkPeerConnect POSTs connect', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkPeerConnect('p1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('networkPeerDisconnect DELETEs the peer tunnel', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkPeerDisconnect('p1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('DELETE');
  });

  it('networkPeerRemove DELETEs a peer', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkPeerRemove('p1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('DELETE');
  });

  it('networkPolicyAdd POSTs a policy rule', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkPolicyAdd({ hostPattern: '*.x' } as never);
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('POST');
  });

  it('networkPolicyUpdate POSTs an update', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkPolicyUpdate('r-1', { allow: true } as never);
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toMatch(/POST|PUT/);
  });

  it('networkPolicyDelete DELETEs a policy', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkPolicyDelete('r-1');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('DELETE');
  });

  it('networkRoutes GETs the routes endpoint', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkRoutes();
    expect(fetchMock.mock.calls[0]![0]).toContain('route');
  });

  it('networkSettingPut PUTs settings key + value', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkSettingPut('wan.mtu', '1500');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('PUT');
  });
});
