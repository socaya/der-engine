import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import {
  Panel, fmtDate, fmtAgo, fmtBytes, useOuContext, OuPicker,
  usePaged, TablePager, humaniseState, entityTypeIcon, entityTypeLabel,
  SyncStatusBar, BackLink, RowMenu, confirmThenRun, Status,
} from './shared';
import { UiIcon } from '../components/UiIcon';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';

/* ──────────────────────────────────────────────────────────────────────
 * Mockup-aesthetic re-skins for the remaining heavily-used routes.
 * Every screen uses: hero section + KPI grid + Panel cards + optional
 * right drawer. Data from existing /edge-api/v1 endpoints.
 * ──────────────────────────────────────────────────────────────────── */

/* /sync/jobs merged into /sync/history in der-2.1.36 — see MockupSyncHistory. */

/* ─── /sync/drift ────────────────────────────────────────────────── */
export function MockupDriftInspector(): JSX.Element {
  const [d, setD] = useState<edgeApi.DriftResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  async function reload(refresh = false): Promise<void> {
    try {
      setRefreshing(refresh);
      setD(await edgeApi.drift(refresh));
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setRefreshing(false); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  const perEntity = Object.entries(d?.perEntity ?? {});
  const rowSummaries = perEntity.map(([k, v]) => ({
    entity: k,
    added: v.added.length,
    removed: v.removed.length,
    changed: v.changed.length,
    net: v.added.length + v.removed.length + v.changed.length,
  }));
  const paged = usePaged(rowSummaries, 50);

  if (err) return <ErrorBlock title="Drift probe failed" testId="err-drift">{err}</ErrorBlock>;
  if (!d) return <LoadingBlock testId="loading" />;

  const equal = d.fingerprintFrom === d.fingerprintTo;
  const totalAdded = rowSummaries.reduce((a, r) => a + r.added, 0);
  const totalRemoved = rowSummaries.reduce((a, r) => a + r.removed, 0);
  const totalModified = rowSummaries.reduce((a, r) => a + r.changed, 0);
  const totalChanged = totalAdded + totalRemoved + totalModified;

  return (
    <div className="ea-screen" data-test="drift-hub">
      <SyncStatusBar
        tone={equal ? 'success' : 'warning'}
        title="Metadata drift"
        statusLabel={equal ? 'In sync' : 'Drift detected'}
        subtitle={
          <>
            <span>Added <strong style={{ color: 'var(--der-ink-900)' }}>{totalAdded}</strong></span>
            <span>·</span>
            <span>Removed <strong style={{ color: 'var(--der-ink-900)' }}>{totalRemoved}</strong></span>
            <span>·</span>
            <span>Modified <strong style={{ color: 'var(--der-ink-900)' }}>{totalModified}</strong></span>
            <span>·</span>
            <span>Entities <strong style={{ color: 'var(--der-ink-900)' }}>{rowSummaries.length}</strong></span>
            <span>·</span>
            <span>Snapshot <strong style={{ color: 'var(--der-ink-900)' }}>{d.snapshotTo ?? '—'}</strong></span>
          </>
        }
        actions={
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  disabled={refreshing}
                  onClick={() => { reload(true).catch(() => undefined); }}
                  data-test="drift-refresh">
            <UiIcon icon="refresh" size={14} />
            <span>{refreshing ? 'Refreshing…' : 'Recompute drift'}</span>
          </button>
        }
      />

      <section data-test="drift-direction"
               style={{
                 display: 'grid', gridTemplateColumns: 'max-content 1fr max-content',
                 columnGap: 14, rowGap: 4, alignItems: 'center',
                 padding: '8px 10px', margin: '0 0 var(--sp-3)',
                 border: '1px solid var(--der-border-subtle)', borderRadius: 6,
               }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <span className="ea-mono" style={{ fontSize: 14 }}>Central</span>
          <span style={{ fontSize: 18, color: 'var(--der-primary)', fontWeight: 700 }}>→</span>
          <span className="ea-mono" style={{ fontSize: 14 }}>DER</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--der-ink-900)' }}>
            Metadata mirror fidelity
            <span className="ea-text-muted" style={{ fontWeight: 400, fontSize: 12 }}> · one-way comparison</span>
          </div>
          <div className="ea-text-muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>
            DHIS2 is the source of truth. This probe hashes the mirrored
            resources against central, so a mismatch means the next
            metadata-sync pull will update DER — nothing is written back.
          </div>
        </div>
        <div style={{ alignSelf: 'start', paddingTop: 2 }}>
          <span className="ea-chip ea-chip--info">one-way</span>
        </div>
      </section>

      <Panel title="Fingerprints">
        <div className="ea-drift">
          <div className="ea-drift-side">
            <div className="ea-text-muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Mirror</div>
            <div className="ea-mono" style={{ wordBreak: 'break-all' }}>{d.fingerprintFrom ?? '—'}</div>
          </div>
          <div className="ea-drift-sep">
            <span className={'ea-chip ea-chip--' + (equal ? 'success' : 'warning')}>{equal ? '=' : '≠'}</span>
          </div>
          <div className="ea-drift-side">
            <div className="ea-text-muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Central</div>
            <div className="ea-mono" style={{ wordBreak: 'break-all' }}>{d.fingerprintTo ?? '—'}</div>
          </div>
        </div>
      </Panel>

      <Panel title="Per-entity breakdown"
             action={<span className="ea-text-muted" style={{ fontSize: 12 }}>
               {totalChanged.toLocaleString()} delta{totalChanged === 1 ? '' : 's'}
             </span>}>
        {rowSummaries.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>No per-entity drift recorded.</p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>Entity</th><th>Added</th><th>Removed</th><th>Changed</th><th>Net</th>
              </tr></thead>
              <tbody>
                {paged.rows.map((r) => (
                  <tr key={r.entity}>
                    <td>{r.entity}</td>
                    <td className="ea-mono" style={{ color: r.added ? 'var(--der-success-ink)' : undefined }}>{r.added}</td>
                    <td className="ea-mono" style={{ color: r.removed ? 'var(--der-danger-ink)' : undefined }}>{r.removed}</td>
                    <td className="ea-mono" style={{ color: r.changed ? 'var(--der-warning-ink)' : undefined }}>{r.changed}</td>
                    <td className="ea-mono">{r.net}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePager {...paged.pagerProps} />
          </div>
        )}
      </Panel>

      <section data-test="drift-related">
        <div className="ea-section-title">Related</div>
        <div className="ea-tile-grid">
          <Link to="/dhis2/metadata" className="ea-link-tile">
            <div className="ea-link-tile-icon" aria-hidden="true">◱</div>
            <div className="ea-link-tile-body">
              <div className="ea-link-tile-title">Metadata browser</div>
              <div className="ea-link-tile-desc">Browse the mirrored resources this comparison is measured against.</div>
            </div>
          </Link>
          <Link to="/sync/metadata" className="ea-link-tile">
            <div className="ea-link-tile-icon" aria-hidden="true">▶</div>
            <div className="ea-link-tile-body">
              <div className="ea-link-tile-title">Metadata sync</div>
              <div className="ea-link-tile-desc">Trigger a Central → DER pull to reconcile the delta.</div>
            </div>
          </Link>
          <Link to="/sync/history" className="ea-link-tile">
            <div className="ea-link-tile-icon" aria-hidden="true">⏱</div>
            <div className="ea-link-tile-body">
              <div className="ea-link-tile-title">Sync history</div>
              <div className="ea-link-tile-desc">Prior metadata-sync runs that produced earlier snapshots.</div>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}


/* ─── /sync/attention ────────────────────────────────────────────── */
/** DER Sync requirements §9. "Needs your attention" consolidates
 *  conflicts, rejected records and repeated failures into one list
 *  with a plain-English problem description + priority chip. */
function problemFor(r: edgeApi.ConflictRow): { label: string; summary: string } {
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

function priorityFor(r: edgeApi.ConflictRow): 'High' | 'Medium' | 'Low' {
  if (r.attemptCount >= 5) return 'High';
  if (r.attemptCount >= 2) return 'Medium';
  return 'Low';
}

export function MockupConflictList(): JSX.Element {
  const navigate = useNavigate();
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
      <SyncStatusBar
        tone={rows.length === 0 ? 'success' : 'warning'}
        title="Needs your attention"
        statusLabel={rows.length === 0 ? 'All clear' : `${rows.length} item${rows.length === 1 ? '' : 's'}`}
        subtitle={<span>Records that could not synchronise automatically and need a decision.</span>}
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
export function MockupConflictDetail(): JSX.Element {
  const { operationId } = useParams<{ operationId: string }>();
  const navigate = useNavigate();
  const [row, setRow] = useState<edgeApi.ConflictRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const all = await edgeApi.listConflicts(500);
        const match = all.find((r) => r.operationId === operationId);
        if (!match) { setErr('Attention item not found.'); return; }
        setRow(match);
      } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    })();
  }, [operationId]);
  async function resolve(outcome: 'ACCEPTED' | 'REJECTED'): Promise<void> {
    if (!row) return;
    try { await edgeApi.resolveConflict(row.operationId, outcome); navigate('/sync/attention'); }
    catch { /* ignore */ }
  }
  if (err) return (
    <div className="ea-screen">
      <BackLink to="/sync/attention" label="Back to attention list" />
      <SyncStatusBar tone="danger" title="Not found" statusLabel="Error"
                     subtitle={<span>{err}</span>} />
    </div>
  );
  if (!row) return <LoadingBlock testId="loading" />;
  const problem = problemFor(row);
  const prio = priorityFor(row);
  return (
    <div className="ea-screen">
      <BackLink to="/sync/attention" label="Back to attention list" />
      <SyncStatusBar
        tone={prio === 'High' ? 'danger' : prio === 'Medium' ? 'warning' : 'info'}
        title={`${entityTypeLabel(row.entityType)} · ${row.entityRef}`}
        statusLabel={prio + ' priority'}
        subtitle={<span>{problem.label}</span>}
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                    onClick={() => {
                      confirmThenRun(
                        `Accept the local version of ${entityTypeLabel(row.entityType)} "${row.entityRef}"? It will be queued for Central DHIS2.`,
                        () => { resolve('ACCEPTED').catch(() => undefined); });
                    }}>
              Accept local version
            </button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm ea-btn--danger"
                    onClick={() => {
                      confirmThenRun(
                        `Reject the local version of ${entityTypeLabel(row.entityType)} "${row.entityRef}"? The record will be dropped.`,
                        () => { resolve('REJECTED').catch(() => undefined); });
                    }}>
              Reject
            </button>
          </>
        }
      />
      <Panel title="Problem">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{problem.label}</div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--der-ink-700)', lineHeight: 1.5 }}>
          {problem.summary}
        </p>
        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--der-ink-500)', lineHeight: 1.5 }}>
          Accept the local version to send it to Central DHIS2 anyway, or reject it to drop the record.
        </p>
      </Panel>
      <Panel title="Record">
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>Entity type</dt>
            <dd>{entityTypeLabel(row.entityType)} <span className="ea-mono ea-text-muted">({row.entityType})</span></dd></div>
          <div className="ea-def-row"><dt>Entity ref</dt><dd className="ea-mono">{row.entityRef}</dd></div>
          <div className="ea-def-row"><dt>Priority</dt>
            <dd><span className={'ea-chip ea-chip--'
                + (prio === 'High' ? 'danger' : prio === 'Medium' ? 'warning' : 'info')}>{prio}</span></dd></div>
          <div className="ea-def-row"><dt>Attempts</dt><dd className="ea-mono">{row.attemptCount}</dd></div>
          <div className="ea-def-row"><dt>First queued</dt><dd className="ea-mono">{fmtDate(row.createdAt)}</dd></div>
          <div className="ea-def-row"><dt>Age</dt><dd>{fmtAgo(row.createdAt)}</dd></div>
          <div className="ea-def-row"><dt>Operation ID</dt>
            <dd className="ea-mono" style={{ fontSize: 10 }}>{row.operationId}</dd></div>
        </dl>
      </Panel>
    </div>
  );
}

/* ─── /sync/worker ───────────────────────────────────────────────── */
/** DER Sync requirements §10. One status card + Pause/Resume + an
 *  optional queue breakdown behind "Show breakdown". */
export function MockupWorkerHealth(): JSX.Element {
  const [w, setW] = useState<edgeApi.WorkerHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  async function reload(): Promise<void> {
    try { setW(await edgeApi.workerHealth()); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  async function toggle(): Promise<void> {
    if (!w) return;
    setBusy(true);
    try { await (w.enabled ? edgeApi.pauseWorker() : edgeApi.resumeWorker()); await reload(); }
    finally { setBusy(false); }
  }
  if (err) return <ErrorBlock title="Worker health failed" testId="err-worker">{err}</ErrorBlock>;
  if (!w) return <LoadingBlock testId="loading" />;

  const waiting = (w.backlog.PENDING ?? 0) + (w.backlog.IN_FLIGHT ?? 0);
  const retrying = w.backlog.RETRYABLE ?? 0;
  const attention = (w.backlog.CONFLICT_REVIEW ?? 0) + (w.backlog.CENTRAL_REJECTED ?? 0);
  const total = Object.values(w.backlog).reduce((a, b) => a + b, 0);

  return (
    <div className="ea-screen">
      <SyncStatusBar
        tone={w.enabled ? 'success' : 'warning'}
        title="Worker"
        statusLabel={w.enabled ? 'Running' : 'Paused'}
        subtitle={
          <>
            <span data-test="ea14-enabled" style={{ display: 'none' }}>
              {w.enabled ? 'Running' : 'Paused'}
            </span>
            <span>
              {total === 0
                ? 'Nothing in the queue — the worker is idle.'
                : `${total.toLocaleString()} item${total === 1 ? '' : 's'} in queue · last activity ${fmtAgo(w.lastTick)}`}
            </span>
            <span>·</span>
            <span>Waiting <strong style={{ color: 'var(--der-ink-900)' }}>{waiting.toLocaleString()}</strong></span>
            <span>·</span>
            <span>Retrying <strong style={{ color: 'var(--der-ink-900)' }}>{retrying.toLocaleString()}</strong></span>
            {attention > 0 && (
              <>
                <span>·</span>
                <span>Needs attention{' '}
                  <Link to="/sync/attention">{attention.toLocaleString()}</Link>
                </span>
              </>
            )}
            <span>·</span>
            <span>Last batch <strong style={{ color: 'var(--der-ink-900)' }}>{w.lastBatchSize}</strong></span>
          </>
        }
        actions={
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  disabled={busy}
                  onClick={() => {
                    confirmThenRun(
                      w.enabled
                        ? 'Pause the sync worker? Captured records will keep queueing locally but nothing will be sent until it resumes.'
                        : 'Resume the sync worker? It will start draining the local queue to Central DHIS2.',
                      () => { toggle().catch(() => undefined); });
                  }}
                  data-test="ea14-toggle">
            <UiIcon icon={w.enabled ? 'pause' : 'play'} size={14} />
            <span>{busy ? '…' : w.enabled ? 'Pause' : 'Resume'}</span>
          </button>
        }
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                data-test="ea14-show-breakdown"
                onClick={() => setShowBreakdown((x) => !x)}>
          {showBreakdown ? 'Hide breakdown' : 'Show breakdown'}
        </button>
      </div>

      {showBreakdown && (
        <Panel title="Queue breakdown">
          {Object.keys(w.backlog).length === 0 ? (
            <p className="ea-text-muted" style={{ margin: 0 }}>Nothing pending.</p>
          ) : (
            <div className="ea-table-wrap">
              <table className="ea-table ea-table--dense">
                <thead><tr><th>State</th><th>Operations</th></tr></thead>
                <tbody>
                  {Object.entries(w.backlog).map(([k, v]) => (
                    <tr key={k} data-test={`ea14-backlog-${k}`}>
                      <td>
                        <span className={'ea-chip ea-chip--'
                            + (k === 'FAILED' || k === 'CENTRAL_REJECTED' ? 'danger'
                              : k === 'PENDING' || k === 'RETRYABLE' || k === 'CONFLICT_REVIEW' ? 'warning'
                              : k === 'CENTRAL_ACCEPTED' ? 'success'
                              : 'info')} title={k}>
                          {humaniseState(k)}
                        </span>
                      </td>
                      <td className="ea-mono">{v as number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

/* ─── /devices ───────────────────────────────────────────────────── */
export function MockupDeviceFleet(): JSX.Element {
  const navigate = useNavigate();
  const [rows, setRows] = useState<edgeApi.EdgeDeviceRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  async function reload(): Promise<void> {
    try { setRows((await edgeApi.listDevices()).devices); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  if (err) return <ErrorBlock title="Device load failed" testId="err-devices">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;

  const approved = rows.filter((r) => r.status === 'APPROVED').length;
  const pending = rows.filter((r) => r.status === 'PENDING').length;
  const suspended = rows.filter((r) => r.status !== 'APPROVED' && r.status !== 'PENDING').length;

  const q = query.trim().toLowerCase();
  const filtered = q ? rows.filter((r) =>
    r.deviceId.toLowerCase().includes(q)
    || (r.userAgent ?? '').toLowerCase().includes(q)) : rows;

  return (
    <div className="ea-screen">
      <SyncStatusBar
        tone={suspended > 0 ? 'warning' : pending > 0 ? 'info' : 'success'}
        title="Device fleet"
        statusLabel={`${rows.length} enrolled`}
        subtitle={
          <>
            <span>Edge devices registered against this DER instance.</span>
            <span>·</span>
            <span>Approved <strong style={{ color: 'var(--der-ink-900)' }}>{approved}</strong></span>
            {pending > 0 && (<><span>·</span><span>Pending <strong style={{ color: 'var(--der-ink-900)' }}>{pending}</strong></span></>)}
            {suspended > 0 && (<><span>·</span><span>Suspended / revoked <strong style={{ color: 'var(--der-danger-ink)' }}>{suspended}</strong></span></>)}
          </>
        }
      />

      <Panel title={`Devices (${rows.length})`}
             action={<input className="ea-input" style={{ maxWidth: 240 }} type="search"
                            placeholder="Search by ID or user agent" value={query}
                            onChange={(e) => setQuery(e.target.value)} />}>
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense ea-table--selectable">
            <thead><tr>
              <th>Device</th>
              <th>Status</th>
              <th>Enrolled</th>
              <th>Last seen</th>
              <th style={{ width: 48 }} aria-label="Actions"></th>
            </tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.deviceId}
                    onClick={() => navigate(`/devices/${r.deviceId}`)}
                    data-test={`dev-row-${r.deviceId}`}>
                  <td className="ea-mono">{r.deviceId.slice(0, 12)}…</td>
                  <td>
                    <Status tone={
                      r.status === 'APPROVED' ? 'success'
                      : r.status === 'PENDING' ? 'warning' : 'danger'}>
                      {r.status}
                    </Status>
                  </td>
                  <td className="ea-mono">{fmtDate(r.enrolledAt)}</td>
                  <td className="ea-mono">{fmtAgo(r.lastSeenAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <RowMenu items={[
                      { label: 'Open details', to: `/devices/${r.deviceId}` },
                    ]} />
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

/** `/admin/devices/:deviceId` — per-device details page.
 *  Replaces the former right-side drawer. */
export function MockupDeviceDetail(): JSX.Element {
  const navigate = useNavigate();
  const { deviceId } = useParams<{ deviceId: string }>();
  const [device, setDevice] = useState<edgeApi.EdgeDeviceRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload(): Promise<void> {
    try {
      const r = await edgeApi.listDevices();
      const d = r.devices.find((x) => x.deviceId === deviceId);
      if (!d) { setErr('Device not found on this edge.'); return; }
      setDevice(d);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { reload().catch(() => undefined); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [deviceId]);

  function act(effect: string, fn: (id: string) => Promise<unknown>): void {
    if (!device) return;
    confirmThenRun(effect, async () => {
      setBusy(true);
      try { await fn(device.deviceId); await reload(); }
      finally { setBusy(false); }
    });
  }

  if (err) return <ErrorBlock title="Could not load device" testId="err-device-detail">{err}</ErrorBlock>;
  if (!device) return <LoadingBlock testId="loading" />;

  return (
    <div className="ea-screen" data-test="device-detail">
      <BackLink to="/devices" label="Back to Devices" />
      <header className="ea-screen-header">
        <div className="ea-screen-header-text">
          <h1 style={{ margin: 0 }}>Device</h1>
          <div className="ea-screen-header-sub">
            <span className="ea-mono">{device.deviceId}</span>
            <span>·</span>
            <Status tone={
              device.status === 'APPROVED' ? 'success'
              : device.status === 'PENDING' ? 'warning' : 'danger'}>
              {device.status}
            </Status>
          </div>
        </div>
        <div className="ea-screen-header-right">
          {device.status === 'PENDING' && (
            <button type="button" className="ea-btn ea-btn--primary" disabled={busy}
                    onClick={() => { act(`Approve device ${device.deviceId.slice(0, 12)}…? It will be allowed to sync data to this edge.`, edgeApi.approveDevice); }}>
              Approve
            </button>
          )}
          {device.status === 'APPROVED' && (
            <button type="button" className="ea-btn ea-btn--ghost" disabled={busy}
                    onClick={() => { act(`Suspend device ${device.deviceId.slice(0, 12)}…? It will keep its enrolment but stop accepting new sessions.`, edgeApi.suspendDevice); }}>
              Suspend
            </button>
          )}
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--danger" disabled={busy}
                  onClick={() => { act(`Revoke device ${device.deviceId.slice(0, 12)}…? Its credentials will be invalidated — it will need to re-enrol to come back.`, edgeApi.revokeDevice); }}>
            Revoke
          </button>
          <button type="button" className="ea-btn ea-btn--ghost" onClick={() => navigate('/devices')}>
            Close
          </button>
        </div>
      </header>
      <section className="ea-panel">
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>Device ID</dt><dd className="ea-mono">{device.deviceId}</dd></div>
          <div className="ea-def-row"><dt>Status</dt><dd>{device.status}</dd></div>
          <div className="ea-def-row"><dt>Enrolled</dt><dd className="ea-mono">{fmtDate(device.enrolledAt)}</dd></div>
          <div className="ea-def-row"><dt>Approved by</dt><dd>{device.approvedBy ?? '—'}</dd></div>
          <div className="ea-def-row"><dt>Last seen</dt>
            <dd className="ea-mono">{device.lastSeenAt ? fmtDate(device.lastSeenAt) : '—'}</dd></div>
          <div className="ea-def-row"><dt>User agent</dt>
            <dd className="ea-mono" style={{ wordBreak: 'break-all' }}>{device.userAgent ?? '—'}</dd></div>
          <div className="ea-def-row"><dt>Firmware</dt>
            <dd className="ea-mono">{device.firmwareVersion ?? '—'}</dd></div>
        </dl>
      </section>
    </div>
  );
}

/* ─── /approvals ─────────────────────────────────────────────────── */
export function MockupApprovalQueue(): JSX.Element {
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
  async function rejectId(id: string): Promise<void> {
    try { await edgeApi.rejectOperation(id, 'rejected'); await reload(); } catch { /* ignore */ }
  }
  if (err) return <ErrorBlock title="Approvals failed" testId="err-approvals">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;

  return (
    <div className="ea-screen">
      <SyncStatusBar
        tone={rows.length === 0 ? 'success' : 'warning'}
        title="Approvals"
        statusLabel={rows.length === 0 ? 'All clear' : `${rows.length} pending`}
        subtitle={<span>Captured records waiting for an approver's decision before they sync.</span>}
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
                {rows.map((r) => (
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
                        { label: 'Reject', danger: true,
                          onSelect: () => {
                            confirmThenRun(
                              `Reject the ${entityTypeLabel(r.entityType)} "${r.entityRef}"? The captured record will not be sent to Central DHIS2.`,
                              () => { rejectId(r.operationId).catch(() => undefined); });
                          } },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/** `/admin/approvals/:operationId` */
export function MockupApprovalDetail(): JSX.Element {
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
    try { await edgeApi.rejectOperation(row.operationId, reason || 'rejected'); navigate('/approvals'); }
    catch { /* ignore */ }
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
                    onClick={() => {
                      confirmThenRun(
                        `Reject ${entityTypeLabel(row.entityType)} "${row.entityRef}"? The record will not be sent to Central DHIS2.`,
                        () => { reject().catch(() => undefined); });
                    }}>Reject</button>
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
      <Panel title="Reject reason (optional)">
        <input className="ea-input" value={reason}
               style={{ width: '100%', maxWidth: 500 }}
               placeholder="Why is this being rejected?"
               onChange={(e) => setReason(e.target.value)} />
      </Panel>
    </div>
  );
}

/* ─── /referral/inbox ────────────────────────────────────────────── */
export function MockupReferralInbox(): JSX.Element {
  const navigate = useNavigate();
  const [rows, setRows] = useState<edgeApi.ReferralInboxRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function reload(): Promise<void> {
    try { setRows((await edgeApi.listReferralInbox(100)).entries); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  async function acceptId(id: string): Promise<void> {
    try { await edgeApi.acceptReferralInbox(id); await reload(); } catch { /* ignore */ }
  }
  async function dismissId(id: string): Promise<void> {
    try { await edgeApi.dismissReferralInbox(id); await reload(); } catch { /* ignore */ }
  }
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
            <span>Total <strong style={{ color: 'var(--der-ink-900)' }}>{rows.length}</strong></span>
            {accepted > 0 && (<><span>·</span><span>Accepted <strong style={{ color: 'var(--der-ink-900)' }}>{accepted}</strong></span></>)}
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
                {rows.map((r) => (
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
          </div>
        )}
      </Panel>
    </div>
  );
}

/** `/admin/referral/inbox/:inboxId` */
export function MockupReferralDetail(): JSX.Element {
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
    try { await edgeApi.acceptReferralInbox(row.inboxId); navigate('/referral/inbox'); } catch { /* ignore */ }
  }
  async function dismiss(): Promise<void> {
    if (!row) return;
    try { await edgeApi.dismissReferralInbox(row.inboxId); navigate('/referral/inbox'); } catch { /* ignore */ }
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
        actions={row.status === 'PENDING' ? (
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
        ) : undefined}
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

/* ─── /backup ────────────────────────────────────────────────────── */
export function MockupBackupList(): JSX.Element {
  const [rows, setRows] = useState<edgeApi.BackupRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function reload(): Promise<void> {
    try { setRows(await edgeApi.listBackups()); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  async function request(kind: 'AUDIT' | 'FULL'): Promise<void> {
    setBusy(true);
    try { await edgeApi.requestBackup(kind); await reload(); } finally { setBusy(false); }
  }
  if (err) return <ErrorBlock title="Backups failed" testId="err-backup">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;
  const succ = rows.filter((r) => r.status === 'SUCCESS').length;
  const fail = rows.filter((r) => r.status === 'FAILED').length;
  const pend = rows.filter((r) => r.status === 'QUEUED' || r.status === 'REQUESTED').length;
  return (
    <div className="ea-screen">
      <SyncStatusBar
        tone={fail > 0 ? 'danger' : pend > 0 ? 'warning' : 'success'}
        title="Backups"
        statusLabel={`${rows.length} runs`}
        subtitle={
          <>
            <span>Hash-chained audit log snapshots and full edge state exports.</span>
            <span>·</span>
            <span>Successful <strong style={{ color: 'var(--der-ink-900)' }}>{succ}</strong></span>
            {pend > 0 && (<><span>·</span><span>In flight <strong style={{ color: 'var(--der-ink-900)' }}>{pend}</strong></span></>)}
            {fail > 0 && (<><span>·</span><span>Failed <strong style={{ color: 'var(--der-danger-ink)' }}>{fail}</strong></span></>)}
          </>
        }
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm" disabled={busy}
                    onClick={() => { request('AUDIT').catch(() => undefined); }}>
              <UiIcon icon="plus" size={14} /><span>Audit backup</span>
            </button>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm" disabled={busy}
                    onClick={() => { request('FULL').catch(() => undefined); }}>
              <UiIcon icon="backup" size={14} /><span>Full backup</span>
            </button>
          </>
        }
      />
      <Panel title="Backup runs">
        {rows.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>No backups yet. Trigger one via the buttons above.</p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr><th>Run ID</th><th>Kind</th><th>Status</th><th>Requested</th><th>Message</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.runId}>
                    <td className="ea-mono">{r.runId}</td>
                    <td><span className="ea-chip ea-chip--info">{r.kind}</span></td>
                    <td><span className={'ea-chip ea-chip--' +
                        (r.status === 'SUCCESS' ? 'success' : r.status === 'FAILED' ? 'danger' : 'warning')}>{r.status}</span></td>
                    <td className="ea-mono">{fmtDate(r.requestedAt)}</td>
                    <td className="ea-text-muted">{r.message ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ─── /restore ───────────────────────────────────────────────────── */
export function MockupRestoreList(): JSX.Element {
  const [rows, setRows] = useState<edgeApi.RestoreRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  async function reload(): Promise<void> {
    try { setRows(await edgeApi.listRestores()); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  async function request(): Promise<void> {
    if (!source) return;
    setBusy(true);
    try { await edgeApi.requestRestore(source); setSource(''); await reload(); } finally { setBusy(false); }
  }
  if (err) return <ErrorBlock title="Restores failed" testId="err-restore">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;
  return (
    <div className="ea-screen">
      <SyncStatusBar
        tone="muted"
        title="Restore"
        statusLabel={`${rows.length} on record`}
        subtitle={<span>Replay an audit log or full backup bundle to this edge.</span>}
      />
      <Panel title="Request a restore">
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <label className="ea-field" style={{ flex: 1 }}>
            <span className="ea-field-label">Source URI</span>
            <input className="ea-input ea-mono" value={source}
                   onChange={(e) => setSource(e.target.value)}
                   placeholder="file:///path/to/backup.tar.gz" />
          </label>
          <button type="button" className="ea-btn ea-btn--primary" disabled={!source || busy}
                  onClick={() => { request().catch(() => undefined); }}>Request restore</button>
        </div>
      </Panel>
      <Panel title="History">
        {rows.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>No restores recorded.</p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr><th>Run ID</th><th>Source</th><th>Status</th><th>Requested</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.runId}>
                    <td className="ea-mono">{r.runId}</td>
                    <td className="ea-mono" style={{ wordBreak: 'break-all' }}>{r.source}</td>
                    <td><span className={'ea-chip ea-chip--' +
                        (r.status === 'SUCCESS' ? 'success' : r.status === 'FAILED' ? 'danger' : 'warning')}>{r.status}</span></td>
                    <td className="ea-mono">{fmtDate(r.requestedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ─── /compat ────────────────────────────────────────────────────── */
export function MockupCompatInspector(): JSX.Element {
  const [c, setC] = useState<edgeApi.CompatSnapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  async function reload(): Promise<void> {
    try { setC(await edgeApi.compat()); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  async function refresh(): Promise<void> {
    setRefreshing(true);
    try { setC(await edgeApi.refreshCompat()); } finally { setRefreshing(false); }
  }
  if (err) return <ErrorBlock title="Compat probe failed" testId="err-compat">{err}</ErrorBlock>;
  if (!c) return <LoadingBlock testId="loading" />;
  return (
    <div className="ea-screen">
      <SyncStatusBar
        tone={c.probeReachable ? 'success' : 'danger'}
        title="Compatibility"
        statusLabel={c.probeReachable ? 'Reachable' : 'Unreachable'}
        subtitle={
          <>
            <span>Profile <strong style={{ color: 'var(--der-ink-900)' }}>{c.profileName ?? '—'}</strong></span>
            <span>·</span>
            <span>Central <strong style={{ color: 'var(--der-ink-900)' }}>{c.centralVersion ?? '—'}</strong></span>
            <span>·</span>
            <span>Engine <strong style={{ color: 'var(--der-ink-900)' }}>{c.engineVersion ?? '—'}</strong></span>
          </>
        }
        actions={
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm" disabled={refreshing}
                  onClick={() => { refresh().catch(() => undefined); }}>
            <UiIcon icon="refresh" size={14} />
            <span>{refreshing ? 'Refreshing…' : 'Refresh profile'}</span>
          </button>
        }
      />
      <Panel title="Snapshot">
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>Snapshot ID</dt><dd className="ea-mono">{c.snapshotId ?? '—'}</dd></div>
          <div className="ea-def-row"><dt>Captured at</dt><dd className="ea-mono">{c.capturedAt ? fmtDate(c.capturedAt) : '—'}</dd></div>
          <div className="ea-def-row"><dt>Probe duration</dt><dd>{c.probeDurationMs ? `${c.probeDurationMs} ms` : '—'}</dd></div>
          <div className="ea-def-row"><dt>Message</dt><dd>{c.message ?? '—'}</dd></div>
          <div className="ea-def-row"><dt>Status</dt><dd>{c.status}</dd></div>
        </dl>
      </Panel>
    </div>
  );
}

/* ─── /audit/events ──────────────────────────────────────────────── */
export function MockupAuditEvents(): JSX.Element {
  const [rows, setRows] = useState<edgeApi.ActivityEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  async function reload(): Promise<void> {
    try { setRows((await edgeApi.recentActivity(100)).entries); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  const q = query.trim().toLowerCase();
  const filtered = q ? (rows ?? []).filter((r) => r.eventType.toLowerCase().includes(q)) : (rows ?? []);
  const paged = usePaged(filtered, 50);
  if (err) return <ErrorBlock title="Audit load failed" testId="err-audit">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;
  const success = rows.filter((r) => r.outcome === 'SUCCESS').length;
  const failure = rows.filter((r) => r.outcome === 'FAILURE').length;
  return (
    <div className="ea-screen">
      <SyncStatusBar
        tone={failure > 0 ? 'warning' : 'success'}
        title="Alerts & activity"
        statusLabel={`${rows.length} events`}
        subtitle={
          <>
            <span>Audit stream for every security-relevant event handled by this edge.</span>
            <span>·</span>
            <span>Success <strong style={{ color: 'var(--der-ink-900)' }}>{success}</strong></span>
            {failure > 0 && (<><span>·</span><span>Failures <strong style={{ color: 'var(--der-danger-ink)' }}>{failure}</strong></span></>)}
          </>
        }
      />
      <Panel title="Timeline"
             action={<input className="ea-input" style={{ maxWidth: 240 }} type="search"
                             placeholder="Filter by event type"
                             value={query} onChange={(e) => setQuery(e.target.value)} />}>
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense">
            <thead><tr><th>Observed</th><th>Event</th><th>Outcome</th><th>User</th></tr></thead>
            <tbody>
              {paged.rows.map((e) => (
                <tr key={e.auditId}>
                  <td className="ea-mono">{fmtDate(e.observedAt)}</td>
                  <td>{e.eventType}</td>
                  <td><span className={'ea-chip ea-chip--' +
                      (e.outcome === 'SUCCESS' ? 'success' : e.outcome === 'FAILURE' ? 'danger' : 'info')}>{e.outcome}</span></td>
                  <td className="ea-mono">{'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePager {...paged.pagerProps} />
        </div>
      </Panel>
    </div>
  );
}

/* ─── /analytics ─────────────────────────────────────────────────── */
export function MockupFacilityAnalytics(): JSX.Element {
  const [ctx] = useOuContext();
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  useEffect(() => { edgeApi.systemInfo().then(setSi).catch(() => undefined); }, []);
  if (!si) return <LoadingBlock testId="loading" />;
  const journal = Object.entries(si.journal ?? {});
  const total = journal.reduce((a, [, v]) => a + (v as number), 0);
  return (
    <div className="ea-screen">
      <SyncStatusBar
        tone="info"
        title="Facility analytics"
        statusLabel={`${total.toLocaleString()} entries`}
        subtitle={
          <>
            <span>Capture throughput for the bound organisation unit.</span>
            <span>·</span>
            <span>Entity kinds <strong style={{ color: 'var(--der-ink-900)' }}>{journal.length}</strong></span>
          </>
        }
      />
      <OuPicker ctx={ctx} />
      <Panel title="By entity kind">
        {journal.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>No captured data yet.</p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr><th>Entity</th><th>Count</th></tr></thead>
              <tbody>
                {journal.map(([k, v]) => (
                  <tr key={k}><td>{k}</td><td className="ea-mono">{(v as number).toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

export { fmtBytes };
