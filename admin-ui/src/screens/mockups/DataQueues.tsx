import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import {
  Panel, fmtDate, fmtAgo, usePaged, TablePager,
  entityTypeIcon, entityTypeLabel, operatorState, operatorStateTone,
  DrawerTabs, JsonViewer, SyncStatusBar, Spinner, useTriggerAndWatch,
  BackLink, RowMenu, Status,
  type OperatorState, type SyncStatusTone, type RowMenuItem,
} from './shared';
import { UiIcon } from '../../components/UiIcon';
import { LoadingBlock } from '../../components/ScreenStates';

/** `/admin/sync/data` — operator-facing outbound journal table. Full
 *  width, no side drawer. Row click navigates to the per-record
 *  details page. */
export function MockupDataQueues(): JSX.Element {
  const navigate = useNavigate();
  const [ops, setOps] = useState<edgeApi.JournalOperation[] | null>(null);
  const [sysInfo, setSysInfo] = useState<edgeApi.SystemInfo | null>(null);
  const [worker, setWorker] = useState<edgeApi.WorkerHealth | null>(null);
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);

  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const push = useTriggerAndWatch();

  async function reload(): Promise<void> {
    const [a, b, c, d] = await Promise.allSettled([
      edgeApi.listJournalOperations(200),
      edgeApi.systemInfo(),
      edgeApi.workerHealth(),
      edgeApi.listJobs(50),
    ]);
    if (a.status === 'fulfilled') setOps(a.value);
    if (b.status === 'fulfilled') setSysInfo(b.value);
    if (c.status === 'fulfilled') setWorker(c.value);
    if (d.status === 'fulfilled') setJobs(d.value);
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  useEffect(() => {
    if (push.state === 'done' || push.state === 'failed') {
      reload().catch(() => undefined);
    }
  }, [push.state]);

  const items = useMemo(() => (ops ?? []).map((o) => ({
    op: o, state: operatorState(o.state),
  })), [ops]);
  const types = useMemo(() => Array.from(new Set(items.map((i) => i.op.entityType))).sort(), [items]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (q && !i.op.entityRef.toLowerCase().includes(q)
            && !i.op.operationId.toLowerCase().includes(q)) return false;
      if (filterType !== 'ALL' && i.op.entityType !== filterType) return false;
      if (filterStatus !== 'ALL' && i.state !== filterStatus) return false;
      return true;
    });
  }, [items, query, filterType, filterStatus]);
  const paged = usePaged(filtered, 50);

  if (!ops) return <LoadingBlock testId="loading" />;

  const stateCounts: Record<OperatorState, number> = {
    Waiting: 0, Sending: 0, Sent: 0, Retrying: 0, Rejected: 0, 'Needs attention': 0,
  };
  for (const it of items) stateCounts[it.state] += 1;

  const centralReachable = sysInfo?.dhis2?.probeReachable ?? false;
  const workerEnabled = worker?.enabled ?? false;
  const unsent = stateCounts.Waiting + stateCounts.Sending + stateCounts.Retrying;
  const needsAttention = stateCounts['Needs attention'] + stateCounts.Rejected;

  let statusLabel: string;
  let tone: SyncStatusTone;
  if (!workerEnabled) { statusLabel = 'Paused'; tone = 'muted'; }
  else if (!centralReachable) { statusLabel = 'Central unavailable'; tone = 'warning'; }
  else if (needsAttention > 0) { statusLabel = `${needsAttention} need${needsAttention === 1 ? 's' : ''} attention`; tone = 'danger'; }
  else if (unsent > 0) { statusLabel = `${unsent} waiting`; tone = 'info'; }
  else { statusLabel = 'All sent'; tone = 'success'; }

  const lastPush = (jobs ?? []).find((j) => j.jobName === 'JOURNAL_WORKER_DRAIN'
    && (j.outcome === 'SUCCEEDED' || j.outcome === 'SUCCESS'));
  const pushing = push.state === 'triggering' || push.state === 'running';

  function rowMenuFor(op: edgeApi.JournalOperation): ReadonlyArray<RowMenuItem> {
    const state = operatorState(op.state);
    const items: RowMenuItem[] = [
      { label: 'Open details', to: `/sync/data/${op.operationId}` },
    ];
    if (state === 'Retrying' || state === 'Rejected' || state === 'Waiting') {
      items.push({
        label: 'Push now',
        disabled: pushing || !centralReachable || !workerEnabled,
        onSelect: () => { push.trigger('JOURNAL_WORKER_DRAIN').catch(() => undefined); },
      });
    }
    if (state === 'Needs attention') {
      items.push({ label: 'Open attention item', to: '/sync/attention' });
    }
    return items;
  }

  return (
    <div className="ea-screen" data-test="sync-data">
      <SyncStatusBar
        tone={tone}
        title="Data"
        statusLabel={statusLabel}
        subtitle={
          <>
            <span>Locally captured data · DER → Central</span>
            {lastPush && (<>
              <span>·</span>
              <span>Last successful push{' '}
                <strong style={{ color: 'var(--der-ink-900)' }}>{fmtAgo(lastPush.startedAt)}</strong>
              </span>
            </>)}
            <span>·</span>
            <span>Waiting <strong>{stateCounts.Waiting}</strong></span>
            <span>·</span>
            <span>Sent <strong>{stateCounts.Sent}</strong></span>
            {stateCounts.Retrying > 0 && (<><span>·</span><span>Retrying <strong>{stateCounts.Retrying}</strong></span></>)}
            {needsAttention > 0 && (<><span>·</span><span>Needs attention <strong style={{ color: 'var(--der-danger-ink)' }}>{needsAttention}</strong></span></>)}
          </>
        }
        actions={
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  disabled={pushing || !centralReachable || !workerEnabled || unsent === 0}
                  data-test="data-push"
                  onClick={() => { push.trigger('JOURNAL_WORKER_DRAIN').catch(() => undefined); }}>
            {pushing && <><Spinner /><span style={{ marginLeft: 6 }} /></>}
            {push.state === 'running' ? 'Pushing…' : 'Push data'}
          </button>
        }
      />

      {push.state !== 'idle' && (
        <div data-test="data-progress"
             style={{
               display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
               color: 'var(--der-ink-500)', marginBottom: 4,
             }}>
          {pushing && <Spinner />}
          <span className={'ea-chip ea-chip--'
            + (push.state === 'done' ? 'success'
              : push.state === 'failed' ? 'danger'
              : push.state === 'timeout' ? 'warning' : 'info')}>
            {push.state === 'triggering' ? 'Starting'
              : push.state === 'running' ? 'Running'
              : push.state === 'done' ? 'Completed'
              : push.state === 'failed' ? 'Failed' : 'Still running'}
          </span>
          <strong style={{ color: 'var(--der-ink-900)' }}>Push data</strong>
          <span style={{ flex: 1 }}>{push.message}</span>
          {(push.state === 'done' || push.state === 'failed' || push.state === 'timeout') && (
            <button type="button" className="ea-link-btn"
                    style={{ fontSize: 11 }}
                    onClick={push.reset}>Dismiss</button>
          )}
        </div>
      )}

      <Panel title={`${filtered.length} record${filtered.length === 1 ? '' : 's'}`}
             action={
               <>
                 <input className="ea-input" style={{ maxWidth: 220 }} type="search"
                        placeholder="Search record or operation ID"
                        value={query} onChange={(e) => setQuery(e.target.value)} />
                 <select className="ea-input" style={{ maxWidth: 160 }} value={filterType}
                         onChange={(e) => setFilterType(e.target.value)}>
                   <option value="ALL">All data types</option>
                   {types.map((t) => (<option key={t} value={t}>{entityTypeLabel(t)}</option>))}
                 </select>
                 <select className="ea-input" style={{ maxWidth: 150 }} value={filterStatus}
                         onChange={(e) => setFilterStatus(e.target.value)}>
                   <option value="ALL">All statuses</option>
                   {(['Waiting', 'Sending', 'Sent', 'Retrying', 'Rejected', 'Needs attention'] as OperatorState[])
                     .map((s) => <option key={s} value={s}>{s}</option>)}
                 </select>
                 <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                         onClick={() => { reload().catch(() => undefined); }}>Refresh</button>
               </>
             }>
        {filtered.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>
            {items.length === 0
              ? 'The outbound queue is empty — nothing to send.'
              : 'No records match the current filters.'}
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense ea-table--selectable"
                   style={{ width: '100%', tableLayout: 'auto' }}>
              <thead><tr>
                <th style={{ width: 32 }}></th>
                <th>Type</th>
                <th>Backend key</th>
                <th>Record</th>
                <th style={{ width: 110 }}>Captured</th>
                <th style={{ width: 150 }}>Status</th>
                <th style={{ width: 110 }}>Last attempt</th>
                <th style={{ width: 48 }} aria-label="Actions"></th>
              </tr></thead>
              <tbody>
                {paged.rows.map(({ op, state }) => (
                  <tr key={op.operationId}
                      onClick={() => navigate(`/sync/data/${op.operationId}`)}
                      data-test={`data-row-${op.operationId}`}>
                    <td style={{ textAlign: 'center', color: 'var(--der-ink-500)' }} aria-hidden="true"
                        title={entityTypeLabel(op.entityType)}>
                      <UiIcon icon={entityTypeIcon(op.entityType)} size={18} />
                    </td>
                    <td style={{ fontWeight: 500 }}>{entityTypeLabel(op.entityType)}</td>
                    <td className="ea-text-muted ea-mono" style={{ fontSize: 13 }}>{op.entityType}</td>
                    <td className="ea-mono" style={{ fontSize: 13 }}>{op.entityRef}</td>
                    <td className="ea-text-muted"
                        title={fmtDate(op.createdAt)}>{fmtAgo(op.createdAt)}</td>
                    <td>
                      <Status tone={operatorStateTone(state)}>{state}</Status>
                    </td>
                    <td className="ea-text-muted"
                        title={fmtDate(op.updatedAt)}>{fmtAgo(op.updatedAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <RowMenu items={rowMenuFor(op)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePager {...paged.pagerProps} />
          </div>
        )}
      </Panel>
    </div>
  );
}

/** `/admin/sync/data/:operationId` — per-record details page.
 *  Replaces the former right-side drawer. */
export function MockupDataDetail(): JSX.Element {
  const { operationId } = useParams<{ operationId: string }>();
  const [op, setOp] = useState<edgeApi.JournalOperation | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'payload'>('overview');
  const push = useTriggerAndWatch();

  useEffect(() => {
    if (!operationId) return;
    edgeApi.fetchJournalOperation(operationId)
      .then((r) => setOp(r))
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, [operationId]);
  useEffect(() => {
    if (push.state === 'done') {
      // Refresh after a successful push.
      if (operationId) edgeApi.fetchJournalOperation(operationId).then((r) => setOp(r)).catch(() => undefined);
    }
  }, [push.state, operationId]);

  if (err) return (
    <div className="ea-screen" data-test="sync-data-detail-err">
      <BackLink to="/sync/data" label="Back to Data" />
      <SyncStatusBar tone="danger" title="Record not found" statusLabel="Error"
                     subtitle={<span>{err}</span>} />
    </div>
  );
  if (!op) return <LoadingBlock testId="loading" />;

  const state = operatorState(op.state);
  const pushing = push.state === 'triggering' || push.state === 'running';
  const isErrorState = state === 'Rejected' || state === 'Retrying' || state === 'Needs attention';
  // The server reuses the `last_error` column for the last DHIS2 response
  // body regardless of success/failure, so treat it as a response unless
  // the operator-facing state is actually a failure.
  const responseLabel = isErrorState ? 'Last error' : 'Last response';
  const parsedResponse = parseResponseBody(op.lastError);
  return (
    <div className="ea-screen" data-test="sync-data-detail">
      <BackLink to="/sync/data" label="Back to Data" />
      <SyncStatusBar
        tone={operatorStateTone(state) === 'muted' ? 'muted' : operatorStateTone(state)}
        title={entityTypeLabel(op.entityType)}
        statusLabel={state}
        subtitle={
          <>
            <span className="ea-mono" style={{ color: 'var(--der-ink-900)' }}>{op.entityRef}</span>
            <span>·</span>
            <span>Captured <strong style={{ color: 'var(--der-ink-900)' }}>{fmtDate(op.createdAt)}</strong></span>
            <span>·</span>
            <span>Last attempt <strong style={{ color: 'var(--der-ink-900)' }}>{fmtDate(op.updatedAt)}</strong></span>
            {op.attemptCount > 0 && (<>
              <span>·</span>
              <span>Attempts <strong style={{ color: 'var(--der-ink-900)' }}>{op.attemptCount}</strong></span>
            </>)}
          </>
        }
        actions={
          <>
            {(state === 'Retrying' || state === 'Rejected' || state === 'Waiting') && (
              <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                      disabled={pushing}
                      onClick={() => { push.trigger('JOURNAL_WORKER_DRAIN').catch(() => undefined); }}>
                {pushing && <><Spinner /><span style={{ marginLeft: 6 }} /></>}
                {push.state === 'running' ? 'Pushing…' : 'Push now'}
              </button>
            )}
            {state === 'Needs attention' && (
              <Link to="/sync/attention" className="ea-btn ea-btn--primary ea-btn--sm">
                Open attention item
              </Link>
            )}
          </>
        }
      />

      <DrawerTabs
        active={tab}
        onChange={(id) => setTab(id as 'overview' | 'payload')}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'payload', label: 'Payload' },
        ]}
      />

      {tab === 'overview' && (
        <>
          <Panel title="Record">
            <dl className="ea-def-list">
              <div className="ea-def-row"><dt>Status</dt>
                <dd><span className={`ea-chip ea-chip--${operatorStateTone(state)}`}>{state}</span></dd></div>
              <div className="ea-def-row"><dt>Entity type</dt>
                <dd>{entityTypeLabel(op.entityType)}
                  <span className="ea-mono ea-text-muted" style={{ marginLeft: 6, fontSize: 11 }}>
                    {op.entityType}
                  </span>
                </dd></div>
              <div className="ea-def-row"><dt>Entity ref</dt>
                <dd className="ea-mono">{op.entityRef}</dd></div>
              <div className="ea-def-row"><dt>Captured</dt>
                <dd className="ea-mono">{fmtDate(op.createdAt)}</dd></div>
              <div className="ea-def-row"><dt>Last attempt</dt>
                <dd className="ea-mono">{fmtDate(op.updatedAt)}</dd></div>
              <div className="ea-def-row"><dt>Retry count</dt>
                <dd className="ea-mono">{op.attemptCount}</dd></div>
              <div className="ea-def-row"><dt>Operation ID</dt>
                <dd className="ea-mono" style={{ fontSize: 11 }}>{op.operationId}</dd></div>
            </dl>
          </Panel>

          {op.lastError && (
            <Panel title={responseLabel}>
              {parsedResponse ? (
                <ResponseSummary parsed={parsedResponse} raw={op.lastError} isError={isErrorState} />
              ) : (
                <p className="ea-mono"
                   style={{ margin: 0, fontSize: 11,
                            color: isErrorState ? 'var(--der-danger-ink)' : 'var(--der-ink-700)',
                            wordBreak: 'break-word' }}>
                  {op.lastError.slice(0, 2000)}
                </p>
              )}
            </Panel>
          )}
        </>
      )}

      {tab === 'payload' && (
        <Panel title="Payload JSON">
          <JsonViewer value={op.payload}
                      label={`${entityTypeLabel(op.entityType)} · ${op.entityRef}`}
                      maxDepth={4} />
        </Panel>
      )}
    </div>
  );
}

interface ParsedDhis2Response {
  message?: string;
  status?: string;
  httpStatus?: string;
  httpStatusCode?: number;
  importCount?: { imported?: number; updated?: number; ignored?: number; deleted?: number };
  conflicts?: unknown[];
  rejectedIndexes?: unknown[];
}

function parseResponseBody(body: string | null | undefined): ParsedDhis2Response | null {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === 'object') {
      const resp = parsed.response ?? parsed;
      const out: ParsedDhis2Response = {
        message: parsed.message ?? resp?.description,
        status: parsed.status ?? resp?.status,
        httpStatus: parsed.httpStatus,
        httpStatusCode: parsed.httpStatusCode,
        importCount: resp?.importCount,
        conflicts: resp?.conflicts,
        rejectedIndexes: resp?.rejectedIndexes,
      };
      return out;
    }
  } catch { /* not JSON */ }
  return null;
}

function ResponseSummary({ parsed, raw, isError }: {
  parsed: ParsedDhis2Response;
  raw: string;
  isError: boolean;
}): JSX.Element {
  const [showRaw, setShowRaw] = useState(false);
  const okStatus = parsed.status === 'OK' || parsed.status === 'SUCCESS';
  return (
    <div>
      <dl className="ea-def-list">
        {parsed.message && (
          <div className="ea-def-row"><dt>Message</dt>
            <dd>{parsed.message}</dd></div>
        )}
        {parsed.status && (
          <div className="ea-def-row"><dt>Status</dt>
            <dd>
              <span className={'ea-chip ea-chip--' + (okStatus ? 'success' : 'danger')}>
                {parsed.status}
              </span>
            </dd></div>
        )}
        {parsed.httpStatus && (
          <div className="ea-def-row"><dt>HTTP</dt>
            <dd className="ea-mono">
              {parsed.httpStatus}
              {parsed.httpStatusCode != null && ` · ${parsed.httpStatusCode}`}
            </dd></div>
        )}
        {parsed.importCount && (() => {
          const ic = parsed.importCount;
          const total = (ic.imported ?? 0) + (ic.updated ?? 0)
                      + (ic.ignored ?? 0) + (ic.deleted ?? 0);
          return (
            <div className="ea-def-row"><dt>Import count</dt>
              <dd>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <span>Imported <strong>{ic.imported ?? 0}</strong></span>
                  <span>Updated <strong>{ic.updated ?? 0}</strong></span>
                  <span>Ignored <strong>{ic.ignored ?? 0}</strong></span>
                  <span>Deleted <strong>{ic.deleted ?? 0}</strong></span>
                </div>
                {total === 0 && okStatus && (
                  <div className="ea-text-muted"
                       style={{ marginTop: 6, fontSize: 11, lineHeight: 1.5 }}>
                    Central DHIS2 accepted the request (HTTP 200) but didn't
                    change any records — the data was already present or
                    matched an existing value.
                  </div>
                )}
              </dd></div>
          );
        })()}
        {parsed.conflicts && parsed.conflicts.length > 0 && (
          <div className="ea-def-row"><dt>Conflicts</dt>
            <dd className="ea-mono"
                style={{ color: 'var(--der-danger-ink)' }}>
              {parsed.conflicts.length}
            </dd></div>
        )}
      </dl>
      <div style={{ marginTop: 10 }}>
        <button type="button" className="ea-link-btn" style={{ fontSize: 11 }}
                onClick={() => setShowRaw(!showRaw)}>
          {showRaw ? 'Hide full response' : 'Show full response'}
        </button>
      </div>
      {showRaw && (
        <pre className="ea-mono"
             style={{
               marginTop: 8, padding: 10, borderRadius: 6,
               background: 'var(--der-ink-50)', fontSize: 10, lineHeight: 1.5,
               maxHeight: 320, overflow: 'auto',
               color: isError ? 'var(--der-danger-ink)' : 'var(--der-ink-700)',
               whiteSpace: 'pre-wrap', wordBreak: 'break-word',
             }}>{raw.slice(0, 4000)}</pre>
      )}
    </div>
  );
}
