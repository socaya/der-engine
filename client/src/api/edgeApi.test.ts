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

describe('edgeApi.signIn', () => {
  it('returns the parsed user on 200', async () => {
    fetchMock.mockResolvedValue(respond(200, {
      userId: 'u', username: 'alice', displayName: 'Alice', roles: ['OPERATOR'], expiresAt: '2026-10-22',
    }));
    const user = await api.signIn('alice', 'pw');
    expect(user.username).toBe('alice');
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/edge-api/v1/auth/sign-in');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body as string)).toEqual({ username: 'alice', password: 'pw' });
  });

  it('maps 401 to INVALID_CREDENTIALS', async () => {
    fetchMock.mockResolvedValue(respond(401));
    await expect(api.signIn('a', 'b')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', status: 401 });
  });

  it('maps 429 to RATE_LIMITED', async () => {
    fetchMock.mockResolvedValue(respond(429));
    await expect(api.signIn('a', 'b')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('maps 503 to EDGE_UNREACHABLE', async () => {
    fetchMock.mockResolvedValue(respond(503));
    await expect(api.signIn('a', 'b')).rejects.toMatchObject({ code: 'EDGE_UNREACHABLE' });
  });

  it('maps other 4xx to UNKNOWN', async () => {
    fetchMock.mockResolvedValue(respond(418));
    await expect(api.signIn('a', 'b')).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  it('maps fetch rejection to EDGE_UNREACHABLE', async () => {
    fetchMock.mockRejectedValue(new TypeError('network'));
    await expect(api.signIn('a', 'b')).rejects.toMatchObject({ code: 'EDGE_UNREACHABLE' });
  });
});

describe('edgeApi other methods', () => {
  it('signOut returns undefined on 204', async () => {
    fetchMock.mockResolvedValue(respond(204));
    await expect(api.signOut()).resolves.toBeUndefined();
  });

  it('session hits GET /edge-api/v1/auth/session', async () => {
    fetchMock.mockResolvedValue(respond(200, {
      userId: 'u', username: 'alice', displayName: 'Alice', roles: [], expiresAt: 'x',
    }));
    const user = await api.session();
    expect(user.userId).toBe('u');
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/edge-api/v1/auth/session');
    expect(init.method).toBe('GET');
  });

  it('triggerMetadataSync returns the summary', async () => {
    fetchMock.mockResolvedValue(respond(200, {
      status: 'OK', snapshotId: 1, total: 10,
      organisationUnits: 2, dataElements: 3, dataSets: 1, programs: 3, trackedEntityTypes: 1,
      centralVersion: '2.44-SNAPSHOT', centralRevision: 'r', fingerprint: 'f', message: null,
    }));
    const sync = await api.triggerMetadataSync();
    expect(sync.total).toBe(10);
  });

  it('health passes through', async () => {
    fetchMock.mockResolvedValue(respond(200, {
      service: 'der-server', status: 'starter-ready', version: '0.4.0', dhis2Integrated: false,
      dhis2Reference: { version: '2.44-SNAPSHOT' }, timestamp: 'x',
    }));
    const h = await api.health();
    expect(h.service).toBe('der-server');
  });

  it('recentActivity passes query string', async () => {
    fetchMock.mockResolvedValue(respond(200, { entries: [] }));
    await api.recentActivity(42);
    const [path] = fetchMock.mock.calls[0] as [string];
    expect(path).toBe('/edge-api/v1/activity/recent?limit=42');
  });

  it('recentActivity defaults to limit=20', async () => {
    fetchMock.mockResolvedValue(respond(200, { entries: [] }));
    await api.recentActivity();
    const [path] = fetchMock.mock.calls[0] as [string];
    expect(path).toBe('/edge-api/v1/activity/recent?limit=20');
  });

  it('passes GET without body headers', async () => {
    fetchMock.mockResolvedValue(respond(200, { entries: [] }));
    await api.recentActivity();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual({ Accept: 'application/json' });
    expect(init.body).toBeUndefined();
  });

  it('empty-body 2xx returns undefined', async () => {
    fetchMock.mockResolvedValue(respond(200, undefined, ''));
    await expect(api.signOut()).resolves.toBeUndefined();
  });
});

describe('EdgeApiError', () => {
  it('carries status, code, message', () => {
    const err = new api.EdgeApiError(503, 'EDGE_UNREACHABLE', 'down');
    expect(err.status).toBe(503);
    expect(err.code).toBe('EDGE_UNREACHABLE');
    expect(err.message).toBe('down');
    expect(err.name).toBe('EdgeApiError');
  });
});

describe('edgeApi.metadataList', () => {
  it('reads from /api/<resource>', async () => {
    fetchMock.mockResolvedValue(respond(200, { dataSets: [{ id: 'x', displayName: 'X' }] }));
    const r = await api.metadataList('dataSets');
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/dataSets?fields=id,displayName&paging=false');
    expect(r).toHaveProperty('dataSets');
  });
});

describe('edgeApi.readAggregateValues', () => {
  it('issues the orgUnit+period query', async () => {
    fetchMock.mockResolvedValue(respond(200, { dataValues: [] }));
    await api.readAggregateValues('ou-1', '202604');
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('orgUnit=ou-1');
    expect(url).toContain('period=202604');
    expect(url).toContain('limit=500');
  });
});

describe('edgeApi.submitAggregate', () => {
  it('POSTs dataValueSets', async () => {
    fetchMock.mockResolvedValue(respond(200, { status: 'OK' }));
    const summary = await api.submitAggregate({ dataValues: [] });
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/dataValueSets');
    expect(init.method).toBe('POST');
    expect(summary.status).toBe('OK');
  });
});

describe('edgeApi.listEvents', () => {
  it('issues /api/events with program+orgUnit', async () => {
    fetchMock.mockResolvedValue(respond(200, { events: [], total: 0 }));
    await api.listEvents('prg', 'ou');
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('program=prg');
    expect(url).toContain('orgUnit=ou');
    expect(url).toContain('pageSize=100');
  });
});

describe('edgeApi.listTrackerEvents', () => {
  it('issues /api/tracker/events with program+orgUnit', async () => {
    fetchMock.mockResolvedValue(respond(200, { instances: [], total: 0 }));
    await api.listTrackerEvents('prg', 'ou', 50);
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('/api/tracker/events?');
    expect(url).toContain('pageSize=50');
  });
});

describe('edgeApi drafts', () => {
  it('listDrafts GETs /edge-api/v1/drafts', async () => {
    fetchMock.mockResolvedValue(respond(200, { drafts: [] }));
    await api.listDrafts();
    expect(fetchMock.mock.calls[0]![0]).toBe('/edge-api/v1/drafts');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe('GET');
  });

  it('saveDraft POSTs with body', async () => {
    fetchMock.mockResolvedValue(respond(200, { draftId: 'd', kind: 'K', title: 'T', payload: {}, updatedAt: '' }));
    await api.saveDraft({ kind: 'K', title: 'T', payload: {} });
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/edge-api/v1/drafts');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({ kind: 'K', title: 'T' });
  });

  it('deleteDraft DELETEs by id', async () => {
    fetchMock.mockResolvedValue(respond(204));
    await api.deleteDraft('abc');
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/edge-api/v1/drafts/abc');
    expect(init.method).toBe('DELETE');
  });
});

describe('edgeApi request error paths', () => {
  it('wraps network failures as EDGE_UNREACHABLE', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(api.health()).rejects.toMatchObject({ code: 'EDGE_UNREACHABLE', status: 0 });
  });

  it('maps 4xx (other than 401/429) to UNKNOWN', async () => {
    fetchMock.mockResolvedValue(respond(418));
    await expect(api.signIn('a', 'b')).rejects.toMatchObject({ code: 'UNKNOWN', status: 418 });
  });

  it('maps 500+ to EDGE_UNREACHABLE', async () => {
    fetchMock.mockResolvedValue(respond(500));
    await expect(api.health()).rejects.toMatchObject({ code: 'EDGE_UNREACHABLE', status: 500 });
  });

  it('returns undefined on ok empty-body', async () => {
    fetchMock.mockResolvedValue(respond(200, undefined, ''));
    await expect(api.deleteDraft('x')).resolves.toBeUndefined();
  });
});
