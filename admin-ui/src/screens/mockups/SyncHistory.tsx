import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { OuPicker, useOuContext, Panel, SplitWithDrawer, fmtDate, fmtDur, fmtAgo, usePaged, TablePager, humaniseJob, humaniseState, relatedLinksForJob, syncActivityShape } from './shared';
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
                        <td style={{ fontSize: 12 }}>
                          <span className="ea-mono" style={{ color: 'var(--der-ink-900)' }}>
                            {shape.directionLabel.split(' ')[0]}
                          </span>
                          <span style={{ color: 'var(--der-primary)', margin: '0 4px', fontWeight: 700 }}>
                            {shape.directionArrow}
                          </span>
                          <span className="ea-mono" style={{ color: 'var(--der-ink-900)' }}>
                            {shape.directionLabel.split(' ').slice(-1)[0]}
                          </span>
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
              <dl className="ea-def-list">
                <div className="ea-def-row"><dt>Run ID</dt><dd className="ea-mono">{sel.runId}</dd></div>
                <div className="ea-def-row"><dt>Job</dt>
                  <dd>
                    {humaniseJob(sel.jobName)}
                    <div className="ea-text-muted ea-mono" style={{ fontSize: 10 }}>{sel.jobName}</div>
                  </dd>
                </div>
                <div className="ea-def-row"><dt>Status</dt>
                  <dd><span className={'ea-chip ea-chip--' + (sel.outcome === 'SUCCEEDED' ? 'success' : sel.outcome === 'FAILED' ? 'danger' : 'info')}>{humaniseState(sel.outcome)}</span></dd>
                </div>
                <div className="ea-def-row"><dt>Started</dt><dd className="ea-mono">{fmtDate(sel.startedAt)}</dd></div>
                <div className="ea-def-row"><dt>Finished</dt><dd className="ea-mono">{sel.finishedAt ? fmtDate(sel.finishedAt) : '—'}</dd></div>
                <div className="ea-def-row"><dt>Duration</dt><dd>{fmtDur(sel.durationMs)}</dd></div>
                <div className="ea-def-row"><dt>Age</dt><dd>{fmtAgo(sel.startedAt)}</dd></div>
                <div className="ea-def-row"><dt>Triggered by</dt><dd>{humaniseState(sel.triggeredBy)}</dd></div>
                {sel.detail && <div className="ea-def-row"><dt>Outcome summary</dt>
                  <dd>{summariseDetail(sel.detail)}</dd></div>}
                {sel.detail && <div className="ea-def-row"><dt>Raw detail</dt>
                  <dd className="ea-mono" style={{ fontSize: 10, wordBreak: 'break-all' }}>{sel.detail}</dd></div>}
              </dl>
              {relatedLinksForJob(sel.jobName).length > 0 && (
                <>
                  <h4 style={{ margin: '12px 0 4px', fontSize: 11, fontWeight: 600,
                               letterSpacing: '0.02em', textTransform: 'uppercase',
                               color: 'var(--der-ink-400)' }}>
                    Explore payload
                  </h4>
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
                </>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button type="button" className="ea-btn ea-btn--ghost">Export this run</button>
              </div>
            </>
          ) : (
            <p className="ea-text-muted" style={{ margin: 0 }}>Select a row to view run details.</p>
          )
        }
      />
    </div>
  );
}

/** Turn the structured `detail` JSON that jobs attach (e.g.
 *  `{"picked":0,"accepted":2,"rejected":0,"conflicts":0,"retryable":0}`)
 *  into a one-line human summary. Falls back to the raw string when the
 *  payload isn't JSON or doesn't match a known shape. */
function summariseDetail(detail: string | null | undefined): string {
  if (!detail) return '—';
  try {
    const obj = JSON.parse(detail);
    if (obj && typeof obj === 'object') {
      const parts: string[] = [];
      if (typeof obj.accepted === 'number') parts.push(`${obj.accepted} accepted`);
      if (typeof obj.rejected === 'number' && obj.rejected > 0) parts.push(`${obj.rejected} rejected`);
      if (typeof obj.conflicts === 'number' && obj.conflicts > 0) parts.push(`${obj.conflicts} conflicts`);
      if (typeof obj.retryable === 'number' && obj.retryable > 0) parts.push(`${obj.retryable} to retry`);
      if (typeof obj.picked === 'number' && parts.length === 0) {
        parts.push(`${obj.picked} picked up`);
      }
      if (typeof obj.pulled === 'number') parts.push(`${obj.pulled} pulled`);
      if (typeof obj.pushed === 'number') parts.push(`${obj.pushed} pushed`);
      if (parts.length > 0) return parts.join(' · ');
    }
  } catch { /* not JSON — fall through */ }
  return detail;
}
