import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import {
  Panel, fmtDate, fmtAgo, fmtBytes, useOuContext, OuPicker,
  usePaged, TablePager, humaniseState, entityTypeIcon, entityTypeLabel,
  metadataResourceForEntity, dataModuleRouteForEntity,
  dataModuleLabelForEntity, ScopedFilterChip,
  SyncStatusBar, BackLink, Breadcrumbs, RowMenu, confirmThenRun, Status,
  RelatedMenu,
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
            <span>Central → DER (one-way)</span>
            <InfoPopover label="About metadata drift">
              <p>
                DHIS2 is the source of truth. This probe hashes DER&apos;s
                mirrored resources against Central&apos;s.
              </p>
              <p>
                A mismatch simply means the next metadata-sync pull will
                update DER. Nothing is ever written back to Central.
              </p>
            </InfoPopover>
            <span>·</span>
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

      <Panel title="Fingerprints"
             action={<Status tone={equal ? 'success' : 'warning'}>{equal ? 'Identical' : 'Different'}</Status>}>
        <div className="ea-drift">
          <div className="ea-drift-side">
            <div className="ea-text-muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Mirror</div>
            <div className="ea-mono" style={{ wordBreak: 'break-all' }}>{d.fingerprintFrom ?? '—'}</div>
          </div>
          <div className="ea-drift-sep" style={{ color: equal ? 'var(--der-success-ink)' : 'var(--der-warning-ink)',
                                                   fontSize: 20, fontWeight: 700 }}>
            {equal ? '=' : '≠'}
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

      {/* §2.3.107 R-AB — the two cross-module jumps (Metadata Sync,
          Sync History) move into a labelled Related menu so the
          operator sees which module they're entering before clicking.
          The intra-module link (Metadata browser) stays as a plain
          button alongside. */}
      <Panel title="Related">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap',
                       padding: 14, alignItems: 'center' }}>
          <Link to="/dhis2/metadata" className="ea-btn ea-btn--ghost ea-btn--sm"
                 data-cross-module="DHIS2">
            <UiIcon icon="metadata" size={14} />
            <span>Metadata browser</span>
          </Link>
          <RelatedMenu dataTest="metadata-related" items={[
            { label: 'Metadata sync', module: 'DHIS2', to: '/dhis2/metadata-sync' },
            { label: 'Sync history',  module: 'Sync', to: '/sync/history' },
          ]} />
        </div>
      </Panel>
    </div>
  );
}

/** Quiet info-hint — subtle `i` button that opens a native <details>
 *  popover with the explainer. Keeps the screen header short on first
 *  read; the detail is one click away. */
function InfoPopover({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <details className="ea-info-popover" style={{ position: 'relative', display: 'inline-flex' }}>
      <summary className="ea-info-popover-trigger" aria-label={label}
               title={label}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
             aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6" />
          <circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      </summary>
      <div className="ea-info-popover-body" role="tooltip">
        <div className="ea-info-popover-title">{label}</div>
        {children}
      </div>
    </details>
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
            {/* §2.3.80 R-B/1 — deep-link to the DHIS2 metadata schema
                that defines this entity. Resolves nothing for generic
                METADATA ops (returns null), so we only render when a
                mapping exists. */}
            {(() => {
              const res = metadataResourceForEntity(row.entityType);
              if (!res) return null;
              return (
                <Link to={`/dhis2/metadata?resource=${res}`}
                       className="ea-btn ea-btn--ghost ea-btn--sm"
                       title={`Open DHIS2 metadata · ${res}`}>
                  <UiIcon icon="metadata" size={14} />
                  <span>DHIS2 metadata</span>
                </Link>
              );
            })()}
            {/* §2.3.91 R-D/1 — backlink to the Data module where the
                failing row lives locally. For TEI/enrolment ops we
                carry the entityRef as a teiUid so the Tracker browse
                opens scoped. */}
            {(() => {
              const route = dataModuleRouteForEntity(row.entityType);
              if (!route) return null;
              const et = row.entityType?.toUpperCase() ?? '';
              let to = route;
              if (et === 'TRACKED_ENTITY' || et === 'TRACKED_ENTITY_INSTANCE'
                  || et === 'TEI') {
                to = `${route}?teiUid=${encodeURIComponent(row.entityRef)}`;
              }
              return (
                <Link to={to}
                       className="ea-btn ea-btn--ghost ea-btn--sm"
                       title={`Open the Data module row that produced this operation`}>
                  <UiIcon icon="activity" size={14} />
                  <span>{dataModuleLabelForEntity(row.entityType)}</span>
                </Link>
              );
            })()}
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
      <CentralValuePanel operationId={row.operationId} localPayload={row.payload} />
    </div>
  );
}

/** Phase 13.4 — side-by-side payload comparison. Local payload left,
 *  central's response right. Collapses gracefully when central has
 *  never responded (fresh CONFLICT_REVIEW from pull-time collision
 *  rather than drain-time rejection). */
function CentralValuePanel(
  { operationId, localPayload }:
    { operationId: string; localPayload: Record<string, unknown> | null | undefined },
): JSX.Element | null {
  const [central, setCentral] = useState<edgeApi.ConflictCentralResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    edgeApi.fetchConflictCentralResponse(operationId)
      .then((r) => { if (alive) setCentral(r); })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [operationId]);
  if (err) return (
    <Panel title="Central value" >
      <p className="ea-text-muted" style={{ margin: 0, fontSize: 12 }}>Failed to load: {err}</p>
    </Panel>
  );
  if (!central) return (
    <Panel title="Central value">
      <p className="ea-text-muted" style={{ margin: 0, fontSize: 12 }}>Loading…</p>
    </Panel>
  );
  const hasCentral = central.lastResponse != null
    || (central.lastResponseRaw != null && central.lastResponseRaw.length > 0);
  return (
    <Panel title="Side-by-side payload">
      {!hasCentral && (
        <p className="ea-text-muted" style={{ margin: 0, fontSize: 12 }}>
          Central hasn&apos;t produced a response for this row yet — the conflict was
          raised at pull time (central&apos;s version differs from the operator&apos;s
          in-flight edit) rather than at drain time (central rejected the push).
          Only the local payload shown.
        </p>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: hasCentral ? '1fr 1fr' : '1fr',
        gap: 12, marginTop: 12,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4,
                         color: 'var(--der-ink-500)',
                         textTransform: 'uppercase' }}>Local</div>
          <pre className="ea-mono" style={{ fontSize: 11, lineHeight: 1.4,
                                              background: 'var(--der-canvas, #f8fafc)',
                                              padding: 10, borderRadius: 6,
                                              border: '1px solid var(--der-border)',
                                              whiteSpace: 'pre-wrap',
                                              wordBreak: 'break-word',
                                              margin: 0 }}>
            {JSON.stringify(localPayload ?? {}, null, 2)}
          </pre>
        </div>
        {hasCentral && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4,
                           color: 'var(--der-ink-500)',
                           textTransform: 'uppercase' }}>Central</div>
            <pre className="ea-mono" style={{ fontSize: 11, lineHeight: 1.4,
                                                background: 'var(--der-canvas, #f8fafc)',
                                                padding: 10, borderRadius: 6,
                                                border: '1px solid var(--der-border)',
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                                margin: 0 }}>
              {central.lastResponse != null
                ? JSON.stringify(central.lastResponse, null, 2)
                : central.lastResponseRaw}
            </pre>
          </div>
        )}
      </div>
      {central.lastError && (
        <p style={{ marginTop: 12, fontSize: 12, color: 'var(--der-ink-700)' }}>
          <strong>Last error:</strong> {central.lastError}
        </p>
      )}
    </Panel>
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
                {/* §2.3.108 R-AC — count stays as status text; the
                    cross-module jump moves to an explicit "Open in
                    Sync" link so interactivity + target are both
                    visible, not inferred from blue text on a number. */}
                <span>Needs attention{' '}
                  <strong style={{ color: 'var(--der-danger-ink)' }}>
                    {attention.toLocaleString()}
                  </strong>
                  {' '}·{' '}
                  <Link to="/sync/attention" className="ea-link-btn"
                        style={{ fontSize: 11 }}
                        title="Open attention queue in Sync module"
                        data-cross-module="Sync">
                    Sync › Open attention →
                  </Link>
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
function titleCase(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

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

  const q = query.trim().toLowerCase();
  const filtered = (rows ?? []).filter((r) => !q
    || r.deviceId.toLowerCase().includes(q)
    || (r.userAgent ?? '').toLowerCase().includes(q)
    || (r.displayName ?? '').toLowerCase().includes(q)
    || (r.formFactor ?? '').toLowerCase().includes(q));
  const paged = usePaged(filtered, 25);

  if (err) return <ErrorBlock title="Device load failed" testId="err-devices">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;

  const approved = rows.filter((r) => r.status === 'APPROVED').length;
  const pending = rows.filter((r) => r.status === 'PENDING').length;
  const suspended = rows.filter((r) => r.status !== 'APPROVED' && r.status !== 'PENDING').length;

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
              <th>Form factor</th>
              <th>Status</th>
              <th>Enrolled</th>
              <th>Last seen</th>
              <th style={{ width: 48 }} aria-label="Actions"></th>
            </tr></thead>
            <tbody>
              {paged.rows.map((r) => (
                <tr key={r.deviceId}
                    onClick={() => navigate(`/devices/${r.deviceId}`)}
                    data-test={`dev-row-${r.deviceId}`}>
                  <td>
                    <div style={{ fontWeight: r.displayName ? 500 : 400 }}>
                      {r.displayName ?? <em className="ea-text-muted">unnamed</em>}
                    </div>
                    <div className="ea-text-muted ea-mono"
                         style={{ fontSize: 11 }} title={r.deviceId}>
                      {r.deviceId.slice(0, 12)}…
                    </div>
                  </td>
                  <td>{r.formFactor && r.formFactor !== 'UNKNOWN'
                        ? titleCase(r.formFactor)
                        : <span className="ea-text-muted">—</span>}</td>
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
          <TablePager {...paged.pagerProps} />
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
  // Why: reload closes over state; re-run only when deviceId changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload().catch(() => undefined); }, [deviceId]);

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

  const tone = device.status === 'APPROVED' ? 'success'
             : device.status === 'PENDING'  ? 'warning' : 'danger';
  const shortId = device.deviceId.slice(0, 8);
  const displayLabel = device.displayName
                        ? `${device.displayName} · ${shortId}`
                        : `Device ${shortId}`;
  return (
    <div className="ea-screen" data-test="device-detail">
      <Breadcrumbs
        testId="device-detail-crumbs"
        items={[
          { label: 'Devices', to: '/devices' },
          { label: displayLabel },
        ]} />
      <SyncStatusBar
        tone={tone}
        title={device.displayName ?? 'Device'}
        statusLabel={device.status}
        subtitle={
          <>
            <span className="ea-mono">{device.deviceId}</span>
            {device.lastSeenAt && (
              <>
                <span>·</span>
                <span>Last seen {fmtAgo(device.lastSeenAt)}</span>
              </>
            )}
          </>
        }
        actions={
          <>
            {device.status === 'PENDING' && (
              <button type="button" className="ea-btn ea-btn--primary ea-btn--sm" disabled={busy}
                      onClick={() => { act(`Approve device ${device.deviceId.slice(0, 12)}…? It will be allowed to sync data to this edge.`, edgeApi.approveDevice); }}>
                Approve
              </button>
            )}
            {device.status === 'APPROVED' && (
              <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm" disabled={busy}
                      onClick={() => { act(`Suspend device ${device.deviceId.slice(0, 12)}…? It will keep its enrolment but stop accepting new sessions.`, edgeApi.suspendDevice); }}>
                Suspend
              </button>
            )}
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm ea-btn--danger" disabled={busy}
                    onClick={() => { act(`Revoke device ${device.deviceId.slice(0, 12)}…? Its credentials will be invalidated — it will need to re-enrol to come back.`, edgeApi.revokeDevice); }}>
              Revoke
            </button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm" onClick={() => navigate('/devices')}>
              Close
            </button>
          </>
        }
      />
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
          <div className="ea-def-row"><dt>Display name</dt>
            <dd>{device.displayName ?? <em className="ea-text-muted">unnamed</em>}</dd></div>
          <div className="ea-def-row"><dt>Form factor</dt>
            <dd>{device.formFactor ?? 'UNKNOWN'}</dd></div>
        </dl>
      </section>
      <DeviceProfileEditor device={device} onSaved={() => { reload().catch(() => undefined); }} />
      <DeviceRelatedActivity device={device} />
    </div>
  );
}

/** §2.3.79 — soft cross-link panel on the device detail page.
 *  Journal ops and workflow runs don't yet carry a device-id column
 *  we can filter on from the client, so for now this panel lists
 *  the obvious outbound destinations (Sync queue, Attention,
 *  Workflow monitoring, Network client row) that an admin would
 *  typically open next after inspecting a device. Data-driven
 *  filters are a follow-up once operation_journal grows
 *  `submitted_device_id`. */
function DeviceRelatedActivity(
  { device }: { device: edgeApi.EdgeDeviceRow }
): JSX.Element {
  const links: Array<{ to: string; label: string; hint: string; icon: 'data-queue' | 'attention' | 'analytics' | 'tei' }> = [
    { to: '/data/queue',            icon: 'data-queue',
      label: 'Sync queue',
      hint:  'Pending contributions awaiting push to DHIS2 Central.' },
    { to: '/sync/attention',       icon: 'attention',
      label: 'Sync attention',
      hint:  'Unresolved conflicts and failures requiring review.' },
    { to: '/workflows/monitoring', icon: 'analytics',
      label: 'Workflow monitoring',
      hint:  'Workflow activity feed; find runs this device contributed to.' },
    { to: '/network/clients',      icon: 'tei',
      label: 'Network client row',
      hint:  'LAN view: IP, trust, last-seen on the facility network.' },
  ];
  return (
    <Panel title="Related activity">
      <p className="ea-text-muted" style={{ margin: '0 0 10px', fontSize: 12 }}
         data-test="device-related-activity">
        Quick exits to where this device’s traffic appears across the
        other modules. Deep filtering by device id will follow once
        the journal schema carries it.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 10 }}>
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to}
                  className="ea-card ea-card--interactive"
                  data-test={`device-link-${l.icon}`}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10,
                            padding: 12, textDecoration: 'none',
                            color: 'var(--der-ink-900)',
                            border: '1px solid var(--der-border)',
                            borderRadius: 6, background: 'var(--der-raised)' }}>
              <UiIcon icon={l.icon} size={18} />
              <span style={{ display: 'block' }}>
                <strong style={{ display: 'block', fontSize: 13 }}>{l.label}</strong>
                <span style={{ display: 'block', fontSize: 11,
                                 color: 'var(--der-ink-500)', marginTop: 2 }}>
                  {l.hint}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="ea-text-muted" style={{ margin: '12px 0 0', fontSize: 11 }}>
        Device id: <span className="ea-mono">{device.deviceId}</span>
      </p>
    </Panel>
  );
}

/** V043 — operator rename + form-factor edit used by the mesh topology. */
function DeviceProfileEditor(
  { device, onSaved }: { device: edgeApi.EdgeDeviceRow; onSaved(): void }
): JSX.Element {
  const [displayName, setDisplayName] = useState<string>(device.displayName ?? '');
  const [formFactor, setFormFactor] = useState<edgeApi.DeviceFormFactor>(
    device.formFactor ?? 'UNKNOWN');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(): Promise<void> {
    setBusy(true); setErr(null);
    try {
      await edgeApi.updateDeviceProfile(device.deviceId, {
        displayName: displayName.trim() === '' ? null : displayName.trim(),
        formFactor,
      });
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <section className="ea-panel" data-test="device-profile-editor">
      <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600 }}>Profile</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 12px',
                     alignItems: 'center', fontSize: 13 }}>
        <label htmlFor="dev-display-name" style={{ color: 'var(--der-ink-500)' }}>
          Display name
        </label>
        <input id="dev-display-name" type="text" value={displayName}
               data-test="input-display-name"
               placeholder="e.g. Registration, Triage Tablet"
               onChange={(e) => setDisplayName(e.target.value)}
               style={{ padding: '6px 8px', border: '1px solid var(--der-border)',
                         borderRadius: 4, maxWidth: 320 }} />
        <label htmlFor="dev-form-factor" style={{ color: 'var(--der-ink-500)' }}>
          Form factor
        </label>
        <select id="dev-form-factor" value={formFactor}
                data-test="select-form-factor"
                onChange={(e) => setFormFactor(e.target.value as edgeApi.DeviceFormFactor)}
                style={{ padding: '6px 8px', border: '1px solid var(--der-border)',
                          borderRadius: 4, maxWidth: 320 }}>
          <option value="UNKNOWN">Unknown</option>
          <option value="WORKSTATION">Workstation</option>
          <option value="LAPTOP">Laptop</option>
          <option value="TABLET">Tablet</option>
          <option value="MOBILE">Mobile · P2P</option>
        </select>
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" className="ea-btn ea-btn--primary ea-btn--sm" disabled={busy}
                data-test="btn-save-profile"
                onClick={() => { save().catch(() => undefined); }}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
        {err && <span className="ea-text-danger" style={{ fontSize: 12 }}>{err}</span>}
      </div>
    </section>
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
  const paged = usePaged(rows ?? [], 25);
  if (err) return <ErrorBlock title="Approvals failed" testId="err-approvals">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;

  return (
    <div className="ea-screen">
      <SyncStatusBar
        tone={rows.length === 0 ? 'success' : 'warning'}
        title="Approvals"
        statusLabel={rows.length === 0 ? 'All clear' : `${rows.length} pending`}
        subtitle={<span>Captured records waiting for an approver&apos;s decision before they sync.</span>}
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

/* ─── /backup ────────────────────────────────────────────────────── */
/** FR-15-07 — Backup tools: schedule + verify + runs.
 *
 *  Server-side the pieces have shipped separately over several
 *  alphas: BackupController (/edge-api/v1/backup/runs + /request),
 *  BackupPitrController (/backup/pitr/wal + /verify/*), and the
 *  BACKUP_ROUTINE_DRAIN cron driven by settings.cron['backup.rotate'].
 *
 *  This screen pulls them together into one operator surface:
 *  the current schedule, latest WAL/PITR readiness, the most-recent
 *  verification outcome, a Verify-now action, and the backup runs
 *  table. */
export function MockupBackupList(): JSX.Element {
  const [rows, setRows] = useState<edgeApi.BackupRow[] | null>(null);
  const [verify, setVerify] = useState<edgeApi.BackupVerifyStatus | null>(null);
  const [verifyHist, setVerifyHist] = useState<edgeApi.BackupVerifyRow[]>([]);
  const [wal, setWal] = useState<edgeApi.WalSummary | null>(null);
  const [settings, setSettings] = useState<edgeApi.SettingsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function reload(): Promise<void> {
    const [a, b, c, d, e] = await Promise.allSettled([
      edgeApi.listBackups(),
      edgeApi.backupVerifyStatus(),
      edgeApi.backupVerifyHistory(10),
      edgeApi.backupPitrWal(),
      edgeApi.readSettings(),
    ]);
    if (a.status === 'fulfilled') setRows(a.value);
    else { setErr(a.reason instanceof Error ? a.reason.message : String(a.reason)); return; }
    if (b.status === 'fulfilled') setVerify(b.value);
    if (c.status === 'fulfilled') setVerifyHist(c.value);
    if (d.status === 'fulfilled') setWal(d.value);
    if (e.status === 'fulfilled') setSettings(e.value);
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  async function requestBackupKind(kind: 'AUDIT' | 'FULL'): Promise<void> {
    setBusy(true);
    try { await edgeApi.requestBackup(kind); await reload(); } finally { setBusy(false); }
  }

  async function runVerifyNow(backupId?: number): Promise<void> {
    setVerifying(true);
    try { await edgeApi.backupVerifyRun(backupId); await reload(); }
    catch { /* verify failures surface in the history row */ }
    finally { setVerifying(false); }
  }

  if (err) return <ErrorBlock title="Backups failed" testId="err-backup">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;

  const succ = rows.filter((r) => r.status === 'SUCCESS').length;
  const fail = rows.filter((r) => r.status === 'FAILED').length;
  const pend = rows.filter((r) => r.status === 'QUEUED' || r.status === 'REQUESTED').length;

  const cron = settings?.cron?.['backup.rotate'] ?? null;
  const lastSuccess = rows.find((r) => r.status === 'SUCCESS');
  const verifyLast = verify?.lastRun ?? null;
  const verifyOk = verifyLast?.outcome === 'PASSED' || verifyLast?.outcome === 'SUCCESS';
  const verifyTone: 'success' | 'warning' | 'danger' | 'muted' =
    !verifyLast ? 'muted'
    : verifyOk ? 'success'
    : 'danger';

  return (
    <div className="ea-screen" data-test="backup-tools">
      <SyncStatusBar
        tone={fail > 0 ? 'danger' : pend > 0 ? 'warning' : 'success'}
        title="Backup tools"
        statusLabel={`${rows.length} runs`}
        subtitle={
          <>
            <span>Scheduled backups, point-in-time recovery, and automated restore verification.</span>
            <span>·</span>
            <span>Successful <strong style={{ color: 'var(--der-ink-900)' }}>{succ}</strong></span>
            {pend > 0 && (<><span>·</span><span>In flight <strong style={{ color: 'var(--der-ink-900)' }}>{pend}</strong></span></>)}
            {fail > 0 && (<><span>·</span><span>Failed <strong style={{ color: 'var(--der-danger-ink)' }}>{fail}</strong></span></>)}
          </>
        }
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm" disabled={busy}
                    data-test="backup-audit"
                    onClick={() => { requestBackupKind('AUDIT').catch(() => undefined); }}>
              <UiIcon icon="plus" size={14} /><span>Audit backup</span>
            </button>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm" disabled={busy}
                    data-test="backup-full"
                    onClick={() => { requestBackupKind('FULL').catch(() => undefined); }}>
              <UiIcon icon="backup" size={14} /><span>Full backup</span>
            </button>
          </>
        }
      />

      <Panel title="Schedule">
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>Backup cron</dt>
            <dd className="ea-mono" data-test="backup-cron">{cron ?? '—'}</dd></div>
          <div className="ea-def-row"><dt>Last successful backup</dt>
            <dd>
              {lastSuccess
                ? <>{fmtDate(lastSuccess.requestedAt)} <span className="ea-text-muted">· {fmtAgo(lastSuccess.requestedAt)}</span></>
                : <span className="ea-text-muted">never</span>}
            </dd></div>
          <div className="ea-def-row"><dt>Change schedule</dt>
            <dd>
              <Link to="/sync/schedule" className="ea-link-btn"
                     data-cross-module="Schedule"
                     data-test="backup-open-schedule">
                Open Sync Schedule →
              </Link>
            </dd></div>
        </dl>
      </Panel>

      <Panel title="PITR / WAL archive"
             action={
               wal && <Status tone={wal.walEnabled && wal.walDirExists ? 'success' : 'muted'}>
                 {wal.walEnabled ? (wal.walDirExists ? 'Active' : 'Dir missing') : 'Disabled'}
               </Status>
             }>
        {!wal ? (
          <p className="ea-text-muted" style={{ margin: 0, fontSize: 12 }}>Loading…</p>
        ) : (
          <dl className="ea-def-list">
            <div className="ea-def-row"><dt>WAL directory</dt>
              <dd className="ea-mono" style={{ fontSize: 12 }}>{wal.walDirectory}</dd></div>
            <div className="ea-def-row"><dt>Archived segments</dt>
              <dd className="ea-mono" data-test="wal-segments">{wal.segmentCount ?? 0}</dd></div>
            <div className="ea-def-row"><dt>Earliest archive</dt>
              <dd className="ea-mono" style={{ fontSize: 12 }}>
                {wal.earliestArchive ? fmtDate(wal.earliestArchive) : '—'}
              </dd></div>
            <div className="ea-def-row"><dt>Latest archive</dt>
              <dd className="ea-mono" style={{ fontSize: 12 }}>
                {wal.latestArchive ? fmtDate(wal.latestArchive) : '—'}
              </dd></div>
          </dl>
        )}
      </Panel>

      <Panel title="Restore verification"
             action={
               <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                       disabled={verifying || !verify?.enabled || !lastSuccess}
                       data-test="verify-now"
                       title={!verify?.enabled
                         ? 'Backup verification is disabled on this edge'
                         : !lastSuccess ? 'No successful backup to verify yet' : ''}
                       onClick={() => { runVerifyNow(lastSuccess?.runId).catch(() => undefined); }}>
                 <UiIcon icon="refresh" size={14} />
                 <span>{verifying ? 'Verifying…' : 'Verify now'}</span>
               </button>
             }>
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>Verification enabled</dt>
            <dd data-test="verify-enabled">{verify?.enabled ? 'yes' : 'no'}</dd></div>
          <div className="ea-def-row"><dt>pg_restore</dt>
            <dd className="ea-mono" style={{ fontSize: 12 }}>
              {verify?.pgRestore ?? <span className="ea-text-muted">not found</span>}
            </dd></div>
          <div className="ea-def-row"><dt>Last verify outcome</dt>
            <dd data-test="verify-last-outcome">
              <Status tone={verifyTone}>
                {verifyLast?.outcome ?? 'never run'}
              </Status>
              {verifyLast && (
                <span className="ea-text-muted" style={{ marginLeft: 8, fontSize: 12 }}>
                  · {fmtAgo(verifyLast.verifiedAt)}
                </span>
              )}
            </dd></div>
        </dl>
        {verifyHist.length > 0 && (
          <div className="ea-table-wrap" style={{ marginTop: 10 }}>
            <table className="ea-table ea-table--dense" data-test="verify-history">
              <thead><tr>
                <th>Verified</th><th>Backup run</th><th>Outcome</th>
                <th>Duration</th><th>Reason</th>
              </tr></thead>
              <tbody>
                {verifyHist.map((v) => (
                  <tr key={v.verificationId}>
                    <td className="ea-mono" style={{ fontSize: 12 }}>{fmtDate(v.verifiedAt)}</td>
                    <td className="ea-mono">{v.backupRunId}</td>
                    <td>
                      <Status tone={
                        v.outcome === 'PASSED' || v.outcome === 'SUCCESS' ? 'success'
                        : 'danger'}>
                        {v.outcome}
                      </Status>
                    </td>
                    <td className="ea-mono">{v.durationMs} ms</td>
                    <td className="ea-text-muted">{v.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Backup runs">
        {rows.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>No backups yet. Trigger one via the buttons above.</p>
        ) : (
          <BackupRunsTable rows={rows} />
        )}
      </Panel>
    </div>
  );
}

function BackupRunsTable({ rows }: { rows: ReadonlyArray<edgeApi.BackupRow> }): JSX.Element {
  const paged = usePaged(rows, 25);
  return (
    <div className="ea-table-wrap">
      <table className="ea-table ea-table--dense">
        <thead><tr><th>Run ID</th><th>Kind</th><th>Status</th><th>Requested</th><th>Message</th></tr></thead>
        <tbody>
          {paged.rows.map((r) => (
            <tr key={r.runId}>
              <td className="ea-mono">{r.runId}</td>
              <td style={{ fontWeight: 500 }}>{r.kind}</td>
              <td>
                <Status tone={
                  r.status === 'SUCCESS' ? 'success'
                  : r.status === 'FAILED' ? 'danger' : 'warning'}>
                  {r.status}
                </Status>
              </td>
              <td className="ea-mono">{fmtDate(r.requestedAt)}</td>
              <td className="ea-text-muted">{r.message ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <TablePager {...paged.pagerProps} />
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
          <RestoreRunsTable rows={rows} />
        )}
      </Panel>
    </div>
  );
}

function RestoreRunsTable({ rows }: { rows: ReadonlyArray<edgeApi.RestoreRow> }): JSX.Element {
  const paged = usePaged(rows, 25);
  return (
    <div className="ea-table-wrap">
      <table className="ea-table ea-table--dense">
        <thead><tr><th>Run ID</th><th>Source</th><th>Status</th><th>Requested</th></tr></thead>
        <tbody>
          {paged.rows.map((r) => (
            <tr key={r.runId}>
              <td className="ea-mono">{r.runId}</td>
              <td className="ea-mono" style={{ wordBreak: 'break-all' }}>{r.source}</td>
              <td>
                <Status tone={
                  r.status === 'SUCCESS' ? 'success'
                  : r.status === 'FAILED' ? 'danger' : 'warning'}>
                  {r.status}
                </Status>
              </td>
              <td className="ea-mono">{fmtDate(r.requestedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <TablePager {...paged.pagerProps} />
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
  const [params] = useSearchParams();
  const category      = params.get('category');
  const deviceFilter  = params.get('device');
  const peerFilter    = params.get('peer');
  const correlationId = params.get('correlationId');
  // When any network-specific filter is present we switch the data
  // source from /activity/recent (which lacks device/peer fields) to
  // /network/events (which carries the full shape per spec §29).
  const networkMode = Boolean(category === 'network' || deviceFilter || peerFilter || correlationId);

  const [sysRows, setSysRows] = useState<edgeApi.ActivityEntry[] | null>(null);
  const [netRows, setNetRows] = useState<edgeApi.NetworkEvent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  async function reload(): Promise<void> {
    try {
      if (networkMode) {
        setNetRows(((await edgeApi.networkEvents(200)) as { events: edgeApi.NetworkEvent[] }).events);
      } else {
        setSysRows((await edgeApi.recentActivity(100)).entries);
      }
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  // Why: reload closes over state; re-run only when networkMode changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload().catch(() => undefined); }, [networkMode]);

  // Hooks must stay above every early-return. Compute both filtered
  // datasets up front and feed usePaged whichever is active.
  const qLower = query.trim().toLowerCase();
  const netFiltered = (netRows ?? []).filter((e) => {
    if (deviceFilter && e.deviceId !== deviceFilter) return false;
    if (peerFilter   && e.nodeId   !== peerFilter)   return false;
    if (correlationId && e.correlationId !== correlationId) return false;
    if (qLower && !(e.eventType.toLowerCase().includes(qLower)
               || (e.reason ?? '').toLowerCase().includes(qLower)
               || (e.deviceId ?? '').toLowerCase().includes(qLower)
               || (e.nodeId ?? '').toLowerCase().includes(qLower))) return false;
    return true;
  });
  const sysFiltered = qLower
    ? (sysRows ?? []).filter((r) => r.eventType.toLowerCase().includes(qLower))
    : (sysRows ?? []);
  const pagedNet = usePaged(netFiltered, 50);
  const pagedSys = usePaged(sysFiltered, 50);

  if (err) return <ErrorBlock title="Audit load failed" testId="err-audit">{err}</ErrorBlock>;
  if (networkMode && !netRows) return <LoadingBlock testId="loading" />;
  if (!networkMode && !sysRows) return <LoadingBlock testId="loading" />;

  if (networkMode) {
    const filtered = netFiltered;
    const paged = pagedNet;
    const failure = filtered.filter((e) => e.outcome === 'FAILURE').length;
    const filterPills: string[] = [];
    if (category === 'network') filterPills.push('network');
    if (deviceFilter)  filterPills.push(`device=${deviceFilter}`);
    if (peerFilter)    filterPills.push(`peer=${peerFilter.slice(0, 8)}…`);
    if (correlationId) filterPills.push(`correlation=${correlationId.slice(0, 8)}…`);
    return (
      <div className="ea-screen" data-test="audit-events">
        <SyncStatusBar
          tone={failure > 0 ? 'warning' : 'success'}
          title="Network audit"
          statusLabel={`${filtered.length} events`}
          subtitle={
            <>
              <span>Filtered view from /edge-api/v1/network/events.</span>
              {filterPills.length > 0 && (<><span>·</span>
                <span className="ea-mono" style={{ color: 'var(--der-ink-700)' }}>
                  {filterPills.join(' · ')}
                </span></>)}
            </>
          }
          actions={
            <>
              <Link to="/audit/events" className="ea-btn ea-btn--ghost ea-btn--sm"
                     data-cross-module="Security">
                <UiIcon icon="refresh" size={14} /><span>Clear filter</span>
              </Link>
              <Link to="/network/diagnostics" className="ea-btn ea-btn--ghost ea-btn--sm"
                     data-cross-module="Network">
                <UiIcon icon="diagnostics" size={14} /><span>Diagnostics</span>
              </Link>
            </>
          }
        />
        <Panel title="Timeline"
               action={<input className="ea-input" style={{ maxWidth: 260 }} type="search"
                               placeholder="Filter by event type / device / reason"
                               value={query} onChange={(e) => setQuery(e.target.value)} />}>
          {filtered.length === 0 ? (
            <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
              No network events match this filter.
            </p>
          ) : (
            <div className="ea-table-wrap">
              <table className="ea-table ea-table--dense">
                <thead><tr>
                  <th>Observed</th><th>Event</th><th>Interface</th>
                  <th>Device / node</th><th>Actor</th><th>Outcome</th><th>Reason</th>
                </tr></thead>
                <tbody>
                  {paged.rows.map((e) => (
                    <tr key={e.eventId}>
                      <td className="ea-mono">{fmtDate(e.observedAt)}</td>
                      <td style={{ fontWeight: 500 }}>{e.eventType}</td>
                      <td className="ea-mono ea-text-muted">{e.interfaceName ?? '—'}</td>
                      <td className="ea-mono ea-text-muted" style={{ fontSize: 13 }}>
                        {e.deviceId ?? e.nodeId ?? '—'}
                      </td>
                      <td className="ea-mono ea-text-muted">{e.actor ?? '—'}</td>
                      <td>
                        <Status tone={e.outcome === 'SUCCESS' ? 'success'
                                       : e.outcome === 'FAILURE' ? 'danger' : 'info'}>
                          {e.outcome}
                        </Status>
                      </td>
                      <td className="ea-text-muted">{e.reason ?? '—'}</td>
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

  const paged = pagedSys;
  const success = (sysRows ?? []).filter((r) => r.outcome === 'SUCCESS').length;
  const failure = (sysRows ?? []).filter((r) => r.outcome === 'FAILURE').length;
  return (
    <div className="ea-screen" data-test="audit-events">
      <SyncStatusBar
        tone={failure > 0 ? 'warning' : 'success'}
        title="Alerts & activity"
        statusLabel={`${(sysRows ?? []).length} events`}
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
                  <td>
                    <Status tone={
                      e.outcome === 'SUCCESS' ? 'success'
                      : e.outcome === 'FAILURE' ? 'danger' : 'info'}>
                      {e.outcome}
                    </Status>
                  </td>
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

/* ─── /reports/operational ────────────────────────────────────────── */
/** FR-15-10 — Operational report.
 *
 *  Central-vs-local operational picture for the facility. Reads
 *  /admin/ops/reports/operational for the authoritative local-vs-
 *  central split, then layers in the last-50 jobs summary + current
 *  worker backlog so ADMINs get everything they need on one screen
 *  without chasing between /sync/history and /journal/worker. */
export function MockupOperationalReport(): JSX.Element {
  const [report, setReport] = useState<edgeApi.OperationalReport | null>(null);
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);
  const [worker, setWorker] = useState<edgeApi.WorkerHealth | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function reload(): Promise<void> {
    setRefreshing(true);
    try {
      const [a, b, c] = await Promise.allSettled([
        edgeApi.fetchOperationalReport(),
        edgeApi.listJobs(50),
        edgeApi.workerHealth(),
      ]);
      if (a.status === 'fulfilled') setReport(a.value);
      else { setErr(a.reason instanceof Error ? a.reason.message : String(a.reason)); return; }
      if (b.status === 'fulfilled') setJobs(b.value);
      if (c.status === 'fulfilled') setWorker(c.value);
    } finally { setRefreshing(false); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  if (err && !report) {
    return <ErrorBlock title="Operational report failed"
                        testId="err-ops-report">{err}</ErrorBlock>;
  }
  if (!report) return <LoadingBlock testId="loading" />;

  const syncedPct = report.centralConfirmed + report.localOnly > 0
    ? Math.round(100 * report.centralConfirmed
                 / (report.centralConfirmed + report.localOnly))
    : null;

  const jobsSucceeded = jobs?.filter((j) =>
    j.outcome === 'SUCCEEDED' || j.outcome === 'SUCCESS').length ?? 0;
  const jobsFailed = jobs?.filter((j) =>
    j.outcome === 'FAILED' || j.outcome === 'FAILURE').length ?? 0;
  const workerEnabled = worker?.enabled ?? false;
  const backlogTotal = worker
    ? Object.values(worker.backlog).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="ea-screen" data-test="ops-report">
      <SyncStatusBar
        tone={report.localOnly > 0 ? 'warning' : 'success'}
        title="Operational report"
        statusLabel={
          syncedPct == null ? 'No records yet'
          : syncedPct === 100 ? 'Fully synchronised'
          : `${syncedPct}% synchronised`
        }
        subtitle={
          <>
            <span>Local-vs-central reconciliation across captured records.</span>
            <span>·</span>
            <span>Generated <strong style={{ color: 'var(--der-ink-900)' }}>
              {fmtAgo(report.generatedAt)}
            </strong></span>
          </>
        }
        actions={
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  disabled={refreshing}
                  data-test="ops-report-refresh"
                  onClick={() => { reload().catch(() => undefined); }}>
            <UiIcon icon="refresh" size={14} />
            <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        }
      />

      <Panel title="Local vs. central">
        <div className="ea-stat-strip">
          <div className="ea-stat ea-stat--success">
            <div className="ea-stat-value" data-test="ops-central-confirmed">
              {report.centralConfirmed.toLocaleString()}
            </div>
            <div className="ea-stat-label">Central-confirmed</div>
          </div>
          <div className="ea-stat ea-stat--warning">
            <div className="ea-stat-value" data-test="ops-local-only">
              {report.localOnly.toLocaleString()}
            </div>
            <div className="ea-stat-label">Local-only (PENDING + RETRYABLE)</div>
          </div>
          <div className="ea-stat ea-stat--info">
            <div className="ea-stat-value" data-test="ops-synced-pct">
              {syncedPct == null ? '—' : `${syncedPct}%`}
            </div>
            <div className="ea-stat-label">Central reach</div>
          </div>
        </div>
        <p className="ea-text-muted"
           style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5 }}
           data-test="ops-note">
          {report.note}
        </p>
      </Panel>

      <Panel title="Journal by state"
             action={
               <Link to="/data/queue" className="ea-link-btn"
                      data-cross-module="Data"
                      data-test="ops-open-queue">
                 Open queue →
               </Link>
             }>
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense" data-test="ops-by-state">
            <thead><tr><th>State</th><th>Count</th></tr></thead>
            <tbody>
              {Object.entries(report.byState).map(([state, count]) => (
                <tr key={state} data-test={`ops-state-${state}`}>
                  <td>
                    <Status tone={
                      state === 'CENTRAL_ACCEPTED' ? 'success'
                      : state === 'CENTRAL_REJECTED' || state === 'FAILED' ? 'danger'
                      : state === 'PENDING' || state === 'RETRYABLE' || state === 'CONFLICT_REVIEW' ? 'warning'
                      : 'info'}>
                      {humaniseState(state)}
                    </Status>
                  </td>
                  <td className="ea-mono">{count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Sync job outcomes (last 50 runs)"
             action={
               <Link to="/sync/history" className="ea-link-btn"
                      data-cross-module="Sync"
                      data-test="ops-open-history">
                 Open sync history →
               </Link>
             }>
        {!jobs ? (
          <p className="ea-text-muted" style={{ margin: 0, fontSize: 12 }}>
            Loading…
          </p>
        ) : jobs.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, fontSize: 12 }}
             data-test="ops-jobs-empty">
            No scheduled jobs have run yet on this edge.
          </p>
        ) : (
          <div className="ea-stat-strip">
            <div className="ea-stat ea-stat--success">
              <div className="ea-stat-value" data-test="ops-jobs-succeeded">
                {jobsSucceeded}
              </div>
              <div className="ea-stat-label">Succeeded</div>
            </div>
            <div className="ea-stat ea-stat--danger">
              <div className="ea-stat-value" data-test="ops-jobs-failed">
                {jobsFailed}
              </div>
              <div className="ea-stat-label">Failed</div>
            </div>
            <div className="ea-stat ea-stat--muted">
              <div className="ea-stat-value" data-test="ops-jobs-total">
                {jobs.length}
              </div>
              <div className="ea-stat-label">Total runs captured</div>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Worker status"
             action={
               <Link to="/journal/worker" className="ea-link-btn"
                      data-cross-module="Worker"
                      data-test="ops-open-worker">
                 Open worker →
               </Link>
             }>
        {!worker ? (
          <p className="ea-text-muted" style={{ margin: 0, fontSize: 12 }}>
            Loading…
          </p>
        ) : (
          <dl className="ea-def-list">
            <div className="ea-def-row"><dt>Worker</dt>
              <dd data-test="ops-worker-enabled">
                <Status tone={workerEnabled ? 'success' : 'warning'}>
                  {workerEnabled ? 'Enabled' : 'Paused'}
                </Status>
              </dd></div>
            <div className="ea-def-row"><dt>Backlog</dt>
              <dd className="ea-mono" data-test="ops-worker-backlog">
                {backlogTotal.toLocaleString()}
              </dd></div>
          </dl>
        )}
      </Panel>
    </div>
  );
}

/* ─── /configuration ──────────────────────────────────────────────── */
/** FR-15-08 — Operational configuration editor.
 *
 *  Edits runtime keys that OperationsAdminController whitelists for
 *  mutation (crons + backup/TLS flags). Each save writes a
 *  SETTINGS_CHANGED audit event server-side; this screen surfaces
 *  those events alongside so ADMINs can see who changed what and
 *  when without jumping to /audit/events. */
export function MockupConfigEditor(): JSX.Element {
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<edgeApi.SecurityAuditEvent[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function reload(): Promise<void> {
    try {
      const r = await edgeApi.readOpsSettings();
      setSettings(r.settings);
      setDraft(r.settings);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    try {
      setHistory(await edgeApi.securityAuditEvents({
        eventType: 'SETTINGS_CHANGED', limit: 25,
      }));
    } catch { /* leave previous */ }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  async function saveKey(key: string): Promise<void> {
    setSavingKey(key); setErr(null); setMsg(null);
    try {
      await edgeApi.writeOpsSetting(key, draft[key] ?? '');
      setMsg(`${key} saved.`);
      setTimeout(() => setMsg((m) => (m?.startsWith(key) ? null : m)), 2500);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setSavingKey(null); }
  }

  if (err && !settings) {
    return <ErrorBlock title="Configuration load failed"
                        testId="err-config-load">{err}</ErrorBlock>;
  }
  if (!settings) return <LoadingBlock testId="loading" />;

  const entries = Object.entries(settings);
  const dirty = entries.filter(([k, v]) => draft[k] !== v);

  return (
    <div className="ea-screen" data-test="config-editor">
      <SyncStatusBar
        tone={dirty.length > 0 ? 'warning' : 'info'}
        title="Configuration"
        statusLabel={`${entries.length} keys`}
        subtitle={
          <>
            <span>Runtime-tunable DER settings with per-change audit trail.</span>
            {dirty.length > 0 && (<>
              <span>·</span>
              <span>
                <strong style={{ color: 'var(--der-warning-ink)' }}>
                  {dirty.length} unsaved change{dirty.length === 1 ? '' : 's'}
                </strong>
              </span>
            </>)}
          </>
        }
      />

      {err && <ErrorBlock title="Save failed" testId="err-config-save">{err}</ErrorBlock>}
      {msg && <p className="ea-saved" data-test="config-saved">{msg}</p>}

      <Panel title="Settings">
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense" style={{ width: '100%' }}>
            <thead><tr>
              <th>Key</th><th>Value</th><th style={{ width: 120 }}></th>
            </tr></thead>
            <tbody>
              {entries.map(([k, current]) => {
                const next = draft[k] ?? '';
                const changed = next !== current;
                const saving = savingKey === k;
                return (
                  <tr key={k} data-test={`config-row-${k}`}>
                    <td className="ea-mono" style={{ fontSize: 12 }}>{k}</td>
                    <td>
                      <input className="ea-input ea-mono" type="text"
                             style={{ width: '100%', fontSize: 12 }}
                             value={next}
                             data-test={`config-input-${k}`}
                             onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button"
                              className="ea-btn ea-btn--primary ea-btn--sm"
                              disabled={!changed || saving}
                              data-test={`config-save-${k}`}
                              onClick={() => { saveKey(k).catch(() => undefined); }}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Recent changes"
             action={
               <Link to="/audit/events?category=settings"
                      className="ea-link-btn"
                      data-cross-module="Security"
                      data-test="config-open-audit">
                 View full audit →
               </Link>
             }>
        {history.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, fontSize: 12 }}
             data-test="config-history-empty">
            No settings changes recorded on this edge yet.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense"
                   data-test="config-history">
              <thead><tr>
                <th>When</th><th>Actor</th><th>Change</th><th>Outcome</th>
              </tr></thead>
              <tbody>
                {history.map((e, i) => (
                  <tr key={`${e.observedAt}-${i}`}>
                    <td className="ea-mono" style={{ fontSize: 12 }}
                        title={e.observedAt}>
                      {fmtAgo(e.observedAt)}
                    </td>
                    <td className="ea-mono" style={{ fontSize: 12 }}>
                      {e.actorUserId?.slice(0, 8) ?? '—'}
                    </td>
                    <td className="ea-mono" style={{ fontSize: 12,
                                                      wordBreak: 'break-word' }}>
                      {e.detail ?? '—'}
                    </td>
                    <td>
                      <Status tone={
                        e.outcome === 'SUCCESS' ? 'success'
                        : e.outcome === 'FAILURE' ? 'danger' : 'info'}>
                        {e.outcome}
                      </Status>
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

/* ─── /support-bundle ─────────────────────────────────────────────── */
/** FR-15-09 — Support bundle export.
 *
 *  One-click download of a sanitised diagnostics ZIP (users roster +
 *  pending-journal snapshot + manifest with host/Java/OS) from
 *  /edge-api/v1/admin/ops/support-bundle. Drives a client-side download
 *  via a Blob object URL so the ADMIN session cookie is used
 *  transparently. Each export is server-side audit-logged as
 *  SUPPORT_BUNDLE_EXPORTED. */
export function MockupSupportBundle(): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<{
    filename: string; sizeBytes: number; downloadedAt: string;
  } | null>(null);

  async function download(): Promise<void> {
    setBusy(true); setErr(null);
    try {
      const { blob, filename } = await edgeApi.fetchSupportBundle();
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setLastExport({
        filename, sizeBytes: blob.size,
        downloadedAt: new Date().toISOString(),
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ea-screen" data-test="support-bundle">
      <SyncStatusBar
        tone="info"
        title="Support bundle"
        statusLabel={lastExport ? 'Ready' : 'Not yet exported'}
        subtitle={
          <>
            <span>
              Sanitised diagnostics bundle for sharing with DER support.
              Includes build metadata, a snapshot of pending journal
              operations, and the current users roster.
            </span>
            <span>·</span>
            <span>
              <strong style={{ color: 'var(--der-ink-900)' }}>No PHI / operational
              data</strong> is included — only operator identities and
              per-operation metadata.
            </span>
          </>
        }
        actions={
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  disabled={busy}
                  data-test="support-bundle-download"
                  onClick={() => { download().catch(() => undefined); }}>
            <UiIcon icon="download" size={14} />
            <span>{busy ? 'Preparing…' : 'Export support bundle'}</span>
          </button>
        }
      />

      {err && <ErrorBlock title="Support bundle export failed"
                            testId="err-support-bundle">{err}</ErrorBlock>}

      <Panel title="What's in the bundle">
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li><strong>manifest.json</strong> — generated-at timestamp,
            generating user ID, hostname, Java + OS version</li>
          <li><strong>users.json</strong> — sanitised users roster
            (user IDs, display names, roles, origin, permission age).
            <em> No password hashes or session tokens.</em></li>
          <li><strong>journal-recent.json</strong> — the 50 most recent
            pending operations (ID, entity type, state, attempt count,
            created timestamp). <em>No payload content.</em></li>
        </ul>
      </Panel>

      {lastExport && (
        <Panel title="Last export">
          <dl className="ea-def-list">
            <div className="ea-def-row"><dt>File</dt>
              <dd className="ea-mono" data-test="support-bundle-filename">
                {lastExport.filename}
              </dd></div>
            <div className="ea-def-row"><dt>Size</dt>
              <dd className="ea-mono" data-test="support-bundle-size">
                {fmtBytes(lastExport.sizeBytes)}
              </dd></div>
            <div className="ea-def-row"><dt>Downloaded</dt>
              <dd className="ea-mono">{fmtDate(lastExport.downloadedAt)}</dd></div>
          </dl>
        </Panel>
      )}

      <Panel title="Audit trail">
        <p className="ea-text-muted" style={{ margin: 0, fontSize: 13 }}>
          Every export is logged to the DER security audit as
          <code> SUPPORT_BUNDLE_EXPORTED</code>.{' '}
          <Link to="/audit/events" className="ea-link-btn"
                 data-cross-module="Security"
                 data-test="support-bundle-audit-link">
            View audit log →
          </Link>
        </p>
      </Panel>
    </div>
  );
}
