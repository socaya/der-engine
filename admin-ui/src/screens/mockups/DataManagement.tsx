import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import {
  OuPicker, useOuContext, Panel, SplitWithDrawer, fmtDate, fmtAgo,
  SyncStatusBar, entityTypeIcon, entityTypeLabel,
} from './shared';
import { LoadingBlock } from '../../components/ScreenStates';

interface DataRow {
  id: string;
  type: string;
  typeKey: string;
  values: number;
  pending: number;
  updated: string;
}

/** `/admin/data` — Local data overview.
 *
 * Shows what's captured on this edge grouped by data type with counts.
 * Links to the capture surfaces (DHIS2 Core apps) + the Sync module's
 * data table where the per-record view lives. No fake tabs, no overlap
 * with /sync/data. */
export function MockupDataManagement(): JSX.Element {
  const [ctx] = useOuContext();
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [stats, setStats] = useState<edgeApi.JournalStatsByType | null>(null);
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);
  const [drafts, setDrafts] = useState<number | null>(null);
  const [sel, setSel] = useState<DataRow | null>(null);

  useEffect(() => {
    Promise.allSettled([
      edgeApi.systemInfo(),
      edgeApi.journalStatsByType(),
      edgeApi.listJobs(50),
      edgeApi.listDrafts(),
    ]).then((r) => {
      if (r[0].status === 'fulfilled') setSi(r[0].value);
      if (r[1].status === 'fulfilled') setStats(r[1].value);
      if (r[2].status === 'fulfilled') setJobs(r[2].value);
      if (r[3].status === 'fulfilled') setDrafts(r[3].value.drafts.length);
    });
  }, []);

  const rows = useMemo((): DataRow[] => {
    if (!stats) return [];
    const lastSuccess = jobs?.find((j) => j.outcome === 'SUCCEEDED' || j.outcome === 'SUCCESS');
    const updated = lastSuccess?.startedAt ?? si?.timestamp ?? new Date().toISOString();
    return Object.entries(stats).map(([typeKey, states]) => {
      const total = Object.values(states).reduce((a, b) => a + b, 0);
      const pending = (states.PENDING ?? 0) + (states.IN_FLIGHT ?? 0) + (states.RETRYABLE ?? 0);
      return {
        id: typeKey,
        typeKey,
        type: entityTypeLabel(typeKey),
        values: total,
        pending,
        updated,
      };
    });
  }, [stats, jobs, si]);

  if (!si || !stats) return <LoadingBlock testId="loading" />;

  const totalRecords = rows.reduce((a, r) => a + r.values, 0);
  const totalPending = rows.reduce((a, r) => a + r.pending, 0);

  return (
    <div className="ea-screen">
      <SyncStatusBar
        tone={totalRecords === 0 ? 'muted' : totalPending > 0 ? 'info' : 'success'}
        title="Data"
        statusLabel={totalRecords === 0 ? 'No records yet'
          : `${totalRecords.toLocaleString()} captured`}
        subtitle={
          <>
            <span>Data captured locally and tracked by DER.</span>
            {totalPending > 0 && (<>
              <span>·</span>
              <span>Waiting to send <strong style={{ color: 'var(--der-ink-900)' }}>{totalPending.toLocaleString()}</strong></span>
            </>)}
            {drafts !== null && drafts > 0 && (<>
              <span>·</span>
              <span>Drafts <Link to="/data/drafts">{drafts.toLocaleString()}</Link></span>
            </>)}
          </>
        }
      />

      <OuPicker ctx={ctx} />

      <SplitWithDrawer
        drawerOpen={!!sel}
        main={
          <Panel title="Captured data by type"
                 action={
                   <Link to="/sync/data" className="ea-link-btn" style={{ fontSize: 12 }}>
                     Open full records view →
                   </Link>
                 }>
            <div className="ea-table-wrap">
              <table className="ea-table ea-table--dense ea-table--selectable">
                <thead><tr>
                  <th style={{ width: 32 }}></th>
                  <th>Data type</th>
                  <th style={{ width: 110 }}>Records</th>
                  <th style={{ width: 110 }}>Waiting to send</th>
                  <th style={{ width: 140 }}>Last activity</th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={sel?.id === r.id ? 'ea-row--active' : ''}
                        onClick={() => setSel(r)}>
                      <td style={{ fontSize: 16, textAlign: 'center' }} aria-hidden="true"
                          title={r.type}>
                        {entityTypeIcon(r.typeKey)}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--der-ink-900)' }}>{r.type}</div>
                        <div className="ea-text-muted ea-mono" style={{ fontSize: 10 }}>
                          {r.typeKey}
                        </div>
                      </td>
                      <td className="ea-mono">{r.values.toLocaleString()}</td>
                      <td>
                        {r.pending === 0 ? (
                          <span className="ea-text-muted">—</span>
                        ) : (
                          <span className="ea-chip ea-chip--warning">{r.pending.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="ea-text-muted" style={{ fontSize: 12 }}
                          title={fmtDate(r.updated)}>{fmtAgo(r.updated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        }
        drawer={
          sel ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 28, lineHeight: 1 }} aria-hidden="true">
                  {entityTypeIcon(sel.typeKey)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{sel.type}</h3>
                  <div className="ea-text-muted ea-mono" style={{ fontSize: 10, marginTop: 2 }}>
                    {sel.typeKey}
                  </div>
                </div>
              </div>
              <dl className="ea-def-list">
                <div className="ea-def-row"><dt>Records</dt>
                  <dd className="ea-mono">{sel.values.toLocaleString()}</dd></div>
                <div className="ea-def-row"><dt>Waiting to send</dt>
                  <dd className="ea-mono">{sel.pending.toLocaleString()}</dd></div>
                <div className="ea-def-row"><dt>Last activity</dt>
                  <dd className="ea-mono">{fmtDate(sel.updated)}</dd></div>
              </dl>
              <h4 style={{ margin: '14px 0 6px', fontSize: 11, fontWeight: 600,
                           letterSpacing: '0.02em', textTransform: 'uppercase',
                           color: 'var(--der-ink-400)' }}>
                Open in
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Link to="/sync/data" className="ea-btn ea-btn--primary"
                      style={{ textAlign: 'center' }}>
                  View records
                </Link>
                {(sel.typeKey === 'AGGREGATE_DATA_VALUE') && (
                  <Link to="/data/aggregate" className="ea-btn ea-btn--ghost"
                        style={{ textAlign: 'center' }}>Open aggregate capture ↗</Link>
                )}
                {(sel.typeKey === 'EVENT' || sel.typeKey === 'PROGRAM_STAGE_EVENT') && (
                  <Link to="/data/events" className="ea-btn ea-btn--ghost"
                        style={{ textAlign: 'center' }}>Open event capture ↗</Link>
                )}
                {(sel.typeKey === 'TRACKED_ENTITY' || sel.typeKey === 'ENROLLMENT') && (
                  <Link to="/data/tracker" className="ea-btn ea-btn--ghost"
                        style={{ textAlign: 'center' }}>Open tracker capture ↗</Link>
                )}
              </div>
            </>
          ) : (
            <p className="ea-text-muted" style={{ margin: 0 }}>
              Select a data type to see where it was captured and what's waiting to send.
            </p>
          )
        }
      />
    </div>
  );
}
