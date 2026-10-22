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
