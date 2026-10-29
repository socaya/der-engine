/**
 * Thin wrapper around the DER /edge-api/v1/* endpoints.
 *
 * These are NOT DHIS2-shaped — they are DER's coordination API (auth, sync,
 * provisioning, system). The DHIS2-shaped reads (/api/*) go through
 * @dhis2/app-runtime's Data Engine. Both paths use the same DER_SESSION cookie,
 * so once a user signs in via POST /edge-api/v1/auth/sign-in the Data Engine
 * works too.
 */

export interface SignInResponse {
  userId: string;
  username: string;
  displayName: string;
  roles: string[];
  expiresAt: string;
}

export class EdgeApiError extends Error {
  public readonly status: number;
  public readonly code: 'INVALID_CREDENTIALS' | 'RATE_LIMITED' | 'EDGE_UNREACHABLE' | 'UNKNOWN';

  constructor(status: number, code: EdgeApiError['code'], message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'EdgeApiError';
  }
}

/**
 * G2+A3: default 15 s request timeout. Prevents stuck spinners when
 * the server never responds (missing endpoint, slow upstream, dropped
 * connection). Override per-call via the optional {@code timeoutMs}
 * argument on wrapper fns, if needed.
 */
const DEFAULT_TIMEOUT_MS = 15_000;

async function request<T>(
  method: string, path: string, body?: unknown, timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  let response: Response;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    response = await fetch(path, {
      method,
      credentials: 'include',
      headers: body == null ? { Accept: 'application/json' } : {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: body == null ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (err) {
    const aborted = (err as { name?: string }).name === 'AbortError';
    throw new EdgeApiError(
      0,
      'EDGE_UNREACHABLE',
      aborted
        ? `edge did not respond within ${Math.round(timeoutMs / 1000)}s`
        : `edge unreachable: ${String(err)}`,
    );
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  if (response.ok) {
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
  if (response.status === 401) {
    throw new EdgeApiError(401, 'INVALID_CREDENTIALS', 'invalid credentials');
  }
  if (response.status === 429) {
    throw new EdgeApiError(429, 'RATE_LIMITED', 'too many attempts; try again shortly');
  }
  if (response.status === 0 || response.status >= 500) {
    throw new EdgeApiError(response.status, 'EDGE_UNREACHABLE', `edge responded ${response.status}`);
  }
  throw new EdgeApiError(response.status, 'UNKNOWN', `unexpected status ${response.status}`);
}

export function signIn(username: string, password: string): Promise<SignInResponse> {
  return request<SignInResponse>('POST', '/edge-api/v1/auth/sign-in', { username, password });
}

export function signOut(): Promise<void> {
  return request<void>('POST', '/edge-api/v1/auth/sign-out');
}

export function session(): Promise<SignInResponse> {
  return request<SignInResponse>('GET', '/edge-api/v1/auth/session');
}

export interface SyncResult {
  status: string;
  snapshotId: number;
  total: number;
  organisationUnits: number;
  dataElements: number;
  dataSets: number;
  programs: number;
  trackedEntityTypes: number;
  centralVersion: string | null;
  centralRevision: string | null;
  fingerprint: string | null;
  message: string | null;
}

export function triggerMetadataSync(): Promise<SyncResult> {
  return request<SyncResult>('POST', '/edge-api/v1/sync/metadata');
}

export interface HealthResponse {
  service: string;
  status: string;
  version: string;
  dhis2Integrated: boolean;
  dhis2Reference: { version: string };
  timestamp: string;
}

export function health(): Promise<HealthResponse> {
  return request<HealthResponse>('GET', '/edge-api/v1/system/health');
}

export interface ActivityEntry {
  auditId: number;
  eventType: string;
  outcome: string;
  observedAt: string;
}

export function recentActivity(limit = 20): Promise<{ entries: ActivityEntry[] }> {
  return request<{ entries: ActivityEntry[] }>('GET', `/edge-api/v1/activity/recent?limit=${limit}`);
}

// Phase 06 Release 1 — DC-06..17 helpers.

export interface MetadataListItem {
  id: string;
  displayName: string;
  [key: string]: unknown;
}

export interface MetadataListResponse {
  [key: string]: MetadataListItem[] | unknown;
}

export function metadataList(resource: string,
                              opts: { pageSize?: number; page?: number } = {})
    : Promise<MetadataListResponse> {
  const params = new URLSearchParams();
  // Full payload — the Metadata browser needs code / shortName /
  // lastUpdated / etc. without having to call back for details.
  params.set('fields', 'id,displayName,shortName,code,lastUpdated');
  if (opts.pageSize != null) {
    params.set('pageSize', String(opts.pageSize));
    params.set('page', String(opts.page ?? 1));
  } else {
    params.set('paging', 'false');
  }
  return request<MetadataListResponse>('GET', `/api/${resource}?` + params.toString());
}

export interface AggregateReadbackRow {
  dataElement: string;
  orgUnit: string;
  period: string;
  categoryOptionCombo: string;
  attributeOptionCombo: string;
  value: string;
  lastUpdated?: string;
}

export function readAggregateValues(orgUnit: string, period: string, limit = 500):
    Promise<{ dataValues: AggregateReadbackRow[] }> {
  const q = new URLSearchParams({ orgUnit, period, limit: String(limit) }).toString();
  return request<{ dataValues: AggregateReadbackRow[] }>('GET', `/api/dataValueSets?${q}`);
}

export interface AggregateSubmitInput {
  dataValues: readonly {
    dataElement: string;
    orgUnit: string;
    period: string;
    value: string;
    comment?: string;
  }[];
}

export interface ImportSummary {
  status: string;
  importCount?: { imported: number; updated: number; ignored: number; deleted: number };
  conflicts?: { object: string; value: string }[];
  derServerDate?: string;
}

export function submitAggregate(body: AggregateSubmitInput): Promise<ImportSummary> {
  return request<ImportSummary>('POST', '/api/dataValueSets', body);
}

export interface EventRow {
  event: string;
  program: string;
  programStage: string;
  orgUnit: string;
  occurredAt: string;
  status: string;
  enrollment?: string;
  dataValues?: { dataElement: string; value: string }[];
}

export function listEvents(program: string, orgUnit: string, pageSize = 100):
    Promise<{ events?: EventRow[]; instances?: EventRow[]; total: number }> {
  const q = new URLSearchParams({ program, orgUnit, pageSize: String(pageSize) }).toString();
  return request('GET', `/api/events?${q}`);
}

export function listTrackerEvents(program: string, orgUnit: string, pageSize = 100):
    Promise<{ instances: EventRow[]; total: number }> {
  const q = new URLSearchParams({ program, orgUnit, pageSize: String(pageSize) }).toString();
  return request('GET', `/api/tracker/events?${q}`);
}

export interface DraftRow {
  draftId: string;
  kind: string;
  title: string;
  payload: Record<string, unknown>;
  updatedAt: string;
}

export function listDrafts(): Promise<{ drafts: DraftRow[] }> {
  return request<{ drafts: DraftRow[] }>('GET', '/edge-api/v1/drafts');
}

export function saveDraft(draft: Omit<DraftRow, 'draftId' | 'updatedAt'>): Promise<DraftRow> {
  return request<DraftRow>('POST', '/edge-api/v1/drafts', draft);
}

export function deleteDraft(draftId: string): Promise<void> {
  return request<void>('DELETE', `/edge-api/v1/drafts/${draftId}`);
}

// ---- Admin-ui additions (EA-01..18) ----

export interface CompatSnapshot {
  status: string;
  profileName?: string;
  centralVersion?: string;
  probeReachable?: boolean;
  capabilities?: Record<string, unknown>;
  message?: string;
  snapshotId?: number;
  capturedAt?: string;
  probeDurationMs?: number;
  engineVersion?: string;
}

export function compat(): Promise<CompatSnapshot> {
  return request<CompatSnapshot>('GET', '/edge-api/v1/compat');
}

/** Lightweight central reachability probe used by the runtime indicator.
 *  Server does GET /api/system/info with a short timeout + caches the
 *  response for 10 s so a storm of UI polls doesn't fan out to Central. */
export interface PingSnapshot {
  reachable: boolean;
  observedVersion: string | null;
  latencyMs: number;
  probedAt: string;
  message: string | null;
}

export function dhis2Ping(): Promise<PingSnapshot> {
  return request<PingSnapshot>('GET', '/edge-api/v1/dhis2/ping');
}

export function compatHistory(limit = 20): Promise<{ snapshots: CompatSnapshot[] }> {
  return request('GET', `/edge-api/v1/compat/history?limit=${limit}`);
}

export function refreshCompat(): Promise<CompatSnapshot> {
  return request<CompatSnapshot>('POST', '/edge-api/v1/compat/refresh');
}

export interface JobRun {
  runId: number;
  jobName: string;
  startedAt: string;
  finishedAt: string | null;
  outcome: string;
  durationMs: number | null;
  detail: string | null;
  triggeredBy: string;
}

export function getJobRun(runId: string | number): Promise<JobRun> {
  return request<JobRun>('GET', `/edge-api/v1/sync/jobs/${encodeURIComponent(String(runId))}`);
}

export function listJobs(limit = 50, jobName?: string): Promise<JobRun[]> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (jobName) params.set('jobName', jobName);
  return request<JobRun[]>('GET', `/edge-api/v1/sync/jobs?${params.toString()}`);
}

export function triggerJob(name: string): Promise<{ triggered?: string; error?: string }> {
  return request('POST', `/edge-api/v1/sync/jobs/${encodeURIComponent(name)}/trigger`);
}

export interface DriftResponse {
  status?: string;
  snapshotFrom?: number;
  snapshotTo?: number;
  fingerprintFrom?: string;
  fingerprintTo?: string;
  perEntity?: Record<string, { added: string[]; removed: string[]; changed: string[] }>;
  deltasJson?: string;
}

export function drift(refresh = false): Promise<DriftResponse> {
  return request<DriftResponse>('GET', `/edge-api/v1/sync/drift?refresh=${refresh}`);
}

export interface ConflictRow {
  operationId: string;
  entityType: string;
  entityRef: string;
  state: string;
  attemptCount: number;
  createdAt: string;
  payload?: Record<string, unknown> | null;
  lastError?: string | null;
  updatedAt?: string;
}

export function listConflicts(limit = 100): Promise<ConflictRow[]> {
  return request<ConflictRow[]>('GET', `/edge-api/v1/journal/conflicts?limit=${limit}`);
}

/** Full journal operation entry (includes payload JSON). */
export interface JournalOperation {
  operationId: string;
  entityType: string;
  entityRef: string;
  payload: Record<string, unknown>;
  state: string;
  attemptCount: number;
  lastError: string | null;
  submittedBy: string | null;
  createdAt: string;
  updatedAt: string;
  nextHopOrgUnitUid: string | null;
}

export function fetchJournalOperation(operationId: string): Promise<JournalOperation> {
  return request<JournalOperation>('GET',
    `/edge-api/v1/journal/operations/${encodeURIComponent(operationId)}`);
}

export function listJournalOperations(limit = 100): Promise<JournalOperation[]> {
  return request<JournalOperation[]>('GET',
    `/edge-api/v1/journal/operations?limit=${limit}`);
}

/** Backlog breakdown by entity type (every known type, with state counts). */
export type JournalStatsByType = Record<string, Record<string, number>>;

export function journalStatsByType(): Promise<JournalStatsByType> {
  return request<JournalStatsByType>('GET', '/edge-api/v1/journal/stats/by-type');
}

/** Mirror counts for the Metadata run detail page. */
export interface MetadataDiagnostics {
  mirrorCounts: {
    organisationUnits?: number;
    dataElements?: number;
    dataSets?: number;
    programs?: number;
    trackedEntityTypes?: number;
    [k: string]: number | undefined;
  };
  drift?: unknown;
}

export function metadataDiagnostics(): Promise<MetadataDiagnostics> {
  return request<MetadataDiagnostics>('GET', '/edge-api/v1/metadata/diagnostics');
}

/** Fetch all mirrored records across every supported metadata
 *  collection. Used on the Metadata pull detail page so the operator
 *  can inspect everything that was actually mirrored, not just counts.
 *  Each bucket is null when the endpoint 404s / errors. */
export interface MetadataInventory {
  organisationUnits: unknown[] | null;
  programs: unknown[] | null;
  programStages: unknown[] | null;
  dataElements: unknown[] | null;
  dataSets: unknown[] | null;
  trackedEntityTypes: unknown[] | null;
  trackedEntityAttributes: unknown[] | null;
  optionSets: unknown[] | null;
  categoryCombos: unknown[] | null;
  programRules: unknown[] | null;
}

export async function metadataInventory(limit = 1000): Promise<MetadataInventory> {
  async function fetchAll(collection: string, key: string, fields = 'id,displayName,code,name'):
      Promise<unknown[] | null> {
    try {
      const r = await request<Record<string, unknown>>('GET',
        `/api/${collection}?fields=${encodeURIComponent(fields)}&pageSize=${limit}`);
      const arr = r[key];
      return Array.isArray(arr) ? arr : null;
    } catch { return null; }
  }
  const [ous, programs, stages, des, dss, tets, teas, opts, catCombos, rules] = await Promise.all([
    fetchAll('organisationUnits', 'organisationUnits', 'id,displayName,code,level,path'),
    fetchAll('programs', 'programs'),
    fetchAll('programStages', 'programStages'),
    fetchAll('dataElements', 'dataElements', 'id,displayName,code,valueType,domainType'),
    fetchAll('dataSets', 'dataSets'),
    fetchAll('trackedEntityTypes', 'trackedEntityTypes'),
    fetchAll('trackedEntityAttributes', 'trackedEntityAttributes',
      'id,displayName,code,valueType'),
    fetchAll('optionSets', 'optionSets'),
    fetchAll('categoryCombos', 'categoryCombos'),
    fetchAll('programRules', 'programRules'),
  ]);
  return {
    organisationUnits: ous,
    programs,
    programStages: stages,
    dataElements: des,
    dataSets: dss,
    trackedEntityTypes: tets,
    trackedEntityAttributes: teas,
    optionSets: opts,
    categoryCombos: catCombos,
    programRules: rules,
  };
}

export function resolveConflict(id: string, outcome: 'ACCEPTED' | 'REJECTED', rationale?: string):
    Promise<unknown> {
  return request('POST', `/edge-api/v1/journal/conflicts/${id}/resolve`, { outcome, rationale });
}

// ---- der-1.4.0-alpha.1 Initiative 3 (ADR-0027): chain-via-hub referral ----

export interface JournalNextHopResponse {
  operationId: string;
  nextHopOrgUnitUid: string;
}

export function setJournalNextHop(operationId: string, orgUnitUid: string):
    Promise<JournalNextHopResponse> {
  return request<JournalNextHopResponse>('POST',
    `/edge-api/v1/journal/${operationId}/next-hop`, { orgUnitUid });
}

// ---- der-1.4.0-alpha.4 Initiative 3 (ADR-0027): referral inbox ----

export type ReferralInboxKind = 'AGGREGATE_DATA_VALUE' | 'EVENT'
  | 'ENROLLMENT' | 'TRACKED_ENTITY';

export interface ReferralInboxRow {
  inboxId: string;
  kind: ReferralInboxKind;
  sourceRef: string;
  boundOrgUnit: string;
  discoveredAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'DISMISSED';
}

export function listReferralInbox(limit = 100):
    Promise<{ entries: ReferralInboxRow[] }> {
  return request('GET', `/edge-api/v1/referral/inbox?limit=${limit}`);
}

export function acceptReferralInbox(inboxId: string):
    Promise<{ inboxId: string; status: 'ACCEPTED' }> {
  return request('POST', `/edge-api/v1/referral/inbox/${inboxId}/accept`);
}

export function dismissReferralInbox(inboxId: string):
    Promise<{ inboxId: string; status: 'DISMISSED' }> {
  return request('POST', `/edge-api/v1/referral/inbox/${inboxId}/dismiss`);
}

export function reJournalConflict(id: string): Promise<unknown> {
  return request('POST', `/edge-api/v1/journal/conflicts/${id}/re-journal`);
}

export interface WorkerHealth {
  enabled: boolean;
  lastTick: string | null;
  lastBatchSize: number;
  backlog: Record<string, number>;
}

export function workerHealth(): Promise<WorkerHealth> {
  return request<WorkerHealth>('GET', '/edge-api/v1/journal/worker');
}

export function pauseWorker(): Promise<{ enabled: boolean }> {
  return request('POST', '/edge-api/v1/journal/worker/pause');
}

export function resumeWorker(): Promise<{ enabled: boolean }> {
  return request('POST', '/edge-api/v1/journal/worker/resume');
}

export interface ProvisionedUser {
  userId: string;
  username: string;
  displayName: string;
  roles: string[];
}

export function listUsers(): Promise<{ users: ProvisionedUser[] }> {
  return request<{ users: ProvisionedUser[] }>('GET', '/edge-api/v1/provisioning/users');
}

export function createUser(body: { username: string; displayName: string; password: string;
  roles: string[]; }): Promise<ProvisionedUser> {
  return request<ProvisionedUser>('POST', '/edge-api/v1/provisioning/users', body);
}

// ---- Admin-ui additions for EA-19..36 ----

export interface InstalledAppRow {
  appId: string;
  appKey: string;
  version: string;
  displayName: string;
  enabled: boolean;
  installedAt: string;
}

export function listApps(): Promise<InstalledAppRow[]> {
  return request<InstalledAppRow[]>('GET', '/edge-api/v1/apps');
}

export function setAppEnabled(id: string, enabled: boolean): Promise<unknown> {
  return request('POST', `/edge-api/v1/apps/${id}/enable?enabled=${enabled}`);
}

export function uninstallApp(id: string): Promise<void> {
  return request<void>('DELETE', `/edge-api/v1/apps/${id}`);
}

export interface BackupRow {
  runId: number;
  requestedAt: string;
  kind: 'AUDIT' | 'FULL';
  status: 'REQUESTED' | 'QUEUED' | 'SUCCESS' | 'FAILED';
  message?: string;
}

export function listBackups(): Promise<BackupRow[]> {
  return request<{ runs: BackupRow[] }>('GET', '/edge-api/v1/backup/runs')
    .then((r) => r.runs ?? []);
}

export function requestBackup(kind: 'AUDIT' | 'FULL'): Promise<BackupRow> {
  return request<BackupRow>('POST', '/edge-api/v1/backup/request', { kind });
}

export interface RestoreRow {
  runId: number;
  requestedAt: string;
  source: string;
  status: 'REQUESTED' | 'QUEUED' | 'SUCCESS' | 'FAILED';
  message?: string;
}

export function listRestores(): Promise<RestoreRow[]> {
  return request<{ runs: RestoreRow[] }>('GET', '/edge-api/v1/restore/runs')
    .then((r) => r.runs ?? []);
}

export function requestRestore(source: string): Promise<RestoreRow> {
  return request<RestoreRow>('POST', '/edge-api/v1/restore/request', { source });
}

export interface SystemInfoRuntime {
  javaVersion?: string;
  javaVendor?: string;
  osName?: string;
  osArch?: string;
  hostname?: string;
  uptimeMillis?: number;
  heapMaxBytes?: number;
  heapUsedBytes?: number;
  heapFreeBytes?: number;
  availableProcessors?: number;
  jvmStartTimeMillis?: number;
}

export interface SystemInfoDhis2 {
  centralBaseUrl?: string;
  pinnedVersion?: string;
  allowMismatch?: boolean;
  probeReachable?: boolean;
  centralVersion?: string;
  profileName?: string;
  probeDurationMs?: number;
  capturedAt?: string;
  reason?: string;
}

export interface SystemInfoDatabase {
  product?: string;
  flywayVersion?: string;
  migrationCount?: number;
  userCount?: number;
  sessionCount?: number;
  probeError?: string;
  configured?: boolean;
}

export interface SystemInfoScheduler {
  name?: string;
  started?: boolean;
  standbyMode?: boolean;
  executingJobs?: number;
  totalJobs?: number;
  probeError?: string;
  configured?: boolean;
}

export interface SystemInfoStorage {
  root?: string;
  status?: 'OK' | 'WARN' | 'REJECT';
  usableBytes?: number;
  totalBytes?: number;
  warnBytes?: number;
  rejectBytes?: number;
  configured?: boolean;
  /** der-2.0.17: actual bytes written under the DER data root. */
  derDataRootBytes?: number;
  /** der-2.0.17: pg_total_relation_size sum over the `der` schema. */
  derDbSchemaBytes?: number;
}

export interface SystemInfoApps {
  installed?: number;
  enabled?: number;
  items?: Array<{ key: string; name: string; version: string; enabled: boolean; launchUrl: string }>;
  configured?: boolean;
}

export interface SystemInfo {
  service: string;
  timestamp: string;
  build: {
    version: string; commit: string; branch: string;
    dirty: boolean; buildTime: string;
  };
  runtime: SystemInfoRuntime;
  dhis2: SystemInfoDhis2;
  database: SystemInfoDatabase;
  scheduler: SystemInfoScheduler;
  journal: Record<string, number>;
  storage: SystemInfoStorage;
  apps: SystemInfoApps;
  attribution?: { mappedUsers?: number; configured?: boolean };
}

// Backward-compat for existing /diagnostics callers.
export interface Diagnostics extends SystemInfo {
  memoryMb?: number;
  uptimeSeconds?: number;
  schedulerBacklog?: number;
  journalBacklog?: Record<string, number>;
}

export function diagnostics(): Promise<Diagnostics> {
  return request<Diagnostics>('GET', '/edge-api/v1/admin/diagnostics');
}

export function systemInfo(): Promise<SystemInfo> {
  return request<SystemInfo>('GET', '/edge-api/v1/system/info');
}

export interface SettingsPayload {
  cron: Record<string, string>;
  featureFlags: Record<string, boolean>;
  roles: readonly string[];
}

export function readSettings(): Promise<SettingsPayload> {
  return request<SettingsPayload>('GET', '/edge-api/v1/admin/settings');
}

export function saveSettings(body: SettingsPayload): Promise<SettingsPayload> {
  return request<SettingsPayload>('POST', '/edge-api/v1/admin/settings', body);
}

// ---- der-1.1.0 Initiative 5: orgUnit binding (ADR-0015) ----

export interface OrgUnitBinding {
  bound: boolean;
  orgUnitId: string | null;
  orgUnitDisplayName: string | null;
  orgUnitPath: string | null;
  boundAt: string | null;
  boundBy: string | null;
}

export interface OrgUnitRow {
  id: string;
  displayName: string;
  code?: string;
  path?: string;
  level?: number;
  parent?: { id: string; displayName?: string };
  organisationUnitGroups?: Array<{ id: string; displayName?: string }>;
}

export interface OrgUnitGroupRow {
  id: string;
  displayName: string;
}
export interface OrgUnitGroupSetRow {
  id: string;
  displayName: string;
  organisationUnitGroups?: Array<{ id: string; displayName: string }>;
}

export function listOrgUnitGroups(): Promise<{ organisationUnitGroups: OrgUnitGroupRow[] }> {
  return request('GET', '/api/organisationUnitGroups?fields=id,displayName&paging=false');
}
export function listOrgUnitGroupSets(): Promise<{ organisationUnitGroupSets: OrgUnitGroupSetRow[] }> {
  return request('GET', '/api/organisationUnitGroupSets?fields=id,displayName,organisationUnitGroups[id,displayName]&paging=false');
}

export interface OrgUnitLevelRow {
  id: string;
  level: number;
  displayName: string;
}
export function listOrgUnitLevels(): Promise<{ organisationUnitLevels: OrgUnitLevelRow[] }> {
  return request('GET', '/api/organisationUnitLevels?fields=id,level,displayName&paging=false');
}

export interface Dhis2ConnectionPayload {
  baseUrl: string | null;
  username: string | null;
  password: string | null;
  patToken: string | null;
  passwordSet: boolean;
  patTokenSet: boolean;
  allowMismatch: boolean;
  pinnedVersion: string | null;
  minSupportedVersion: string | null;
  maxTestedVersion: string | null;
  compatMode: string | null;
  snapshotTtlHours: number | null;
  connectTimeoutMillis: number | null;
  proxyEnabled: boolean | null;
  proxyAllowWrites: boolean | null;
  proxyAllowPaths: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}
export function readDhis2Connection(): Promise<Dhis2ConnectionPayload> {
  return request('GET', '/edge-api/v1/admin/dhis2-connection');
}
export function writeDhis2Connection(body: Partial<Dhis2ConnectionPayload>): Promise<Dhis2ConnectionPayload> {
  return request('PUT', '/edge-api/v1/admin/dhis2-connection', body);
}

export interface LifecycleAck {
  status: string;
  requestedBy?: string;
  requestedAt?: string;
  sessionsRevoked?: number;
  note?: string;
  flagFile?: string;
}
export function adminShutdown(): Promise<LifecycleAck> {
  return request('POST', '/edge-api/v1/admin/lifecycle/shutdown');
}
export function adminRestart(): Promise<LifecycleAck> {
  return request('POST', '/edge-api/v1/admin/lifecycle/restart');
}
export function adminClearSessions(): Promise<LifecycleAck> {
  return request('POST', '/edge-api/v1/admin/lifecycle/clear-sessions');
}
export function adminReloadDhis2Config(): Promise<LifecycleAck> {
  return request('POST', '/edge-api/v1/admin/lifecycle/reload-dhis2-config');
}
export interface LifecycleLogs {
  status: string;
  path: string;
  totalLines?: number;
  linesRequested: number;
  entries: string[];
  error?: string;
}
export function adminLogs(lines = 200): Promise<LifecycleLogs> {
  return request('GET', `/edge-api/v1/admin/lifecycle/logs?lines=${lines}`);
}

export function getOrgUnitBinding(): Promise<OrgUnitBinding> {
  return request<OrgUnitBinding>('GET', '/edge-api/v1/system/org-unit');
}

export function bindOrgUnit(orgUnitId: string, confirm = false): Promise<OrgUnitBinding> {
  return request<OrgUnitBinding>('POST', '/edge-api/v1/system/org-unit',
    { orgUnitId, confirm });
}

export function listOrgUnits(opts: {
  level?: number;
  groupId?: string;
  parentId?: string;
  query?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ organisationUnits: OrgUnitRow[]; pager?: { page: number; pageSize: number; total: number; pageCount: number } }> {
  const params = new URLSearchParams();
  params.set('fields', 'id,displayName,code,path,level,parent[id,displayName],organisationUnitGroups[id,displayName]');
  const filters: string[] = [];
  if (opts.level) filters.push(`level:eq:${opts.level}`);
  if (opts.groupId) filters.push(`organisationUnitGroups.id:eq:${opts.groupId}`);
  if (opts.parentId) filters.push(`parent.id:eq:${opts.parentId}`);
  if (opts.query) filters.push(`displayName:ilike:${opts.query}`);
  for (const f of filters) params.append('filter', f);
  if (opts.pageSize != null) {
    params.set('pageSize', String(opts.pageSize));
    params.set('page', String(opts.page ?? 1));
  } else {
    params.set('paging', 'false');
  }
  return request('GET', '/api/organisationUnits?' + params.toString());
}

/** Fetch one OU payload by UID. Returns `null` when not mirrored. */
export async function getOrganisationUnit(uid: string)
    : Promise<{ id: string; displayName?: string; path?: string } | null> {
  try {
    return await request<{ id: string; displayName?: string; path?: string }>(
      'GET', `/api/organisationUnits/${encodeURIComponent(uid)}`);
  } catch (e) {
    if (e instanceof EdgeApiError && e.status === 404) return null;
    throw e;
  }
}

// ---- der-1.1.0-alpha.2 Initiative 4: approval (ADR-0016) ----

export interface PendingApprovalRow {
  operationId: string;
  entityType: string;
  entityRef: string;
  submittedBy: string | null;
  createdAt: string;
}

export function listPendingApprovals(limit = 100): Promise<{ rows: PendingApprovalRow[] }> {
  return request<{ rows: PendingApprovalRow[] }>(
    'GET', `/edge-api/v1/approvals/pending?limit=${limit}`);
}

export function approveOperation(operationId: string): Promise<{ outcome: string }> {
  return request('POST', `/edge-api/v1/approvals/${operationId}/approve`);
}

export function rejectOperation(operationId: string, reason: string): Promise<{ outcome: string }> {
  return request('POST', `/edge-api/v1/approvals/${operationId}/reject`, { reason });
}

// ---- der-1.2.0-alpha.1 Initiative 10 slice A: capture-workflow config (ADR-0018) ----

export type OwnerRole = 'ADMIN' | 'OPERATOR' | 'REVIEWER';
export type StepKind = 'CAPTURE' | 'REVIEW' | 'APPROVE' | 'DISPATCH';
export type FieldRequirement = 'REQUIRED' | 'OPTIONAL' | 'READONLY' | 'HIDDEN';

export interface CaptureWorkflowField {
  fieldRef: string;
  requirement: FieldRequirement;
}

export interface CaptureWorkflowStep {
  stepId?: string;
  ordinal: number;
  displayName: string;
  ownerRole: OwnerRole;
  stepKind: StepKind;
  fields: readonly CaptureWorkflowField[];
}

export interface CaptureWorkflowDependency {
  stepId: string;
  dependsOnStepId: string;
  kind: 'COMPLETES_BEFORE';
}

export interface CaptureWorkflowSummary {
  workflowId: string;
  displayName: string;
  boundMetadataKind: 'DATA_SET' | 'PROGRAM' | 'PROGRAM_STAGE';
  boundMetadataId: string;
  enabled: boolean;
  version: number;
  createdAt?: string;
  updatedAt?: string;
  steps: readonly CaptureWorkflowStep[];
  dependencies: readonly CaptureWorkflowDependency[];
}

export interface CaptureWorkflowRun {
  runId: string;
  workflowVersion: number;
  businessKey: string;
  currentStepId: string | null;
  state: 'OPEN' | 'AWAITING' | 'COMPLETED' | 'REJECTED';
  createdAt: string;
}

export function listWorkflows(): Promise<{ workflows: CaptureWorkflowSummary[] }> {
  return request<{ workflows: CaptureWorkflowSummary[] }>('GET', '/edge-api/v1/workflows');
}

export function getWorkflow(id: string): Promise<CaptureWorkflowSummary> {
  return request<CaptureWorkflowSummary>('GET', `/edge-api/v1/workflows/${id}`);
}

export function saveWorkflow(w: Partial<CaptureWorkflowSummary> & {
  displayName: string;
  boundMetadataId: string;
  enabled: boolean;
}): Promise<CaptureWorkflowSummary> {
  if (w.workflowId) {
    return request<CaptureWorkflowSummary>('PUT',
      `/edge-api/v1/workflows/${w.workflowId}`, w);
  }
  return request<CaptureWorkflowSummary>('POST', '/edge-api/v1/workflows', w);
}

export function deleteWorkflow(id: string): Promise<void> {
  return request<void>('DELETE', `/edge-api/v1/workflows/${id}`);
}

export function listWorkflowRuns(id: string): Promise<{ runs: CaptureWorkflowRun[] }> {
  return request<{ runs: CaptureWorkflowRun[] }>('GET',
    `/edge-api/v1/workflows/${id}/runs`);
}

// ---- der-1.3.0-alpha.3 Initiative 10 slice B (ADR-0024): import/export ----

export interface CanonicalWorkflow {
  schemaVersion: number;
  displayName: string;
  boundMetadataKind: 'DATA_SET' | 'PROGRAM' | 'PROGRAM_STAGE';
  boundMetadataId: string;
  enabled: boolean;
  steps: Array<{
    ordinal: number;
    displayName: string;
    ownerRole: 'ADMIN' | 'OPERATOR' | 'REVIEWER';
    ownerDeviceId: string | null;
    stepKind: 'CAPTURE' | 'REVIEW' | 'APPROVE' | 'DISPATCH';
    fields: Array<{ fieldRef: string; requirement: 'REQUIRED' | 'OPTIONAL' | 'READONLY' | 'HIDDEN' }>;
  }>;
  dependencies: Array<{ fromOrdinal: number; toOrdinal: number; kind: 'COMPLETES_BEFORE' }>;
}

export interface WorkflowImportResponse {
  dryRun: boolean;
  warnings: string[];
  workflow: CaptureWorkflowSummary;
}

export function exportWorkflow(id: string): Promise<CanonicalWorkflow> {
  return request<CanonicalWorkflow>('GET', `/edge-api/v1/workflows/${id}/export`);
}

export function importWorkflow(body: CanonicalWorkflow, dryRun = false):
    Promise<WorkflowImportResponse> {
  return request<WorkflowImportResponse>('POST',
    `/edge-api/v1/workflows/import?dryRun=${dryRun}`, body);
}

// ---- der-1.3.0-alpha.4 Initiative 10 slice B (ADR-0025): contributions ----

export interface CaptureWorkflowContributionRow {
  contributionId: string;
  runId: string;
  stepId: string;
  submittedBy: string | null;
  submittedDeviceId: string | null;
  submittedAt: string;
}

export function listWorkflowContributions(runId: string):
    Promise<{ contributions: CaptureWorkflowContributionRow[] }> {
  return request('GET', `/edge-api/v1/workflows/runs/${runId}/contributions`);
}

// ---- der-1.2.0-alpha.2 Initiative 1: device management (ADR-0019) ----

export type DeviceStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REVOKED';

export interface EdgeDeviceRow {
  deviceId: string;
  assignedUserId: string | null;
  enrolledAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  lastSeenAt: string | null;
  userAgent: string | null;
  firmwareVersion: string | null;
  status: DeviceStatus;
}

export function listDevices(): Promise<{ devices: EdgeDeviceRow[] }> {
  return request<{ devices: EdgeDeviceRow[] }>('GET', '/edge-api/v1/devices');
}

export function approveDevice(id: string): Promise<{ outcome: string }> {
  return request('POST', `/edge-api/v1/devices/${id}/approve`);
}

export function suspendDevice(id: string): Promise<{ outcome: string }> {
  return request('POST', `/edge-api/v1/devices/${id}/suspend`);
}

export function revokeDevice(id: string): Promise<{ outcome: string }> {
  return request('POST', `/edge-api/v1/devices/${id}/revoke`);
}

export function deleteDevice(id: string): Promise<void> {
  return request<void>('DELETE', `/edge-api/v1/devices/${id}`);
}

// ---- der-1.2.0-alpha.4 Initiative 7: analytics (ADR-0020) ----

export type AnalyticsKind = 'AGGREGATE' | 'EVENT';

export interface FacilitySummaryRow {
  orgUnitId: string;
  period: string;
  kind: AnalyticsKind;
  n: number;
  refreshedAt: string;
}

export interface FacilitySummaryResponse {
  rows: FacilitySummaryRow[];
  lastRefreshedAt: string | null;
}

export function analyticsSummary(orgUnit?: string, kind?: AnalyticsKind):
    Promise<FacilitySummaryResponse> {
  const q = new URLSearchParams();
  if (orgUnit) q.set('orgUnit', orgUnit);
  if (kind) q.set('kind', kind);
  const qs = q.toString();
  return request('GET', '/edge-api/v1/analytics/summary'
    + (qs ? '?' + qs : ''));
}

export function analyticsRejections(limit = 500): Promise<{ count: number }> {
  return request('GET', `/edge-api/v1/analytics/rejections?limit=${limit}`);
}

export function analyticsRefresh(): Promise<{ outcome: string; lastRefreshedAt?: string }> {
  return request('POST', '/edge-api/v1/analytics/refresh');
}

// EA-AUD-01 — ADR-0021 hash-chain verify.
export type AuditChainBreakReason = 'PREV_HASH_MISMATCH' | 'ROW_HASH_MISMATCH';
export interface AuditChainVerifyResponse {
  ok: boolean;
  totalRows: number;
  firstBreakAuditId: number | null;
  firstBreakReason: AuditChainBreakReason | null;
}
export function verifyAuditChain(): Promise<AuditChainVerifyResponse> {
  return request('GET', '/edge-api/v1/security/audit/verify');
}

/** C2: audit event timeline. */
export interface AuditEventRow {
  eventType: string;
  actorUserId: string | null;
  subjectUserId: string | null;
  clientIp: string | null;
  userAgent: string | null;
  outcome: string;
  detail: string;
  observedAt: string;
}

export interface AuditEventsResponse {
  count: number;
  events: AuditEventRow[];
}

export function listAuditEvents(opts: {
  eventType?: string; actorUserId?: string; limit?: number;
} = {}): Promise<AuditEventsResponse> {
  const q = new URLSearchParams();
  if (opts.eventType) q.set('eventType', opts.eventType);
  if (opts.actorUserId) q.set('actorUserId', opts.actorUserId);
  q.set('limit', String(opts.limit ?? 100));
  return request<AuditEventsResponse>(
    'GET', `/edge-api/v1/security/audit/events?${q.toString()}`);
}

// ──────────────────────────────────────────────────────────────────────
// Network module — docs/requirements/DER_Network_Module_Design_Specification.md
// Thin client over /edge-api/v1/network/*. Server endpoints land in Phase N1-N3;
// until then these calls 404 and the UI falls back to safe empty states.
// ──────────────────────────────────────────────────────────────────────

export type ConnectivityState = 'CONNECTED' | 'OFFLINE_FIRST' | 'RECOVERING'
  | 'LOCAL_NETWORK_DEGRADED' | 'EDGE_NETWORK_UNAVAILABLE'
  | 'CENTRAL_AUTH_FAILURE' | 'DNS_FAILURE' | 'CERTIFICATE_FAILURE';

export interface NetworkStatus {
  state: ConnectivityState;
  localApAvailable: boolean;
  localLanAvailable: boolean;
  internetAvailable: boolean;
  centralDhis2Available: boolean;
  dnsAvailable?: boolean;
  gateway: string | null;
  subnet: string | null;
  hostname: string | null;
  lastProbeAt: string | null;
  warnings: readonly string[];
}

export interface NetworkInterface {
  name: string;                 // wlan0, eth0, wwan0, …
  kind: 'wifi' | 'ethernet' | 'cellular' | 'virtual' | 'loopback';
  state: 'up' | 'down' | 'degraded' | 'unknown';
  address: string | null;
  mac: string | null;
  rxBytes: number | null;
  txBytes: number | null;
  linkSpeed: string | null;
  purpose: 'local-ap' | 'facility-lan' | 'upstream-wifi' | 'cellular-fallback' | 'unknown';
  priority?: number;
}

export interface AccessPointStatus {
  running: boolean;
  interface: string | null;
  ssid: string | null;
  band: string | null;
  channel: number | null;
  security: string | null;
  clients: number;
  gateway: string | null;
  subnet?: string | null;
  dhcpActive: boolean;
  edgeId: string | null;
  startedAt: string | null;
}

export interface NetworkClient {
  deviceId: string;              // enrolment id if approved, else temp id
  derDeviceId?: string;          // cross-reference to the DER device record (if any)
  owner: string | null;
  hostname: string | null;
  ip: string;
  mac?: string | null;
  link: 'wifi' | 'ethernet' | 'cellular';
  signalDbm: number | null;
  trust: 'APPROVED' | 'PENDING' | 'REVOKED' | 'BLOCKED' | 'UNKNOWN';
  certificateFingerprint?: string | null;
  firstSeenAt?: string | null;
  lastSeenAt: string;
  bytesTx: number | null;
  bytesRx: number | null;
}

export interface NetworkPeer {
  id: string;
  nodeId: string;
  siteId: string | null;
  endpoint: string;              // e.g. "10.88.0.5:51820" for WireGuard
  publicKey?: string | null;
  allowedIps?: string | null;
  state: 'CONNECTED' | 'HANDSHAKING' | 'DISCONNECTED' | 'ERROR';
  lastHandshake: string | null;
  rxBytes: number | null;
  txBytes: number | null;
  allowedServices?: readonly string[];
  trust: 'TRUSTED' | 'UNVERIFIED' | 'REVOKED';
}

export interface NetworkRoute {
  id: string;
  destination: string;
  gateway: string | null;
  interface: string | null;
  metric: number;
  source: string;
  active: boolean;
}

export interface NetworkEvent {
  eventId: string;
  eventType: string;             // AP_STARTED, DEVICE_APPROVED, WAN_LOST, …
  actor: string | null;
  deviceId: string | null;
  nodeId: string | null;
  interfaceName: string | null;
  outcome: 'SUCCESS' | 'FAILURE' | 'INFO';
  reason: string | null;
  correlationId: string | null;
  observedAt: string;
}

export function networkStatus(): Promise<NetworkStatus> {
  return request<NetworkStatus>('GET', '/edge-api/v1/network/status');
}
export function networkInterfaces(): Promise<{ interfaces: NetworkInterface[] }> {
  return request<{ interfaces: NetworkInterface[] }>('GET', '/edge-api/v1/network/interfaces');
}
export function networkAccessPoint(): Promise<AccessPointStatus> {
  return request<AccessPointStatus>('GET', '/edge-api/v1/network/access-point');
}
export function networkClients(): Promise<{ clients: NetworkClient[] }> {
  return request<{ clients: NetworkClient[] }>('GET', '/edge-api/v1/network/clients');
}
export function networkPeers(): Promise<{ peers: NetworkPeer[] }> {
  return request<{ peers: NetworkPeer[] }>('GET', '/edge-api/v1/network/peers');
}
export function networkRoutes(): Promise<{ routes: NetworkRoute[] }> {
  return request<{ routes: NetworkRoute[] }>('GET', '/edge-api/v1/network/routes');
}
export function networkEvents(limit = 100): Promise<{ events: NetworkEvent[] }> {
  return request<{ events: NetworkEvent[] }>('GET',
    `/edge-api/v1/network/events?limit=${limit}`);
}

export function networkApStart(): Promise<{ triggered: boolean }> {
  return request('POST', '/edge-api/v1/network/ap/start');
}
export function networkApStop(): Promise<{ triggered: boolean }> {
  return request('POST', '/edge-api/v1/network/ap/stop');
}
export function networkApRotateKey(): Promise<{ rotatedAt: string }> {
  return request('POST', '/edge-api/v1/network/ap/rotate-key');
}
export function networkApRestart(): Promise<{ triggered: boolean }> {
  return request('POST', '/edge-api/v1/network/ap/restart');
}
export function networkApEnrolmentQr(): Promise<{ ssid: string; payload: string; qrSvg: string; expiresAt: string | null }> {
  return request('GET', '/edge-api/v1/network/ap/qr');
}
export function networkDeviceApprove(deviceId: string): Promise<{ approved: boolean }> {
  return request('POST', `/edge-api/v1/network/devices/${encodeURIComponent(deviceId)}/approve`);
}
export function networkDeviceRevoke(deviceId: string): Promise<{ revoked: boolean }> {
  return request('POST', `/edge-api/v1/network/devices/${encodeURIComponent(deviceId)}/revoke`);
}
export function networkDeviceBlock(deviceId: string): Promise<{ blocked: boolean }> {
  return request('POST', `/edge-api/v1/network/devices/${encodeURIComponent(deviceId)}/block`);
}
export function networkDeviceUnblock(deviceId: string): Promise<{ unblocked: boolean }> {
  return request('POST', `/edge-api/v1/network/devices/${encodeURIComponent(deviceId)}/unblock`);
}
export function networkInterfaceSetState(
  name: string, body: { state: 'up' | 'down' }): Promise<{ state: string }> {
  return request('POST', `/edge-api/v1/network/interfaces/${encodeURIComponent(name)}/state`, body);
}
export function networkPeerConnect(peerId: string): Promise<{ connected: boolean }> {
  return request('POST', `/edge-api/v1/network/peers/${encodeURIComponent(peerId)}/connect`);
}
export function networkPeerDisconnect(peerId: string): Promise<{ disconnected: boolean }> {
  return request('DELETE', `/edge-api/v1/network/peers/${encodeURIComponent(peerId)}`);
}
export function networkPeerRemove(peerId: string): Promise<{ removed: boolean }> {
  return request('DELETE', `/edge-api/v1/network/peers/${encodeURIComponent(peerId)}/remove`);
}
export function networkEventsClear(): Promise<{ cleared: number }> {
  return request('DELETE', '/edge-api/v1/network/events');
}
export function networkPeerAdd(body: {
  nodeId?: string; siteId?: string | null; endpoint: string;
  publicKey: string; allowedIps?: string;
}): Promise<{ id: string }> {
  return request('POST', '/edge-api/v1/network/peers', body);
}
export interface NetworkPolicyRule {
  id: string; position: number;
  sourceZone: string; destinationZone: string;
  action: 'allow' | 'controlled' | 'deny';
  note: string | null;
  updatedAt: string | null;
}
export function networkPolicy(): Promise<{ rules: NetworkPolicyRule[] }> {
  return request('GET', '/edge-api/v1/network/policy');
}
export function networkPolicyAdd(body: {
  position?: number; sourceZone: string; destinationZone: string;
  action: 'allow' | 'controlled' | 'deny'; note?: string;
}): Promise<{ id: string }> {
  return request('POST', '/edge-api/v1/network/policy', body);
}
export function networkPolicyUpdate(id: string, body: {
  action: 'allow' | 'controlled' | 'deny'; note?: string;
}): Promise<{ updated: boolean }> {
  return request('PUT', `/edge-api/v1/network/policy/${encodeURIComponent(id)}`, body);
}
export function networkPolicyDelete(id: string): Promise<{ deleted: boolean }> {
  return request('DELETE', `/edge-api/v1/network/policy/${encodeURIComponent(id)}`);
}
export interface NetworkCaInfo {
  algorithm: string; publicKeyBase64: string;
  fingerprint: string; createdAt: string;
}
export function networkCa(): Promise<NetworkCaInfo> {
  return request('GET', '/edge-api/v1/network/ca');
}

export interface NetworkLease {
  mac: string; ip: string; hostname: string | null;
  issuedAt: string | null; expiresAt: string | null;
  staticLease: boolean;
}
export function networkLeases(): Promise<{ leases: NetworkLease[] }> {
  return request('GET', '/edge-api/v1/network/leases');
}

export interface NetworkEnrolToken {
  tokenHash: string;
  issuedAt: string | null; expiresAt: string | null;
  deviceIdHint: string | null;
  consumedAt: string | null; consumedBy: string | null;
  issuedBy?: string | null;
}
export function networkEnrolTokens(): Promise<{ tokens: NetworkEnrolToken[] }> {
  return request('GET', '/edge-api/v1/network/enrol-tokens');
}
export function networkEnrolTokenIssue(body: {
  ttlSeconds?: number; deviceIdHint?: string;
}): Promise<{ token: string; ttlSeconds: number; deviceIdHint: string }> {
  return request('POST', '/edge-api/v1/network/enrol-tokens', body);
}

/* ─── 2.1.91 — edit endpoints across sub-modules ─────────── */
export function networkSettings(): Promise<{ settings: Record<string, string> }> {
  return request('GET', '/edge-api/v1/network/settings');
}
export function networkSettingPut(key: string, value: string): Promise<{ key: string; value: string }> {
  return request('PUT', `/edge-api/v1/network/settings/${encodeURIComponent(key)}`, { value });
}

export function networkEnrolTokenRevoke(tokenHash: string): Promise<{ revoked: boolean }> {
  return request('DELETE', `/edge-api/v1/network/enrol-tokens/${encodeURIComponent(tokenHash)}`);
}

export function networkLeasePin(body: { mac: string; ip: string; hostname?: string }):
    Promise<{ pinned: boolean }> {
  return request('POST', '/edge-api/v1/network/leases/static', body);
}
export function networkLeaseDelete(mac: string): Promise<{ deleted: boolean }> {
  return request('DELETE', `/edge-api/v1/network/leases/${encodeURIComponent(mac)}`);
}

export interface NetworkTlsCert {
  subject: string; issuer: string; algorithm: string;
  fingerprint: string; publicKeyBase64: string;
  notBefore: string; notAfter: string;
  san: string[]; renewable: boolean;
}
export function networkTls(): Promise<NetworkTlsCert> {
  return request('GET', '/edge-api/v1/network/tls');
}

export interface MdnsService {
  type: string; host: string; port: number; description: string;
}
export function networkMdns(): Promise<{ services: MdnsService[] }> {
  return request('GET', '/edge-api/v1/network/mdns');
}

export function networkExport(): Promise<Record<string, unknown>> {
  return request('GET', '/edge-api/v1/network/export');
}
export function networkImport(bundle: unknown): Promise<{
  rules: number; settings: number; interfaces: number; peers: number; leases: number;
}> {
  return request('POST', '/edge-api/v1/network/import', bundle);
}

/* ─── DER-MSG v1 — device-to-device bus ──────────────── */
export interface DeviceMessage {
  messageId: string;
  channel: string;
  fromDeviceId: string;
  fromUserId: string | null;
  messageType: string;
  payload: string;
  replyTo: string | null;
  expiresAt: string | null;
  createdAt: string;
}
export interface DeviceSubscription {
  deviceId: string;
  channel: string;
  cursorAt: string | null;
  lastPollAt: string | null;
  createdAt: string;
}
export interface MessagingStats {
  messagesTotal: number;
  devicesSubscribed: number;
  channelsActive: number;
  messagesLastHour: number;
  topChannels: Array<{ channel: string; n: number; lastAt: string }>;
}
export function messagingStats(): Promise<MessagingStats> {
  return request('GET', '/edge-api/v1/messaging/stats');
}
export function messagingLog(limit = 100): Promise<{ messages: DeviceMessage[] }> {
  return request('GET', `/edge-api/v1/messaging/log?limit=${limit}`);
}
export function messagingSubscriptions(): Promise<{ subscriptions: DeviceSubscription[] }> {
  return request('GET', '/edge-api/v1/messaging/subscriptions');
}
export function messagingPublish(body: {
  channel: string; fromDeviceId: string; messageType: string;
  payload?: Record<string, unknown>; replyTo?: string; ttlSeconds?: number;
}): Promise<{ messageId: string }> {
  return request('POST', '/edge-api/v1/messaging/publish', body);
}
export function messagingRecent(deviceId: string, since?: string, limit = 50):
    Promise<{ messages: DeviceMessage[] }> {
  const q = new URLSearchParams({ deviceId, limit: String(limit) });
  if (since) q.set('since', since);
  return request('GET', `/edge-api/v1/messaging/recent?${q.toString()}`);
}
export function messagingSubscribe(body: { deviceId: string; channel: string }):
    Promise<{ subscribed: boolean }> {
  return request('POST', '/edge-api/v1/messaging/subscribe', body);
}
export function messagingUnsubscribe(deviceId: string, channel: string):
    Promise<{ removed: number }> {
  const q = new URLSearchParams({ deviceId, channel }).toString();
  return request('DELETE', `/edge-api/v1/messaging/subscribe?${q}`);
}

export function networkApEdit(body: {
  ssid?: string; band?: string; channel?: number;
  security?: string; interfaceName?: string;
  gateway?: string; subnet?: string;
}): Promise<{ updated: boolean }> {
  return request('PUT', '/edge-api/v1/network/access-point', body);
}
export function networkClientEdit(deviceId: string, body: {
  owner?: string | null; hostname?: string | null;
}): Promise<{ updated: boolean }> {
  return request('PUT', `/edge-api/v1/network/clients/${encodeURIComponent(deviceId)}`, body);
}
export function networkInterfaceEdit(name: string, body: {
  priority?: number; purpose?: string;
}): Promise<{ updated: boolean }> {
  return request('PUT', `/edge-api/v1/network/interfaces/${encodeURIComponent(name)}`, body);
}
export function networkPeerEdit(id: string, body: {
  nodeId?: string; siteId?: string | null; endpoint?: string;
  publicKey?: string; allowedIps?: string;
}): Promise<{ updated: boolean }> {
  return request('PUT', `/edge-api/v1/network/peers/${encodeURIComponent(id)}`, body);
}
export function networkPolicyEditFull(id: string, body: {
  position?: number; sourceZone?: string; destinationZone?: string;
  action?: 'allow' | 'controlled' | 'deny'; note?: string;
}): Promise<{ updated: boolean }> {
  return request('PUT', `/edge-api/v1/network/policy/${encodeURIComponent(id)}`, body);
}
