import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';
import { MetadataTabBar } from '../../components/MetadataTabBar';
import { Panel, RowMenu, Status, usePaged, TablePager } from '../shared';

/**
 * §37–§42 — metadata snapshot browser. Each snapshot is the atomic
 * unit a workflow can pin itself to; the list exposes retire /
 * reinstate for stale snapshots and shows how many workflows still
 * reference each one.
 *
 * Phase-4B: compacted to the standard DER Soft UI table pattern —
 * single-line rows via `.ea-table--nowrap`, single-row filter bar
 * (status select), per-row context actions via `RowMenu` instead of
 * inline Retire/Reinstate buttons, pagination via `usePaged` +
 * `TablePager`.
 */
export interface SnapshotListProps {
  api?: Pick<typeof edgeApi, 'listSnapshots' | 'retireSnapshot' | 'reinstateSnapshot'>;
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'RETIRED';

export function SnapshotList({ api = edgeApi }:
    SnapshotListProps = {}): JSX.Element {
  const [snapshots, setSnapshots] = useState<edgeApi.MetadataSnapshot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  async function reload(): Promise<void> {
    try {
      const r = await api.listSnapshots();
      setSnapshots(r.snapshots);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    reload().catch(() => undefined);
    // Why: reload closes over state; re-run only when api changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  async function doRetire(id: number): Promise<void> {
    setBusyId(id);
    try {
      await api.retireSnapshot(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function doReinstate(id: number): Promise<void> {
    setBusyId(id);
    try {
      await api.reinstateSnapshot(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  const filtered = (snapshots ?? []).filter((s) => {
    if (statusFilter === 'ACTIVE') return s.status === 'ACTIVE';
    if (statusFilter === 'RETIRED') return s.status === 'RETIRED';
    return true;
  });
  const paged = usePaged(filtered, 25);

  if (error) {
    return <ErrorBlock title="Snapshots load failed"
                        testId="snapshots-error">{error}</ErrorBlock>;
  }
  if (snapshots == null) {
    return <LoadingBlock testId="snapshots-loading" />;
  }

  const latest = snapshots[0];
  const counts = {
    all: snapshots.length,
    active: snapshots.filter((s) => s.status === 'ACTIVE').length,
    retired: snapshots.filter((s) => s.status === 'RETIRED').length,
  };

  return (
    <div className="ea-screen" data-test="snapshots-root">
      <MetadataTabBar />
      <PageHeader title="Metadata snapshots" />
      <h1 className="ea-visually-hidden" data-test="snapshots-heading">Snapshots</h1>

      <Panel title={`${filtered.length} snapshot${filtered.length === 1 ? '' : 's'}`}
             action={
               <div className="ea-data-filterbar" role="group" aria-label="Filters">
                 <select className="ea-input ea-input--compact"
                         value={statusFilter}
                         onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                         data-test="snapshots-filter"
                         aria-label="Filter snapshots by status">
                   <option value="ALL">All statuses ({counts.all})</option>
                   <option value="ACTIVE">Active ({counts.active})</option>
                   <option value="RETIRED">Retired ({counts.retired})</option>
                 </select>
               </div>
             }>
        {filtered.length === 0 ? (
          <p className="ea-text-muted" data-test="snapshots-empty">
            {snapshots.length === 0
              ? 'No snapshots yet. Trigger a metadata sync to create one.'
              : 'No snapshots match this filter.'}
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense ea-table--selectable ea-table--nowrap"
                   data-test="snapshots-table">
              <thead>
                <tr>
                  <th className="ea-col-w-110">Snapshot</th>
                  <th>Source</th>
                  <th className="ea-col-w-110">Central</th>
                  <th className="ea-col-w-90 ea-text-right">Rows</th>
                  <th className="ea-col-w-110">Pinned</th>
                  <th className="ea-col-w-100">Status</th>
                  <th className="ea-col-w-110">Compare</th>
                  <th className="ea-col-w-140 ea-text-right">Imported</th>
                  <th className="ea-col-w-48" aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {paged.rows.map((s) => {
                  const totalCount = s.counts.organisationUnits + s.counts.dataElements
                    + s.counts.dataSets + s.counts.programs + s.counts.trackedEntityTypes;
                  const host = (() => {
                    try { return new URL(s.importedFrom).host; } catch { return '—'; }
                  })();
                  return (
                    <tr key={s.snapshotId}
                         data-test={`snapshot-row-${s.snapshotId}`}
                         className={s.status === 'RETIRED' ? 'is-dim' : ''}>
                      <td title={s.fingerprint ?? ''}>
                        <strong>#{s.snapshotId}</strong>{' '}
                        {s.fingerprint && (
                          <span className="ea-text-muted ea-mono ea-text-2xs">
                            {s.fingerprint.slice(0, 7)}
                          </span>
                        )}
                      </td>
                      <td className="ea-mono ea-text-xs" title={s.importedFrom}>
                        {host}
                      </td>
                      <td className="ea-mono ea-text-xs">
                        {s.centralVersion ?? '—'}
                      </td>
                      <td className="ea-mono ea-text-right">
                        {totalCount.toLocaleString()}
                      </td>
                      <td>
                        {s.pinnedWorkflows > 0 ? (
                          <span data-test={`snapshot-row-${s.snapshotId}-pinned`}>
                            {s.pinnedWorkflows} workflow{s.pinnedWorkflows === 1 ? '' : 's'}
                          </span>
                        ) : (
                          <span className="ea-text-muted ea-text-xs">—</span>
                        )}
                      </td>
                      <td>
                        <Status tone={s.status === 'ACTIVE' ? 'success' : 'muted'}>
                          {s.status === 'ACTIVE' ? 'Active' : 'Retired'}
                        </Status>
                      </td>
                      <td>
                        {latest && s.snapshotId !== latest.snapshotId && (
                          <Link to={`/metadata/snapshots/${s.snapshotId}/diff/${latest.snapshotId}`}
                                 className="ea-sync-path-link ea-text-xs"
                                 data-test={`snapshot-row-${s.snapshotId}-diff`}>
                            vs #{latest.snapshotId}
                          </Link>
                        )}
                      </td>
                      <td className="ea-mono ea-text-xs ea-text-right"
                          title={s.importedAt}>
                        {new Date(s.importedAt).toLocaleDateString()}
                      </td>
                      <td className="ea-text-right">
                        <RowMenu items={
                          s.status === 'ACTIVE'
                            ? [{
                                label: 'Retire snapshot',
                                danger: s.pinnedWorkflows > 0,
                                disabled: busyId === s.snapshotId || s.pinnedWorkflows > 0,
                                onSelect: () => { void doRetire(s.snapshotId); },
                                dataTest: `snapshot-row-${s.snapshotId}-retire`,
                              }]
                            : [{
                                label: 'Reinstate snapshot',
                                disabled: busyId === s.snapshotId,
                                onSelect: () => { void doReinstate(s.snapshotId); },
                                dataTest: `snapshot-row-${s.snapshotId}-reinstate`,
                              }]
                        } />
                        {busyId === s.snapshotId && (
                          <span className="ea-text-muted ea-text-2xs">…</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePager {...paged.pagerProps} />
          </div>
        )}
      </Panel>
    </div>
  );
}
