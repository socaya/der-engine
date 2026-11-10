import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { Dashboard } from './Dashboard';
import * as edgeApi from '../api/edgeApi';

const authApi = {
  session: vi.fn().mockResolvedValue({
    userId: 'u1', username: 'admin', displayName: 'Admin',
    roles: ['ADMIN'], expiresAt: '2027-01-01T00:00:00Z',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
};

function healthFixture(): edgeApi.HealthResponse {
  return {
    service: 'der-server', status: 'UP', version: '2.3.122',
    commit: 'abc', branch: 'main', dirty: false, buildTime: 'now',
    dhis2Integrated: true,
    dhis2Reference: { version: '2.44-SNAPSHOT' },
    timestamp: '2026-11-03T12:00:00Z',
  } as unknown as edgeApi.HealthResponse;
}

function systemInfoFixture(): edgeApi.SystemInfo {
  return {
    runtime: { heapUsedBytes: 1024, heapMaxBytes: 4096, uptimeMillis: 3600_000 },
    database: { configured: true, sessionCount: 1 },
    scheduler: { started: true, executingJobs: 0, totalJobs: 10 },
    storage: { totalBytes: 100, usableBytes: 90 },
    dhis2: { configured: true, probeReachable: true,
             probeVersion: '2.44-SNAPSHOT', baseUrl: 'x' },
    build: { version: '2.3.122', commit: 'a', branch: 'main',
             buildTime: 'now', dirty: false },
    apps: { installed: 0, enabled: 0, items: [] },
  } as unknown as edgeApi.SystemInfo;
}

function stubAll(): void {
  vi.spyOn(edgeApi, 'health').mockResolvedValue(healthFixture());
  vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue(systemInfoFixture());
  vi.spyOn(edgeApi, 'compat').mockResolvedValue({
    pinnedVersion: '2.44-SNAPSHOT', probeReachable: true, snapshotId: 1,
    capturedAt: 'now', centralVersion: '2.44-SNAPSHOT',
    capabilities: {}, pingHistory: [],
  } as unknown as edgeApi.CompatSnapshot);
  vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([]);
  vi.spyOn(edgeApi, 'listConflicts').mockResolvedValue([]);
  vi.spyOn(edgeApi, 'recentActivity').mockResolvedValue({ entries: [] });
  vi.spyOn(edgeApi, 'listDevices').mockResolvedValue({ devices: [] });
  vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({ workflows: [] });
  vi.spyOn(edgeApi, 'scopeAudit').mockResolvedValue({
    scope: { kind: 'ADMIN_UNRESTRICTED', orgUnitIds: [] },
    scopeFingerprint: 'f', takenAt: 'now',
    sample: [], mismatches: [],
    mismatchCount: 0, outOfScopeCount: 0, sampleSize: 0,
    total: 0,
    countsByEntityType: {},
    countsByState: {},
  } as unknown as edgeApi.ScopeAuditSnapshot);
}

describe('Dashboard', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('renders a loading placeholder before probes resolve', () => {
    vi.spyOn(edgeApi, 'health').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'systemInfo').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'compat').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'listJobs').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'listConflicts').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'recentActivity').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'listDevices').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'listWorkflows').mockImplementation(() => new Promise(() => undefined));
    vi.spyOn(edgeApi, 'scopeAudit').mockImplementation(() => new Promise(() => undefined));
    renderWithProviders(<Dashboard />, { authApi });
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('clears loading once all parallel probes resolve', async () => {
    stubAll();
    renderWithProviders(<Dashboard />, { authApi });
    await waitFor(() => expect(screen.queryByTestId('loading')).toBeNull());
  });

  it('renders version text in the rendered body', async () => {
    stubAll();
    renderWithProviders(<Dashboard />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/2\.3\.122/));
  });

  it('populates the Recent Activity panel from the recentActivity probe', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'recentActivity').mockResolvedValue({
      entries: [
        { auditId: 'a1', eventType: 'SIGN_IN', outcome: 'SUCCESS',
          observedAt: '2026-11-03T11:00:00Z' },
        { auditId: 'a2', eventType: 'DRAIN_RUN', outcome: 'FAILURE',
          observedAt: '2026-11-03T11:05:00Z' },
      ],
    } as unknown as { entries: edgeApi.ActivityEntry[] });
    renderWithProviders(<Dashboard />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/SIGN_IN/));
    expect(document.body.textContent ?? '').toMatch(/DRAIN_RUN/);
  });

  it('populates the Client Devices panel with per-row status tone', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'listDevices').mockResolvedValue({
      devices: [
        { deviceId: 'd-approved-xxxxxxxxx', status: 'APPROVED',
          lastSeenAt: '2026-11-03T11:00:00Z',
          assignedUserId: null, enrolmentTokenHash: 'h',
          enrolledAt: 'now', approvedBy: null, approvedAt: null,
          userAgent: 'ua', firmwareVersion: null,
          displayName: null, formFactor: 'TABLET' },
        { deviceId: 'd-pending-xxxxxxxxx', status: 'PENDING',
          lastSeenAt: '2026-11-03T10:00:00Z',
          assignedUserId: null, enrolmentTokenHash: 'h',
          enrolledAt: 'now', approvedBy: null, approvedAt: null,
          userAgent: 'ua', firmwareVersion: null,
          displayName: null, formFactor: 'TABLET' },
        /* Third device with REVOKED status exercises the danger
         * tone fallback in the status-switch ternary. */
        { deviceId: 'd-revoked-xxxxxxxxx', status: 'REVOKED',
          lastSeenAt: '2026-11-03T09:00:00Z',
          assignedUserId: null, enrolmentTokenHash: 'h',
          enrolledAt: 'now', approvedBy: null, approvedAt: null,
          userAgent: 'ua', firmwareVersion: null,
          displayName: null, formFactor: 'TABLET' },
      ],
    } as unknown as { devices: edgeApi.EdgeDeviceRow[] });
    renderWithProviders(<Dashboard />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/d-approved/));
    expect(document.body.textContent ?? '').toMatch(/d-pending/);
    expect(document.body.textContent ?? '').toMatch(/d-revoked/);
  });

  it('scope drift populated branch — total > 0 with per-type rows', async () => {
    stubAll();
    /* boundOrgUnitId non-null + total > 0 triggers the fully-
     * populated scope-drift panel branch (lines ~213-229). */
    vi.spyOn(edgeApi, 'scopeAudit').mockResolvedValue({
      scope: { kind: 'OU_SCOPED', orgUnitIds: ['OU-1'] },
      scopeFingerprint: 'fp', takenAt: '2026-11-03T12:00:00Z',
      sample: [], mismatches: [],
      mismatchCount: 3, outOfScopeCount: 3, sampleSize: 50,
      total: 3,
      boundOrgUnitId: 'OU-1',
      countsByEntityType: {
        TRACKED_ENTITY_INSTANCE: 2,
        AGGREGATE_DATA_VALUE: 1,
        EVENT: 0,  /* exercises the > 0 filter arm */
      },
      countsByState: {},
    } as unknown as edgeApi.ScopeAuditSnapshot);
    renderWithProviders(<Dashboard />, { authApi });
    await waitFor(() =>
      expect(screen.getByText('Scope drift')).toBeInTheDocument());
    /* The populated branch renders the entity-type labels (keys
     * are lowercased + underscores→spaces). */
    expect(document.body.textContent ?? '')
      .toMatch(/tracked entity instance/);
    expect(document.body.textContent ?? '')
      .toMatch(/aggregate data value/);
    /* total count 3 surfaces. */
    expect(document.body.textContent ?? '').toMatch(/\b3\b/);
  });

  it('scope drift — unbound edge branch surfaces the "unbound" hint', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'scopeAudit').mockResolvedValue({
      scope: { kind: 'ADMIN_UNRESTRICTED', orgUnitIds: [] },
      scopeFingerprint: 'f', takenAt: 'now',
      sample: [], mismatches: [],
      mismatchCount: 0, outOfScopeCount: 0, sampleSize: 0,
      total: 42,
      boundOrgUnitId: null,  /* exercises the null-bound branch */
      countsByEntityType: {},
      countsByState: {},
    } as unknown as edgeApi.ScopeAuditSnapshot);
    renderWithProviders(<Dashboard />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '')
        .toMatch(/Edge is unbound/));
  });

  it('workflows populated branch — renders enabled + disabled rows', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({
      workflows: [
        { workflowId: 'wf-1', displayName: 'ANC Visit',
          boundMetadataKind: 'DATA_SET', boundMetadataId: 'ds-1',
          enabled: true, version: 1,
          createdAt: 'now', updatedAt: 'now', createdBy: null,
          steps: [{ stepOrder: 1 }, { stepOrder: 2 }],
          dependencies: [], requiresApproval: false,
          defaultDeviceId: null },
        { workflowId: 'wf-2', displayName: 'PNC Visit',
          boundMetadataKind: 'DATA_SET', boundMetadataId: 'ds-2',
          enabled: false, version: 1,
          createdAt: 'now', updatedAt: 'now', createdBy: null,
          steps: [],
          dependencies: [], requiresApproval: false,
          defaultDeviceId: null },
      ],
    } as unknown as { workflows: edgeApi.CaptureWorkflowSummary[] });
    renderWithProviders(<Dashboard />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/ANC Visit/));
    expect(document.body.textContent ?? '').toMatch(/PNC Visit/);
    /* step count surfaces for both — '2 steps' for wf-1 + '0 steps' for wf-2. */
    expect(document.body.textContent ?? '').toMatch(/2 steps/);
    expect(document.body.textContent ?? '').toMatch(/0 steps/);
  });

  it('non-OK statuses — DHIS2 unreachable + scheduler stopped + storage WARN', async () => {
    /* Flips the main KPI-tile tone branches to the failure arms:
     * dhis2Up=false, dbUp=false (probeError set), schedUp=false,
     * storage.status='WARN'. Also tests isDerUp fallthrough with
     * an unexpected status value. */
    vi.spyOn(edgeApi, 'health').mockResolvedValue({
      service: 'der-server', status: 'DEGRADED',  /* fails isDerUp */
      version: '2.3.122', commit: 'abc', branch: 'main',
      dirty: false, buildTime: 'now',
      dhis2Integrated: true, timestamp: 'now',
    } as unknown as edgeApi.HealthResponse);
    vi.spyOn(edgeApi, 'systemInfo').mockResolvedValue({
      runtime: { heapUsedBytes: 1024, heapMaxBytes: 4096,
                 uptimeMillis: 3600_000 },
      database: { configured: true, probeError: 'ECONNREFUSED',
                  sessionCount: 0 },
      scheduler: { started: false, executingJobs: 0, totalJobs: 0 },
      storage: { totalBytes: 100, usableBytes: 10, status: 'WARN' },
      dhis2: { configured: true, probeReachable: false,
               probeDurationMs: null, baseUrl: 'x' },
      build: { version: '2.3.122', commit: 'a', branch: 'main',
               buildTime: 'now', dirty: false },
      apps: { installed: 0, enabled: 0, items: [] },
    } as unknown as edgeApi.SystemInfo);
    vi.spyOn(edgeApi, 'compat').mockResolvedValue({
      pinnedVersion: '2.44', probeReachable: false, snapshotId: 1,
      capturedAt: 'now', centralVersion: null,
      capabilities: {}, pingHistory: [],
    } as unknown as edgeApi.CompatSnapshot);
    vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([]);
    vi.spyOn(edgeApi, 'listConflicts').mockResolvedValue([]);
    vi.spyOn(edgeApi, 'recentActivity').mockResolvedValue({ entries: [] });
    vi.spyOn(edgeApi, 'listDevices').mockResolvedValue({ devices: [] });
    vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({ workflows: [] });
    vi.spyOn(edgeApi, 'scopeAudit').mockResolvedValue({
      scope: { kind: 'ADMIN_UNRESTRICTED', orgUnitIds: [] },
      scopeFingerprint: 'f', takenAt: 'now', sample: [], mismatches: [],
      mismatchCount: 0, outOfScopeCount: 0, sampleSize: 0,
      total: 0, countsByEntityType: {}, countsByState: {},
    } as unknown as edgeApi.ScopeAuditSnapshot);
    renderWithProviders(<Dashboard />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/Unreachable/));
    /* Degraded status surfaces as the chip label fallback. */
    expect(document.body.textContent ?? '').toMatch(/DEGRADED/);
    expect(document.body.textContent ?? '').toMatch(/Degraded/);  /* dbUp false */
    expect(document.body.textContent ?? '').toMatch(/Standby/);   /* schedUp false */
  });

  it('surfaces partial-load error strip when one probe rejects', async () => {
    stubAll();
    /* Replace one probe with a rejection — Promise.allSettled catches
     * it and the Dashboard surfaces an ErrorBlock with its message. */
    vi.spyOn(edgeApi, 'scopeAudit').mockRejectedValue(
      new Error('scope-audit probe failed'));
    renderWithProviders(<Dashboard />, { authApi });
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-err')).toBeInTheDocument());
    expect(document.body.textContent ?? '')
      .toMatch(/scope-audit probe failed/);
  });

  it('activity list — non-SUCCESS/FAILURE outcome lands on muted tone arm', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'recentActivity').mockResolvedValue({
      entries: [
        { auditId: 'a-info', eventType: 'SYNC_SKIPPED',
          outcome: 'INFO',   /* neither SUCCESS nor FAILURE → muted */
          observedAt: '2026-11-03T11:00:00Z' },
      ],
    } as unknown as { entries: edgeApi.ActivityEntry[] });
    renderWithProviders(<Dashboard />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/SYNC_SKIPPED/));
  });

  it('conflicts with mixed attemptCount populate high/medium/low priority rows', async () => {
    stubAll();
    vi.spyOn(edgeApi, 'listConflicts').mockResolvedValue([
      /* high priority: attemptCount >= 5 */
      { operationId: 'op-high', attemptCount: 7, state: 'CONFLICT_REVIEW',
        lastError: 'e', nextHopOrgUnitUid: null, createdAt: 'now',
        updatedAt: 'now' },
      /* medium priority: 2..4 */
      { operationId: 'op-med', attemptCount: 3, state: 'CONFLICT_REVIEW',
        lastError: 'e', nextHopOrgUnitUid: null, createdAt: 'now',
        updatedAt: 'now' },
      /* low priority: < 2 */
      { operationId: 'op-low', attemptCount: 0, state: 'CONFLICT_REVIEW',
        lastError: 'e', nextHopOrgUnitUid: null, createdAt: 'now',
        updatedAt: 'now' },
    ] as unknown as edgeApi.ConflictRow[]);
    /* Jobs populate the reliability + sync-activity bars. */
    const nowIso = new Date().toISOString();
    vi.spyOn(edgeApi, 'listJobs').mockResolvedValue([
      { runId: 1, jobName: 'J', outcome: 'SUCCEEDED',
        startedAt: nowIso, finishedAt: nowIso,
        durationMs: 100, triggeredBy: 'SCHEDULED', detail: '{}' },
      { runId: 2, jobName: 'J', outcome: 'FAILED',
        startedAt: nowIso, finishedAt: nowIso,
        durationMs: 100, triggeredBy: 'SCHEDULED', detail: '{}' },
    ] as unknown as edgeApi.JobRun[]);
    renderWithProviders(<Dashboard />, { authApi });
    await waitFor(() =>
      expect(document.body.textContent ?? '').toMatch(/High priority/));
    expect(document.body.textContent ?? '').toMatch(/Medium priority/);
    expect(document.body.textContent ?? '').toMatch(/Low priority/);
    /* Reliability = 50% (1 succeeded / 2 runs) */
    expect(document.body.textContent ?? '').toMatch(/50%/);
  });
});
