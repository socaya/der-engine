import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import {
  OuPicker, useOuContext, Panel, fmtDate, fmtAgo,
  SyncStatusBar, entityTypeIcon, entityTypeLabel, RowMenu,
  type RowMenuItem,
} from './shared';
import { LoadingBlock } from '../components/ScreenStates';
import { UiIcon } from '../components/UiIcon';

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
  const navigate = useNavigate();
  const [ctx] = useOuContext();
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [stats, setStats] = useState<edgeApi.JournalStatsByType | null>(null);
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);
  const [drafts, setDrafts] = useState<number | null>(null);

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
              <th>Backend key</th>
              <th style={{ width: 110 }}>Records</th>
              <th style={{ width: 140 }}>Waiting to send</th>
              <th style={{ width: 140 }}>Last activity</th>
              <th style={{ width: 48 }} aria-label="Actions"></th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}
                    onClick={() => navigate(`/sync/data?type=${encodeURIComponent(r.typeKey)}`)}
                    data-test={`data-type-row-${r.typeKey}`}>
                  <td style={{ textAlign: 'center', color: 'var(--der-ink-500)' }} aria-hidden="true"
                      title={r.type}>
                    <UiIcon icon={entityTypeIcon(r.typeKey)} size={18} />
                  </td>
                  <td style={{ fontWeight: 500 }}>{r.type}</td>
                  <td className="ea-text-muted ea-mono" style={{ fontSize: 13 }}>{r.typeKey}</td>
                  <td className="ea-mono">{r.values.toLocaleString()}</td>
                  <td>
                    {r.pending === 0 ? (
                      <span className="ea-text-muted">—</span>
                    ) : (
                      <span className="ea-chip ea-chip--warning">{r.pending.toLocaleString()}</span>
                    )}
                  </td>
                  <td className="ea-text-muted"
                      title={fmtDate(r.updated)}>{fmtAgo(r.updated)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <RowMenu items={rowMenuForType(r.typeKey)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function rowMenuForType(typeKey: string): ReadonlyArray<RowMenuItem> {
  const items: RowMenuItem[] = [
    { label: 'Open records', to: `/sync/data?type=${encodeURIComponent(typeKey)}` },
  ];
  if (typeKey === 'AGGREGATE_DATA_VALUE') {
    items.push({ label: 'Open aggregate capture', to: '/data/aggregate' });
  } else if (typeKey === 'EVENT' || typeKey === 'PROGRAM_STAGE_EVENT') {
    items.push({ label: 'Open event capture', to: '/data/events' });
  } else if (typeKey === 'TRACKED_ENTITY' || typeKey === 'ENROLLMENT') {
    items.push({ label: 'Open tracker capture', to: '/data/tracker' });
  }
  return items;
}
