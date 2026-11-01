import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

/**
 * §37–§42 — metadata snapshot browser. Each snapshot is the atomic
 * unit a workflow can pin itself to; the list exposes retire /
 * reinstate for stale snapshots and shows how many workflows still
 * reference each one.
 */
export interface SnapshotListProps {
  api?: Pick<typeof edgeApi, 'listSnapshots' | 'retireSnapshot' | 'reinstateSnapshot'>;
}

export function SnapshotList({ api = edgeApi }:
    SnapshotListProps = {}): JSX.Element {
  const [snapshots, setSnapshots] = useState<edgeApi.MetadataSnapshot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

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

  if (error) {
    return <ErrorBlock title="Snapshots load failed"
                        testId="snapshots-error">{error}</ErrorBlock>;
  }
  if (snapshots == null) {
    return <LoadingBlock testId="snapshots-loading" />;
  }

  const latest = snapshots[0];
  return (
    <div className="ea-screen" data-test="snapshots-root">
      <header className="ea-screen-header">
        <div className="ea-screen-header-text">
          <h1 data-test="snapshots-heading">Snapshots</h1>
        </div>
      </header>

      <table className="ea-table ea-table--dense" data-test="snapshots-table">
        <thead>
          <tr>
            <th>Snapshot</th>
            <th>Imported</th>
            <th>Central</th>
            <th>Rows</th>
            <th>Pinned</th>
            <th>Status</th>
            <th>Compare</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {snapshots.map((s) => {
            const totalCount = s.counts.organisationUnits + s.counts.dataElements
              + s.counts.dataSets + s.counts.programs + s.counts.trackedEntityTypes;
            return (
              <tr key={s.snapshotId}
                   data-test={`snapshot-row-${s.snapshotId}`}
                   className={s.status === 'RETIRED' ? 'is-dim' : ''}>
                <td>
                  <strong>#{s.snapshotId}</strong>
                  {s.fingerprint && (
                    <div className="ea-text-muted ea-mono" style={{ fontSize: 11 }}>
                      {s.fingerprint.slice(0, 12)}…
                    </div>
                  )}
                </td>
                <td>
                  <div>{new Date(s.importedAt).toLocaleString()}</div>
                  <div className="ea-text-muted" style={{ fontSize: 12 }}>
                    from {new URL(s.importedFrom).host}
                  </div>
                </td>
                <td className="ea-mono" style={{ fontSize: 12 }}>
                  {s.centralVersion ?? '—'}
                  {s.centralRevision && (
                    <div className="ea-text-muted">{s.centralRevision.slice(0, 7)}</div>
                  )}
                </td>
                <td>{totalCount.toLocaleString()}</td>
                <td>
                  {s.pinnedWorkflows > 0 ? (
                    <span data-test={`snapshot-row-${s.snapshotId}-pinned`}>
                      {s.pinnedWorkflows} workflow{s.pinnedWorkflows === 1 ? '' : 's'}
                    </span>
                  ) : (
                    <span className="ea-text-muted" style={{ fontSize: 12 }}>—</span>
                  )}
                </td>
                <td>
                  <span className={`ea-pill ea-pill--${s.status === 'ACTIVE' ? 'success' : 'muted'}`}>
                    {s.status === 'ACTIVE' ? 'Active' : 'Retired'}
                  </span>
                </td>
                <td>
                  {latest && s.snapshotId !== latest.snapshotId && (
                    <Link to={`/metadata/snapshots/${s.snapshotId}/diff/${latest.snapshotId}`}
                           className="ea-link-btn" style={{ fontSize: 12 }}
                           data-test={`snapshot-row-${s.snapshotId}-diff`}>
                      vs #{latest.snapshotId}
                    </Link>
                  )}
                </td>
                <td>
                  {s.status === 'ACTIVE' ? (
                    <button type="button"
                             className="ea-btn ea-btn--ghost ea-btn--sm"
                             data-test={`snapshot-row-${s.snapshotId}-retire`}
                             disabled={busyId === s.snapshotId || s.pinnedWorkflows > 0}
                             onClick={() => { doRetire(s.snapshotId).catch(() => undefined); }}>
                      Retire
                    </button>
                  ) : (
                    <button type="button"
                             className="ea-btn ea-btn--ghost ea-btn--sm"
                             data-test={`snapshot-row-${s.snapshotId}-reinstate`}
                             disabled={busyId === s.snapshotId}
                             onClick={() => { doReinstate(s.snapshotId).catch(() => undefined); }}>
                      Reinstate
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {snapshots.length === 0 && (
        <p className="ea-text-muted">
          No snapshots yet. Trigger a metadata sync to create one.
        </p>
      )}
    </div>
  );
}
