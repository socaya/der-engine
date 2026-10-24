import { useEffect, useMemo, useState } from 'react';
import * as edgeApi from '../../api/edgeApi';
import {
  OuPicker, useOuContext, Panel, SplitWithDrawer, fmtDate, fmtAgo,
} from './shared';
import { LoadingBlock } from '../../components/ScreenStates';

type Tab = 'stored' | 'imports' | 'exports' | 'reports';

const TAB_LABELS: Record<Tab, string> = {
  stored: 'Stored Data',
  imports: 'Imports',
  exports: 'Exports',
  reports: 'Reports & Maintenance',
};

interface DataRow {
  id: string;
  type: string;
  values: number;
  period: string;
  age: string;
  status: 'synced' | 'pending' | 'failed';
  updated: string;
}

/** DHIS2 Data Management — matches docs/media/ui/DHIS2 Data Management Dashboard.png */
export function MockupDataManagement(): JSX.Element {
  const [ctx] = useOuContext();
  const [tab, setTab] = useState<Tab>('stored');
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState<DataRow | null>(null);

  useEffect(() => {
    Promise.allSettled([edgeApi.systemInfo(), edgeApi.listJobs(50)]).then((r) => {
      if (r[0].status === 'fulfilled') setSi(r[0].value);
      if (r[1].status === 'fulfilled') setJobs(r[1].value);
    });
  }, []);

  const rows = useMemo((): DataRow[] => {
    if (!si) return [];
    const journal = si.journal ?? {};
    const latest = jobs?.find((j) => j.outcome === 'SUCCEEDED');
    const updated = latest?.startedAt ?? si.timestamp;
    const rows: DataRow[] = [
      ['AGGREGATE', 'Aggregate data values'],
      ['EVENT', 'Events'],
      ['ENROLLMENT', 'Enrollments'],
      ['TRACKED_ENTITY', 'Tracked entities'],
    ].map(([k, label]) => ({
      id: k,
      type: label,
      values: (journal[k] as number) ?? 0,
      period: '2026Q4',
      age: fmtAgo(updated),
      status: (journal[k] ?? 0) === 0 ? 'synced' : 'pending',
      updated,
    }));
    if (tab === 'imports') return rows.filter((r) => r.values > 0);
    if (tab === 'exports') return rows.filter((r) => r.status === 'synced');
    if (tab === 'reports') return rows;
    return rows;
  }, [si, jobs, tab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.type.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  if (!si) return <LoadingBlock testId="loading" />;

  return (
    <div className="ea-screen">
      <section className="ea-dash-hero">
        <div className="ea-dash-hero-left">
          <div className="ea-dash-hero-eyebrow">Office &amp; Sync › Data Management</div>
          <h1 className="ea-dash-hero-title">Data Management</h1>
          <p className="ea-dash-hero-sub">Manage local data storage, retention and maintenance for the selected organisation unit.</p>
        </div>
      </section>

      <OuPicker ctx={ctx} />

      <div className="ea-section-tabs" style={{ marginBottom: 16 }}>
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button key={t} type="button"
                  className={'ea-section-tab' + (tab === t ? ' ea-section-tab--active' : '')}
                  onClick={() => { setTab(t); setSel(null); }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <SplitWithDrawer
        drawerOpen={!!sel}
        main={
          <Panel title={TAB_LABELS[tab]}
                 action={
                   <>
                     <input className="ea-input" type="search" style={{ maxWidth: 220 }}
                            placeholder="Search data"
                            value={query} onChange={(e) => setQuery(e.target.value)} />
                     <span className="ea-text-muted">{filtered.length} items</span>
                   </>
                 }>
            <div className="ea-table-wrap">
              <table className="ea-table ea-table--dense ea-table--selectable">
                <thead><tr>
                  <th>Data Type</th><th>Data Values</th><th>Period</th><th>Message Age</th><th>Status</th><th>Last Updated</th>
                </tr></thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className={sel?.id === r.id ? 'ea-row--active' : ''}
                        onClick={() => setSel(r)}>
                      <td>{r.type}</td>
                      <td className="ea-mono">{r.values.toLocaleString()}</td>
                      <td>{r.period}</td>
                      <td className="ea-mono">{r.age}</td>
                      <td>
                        <span className={'ea-chip ea-chip--' +
                            (r.status === 'synced' ? 'success' : r.status === 'pending' ? 'warning' : 'danger')}>
                          {r.status}
                        </span>
                      </td>
                      <td className="ea-mono">{fmtDate(r.updated)}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="ea-text-muted" style={{ padding: 24, textAlign: 'center' }}>No data to display.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        }
        drawer={
          sel ? (
            <>
              <h3 style={{ margin: 0, fontSize: 16 }}>Dataset Details</h3>
              <dl className="ea-def-list">
                <div className="ea-def-row"><dt>Type</dt><dd>{sel.type}</dd></div>
                <div className="ea-def-row"><dt>Values</dt><dd className="ea-mono">{sel.values.toLocaleString()}</dd></div>
                <div className="ea-def-row"><dt>Period</dt><dd>{sel.period}</dd></div>
                <div className="ea-def-row"><dt>Age</dt><dd className="ea-mono">{sel.age}</dd></div>
                <div className="ea-def-row"><dt>Status</dt>
                  <dd><span className={'ea-chip ea-chip--' + (sel.status === 'synced' ? 'success' : sel.status === 'pending' ? 'warning' : 'danger')}>{sel.status}</span></dd>
                </div>
                <div className="ea-def-row"><dt>Last Updated</dt><dd className="ea-mono">{fmtDate(sel.updated)}</dd></div>
              </dl>
              <h4 style={{ margin: '12px 0 4px', fontSize: 13, color: 'var(--der-ink-400)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button type="button" className="ea-btn ea-btn--primary">Synchronise Now</button>
                <button type="button" className="ea-btn ea-btn--ghost">Export Data (CSV)</button>
                <button type="button" className="ea-btn ea-btn--ghost ea-btn--danger">Clear Local Data</button>
                <button type="button" className="ea-btn ea-btn--ghost">Manage Retention</button>
              </div>
            </>
          ) : (
            <p className="ea-text-muted" style={{ margin: 0 }}>Select a row to see management actions.</p>
          )
        }
      />
    </div>
  );
}
