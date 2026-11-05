/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Shared fixture builders for the Data-module + operator screen test
 * suite. Lives under src/test so coverage excludes it. Each builder
 * returns the lightest possible object shape the screen under test
 * reads; fields are typed `any` because the production code already
 * has strict typing — tests just need shape fidelity, not matching
 * the full `edgeApi` interface.
 */

export function health(status = 'starter-ready'): any {
  return {
    service: 'der', status, version: '1.0.0',
    dhis2Integrated: true,
    dhis2Reference: { version: '2.44' },
    timestamp: '2026-11-03T00:00:00Z',
  };
}

export function compat(ok = true): any {
  return {
    status: ok ? 'OK' : 'FAIL',
    profileName: 'V2_44',
    centralVersion: '2.44',
    engineVersion: 'E1',
    probeReachable: ok,
    capabilities: {},
  };
}

export function systemInfo(overrides: Record<string, unknown> = {}): any {
  return {
    service: 'der', timestamp: '2026-11-03T00:00:00Z',
    build: {
      version: '1.0.0', commit: 'abc', branch: 'main',
      buildTime: '2026-11-03T00:00:00Z', dirty: false,
    },
    runtime: {
      javaVendor: 'Oracle', javaVersion: '21', osName: 'macOS', osArch: 'arm64',
      hostname: 'test', availableProcessors: 8,
      uptimeMillis: 123456, jvmStartTimeMillis: Date.now() - 123456,
      heapUsedBytes: 400 * 1024 * 1024, heapMaxBytes: 1024 * 1024 * 1024,
    },
    database: {
      configured: true, product: 'PostgreSQL 17',
      flywayVersion: '10', migrationCount: 120,
      userCount: 3, sessionCount: 2, probeError: null,
    },
    scheduler: {
      name: 'DER', started: true, standbyMode: false,
      executingJobs: 1, totalJobs: 5, probeError: null,
    },
    storage: {
      root: '/var/der', status: 'OK',
      totalBytes: 100 * 1e9, usableBytes: 60 * 1e9,
      warnBytes: 5e9, rejectBytes: 1e9,
      derDataRootBytes: 10e9, derDbSchemaBytes: 5e9,
    },
    dhis2: {
      centralBaseUrl: 'http://localhost:8080',
      pinnedVersion: '2.44-SNAPSHOT',
      centralVersion: '2.44',
      profileName: 'V2_44', allowMismatch: false,
      probeReachable: true, probeDurationMs: 42,
      capturedAt: '2026-11-03T00:00:00Z', reason: null,
    },
    apps: { installed: 2, enabled: 2, items: [] },
    journal: { AGGREGATE_DATA_VALUE: 3, EVENT: 2 },
    attribution: { configured: true, mappedUsers: 1 },
    ...overrides,
  };
}

export function workerHealth(enabled = true): any {
  return {
    enabled,
    backlog: { PENDING: 2, FAILED: 1 },
    lastHeartbeatAt: '2026-11-03T00:00:00Z',
  };
}

export function makeConflict(overrides: Record<string, unknown> = {}): any {
  return {
    operationId: 'op-1', entityType: 'AGGREGATE_DATA_VALUE',
    entityRef: 'de-1~ou-1~2024Q4~COC~AOC',
    state: 'CONFLICT_REVIEW', attemptCount: 3,
    lastError: null, nextHopOrgUnitUid: null,
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-02T00:00:00Z',
    payload: { value: '42' },
    ...overrides,
  };
}

export function emptyScopeAudit(): any {
  return {
    boundOrgUnitId: 'ou-root', boundOrgUnitPath: '/root',
    total: 0, countsByEntityType: {}, samples: [],
  };
}

export function emptyMessagingStats(): any {
  return {
    messagesTotal: 0, messagesLastHour: 0,
    devicesSubscribed: 0, channelsActive: 0,
    topChannels: [],
  };
}

export function orgUnitBindingBound(): any {
  return {
    bound: true, orgUnitId: 'ou-root',
    orgUnitDisplayName: 'Clinic Root', orgUnitPath: '/root',
    boundAt: '2026-11-01T00:00:00Z', boundBy: 'u1',
  };
}

/** Produce a fetch stub that returns the matched response for a URL
 *  substring, falling back to a 200/empty response. */
export function stubFetch(
  routes: Array<[matcher: RegExp | string, body: unknown, status?: number]>,
): (url: string, init?: RequestInit) => Promise<Response> {
  return async (url, _init) => {
    const u = String(url);
    for (const [m, body, status] of routes) {
      const hit = typeof m === 'string' ? u.includes(m) : m.test(u);
      if (hit) {
        return new Response(
          body != null ? JSON.stringify(body) : '',
          { status: status ?? 200,
            headers: { 'Content-Type': 'application/json' } },
        );
      }
    }
    return new Response('{}', {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };
}
