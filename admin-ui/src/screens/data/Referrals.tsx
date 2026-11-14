import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { Panel, fmtDate, fmtAgo, usePaged, TablePager, humaniseState, entityTypeIcon, entityTypeLabel, SyncStatusBar, BackLink, RowMenu, confirmThenRun, Status } from '../shared';
import { UiIcon } from '../../components/UiIcon';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

export function ReferralInbox(): JSX.Element {
  const navigate = useNavigate();
  const [rows, setRows] = useState<edgeApi.ReferralInboxRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function reload(): Promise<void> {
    try { setRows((await edgeApi.listReferralInbox(100)).entries); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  async function acceptId(id: string): Promise<void> {
    try { await edgeApi.acceptReferralInbox(id); await reload(); }
    catch (e) {
      /* V045 — surface 503 INGEST_UNAVAILABLE + 502 INGEST_FAILED/REJECTED. */
      setErr(e instanceof Error ? e.message : String(e));
    }
  }
  async function dismissId(id: string): Promise<void> {
    try { await edgeApi.dismissReferralInbox(id); await reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  const paged = usePaged(rows ?? [], 25);
  if (err) return <ErrorBlock title="Inbox failed" testId="err-inbox">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;

  const pending = rows.filter((r) => r.status === 'PENDING').length;
  const accepted = rows.filter((r) => r.status === 'ACCEPTED').length;
  return (
    <div className="ea-screen">
      <SyncStatusBar
        tone={pending > 0 ? 'warning' : rows.length === 0 ? 'muted' : 'success'}
        title="Referral inbox"
        statusLabel={pending > 0 ? `${pending} pending` : rows.length === 0 ? 'Inbox empty' : 'All handled'}
        subtitle={
          <>
            <span>Referrals from the central hub awaiting local handling.</span>
            <span>·</span>
            <span>Total <strong>{rows.length}</strong></span>
            {accepted > 0 && (<><span>·</span><span>Accepted <strong>{accepted}</strong></span></>)}
          </>
        }
      />
      <Panel title={rows.length === 0 ? 'Inbox empty' : `${rows.length} referral${rows.length === 1 ? '' : 's'}`}>
        {rows.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>
            No referrals have been received by this edge yet.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense ea-table--selectable" style={{ width: '100%' }}>
              <thead><tr>
                <th style={{ width: 32 }}></th>
                <th>Kind</th>
                <th>Source ref</th>
                <th style={{ width: 110 }}>Received</th>
                <th style={{ width: 150 }}>Status</th>
                <th style={{ width: 48 }} aria-label="Actions"></th>
              </tr></thead>
              <tbody>
                {paged.rows.map((r) => (
                  <tr key={r.inboxId}
                      onClick={() => navigate(`/referral/inbox/${r.inboxId}`)}>
                    <td style={{ textAlign: 'center', color: 'var(--der-ink-500)' }} aria-hidden="true"
                        title={entityTypeLabel(r.kind)}>
                      <UiIcon icon={entityTypeIcon(r.kind)} size={18} />
                    </td>
                    <td style={{ fontWeight: 500 }}>{entityTypeLabel(r.kind)}</td>
                    <td className="ea-text-muted ea-mono" style={{ fontSize: 13 }}>{r.sourceRef}</td>
                    <td className="ea-text-muted"
                        title={fmtDate(r.discoveredAt)}>{fmtAgo(r.discoveredAt)}</td>
                    <td>
                      <Status tone={
                        r.status === 'ACCEPTED' ? 'success'
                        : r.status === 'DISMISSED' ? 'muted' : 'warning'} title={r.status}>
                        {humaniseState(r.status)}
                      </Status>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <RowMenu items={[
                        { label: 'Open details', to: `/referral/inbox/${r.inboxId}` },
                        ...(r.status === 'PENDING' ? [
                          { label: 'Accept referral',
                            onSelect: () => {
                              confirmThenRun(
                                `Accept the referral "${r.sourceRef}" and import it locally?`,
                                () => { acceptId(r.inboxId).catch(() => undefined); });
                            } },
                          { label: 'Dismiss', danger: true,
                            onSelect: () => {
                              confirmThenRun(
                                `Dismiss the referral "${r.sourceRef}"? It will be marked as handled on this edge.`,
                                () => { dismissId(r.inboxId).catch(() => undefined); });
                            } },
                        ] : []),
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

/** `/admin/referral/inbox/:inboxId` */
export function ReferralDetail(): JSX.Element {
  const { inboxId } = useParams<{ inboxId: string }>();
  const navigate = useNavigate();
  const [row, setRow] = useState<edgeApi.ReferralInboxRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const all = (await edgeApi.listReferralInbox(500)).entries;
        const match = all.find((r) => r.inboxId === inboxId);
        if (!match) { setErr('Referral not found.'); return; }
        setRow(match);
      } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    })();
  }, [inboxId]);
  async function accept(): Promise<void> {
    if (!row) return;
    try { await edgeApi.acceptReferralInbox(row.inboxId); navigate('/referral/inbox'); }
    catch (e) {
      /* V045 — ingest can now fail loud; show the server message instead
         of silently swallowing. */
      setErr(e instanceof Error ? e.message : String(e));
    }
  }
  async function dismiss(): Promise<void> {
    if (!row) return;
    try { await edgeApi.dismissReferralInbox(row.inboxId); navigate('/referral/inbox'); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  if (err) return (
    <div className="ea-screen">
      <BackLink to="/referral/inbox" label="Back to referral inbox" />
      <SyncStatusBar tone="danger" title="Not found" statusLabel="Error"
                     subtitle={<span>{err}</span>} />
    </div>
  );
  if (!row) return <LoadingBlock testId="loading" />;
  return (
    <div className="ea-screen">
      <BackLink to="/referral/inbox" label="Back to referral inbox" />
      <SyncStatusBar
        tone={row.status === 'PENDING' ? 'warning' : row.status === 'ACCEPTED' ? 'success' : 'muted'}
        title={`${entityTypeLabel(row.kind)} · ${row.sourceRef}`}
        statusLabel={humaniseState(row.status)}
        subtitle={<span>Received {fmtDate(row.discoveredAt)} · {fmtAgo(row.discoveredAt)}</span>}
        actions={
          <>
            {row.status === 'PENDING' && (
              <>
                <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                        onClick={() => {
                          confirmThenRun(
                            `Accept referral "${row.sourceRef}" and import it locally?`,
                            () => { accept().catch(() => undefined); });
                        }}>Accept referral</button>
                <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm ea-btn--danger"
                        onClick={() => {
                          confirmThenRun(
                            `Dismiss referral "${row.sourceRef}"? It will be marked as handled on this edge.`,
                            () => { dismiss().catch(() => undefined); });
                        }}>Dismiss</button>
              </>
            )}
            {/* §2.3.110 R-AE — once ingested, offer a labelled drill
                into the workflow run that produced the local
                record(s). Omitted for pre-V081 historical rows
                (ingestRunId null) and for DISMISSED. */}
            {row.status === 'ACCEPTED' && row.ingestRunId && (
              <Link to={`/workflows/monitoring/runs/${row.ingestRunId}`}
                     className="ea-btn ea-btn--ghost ea-btn--sm"
                     title="Open the workflow run that ingested this referral"
                     data-test="referral-view-ingest-run"
                     data-cross-module="Workflows">
                Workflows › View ingest run ↗
              </Link>
            )}
          </>
        }
      />
      <Panel title="Referral">
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>Kind</dt>
            <dd>{entityTypeLabel(row.kind)} <span className="ea-mono ea-text-muted">({row.kind})</span></dd></div>
          <div className="ea-def-row"><dt>Source ref</dt><dd className="ea-mono">{row.sourceRef}</dd></div>
          <div className="ea-def-row"><dt>Status</dt>
            <dd><span className={'ea-chip ea-chip--' +
                (row.status === 'ACCEPTED' ? 'success'
                  : row.status === 'DISMISSED' ? 'neutral' : 'warning')}>
              {humaniseState(row.status)}
            </span></dd></div>
          <div className="ea-def-row"><dt>Received</dt><dd className="ea-mono">{fmtDate(row.discoveredAt)}</dd></div>
          <div className="ea-def-row"><dt>Age</dt><dd>{fmtAgo(row.discoveredAt)}</dd></div>
          <div className="ea-def-row"><dt>Inbox ID</dt>
            <dd className="ea-mono" style={{ fontSize: 10 }}>{row.inboxId}</dd></div>
        </dl>
      </Panel>
    </div>
  );
}

