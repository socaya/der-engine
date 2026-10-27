import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import {
  Panel, SplitWithDrawer, fmtDate, fmtAgo, usePaged, TablePager,
  entityTypeIcon, entityTypeLabel, operatorState, operatorStateTone,
  DrawerTabs, JsonViewer, type OperatorState,
} from './shared';
import { LoadingBlock } from '../../components/ScreenStates';

/** /admin/sync/data — DER Sync requirements §7.
 *
 * Operator-facing view of the outbound journal. Internal queue states
 * map to six plain-English statuses (Waiting / Sending / Sent /
 * Retrying / Rejected / Needs attention). Row drawer carries the full
 * payload via the lazy JournalOperation fetch.
 */
export function MockupDataQueues(): JSX.Element {
  const [ops, setOps] = useState<edgeApi.JournalOperation[] | null>(null);
  const [sysInfo, setSysInfo] = useState<edgeApi.SystemInfo | null>(null);
  const [worker, setWorker] = useState<edgeApi.WorkerHealth | null>(null);
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);

  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [sel, setSel] = useState<edgeApi.JournalOperation | null>(null);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'payload'>('overview');
  const [pushing, setPushing] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

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
  useEffect(() => { setDrawerTab('overview'); }, [sel?.operationId]);

  async function push(): Promise<void> {
    setPushing(true); setFlash(null);
    try {
      await edgeApi.triggerJob('JOURNAL_WORKER_DRAIN');
      setFlash('Data push started.');
      setTimeout(() => reload().catch(() => undefined), 1500);
    } catch (e) {
      setFlash(e instanceof Error ? e.message : String(e));
    } finally { setPushing(false); }
  }

  async function retry(): Promise<void> {
    // No per-row retry endpoint today; triggering the drain picks the
    // row up on the next pass. Keep the UX honest.
    await push();
  }

  const items = useMemo(() => (ops ?? []).map((o) => ({
    op: o,
    state: operatorState(o.state),
  })), [ops]);

  const types = useMemo(() => Array.from(new Set(items.map((i) => i.op.entityType))).sort(),
    [items]);

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

  // Status counts for the summary strip (operator-facing names).
  const stateCounts: Record<OperatorState, number> = {
    Waiting: 0, Sending: 0, Sent: 0, Retrying: 0, Rejected: 0, 'Needs attention': 0,
  };
  for (const it of items) stateCounts[it.state] += 1;

  const centralReachable = sysInfo?.dhis2?.probeReachable ?? false;
  const workerEnabled = worker?.enabled ?? false;
  const unsent = stateCounts.Waiting + stateCounts.Sending + stateCounts.Retrying;
  const needsAttention = stateCounts['Needs attention'] + stateCounts.Rejected;

  // Hero status headline per spec §7.
  let headline: string;
  let accent: string;
  let icon: string;
  if (!workerEnabled) {
    headline = 'Data push is paused';
    accent = 'var(--der-ink-400, #94a3b8)'; icon = '⏸';
  } else if (!centralReachable) {
    headline = 'Central DHIS2 is unavailable';
    accent = 'var(--der-warning, #d97706)'; icon = '⌁';
  } else if (needsAttention > 0) {
    headline = `${needsAttention} record${needsAttention === 1 ? '' : 's'} need${needsAttention === 1 ? 's' : ''} attention`;
    accent = 'var(--der-danger, #dc2626)'; icon = '!';
  } else if (unsent > 0) {
    headline = `${unsent} record${unsent === 1 ? '' : 's'} waiting to be sent`;
    accent = 'var(--der-primary)'; icon = '↑';
  } else {
    headline = 'All local data has been sent';
    accent = 'var(--der-success, #16a34a)'; icon = '✓';
  }

  const lastPush = (jobs ?? []).find((j) => j.jobName === 'JOURNAL_WORKER_DRAIN'
    && (j.outcome === 'SUCCEEDED' || j.outcome === 'SUCCESS'));

  return (
    <div className="ea-screen" data-test="sync-data">
      {flash && <p className="ea-saved" style={{ marginBottom: 10 }}>{flash}</p>}

      <section style={{
        display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: 14, alignItems: 'center',
        padding: 16, marginBottom: 14, borderRadius: 8,
        border: '1px solid var(--der-border-subtle)',
        borderLeft: `4px solid ${accent}`, background: 'white',
      }}>
        <div style={{ fontSize: 38, fontWeight: 700, color: accent,
                       textAlign: 'center', lineHeight: 1 }} aria-hidden="true">{icon}</div>
        <div>
          <h1 style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 700 }}
              data-test="data-status">{headline}</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--der-ink-500)' }}>
            Locally captured data queued for push to Central DHIS2.
            {lastPush && <> Last successful push {fmtAgo(lastPush.startedAt)}.</>}
          </p>
        </div>
        <button type="button" className="ea-btn ea-btn--primary"
                style={{ fontSize: 14, padding: '10px 16px' }}
                disabled={pushing || !centralReachable || !workerEnabled || unsent === 0}
                data-test="data-push"
                onClick={() => { push().catch(() => undefined); }}>
          {pushing ? 'Pushing…' : 'Push data now'}
        </button>
      </section>

      <div style={{ display: 'grid',
                    gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
                    gap: 8, marginBottom: 14 }}>
        {(['Waiting', 'Sending', 'Sent', 'Retrying', 'Rejected', 'Needs attention'] as OperatorState[])
          .map((s) => (
            <div key={s}
                 style={{
                   padding: '10px 12px', borderRadius: 6,
                   border: '1px solid var(--der-border-subtle)',
                   background: 'white',
                 }}
                 data-test={`data-summary-${s.toLowerCase().replace(' ', '-')}`}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--der-ink-900)' }}>
                {stateCounts[s].toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--der-ink-500)', marginTop: 2 }}>{s}</div>
            </div>
          ))}
      </div>

      <SplitWithDrawer
        drawerOpen={!!sel}
        main={
          <Panel title={`${filtered.length} record${filtered.length === 1 ? '' : 's'}`}
                 action={
                   <>
                     <input className="ea-input" style={{ maxWidth: 220 }} type="search"
                            placeholder="Search record or operation ID"
                            value={query} onChange={(e) => setQuery(e.target.value)} />
                     <select className="ea-input" style={{ maxWidth: 160 }} value={filterType}
                             onChange={(e) => setFilterType(e.target.value)}>
                       <option value="ALL">All data types</option>
                       {types.map((t) => (
                         <option key={t} value={t}>{entityTypeLabel(t)}</option>
                       ))}
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
                <table className="ea-table ea-table--dense ea-table--selectable">
                  <thead><tr>
                    <th style={{ width: 32 }}></th>
                    <th>Type</th>
                    <th>Record</th>
                    <th style={{ width: 110 }}>Captured</th>
                    <th style={{ width: 130 }}>Status</th>
                    <th style={{ width: 110 }}>Last attempt</th>
                    <th style={{ width: 80 }}>Action</th>
                  </tr></thead>
                  <tbody>
                    {paged.rows.map(({ op, state }) => (
                      <tr key={op.operationId}
                          className={sel?.operationId === op.operationId ? 'ea-row--active' : ''}
                          onClick={() => setSel(op)}
                          data-test={`data-row-${op.operationId}`}>
                        <td style={{ fontSize: 16, textAlign: 'center' }} aria-hidden="true"
                            title={entityTypeLabel(op.entityType)}>
                          {entityTypeIcon(op.entityType)}
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{entityTypeLabel(op.entityType)}</div>
                          <div className="ea-text-muted ea-mono" style={{ fontSize: 10 }}>
                            {op.entityType}
                          </div>
                        </td>
                        <td className="ea-mono" style={{ fontSize: 12 }}>{op.entityRef}</td>
                        <td className="ea-text-muted" style={{ fontSize: 12 }}
                            title={fmtDate(op.createdAt)}>{fmtAgo(op.createdAt)}</td>
                        <td>
                          <span className={`ea-chip ea-chip--${operatorStateTone(state)}`}>{state}</span>
                        </td>
                        <td className="ea-text-muted" style={{ fontSize: 12 }}
                            title={fmtDate(op.updatedAt)}>{fmtAgo(op.updatedAt)}</td>
                        <td>
                          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                                  onClick={(e) => { e.stopPropagation(); setSel(op); }}>
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <TablePager {...paged.pagerProps} />
              </div>
            )}
          </Panel>
        }
        drawer={
          sel ? (() => {
            const state = operatorState(sel.state);
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 28, lineHeight: 1 }} aria-hidden="true">
                    {entityTypeIcon(sel.entityType)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>{entityTypeLabel(sel.entityType)}</h3>
                    <div className="ea-text-muted ea-mono" style={{ fontSize: 12, marginTop: 2 }}>
                      {sel.entityRef}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <span className={`ea-chip ea-chip--${operatorStateTone(state)}`}>{state}</span>
                    </div>
                  </div>
                </div>

                <DrawerTabs
                  active={drawerTab}
                  onChange={(id) => setDrawerTab(id as 'overview' | 'payload')}
                  tabs={[
                    { id: 'overview', label: 'Overview' },
                    { id: 'payload', label: 'Payload' },
                  ]}
                />

                {drawerTab === 'overview' && (
                  <dl className="ea-def-list">
                    <div className="ea-def-row"><dt>Status</dt>
                      <dd><span className={`ea-chip ea-chip--${operatorStateTone(state)}`}>{state}</span></dd>
                    </div>
                    <div className="ea-def-row"><dt>Captured</dt>
                      <dd className="ea-mono">{fmtDate(sel.createdAt)}</dd></div>
                    <div className="ea-def-row"><dt>Last attempt</dt>
                      <dd className="ea-mono">{fmtDate(sel.updatedAt)}</dd></div>
                    <div className="ea-def-row"><dt>Retry count</dt>
                      <dd className="ea-mono">{sel.attemptCount}</dd></div>
                    <div className="ea-def-row"><dt>Operation ID</dt>
                      <dd className="ea-mono" style={{ fontSize: 10 }}>{sel.operationId}</dd></div>
                    {sel.lastError && (
                      <div className="ea-def-row"><dt>Last error</dt>
                        <dd className="ea-mono" style={{ fontSize: 10, color: 'var(--der-danger, #b91c1c)' }}>
                          {sel.lastError.slice(0, 400)}
                        </dd></div>
                    )}
                  </dl>
                )}

                {drawerTab === 'payload' && (
                  <JsonViewer value={sel.payload}
                              label={`${entityTypeLabel(sel.entityType)} · ${sel.entityRef}`}
                              maxDepth={3} />
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14,
                              paddingTop: 10, borderTop: '1px solid var(--der-border-subtle)' }}>
                  {state === 'Retrying' || state === 'Rejected' ? (
                    <button type="button" className="ea-btn ea-btn--primary"
                            onClick={() => { retry().catch(() => undefined); }}>
                      Retry push
                    </button>
                  ) : state === 'Needs attention' ? (
                    <Link to="/sync/attention" className="ea-btn ea-btn--primary"
                          style={{ textAlign: 'center' }}>
                      Open attention item
                    </Link>
                  ) : state === 'Waiting' ? (
                    <button type="button" className="ea-btn ea-btn--primary"
                            disabled={pushing || !centralReachable || !workerEnabled}
                            onClick={() => { push().catch(() => undefined); }}>
                      Push now
                    </button>
                  ) : null}
                </div>
              </>
            );
          })() : (
            <p className="ea-text-muted" style={{ margin: 0 }}>
              Select a record to see its details and payload.
            </p>
          )
        }
      />
    </div>
  );
}
