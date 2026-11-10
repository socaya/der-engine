import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { Panel, fmtDate, fmtAgo, usePaged, TablePager, entityTypeIcon, entityTypeLabel, SyncStatusBar, BackLink, RowMenu, confirmThenRun } from '../shared';
import { UiIcon } from '../../components/UiIcon';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

export function ApprovalQueue(): JSX.Element {
  const navigate = useNavigate();
  const [rows, setRows] = useState<edgeApi.PendingApprovalRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function reload(): Promise<void> {
    try { setRows((await edgeApi.listPendingApprovals(100)).rows); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  async function approveId(id: string): Promise<void> {
    try { await edgeApi.approveOperation(id); await reload(); } catch { /* ignore */ }
  }
  const paged = usePaged(rows ?? [], 25);
  if (err) return <ErrorBlock title="Approvals failed" testId="err-approvals">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;

  return (
    <div className="ea-screen">
      <SyncStatusBar
        tone={rows.length === 0 ? 'success' : 'warning'}
        title="Approvals"
        statusLabel={rows.length === 0 ? 'All clear' : `${rows.length} pending`}
      />
      <Panel title={rows.length === 0 ? 'All clear' : `${rows.length} pending`}>
        {rows.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>
            No records are waiting for an approval decision.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense ea-table--selectable" style={{ width: '100%' }}>
              <thead><tr>
                <th style={{ width: 32 }}></th>
                <th>Record type</th>
                <th>Record ID</th>
                <th>Submitted by</th>
                <th style={{ width: 110 }}>Submitted</th>
                <th style={{ width: 48 }} aria-label="Actions"></th>
              </tr></thead>
              <tbody>
                {paged.rows.map((r) => (
                  <tr key={r.operationId}
                      onClick={() => navigate(`/approvals/${r.operationId}`)}>
                    <td style={{ textAlign: 'center', color: 'var(--der-ink-500)' }} aria-hidden="true"
                        title={entityTypeLabel(r.entityType)}>
                      <UiIcon icon={entityTypeIcon(r.entityType)} size={18} />
                    </td>
                    <td style={{ fontWeight: 500 }}>{entityTypeLabel(r.entityType)}</td>
                    <td className="ea-text-muted ea-mono" style={{ fontSize: 13 }}>{r.entityRef}</td>
                    <td>{r.submittedBy ?? '—'}</td>
                    <td className="ea-text-muted"
                        title={r.createdAt ? fmtDate(r.createdAt) : ''}>
                      {r.createdAt ? fmtAgo(r.createdAt) : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <RowMenu items={[
                        { label: 'Open details', to: `/approvals/${r.operationId}` },
                        { label: 'Approve',
                          onSelect: () => {
                            confirmThenRun(
                              `Approve the ${entityTypeLabel(r.entityType)} "${r.entityRef}"? It will be queued for sync to Central DHIS2.`,
                              () => { approveId(r.operationId).catch(() => undefined); });
                          } },
                        { label: 'Reject with reason…', danger: true,
                          /* V045 — rejection reason is mandatory. Open the
                             detail page where the operator must enter one. */
                          to: `/approvals/${r.operationId}` },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePager {...paged.pagerProps} />
          </div>
        )}
      </Panel>
    </div>
  );
}

/** `/admin/approvals/:operationId` */
export function ApprovalDetail(): JSX.Element {
  const { operationId } = useParams<{ operationId: string }>();
  const navigate = useNavigate();
  const [row, setRow] = useState<edgeApi.PendingApprovalRow | null>(null);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const all = (await edgeApi.listPendingApprovals(500)).rows;
        const match = all.find((r) => r.operationId === operationId);
        if (!match) { setErr('Approval item not found.'); return; }
        setRow(match);
      } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    })();
  }, [operationId]);
  async function approve(): Promise<void> {
    if (!row) return;
    try { await edgeApi.approveOperation(row.operationId); navigate('/approvals'); } catch { /* ignore */ }
  }
  async function reject(): Promise<void> {
    if (!row) return;
    if (reason.trim() === '') {
      setErr('A rejection reason is required.');
      return;
    }
    try {
      await edgeApi.rejectOperation(row.operationId, reason.trim());
      navigate('/approvals');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }
  if (err) return (
    <div className="ea-screen">
      <BackLink to="/approvals" label="Back to approvals" />
      <SyncStatusBar tone="danger" title="Not found" statusLabel="Error"
                     subtitle={<span>{err}</span>} />
    </div>
  );
  if (!row) return <LoadingBlock testId="loading" />;
  return (
    <div className="ea-screen">
      <BackLink to="/approvals" label="Back to approvals" />
      <SyncStatusBar
        tone="warning"
        title={`${entityTypeLabel(row.entityType)} · ${row.entityRef}`}
        statusLabel="Pending approval"
        subtitle={<span>Submitted by <strong style={{ color: 'var(--der-ink-900)' }}>{row.submittedBy ?? 'unknown'}</strong>{row.createdAt && <> · {fmtDate(row.createdAt)}</>}</span>}
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                    onClick={() => {
                      confirmThenRun(
                        `Approve ${entityTypeLabel(row.entityType)} "${row.entityRef}"? It will be queued for sync to Central DHIS2.`,
                        () => { approve().catch(() => undefined); });
                    }}>Approve</button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm ea-btn--danger"
                    disabled={reason.trim() === ''}
                    data-test="btn-reject"
                    title={reason.trim() === '' ? 'Enter a rejection reason below first' : ''}
                    onClick={() => {
                      confirmThenRun(
                        `Reject ${entityTypeLabel(row.entityType)} "${row.entityRef}"? The record will not be sent to Central DHIS2.`,
                        () => { reject().catch(() => undefined); });
                    }}>Reject</button>
            {/* §2.3.109 R-AD — labelled cross-module drill. Operators
                were previously approving/rejecting records they
                couldn't inspect. Route per entity type where a
                dedicated page exists; fall back to /data/queue for
                enrolment / stage-event where there's no dedicated
                route today. "Data › " prefix discloses the module
                boundary per the R-AB rule. */}
            {(() => {
              const et = row.entityType;
              const ref = row.entityRef;
              /* Phase 07.3 — PROGRAM_STAGE_EVENT and EVENT share
               * the same /data/events detail route (both keyed on
               * event UID); AGGREGATE_DATA_VALUE's entityRef is a
               * compound key not a valueId, so it still falls back
               * to /data/queue/{operationId}. ENROLLMENT has no
               * dedicated detail page today — queue fallback until
               * Phase 10 ships an enrolment route. */
              const to
                = et === 'EVENT'              ? `/data/events/${ref}`
                : et === 'PROGRAM_STAGE_EVENT' ? `/data/events/${ref}`
                : et === 'TRACKED_ENTITY'     ? `/data/tracker/tei/${ref}`
                :                               `/data/queue/${row.operationId}`;
              const label
                = et === 'EVENT'          ? 'Event'
                : et === 'TRACKED_ENTITY' ? 'Tracked entity'
                : et === 'ENROLLMENT'     ? 'Enrolment'
                : et === 'PROGRAM_STAGE_EVENT' ? 'Stage event'
                : et === 'AGGREGATE_DATA_VALUE' ? 'Data value'
                :                                'Operation';
              return (
                <Link to={to}
                       className="ea-btn ea-btn--ghost ea-btn--sm"
                       title={`Open the ${label.toLowerCase()} in the Data module`}
                       data-test="approval-view-record"
                       data-cross-module="Data">
                  Data › View {label.toLowerCase()} ↗
                </Link>
              );
            })()}
          </>
        }
      />
      <Panel title="Record">
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>Entity type</dt>
            <dd>{entityTypeLabel(row.entityType)} <span className="ea-mono ea-text-muted">({row.entityType})</span></dd></div>
          <div className="ea-def-row"><dt>Entity ref</dt><dd className="ea-mono">{row.entityRef}</dd></div>
          <div className="ea-def-row"><dt>Submitted by</dt><dd>{row.submittedBy ?? '—'}</dd></div>
          <div className="ea-def-row"><dt>Submitted</dt>
            <dd className="ea-mono">{row.createdAt ? fmtDate(row.createdAt) : '—'}</dd></div>
          {row.createdAt && <div className="ea-def-row"><dt>Age</dt><dd>{fmtAgo(row.createdAt)}</dd></div>}
          <div className="ea-def-row"><dt>Operation ID</dt>
            <dd className="ea-mono" style={{ fontSize: 10 }}>{row.operationId}</dd></div>
        </dl>
      </Panel>
      <Panel title="Rejection reason (required to reject)">
        <input className="ea-input" value={reason}
               data-test="input-reject-reason"
               style={{ width: '100%', maxWidth: 500 }}
               placeholder="Why is this being rejected?"
               onChange={(e) => setReason(e.target.value)} />
        {err && <p className="ea-text-danger" style={{ marginTop: 6, fontSize: 12 }}
                   data-test="err-reject">{err}</p>}
      </Panel>
    </div>
  );
}

