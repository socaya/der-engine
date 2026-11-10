import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { Panel, fmtDate, fmtAgo, usePaged, TablePager, entityTypeIcon, entityTypeLabel, ScopedFilterChip, SyncStatusBar, RowMenu, confirmThenRun } from '../shared';
import { UiIcon } from '../../components/UiIcon';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';
import { PolicyPausedBanner } from '../../components/PolicyPausedBanner';

/** DER Sync requirements §9. "Needs your attention" consolidates
 *  conflicts, rejected records and repeated failures into one list
 *  with a plain-English problem description + priority chip. */
export function problemFor(r: edgeApi.ConflictRow): { label: string; summary: string } {
  const s = (r.state ?? '').toUpperCase();
  if (s === 'CONFLICT_REVIEW') return {
    label: 'Record changed on both sides',
    summary: 'This record was changed locally while the same record was also changed in Central DHIS2.',
  };
  if (s === 'CENTRAL_REJECTED') return {
    label: 'Rejected by Central DHIS2',
    summary: 'Central DHIS2 rejected this record. Review the response and either accept the local version or re-capture.',
  };
  if (s === 'RETRYABLE' && r.attemptCount >= 5) return {
    label: 'Repeated sync failure',
    summary: `This record has failed ${r.attemptCount} sync attempts and is now waiting for operator review.`,
  };
  if (s === 'UNKNOWN_OUTCOME') return {
    label: 'Unconfirmed acknowledgement',
    summary: 'DER could not confirm whether Central DHIS2 accepted this record. It will be verified on the next attempt.',
  };
  return {
    label: 'Needs review',
    summary: 'This record did not synchronise automatically. Review and choose how to resolve it.',
  };
}

export function priorityFor(r: edgeApi.ConflictRow): 'High' | 'Medium' | 'Low' {
  if (r.attemptCount >= 5) return 'High';
  if (r.attemptCount >= 2) return 'Medium';
  return 'Low';
}

export function ConflictList(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const workflowRunId = searchParams.get('workflowRunId');
  const [rows, setRows] = useState<edgeApi.ConflictRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function reload(): Promise<void> {
    try { setRows(await edgeApi.listConflicts(100)); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  async function resolveFor(id: string, outcome: 'ACCEPTED' | 'REJECTED'): Promise<void> {
    try { await edgeApi.resolveConflict(id, outcome); await reload(); }
    catch { /* ignore */ }
  }

  const paged = usePaged(rows ?? [], 50);

  if (err) return <ErrorBlock title="Attention list failed" testId="err-conflicts">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;

  return (
    <div className="ea-screen">
      <PolicyPausedBanner />
      {workflowRunId && (
        <ScopedFilterChip
          label={`Workflow run ${workflowRunId.slice(0, 8)}`}
          openTo={`/workflows/monitoring/runs/${encodeURIComponent(workflowRunId)}`}
          openLabel="Open run"
          onClear={() => {
            const next = new URLSearchParams(searchParams);
            next.delete('workflowRunId');
            setSearchParams(next, { replace: true });
          }}
          hint="Row-level filtering lands with R-A-data (operation_journal.workflow_run_id)."
        />
      )}
      <SyncStatusBar
        tone={rows.length === 0 ? 'success' : 'warning'}
        title="Needs your attention"
        statusLabel={rows.length === 0 ? 'All clear' : `${rows.length} item${rows.length === 1 ? '' : 's'}`}
      />

      <Panel title={rows.length === 0 ? 'All clear' : `${rows.length} attention item${rows.length === 1 ? '' : 's'}`}>
        {rows.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>
            Every captured record either reached Central DHIS2 or is still safely queued.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense ea-table--selectable" style={{ width: '100%' }}>
              <thead><tr>
                <th style={{ width: 32 }}></th>
                <th>Record type</th>
                <th>Record ID</th>
                <th>Problem</th>
                <th>Why</th>
                <th style={{ width: 90 }}>Priority</th>
                <th style={{ width: 90 }}>Since</th>
                <th style={{ width: 48 }} aria-label="Actions"></th>
              </tr></thead>
              <tbody>
                {paged.rows.map((r) => {
                  const problem = problemFor(r);
                  const prio = priorityFor(r);
                  return (
                    <tr key={r.operationId}
                        onClick={() => navigate(`/sync/attention/${r.operationId}`)}
                        data-test={`ea13-row-${r.operationId}`}>
                      <td style={{ textAlign: 'center', color: 'var(--der-ink-500)' }} aria-hidden="true"
                          title={entityTypeLabel(r.entityType)}>
                        <UiIcon icon={entityTypeIcon(r.entityType)} size={18} />
                      </td>
                      <td style={{ fontWeight: 500 }}>{entityTypeLabel(r.entityType)}</td>
                      <td className="ea-text-muted ea-mono" style={{ fontSize: 13 }}>{r.entityRef}</td>
                      <td style={{ fontWeight: 500 }}>{problem.label}</td>
                      <td className="ea-text-muted">{problem.summary}</td>
                      <td>
                        <span className={'ea-chip ea-chip--'
                            + (prio === 'High' ? 'danger' : prio === 'Medium' ? 'warning' : 'info')}>
                          {prio}
                        </span>
                      </td>
                      <td className="ea-text-muted" style={{ fontSize: 12 }}
                          title={fmtDate(r.createdAt)}>{fmtAgo(r.createdAt)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <RowMenu items={[
                          { label: 'Open details', to: `/sync/attention/${r.operationId}` },
                          { label: 'Accept local version',
                            onSelect: () => {
                              confirmThenRun(
                                `Accept the local version of ${entityTypeLabel(r.entityType)} "${r.entityRef}" and send it to Central DHIS2?`,
                                () => { resolveFor(r.operationId, 'ACCEPTED').catch(() => undefined); });
                            } },
                          { label: 'Reject local version', danger: true,
                            onSelect: () => {
                              confirmThenRun(
                                `Reject the local version of ${entityTypeLabel(r.entityType)} "${r.entityRef}"? The local change will be dropped.`,
                                () => { resolveFor(r.operationId, 'REJECTED').catch(() => undefined); });
                            } },
                        ]} />
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

/** `/admin/sync/attention/:operationId` */

