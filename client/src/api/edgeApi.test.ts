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
    const summary = await api.submitAggregate({ dataSet: 'DS', dataValues: [] });
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/dataValueSets');
    expect(init.method).toBe('POST');
    expect(summary.status).toBe('OK');
  });

  it('enqueues locally when the edge is unreachable mid-request', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const summary = await api.submitAggregate({ dataSet: 'DS', dataValues: [] });
    expect(summary.status).toBe('OFFLINE_QUEUED');
    expect((summary as { offlineQueueId?: number }).offlineQueueId).toEqual(expect.any(Number));
  });

  it('posts over LAN even when navigator.onLine is false', async () => {
    // WAN dropped (navigator.onLine=false) but the DER server on the
    // facility LAN / localhost is still reachable. The fetch succeeds,
    // so no queueing — writes land on the edge immediately. This is
    // the core offline-first invariant.
    const original = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', {
      configurable: true, get: () => false,
    });
    try {
      fetchMock.mockResolvedValue(respond(200, { status: 'OK' }));
      const summary = await api.submitAggregate({ dataSet: 'DS', dataValues: [] });
      expect(summary.status).toBe('OK');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true, get: () => original,
      });
    }
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

describe('edgeApi device helpers', () => {
  it('enrollDevice POSTs deviceId + userAgent', async () => {
    fetchMock.mockResolvedValue(respond(201, {
      deviceId: 'd1', assignedUserId: null, enrolledAt: 'x',
      lastSeenAt: null, userAgent: 'ua', status: 'PENDING',
    }));
    const r = await api.enrollDevice('d1', 'chrome');
    expect(r.deviceId).toBe('d1');
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/edge-api/v1/devices/enroll');
    expect(JSON.parse(init.body as string)).toEqual({ deviceId: 'd1', userAgent: 'chrome' });
  });

  it('heartbeatDevice POSTs /{id}/heartbeat', async () => {
    fetchMock.mockResolvedValue(respond(200, { outcome: 'OK' }));
    await api.heartbeatDevice('d1');
    expect(fetchMock.mock.calls[0]![0]).toBe('/edge-api/v1/devices/d1/heartbeat');
  });

  it('fetchDevice GETs /{id}', async () => {
    fetchMock.mockResolvedValue(respond(200, { deviceId: 'd1', status: 'APPROVED' }));
    await api.fetchDevice('d1');
    expect(fetchMock.mock.calls[0]![0]).toBe('/edge-api/v1/devices/d1');
  });
});

describe('edgeApi.runValidation', () => {
  it('GETs /edge-api/v1/workflows/runs/{id}/validation', async () => {
    fetchMock.mockResolvedValue(respond(200, {
      runId: 'r1', errorCount: 0, issues: [],
    }));
    const r = await api.runValidation('r1');
    expect(r.runId).toBe('r1');
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/edge-api/v1/workflows/runs/r1/validation');
    expect(init.method).toBe('GET');
  });
});

function jsonRespond(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('edgeApi.listProgramRules', () => {
  it('pulls one page when pageCount is 1, scopes to a program when given', async () => {
    fetchMock.mockResolvedValueOnce(jsonRespond(200, {
      pager: { pageCount: 1 },
      programRules: [
        { id: 'R1', program: { id: 'P-mine' },
          condition: 'true', priority: 2,
          programRuleActions: [] },
        { id: 'R2', program: { id: 'P-other' },
          condition: 'true', priority: 1,
          programRuleActions: [] },
      ],
    }));
    const r = await api.listProgramRules('P-mine');
    expect(r.map((x) => x.id)).toEqual(['R1']);
    const [path] = fetchMock.mock.calls[0] as [string];
    expect(path).toContain('/api/programRules?fields=');
    expect(path).toContain('pageSize=500');
  });

  it('follows the pager across multiple pages', async () => {
    fetchMock.mockResolvedValueOnce(jsonRespond(200, {
      pager: { pageCount: 2 },
      programRules: [{ id: 'R1', condition: 'x' }],
    }));
    fetchMock.mockResolvedValueOnce(jsonRespond(200, {
      programRules: [{ id: 'R2', condition: 'y' }],
    }));
    const r = await api.listProgramRules();
    expect(r.map((x) => x.id)).toEqual(['R1', 'R2']);
    expect(fetchMock.mock.calls.length).toBe(2);
  });

  it('returns an empty list on HTTP error', async () => {
    fetchMock.mockResolvedValue(jsonRespond(500, { error: 'boom' }));
    const r = await api.listProgramRules();
    expect(r).toEqual([]);
  });

  it('handles a body without a programRules array', async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, {}));
    const r = await api.listProgramRules();
    expect(r).toEqual([]);
  });

  it('stops paging when a later page errors', async () => {
    fetchMock.mockResolvedValueOnce(jsonRespond(200, {
      pager: { pageCount: 3 },
      programRules: [{ id: 'R1', condition: 'x' }],
    }));
    fetchMock.mockResolvedValueOnce(jsonRespond(500, { error: 'boom' }));
    const r = await api.listProgramRules();
    expect(r.map((x) => x.id)).toEqual(['R1']);
  });
});

describe('edgeApi.listProgramRuleVariables', () => {
  it('scopes by program and passes the right fields= selector', async () => {
    fetchMock.mockResolvedValueOnce(jsonRespond(200, {
      pager: { pageCount: 1 },
      programRuleVariables: [
        { id: 'V1', program: { id: 'P1' },
          programRuleVariableSourceType: 'DATAELEMENT_CURRENT_EVENT' },
        { id: 'V2', program: { id: 'P2' },
          programRuleVariableSourceType: 'TEI_ATTRIBUTE' },
      ],
    }));
    const r = await api.listProgramRuleVariables('P1');
    expect(r.map((v) => v.id)).toEqual(['V1']);
    const [path] = fetchMock.mock.calls[0] as [string];
    expect(path).toContain('/api/programRuleVariables?fields=');
    expect(path).toContain('programRuleVariableSourceType');
  });

  it('returns all variables when no program filter is given', async () => {
    fetchMock.mockResolvedValueOnce(jsonRespond(200, {
      pager: { pageCount: 1 },
      programRuleVariables: [
        { id: 'V1' }, { id: 'V2' },
      ],
    }));
    const r = await api.listProgramRuleVariables();
    expect(r.map((v) => v.id)).toEqual(['V1', 'V2']);
  });

  it('returns an empty list on HTTP error', async () => {
    fetchMock.mockResolvedValue(jsonRespond(500, { error: 'boom' }));
    const r = await api.listProgramRuleVariables();
    expect(r).toEqual([]);
  });
});

describe('edgeApi.listPrograms', () => {
  it('maps DHIS2 programs into flat ProgramSummary records', async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, {
      programs: [
        { id: 'P1', displayName: 'Event prog A',
          programType: 'WITHOUT_REGISTRATION',
          trackedEntityType: null,
          organisationUnits: [{ id: 'OU1' }] },
        { id: 'P2', name: 'Tracker prog', // falls back from name
          programType: 'WITH_REGISTRATION',
          trackedEntityType: { id: 'TET1' },
          organisationUnits: [] },
      ],
    }));
    const r = await api.listPrograms();
    expect(r).toEqual([
      { id: 'P1', displayName: 'Event prog A',
        programType: 'WITHOUT_REGISTRATION',
        trackedEntityTypeId: null,
        orgUnitIds: ['OU1'] },
      { id: 'P2', displayName: 'Tracker prog',
        programType: 'WITH_REGISTRATION',
        trackedEntityTypeId: 'TET1',
        orgUnitIds: [] },
    ]);
    const [path] = fetchMock.mock.calls[0] as [string];
    expect(path).toContain('/api/programs?fields=');
    expect(path).toContain('paging=false');
  });

  it('filters to the bound OU when orgUnit is provided', async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, {
      programs: [
        { id: 'P1', displayName: 'A',
          programType: 'WITHOUT_REGISTRATION',
          organisationUnits: [{ id: 'OU-mine' }] },
        { id: 'P2', displayName: 'B',
          programType: 'WITHOUT_REGISTRATION',
          organisationUnits: [{ id: 'OU-other' }] },
        { id: 'P3', displayName: 'C',
          programType: 'WITHOUT_REGISTRATION',
          organisationUnits: [] }, // empty means "all OUs" — always kept
      ],
    }));
    const r = await api.listPrograms('OU-mine');
    expect(r.map((p) => p.id)).toEqual(['P1', 'P3']);
  });

  it('defaults programType to WITHOUT_REGISTRATION when missing / unknown', async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, {
      programs: [
        { id: 'P1', displayName: 'No type' },
        { id: 'P2', displayName: 'Weird',
          programType: 'SOMETHING_ELSE' },
      ],
    }));
    const r = await api.listPrograms();
    expect(r.every((p) => p.programType === 'WITHOUT_REGISTRATION')).toBe(true);
  });

  it('returns an empty list on HTTP error', async () => {
    fetchMock.mockResolvedValue(jsonRespond(500, { error: 'boom' }));
    const r = await api.listPrograms();
    expect(r).toEqual([]);
  });

  it('handles a body without a programs array', async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, {}));
    const r = await api.listPrograms();
    expect(r).toEqual([]);
  });

  it('falls back to id when neither displayName nor name is set', async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, {
      programs: [{ id: 'P-only' }],
    }));
    const r = await api.listPrograms();
    expect(r[0]!.displayName).toBe('P-only');
  });
});

describe('edgeApi.getOptionSet', () => {
  it('fetches an option set with code + displayName options', async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, {
      id: 'OS_sex', displayName: 'Sex',
      options: [
        { id: 'o-f', code: 'F', displayName: 'Female', sortOrder: 1 },
        { id: 'o-m', code: 'M', displayName: 'Male', sortOrder: 2 },
      ],
    }));
    const r = await api.getOptionSet('OS_sex');
    expect(r!.id).toBe('OS_sex');
    expect(r!.options!.length).toBe(2);
    const [path] = fetchMock.mock.calls[0] as [string];
    expect(path).toContain('/api/optionSets/OS_sex');
    expect(path).toContain('fields=id,displayName,name');
    expect(path).toContain('options[id,code,displayName');
  });

  it('URL-encodes the UID', async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, { id: 'X' }));
    await api.getOptionSet('a/b c');
    const [path] = fetchMock.mock.calls[0] as [string];
    expect(path).toContain('/api/optionSets/a%2Fb%20c');
  });

  it('returns null on HTTP error so the form can degrade', async () => {
    fetchMock.mockResolvedValue(jsonRespond(500, { error: 'boom' }));
    const r = await api.getOptionSet('OS1');
    expect(r).toBeNull();
  });
});

describe('edgeApi.submitEvent', () => {
  it('wraps the single event in the DHIS2 {events:[...]} envelope',
      async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, { status: 'SUCCESS' }));
    await api.submitEvent({
      program: 'P1', programStage: 'S1', orgUnit: 'OU1',
      occurredAt: '2026-11-08T00:00:00Z',
      dataValues: [{ dataElement: 'DE1', value: '5' }],
    });
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/events');
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body)) as {
      events: Array<{ program: string }>;
    };
    expect(Array.isArray(body.events)).toBe(true);
    expect(body.events.length).toBe(1);
    expect(body.events[0]!.program).toBe('P1');
  });
});

describe('edgeApi.enrolTei', () => {
  it('POSTs to the DER-native /edge-api/v1/tracked-entities path', async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, { teiUid: 'T1' }));
    await api.enrolTei({
      program: 'P1', orgUnit: 'OU1', trackedEntityType: 'TET1',
      attributes: [
        { attribute: 'TEA_first', value: 'Alice' },
        { attribute: 'TEA_last', value: 'Doe' },
      ],
    });
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/edge-api/v1/tracked-entities');
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body)) as {
      trackedEntityType: string; orgUnit: string;
      program: string; enrolledAt: string;
      attributes: Record<string, string>;
    };
    expect(body.trackedEntityType).toBe('TET1');
    expect(body.orgUnit).toBe('OU1');
    expect(body.program).toBe('P1');
    expect(body.enrolledAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.attributes).toEqual({
      TEA_first: 'Alice', TEA_last: 'Doe',
    });
  });

  it('uses the caller-supplied enrolledAt date when provided', async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, { teiUid: 'T2' }));
    await api.enrolTei({
      program: 'P1', orgUnit: 'OU1', trackedEntityType: 'TET1',
      enrolledAt: '2026-01-01',
      attributes: [],
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { enrolledAt: string };
    expect(body.enrolledAt).toBe('2026-01-01');
  });
});

describe('edgeApi.deleteTrackerRelationship', () => {
  it('sends DELETE to the relationships endpoint with an encoded UID',
      async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, { status: 'OK' }));
    const r = await api.deleteTrackerRelationship('a b/c');
    expect(r).toEqual({ ok: true });
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/tracker/relationships/a%20b%2Fc');
    expect(init.method).toBe('DELETE');
  });

  it('returns an error with the server message on HTTP failure',
      async () => {
    fetchMock.mockResolvedValue(jsonRespond(403,
      { message: 'not permitted' }));
    const r = await api.deleteTrackerRelationship('R1');
    expect(r).toEqual({ ok: false, status: 403,
      message: 'not permitted' });
  });

  it('falls back to HTTP <status> when no message is present',
      async () => {
    fetchMock.mockResolvedValue(jsonRespond(500, {}));
    const r = await api.deleteTrackerRelationship('R1');
    expect(r).toEqual({ ok: false, status: 500,
      message: 'HTTP 500' });
  });
});

describe('edgeApi.submitTrackerRelationship', () => {
  it('POSTs the DHIS2-shaped payload for a TEI↔TEI link', async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, { status: 'OK' }));
    const r = await api.submitTrackerRelationship({
      relationshipType: 'RT1', fromTei: 'TEI_A', toTei: 'TEI_B',
    });
    expect(r).toEqual({ ok: true });
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/tracker');
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body)) as {
      relationships: Array<{ relationshipType: string;
        from: { trackedEntity: { trackedEntity: string } };
        to:   { trackedEntity: { trackedEntity: string } } }>;
    };
    expect(body.relationships[0]!.relationshipType).toBe('RT1');
    expect(body.relationships[0]!.from.trackedEntity.trackedEntity)
      .toBe('TEI_A');
    expect(body.relationships[0]!.to.trackedEntity.trackedEntity)
      .toBe('TEI_B');
  });

  it('returns an error result with the server message on HTTP failure',
      async () => {
    fetchMock.mockResolvedValue(jsonRespond(400,
      { message: 'target not permitted' }));
    const r = await api.submitTrackerRelationship({
      relationshipType: 'RT1', fromTei: 'TEI_A', toTei: 'TEI_B',
    });
    expect(r).toEqual({ ok: false, status: 400,
      message: 'target not permitted' });
  });

  it('falls back to "HTTP <status>" when the error body has no message',
      async () => {
    fetchMock.mockResolvedValue(jsonRespond(500, {}));
    const r = await api.submitTrackerRelationship({
      relationshipType: 'RT1', fromTei: 'A', toTei: 'B',
    });
    expect(r).toEqual({ ok: false, status: 500, message: 'HTTP 500' });
  });

  it('survives an unparseable error body', async () => {
    fetchMock.mockResolvedValue({
      ok: false, status: 502, headers: new Headers(),
      json: async () => { throw new Error('bad json'); },
      text: async () => 'oops',
    } as unknown as Response);
    const r = await api.submitTrackerRelationship({
      relationshipType: 'RT1', fromTei: 'A', toTei: 'B',
    });
    expect(r).toEqual({ ok: false, status: 502, message: 'HTTP 502' });
  });
});

describe('edgeApi.listRelationshipTypes', () => {
  it('fetches relationship-type metadata with constraints', async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, {
      relationshipTypes: [
        { id: 'RT1', name: 'Parent of',
          bidirectional: false,
          fromConstraint: { relationshipEntity: 'TRACKED_ENTITY_INSTANCE',
            trackedEntityType: { id: 'TET1' } },
          toConstraint:  { relationshipEntity: 'TRACKED_ENTITY_INSTANCE',
            trackedEntityType: { id: 'TET1' } } },
      ],
    }));
    const r = await api.listRelationshipTypes();
    expect(r.length).toBe(1);
    expect(r[0]!.id).toBe('RT1');
    expect(r[0]!.fromConstraint?.trackedEntityType?.id).toBe('TET1');
    const [path] = fetchMock.mock.calls[0] as [string];
    expect(path).toContain('/api/relationshipTypes?fields=');
    expect(path).toContain('fromConstraint');
    expect(path).toContain('toConstraint');
    expect(path).toContain('paging=false');
  });

  it('returns an empty list on HTTP error', async () => {
    fetchMock.mockResolvedValue(jsonRespond(500, { error: 'boom' }));
    const r = await api.listRelationshipTypes();
    expect(r).toEqual([]);
  });

  it('returns an empty list when the body lacks relationshipTypes',
      async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, {}));
    const r = await api.listRelationshipTypes();
    expect(r).toEqual([]);
  });

  it('preserves the bidirectional flag + constraint entity kind',
      async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, {
      relationshipTypes: [
        { id: 'RT2', displayName: 'Linked event',
          bidirectional: true,
          fromConstraint: { relationshipEntity: 'PROGRAM_STAGE_INSTANCE',
            program: { id: 'P1' } },
          toConstraint:  { relationshipEntity: 'PROGRAM_STAGE_INSTANCE',
            program: { id: 'P1' } } },
      ],
    }));
    const r = await api.listRelationshipTypes();
    expect(r[0]!.bidirectional).toBe(true);
    expect(r[0]!.fromConstraint?.relationshipEntity)
      .toBe('PROGRAM_STAGE_INSTANCE');
  });
});

describe('edgeApi.listTrackerRelationships', () => {
  it('fetches relationships scoped to one tracked entity', async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, {
      relationships: [
        { relationship: 'R1', relationshipType: 'RT1',
          relationshipName: 'Parent of', bidirectional: false,
          from: { trackedEntity: { trackedEntity: 'TEI1',
            displayName: 'Jane Doe' } },
          to:   { trackedEntity: { trackedEntity: 'TEI2',
            displayName: 'Baby Doe' } } },
      ],
    }));
    const r = await api.listTrackerRelationships('TEI1');
    expect(r.length).toBe(1);
    expect(r[0]!.relationship).toBe('R1');
    const [path] = fetchMock.mock.calls[0] as [string];
    expect(path).toContain('/api/tracker/relationships');
    expect(path).toContain('trackedEntity=TEI1');
    expect(path).toContain('bidirectional');
  });

  it('falls back to the instances array shape', async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, {
      instances: [{ relationship: 'R-only' }],
    }));
    const r = await api.listTrackerRelationships('TEI1');
    expect(r.map((x) => x.relationship)).toEqual(['R-only']);
  });

  it('returns an empty list on HTTP error', async () => {
    fetchMock.mockResolvedValue(jsonRespond(500, { error: 'boom' }));
    const r = await api.listTrackerRelationships('TEI1');
    expect(r).toEqual([]);
  });

  it('returns an empty list when neither key is present in the body',
      async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, {}));
    const r = await api.listTrackerRelationships('TEI1');
    expect(r).toEqual([]);
  });

  it('URL-encodes the TEI UID so special characters survive', async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, { relationships: [] }));
    await api.listTrackerRelationships('a b/c');
    const [path] = fetchMock.mock.calls[0] as [string];
    expect(path).toContain('trackedEntity=a%20b%2Fc');
  });
});

describe('edgeApi.programTrackedEntityAttributes', () => {
  it('maps the DHIS2 metadata response to a flat UID list', async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, {
      programTrackedEntityAttributes: [
        { trackedEntityAttribute: { id: 'TEA_A' } },
        { trackedEntityAttribute: { id: 'TEA_B' } },
      ],
    }));
    const ids = await api.programTrackedEntityAttributes('P1');
    expect(ids).toEqual(['TEA_A', 'TEA_B']);
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/programs/P1?fields=id,programTrackedEntityAttributes');
    expect((init as RequestInit).credentials).toBe('include');
    expect((init.headers as Record<string, string>)['Accept'])
      .toBe('application/json');
  });

  it('returns an empty list on HTTP error', async () => {
    fetchMock.mockResolvedValue(jsonRespond(500, { error: 'boom' }));
    const ids = await api.programTrackedEntityAttributes('P-missing');
    expect(ids).toEqual([]);
  });

  it('skips entries whose nested trackedEntityAttribute is missing', async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, {
      programTrackedEntityAttributes: [
        { trackedEntityAttribute: { id: 'TEA_OK' } },
        { trackedEntityAttribute: {} },
        {},
      ],
    }));
    const ids = await api.programTrackedEntityAttributes('P2');
    expect(ids).toEqual(['TEA_OK']);
  });

  it('handles a body without the programTrackedEntityAttributes array', async () => {
    fetchMock.mockResolvedValue(jsonRespond(200, {}));
    const ids = await api.programTrackedEntityAttributes('P3');
    expect(ids).toEqual([]);
  });
});

describe('edgeApi device header (ADR-0023)', () => {
  it('attaches X-DER-Device-Id when a device is enrolled', async () => {
    window.localStorage.setItem('der_device_id', 'dvc-1');
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.heartbeatDevice('dvc-1');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-DER-Device-Id']).toBe('dvc-1');
    window.localStorage.removeItem('der_device_id');
  });

  it('skips the header when no device is enrolled', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.heartbeatDevice('dvc-1');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-DER-Device-Id']).toBeUndefined();
  });

  it('silently skips when localStorage throws', async () => {
    const spy = vi.spyOn(window.localStorage.__proto__, 'getItem')
      .mockImplementation(() => { throw new Error('nope'); });
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.heartbeatDevice('dvc-1');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-DER-Device-Id']).toBeUndefined();
    spy.mockRestore();
  });
});

describe('edgeApi.getDataSetMeta', () => {
  it('hits /api/dataSets/<uid> with entry-window fields', async () => {
    fetchMock.mockResolvedValue(respond(200,
      { id: 'DS', periodType: 'Monthly', openFuturePeriods: 0 }));
    const m = await api.getDataSetMeta('DS');
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url.startsWith('/api/dataSets/DS?')).toBe(true);
    // DHIS2 2.44 omits openFuturePeriods / expiryDays from the
    // default projection; we name them explicitly so the picker
    // always sees them.
    expect(url).toContain('openFuturePeriods');
    expect(url).toContain('expiryDays');
    expect(m.periodType).toBe('Monthly');
    expect(m.openFuturePeriods).toBe(0);
  });
});

describe('edgeApi.listDataSets', () => {
  it('fetches /api/dataSets with paging disabled', async () => {
    fetchMock.mockResolvedValue(respond(200, { dataSets: [] }));
    await api.listDataSets();
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url.startsWith('/api/dataSets?')).toBe(true);
    expect(url).toContain('paging=false');
    expect(url).toContain('displayName');
    expect(url).toContain('periodType');
    expect(url).not.toContain('orgUnit=');
  });

  it('forwards orgUnit when passed — server filters to assigned datasets', async () => {
    fetchMock.mockResolvedValue(respond(200, { dataSets: [] }));
    await api.listDataSets('HL2zXaIULBe');
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('orgUnit=HL2zXaIULBe');
  });

  it('ignores a blank orgUnit', async () => {
    fetchMock.mockResolvedValue(respond(200, { dataSets: [] }));
    await api.listDataSets('   ');
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).not.toContain('orgUnit=');
  });
});

describe('edgeApi.readAggregateFormSyncState', () => {
  it('GETs /edge-api/v1/data/aggregate-form-sync-state with the tuple', async () => {
    fetchMock.mockResolvedValue(respond(200, {
      formKey: 'DS:OU:202611:AOC', state: 'CENTRAL_ACCEPTED',
    }));
    const r = await api.readAggregateFormSyncState('DS', 'OU', '202611');
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url.startsWith('/edge-api/v1/data/aggregate-form-sync-state?')).toBe(true);
    expect(url).toContain('dataSet=DS');
    expect(url).toContain('orgUnit=OU');
    expect(url).toContain('period=202611');
    expect(url).not.toContain('aoc=');
    expect(r.state).toBe('CENTRAL_ACCEPTED');
  });

  it('forwards a non-default AOC when provided', async () => {
    fetchMock.mockResolvedValue(respond(200, { formKey: 'k', state: null }));
    await api.readAggregateFormSyncState('DS', 'OU', '202611', 'XYZ');
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('aoc=XYZ');
  });
});

describe('edgeApi.listValidationRules', () => {
  it('fetches /api/validationRules filtered to the dataset', async () => {
    fetchMock.mockResolvedValue(respond(200, { validationRules: [] }));
    await api.listValidationRules('DS');
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url.startsWith('/api/validationRules?')).toBe(true);
    expect(url).toContain('dataSet=DS');
    expect(url).toContain('paging=false');
  });
});

describe('edgeApi.getCompletion / markCompletion', () => {
  it('getCompletion builds the status query', async () => {
    fetchMock.mockResolvedValue(respond(200, { completed: true }));
    await api.getCompletion('DS', 'OU', '202611', 'AOC');
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url.startsWith('/edge-api/v1/aggregate/completion?')).toBe(true);
    expect(url).toContain('dataSet=DS');
    expect(url).toContain('orgUnit=OU');
    expect(url).toContain('period=202611');
    expect(url).toContain('attributeOptionCombo=AOC');
  });

  it('getCompletion omits attributeOptionCombo when blank', async () => {
    fetchMock.mockResolvedValue(respond(200, { completed: false }));
    await api.getCompletion('DS', 'OU', '202611');
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain('attributeOptionCombo');
  });

  it('markCompletion POSTs the full body', async () => {
    fetchMock.mockResolvedValue(respond(200, { completed: true }));
    await api.markCompletion({
      dataSet: 'DS', orgUnit: 'OU', period: '202611', completed: true,
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      dataSet: 'DS', orgUnit: 'OU', period: '202611', completed: true,
    });
  });
});

describe('edgeApi list-all enrichment helpers', () => {
  it('listAllDataElements pages through until exhausted', async () => {
    fetchMock
      .mockResolvedValueOnce(respond(200, {
        pager: { page: 1, pageCount: 2 },
        dataElements: [{ id: 'd1' }, { id: 'd2' }],
      }))
      .mockResolvedValueOnce(respond(200, {
        pager: { page: 2, pageCount: 2 },
        dataElements: [{ id: 'd3' }],
      }));
    const out = await api.listAllDataElements();
    expect(out.map((x) => x.id)).toEqual(['d1', 'd2', 'd3']);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/dataElements?pageSize=500&page=1');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/dataElements?pageSize=500&page=2');
  });

  it('listAllCategoryCombos exits when a page comes back empty', async () => {
    fetchMock
      .mockResolvedValueOnce(respond(200, {
        pager: { page: 1, pageCount: 2 },
        categoryCombos: [{ id: 'cc1' }],
      }))
      .mockResolvedValueOnce(respond(200, { pager: { page: 2 }, categoryCombos: [] }));
    const out = await api.listAllCategoryCombos();
    expect(out.map((x) => x.id)).toEqual(['cc1']);
  });

  it('listAllCategoryOptionCombos handles a single-page registry', async () => {
    fetchMock.mockResolvedValueOnce(respond(200, {
      pager: { page: 1, pageCount: 1 },
      categoryOptionCombos: [{ id: 'coc1', categoryCombo: { id: 'cc1' } }],
    }));
    const out = await api.listAllCategoryOptionCombos();
    expect(out).toHaveLength(1);
    expect(out[0]?.categoryCombo?.id).toBe('cc1');
  });
});

describe('edgeApi.getDataSetFormMetadata', () => {
  it('fetches /api/dataSets/<uid> with the full fields mask', async () => {
    fetchMock.mockResolvedValue(respond(200, {
      id: 'DS', dataSetElements: [], indicators: [],
    }));
    await api.getDataSetFormMetadata('DS');
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url.startsWith('/api/dataSets/DS?fields=')).toBe(true);
    expect(url).toContain('dataSetElements');
    expect(url).toContain('categoryCombo');
    expect(url).toContain('indicators');
    expect(url).toContain('optionSet');
  });
});

describe('edgeApi.getDataEntryFormHtml', () => {
  it('hits /api/dataEntryForms/<uid>', async () => {
    fetchMock.mockResolvedValue(respond(200,
      { id: 'FORM', htmlCode: '<div>hi</div>' }));
    const r = await api.getDataEntryFormHtml('FORM');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/dataEntryForms/FORM');
    expect(r.htmlCode).toBe('<div>hi</div>');
  });
});

describe('edgeApi.getOrgUnitBinding', () => {
  it('hits /edge-api/v1/system/org-unit', async () => {
    fetchMock.mockResolvedValue(respond(200, { bound: true, orgUnitId: 'OU-A' }));
    const b = await api.getOrgUnitBinding();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/edge-api/v1/system/org-unit');
    expect(b.orgUnitId).toBe('OU-A');
  });
});

describe('edgeApi module-status helpers', () => {
  it('dhis2Ping hits /edge-api/v1/dhis2/ping', async () => {
    fetchMock.mockResolvedValue(respond(200, { reachable: true }));
    await api.dhis2Ping();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/edge-api/v1/dhis2/ping');
  });

  it('dhis2Compat hits /edge-api/v1/dhis2/compatibility', async () => {
    fetchMock.mockResolvedValue(respond(200, { status: 'OK' }));
    await api.dhis2Compat();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/edge-api/v1/dhis2/compatibility');
  });

  it('listSyncJobs attaches ?limit=', async () => {
    fetchMock.mockResolvedValue(respond(200, []));
    await api.listSyncJobs(10);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/edge-api/v1/sync/jobs?limit=10');
  });

  it('latestDrift hits /edge-api/v1/sync/drift', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.latestDrift();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/edge-api/v1/sync/drift');
  });

  it('journalWorkerHealth hits /edge-api/v1/journal/worker', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.journalWorkerHealth();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/edge-api/v1/journal/worker');
  });

  it('networkStatus, listNetworkInterfaces, networkAccessPoint, networkEnrolQr', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.networkStatus();
    await api.listNetworkInterfaces();
    await api.networkAccessPoint();
    await api.networkEnrolQr();
    const paths = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(paths[0]).toBe('/edge-api/v1/network/status');
    expect(paths[1]).toBe('/edge-api/v1/network/interfaces');
    expect(paths[2]).toBe('/edge-api/v1/network/access-point');
    expect(paths[3]).toBe('/edge-api/v1/network/ap/qr');
  });
});

describe('edgeApi capture endpoints (ADR-0036)', () => {
  it('listCaptureWorkflows hits /edge-api/v1/workflows', async () => {
    fetchMock.mockResolvedValue(respond(200, { workflows: [] }));
    await api.listCaptureWorkflows();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/edge-api/v1/workflows');
  });

  it('listCaptureRuns composes workflowId + state params', async () => {
    fetchMock.mockResolvedValue(respond(200, { count: 0, runs: [] }));
    await api.listCaptureRuns({ workflowId: 'wf-1', state: 'OPEN' });
    const [path] = fetchMock.mock.calls[0] as [string];
    expect(path).toContain('workflowId=wf-1');
    expect(path).toContain('state=OPEN');
  });

  it('listCaptureRuns omits state when not provided', async () => {
    fetchMock.mockResolvedValue(respond(200, { count: 0, runs: [] }));
    await api.listCaptureRuns({ workflowId: 'wf-1' });
    const [path] = fetchMock.mock.calls[0] as [string];
    expect(path).not.toContain('state=');
  });

  it('startCaptureRun POSTs workflowId + businessKey', async () => {
    fetchMock.mockResolvedValue(respond(200, { runId: 'r' }));
    await api.startCaptureRun('wf-1', 'key-1');
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/edge-api/v1/capture/runs');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string))
      .toEqual({ workflowId: 'wf-1', businessKey: 'key-1' });
  });

  it('getCaptureRun / getCaptureRunForm / getCaptureRunData / advance', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.getCaptureRun('r-1');
    await api.getCaptureRunForm('r-1');
    await api.getCaptureRunData('r-1');
    await api.advanceCaptureRun('r-1');
    const paths = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(paths[0]).toBe('/edge-api/v1/capture/runs/r-1');
    expect(paths[1]).toBe('/edge-api/v1/capture/runs/r-1/form');
    expect(paths[2]).toBe('/edge-api/v1/capture/runs/r-1/data');
    expect(paths[3]).toBe('/edge-api/v1/capture/runs/r-1/advance');
    const [, advInit] = fetchMock.mock.calls[3] as [string, RequestInit];
    expect(advInit.method).toBe('POST');
  });

  it('getCaptureDataSetForm / getCaptureDataSetData', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.getCaptureDataSetForm('ds-1');
    await api.getCaptureDataSetData('ds-1', 'OU-A', '2026W40');
    const paths = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(paths[0]).toBe('/edge-api/v1/capture/datasets/ds-1/form');
    expect(paths[1]).toContain('/edge-api/v1/capture/datasets/ds-1/data?');
    expect(paths[1]).toContain('orgUnit=OU-A');
    expect(paths[1]).toContain('period=2026W40');
  });

  it('listCaptureProgramStages, getCaptureStageForm, listCaptureProgramEvents, getCaptureEventDetail', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.listCaptureProgramStages('p-1');
    await api.getCaptureStageForm('p-1', 's-1');
    await api.listCaptureProgramEvents('p-1', 'OU-A');
    await api.getCaptureEventDetail('e-1');
    const paths = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(paths[0]).toBe('/edge-api/v1/capture/programs/p-1/stages');
    expect(paths[1]).toBe('/edge-api/v1/capture/programs/p-1/stages/s-1/form');
    expect(paths[2]).toContain('/edge-api/v1/capture/programs/p-1/events?');
    expect(paths[2]).toContain('orgUnit=OU-A');
    expect(paths[3]).toBe('/edge-api/v1/capture/events/e-1/detail');
  });

  it('getCaptureProgram, getCaptureProgramTeiType, listCaptureTeiTypeAttributes', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.getCaptureProgram('p-1');
    await api.getCaptureProgramTeiType('p-1');
    await api.listCaptureTeiTypeAttributes('tet-1');
    const paths = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(paths[0]).toBe('/edge-api/v1/capture/programs/p-1');
    expect(paths[1]).toBe('/edge-api/v1/capture/programs/p-1/trackedEntityType');
    expect(paths[2]).toBe('/edge-api/v1/capture/trackedEntityTypes/tet-1/attributes');
  });

  it('listCaptureTeiEnrollments, listCaptureEnrollmentEvents', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.listCaptureTeiEnrollments('tei-1');
    await api.listCaptureTeiEnrollments('tei-1', 'p-9');
    await api.listCaptureEnrollmentEvents('en-1');
    await api.listCaptureEnrollmentEvents('en-1', 's-9');
    const paths = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(paths[0]).toBe('/edge-api/v1/capture/trackedEntities/tei-1/enrollments');
    expect(paths[1]).toBe('/edge-api/v1/capture/trackedEntities/tei-1/enrollments?programUid=p-9');
    expect(paths[2]).toBe('/edge-api/v1/capture/enrollments/en-1/events');
    expect(paths[3]).toBe('/edge-api/v1/capture/enrollments/en-1/events?programStageUid=s-9');
  });

  it('CaptureFormError constructor keeps code/status/blockedOnStepIds', () => {
    const err = new api.CaptureFormError(
      409, 'WORKFLOW_RUN_BLOCKED', 'blocked', ['step-a'],
    );
    expect(err.name).toBe('CaptureFormError');
    expect(err.code).toBe('WORKFLOW_RUN_BLOCKED');
    expect(err.status).toBe(409);
    expect(err.blockedOnStepIds).toEqual(['step-a']);
  });

  it('captureRequest re-raises as CaptureFormError when body contains a known code', async () => {
    fetchMock.mockResolvedValue(respond(
      409, undefined,
      '{"code":"WORKFLOW_RUN_BLOCKED","message":"blocked","blockedOnStepIds":["s-prev","s-two"]}',
    ));
    let caught: unknown;
    try { await api.getCaptureRun('r-x'); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(api.CaptureFormError);
    const cfe = caught as api.CaptureFormError;
    expect(cfe.code).toBe('WORKFLOW_RUN_BLOCKED');
    expect(cfe.status).toBe(409);
    expect(cfe.blockedOnStepIds).toEqual(['s-prev', 's-two']);
  });

  it('captureRequest handles D-CAP-8 error body without blockedOnStepIds', async () => {
    fetchMock.mockResolvedValue(respond(
      404, undefined, '{"code":"WORKFLOW_RUN_NOT_FOUND","message":"nope"}',
    ));
    let caught: unknown;
    try { await api.getCaptureRun('r-x'); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(api.CaptureFormError);
    const cfe = caught as api.CaptureFormError;
    expect(cfe.blockedOnStepIds).toBeUndefined();
  });

  it('captureRequest leaves non-D-CAP-8 500 errors as EDGE_UNREACHABLE', async () => {
    fetchMock.mockResolvedValue(respond(500, undefined, 'raw server fail'));
    let caught: unknown;
    try { await api.getCaptureRun('r-x'); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(api.EdgeApiError);
    expect(caught).not.toBeInstanceOf(api.CaptureFormError);
    expect((caught as api.EdgeApiError).code).toBe('EDGE_UNREACHABLE');
  });

  it('captureRequest returns 204 bodies as undefined', async () => {
    fetchMock.mockResolvedValue(respond(204, undefined, ''));
    const r = await api.advanceCaptureRun('r-1');
    expect(r).toBeUndefined();
  });

  it('captureRequest returns empty body as undefined on 200', async () => {
    fetchMock.mockResolvedValue(respond(200, undefined, ''));
    const r = await api.getCaptureRun('r-1');
    expect(r).toBeUndefined();
  });

  it('captureRequest leaves JSON bodies without a code as EdgeApiError', async () => {
    fetchMock.mockResolvedValue(respond(400, { foo: 'bar' }));
    let caught: unknown;
    try { await api.getCaptureRun('r-1'); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(api.EdgeApiError);
    expect(caught).not.toBeInstanceOf(api.CaptureFormError);
    expect((caught as api.EdgeApiError).code).toBe('UNKNOWN');
  });

  it('captureRequest wraps fetch rejection as EDGE_UNREACHABLE', async () => {
    fetchMock.mockRejectedValue(new Error('connection refused'));
    let caught: unknown;
    try { await api.getCaptureRun('r-1'); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(api.EdgeApiError);
    expect((caught as api.EdgeApiError).code).toBe('EDGE_UNREACHABLE');
    expect((caught as api.EdgeApiError).status).toBe(0);
  });

  it('captureRequest attaches X-DER-Device-Id when enrolled', async () => {
    window.localStorage.setItem('der_device_id', 'dev-7');
    fetchMock.mockResolvedValue(respond(200, {}));
    await api.getCaptureRun('r-1');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-DER-Device-Id']).toBe('dev-7');
    window.localStorage.removeItem('der_device_id');
  });

  it('captureRequest POST body sets Content-Type JSON', async () => {
    fetchMock.mockResolvedValue(respond(200, { runId: 'r' }));
    await api.startCaptureRun('wf', 'k');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });
});
