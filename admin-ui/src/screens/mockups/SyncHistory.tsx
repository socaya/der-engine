import { useEffect, useMemo, useState } from 'react';
import * as edgeApi from '../../api/edgeApi';
import { OuPicker, useOuContext, Panel, SplitWithDrawer, fmtDate, fmtDur, fmtAgo } from './shared';
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

  if (!jobs) return <LoadingBlock testId="loading" />;

  return (
    <div className="ea-screen">
      <section className="ea-dash-hero">
        <div className="ea-dash-hero-left">
          <div className="ea-dash-hero-eyebrow">Office &amp; Sync › Sync History</div>
          <h1 className="ea-dash-hero-title">Sync History</h1>
          <p className="ea-dash-hero-sub">View all synchronisation operations for the selected organisation unit.</p>
        </div>
      </section>

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
                  <th>Start Time</th><th>Device / User</th><th>Resource</th><th>Operation</th><th>Duration</th><th>Status</th>
                </tr></thead>
                <tbody>
                  {filtered.slice(0, 100).map((j) => (
                    <tr key={j.runId} className={sel?.runId === j.runId ? 'ea-row--active' : ''}
                        onClick={() => setSel(j)}>
                      <td className="ea-mono">{fmtDate(j.startedAt)}</td>
                      <td>{j.triggeredBy}</td>
                      <td>{j.jobName}</td>
                      <td className="ea-text-muted">{j.detail ?? '—'}</td>
                      <td className="ea-mono">{fmtDur(j.durationMs)}</td>
                      <td>
                        <span className={'ea-chip ea-chip--' +
                            (j.outcome === 'SUCCEEDED' ? 'success' : j.outcome === 'FAILED' ? 'danger' : 'info')}>
                          {j.outcome}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="ea-text-muted" style={{ padding: 24, textAlign: 'center' }}>No matching runs.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        }
        drawer={
          sel ? (
            <>
              <h3 style={{ margin: 0, fontSize: 16 }}>Sync Details</h3>
              <dl className="ea-def-list">
                <div className="ea-def-row"><dt>Run ID</dt><dd className="ea-mono">{sel.runId}</dd></div>
                <div className="ea-def-row"><dt>Job</dt><dd>{sel.jobName}</dd></div>
                <div className="ea-def-row"><dt>Status</dt>
                  <dd><span className={'ea-chip ea-chip--' + (sel.outcome === 'SUCCEEDED' ? 'success' : sel.outcome === 'FAILED' ? 'danger' : 'info')}>{sel.outcome}</span></dd>
                </div>
                <div className="ea-def-row"><dt>Started</dt><dd className="ea-mono">{fmtDate(sel.startedAt)}</dd></div>
                <div className="ea-def-row"><dt>Finished</dt><dd className="ea-mono">{sel.finishedAt ? fmtDate(sel.finishedAt) : '—'}</dd></div>
                <div className="ea-def-row"><dt>Duration</dt><dd>{fmtDur(sel.durationMs)}</dd></div>
                <div className="ea-def-row"><dt>Age</dt><dd>{fmtAgo(sel.startedAt)}</dd></div>
                <div className="ea-def-row"><dt>Triggered by</dt><dd>{sel.triggeredBy}</dd></div>
                {sel.detail && <div className="ea-def-row"><dt>Detail</dt><dd className="ea-mono" style={{ wordBreak: 'break-all' }}>{sel.detail}</dd></div>}
              </dl>
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
