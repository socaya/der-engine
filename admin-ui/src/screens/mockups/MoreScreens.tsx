import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import {
  KpiTile, Panel, SplitWithDrawer, fmtDate, fmtAgo, fmtBytes, useOuContext, OuPicker,
  usePaged, TablePager, humaniseState, entityTypeIcon, entityTypeLabel,
} from './shared';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

/* ──────────────────────────────────────────────────────────────────────
 * Mockup-aesthetic re-skins for the remaining heavily-used routes.
 * Every screen uses: hero section + KPI grid + Panel cards + optional
 * right drawer. Data from existing /edge-api/v1 endpoints.
 * ──────────────────────────────────────────────────────────────────── */

function Hero({ eyebrow, title, sub, actions, chip }: {
  eyebrow?: string; title: string; sub?: string; actions?: JSX.Element; chip?: JSX.Element;
}): JSX.Element {
  return (
    <section className="ea-dash-hero">
      <div className="ea-dash-hero-left">
        {eyebrow && <div className="ea-dash-hero-eyebrow">{eyebrow}</div>}
        <h1 className="ea-dash-hero-title">{title}</h1>
        {sub && <p className="ea-dash-hero-sub">{sub}</p>}
        {chip && <div className="ea-dash-hero-meta">{chip}</div>}
      </div>
      {actions && <div>{actions}</div>}
    </section>
  );
}

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
      <section className="ea-dash-hero">
        <div className="ea-dash-hero-left">
          <h1 className="ea-dash-hero-title">Metadata drift</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className={'ea-chip ea-chip--' + (equal ? 'success' : 'warning')}
                data-test="drift-status-chip">
            {equal ? 'In sync' : 'Drift detected'}
          </span>
          <button type="button" className="ea-btn ea-btn--primary"
                  disabled={refreshing}
                  onClick={() => { reload(true).catch(() => undefined); }}
                  data-test="drift-refresh">
            {refreshing ? 'Refreshing…' : 'Recompute drift'}
          </button>
        </div>
      </section>

      <div className="ea-stat-strip">
        <Stat label="Status" tone={equal ? 'success' : 'warning'}
              value={equal ? 'identical' : 'different'} />
        <Stat label="Added"    value={totalAdded}    tone={totalAdded ? 'info' : 'muted'} />
        <Stat label="Removed"  value={totalRemoved}  tone={totalRemoved ? 'danger' : 'muted'} />
        <Stat label="Modified" value={totalModified} tone={totalModified ? 'warning' : 'muted'} />
        <Stat label="Entities" value={rowSummaries.length} />
        <Stat label="Snapshot to" value={d.snapshotTo ?? '—'} />
      </div>

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

function Stat({ label, value, tone = 'info' }: {
  label: string; value: ReactNode;
  tone?: 'info' | 'success' | 'danger' | 'warning' | 'muted';
}): JSX.Element {
  return (
    <div className={`ea-stat ea-stat--${tone}`}>
      <div className="ea-stat-value">{value}</div>
      <div className="ea-stat-label">{label}</div>
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
  const [rows, setRows] = useState<edgeApi.ConflictRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<edgeApi.ConflictRow | null>(null);

  async function reload(): Promise<void> {
    try { setRows(await edgeApi.listConflicts(100)); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  async function resolve(outcome: 'ACCEPTED' | 'REJECTED'): Promise<void> {
    if (!sel) return;
    try { await edgeApi.resolveConflict(sel.operationId, outcome); setSel(null); await reload(); }
    catch { /* ignore */ }
  }

  const paged = usePaged(rows ?? [], 50);

  if (err) return <ErrorBlock title="Attention list failed" testId="err-conflicts">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;

  return (
    <div className="ea-screen">
      <section style={{
        padding: 14, marginBottom: 14, borderRadius: 8,
        border: '1px solid var(--der-border-subtle)',
        borderLeft: `4px solid ${rows.length === 0 ? 'var(--der-success, #16a34a)' : 'var(--der-warning, #d97706)'}`,
        background: 'white',
      }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          {rows.length === 0
            ? 'Nothing needs your attention'
            : `${rows.length} record${rows.length === 1 ? '' : 's'} need${rows.length === 1 ? 's' : ''} your attention`}
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--der-ink-500)' }}>
          Records that could not synchronise automatically and need you to decide what to do.
        </p>
      </section>

      <SplitWithDrawer
        drawerOpen={!!sel}
        main={
          <Panel title={rows.length === 0 ? 'All clear' : `${rows.length} attention items`}>
            {rows.length === 0 ? (
              <p className="ea-text-muted" style={{ margin: 0 }}>
                Every captured record either reached Central DHIS2 or is still safely queued.
              </p>
            ) : (
              <div className="ea-table-wrap">
                <table className="ea-table ea-table--dense ea-table--selectable">
                  <thead><tr>
                    <th style={{ width: 32 }}></th>
                    <th>Record</th>
                    <th>Problem</th>
                    <th style={{ width: 90 }}>Priority</th>
                    <th style={{ width: 90 }}>Since</th>
                    <th style={{ width: 90 }}>Action</th>
                  </tr></thead>
                  <tbody>
                    {paged.rows.map((r) => {
                      const problem = problemFor(r);
                      const prio = priorityFor(r);
                      return (
                        <tr key={r.operationId} className={sel?.operationId === r.operationId ? 'ea-row--active' : ''}
                            onClick={() => setSel(r)}
                            data-test={`ea13-row-${r.operationId}`}>
                          <td style={{ fontSize: 16, textAlign: 'center' }} aria-hidden="true"
                              title={entityTypeLabel(r.entityType)}>
                            {entityTypeIcon(r.entityType)}
                          </td>
                          <td>
                            <div style={{ fontWeight: 500, color: 'var(--der-ink-900)' }}>
                              {entityTypeLabel(r.entityType)}
                            </div>
                            <div className="ea-text-muted ea-mono" style={{ fontSize: 11, marginTop: 1 }}>
                              {r.entityRef}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>{problem.label}</div>
                            <div className="ea-text-muted" style={{ fontSize: 11, marginTop: 1 }}>
                              {problem.summary}
                            </div>
                          </td>
                          <td>
                            <span className={'ea-chip ea-chip--'
                                + (prio === 'High' ? 'danger' : prio === 'Medium' ? 'warning' : 'info')}>
                              {prio}
                            </span>
                          </td>
                          <td className="ea-text-muted" style={{ fontSize: 12 }}
                              title={fmtDate(r.createdAt)}>{fmtAgo(r.createdAt)}</td>
                          <td>
                            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                                    onClick={(e) => { e.stopPropagation(); setSel(r); }}>
                              Review
                            </button>
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
        }
        drawer={
          sel ? (() => {
            const problem = problemFor(sel);
            const prio = priorityFor(sel);
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 28, lineHeight: 1 }} aria-hidden="true">
                    {entityTypeIcon(sel.entityType)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>{entityTypeLabel(sel.entityType)}</h3>
                    <div className="ea-text-muted ea-mono" style={{ fontSize: 12, marginTop: 2 }}>
                      {sel.entityRef}
                    </div>
                  </div>
                </div>

                <div style={{ padding: 10, marginBottom: 10, borderRadius: 6,
                              background: 'var(--der-ink-50)',
                              borderLeft: `3px solid ${prio === 'High' ? 'var(--der-danger, #dc2626)'
                                : prio === 'Medium' ? 'var(--der-warning, #d97706)'
                                : 'var(--der-primary)'}` }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{problem.label}</div>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--der-ink-700)', lineHeight: 1.5 }}>
                    {problem.summary}
                  </p>
                </div>

                <dl className="ea-def-list">
                  <div className="ea-def-row"><dt>Priority</dt>
                    <dd><span className={'ea-chip ea-chip--'
                        + (prio === 'High' ? 'danger' : prio === 'Medium' ? 'warning' : 'info')}>
                      {prio}
                    </span></dd></div>
                  <div className="ea-def-row"><dt>Attempts</dt><dd className="ea-mono">{sel.attemptCount}</dd></div>
                  <div className="ea-def-row"><dt>First queued</dt><dd className="ea-mono">{fmtDate(sel.createdAt)}</dd></div>
                  <div className="ea-def-row"><dt>Age</dt><dd>{fmtAgo(sel.createdAt)}</dd></div>
                  <div className="ea-def-row"><dt>Operation ID</dt>
                    <dd className="ea-mono" style={{ fontSize: 10 }}>{sel.operationId}</dd></div>
                </dl>

                <h4 style={{ margin: '14px 0 6px', fontSize: 11, fontWeight: 600,
                             letterSpacing: '0.02em', textTransform: 'uppercase',
                             color: 'var(--der-ink-400)' }}>
                  Recommended action
                </h4>
                <p className="ea-text-muted" style={{ margin: '0 0 10px', fontSize: 12, lineHeight: 1.5 }}>
                  Accept the local version to send it to Central DHIS2 anyway, or reject it to drop the record.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button type="button" className="ea-btn ea-btn--primary"
                          onClick={() => { resolve('ACCEPTED').catch(() => undefined); }}>
                    Accept local version
                  </button>
                  <button type="button" className="ea-btn ea-btn--ghost ea-btn--danger"
                          onClick={() => { resolve('REJECTED').catch(() => undefined); }}>
                    Reject local version
                  </button>
                </div>
              </>
            );
          })() : (
            <p className="ea-text-muted" style={{ margin: 0 }}>
              Select a record to see the recommended action.
            </p>
          )
        }
      />
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

  const accent = w.enabled ? 'var(--der-success, #16a34a)' : 'var(--der-warning, #d97706)';
  const headline = w.enabled ? 'The synchronisation worker is running' : 'The synchronisation worker is paused';
  const icon = w.enabled ? '✓' : '⏸';

  return (
    <div className="ea-screen">
      <section style={{
        display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: 14, alignItems: 'center',
        padding: 16, marginBottom: 14, borderRadius: 8,
        border: '1px solid var(--der-border-subtle)',
        borderLeft: `4px solid ${accent}`, background: 'white',
      }}>
        <div style={{ fontSize: 38, fontWeight: 700, color: accent,
                       textAlign: 'center', lineHeight: 1 }} aria-hidden="true">{icon}</div>
        <div>
          <h1 style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 700 }}
              data-test="ea14-enabled">{headline}</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--der-ink-500)' }}>
            {total === 0
              ? 'Nothing in the queue — the worker is idle.'
              : `${total.toLocaleString()} item${total === 1 ? '' : 's'} in the queue · last activity ${fmtAgo(w.lastTick)}.`}
          </p>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12,
                        color: 'var(--der-ink-500)', flexWrap: 'wrap' }}>
            <span><strong style={{ color: 'var(--der-ink-900)' }}>Waiting:</strong> {waiting.toLocaleString()}</span>
            <span><strong style={{ color: 'var(--der-ink-900)' }}>Retrying:</strong> {retrying.toLocaleString()}</span>
            {attention > 0 && (
              <span>
                <strong style={{ color: 'var(--der-ink-900)' }}>Needs attention:</strong>{' '}
                <Link to="/sync/attention" style={{ color: 'var(--der-danger, #dc2626)' }}>
                  {attention.toLocaleString()}
                </Link>
              </span>
            )}
            <span><strong style={{ color: 'var(--der-ink-900)' }}>Last batch:</strong> {w.lastBatchSize}</span>
          </div>
        </div>
        <button type="button" className="ea-btn ea-btn--primary"
                style={{ fontSize: 14, padding: '10px 16px' }}
                disabled={busy}
                onClick={() => { toggle().catch(() => undefined); }}
                data-test="ea14-toggle">
          {busy ? '…' : w.enabled ? 'Pause' : 'Resume'}
        </button>
      </section>

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
  const [rows, setRows] = useState<edgeApi.EdgeDeviceRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<edgeApi.EdgeDeviceRow | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  async function reload(): Promise<void> {
    try { setRows((await edgeApi.listDevices()).devices); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  async function act(fn: (id: string) => Promise<unknown>): Promise<void> {
    if (!sel) return;
    setBusy(true);
    try { await fn(sel.deviceId); await reload(); } finally { setBusy(false); }
  }

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
      <Hero eyebrow="Devices & Clients"
            title="Device fleet"
            sub="Edge devices registered against this DER instance." />

      <div className="ea-kpi-grid">
        <KpiTile tone="info" icon={<IconDevice />} label="Fleet" value={rows.length} />
        <KpiTile tone="success" icon={<IconCheck />} label="Approved" value={approved} />
        <KpiTile tone="warning" icon={<IconHourglass />} label="Pending" value={pending} />
        <KpiTile tone={suspended ? 'danger' : 'default'} icon={<IconX />} label="Suspended / revoked" value={suspended} />
      </div>

      <SplitWithDrawer
        drawerOpen={!!sel}
        main={
          <Panel title={`Devices (${rows.length})`}
                 action={<input className="ea-input" style={{ maxWidth: 240 }} type="search"
                                placeholder="Search by ID or user agent" value={query}
                                onChange={(e) => setQuery(e.target.value)} />}>
            <div className="ea-table-wrap">
              <table className="ea-table ea-table--dense ea-table--selectable">
                <thead><tr><th>Device</th><th>Status</th><th>Enrolled</th><th>Last seen</th></tr></thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.deviceId} className={sel?.deviceId === r.deviceId ? 'ea-row--active' : ''}
                        onClick={() => setSel(r)}
                        data-test={`dev-row-${r.deviceId}`}>
                      <td className="ea-mono">{r.deviceId.slice(0, 12)}…</td>
                      <td><span className={'ea-chip ea-chip--' +
                          (r.status === 'APPROVED' ? 'success' : r.status === 'PENDING' ? 'warning' : 'danger')}>{r.status}</span></td>
                      <td className="ea-mono">{fmtDate(r.enrolledAt)}</td>
                      <td className="ea-mono">{fmtAgo(r.lastSeenAt)}</td>
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
              <h3 style={{ margin: 0, fontSize: 16 }}>Device details</h3>
              <dl className="ea-def-list">
                <div className="ea-def-row"><dt>Device ID</dt><dd className="ea-mono">{sel.deviceId}</dd></div>
                <div className="ea-def-row"><dt>Status</dt><dd><span className="ea-chip ea-chip--info">{sel.status}</span></dd></div>
                <div className="ea-def-row"><dt>Enrolled</dt><dd className="ea-mono">{fmtDate(sel.enrolledAt)}</dd></div>
                <div className="ea-def-row"><dt>Approved by</dt><dd>{sel.approvedBy ?? '—'}</dd></div>
                <div className="ea-def-row"><dt>Last seen</dt><dd className="ea-mono">{sel.lastSeenAt ? fmtDate(sel.lastSeenAt) : '—'}</dd></div>
                <div className="ea-def-row"><dt>User agent</dt><dd className="ea-mono" style={{ wordBreak: 'break-all' }}>{sel.userAgent ?? '—'}</dd></div>
                <div className="ea-def-row"><dt>Firmware</dt><dd className="ea-mono">{sel.firmwareVersion ?? '—'}</dd></div>
              </dl>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sel.status === 'PENDING' && (
                  <button type="button" className="ea-btn ea-btn--primary" disabled={busy}
                          onClick={() => { act(edgeApi.approveDevice).catch(() => undefined); }}>Approve</button>
                )}
                {sel.status === 'APPROVED' && (
                  <button type="button" className="ea-btn ea-btn--ghost" disabled={busy}
                          onClick={() => { act(edgeApi.suspendDevice).catch(() => undefined); }}>Suspend</button>
                )}
                <button type="button" className="ea-btn ea-btn--ghost ea-btn--danger" disabled={busy}
                        onClick={() => { act(edgeApi.revokeDevice).catch(() => undefined); }}>Revoke</button>
              </div>
            </>
          ) : (
            <p className="ea-text-muted" style={{ margin: 0 }}>Select a device for actions.</p>
          )
        }
      />
    </div>
  );
}

/* ─── /approvals ─────────────────────────────────────────────────── */
export function MockupApprovalQueue(): JSX.Element {
  const [rows, setRows] = useState<edgeApi.PendingApprovalRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<edgeApi.PendingApprovalRow | null>(null);
  const [reason, setReason] = useState('');

  async function reload(): Promise<void> {
    try { setRows((await edgeApi.listPendingApprovals(100)).rows); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  async function approve(): Promise<void> {
    if (!sel) return;
    try { await edgeApi.approveOperation(sel.operationId); setSel(null); await reload(); } catch { /* ignore */ }
  }
  async function reject(): Promise<void> {
    if (!sel) return;
    try { await edgeApi.rejectOperation(sel.operationId, reason || 'rejected'); setSel(null); setReason(''); await reload(); } catch { /* ignore */ }
  }
  if (err) return <ErrorBlock title="Approvals failed" testId="err-approvals">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;

  return (
    <div className="ea-screen">
      <Hero eyebrow="Workflows & Approvals"
            title="Approval queue"
            sub="Captured work awaiting an approver's decision." />
      <div className="ea-kpi-grid">
        <KpiTile tone={rows.length ? 'warning' : 'success'} icon={<IconList />}
                 label="Pending approvals" value={rows.length} />
      </div>
      <SplitWithDrawer
        drawerOpen={!!sel}
        main={
          <Panel title={`${rows.length} pending`}>
            {rows.length === 0 ? (
              <p className="ea-text-muted" style={{ margin: 0 }}>Nothing to approve.</p>
            ) : (
              <div className="ea-table-wrap">
                <table className="ea-table ea-table--dense ea-table--selectable">
                  <thead><tr><th>Operation</th><th>Entity</th><th>Submitted by</th><th>Submitted</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.operationId} className={sel?.operationId === r.operationId ? 'ea-row--active' : ''}
                          onClick={() => setSel(r)}>
                        <td className="ea-mono">{r.operationId.slice(0, 10)}…</td>
                        <td>{r.entityType}<div className="ea-text-muted" style={{ fontSize: 11 }}>{r.entityRef}</div></td>
                        <td>{r.submittedBy ?? '—'}</td>
                        <td className="ea-mono">{fmtAgo(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        }
        drawer={
          sel ? (
            <>
              <h3 style={{ margin: 0, fontSize: 16 }}>Review</h3>
              <dl className="ea-def-list">
                <div className="ea-def-row"><dt>Operation</dt><dd className="ea-mono">{sel.operationId}</dd></div>
                <div className="ea-def-row"><dt>Entity</dt><dd>{sel.entityType}</dd></div>
                <div className="ea-def-row"><dt>Entity ref</dt><dd className="ea-mono">{sel.entityRef}</dd></div>
                <div className="ea-def-row"><dt>Submitted by</dt><dd>{sel.submittedBy ?? '—'}</dd></div>
                <div className="ea-def-row"><dt>Submitted</dt><dd className="ea-mono">{sel.createdAt ? fmtDate(sel.createdAt) : '—'}</dd></div>
              </dl>
              <label className="ea-field">
                <span className="ea-field-label">Reject reason (optional)</span>
                <input className="ea-input" value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button type="button" className="ea-btn ea-btn--primary"
                        onClick={() => { approve().catch(() => undefined); }}>Approve</button>
                <button type="button" className="ea-btn ea-btn--ghost ea-btn--danger"
                        onClick={() => { reject().catch(() => undefined); }}>Reject</button>
              </div>
            </>
          ) : (
            <p className="ea-text-muted" style={{ margin: 0 }}>Select an item to review.</p>
          )
        }
      />
    </div>
  );
}

/* ─── /referral/inbox ────────────────────────────────────────────── */
export function MockupReferralInbox(): JSX.Element {
  const [rows, setRows] = useState<edgeApi.ReferralInboxRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<edgeApi.ReferralInboxRow | null>(null);

  async function reload(): Promise<void> {
    try { setRows((await edgeApi.listReferralInbox(100)).entries); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  async function accept(): Promise<void> {
    if (!sel) return;
    try { await edgeApi.acceptReferralInbox(sel.inboxId); setSel(null); await reload(); } catch { /* ignore */ }
  }
  async function dismiss(): Promise<void> {
    if (!sel) return;
    try { await edgeApi.dismissReferralInbox(sel.inboxId); setSel(null); await reload(); } catch { /* ignore */ }
  }
  if (err) return <ErrorBlock title="Inbox failed" testId="err-inbox">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;

  const pending = rows.filter((r) => r.status === 'PENDING').length;
  return (
    <div className="ea-screen">
      <Hero eyebrow="Workflows & Approvals"
            title="Referral inbox"
            sub="Referrals from the central hub awaiting local handling." />
      <div className="ea-kpi-grid">
        <KpiTile tone={pending ? 'warning' : 'success'} icon={<IconList />}
                 label="Pending" value={pending} />
        <KpiTile tone="info" icon={<IconMail />} label="Total" value={rows.length} />
      </div>
      <SplitWithDrawer
        drawerOpen={!!sel}
        main={
          <Panel title={`${rows.length} entries`}>
            {rows.length === 0 ? (
              <p className="ea-text-muted" style={{ margin: 0 }}>Inbox empty.</p>
            ) : (
              <div className="ea-table-wrap">
                <table className="ea-table ea-table--dense ea-table--selectable">
                  <thead><tr><th>Discovered</th><th>Kind</th><th>Source ref</th><th>Status</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.inboxId} className={sel?.inboxId === r.inboxId ? 'ea-row--active' : ''}
                          onClick={() => setSel(r)}>
                        <td className="ea-mono">{fmtDate(r.discoveredAt)}</td>
                        <td>{r.kind}</td>
                        <td className="ea-mono">{r.sourceRef}</td>
                        <td><span className={'ea-chip ea-chip--' +
                            (r.status === 'ACCEPTED' ? 'success' : r.status === 'DISMISSED' ? 'neutral' : 'warning')}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        }
        drawer={
          sel ? (
            <>
              <h3 style={{ margin: 0, fontSize: 16 }}>Entry details</h3>
              <dl className="ea-def-list">
                <div className="ea-def-row"><dt>Inbox ID</dt><dd className="ea-mono">{sel.inboxId}</dd></div>
                <div className="ea-def-row"><dt>Kind</dt><dd>{sel.kind}</dd></div>
                <div className="ea-def-row"><dt>Source ref</dt><dd className="ea-mono">{sel.sourceRef}</dd></div>
                <div className="ea-def-row"><dt>Status</dt><dd>{sel.status}</dd></div>
                <div className="ea-def-row"><dt>Discovered</dt><dd className="ea-mono">{fmtDate(sel.discoveredAt)}</dd></div>
              </dl>
              {sel.status === 'PENDING' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button type="button" className="ea-btn ea-btn--primary"
                          onClick={() => { accept().catch(() => undefined); }}>Accept</button>
                  <button type="button" className="ea-btn ea-btn--ghost ea-btn--danger"
                          onClick={() => { dismiss().catch(() => undefined); }}>Dismiss</button>
                </div>
              )}
            </>
          ) : (
            <p className="ea-text-muted" style={{ margin: 0 }}>Select an inbox entry.</p>
          )
        }
      />
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
      <Hero eyebrow="Security & Recovery"
            title="Backups"
            sub="Hash-chained audit log snapshots and full edge state exports."
            actions={
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="ea-btn ea-btn--ghost" disabled={busy}
                        onClick={() => { request('AUDIT').catch(() => undefined); }}>+ Audit backup</button>
                <button type="button" className="ea-btn ea-btn--primary" disabled={busy}
                        onClick={() => { request('FULL').catch(() => undefined); }}>+ Full backup</button>
              </div>
            } />
      <div className="ea-kpi-grid">
        <KpiTile tone="info" icon={<IconList />} label="Total runs" value={rows.length} />
        <KpiTile tone="success" icon={<IconCheck />} label="Successful" value={succ} />
        <KpiTile tone="warning" icon={<IconHourglass />} label="In flight" value={pend} />
        <KpiTile tone={fail ? 'danger' : 'default'} icon={<IconX />} label="Failed" value={fail} />
      </div>
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
      <Hero eyebrow="Security & Recovery"
            title="Restore"
            sub="Replay an audit log or full backup bundle to this edge." />
      <div className="ea-kpi-grid">
        <KpiTile tone="info" icon={<IconList />} label="Restores on record" value={rows.length} />
      </div>
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
      <Hero eyebrow="DHIS2 Integration"
            title="Compatibility"
            sub="Compatibility profile between this DER build and the central DHIS2."
            actions={
              <button type="button" className="ea-btn ea-btn--primary" disabled={refreshing}
                      onClick={() => { refresh().catch(() => undefined); }}>
                {refreshing ? 'Refreshing…' : 'Refresh profile'}
              </button>
            }
            chip={<span className={'ea-chip ea-chip--' + (c.probeReachable ? 'success' : 'danger')}>
              {c.probeReachable ? 'Reachable' : 'Unreachable'}
            </span>} />
      <div className="ea-kpi-grid">
        <KpiTile tone="info" icon={<IconHash />} label="Profile" value={c.profileName ?? '—'} />
        <KpiTile tone="info" icon={<IconList />} label="Central version" value={c.centralVersion ?? '—'} />
        <KpiTile tone={c.probeReachable ? 'success' : 'danger'} icon={<IconCheck />}
                 label="Probe status" value={c.probeReachable ? 'ok' : 'fail'} />
        <KpiTile tone="default" icon={<IconClock />}
                 label="Engine" value={c.engineVersion ?? '—'} />
      </div>
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
      <Hero eyebrow="Monitoring & Analytics"
            title="Alerts & activity"
            sub="Audit stream for every security-relevant event handled by this edge." />
      <div className="ea-kpi-grid">
        <KpiTile tone="info" icon={<IconList />} label="Events (last 100)" value={rows.length} />
        <KpiTile tone="success" icon={<IconCheck />} label="Success" value={success} />
        <KpiTile tone={failure ? 'danger' : 'default'} icon={<IconX />} label="Failures" value={failure} />
      </div>
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
      <Hero eyebrow="Monitoring & Analytics"
            title="Facility analytics"
            sub="Capture throughput for the bound organisation unit." />
      <OuPicker ctx={ctx} />
      <div className="ea-kpi-grid">
        <KpiTile tone="info" icon={<IconList />} label="Journal entries" value={total} />
        <KpiTile tone="default" icon={<IconHash />} label="Entity kinds" value={journal.length} />
      </div>
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

/* ─── Icons used by the above (local, inline SVG) ─────────────── */
function sIcon(d: string): JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
function IconList(): JSX.Element { return sIcon('M4 6h16M4 12h16M4 18h16'); }
function IconCheck(): JSX.Element { return sIcon('M5 12l4 4 10-10'); }
function IconX(): JSX.Element { return sIcon('M6 6l12 12M6 18L18 6'); }
function IconHash(): JSX.Element { return sIcon('M5 9h14M5 15h14M9 3L7 21M17 3l-2 18'); }
function IconClock(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>); }
function IconDevice(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2.5" /><path d="M11 18h2" /></svg>); }
function IconHourglass(): JSX.Element { return sIcon('M6 2h12M6 22h12M6 2v4a6 6 0 0012 0V2M6 22v-4a6 6 0 0112 0v4'); }
function IconMail(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 7 9-7" /></svg>); }
export { fmtBytes };
