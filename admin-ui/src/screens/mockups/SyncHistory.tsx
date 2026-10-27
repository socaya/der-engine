import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { OuPicker, useOuContext, Panel, SplitWithDrawer, fmtDate, fmtDur, fmtAgo, usePaged, TablePager, humaniseJob, humaniseState, relatedLinksForJob, syncActivityShape, parseByType, detailEntries, entityTypeIcon, entityTypeLabel, DrawerTabs, JsonViewer, parseOperationIds } from './shared';
import { LoadingBlock } from '../../components/ScreenStates';

/** DER Sync History — matches docs/media/ui/DER Sync History Dashboard (1).png */
export function MockupSyncHistory(): JSX.Element {
  const [ctx] = useOuContext();
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sel, setSel] = useState<edgeApi.JobRun | null>(null);
  const [tab, setTab] = useState<'overview' | 'payload' | 'related'>('overview');
  const [ops, setOps] = useState<edgeApi.JournalOperation[] | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);

  // Fetch operation payloads when a drain-style run is selected and the
  // user flips to the Payload tab. Guarded so we only fetch the first
  // ~5 operations — the drawer is a preview, not a bulk export.
  useEffect(() => {
    if (!sel || tab !== 'payload') return;
    const ids = parseOperationIds(sel.detail).slice(0, 5);
    if (ids.length === 0) { setOps([]); return; }
    setOpsLoading(true);
    Promise.all(ids.map((id) => edgeApi.fetchJournalOperation(id).catch(() => null)))
      .then((rows) => setOps(rows.filter((r): r is edgeApi.JournalOperation => r !== null)))
      .finally(() => setOpsLoading(false));
  }, [sel, tab]);

  useEffect(() => { setTab('overview'); setOps(null); }, [sel?.runId]);

  async function reload(): Promise<void> {
    try { setJobs(await edgeApi.listJobs(200)); } catch { /* ignore */ }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  const types = useMemo(() => Array.from(new Set((jobs ?? []).map((j) => j.jobName))).sort(), [jobs]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = dateFrom ? Date.parse(dateFrom) : -Infinity;
    const to = dateTo ? Date.parse(dateTo) + 86400_000 : Infinity;
    return (jobs ?? []).filter((j) => {
      if (q && !j.jobName.toLowerCase().includes(q) && !j.triggeredBy.toLowerCase().includes(q)) return false;
      if (filterType !== 'ALL' && j.jobName !== filterType) return false;
      if (filterStatus !== 'ALL' && j.outcome !== filterStatus) return false;
      const t = Date.parse(j.startedAt);
      if (t < from || t > to) return false;
      return true;
    });
  }, [jobs, query, filterType, filterStatus, dateFrom, dateTo]);

  const paged = usePaged(filtered, 50);

  // Auto-focus the first row so the right drawer renders a real payload
  // instead of the "Select a row" placeholder. Only triggers while no
  // row has been clicked yet.
  useEffect(() => {
    if (!sel && paged.rows.length > 0) {
      setSel(paged.rows[0]);
    }
  }, [paged.rows, sel]);

  if (!jobs) return <LoadingBlock testId="loading" />;

  return (
    <div className="ea-screen">
      <OuPicker ctx={ctx} />

      <SplitWithDrawer
        drawerOpen={!!sel}
        main={
          <Panel title={`All runs · ${filtered.length}`}
                 action={
                   <>
                     <input className="ea-input" style={{ maxWidth: 180 }} type="search"
                            placeholder="Search" value={query}
                            onChange={(e) => setQuery(e.target.value)} />
                     <select className="ea-input" style={{ maxWidth: 160 }} value={filterType}
                             onChange={(e) => setFilterType(e.target.value)}>
                       <option value="ALL">All Types</option>
                       {types.map((t) => <option key={t} value={t}>{t}</option>)}
                     </select>
                     <select className="ea-input" style={{ maxWidth: 140 }} value={filterStatus}
                             onChange={(e) => setFilterStatus(e.target.value)}>
                       <option value="ALL">All Statuses</option>
                       <option value="SUCCEEDED">Succeeded</option>
                       <option value="FAILED">Failed</option>
                     </select>
                     <input className="ea-input" style={{ maxWidth: 140 }} type="date"
                            value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                     <input className="ea-input" style={{ maxWidth: 140 }} type="date"
                            value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                     <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                             onClick={() => { reload().catch(() => undefined); }}>Refresh</button>
                     <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm">Export</button>
                   </>
                 }>
            <div className="ea-table-wrap">
              <table className="ea-table ea-table--dense ea-table--selectable">
                <thead><tr>
                  <th style={{ width: 32 }}></th>
                  <th>What was synced</th>
                  <th style={{ width: 110 }}>Direction</th>
                  <th style={{ width: 110 }}>When</th>
                  <th style={{ width: 70 }}>Duration</th>
                  <th style={{ width: 110 }}>Status</th>
                </tr></thead>
                <tbody>
                  {paged.rows.map((j) => {
                    const shape = syncActivityShape(j.jobName, j.detail);
                    return (
                      <tr key={j.runId} className={sel?.runId === j.runId ? 'ea-row--active' : ''}
                          onClick={() => setSel(j)}>
                        <td style={{ fontSize: 16, textAlign: 'center' }}
                            aria-hidden="true" title={shape.category}>
                          {shape.icon}
                        </td>
                        <td>
                          <div style={{ fontWeight: 500, color: 'var(--der-ink-900)' }}>
                            {shape.category}
                          </div>
                          <div className="ea-text-muted" style={{ fontSize: 11, marginTop: 1 }}>
                            {shape.sentence}
                          </div>
                        </td>
                        <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                          {shape.direction === 'local' ? (
                            <span className="ea-text-muted">DER-local</span>
                          ) : (
                            <>
                              <span className="ea-mono" style={{ color: 'var(--der-ink-900)' }}>
                                {shape.directionLabel.split(' → ')[0]}
                              </span>
                              <span style={{ color: 'var(--der-primary)', margin: '0 6px', fontWeight: 700 }}>
                                →
                              </span>
                              <span className="ea-mono" style={{ color: 'var(--der-ink-900)' }}>
                                {shape.directionLabel.split(' → ')[1]}
                              </span>
                            </>
                          )}
                        </td>
                        <td className="ea-text-muted" style={{ fontSize: 12 }}
                            title={fmtDate(j.startedAt)}>
                          {fmtAgo(j.startedAt)}
                        </td>
                        <td className="ea-mono">{fmtDur(j.durationMs)}</td>
                        <td>
                          <span className={'ea-chip ea-chip--' +
                              (j.outcome === 'SUCCEEDED' || j.outcome === 'SUCCESS' ? 'success'
                              : j.outcome === 'FAILED' || j.outcome === 'FAILURE' ? 'danger' : 'info')}>
                            {humaniseState(j.outcome)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="ea-text-muted" style={{ padding: 24, textAlign: 'center' }}>No matching activity.</td></tr>
                  )}
                </tbody>
              </table>
              <TablePager {...paged.pagerProps} />
            </div>
          </Panel>
        }
        drawer={
          sel ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 28, lineHeight: 1 }} aria-hidden="true">
                  {syncActivityShape(sel.jobName, sel.detail).icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>
                    {syncActivityShape(sel.jobName, sel.detail).category}
                  </h3>
                  <div className="ea-text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {syncActivityShape(sel.jobName, sel.detail).sentence}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>
                    <span className="ea-mono">
                      {syncActivityShape(sel.jobName, sel.detail).directionLabel}
                    </span>
                  </div>
                </div>
              </div>
              <DrawerTabs
                active={tab}
                onChange={(id) => setTab(id as 'overview' | 'payload' | 'related')}
                tabs={[
                  { id: 'overview', label: 'Overview' },
                  { id: 'payload', label: 'Payload',
                    badge: parseByType(sel.detail).reduce((a, [, c]) => a + c, 0) || undefined },
                  { id: 'related', label: 'Related',
                    badge: relatedLinksForJob(sel.jobName).length || undefined },
                ]}
              />

              {tab === 'overview' && (
                <dl className="ea-def-list">
                  <div className="ea-def-row"><dt>Run ID</dt><dd className="ea-mono">{sel.runId}</dd></div>
                  <div className="ea-def-row"><dt>Job</dt>
                    <dd>
                      {humaniseJob(sel.jobName)}
                      <div className="ea-text-muted ea-mono" style={{ fontSize: 10 }}>{sel.jobName}</div>
                    </dd>
                  </div>
                  <div className="ea-def-row"><dt>Status</dt>
                    <dd><span className={'ea-chip ea-chip--' + (sel.outcome === 'SUCCEEDED' || sel.outcome === 'SUCCESS' ? 'success' : sel.outcome === 'FAILED' || sel.outcome === 'FAILURE' ? 'danger' : 'info')}>{humaniseState(sel.outcome)}</span></dd>
                  </div>
                  <div className="ea-def-row"><dt>Started</dt><dd className="ea-mono">{fmtDate(sel.startedAt)}</dd></div>
                  <div className="ea-def-row"><dt>Finished</dt><dd className="ea-mono">{sel.finishedAt ? fmtDate(sel.finishedAt) : '—'}</dd></div>
                  <div className="ea-def-row"><dt>Duration</dt><dd>{fmtDur(sel.durationMs)}</dd></div>
                  <div className="ea-def-row"><dt>Age</dt><dd>{fmtAgo(sel.startedAt)}</dd></div>
                  <div className="ea-def-row"><dt>Triggered by</dt><dd>{humaniseState(sel.triggeredBy)}</dd></div>
                </dl>
              )}

              {tab === 'payload' && (
                <>
                  {parseByType(sel.detail).length > 0 && (
                    <>
                      <h4 style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600,
                                   letterSpacing: '0.02em', textTransform: 'uppercase',
                                   color: 'var(--der-ink-400)' }}>Breakdown</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                        {parseByType(sel.detail).map(([type, count]) => (
                          <div key={type}
                               style={{ display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '4px 8px', borderRadius: 4,
                                        background: 'var(--der-ink-50)', fontSize: 12 }}>
                            <span aria-hidden="true" style={{ fontSize: 16 }}>{entityTypeIcon(type)}</span>
                            <span style={{ flex: 1 }}>{entityTypeLabel(type)}</span>
                            <span className="ea-mono" style={{ fontWeight: 600 }}>{count.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <h4 style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600,
                               letterSpacing: '0.02em', textTransform: 'uppercase',
                               color: 'var(--der-ink-400)' }}>Records</h4>
                  {parseOperationIds(sel.detail).length === 0 ? (
                    <p className="ea-text-muted" style={{ margin: '0 0 10px', fontSize: 12 }}>
                      This run didn't move individual records — it's a scheduler
                      heartbeat with no payload to show.
                    </p>
                  ) : opsLoading ? (
                    <p className="ea-text-muted" style={{ margin: '0 0 10px', fontSize: 12 }}>
                      Loading record payloads…
                    </p>
                  ) : (ops ?? []).length === 0 ? (
                    <p className="ea-text-muted" style={{ margin: '0 0 10px', fontSize: 12 }}>
                      Records were drained and are no longer in the journal.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                      {(ops ?? []).map((op) => (
                        <div key={op.operationId}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                                        fontSize: 12, marginBottom: 4 }}>
                            <span aria-hidden="true" style={{ fontSize: 16 }}>
                              {entityTypeIcon(op.entityType)}
                            </span>
                            <span style={{ fontWeight: 500 }}>{entityTypeLabel(op.entityType)}</span>
                            <span className="ea-text-muted ea-mono" style={{ fontSize: 11 }}>
                              {op.entityRef}
                            </span>
                            <span className="ea-chip ea-chip--info" style={{ marginLeft: 'auto' }}>
                              {humaniseState(op.state)}
                            </span>
                          </div>
                          <JsonViewer value={op.payload}
                                      label={`${entityTypeLabel(op.entityType)} · ${op.entityRef}`} />
                        </div>
                      ))}
                      {parseOperationIds(sel.detail).length > (ops ?? []).length && (
                        <p className="ea-text-muted" style={{ margin: 0, fontSize: 11 }}>
                          Showing first {(ops ?? []).length} of {parseOperationIds(sel.detail).length}
                          {' '}records in this run.
                        </p>
                      )}
                    </div>
                  )}

                  {detailEntries(sel.detail).length > 0 && (
                    <>
                      <h4 style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600,
                                   letterSpacing: '0.02em', textTransform: 'uppercase',
                                   color: 'var(--der-ink-400)' }}>Run detail</h4>
                      <dl className="ea-def-list">
                        {detailEntries(sel.detail).map(([k, v]) => (
                          <div key={k} className="ea-def-row">
                            <dt>{humaniseJob(k)}</dt>
                            <dd className="ea-mono">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  )}
                </>
              )}

              {tab === 'related' && (
                relatedLinksForJob(sel.jobName).length === 0 ? (
                  <p className="ea-text-muted" style={{ margin: 0, fontSize: 12 }}>
                    No related screens for this job type.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {relatedLinksForJob(sel.jobName).map(([label, to, hint]) => (
                      <Link key={to} to={to} className="ea-link-tile"
                            style={{ padding: '6px 8px' }}>
                        <div className="ea-link-tile-body">
                          <div className="ea-link-tile-title" style={{ fontSize: 12 }}>{label}</div>
                          <div className="ea-link-tile-desc" style={{ fontSize: 11 }}>{hint}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )
              )}
            </>
          ) : (
            <p className="ea-text-muted" style={{ margin: 0 }}>Select a row to view run details.</p>
          )
        }
      />
    </div>
  );
}

