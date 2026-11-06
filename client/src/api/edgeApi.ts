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
 * ADR-0023 D-DOE-5. Reads the installation UUID from localStorage so
 * every write carries X-DER-Device-Id. Returns null when no device is
 * enrolled yet or localStorage is unavailable (private-mode / tests).
 */
function readDeviceHeader(): string | null {
  try {
    return window.localStorage.getItem('der_device_id');
  } catch {
    return null;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    const headers: Record<string, string> = body == null
      ? { Accept: 'application/json' }
      : { Accept: 'application/json', 'Content-Type': 'application/json' };
    const device = readDeviceHeader();
    if (device) {
      headers['X-DER-Device-Id'] = device;
    }
    response = await fetch(path, {
      method,
      credentials: 'include',
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    throw new EdgeApiError(0, 'EDGE_UNREACHABLE', `edge unreachable: ${String(err)}`);
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

/** Minimal shape of a DHIS2 data-set payload served by the mirror at
 *  /api/dataSets/{uid}. The client reads the periodType so it can
 *  generate the appropriate period picker without the operator having
 *  to type a DHIS2 period id by hand. */
export interface DataSetMeta {
  id: string;
  displayName?: string;
  name?: string;
  periodType?: string;
  formType?: 'CUSTOM' | 'SECTION' | 'DEFAULT' | string;
  dataEntryForm?: {
    id: string;
    name?: string;
    /** The actual DHIS2 custom-form HTML. May be absent on
     *  SECTION / DEFAULT datasets or when the mirror didn't sync
     *  the field (field-mask default on /api/dataSets omits
     *  `htmlCode`; the C-UI-5f slice-2 client fetches it
     *  explicitly via `?fields=…dataEntryForm[id,name,htmlCode]`
     *  when it needs to render). */
    htmlCode?: string;
  } | null;
}

export function getDataSetMeta(dataSetUid: string): Promise<DataSetMeta> {
  return request<DataSetMeta>('GET',
    `/api/dataSets/${encodeURIComponent(dataSetUid)}`);
}

/**
 * Fetch the full dataset metadata expansion needed to populate
 * DHIS2's `dhis2.de.*` globals before loading a custom form.
 * Calls DER's /api/dataSets/{uid} with a nested `fields=` mask so
 * data elements, option sets, categoryCombos, indicators all come
 * back in one round-trip. Returns the raw payload — the caller
 * reshapes into the shape form.js + entry.js expect.
 */
export function getDataSetFormMetadata(dataSetUid: string): Promise<unknown> {
  const fields = [
    'id,name,displayName,periodType,formType,version',
    'categoryCombo[id,name,categories[id,name,categoryOptions[id,name]]'
      + ',categoryOptionCombos[id,name]]',
    'dataSetElements[dataElement[id,name,formName,valueType,optionSet'
      + '[id,name,options[id,code,name,displayName]],categoryCombo'
      + '[id,name,categoryOptionCombos[id,name]]]]',
    'indicators[id,name,numerator,denominator,indicatorType[id,factor]]',
    'compulsoryDataElementOperands[dimensionItem]',
    'dataEntryForm[id,name]',
  ].join(',');
  const q = new URLSearchParams({ fields }).toString();
  return request('GET',
    `/api/dataSets/${encodeURIComponent(dataSetUid)}?${q}`);
}

/**
 * Fetch `dataEntryForm.htmlCode` separately — DHIS2 doesn't include
 * it in the default `/api/dataSets/{uid}` response, and even when
 * the mirror has it, the column is heavy. The C-UI-5f client only
 * calls this when the operator opts into the custom-form view.
 */
export function getDataEntryFormHtml(formUid: string): Promise<{
  id: string; htmlCode?: string;
}> {
  return request('GET',
    `/api/dataEntryForms/${encodeURIComponent(formUid)}`);
}

/** ADR-0015 — the single orgUnit the edge is bound to. The device
 *  client defaults every capture-related orgUnit field to this value
 *  and refuses to submit against any other OU. */
export interface OrgUnitBinding {
  bound: boolean;
  orgUnitId: string | null;
  orgUnitDisplayName: string | null;
  orgUnitPath: string | null;
  boundAt: string | null;
  boundBy: string | null;
}

export function getOrgUnitBinding(): Promise<OrgUnitBinding> {
  return request<OrgUnitBinding>('GET', '/edge-api/v1/system/org-unit');
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

/* ───── Module status (Server Modules alignment) ────────────────────
 *
 * DHIS2 / Synchronisation / Network status endpoints that the device
 * client's Launcher surfaces as operator-facing status tiles. Each
 * endpoint is operator-readable on the server (ADR-0005 SecurityConfig +
 * AuthorityCatalog). Admin-only mutators (ap/start, journal/pause,
 * jobs/trigger, …) stay in admin-ui.
 */

export interface Dhis2PingSnapshot {
  reachable: boolean;
  observedVersion: string | null;
  latencyMs: number;
  probedAt: string;
  message: string | null;
}

export function dhis2Ping(): Promise<Dhis2PingSnapshot> {
  return request<Dhis2PingSnapshot>('GET', '/edge-api/v1/dhis2/ping');
}

export interface CompatSnapshot {
  status: string;
  observedVersion: string | null;
  pinnedVersion: string | null;
  revision: string | null;
  buildTime: string | null;
  message: string | null;
}

export function dhis2Compat(): Promise<CompatSnapshot> {
  return request<CompatSnapshot>('GET', '/edge-api/v1/dhis2/compatibility');
}

export interface SyncJobRun {
  runId: number | null;
  jobName: string;
  startedAt: string;
  finishedAt: string | null;
  outcome: 'STARTED' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  durationMs: number | null;
  detail: string | null;
  triggeredBy: string;
}

export function listSyncJobs(limit = 20): Promise<SyncJobRun[]> {
  return request<SyncJobRun[]>(
    'GET', `/edge-api/v1/sync/jobs?limit=${encodeURIComponent(String(limit))}`);
}

export interface DriftSnapshot {
  status?: string;
  message?: string;
  driftId?: number;
  capturedAt?: string;
  snapshotFrom?: number;
  snapshotTo?: number;
  fingerprintFrom?: string;
  fingerprintTo?: string;
  deltasJson?: string;
  triggeredBy?: string;
}

export function latestDrift(): Promise<DriftSnapshot> {
  return request<DriftSnapshot>('GET', '/edge-api/v1/sync/drift');
}

export interface JournalWorkerHealth {
  enabled: boolean;
  lastTick: string | null;
  lastBatchSize: number;
  backlog: Record<string, number>;
}

export function journalWorkerHealth(): Promise<JournalWorkerHealth> {
  return request<JournalWorkerHealth>('GET', '/edge-api/v1/journal/worker');
}

export interface NetworkStatus {
  [k: string]: unknown;
}

export function networkStatus(): Promise<NetworkStatus> {
  return request<NetworkStatus>('GET', '/edge-api/v1/network/status');
}

export interface NetworkInterface {
  name: string;
  state?: string;
  purpose?: string;
  priority?: number | null;
  ipv4?: string | null;
  ipv6?: string | null;
  mac?: string | null;
  [k: string]: unknown;
}

export function listNetworkInterfaces(): Promise<{ interfaces: NetworkInterface[] }> {
  return request('GET', '/edge-api/v1/network/interfaces');
}

export interface AccessPointStatus {
  [k: string]: unknown;
}

export function networkAccessPoint(): Promise<AccessPointStatus> {
  return request('GET', '/edge-api/v1/network/access-point');
}

export interface EnrolQr {
  [k: string]: unknown;
}

export function networkEnrolQr(): Promise<EnrolQr> {
  return request('GET', '/edge-api/v1/network/ap/qr');
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

export function metadataList(resource: string): Promise<MetadataListResponse> {
  return request<MetadataListResponse>('GET', `/api/${resource}?fields=id,displayName&paging=false`);
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

/**
 * DHIS2 dataValueSets envelope. DER requires an envelope-level
 * `dataSet` (DataValueSetsController §2.3.84) — the server rejects
 * payloads without it as 400 BAD_REQUEST. `orgUnit` and `period` may
 * be set on the envelope so per-row fields can inherit them.
 */
export interface AggregateSubmitInput {
  dataSet: string;
  orgUnit?: string;
  period?: string;
  categoryOptionCombo?: string;
  attributeOptionCombo?: string;
  dataValues: readonly {
    dataElement: string;
    orgUnit?: string;
    period?: string;
    categoryOptionCombo?: string;
    attributeOptionCombo?: string;
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

export async function submitAggregate(body: AggregateSubmitInput): Promise<ImportSummary> {
  // §2.3.129 — offline-first capture. When the browser reports
  // offline, enqueue the payload in IndexedDB and return a synthetic
  // "queued locally" ImportSummary so the UI can show a Queued-offline
  // state. A reconnect-replay loop drains the queue when online.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const { enqueue } = await import('../offline/queue');
    const id = await enqueue({
      kind: 'aggregate',
      url: '/api/dataValueSets',
      body,
    });
    return {
      status: 'OFFLINE_QUEUED',
      derServerDate: new Date().toISOString(),
      importCount: { imported: 0, updated: 0, ignored: 0, deleted: 0 },
      conflicts: [],
      // Queue id as a hint so callers can show it; harmless if unused.
      offlineQueueId: id,
    } as ImportSummary & { offlineQueueId: number };
  }
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

export interface EventSubmitInput {
  readonly program: string;
  readonly programStage?: string;
  readonly orgUnit: string;
  readonly occurredAt?: string;
  readonly eventDate?: string;
  readonly dataValues?: ReadonlyArray<{ dataElement: string; value: string }>;
  readonly enrollment?: string;
}

/** POST /api/events — DER accepts the DHIS2-shaped envelope and
 *  stores events locally with the same offline-queue semantics as
 *  aggregate submissions. */
export function submitEvent(body: EventSubmitInput): Promise<unknown> {
  return request('POST', '/api/events', body);
}

export function listTrackerEvents(program: string, orgUnit: string, pageSize = 100):
    Promise<{ instances: EventRow[]; total: number }> {
  const q = new URLSearchParams({ program, orgUnit, pageSize: String(pageSize) }).toString();
  return request('GET', `/api/tracker/events?${q}`);
}

/** Minimal tracked-entity shape returned by the DHIS2 tracker proxy. The
 *  C-UI-5c slice-5 capture-tracker app renders a small list; later
 *  slices will enrich the shape with program-status, enrollments, etc. */
export interface TrackedEntityRow {
  readonly trackedEntity?: string;
  readonly trackedEntityInstance?: string;
  readonly displayName?: string;
  readonly lastUpdated?: string;
  readonly orgUnit?: string;
}

/** List tracked entities for a program + bound OU. Thin wrapper around
 *  the DHIS2 /api/tracker/trackedEntities read endpoint. Slice-5 of
 *  C-UI-5c — the capture-tracker app consumes this via the SDK. */
export function listTrackerEntities(program: string, orgUnit: string, pageSize = 50):
    Promise<{ instances?: TrackedEntityRow[]; trackedEntities?: TrackedEntityRow[]; total?: number }> {
  const q = new URLSearchParams({
    program, orgUnit, pageSize: String(pageSize),
  }).toString();
  return request('GET', `/api/tracker/trackedEntities?${q}`);
}

/** Enrol a single TEI into a program via POST /api/tracker. Minimal
 *  single-attribute shape used by the capture-tracker slice-5 app.
 *  Full enrolment (multi-attribute, program-rules) lives in the shell
 *  EnrollmentCreate screen and migrates in later slices. */
export interface TrackerEnrolInput {
  readonly program: string;
  readonly orgUnit: string;
  readonly trackedEntityType: string;
  readonly enrolledAt?: string;
  readonly attributes: ReadonlyArray<{ attribute: string; value: string }>;
}

export function enrolTei(input: TrackerEnrolInput): Promise<unknown> {
  const enrolledAt = input.enrolledAt ?? new Date().toISOString().slice(0, 10);
  const body = {
    trackedEntities: [{
      trackedEntityType: input.trackedEntityType,
      orgUnit: input.orgUnit,
      attributes: input.attributes,
      enrollments: [{
        program: input.program,
        orgUnit: input.orgUnit,
        enrolledAt,
        status: 'ACTIVE',
        attributes: input.attributes,
      }],
    }],
  };
  return request('POST', '/api/tracker', body);
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

// ---- der-1.2.0-alpha.3 Initiative 1 client half (ADR-0019) ----

export type DeviceStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REVOKED';

export interface EnrolledDevice {
  deviceId: string;
  assignedUserId: string | null;
  enrolledAt: string;
  lastSeenAt: string | null;
  userAgent: string | null;
  status: DeviceStatus;
  /** One-shot token; only returned on the enrol response. */
  enrolmentToken?: string;
}

export function enrollDevice(deviceId: string, userAgent: string): Promise<EnrolledDevice> {
  return request<EnrolledDevice>('POST', '/edge-api/v1/devices/enroll',
    { deviceId, userAgent });
}

export function heartbeatDevice(deviceId: string): Promise<{ outcome: string }> {
  return request('POST', `/edge-api/v1/devices/${deviceId}/heartbeat`);
}

export function fetchDevice(deviceId: string): Promise<EnrolledDevice> {
  return request<EnrolledDevice>('GET', `/edge-api/v1/devices/${deviceId}`);
}

/** §2.3.30 — progressive-validation issues attached to a workflow run. */
export interface ValidationIssue {
  issueId: string;
  runId: string;
  stepId: string | null;
  code: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  fieldRef: string | null;
  /** §2.3.37 — structured value for ASSIGN issues. Falls back to the
   *  message-text parser in older clients. */
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

// ────────────────────────────────────────────────────────────────────
// ADR-0036 — Capture form API bridge
//
// All /edge-api/v1/capture/* responses are DER-native shapes projected
// server-side from the metadata mirror.  The projection already
// normalises across the DHIS2 versions DER supports (ADR-0002 /
// ADR-0006 — currently 2.41 floor through 2.44 head), so the client
// consumes a stable envelope regardless of which upstream DHIS2
// version seeded the mirror.  Writes still flow through the ADR-0004
// /api/* emulator path and use the same version-aware shape.
// ────────────────────────────────────────────────────────────────────

/** D-CAP-3 envelope — projected form for a workflow run's current
 *  step, or a free-standing dataSet / programStage form. */
export interface CaptureFormAssembly {
  formType: 'AGGREGATE' | 'EVENT_STAGE' | 'TRACKER_STAGE';
  bindingKind: 'DATA_SET' | 'DATA_SET_SECTION' | 'DATA_ELEMENT' | 'PROGRAM'
    | 'PROGRAM_SECTION' | 'PROGRAM_STAGE' | 'PROGRAM_STAGE_SECTION'
    | 'TRACKED_ENTITY_TYPE' | 'TRACKED_ENTITY_ATTRIBUTE' | 'SYSTEM';
  bindingUid: string;
  displayName: string;
  ownership: {
    ownerRole: string | null;
    ownerDeviceId: string | null;
    isMyStep: boolean;
  };
  sections: CaptureFormSection[];
  upstreamContext: CaptureFormUpstreamContext[];
}

export interface CaptureFormSection {
  sectionUid: string | null;
  displayName: string;
  fields: CaptureFormField[];
}

export interface CaptureFormField {
  fieldRef: string;
  dataElementUid: string;
  categoryOptionComboUid: string | null;
  dataElementDisplayName: string;
  categoryOptionComboDisplayName: string | null;
  valueType: string;
  optionSetUid: string | null;
  requirement: 'REQUIRED' | 'OPTIONAL' | 'READONLY';
}

export interface CaptureFormUpstreamContext {
  stepId: string;
  stepDisplayName: string;
  fields: CaptureFormField[];
}

export interface CaptureFormDataPrefill {
  cells: Record<string, string>;
  lastUpdatedAt: string | null;
}

export interface CaptureRunSummary {
  runId: string;
  workflowId: string;
  workflowVersion: number;
  businessKey: string;
  currentStepId: string | null;
  state: 'OPEN' | 'AWAITING' | 'COMPLETED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
}

export interface CaptureAdvanceResponse extends CaptureRunSummary {
  completedByThisCall: boolean;
}

/** D-CAP-8 error codes — surface for UI error handling. */
export type CaptureErrorCode =
  | 'CAPTURE_PARAM_INVALID'
  | 'WORKFLOW_RUN_NOT_FOUND'
  | 'WORKFLOW_RUN_BLOCKED'
  | 'WORKFLOW_RUN_NOT_OWNED'
  | 'DEVICE_HEADER_REQUIRED'
  | 'METADATA_NOT_READY';

export class CaptureFormError extends Error {
  readonly code: CaptureErrorCode;
  readonly status: number;
  readonly blockedOnStepIds?: string[];
  constructor(status: number, code: CaptureErrorCode, message: string,
              blockedOnStepIds?: string[]) {
    super(message);
    this.name = 'CaptureFormError';
    this.code = code;
    this.status = status;
    this.blockedOnStepIds = blockedOnStepIds;
  }
}

async function captureRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    const headers: Record<string, string> = body == null
      ? { Accept: 'application/json' }
      : { Accept: 'application/json', 'Content-Type': 'application/json' };
    const device = readDeviceHeader();
    if (device) headers['X-DER-Device-Id'] = device;
    response = await fetch(path, {
      method,
      credentials: 'include',
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    throw new EdgeApiError(0, 'EDGE_UNREACHABLE', `edge unreachable: ${String(err)}`);
  }
  if (response.status === 204) return undefined as T;
  if (response.ok) {
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
  /* Translate D-CAP-8 error envelopes into CaptureFormError so the UI can
   * switch on `.code`. Any body we can't parse as D-CAP-8 falls back to a
   * plain EdgeApiError. */
  const errBody = await response.text();
  try {
    const parsed = JSON.parse(errBody) as {
      code?: string; message?: string; blockedOnStepIds?: string[];
    };
    if (parsed && typeof parsed.code === 'string') {
      throw new CaptureFormError(
        response.status,
        parsed.code as CaptureErrorCode,
        parsed.message ?? parsed.code,
        parsed.blockedOnStepIds,
      );
    }
  } catch (ex) {
    if (ex instanceof CaptureFormError) throw ex;
    // not JSON — fall through to generic
  }
  throw new EdgeApiError(
    response.status,
    response.status >= 500 ? 'EDGE_UNREACHABLE' : 'UNKNOWN',
    `unexpected status ${response.status}`,
  );
}

/* ───── capture workflow listing (for picker) ────────────────────── */

export interface CaptureWorkflowSummary {
  workflowId: string;
  displayName: string;
  boundMetadataKind: string;
  boundMetadataId: string | null;
  enabled: boolean;
  version: number;
}

export function listCaptureWorkflows():
    Promise<{ workflows: CaptureWorkflowSummary[] }> {
  return request('GET', '/edge-api/v1/workflows');
}

/* ───── run-scoped (ADR-0036 D-CAP-2) ────────────────────────────── */

export function listCaptureRuns(opts: {
  workflowId: string;
  state?: CaptureRunSummary['state'];
}): Promise<{ count: number; runs: CaptureRunSummary[] }> {
  const q = new URLSearchParams();
  q.set('workflowId', opts.workflowId);
  if (opts.state) q.set('state', opts.state);
  return captureRequest('GET',
    `/edge-api/v1/capture/runs?${q.toString()}`);
}

export function startCaptureRun(workflowId: string, businessKey: string):
    Promise<CaptureRunSummary> {
  return captureRequest('POST', '/edge-api/v1/capture/runs',
    { workflowId, businessKey });
}

export function getCaptureRun(runId: string): Promise<CaptureRunSummary> {
  return captureRequest('GET',
    `/edge-api/v1/capture/runs/${encodeURIComponent(runId)}`);
}

export function getCaptureRunForm(runId: string): Promise<CaptureFormAssembly> {
  return captureRequest('GET',
    `/edge-api/v1/capture/runs/${encodeURIComponent(runId)}/form`);
}

export function getCaptureRunData(runId: string): Promise<CaptureFormDataPrefill> {
  return captureRequest('GET',
    `/edge-api/v1/capture/runs/${encodeURIComponent(runId)}/data`);
}

export function advanceCaptureRun(runId: string): Promise<CaptureAdvanceResponse> {
  return captureRequest('POST',
    `/edge-api/v1/capture/runs/${encodeURIComponent(runId)}/advance`);
}

/* ───── free-standing aggregate (D-CAP-4) ────────────────────────── */

export function getCaptureDataSetForm(dataSetUid: string):
    Promise<CaptureFormAssembly> {
  return captureRequest('GET',
    `/edge-api/v1/capture/datasets/${encodeURIComponent(dataSetUid)}/form`);
}

export function getCaptureDataSetData(dataSetUid: string,
                                        orgUnit: string,
                                        period: string):
    Promise<CaptureFormDataPrefill> {
  const q = new URLSearchParams({ orgUnit, period });
  return captureRequest('GET',
    `/edge-api/v1/capture/datasets/${encodeURIComponent(dataSetUid)}/data?${q.toString()}`);
}

/* ───── event / program-stage (phase 2) ──────────────────────────── */

export interface CaptureProgramStageSummary {
  stageUid: string;
  displayName: string;
  repeatable: boolean;
  sortOrder: number;
}

export interface CaptureEventSummary {
  eventUid: string;
  programStageUid: string;
  orgUnitUid: string;
  occurredAt: string;
  status: string | null;
}

export interface CaptureEventDetail {
  eventUid: string;
  enrollmentUid: string | null;
  programUid: string;
  programStageUid: string;
  orgUnitUid: string;
  occurredAt: string;
  status: string | null;
  attributeOptionComboUid: string | null;
  dataValues: Record<string, string>;
  workflowRunId: string | null;
}

export function listCaptureProgramStages(programUid: string):
    Promise<{ count: number; stages: CaptureProgramStageSummary[] }> {
  return captureRequest('GET',
    `/edge-api/v1/capture/programs/${encodeURIComponent(programUid)}/stages`);
}

export function getCaptureStageForm(programUid: string, stageUid: string):
    Promise<CaptureFormAssembly> {
  return captureRequest('GET',
    `/edge-api/v1/capture/programs/${encodeURIComponent(programUid)}`
    + `/stages/${encodeURIComponent(stageUid)}/form`);
}

export function listCaptureProgramEvents(programUid: string, orgUnit: string,
                                           limit = 100):
    Promise<{ count: number; events: CaptureEventSummary[] }> {
  const q = new URLSearchParams({ orgUnit, limit: String(limit) });
  return captureRequest('GET',
    `/edge-api/v1/capture/programs/${encodeURIComponent(programUid)}`
    + `/events?${q.toString()}`);
}

export function getCaptureEventDetail(eventUid: string):
    Promise<CaptureEventDetail> {
  return captureRequest('GET',
    `/edge-api/v1/capture/events/${encodeURIComponent(eventUid)}/detail`);
}

/* ───── tracker reads (phase 3) ──────────────────────────────────── */

export interface CaptureProgramInfo {
  programUid: string;
  displayName: string;
  programType: 'WITH_REGISTRATION' | 'WITHOUT_REGISTRATION';
  trackedEntityTypeUid: string | null;
}

export interface CaptureTrackedEntityTypeRef {
  trackedEntityTypeUid: string;
}

export interface CaptureTrackedEntityAttributeSummary {
  attributeUid: string;
  displayName: string;
  valueType: string;
  optionSetUid: string | null;
  searchable: boolean;
  uniqueAttribute: boolean;
}

export interface CaptureEnrollmentSummary {
  enrollmentUid: string;
  teiUid: string;
  programUid: string;
  orgUnitUid: string;
  status: string | null;
  enrollmentDate: string | null;
  incidentDate: string | null;
  lastUpdatedAt: string;
}

export interface CaptureTrackerEventSummary {
  eventUid: string;
  enrollmentUid: string;
  programUid: string;
  programStageUid: string;
  orgUnitUid: string;
  status: string | null;
  occurredDate: string | null;
  lastUpdatedAt: string;
}

export function getCaptureProgram(programUid: string):
    Promise<CaptureProgramInfo> {
  return captureRequest('GET',
    `/edge-api/v1/capture/programs/${encodeURIComponent(programUid)}`);
}

export function getCaptureProgramTeiType(programUid: string):
    Promise<CaptureTrackedEntityTypeRef> {
  return captureRequest('GET',
    `/edge-api/v1/capture/programs/${encodeURIComponent(programUid)}`
    + '/trackedEntityType');
}

export function listCaptureTeiTypeAttributes(teiTypeUid: string):
    Promise<{ count: number; attributes: CaptureTrackedEntityAttributeSummary[] }> {
  return captureRequest('GET',
    `/edge-api/v1/capture/trackedEntityTypes/${encodeURIComponent(teiTypeUid)}`
    + '/attributes');
}

export function listCaptureTeiEnrollments(teiUid: string, programUid?: string):
    Promise<{ count: number; enrollments: CaptureEnrollmentSummary[] }> {
  const q = new URLSearchParams();
  if (programUid) q.set('programUid', programUid);
  const qs = q.toString();
  return captureRequest('GET',
    `/edge-api/v1/capture/trackedEntities/${encodeURIComponent(teiUid)}/enrollments`
    + (qs ? `?${qs}` : ''));
}

export function listCaptureEnrollmentEvents(enrollmentUid: string,
                                              programStageUid?: string):
    Promise<{ count: number; events: CaptureTrackerEventSummary[] }> {
  const q = new URLSearchParams();
  if (programStageUid) q.set('programStageUid', programStageUid);
  const qs = q.toString();
  return captureRequest('GET',
    `/edge-api/v1/capture/enrollments/${encodeURIComponent(enrollmentUid)}/events`
    + (qs ? `?${qs}` : ''));
}

/** §2.3.43 — pull a program's tracked-entity-attribute UID list from
 *  the DHIS2 proxy so EnrollmentCreate can render the right inputs
 *  without the operator having to paste them into the URL. */
export async function programTrackedEntityAttributes(programId: string):
    Promise<string[]> {
  const r = await fetch(
    `/api/programs/${programId}?fields=id,programTrackedEntityAttributes`,
    { credentials: 'include', headers: { Accept: 'application/json' } });
  if (!r.ok) return [];
  const body = await r.json() as {
    programTrackedEntityAttributes?: Array<{
      trackedEntityAttribute?: { id: string };
    }>;
  };
  return (body.programTrackedEntityAttributes ?? [])
    .map((p) => p.trackedEntityAttribute?.id)
    .filter((id): id is string => !!id);
}
