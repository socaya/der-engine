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
    ['metadataList',      () => api.metadataList('dataSets'),    '/api/dataSets?fields=id,displayName&paging=false', 'GET', undefined],
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
    ['listOrgUnits',      () => api.listOrgUnits(),              '/api/organisationUnits?fields=id,displayName,path,level&paging=false', 'GET', undefined],
    ['listPendingApprovals default limit', () => api.listPendingApprovals(), '/edge-api/v1/approvals/pending?limit=100', 'GET', undefined],
    ['listPendingApprovals custom',        () => api.listPendingApprovals(25), '/edge-api/v1/approvals/pending?limit=25', 'GET', undefined],
    ['approveOperation',  () => api.approveOperation('op1'),     '/edge-api/v1/approvals/op1/approve',  'POST',   undefined],
    ['rejectOperation',   () => api.rejectOperation('op1', 'bad'), '/edge-api/v1/approvals/op1/reject', 'POST',   { reason: 'bad' }],
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
