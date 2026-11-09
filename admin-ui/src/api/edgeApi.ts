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
    /* §2.3.122 R-AQ/followup — "all buttons dead" bug fix.
     * When a server-side session expires mid-use (TTL hit, DER
     * restart, admin kick), every subsequent click fetches 401 but
     * React still thinks state=AUTHENTICATED, so no component
     * redirects. User sees a page that *looks* authenticated but
     * every interaction silently fails — including the Logout
     * button, since AdminShell doesn't re-check session before
     * rendering. Here we force a one-shot redirect to /sign-in on
     * the first mid-session 401, so the user lands on a page
     * where they can actually recover.
     *
     * We skip this redirect for the auth probe endpoints (session,
     * sign-in, sign-out) because those paths own the auth lifecycle
     * themselves — redirecting on their 401 would create a loop. */
    const isAuthProbe =
      path.endsWith('/auth/session')
      || path.endsWith('/auth/sign-in')
      || path.endsWith('/auth/sign-out');
    if (!isAuthProbe && typeof window !== 'undefined'
        && window.location.pathname !== '/admin/sign-in') {
      window.location.replace('/admin/sign-in?reason=session-expired');
    }
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
  /** E6 — present when the draft is scheduled for auto-publish. */
  scheduledPublishAt?: string | null;
  /** V072 — the workflow run that created this draft, when the
   *  draft came from a workflow step. Null for ad-hoc captures. */
  workflowRunId?: string | null;
  /** Server attribution — set on every draft, used by the UI. */
  ownerId?: string;
  createdAt?: string;
}

export function listDrafts(opts?: { workflowRunId?: string }):
Promise<{ drafts: DraftRow[] }> {
  const qs = opts?.workflowRunId
    ? `?workflowRunId=${encodeURIComponent(opts.workflowRunId)}`
    : '';
  return request<{ drafts: DraftRow[] }>('GET', `/edge-api/v1/drafts${qs}`);
}

export function saveDraft(draft: Omit<DraftRow, 'draftId' | 'updatedAt'>): Promise<DraftRow> {
  return request<DraftRow>('POST', '/edge-api/v1/drafts', draft);
}

export function deleteDraft(draftId: string): Promise<void> {
  return request<void>('DELETE', `/edge-api/v1/drafts/${draftId}`);
}

/** Phase 07.1 — publish a draft into the outbound journal. Shape of
 *  `conflicts` matches the server's import-summary conflicts list
 *  ({key, reason} for aggregate; {eventId, reason} for event). */
export interface DraftPublishResult {
  draftId: string;
  kind: string;
  imported: number;
  ignored?: number;
  conflicts: Array<Record<string, string>>;
  draftConsumed: boolean;
}
export function publishDraft(draftId: string): Promise<DraftPublishResult> {
  return request<DraftPublishResult>('POST',
    `/edge-api/v1/drafts/${encodeURIComponent(draftId)}/publish`);
}

/** E6 — schedule a draft for auto-publish at a future ISO-8601 UTC
 *  timestamp. Server rejects timestamps older than 5s past.
 *  Response is 202 Accepted; the draft stays until the scheduler
 *  tick picks it up. */
export interface DraftScheduleResult {
  draftId: string;
  scheduledPublishAt: string;
  status: 'SCHEDULED';
}
export function scheduleDraftPublish(
  draftId: string,
  publishAt: string,
): Promise<DraftScheduleResult> {
  return request<DraftScheduleResult>('POST',
    `/edge-api/v1/drafts/${encodeURIComponent(draftId)}/schedule`,
    { publishAt });
}

/** E6 — cancel a pending schedule without discarding the draft. */
export interface DraftScheduleCancelResult {
  draftId: string;
  status: 'SCHEDULE_CLEARED';
}
export function cancelDraftSchedule(draftId: string):
Promise<DraftScheduleCancelResult> {
  return request<DraftScheduleCancelResult>('DELETE',
    `/edge-api/v1/drafts/${encodeURIComponent(draftId)}/schedule`);
}

/** Phase 14.5b — bulk publish. Server accepts up to 100 draftIds
 *  and returns per-row results. One failure doesn't abort the batch. */
export interface DraftPublishBatchRow {
  draftId: string | null;
  status: 'PUBLISHED' | 'FAILED';
  imported?: number;
  conflicts?: Array<Record<string, string>>;
  draftConsumed?: boolean;
  error?: string;
  httpStatus?: number;
}
export interface DraftPublishBatchResult {
  consumed: number;
  kept: number;
  results: DraftPublishBatchRow[];
}
export function publishDraftsBatch(draftIds: ReadonlyArray<string>):
Promise<DraftPublishBatchResult> {
  return request<DraftPublishBatchResult>('POST',
    '/edge-api/v1/drafts/publish-batch', { draftIds });
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

/** Phase 08 — authoritative central reachability state. Replaces the
 *  "advisory" PingSnapshot for anything that needs a stable signal
 *  (sync-drain gate, topbar badge tone, operator "offline since X"). */
export interface ReachabilityStatus {
  state: 'REACHABLE' | 'DEGRADED' | 'OFFLINE';
  since: string;
  consecutiveSuccess: number;
  consecutiveFailure: number;
  drainsAllowed: boolean;
}
export function reachabilityStatus(): Promise<ReachabilityStatus> {
  return request<ReachabilityStatus>('GET', '/edge-api/v1/dhis2/reachability');
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
  /** EA-33: per-operator metrics aggregation groups by this uid. */
  submittedBy?: string | null;
}

export function listConflicts(limit = 100): Promise<ConflictRow[]> {
  return request<ConflictRow[]>('GET', `/edge-api/v1/journal/conflicts?limit=${limit}`);
}

/** Phase 13.4 — central-side payload for one conflict row.
 *  `lastResponse` is pre-parsed JSON when central responded with
 *  valid JSON; falls back to `lastResponseRaw` otherwise. */
export interface ConflictCentralResponse {
  operationId: string;
  lastResponse: Record<string, unknown> | null;
  lastResponseRaw?: string | null;
  lastError?: string | null;
}
export function fetchConflictCentralResponse(opId: string): Promise<ConflictCentralResponse> {
  return request<ConflictCentralResponse>('GET',
    `/edge-api/v1/journal/conflicts/${encodeURIComponent(opId)}/central-response`);
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

// ──────────────────────────────────────────────────────────────────
// Data module — §2.3.81 R-C/1 — local aggregate browse.
// ──────────────────────────────────────────────────────────────────

/** Row-level sync state as returned by the DER data endpoints. Mirrors
 *  the OperationJournalEntry state machine on the server, with the
 *  extra `LOCAL_ONLY` value when there's no matching outbox row. */
export type LocalDataSyncState =
  | 'LOCAL_ONLY'
  | 'PENDING'
  | 'IN_FLIGHT'
  | 'RETRYABLE'
  | 'CENTRAL_ACCEPTED'
  | 'CENTRAL_REJECTED'
  | 'CONFLICT_REVIEW'
  | 'REQUIRES_APPROVAL'
  | 'QUARANTINED'
  | 'UNKNOWN_OUTCOME';

export interface LocalAggregateRow {
  valueId: string;
  dataElementUid: string;
  orgUnitUid: string;
  periodIso: string;
  categoryOptionComboUid: string;
  attributeOptionComboUid: string;
  valueText: string;
  comment: string | null;
  submittedBy: string | null;
  submittedAt: string | null;
  valueVersion: number;
  /** §2.3.83 — DHIS2 dataSet UID this value was captured through.
   *  Nullable: pre-V069 rows + ad-hoc writes without an envelope
   *  dataset. */
  dataSetUid: string | null;
  /** Resolved display name from `metadata_data_set`; null when the
   *  dataset is unknown or the tag is missing. */
  dataSetName: string | null;
  /** §2.3.85 — capture workflow run that produced this value. For
   *  DHIS2 Data Entry web app passthroughs the server auto-wraps the
   *  write in a SYSTEM workflow run so this is populated for every
   *  new write. */
  workflowRunId: string | null;
  workflowName: string | null;
  workflowBusinessKey: string | null;
  /** 'USER' for operator-authored workflows, 'SYSTEM' for the DER-
   *  managed ones (web-app passthrough, referral ingest, etc.). */
  workflowKind: 'USER' | 'SYSTEM' | null;
  /** null when the local row exists but no journal entry does yet. */
  syncState: LocalDataSyncState | null;
  operationId: string | null;
}

export interface LocalAggregatePipeline {
  captured: number;    // total rows in aggregate_data_value
  inJournal: number;   // PENDING + IN_FLIGHT + RETRYABLE
  pendingPush: number; // PENDING + RETRYABLE
  synced: number;      // CENTRAL_ACCEPTED
  attention: number;   // CONFLICT_REVIEW + CENTRAL_REJECTED
}

/** §2.3.89 R-C/3 — Local Tracker browse row (TEI / enrolment /
 *  tracker event discriminated by `kind`). */
export interface LocalTrackerRow {
  kind: 'TEI' | 'ENROLLMENT' | 'EVENT';
  rowId: string;
  teiUid?: string | null;
  enrollmentUid?: string | null;
  eventUid?: string | null;
  teType?: string | null;
  teTypeName?: string | null;
  programUid?: string | null;
  programName?: string | null;
  programStageUid?: string | null;
  programStageName?: string | null;
  orgUnitUid?: string | null;
  status?: string | null;
  enrollmentDate?: string | null;
  occurredDate?: string | null;
  createdAt?: string | null;
  sortTs?: string | null;
  version: number;
  workflowRunId: string | null;
  workflowName: string | null;
  workflowBusinessKey: string | null;
  workflowKind: 'USER' | 'SYSTEM' | null;
  /** §2.3.94 R-C/3.2 — latest operation_journal state for this
   *  tracker row; null when no outbox entry exists yet (either a
   *  pre-R-C/3.2 write or a CENTRAL_DOWNLOAD-only row). */
  syncState: LocalDataSyncState | null;
  operationId: string | null;
}

export function listLocalTracker(opts?: {
  kind?: 'TEI' | 'ENROLLMENT' | 'EVENT';
  program?: string;
  orgUnit?: string;
  teiUid?: string;
  workflowRunId?: string;
  workflowId?: string;
  occurredFrom?: string;
  occurredTo?: string;
  limit?: number;
}): Promise<{ rows: LocalTrackerRow[]; limit: number }> {
  const q = new URLSearchParams();
  if (opts?.kind)          q.set('kind', opts.kind);
  if (opts?.program)       q.set('program', opts.program);
  if (opts?.orgUnit)       q.set('orgUnit', opts.orgUnit);
  if (opts?.teiUid)        q.set('teiUid', opts.teiUid);
  if (opts?.workflowRunId) q.set('workflowRunId', opts.workflowRunId);
  if (opts?.workflowId)    q.set('workflowId', opts.workflowId);
  if (opts?.occurredFrom)  q.set('occurredFrom', opts.occurredFrom);
  if (opts?.occurredTo)    q.set('occurredTo', opts.occurredTo);
  if (opts?.limit)         q.set('limit', String(opts.limit));
  const qs = q.toString();
  return request('GET',
    `/edge-api/v1/data/tracker${qs ? '?' + qs : ''}`);
}

/** §2.3.87 R-C/2 — Local Events browse row. */
export interface LocalEventRow {
  eventId: string;
  enrollmentId: string | null;
  programUid: string;
  programName: string | null;
  programStageUid: string;
  programStageName: string | null;
  orgUnitUid: string;
  occurredAt: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'VISITED' | 'SCHEDULE' | 'OVERDUE' | 'SKIPPED';
  eventVersion: number;
  dataValueCount: number;
  workflowRunId: string | null;
  workflowName: string | null;
  workflowBusinessKey: string | null;
  workflowKind: 'USER' | 'SYSTEM' | null;
  syncState: LocalDataSyncState | null;
  operationId: string | null;
}

export function listLocalEvents(opts?: {
  program?: string;
  programStage?: string;
  orgUnit?: string;
  status?: string;
  workflowRunId?: string;
  workflowId?: string;
  occurredFrom?: string;
  occurredTo?: string;
  limit?: number;
}): Promise<{ rows: LocalEventRow[]; limit: number }> {
  const q = new URLSearchParams();
  if (opts?.program)        q.set('program', opts.program);
  if (opts?.programStage)   q.set('programStage', opts.programStage);
  if (opts?.orgUnit)        q.set('orgUnit', opts.orgUnit);
  if (opts?.status)         q.set('status', opts.status);
  if (opts?.workflowRunId)  q.set('workflowRunId', opts.workflowRunId);
  if (opts?.workflowId)     q.set('workflowId', opts.workflowId);
  if (opts?.occurredFrom)   q.set('occurredFrom', opts.occurredFrom);
  if (opts?.occurredTo)     q.set('occurredTo', opts.occurredTo);
  if (opts?.limit)          q.set('limit', String(opts.limit));
  const qs = q.toString();
  return request('GET',
    `/edge-api/v1/data/events${qs ? '?' + qs : ''}`);
}

/** §2.3.86 R-C/1.4 — pull existing aggregate values from Central
 *  DHIS2 into DER's local store. Returns the system-workflow run
 *  that owns the pulled rows + import counters. */
export interface PullAggregateResult {
  runId: string;
  imported: number;
  ignored: number;
  errors: Array<{ key: string; reason: string }>;
}

export function pullAggregateFromCentral(req: {
  dataSet: string;
  orgUnit: string;
  period: string;
}): Promise<PullAggregateResult> {
  return request('POST', '/edge-api/v1/data/aggregate/pull-from-central', req);
}

/** §2.3.91 R-C/2.1 — pull existing events from Central DHIS2 into
 *  DER's local store. Returns the CENTRAL_DOWNLOAD system workflow
 *  run that owns the pulled rows. */
export interface PullEventsResult {
  runId: string;
  imported: number;
  ignored: number;
  errors: Array<{ key: string; reason: string }>;
}

export function pullEventsFromCentral(req: {
  program: string;
  programStage?: string;
  orgUnit: string;
  startDate?: string;
  endDate?: string;
}): Promise<PullEventsResult> {
  return request('POST', '/edge-api/v1/data/events/pull-from-central', req);
}

/** §2.3.93 R-C/3.1 — pull TEIs + enrolments + stage events cascaded
 *  from Central DHIS2 into DER's local tracker tables. */
export interface PullTrackerResult {
  runId: string;
  teis: number;
  enrolments: number;
  events: number;
  errors: number;
  errorDetails: Array<{ key: string; reason: string }>;
}

export function pullTrackerFromCentral(req: {
  program: string;
  orgUnit: string;
}): Promise<PullTrackerResult> {
  return request('POST', '/edge-api/v1/data/tracker/pull-from-central', req);
}

/** §2.3.92 R-C/2.2 — row-detail types for the Data module. */
export interface JournalHistoryEntry {
  operationId: string;
  state: LocalDataSyncState;
  attemptCount: number;
  lastError: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  nextHopOrgUnitUid: string | null;
}

export interface LocalAggregateDetail {
  row: LocalAggregateRow & {
    dataElementName: string | null;
    orgUnitName: string | null;
    submittedByUsername: string | null;
    comment: string | null;
  };
  journal: JournalHistoryEntry[];
}

export function getLocalAggregate(valueId: string): Promise<LocalAggregateDetail> {
  return request('GET',
    `/edge-api/v1/data/aggregate/${encodeURIComponent(valueId)}`);
}

export interface LocalEventDataValue {
  dataElementUid: string;
  dataElementName: string | null;
  valueText: string;
}

export interface LocalEventDetail {
  row: LocalEventRow & {
    orgUnitName: string | null;
    createdBy: string | null;
    createdByUsername: string | null;
  };
  dataValues: LocalEventDataValue[];
  journal: JournalHistoryEntry[];
}

export function getLocalEvent(eventId: string): Promise<LocalEventDetail> {
  return request('GET',
    `/edge-api/v1/data/events/${encodeURIComponent(eventId)}`);
}

export interface LocalTeiDetail {
  tei: {
    teiUid: string;
    teType: string;
    teTypeName: string | null;
    orgUnitUid: string;
    orgUnitName: string | null;
    attributes: string;            // JSON string of attribute map
    createdAt: string | null;
    updatedAt: string | null;
    version: number;
    workflowRunId: string | null;
    workflowName: string | null;
    workflowBusinessKey: string | null;
    workflowKind: 'USER' | 'SYSTEM' | null;
  };
  enrolments: Array<{
    enrollmentUid: string;
    programUid: string;
    programName: string | null;
    orgUnitUid: string;
    status: string;
    enrollmentDate: string | null;
    incidentDate: string | null;
    updatedAt: string | null;
    version: number;
    workflowRunId: string | null;
    workflowName: string | null;
    workflowKind: 'USER' | 'SYSTEM' | null;
  }>;
  trackerEvents: Array<{
    eventUid: string;
    enrollmentUid: string | null;
    programUid: string;
    programName: string | null;
    programStageUid: string;
    programStageName: string | null;
    orgUnitUid: string;
    status: string;
    occurredDate: string | null;
    updatedAt: string | null;
    version: number;
  }>;
}

export function getLocalTei(teiUid: string): Promise<LocalTeiDetail> {
  return request('GET',
    `/edge-api/v1/data/tracker/tei/${encodeURIComponent(teiUid)}`);
}

export function listLocalAggregate(opts?: {
  orgUnit?: string;
  period?: string;
  dataElement?: string;
  dataSet?: string;
  workflowRunId?: string;
  workflowId?: string;
  limit?: number;
}): Promise<{ rows: LocalAggregateRow[]; limit: number; pipeline: LocalAggregatePipeline }> {
  const q = new URLSearchParams();
  if (opts?.orgUnit)       q.set('orgUnit', opts.orgUnit);
  if (opts?.period)        q.set('period', opts.period);
  if (opts?.dataElement)   q.set('dataElement', opts.dataElement);
  if (opts?.dataSet)       q.set('dataSet', opts.dataSet);
  if (opts?.workflowRunId) q.set('workflowRunId', opts.workflowRunId);
  if (opts?.workflowId)    q.set('workflowId', opts.workflowId);
  if (opts?.limit)         q.set('limit', String(opts.limit));
  const qs = q.toString();
  return request('GET',
    `/edge-api/v1/data/aggregate${qs ? '?' + qs : ''}`);
}

/** §2.3.97 R-E — "Ready for Central" payload previews.
 *
 *  The DER sync worker compiles workflow-captured rows into a DHIS2
 *  2.44-shaped envelope before POSTing. These three endpoints return
 *  the exact envelope that the next drain tick would push for the
 *  given workflow definition (or specific run) — only rows that are
 *  not yet synced (PENDING / RETRYABLE / un-journalled) are included.
 */
export interface CentralPayloadPreview<E> {
  endpoint: string;        // '/api/dataValueSets' | '/api/events' | '/api/tracker'
  httpMethod: 'POST';
  count: number;
  counts?: { trackedEntities: number; enrollments: number; events: number };
  payload: E;
}

export function previewAggregatePayload(opts: {
  workflowId?: string;
  workflowRunId?: string;
  limit?: number;
}): Promise<CentralPayloadPreview<{
  dataValues: Array<{
    dataElement: string;
    orgUnit: string;
    period: string;
    categoryOptionCombo: string;
    attributeOptionCombo: string;
    value: string;
    comment?: string;
  }>;
}>> {
  const q = new URLSearchParams();
  if (opts.workflowId)    q.set('workflowId', opts.workflowId);
  if (opts.workflowRunId) q.set('workflowRunId', opts.workflowRunId);
  if (opts.limit)         q.set('limit', String(opts.limit));
  return request('GET',
    `/edge-api/v1/data/aggregate/payload?${q.toString()}`);
}

export function previewEventsPayload(opts: {
  workflowId?: string;
  workflowRunId?: string;
  limit?: number;
}): Promise<CentralPayloadPreview<{
  events: Array<Record<string, unknown>>;
}>> {
  const q = new URLSearchParams();
  if (opts.workflowId)    q.set('workflowId', opts.workflowId);
  if (opts.workflowRunId) q.set('workflowRunId', opts.workflowRunId);
  if (opts.limit)         q.set('limit', String(opts.limit));
  return request('GET',
    `/edge-api/v1/data/events/payload?${q.toString()}`);
}

export function previewTrackerPayload(opts: {
  workflowId?: string;
  workflowRunId?: string;
  limit?: number;
}): Promise<CentralPayloadPreview<{
  trackedEntities: Array<Record<string, unknown>>;
  enrollments: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
}>> {
  const q = new URLSearchParams();
  if (opts.workflowId)    q.set('workflowId', opts.workflowId);
  if (opts.workflowRunId) q.set('workflowRunId', opts.workflowRunId);
  if (opts.limit)         q.set('limit', String(opts.limit));
  return request('GET',
    `/edge-api/v1/data/tracker/payload?${q.toString()}`);
}

/** §2.3.101 R-K — per-row payload lineage.
 *
 *  Each endpoint returns the single-row DHIS2 envelope (what Central
 *  would receive if the sync worker pushed only this row) + the full
 *  operation_journal history for the row's entity_ref. The admin UI
 *  renders this in a drawer that opens from a Data table row. */
export interface JournalEntry {
  operationId: string;
  state: LocalDataSyncState;
  attemptCount: number;
  lastError: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  nextHopOrgUnitUid: string | null;
}

export interface RowPayloadLineage<E> {
  endpoint: string;
  httpMethod: 'POST';
  counts?: { trackedEntities: number; enrollments: number; events: number };
  payload: E;
  journal: JournalEntry[];
  /** §2.3.105 R-Z — every single-row endpoint now also returns a
   *  stream-bucketed view keyed by the parent entity-type label
   *  ("dataValues", "events", "enrollments", "trackedEntity") so the
   *  drawer renders a consistent heading structure. The TEI drawer
   *  gets all three tracker keys populated; the per-row drawers get
   *  one. */
  journalByStream?: Partial<{
    trackedEntity: JournalEntry[];
    enrollments:   JournalEntry[];
    events:        JournalEntry[];
    dataValues:    JournalEntry[];
  }>;
}

export function aggregateRowPayload(valueId: string):
    Promise<RowPayloadLineage<{ dataValues: Array<Record<string, unknown>> }>> {
  return request('GET',
    `/edge-api/v1/data/aggregate/${encodeURIComponent(valueId)}/payload`);
}

export function eventRowPayload(eventId: string):
    Promise<RowPayloadLineage<{ events: Array<Record<string, unknown>> }>> {
  return request('GET',
    `/edge-api/v1/data/events/${encodeURIComponent(eventId)}/payload`);
}

export function teiRowPayload(teiUid: string):
    Promise<RowPayloadLineage<{
      trackedEntities: Array<Record<string, unknown>>;
      enrollments: Array<Record<string, unknown>>;
      events: Array<Record<string, unknown>>;
    }>> {
  return request('GET',
    `/edge-api/v1/data/tracker/tei/${encodeURIComponent(teiUid)}/payload`);
}

export function enrollmentRowPayload(enrollmentUid: string):
    Promise<RowPayloadLineage<{ enrollments: Array<Record<string, unknown>> }>> {
  return request('GET',
    `/edge-api/v1/data/tracker/enrollment/${encodeURIComponent(enrollmentUid)}/payload`);
}

export function trackerEventRowPayload(eventUid: string):
    Promise<RowPayloadLineage<{ events: Array<Record<string, unknown>> }>> {
  return request('GET',
    `/edge-api/v1/data/tracker/event/${encodeURIComponent(eventUid)}/payload`);
}

/** §2.3.101 R-L — outbound bundle manifest for one workflow run.
 *  Lists every operation_journal row produced by the run with its
 *  current state + target DHIS2 endpoint. */
export interface WorkflowRunManifest {
  runId: string;
  total: number;
  /** §2.3.102 R-N — when the client passes ?state=, these two show
   *  the applied filter + the row count after filtering. Counts
   *  above remain unfiltered so the chip strip still works. */
  filteredState: string | null;
  filteredTotal: number;
  countsByEntityType: Record<string, number>;
  countsByState: Record<string, number>;
  operations: Array<{
    operationId: string;
    entityType: 'AGGREGATE_DATA_VALUE' | 'EVENT' | 'TRACKED_ENTITY'
                 | 'ENROLLMENT' | 'PROGRAM_STAGE_EVENT';
    entityRef: string;
    state: LocalDataSyncState;
    attemptCount: number;
    lastError: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    endpoint: string | null;
  }>;
}

export function workflowRunManifest(
  runId: string,
  opts?: { state?: string | ReadonlyArray<string> },
): Promise<WorkflowRunManifest> {
  const s = opts?.state;
  const csv = Array.isArray(s) ? s.join(',') : (s as string | undefined);
  const q = csv ? `?state=${encodeURIComponent(csv)}` : '';
  return request('GET',
    `/edge-api/v1/workflows/runs/${encodeURIComponent(runId)}/manifest${q}`);
}

/** §2.3.102 R-Q — force-retry a single operation. Returns new state
 *  (PENDING) on success; throws if the op can't be retried. */
export function retryOperation(operationId: string):
    Promise<{ operationId: string; state: 'PENDING' }> {
  return request('POST',
    `/edge-api/v1/admin/ops/journal/${encodeURIComponent(operationId)}/retry`);
}

/** §2.3.116 R-AM — scope-drift audit snapshot. Counts of locally-
 *  stored rows whose org_unit_uid is outside the edge's bound
 *  subtree, bucketed by entity type. Returns empty snapshot when
 *  the edge is unbound. */
export interface ScopeAuditSnapshot {
  boundOrgUnitId: string | null;
  boundOrgUnitPath: string | null;
  total: number;
  countsByEntityType: Record<string, number>;
  samplesByEntityType: Record<string, Array<Record<string, unknown>>>;
}

export function scopeAudit(sampleLimit = 5): Promise<ScopeAuditSnapshot> {
  return request('GET',
    `/edge-api/v1/admin/ops/scope/audit?sampleLimit=${sampleLimit}`);
}

/** §2.3.119 R-AP — delete processed (CENTRAL_ACCEPTED /
 *  CENTRAL_REJECTED) operation_journal rows older than N days. Pass
 *  0 to purge every terminal row now. Returns the number of rows
 *  purged. */
export function purgeTerminalJournalRows(olderThanDays: number):
    Promise<{ rowsPurged: number; cutoff: string }> {
  return request('POST',
    `/edge-api/v1/admin/ops/journal/purge?olderThanDays=${olderThanDays}`);
}

/** §2.3.120 R-AQ — last successful JOURNAL_RETENTION_PURGE audit event
 *  so the queue header can render "last cleaned <ago> · <n> rows".
 *  observedAt is empty string when no purge has ever run. */
export function fetchLastJournalPurge():
    Promise<{ observedAt: string; rowsPurged: number; olderThanDays: number }> {
  return request('GET', '/edge-api/v1/admin/ops/journal/last-purge');
}

/** Phase 09.5 — ADR-0034 inbound-pull cursors. One row per
 *  (entity_type, org_unit_uid). lastPulledAt is null before the
 *  puller has ever advanced. */
export interface DataPullCursorRow {
  entityType: 'AGGREGATE' | 'EVENT' | 'TRACKER';
  orgUnitUid: string;
  lastPulledAt: string | null;
  lastCursor: string | null;
  consecutiveFailures: number;
  lastError: string | null;
  updatedAt: string;
}
export function fetchDataPullCursors(): Promise<{ cursors: DataPullCursorRow[] }> {
  return request('GET', '/edge-api/v1/data/pull/cursors');
}

/** §2.3.105 R-Y — bulk force-retry a specific list of operation ids
 *  (used by the per-stream Retry button inside the TEI drawer). The
 *  server silently skips ids already in terminal/pending states;
 *  `rowsRequeued` reflects what actually moved. */
export function retryBatch(operationIds: ReadonlyArray<string>):
    Promise<{ requested: number; rowsRequeued: number }> {
  return request('POST',
    '/edge-api/v1/admin/ops/journal/retry-batch',
    { operationIds });
}

/** §2.3.103 R-T — bulk force-retry every retryable operation for one
 *  workflow run, optionally scoped to a comma-separated list of
 *  states. Returns the number of rows moved back to PENDING. */
export function retryRun(
  workflowRunId: string,
  states?: ReadonlyArray<string>,
): Promise<{ workflowRunId: string; rowsRequeued: number }> {
  const q = new URLSearchParams();
  q.set('workflowRunId', workflowRunId);
  if (states && states.length > 0) q.set('state', states.join(','));
  return request('POST',
    `/edge-api/v1/admin/ops/journal/retry-run?${q.toString()}`);
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
  /** §2.3.110 R-AE — present on ACCEPTED rows ingested on/after V081.
   *  Drives the "Workflows › View ingest run ↗" affordance in the
   *  Referral detail drawer. */
  ingestRunId?: string | null;
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

/** ADR-0032 — edge-user → DHIS2-user mapping. The server-side
 *  controller (UserAttributionController) is ADMIN-only and audits
 *  every mutation as USER_DHIS2_MAPPING_SET / USER_DHIS2_MAPPING_CLEARED. */
export type EdgeDhis2AuthType = 'TOKEN' | 'BASIC';

export interface EdgeUserDhis2Mapping {
  edgeUserId: string;
  dhis2UserUid: string;
  dhis2Username: string;
  dhis2DisplayName: string | null;
  mappedAt: string;
  mappedBy: string;
  lastVerifiedAt: string | null;
  /** Per-mapping override of the system default; null = inherit. */
  authType: EdgeDhis2AuthType | null;
  /** True iff an encrypted credential envelope is persisted for this user. */
  hasCredential: boolean;
  credentialSetAt: string | null;
}

export interface EdgeDhis2UserDetails {
  id: string | null;
  username: string | null;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  disabled: boolean;
  created: string | null;
  lastUpdated: string | null;
  lastLogin: string | null;
  twoFactorEnabled: boolean;
  organisationUnits: Array<{ id: string | null; displayName: string | null }>;
  userGroups: Array<{ id: string | null; displayName: string | null }>;
}

export function listUserDhis2Mappings(): Promise<EdgeUserDhis2Mapping[]> {
  return request<{ mappings: EdgeUserDhis2Mapping[] }>(
    'GET', '/edge-api/v1/admin/users/dhis2-mappings',
  ).then((r) => r.mappings ?? []);
}

export function setUserDhis2Mapping(
  edgeUserId: string,
  body: {
    dhis2UserUid: string;
    dhis2Username: string;
    dhis2DisplayName?: string | null;
    authType?: EdgeDhis2AuthType | null;
    credential?: string | null;
  },
): Promise<EdgeUserDhis2Mapping> {
  return request('PUT',
    `/edge-api/v1/admin/users/${encodeURIComponent(edgeUserId)}/dhis2-mapping`,
    body);
}

export function clearUserDhis2Mapping(
  edgeUserId: string,
): Promise<{ cleared: boolean }> {
  return request('DELETE',
    `/edge-api/v1/admin/users/${encodeURIComponent(edgeUserId)}/dhis2-mapping`);
}

export function getDhis2AuthTypeDefault(): Promise<{ defaultAuthType: EdgeDhis2AuthType }> {
  return request('GET', '/edge-api/v1/admin/users/dhis2-auth-type-default');
}

export function getDhis2UserDetails(uid: string): Promise<EdgeDhis2UserDetails> {
  return request('GET',
    `/edge-api/v1/admin/users/dhis2-user-details?uid=${encodeURIComponent(uid)}`);
}

/** DHIS2 Central user picker — proxies /api/users with match-anywhere
 *  query + a compact field selector.  Operators type into the mapping
 *  form's search box; results feed the typeahead dropdown. */
export interface EdgeDhis2UserCandidate {
  id: string | null;
  username: string | null;
  displayName: string | null;
  disabled: boolean;
}

export type EdgeDhis2CandidateScope = 'ou' | 'all';

export interface EdgeDhis2CandidateResponse {
  candidates: EdgeDhis2UserCandidate[];
  query: string;
  /** Scope actually applied by the server — may differ from the
   *  requested value when the edge is unbound (falls back to 'all'). */
  scope: EdgeDhis2CandidateScope;
  boundOrgUnitId?: string | null;
  boundOrgUnitDisplayName?: string | null;
}

export function searchDhis2UserCandidates(q: string,
    opts?: { pageSize?: number; scope?: EdgeDhis2CandidateScope }):
    Promise<EdgeDhis2CandidateResponse> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (opts?.pageSize) params.set('pageSize', String(opts.pageSize));
  if (opts?.scope) params.set('scope', opts.scope);
  const qs = params.toString();
  return request('GET',
    '/edge-api/v1/admin/users/dhis2-candidates'
    + (qs ? `?${qs}` : ''));
}

/** Dynamic role catalogue (V086 + RoleManagementController).  Admin-only. */
export interface EdgeRoleDefinition {
  roleId: string;
  name: string;
  description: string | null;
  builtin: boolean;
  builtinKey: string | null;
  authorities: string[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EdgeAuthorityEntry {
  authority: string;
  module: string;
  /** @deprecated Older server builds only emit `description`; new builds
   *  also emit `allows` + `restricts`.  Read `allows` first and fall
   *  back to `description` when the field isn't present. */
  description: string;
  allows?: string;
  restricts?: string;
}

export function listRoles(): Promise<EdgeRoleDefinition[]> {
  return request<{ roles: EdgeRoleDefinition[] }>(
    'GET', '/edge-api/v1/admin/roles',
  ).then((r) => r.roles ?? []);
}

export function listAuthorityCatalog(): Promise<EdgeAuthorityEntry[]> {
  return request<{ authorities: EdgeAuthorityEntry[] }>(
    'GET', '/edge-api/v1/admin/roles/authorities/catalog',
  ).then((r) => r.authorities ?? []);
}

export function createRole(
  body: { name: string; description?: string | null; authorities: string[] },
): Promise<EdgeRoleDefinition> {
  return request<EdgeRoleDefinition>(
    'POST', '/edge-api/v1/admin/roles', body);
}

export function updateRole(
  roleId: string,
  body: { name?: string | null; description?: string | null; authorities: string[] },
): Promise<EdgeRoleDefinition> {
  return request<EdgeRoleDefinition>(
    'PUT', `/edge-api/v1/admin/roles/${encodeURIComponent(roleId)}`, body);
}

export function deleteRole(roleId: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(
    'DELETE', `/edge-api/v1/admin/roles/${encodeURIComponent(roleId)}`);
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

/**
 * Legacy EA-31..34 placeholder — kept until EARemainderScreens is
 * retired. The real C-UI-5a catalogue lives at `listApps()` below with
 * the `AppCatalogueEntry` shape.
 */
export function listInstalledApps(): Promise<InstalledAppRow[]> {
  return request<InstalledAppRow[]>('GET', '/edge-api/v1/apps/installed');
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

/** FR-15-07 — backup verification + PITR status. The server-side
 *  BackupVerificationService + WalArchiveService shipped in an earlier
 *  alpha; these wrappers expose them on the admin UI. */
export interface BackupVerifyStatus {
  enabled: boolean;
  pgRestore: string | null;
  lastRun: {
    outcome: string;
    verifiedAt: string;
    durationMs: number;
  } | null;
}

export interface BackupVerifyRow {
  verificationId: string;
  backupRunId: number;
  verifiedAt: string;
  outcome: string;
  durationMs: number;
  shadowDbName: string | null;
  rowCounts: string | null;
  reason: string | null;
}

export interface WalSummary {
  walEnabled: boolean;
  walDirectory: string;
  walDirExists: boolean;
  segmentCount?: number;
  earliestArchive?: string | null;
  latestArchive?: string | null;
  totalBytes?: number;
}

export function backupVerifyStatus(): Promise<BackupVerifyStatus> {
  return request('GET', '/edge-api/v1/backup/pitr/verify/status');
}

export function backupVerifyHistory(limit = 25): Promise<BackupVerifyRow[]> {
  return request<{ history: BackupVerifyRow[] }>(
    'GET', `/edge-api/v1/backup/pitr/verify/history?limit=${limit}`,
  ).then((r) => r.history ?? []);
}

export function backupVerifyRun(backupId?: number): Promise<BackupVerifyRow> {
  const q = backupId != null ? `?backupId=${backupId}` : '';
  return request<BackupVerifyRow>(
    'POST', `/edge-api/v1/backup/pitr/verify/run${q}`,
  );
}

export function backupPitrWal(): Promise<WalSummary> {
  return request('GET', '/edge-api/v1/backup/pitr/wal');
}

/** NFR-28 — Clock-drift probe + report.
 *
 *  The server exposes its epoch-millis + time zone on GET, and accepts
 *  a drift report via POST. A drift > unsafeDriftMillis (60s) triggers
 *  a CLOCK_DRIFT_WARN audit event on the server. The UI polls on load
 *  and renders a global banner when the delta is unsafe. */
export interface ClockProbeResponse {
  serverTime: string;
  serverEpochMillis: number;
  serverTimeZone: string;
  systemTimeZone: string;
  unsafeDriftMillis: number;
  note: string;
}

export interface ClockReportResponse {
  driftMillis: number;
  unsafe: boolean;
  serverEpochMillis: number;
  unsafeDriftMillis: number;
}

export function clockProbe(): Promise<ClockProbeResponse> {
  return request('GET', '/edge-api/v1/admin/metrics/clock');
}

export function clockReport(body: {
  callerEpochMillis: number;
  callerTimeZone?: string;
}): Promise<ClockReportResponse> {
  return request('POST', '/edge-api/v1/admin/metrics/clock/report', body);
}

/** FR-01-10 — Decommissioning.
 *
 *  Terminal. Disables every other user, requests a final FULL backup
 *  (evidence export), and writes a DECOMMISSION audit event. The
 *  server requires body.confirm === "CONFIRMED" as a safety check.
 *  The acting ADMIN is intentionally NOT disabled so they can still
 *  finish the physical handover + download the final backup. */
export interface DecommissionResponse {
  disabledUsers: number;
  finalBackupRequested: boolean;
  actedBy: string;
}

export function decommissionEdge(): Promise<DecommissionResponse> {
  return request('POST', '/edge-api/v1/admin/ops/decommission',
                   { confirm: 'CONFIRMED' });
}

/** FR-01-07 — Site configuration (connectivity policies + limits
 *  + local URL + time-zone). Server endpoint is a single whitelist-
 *  guarded settings block; the GET always includes defaults so a
 *  fresh install's screen is never blank. */
export interface SiteConfigResponse {
  values: Record<string, string>;
  defaults: Record<string, string>;
  updatedBy: string | null;
  updatedAt: string | null;
}

export function readSiteConfig(): Promise<SiteConfigResponse> {
  return request('GET', '/edge-api/v1/site/config');
}

export function writeSiteConfig(
  values: Record<string, string>,
): Promise<SiteConfigResponse> {
  return request('POST', '/edge-api/v1/site/config', { values });
}

/** FR-15-06 — User scope viewer.
 *
 *  Richer shape than `/provisioning/users`: adds origin (LOCAL vs
 *  DHIS2), disabled flag, createdAt/updatedAt, and permissionAgeHours
 *  so ADMINs can spot permissions that haven't been refreshed from
 *  Central lately. */
export interface EdgeUserScopeRow {
  userId: string;
  username: string;
  displayName: string;
  roles: string[];
  origin: string;
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
  permissionAgeHours: number;
}

export function fetchUserScope(): Promise<{
  users: EdgeUserScopeRow[];
  generatedAt: string;
}> {
  return request('GET', '/edge-api/v1/admin/ops/users/scope');
}

/** FR-15-10 — Operational report: local-only vs. central-confirmed.
 *
 *  Driven by OperationsAdminController. The important guarantee is
 *  that `localOnly` never claims central authoritative acceptance —
 *  it's PENDING + RETRYABLE only. Operators see at a glance how
 *  much of the local state hasn't yet reached DHIS2 Central. */
export interface OperationalReport {
  generatedAt: string;
  byState: Record<string, number>;
  centralConfirmed: number;
  localOnly: number;
  note: string;
}

export function fetchOperationalReport(): Promise<OperationalReport> {
  return request('GET', '/edge-api/v1/admin/ops/reports/operational');
}

/** FR-15-08 — Operational configuration editor.
 *
 *  OperationsAdminController exposes a whitelist of mutable runtime
 *  keys (referral/analytics crons, backup flags, TLS requirement).
 *  Separate from /admin/settings which drives the generic
 *  cron + featureFlags payload. */
export interface OpsSettingsResponse {
  settings: Record<string, string>;
}

export function readOpsSettings(): Promise<OpsSettingsResponse> {
  return request('GET', '/edge-api/v1/admin/ops/settings');
}

export function writeOpsSetting(
  key: string, value: string,
): Promise<{ key: string; value: string }> {
  return request('POST', '/edge-api/v1/admin/ops/settings', { key, value });
}

export interface SecurityAuditEvent {
  eventType: string;
  actorUserId: string | null;
  subjectUserId: string | null;
  clientIp: string | null;
  userAgent: string | null;
  outcome: string;
  detail: string | null;
  observedAt: string;
}

export function securityAuditEvents(opts: {
  eventType?: string;
  actorUserId?: string;
  limit?: number;
} = {}): Promise<SecurityAuditEvent[]> {
  const q = new URLSearchParams();
  if (opts.eventType) q.set('eventType', opts.eventType);
  if (opts.actorUserId) q.set('actorUserId', opts.actorUserId);
  q.set('limit', String(opts.limit ?? 100));
  return request<{ events: SecurityAuditEvent[] }>(
    'GET', `/edge-api/v1/security/audit/events?${q.toString()}`,
  ).then((r) => r.events ?? []);
}

/** FR-15-09 — Support bundle: sanitised diagnostics zip.
 *
 *  The server returns application/zip (not JSON) so this bypasses the
 *  generic request() helper and streams the response as a Blob. Returns
 *  `{ blob, filename }` so the caller can drive a download via an
 *  object-URL link. Throws EdgeApiError on non-2xx responses so the UI
 *  can surface the failure consistently. */
export async function fetchSupportBundle(): Promise<{
  blob: Blob;
  filename: string;
}> {
  const response = await fetch('/edge-api/v1/admin/ops/support-bundle', {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/zip' },
  });
  if (response.status === 401) {
    throw new EdgeApiError(401, 'INVALID_CREDENTIALS', 'invalid credentials');
  }
  if (!response.ok) {
    throw new EdgeApiError(
      response.status, 'UNKNOWN',
      `support bundle export failed with status ${response.status}`,
    );
  }
  // Server sends Content-Disposition: attachment; filename="der-support-bundle-<ts>.zip"
  const disp = response.headers.get('Content-Disposition') ?? '';
  const match = disp.match(/filename="([^"]+)"/);
  const filename = match?.[1]
    ?? `der-support-bundle-${new Date().toISOString().replace(/:/g, '-')}.zip`;
  const blob = await response.blob();
  return { blob, filename };
}

export interface RestoreRow {
  runId: number;
  requestedAt: string;
  source: string;
  status: 'REQUESTED' | 'QUEUED' | 'SUCCESS' | 'FAILED';
  message?: string;
  /** LOCAL = restore from a known backup run; UPLOAD = restore from an
   *  uploaded archive; REMOTE = restore from an operator-supplied URI. */
  kind?: 'LOCAL' | 'UPLOAD' | 'REMOTE';
}

export type RestoreKind = 'LOCAL' | 'UPLOAD' | 'REMOTE';

export function listRestores(): Promise<RestoreRow[]> {
  return request<{ runs: RestoreRow[] }>('GET', '/edge-api/v1/restore/runs')
    .then((r) => r.runs ?? []);
}

/** EA-31: server requires kind + source. Older signature (source-only)
 *  silently 400'd; the three-way kind reflects the UI selector. */
export function requestRestore(kind: RestoreKind, source: string):
    Promise<RestoreRow> {
  return request<RestoreRow>('POST', '/edge-api/v1/restore/request',
    { kind, source });
}

/** EA-31: multipart upload for operator-supplied archive; returns an
 *  upload key the UI feeds back into requestRestore('UPLOAD', key). */
export function uploadRestoreArchive(file: File):
    Promise<{ uploadKey: string; size: number }> {
  const form = new FormData();
  form.append('archive', file);
  return fetch('/edge-api/v1/restore/upload', {
    method: 'POST', body: form, credentials: 'same-origin',
  }).then(async (r) => {
    if (!r.ok) throw new Error(`upload failed: HTTP ${r.status}`);
    return r.json() as Promise<{ uploadKey: string; size: number }>;
  });
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

/** Relationships diagnostics payload (spec §REL-S-015 / §REL-S-016,
 *  server slice D6 — commit a391ea9c). Admin-only read. */
export interface RelationshipDiagnostics {
  readonly asOf: string;
  readonly metadata: {
    readonly byClass: ReadonlyArray<{
      readonly relClass: string;
      readonly count: number;
    }>;
    readonly total: number;
    readonly withDirectionalNames: number;
  };
  readonly instances: {
    readonly byStatusAndClass: ReadonlyArray<{
      readonly syncStatus: string;
      readonly relClass: string;
      readonly count: number;
    }>;
    readonly live: number;
    readonly softDeleted: number;
  };
  readonly attention: ReadonlyArray<{
    readonly relationshipUid: string;
    readonly relationshipType: string;
    readonly fromEntityType: string;
    readonly fromEntityUid: string;
    readonly toEntityType: string;
    readonly toEntityUid: string;
    readonly syncStatus: string;
    readonly relClass: string;
    readonly createdAt: string | null;
    readonly updatedAt: string | null;
    readonly centralUid: string | null;
    readonly version: number;
  }>;
  readonly tombstones: ReadonlyArray<{
    readonly relationshipUid: string;
    readonly relationshipType: string;
    readonly fromEntityType: string;
    readonly fromEntityUid: string;
    readonly toEntityType: string;
    readonly toEntityUid: string;
    readonly syncStatus: string;
    readonly relClass: string;
    readonly deletedAt: string | null;
    readonly updatedAt: string | null;
    readonly centralUid: string | null;
    readonly version: number;
  }>;
}

export function relationshipDiagnostics(
    attentionLimit = 25): Promise<RelationshipDiagnostics> {
  const q = new URLSearchParams({
    attentionLimit: String(attentionLimit) }).toString();
  return request<RelationshipDiagnostics>('GET',
    '/edge-api/v1/admin/relationships/diagnostics?' + q);
}

export interface RelationshipAdminActionAck {
  readonly action: 'retry' | 'ack' | 'purge';
  readonly relationshipUid: string;
  readonly syncStatus?: string;
  readonly purgedRowCount?: number;
}

export function relationshipRetry(uid: string):
    Promise<RelationshipAdminActionAck> {
  return request<RelationshipAdminActionAck>('POST',
    '/edge-api/v1/admin/relationships/'
      + encodeURIComponent(uid) + '/retry');
}

export function relationshipAck(uid: string):
    Promise<RelationshipAdminActionAck> {
  return request<RelationshipAdminActionAck>('POST',
    '/edge-api/v1/admin/relationships/'
      + encodeURIComponent(uid) + '/ack');
}

export function relationshipPurge(uid: string):
    Promise<RelationshipAdminActionAck> {
  return request<RelationshipAdminActionAck>('POST',
    '/edge-api/v1/admin/relationships/'
      + encodeURIComponent(uid) + '/purge');
}

export interface RelationshipBulkResult {
  readonly total: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly results: ReadonlyArray<{
    readonly relationshipUid: string;
    readonly ok: boolean;
    readonly error?: string;
  }>;
}

export function relationshipBulkRetry(uids: ReadonlyArray<string>):
    Promise<RelationshipBulkResult> {
  return request<RelationshipBulkResult>('POST',
    '/edge-api/v1/admin/relationships/bulk/retry',
    { uids });
}

export function relationshipBulkAck(uids: ReadonlyArray<string>):
    Promise<RelationshipBulkResult> {
  return request<RelationshipBulkResult>('POST',
    '/edge-api/v1/admin/relationships/bulk/ack',
    { uids });
}

export function relationshipBulkPurge(uids: ReadonlyArray<string>):
    Promise<RelationshipBulkResult> {
  return request<RelationshipBulkResult>('POST',
    '/edge-api/v1/admin/relationships/bulk/purge',
    { uids });
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
/** V045..V047 — a step binds to a specific DHIS2 slice. */
export type SectionKind =
  | 'DATASET_SECTION'
  | 'PROGRAM_STAGE'
  | 'PROGRAM_STAGE_SECTION'
  | 'TEI_ATTRIBUTE_GROUP'
  | 'DATA_ELEMENT_GROUP'
  | 'COC_SPLIT'
  | 'ENROLLMENT_FORM'      /* V046 */
  | 'PROGRAM_SECTION'      /* V047 — DHIS2 v2.30+ ProgramSection */
  | 'TEI_TYPE_ATTRIBUTES'  /* V048 — TrackedEntityType cross-program profile */
  | 'ATTRIBUTE_OPTION_COMBO' /* V049 — funder/project split, cross-cutting */
  | 'ORG_UNIT_SCOPE'          /* V050 — sub-OU split, cross-cutting */
  | 'RELATIONSHIP'            /* V051 — tracker TEI relationships */
  | 'EVENT_INSTANCE'          /* V052 — specific event in repeating stage */
  | 'DATASET_ELEMENT'         /* V053 — specific aggregate DE row */
  | 'PERIOD_SCOPE'            /* V054 — period/time split for aggregate */
  | 'AD_HOC';

export interface CaptureWorkflowField {
  fieldRef: string;
  requirement: FieldRequirement;
  /** V066 — per-field handover override. Null → inherit from the
   *  parent step. */
  ownerRole?: OwnerRole | null;
  ownerDeviceId?: string | null;
}

export interface CaptureWorkflowStep {
  stepId?: string;
  ordinal: number;
  displayName: string;
  ownerRole: OwnerRole;
  ownerDeviceId?: string | null;
  stepKind: StepKind;
  fields: readonly CaptureWorkflowField[];
  /** V045 — section binding (defaults to AD_HOC server-side). */
  sectionKind?: SectionKind;
  sectionRef?: string | null;
}

export interface CaptureWorkflowDependency {
  stepId: string;
  dependsOnStepId: string;
  kind: 'COMPLETES_BEFORE';
}

export interface CaptureWorkflowSummary {
  workflowId: string;
  displayName: string;
  boundMetadataKind:
    | 'DATA_SET'
    | 'DATA_SET_SECTION'
    | 'DATA_ELEMENT'
    | 'PROGRAM'
    | 'PROGRAM_SECTION'
    | 'PROGRAM_STAGE'
    | 'PROGRAM_STAGE_SECTION'
    | 'TRACKED_ENTITY_TYPE'
    | 'TRACKED_ENTITY_ATTRIBUTE'
    | 'SYSTEM';
  boundMetadataId: string;
  enabled: boolean;
  version: number;
  createdAt?: string;
  updatedAt?: string;
  /** V045 — workflow-level approval gate before DHIS2 upload. */
  requiresApproval?: boolean;
  /** V045 — default assignee; steps may override via ownerDeviceId. */
  defaultDeviceId?: string | null;
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

/** Operator work queue (spec §51–§52). Every step across all active
 *  runs that is READY or BLOCKED and the caller is entitled to see. */
export interface WorkflowQueueRow {
  runId: string;
  workflowId: string;
  workflowName: string;
  businessKey: string;
  stepId: string;
  stepOrdinal: number;
  stepName: string;
  ownerRole: 'ADMIN' | 'OPERATOR' | 'REVIEWER';
  ownerDeviceId: string | null;
  readiness: 'READY' | 'BLOCKED';
  runCreatedAt: string;
  runUpdatedAt: string;
  /** Count of ERROR-severity validation issues on this run. */
  validationErrorCount: number;
}

/** §2.3.60 — admin-only aggregation of step-transition rows (V067). */
export interface WorkflowStepMetric {
  workflowId: string;
  workflowName: string | null;
  stepId: string;
  stepName: string | null;
  completedCount: number;
  turnaroundP50Ms: number | null;
  turnaroundP95Ms: number | null;
  turnaroundMaxMs: number | null;
}
export interface WorkflowDeviceMetric {
  deviceId: string;
  deviceName: string | null;
  completedCount: number;
  turnaroundP50Ms: number | null;
  turnaroundP95Ms: number | null;
}
export interface WorkflowMetricsResponse {
  windowHours: number;
  perStep: WorkflowStepMetric[];
  perDevice: WorkflowDeviceMetric[];
}

export function getWorkflowMetrics(windowHours = 24):
    Promise<WorkflowMetricsResponse> {
  return request<WorkflowMetricsResponse>('GET',
    `/edge-api/v1/workflows/metrics?windowHours=${windowHours}`);
}

/** §2.3.60 — prefetch coordination. The client-side `WorkflowPrefetch`
 *  helper opens an EventSource against this endpoint on boot and
 *  warms its local cache in response to each `prefetch` event. */
export interface PrefetchPendingRow {
  runId: string;
  stepId: string;
  notifiedAt: string;
}
export function listPrefetchPending(deviceId: string):
    Promise<{ deviceId: string; rows: PrefetchPendingRow[] }> {
  return request('GET',
    `/edge-api/v1/workflows/prefetch/pending?deviceId=${encodeURIComponent(deviceId)}`);
}
export function ackPrefetch(stepId: string, deviceId: string):
    Promise<{ acked: number }> {
  return request('POST',
    `/edge-api/v1/workflows/prefetch/${encodeURIComponent(stepId)}/acked`
    + `?deviceId=${encodeURIComponent(deviceId)}`);
}

/** §2.3.61 — admin troubleshooting feeds. */
export interface WorkflowActivityFeedRow {
  transitionId: number;
  workflowId: string;
  workflowName: string | null;
  runId: string;
  businessKey: string;
  stepId: string;
  stepName: string | null;
  fromState: 'BLOCKED' | 'READY' | 'IN_PROGRESS' | 'COMPLETE' | null;
  toState: 'BLOCKED' | 'READY' | 'IN_PROGRESS' | 'COMPLETE';
  transitionedAt: string;
  actorDeviceId: string | null;
  actorDeviceName: string | null;
}
export interface WorkflowBlockageRow {
  workflowId: string;
  workflowName: string | null;
  runId: string;
  businessKey: string;
  stepId: string;
  stepName: string | null;
  blockedSince: string;
  blockedBy: { stepId: string; stepName: string | null }[];
}
export interface WorkflowIssueRow {
  issueId: string;
  workflowId: string;
  workflowName: string | null;
  runId: string;
  businessKey: string;
  stepId: string | null;
  stepName: string | null;
  code: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  fieldRef: string | null;
  detectedAt: string;
}
export interface WorkflowConflictRow {
  conflictId: string;
  workflowId: string;
  workflowName: string | null;
  runId: string;
  businessKey: string;
  category: string;
  identityKey: string;
  detectedAt: string;
}
export interface WorkflowActivitySummary {
  completedLast24h: number;
  currentlyBlocked: number;
  openErrorIssues: number;
  openConflicts: number;
}

export function getWorkflowActivityFeed(limit = 50):
    Promise<{ rows: WorkflowActivityFeedRow[] }> {
  return request('GET',
    `/edge-api/v1/workflows/activity/feed?limit=${limit}`);
}
export function getWorkflowBlockages():
    Promise<{ rows: WorkflowBlockageRow[] }> {
  return request('GET', '/edge-api/v1/workflows/activity/blockages');
}
export function getWorkflowIssues(limit = 200):
    Promise<{ rows: WorkflowIssueRow[] }> {
  return request('GET',
    `/edge-api/v1/workflows/activity/issues?limit=${limit}`);
}
export function getWorkflowConflicts(limit = 200):
    Promise<{ rows: WorkflowConflictRow[] }> {
  return request('GET',
    `/edge-api/v1/workflows/activity/conflicts?limit=${limit}`);
}
export function getWorkflowActivitySummary():
    Promise<WorkflowActivitySummary> {
  return request('GET', '/edge-api/v1/workflows/activity/summary');
}

/** §2.3.62 — draft data captured so far in each in-flight run.
 *  One row per contribution with a trimmed payload preview. */
export interface WorkflowDraftRow {
  contributionId: string;
  workflowId: string;
  workflowName: string | null;
  runId: string;
  businessKey: string;
  stepId: string;
  stepName: string | null;
  submittedAt: string;
  submittedDeviceId: string | null;
  submittedDeviceName: string | null;
  fieldCount: number;
  preview: string;
}
export function getWorkflowDrafts(limit = 50):
    Promise<{ rows: WorkflowDraftRow[] }> {
  return request('GET',
    `/edge-api/v1/workflows/activity/drafts?limit=${limit}`);
}

/** §2.3.66 — admin-side single-run detail. */
export interface AdminRunDetail {
  run: {
    runId: string; workflowId: string; workflowName: string | null;
    workflowVersion: number;
    businessKey: string;
    state: 'OPEN' | 'AWAITING' | 'COMPLETED' | 'REJECTED';
    createdAt: string; updatedAt: string;
    createdBy: string | null;
  };
  steps: AdminRunStep[];
  issues: AdminRunIssue[];
  conflicts: AdminRunConflict[];
}
export interface AdminRunStep {
  stepId: string;
  stepName: string;
  ordinal: number;
  ownerRole: 'ADMIN' | 'OPERATOR' | 'REVIEWER';
  ownerDeviceId: string | null;
  ownerDeviceName: string | null;
  state: 'BLOCKED' | 'READY' | 'IN_PROGRESS' | 'COMPLETE';
  stateAt: string | null;
  contribution: {
    payload: string;
    submittedAt: string;
    submittedBy: string | null;
    submittedDeviceId: string | null;
    submittedDeviceName: string | null;
  } | null;
  blockedBy: { stepId: string; stepName: string | null }[];
}
export interface AdminRunIssue {
  issueId: string;
  stepId: string | null;
  stepName: string | null;
  code: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  fieldRef: string | null;
  detectedAt: string;
}
export interface AdminRunConflict {
  conflictId: string;
  category: string;
  identityKey: string;
  status: string;
  detectedAt: string;
}
export function getAdminRunDetail(runId: string): Promise<AdminRunDetail> {
  return request('GET',
    `/edge-api/v1/workflows/activity/runs/${encodeURIComponent(runId)}`);
}

export function workflowQueue(opts?: {
  deviceId?: string;
  allDevices?: boolean;
}): Promise<{
  rows: WorkflowQueueRow[];
  appliedDeviceId: string | null;
  deviceScopeSource: 'QUERY' | 'PREFERENCE' | 'NONE';
}> {
  const params = new URLSearchParams();
  if (opts?.deviceId) params.set('deviceId', opts.deviceId);
  if (opts?.allDevices) params.set('allDevices', 'true');
  const q = params.toString() ? '?' + params.toString() : '';
  return request<{
    rows: WorkflowQueueRow[];
    appliedDeviceId: string | null;
    deviceScopeSource: 'QUERY' | 'PREFERENCE' | 'NONE';
  }>('GET', '/edge-api/v1/workflows/queue' + q);
}

/** User preferences — generic KV. §2.3.31 uses it for the preferred
 *  device so the queue auto-scopes without a query param. */
export function readAllUserPrefs(): Promise<{ prefs: Record<string, string> }> {
  return request('GET', '/edge-api/v1/user-prefs');
}

export function writeUserPref(key: string, value: string): Promise<unknown> {
  return request('POST',
    `/edge-api/v1/user-prefs/${encodeURIComponent(key)}`,
    { value });
}

export function deleteUserPref(key: string): Promise<unknown> {
  return request('DELETE',
    `/edge-api/v1/user-prefs/${encodeURIComponent(key)}`);
}

export const PREF_PREFERRED_DEVICE = 'workflow.preferredDeviceId';

/** §62–§63 — peer-to-peer workflow exchange. */
export interface WorkflowPeer {
  peerId: string;
  displayName: string;
  baseUrl: string;
  addedAt: string;
  addedBy: string | null;
  lastPushAt: string | null;
  lastPushStatus: string | null;
  /** §2.3.35 — service account username (password never leaves server). */
  authUsername: string | null;
  /** §2.3.40 — true → push skips the receiver's inbox. */
  directImport?: boolean;
}

export function setWorkflowPeerTrust(peerId: string,
                                       directImport: boolean): Promise<unknown> {
  return request('POST',
    `/edge-api/v1/workflows/peers/${peerId}/trust`,
    { directImport });
}

export function listWorkflowPeers(): Promise<{ peers: WorkflowPeer[] }> {
  return request('GET', '/edge-api/v1/workflows/peers');
}

export function addWorkflowPeer(opts: {
  displayName: string;
  baseUrl: string;
  authUsername?: string;
  authPassword?: string;
}): Promise<WorkflowPeer> {
  return request('POST', '/edge-api/v1/workflows/peers', opts);
}

export function setWorkflowPeerCredentials(peerId: string,
                                             authUsername: string,
                                             authPassword: string): Promise<unknown> {
  return request('POST',
    `/edge-api/v1/workflows/peers/${peerId}/credentials`,
    { authUsername, authPassword });
}

export function deleteWorkflowPeer(peerId: string): Promise<unknown> {
  return request('DELETE', `/edge-api/v1/workflows/peers/${peerId}`);
}

export function pushWorkflowToPeer(peerId: string, workflowId: string):
    Promise<{ peerId: string; workflowId: string; status: string; peerBody?: string }> {
  return request('POST',
    `/edge-api/v1/workflows/peers/${peerId}/push/${workflowId}`);
}

/** §2.3.38 — receive-side import inbox. */
export interface ImportInboxEntry {
  importId: string;
  receivedAt: string;
  fromLabel: string | null;
  displayName: string;
  boundKind: string;
  boundId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
  acceptedWorkflowId: string | null;
}

export function listImportInbox(status?: 'PENDING' | 'ACCEPTED' | 'REJECTED'):
    Promise<{ entries: ImportInboxEntry[] }> {
  const q = status ? `?status=${status}` : '';
  return request('GET', '/edge-api/v1/workflows/import-inbox' + q);
}

export function acceptImport(importId: string): Promise<unknown> {
  return request('POST',
    `/edge-api/v1/workflows/import-inbox/${importId}/accept`);
}

export function rejectImport(importId: string, note?: string): Promise<unknown> {
  return request('POST',
    `/edge-api/v1/workflows/import-inbox/${importId}/reject`,
    { note: note ?? '' });
}

/** §2.3.39 — step-level diff vs. local candidate workflow. */
export interface ImportInboxDiff {
  importId: string;
  incoming: {
    displayName: string;
    boundKind: string;
    boundId: string;
    stepCount: number;
  };
  matchStrategy: 'NONE' | 'DISPLAY_NAME' | 'BINDING';
  local: { workflowId: string; displayName: string; stepCount: number } | null;
  summary: 'NO_CHANGES' | 'REPLACEMENT' | 'NEW_WORKFLOW';
  added?: Array<{ ordinal: number; displayName: string; stepKind: string;
                    fieldCount: number }>;
  removed?: Array<{ ordinal: number; displayName: string; stepKind: string }>;
  changed?: Array<{ ordinal: number;
                      local: { displayName: string; stepKind: string; fieldCount: number };
                      incoming: { displayName: string; stepKind: string; fieldCount: number } }>;
}

export function importInboxDiff(importId: string): Promise<ImportInboxDiff> {
  return request('GET',
    `/edge-api/v1/workflows/import-inbox/${importId}/diff`);
}

/** Progressive-validation issues on a run (spec §36). */
export interface ValidationIssue {
  issueId: string;
  runId: string;
  stepId: string | null;
  code: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  fieldRef: string | null;
  /** §2.3.37 — structured value for ASSIGN issues. */
  suggestedValue?: string | null;
}

export function runValidation(runId: string): Promise<{
  runId: string;
  errorCount: number;
  issues: ValidationIssue[];
}> {
  return request<{ runId: string; errorCount: number; issues: ValidationIssue[] }>(
    'GET', `/edge-api/v1/workflows/runs/${runId}/validation`);
}

/** §37–§42 metadata snapshot + workflow pinning. */
export interface MetadataSnapshot {
  snapshotId: number;
  importedFrom: string;
  importedBy: string | null;
  importedAt: string;
  counts: {
    organisationUnits: number; dataElements: number;
    dataSets: number; programs: number; trackedEntityTypes: number;
  };
  centralVersion: string | null;
  centralRevision: string | null;
  fingerprint: string | null;
  retiredAt: string | null;
  retiredBy: string | null;
  pinnedWorkflows: number;
  status: 'ACTIVE' | 'RETIRED';
}

export function listSnapshots(): Promise<{ snapshots: MetadataSnapshot[] }> {
  return request<{ snapshots: MetadataSnapshot[] }>('GET',
    '/edge-api/v1/metadata/snapshots');
}

export function retireSnapshot(snapshotId: number): Promise<unknown> {
  return request('POST',
    `/edge-api/v1/metadata/snapshots/${snapshotId}/retire`);
}

export function reinstateSnapshot(snapshotId: number): Promise<unknown> {
  return request('POST',
    `/edge-api/v1/metadata/snapshots/${snapshotId}/reinstate`);
}

export interface SnapshotDiffDelta {
  a: number; b: number; delta: number;
}

export interface SnapshotDiffCounters {
  a: MetadataSnapshot;
  b: MetadataSnapshot;
  deltas: Record<string, SnapshotDiffDelta>;
  liveTaggedCounts: { a: Record<string, number>; b: Record<string, number> };
}

export function snapshotCounterDiff(a: number, b: number): Promise<SnapshotDiffCounters> {
  return request<SnapshotDiffCounters>('GET',
    `/edge-api/v1/metadata/snapshots/${a}/diff/${b}`);
}

export interface SnapshotResourceDiff {
  a: number; b: number; resource: string;
  added:   { id: string; displayName: string | null }[];
  removed: { id: string; displayName: string | null }[];
  changed: { id: string; displayName: string | null }[];
}

export function snapshotResourceDiff(a: number, b: number,
                                       resource: string): Promise<SnapshotResourceDiff> {
  return request<SnapshotResourceDiff>('GET',
    `/edge-api/v1/metadata/snapshots/${a}/diff/${b}/${resource}`);
}

export function getWorkflowPin(workflowId: string): Promise<{
  workflowId: string; snapshotId: number | null;
}> {
  return request('GET',
    `/edge-api/v1/workflows/${workflowId}/pinned-snapshot`);
}

export function setWorkflowPin(workflowId: string,
                                 snapshotId: number | null): Promise<unknown> {
  return request('PUT',
    `/edge-api/v1/workflows/${workflowId}/pinned-snapshot`,
    { snapshotId });
}

// ---- der-1.3.0-alpha.3 Initiative 10 slice B (ADR-0024): import/export ----

export interface CanonicalWorkflow {
  schemaVersion: number;
  displayName: string;
  boundMetadataKind:
    | 'DATA_SET'
    | 'DATA_SET_SECTION'
    | 'DATA_ELEMENT'
    | 'PROGRAM'
    | 'PROGRAM_SECTION'
    | 'PROGRAM_STAGE'
    | 'PROGRAM_STAGE_SECTION'
    | 'TRACKED_ENTITY_TYPE'
    | 'TRACKED_ENTITY_ATTRIBUTE'
    | 'SYSTEM';
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
export type DeviceFormFactor = 'WORKSTATION' | 'LAPTOP' | 'TABLET' | 'MOBILE' | 'UNKNOWN';

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
  /** V043 — operator-editable. Null until renamed by an admin. */
  displayName?: string | null;
  /** V043 — operator-editable. Defaults to 'UNKNOWN'. */
  formFactor?: DeviceFormFactor;
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

/** V043 — rename + form-factor edit. */
export function updateDeviceProfile(
  id: string, body: { displayName?: string | null; formFactor?: DeviceFormFactor }
): Promise<EdgeDeviceRow> {
  return request<EdgeDeviceRow>('PATCH', `/edge-api/v1/devices/${id}/profile`, body);
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

/** C2 / EA-29: audit event timeline. */
export interface AuditEventRow {
  /** EA-29: stable opaque row id; needed for keyset cursor construction. */
  auditId: number;
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
  pageSize: number;
  events: AuditEventRow[];
  /** EA-29: opaque cursor to pass as the next page's cursor param, or
   *  null when the client has exhausted the result set. */
  nextCursor: string | null;
}

export interface AuditEventsQuery {
  /** Legacy single-type filter — kept for callers already in-tree
   *  (user-detail activity tab). EA-29 clients prefer eventTypes. */
  eventType?: string;
  /** EA-29: multiple event types are OR'd server-side. */
  eventTypes?: string[];
  actorUserId?: string;
  subjectUserId?: string;
  /** ISO-8601 instant; filters on observed_at >= from. */
  from?: string;
  /** ISO-8601 instant; filters on observed_at <= to. */
  to?: string;
  cursor?: string;
  pageSize?: number;
  /** Legacy alias of pageSize, kept so existing callers still work. */
  limit?: number;
}

function auditEventsQueryParams(opts: AuditEventsQuery): URLSearchParams {
  const q = new URLSearchParams();
  if (opts.eventType) q.append('eventType', opts.eventType);
  if (opts.eventTypes) {
    for (const t of opts.eventTypes) q.append('eventType', t);
  }
  if (opts.actorUserId) q.set('actorUserId', opts.actorUserId);
  if (opts.subjectUserId) q.set('subjectUserId', opts.subjectUserId);
  if (opts.from) q.set('from', opts.from);
  if (opts.to) q.set('to', opts.to);
  if (opts.cursor) q.set('cursor', opts.cursor);
  const size = opts.pageSize ?? opts.limit ?? 100;
  q.set('pageSize', String(size));
  return q;
}

export function listAuditEvents(opts: AuditEventsQuery = {}): Promise<AuditEventsResponse> {
  const q = auditEventsQueryParams(opts);
  return request<AuditEventsResponse>(
    'GET', `/edge-api/v1/security/audit/events?${q.toString()}`);
}

/** EA-29: URL for the CSV export endpoint. Browsers navigate to this
 *  directly (via window.location.assign) so the session cookie attaches
 *  and the file downloads via Content-Disposition. */
export function auditEventsCsvUrl(opts: Omit<AuditEventsQuery, 'cursor' | 'pageSize' | 'limit'> = {}): string {
  const q = auditEventsQueryParams(opts);
  q.delete('pageSize');
  q.delete('cursor');
  return `/edge-api/v1/security/audit/events/export.csv?${q.toString()}`;
}

/** EA-27: derived authorities a user holds via their role grants. */
export function getUserEffectiveAuthorities(userId: string):
    Promise<{ userId: string; authorities: string[] }> {
  return request('GET',
    `/edge-api/v1/provisioning/users/${encodeURIComponent(userId)}/effective-authorities`);
}

/** EA-27: nuke every active DER_SESSION for the user. Password is left intact. */
export function revokeUserSessions(userId: string):
    Promise<{ userId: string; revokedCount: number }> {
  return request('POST',
    `/edge-api/v1/provisioning/users/${encodeURIComponent(userId)}/revoke-sessions`);
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
/** Hard-delete a device from the network_client table.
 *  Called from /network/clients + /network/mesh when an operator
 *  decommissions a device (seed/test rows, a replaced tablet,
 *  etc.). Both screens re-poll after a 204 and the device
 *  disappears from the topology. */
export function networkDeviceDelete(deviceId: string): Promise<{ deleted: boolean }> {
  return request('DELETE', `/edge-api/v1/network/clients/${encodeURIComponent(deviceId)}`);
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

/* ─── DER-MSG v2 — SSE, E2E keys, CRDT docs, edge forwards ──── */
export interface MessagingStreamStats {
  liveDevices: number;
  liveStreams: number;
}
export function messagingStreamStats(): Promise<MessagingStreamStats> {
  return request('GET', '/edge-api/v1/messaging/stream/stats');
}

export interface DeviceCryptoKey {
  deviceId: string;
  x25519PublicKeyBase64: string;
  ed25519PublicKeyBase64: string | null;
  updatedAt: string;
}
export function messagingKeysRegister(body: {
  deviceId: string; x25519PublicKeyBase64: string;
  ed25519PublicKeyBase64?: string;
}): Promise<{ registered: boolean }> {
  return request('POST', '/edge-api/v1/messaging/keys', body);
}
export function messagingKeys(): Promise<{ keys: DeviceCryptoKey[] }> {
  return request('GET', '/edge-api/v1/messaging/keys');
}
export function messagingKeyFor(deviceId: string): Promise<DeviceCryptoKey> {
  return request('GET', `/edge-api/v1/messaging/keys/${encodeURIComponent(deviceId)}`);
}

export interface CrdtDocument {
  docId: string;
  docType: string;
  createdBy: string;
  description: string | null;
  createdAt: string;
  lastOpAt: string | null;
  opCount: number;
}
export function messagingDocuments(): Promise<{ documents: CrdtDocument[] }> {
  return request('GET', '/edge-api/v1/messaging/documents');
}

export interface EdgeForward {
  forwardId: string;
  messageId: string;
  targetEdgeId: string;
  targetPeerId: string | null;
  outcome: string;
  httpStatus: number | null;
  attemptedAt: string;
  reason: string | null;
}
export function messagingForwards(limit = 50): Promise<{ forwards: EdgeForward[] }> {
  return request('GET', `/edge-api/v1/messaging/forwards?limit=${limit}`);
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

/* ─────────── Signin appearance (ADR-0037 C-UI-3d) ─────────── */

export type SignInLayoutKind = 'standard' | 'sidebar' | 'hero' | 'marketing';

export interface SignInSettings {
  layout: SignInLayoutKind | null;
  appTitle: string | null;
  appIntro: string | null;
  submitLabel: string | null;
  footerHtml: string | null;
  hasBackground: boolean;
  backgroundUrl: string | null;
  backgroundEtag: string | null;
}

export function readSignInSettings(): Promise<SignInSettings> {
  return request('GET', '/edge-api/v1/public/signin-settings');
}

export function updateSignInSettings(body: {
  layout: SignInLayoutKind | null;
  appTitle: string | null;
  appIntro: string | null;
  submitLabel: string | null;
  footerHtml: string | null;
}): Promise<SignInSettings> {
  return request('PUT', '/edge-api/v1/admin/signin-settings', body);
}

/** Multipart upload — not covered by the JSON `request` helper. */
export async function uploadSignInBackground(file: File): Promise<SignInSettings> {
  const form = new FormData();
  form.append('file', file);
  const r = await fetch('/edge-api/v1/admin/signin-settings/background', {
    method: 'POST', credentials: 'include', body: form,
  });
  if (!r.ok) {
    throw new EdgeApiError(r.status, 'UNKNOWN',
      `Upload failed with status ${r.status}`);
  }
  return r.json() as Promise<SignInSettings>;
}

export function clearSignInBackground(): Promise<SignInSettings> {
  return request('DELETE', '/edge-api/v1/admin/signin-settings/background');
}

/* ─────────── App catalogue (ADR-0037 C-UI-5a) ─────────── */

export interface AppCatalogueEntry {
  appId: string;
  appKey: string;
  displayName: string;
  module: string | null;
  version: string;
  bundleUrl: string;
  bundleSha256: string;
  signatureB64: string;
  requiresDerApi: string;
}

export interface AppCatalogueResponse {
  apps: AppCatalogueEntry[];
}

export function listApps(): Promise<AppCatalogueResponse> {
  return request<AppCatalogueResponse>('GET', '/edge-api/v1/apps');
}

/** Multipart install — not covered by the JSON `request` helper. */
export async function installApp(form: {
  file: File;
  appKey: string;
  displayName: string;
  module?: string | null;
  version: string;
  requiresDerApi: string;
  iconSvg?: string | null;
}): Promise<AppCatalogueEntry> {
  const body = new FormData();
  body.append('file', form.file);
  body.append('appKey', form.appKey);
  body.append('displayName', form.displayName);
  if (form.module != null && form.module !== '') body.append('module', form.module);
  body.append('version', form.version);
  body.append('requiresDerApi', form.requiresDerApi);
  if (form.iconSvg != null && form.iconSvg !== '') body.append('iconSvg', form.iconSvg);
  const r = await fetch('/edge-api/v1/admin/apps/install', {
    method: 'POST', credentials: 'include', body,
  });
  if (!r.ok) {
    throw new EdgeApiError(r.status, 'UNKNOWN',
      `Install failed with status ${r.status}`);
  }
  return r.json() as Promise<AppCatalogueEntry>;
}

/** Multipart upgrade — not covered by the JSON `request` helper. */
export async function upgradeApp(appId: string, form: {
  file: File;
  version: string;
  requiresDerApi: string;
}): Promise<AppCatalogueEntry> {
  const body = new FormData();
  body.append('file', form.file);
  body.append('version', form.version);
  body.append('requiresDerApi', form.requiresDerApi);
  const r = await fetch(`/edge-api/v1/admin/apps/${encodeURIComponent(appId)}/upgrade`, {
    method: 'POST', credentials: 'include', body,
  });
  if (!r.ok) {
    throw new EdgeApiError(r.status, 'UNKNOWN',
      `Upgrade failed with status ${r.status}`);
  }
  return r.json() as Promise<AppCatalogueEntry>;
}

export function enableApp(appId: string): Promise<void> {
  return request<void>('POST', `/edge-api/v1/admin/apps/${encodeURIComponent(appId)}/enable`);
}

export function disableApp(appId: string): Promise<void> {
  return request<void>('POST', `/edge-api/v1/admin/apps/${encodeURIComponent(appId)}/disable`);
}

export function deleteApp(appId: string): Promise<void> {
  return request<void>('DELETE', `/edge-api/v1/admin/apps/${encodeURIComponent(appId)}`);
}
