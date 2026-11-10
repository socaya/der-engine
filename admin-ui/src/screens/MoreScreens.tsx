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
import { ResponseBody } from '../components/ResponseBody';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/ScreenStates';

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
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);
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
  const expanded = expandedEntity
    ? d?.perEntity?.[expandedEntity] ?? null
    : null;

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
            <table className="ea-table ea-table--dense ea-table--selectable"
                   data-test="drift-table">
              <thead><tr>
                <th>Entity</th><th>Added</th><th>Removed</th><th>Changed</th><th>Net</th>
              </tr></thead>
              <tbody>
                {paged.rows.map((r) => {
                  const active = r.entity === expandedEntity;
                  return (
                    <tr key={r.entity}
                        data-test={`drift-row-${r.entity}`}
                        onClick={() => setExpandedEntity(active ? null : r.entity)}
                        className={active ? 'ea-row-selected' : ''}
                        style={{ cursor: 'pointer' }}>
                      <td>{r.entity}</td>
                      <td className="ea-mono" style={{ color: r.added ? 'var(--der-success-ink)' : undefined }}>{r.added}</td>
                      <td className="ea-mono" style={{ color: r.removed ? 'var(--der-danger-ink)' : undefined }}>{r.removed}</td>
                      <td className="ea-mono" style={{ color: r.changed ? 'var(--der-warning-ink)' : undefined }}>{r.changed}</td>
                      <td className="ea-mono">{r.net}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePager {...paged.pagerProps} />
          </div>
        )}
      </Panel>

      {expandedEntity && expanded && (
        <Panel title={`Drift detail — ${expandedEntity}`}
               action={
                 <div style={{ display: 'flex', gap: 8 }}>
                   <Link to={`/dhis2/metadata?resource=${encodeURIComponent(expandedEntity)}`}
                         className="ea-btn ea-btn--ghost ea-btn--sm"
                         data-cross-module="DHIS2"
                         data-test="drift-detail-open-metadata">
                     <UiIcon icon="metadata" size={14} />
                     <span>Open in metadata browser</span>
                   </Link>
                   <button type="button"
                           className="ea-btn ea-btn--ghost ea-btn--sm"
                           data-test="drift-detail-close"
                           onClick={() => setExpandedEntity(null)}>
                     Close
                   </button>
                 </div>
               }>
          <dl className="ea-def-list"
              data-test={`drift-detail-${expandedEntity}`}>
            <div className="ea-def-row">
              <dt>Snapshot pair</dt>
              <dd className="ea-mono">
                {d.snapshotFrom ?? '—'} → {d.snapshotTo ?? '—'}
              </dd>
            </div>
            <div className="ea-def-row">
              <dt>Reconciliation</dt>
              <dd className="ea-text-muted">
                Next metadata-sync pull reconciles these IDs. No write-back to Central.
              </dd>
            </div>
          </dl>
          <div className="ea-drift-detail-grid">
            <DriftDetailColumn
              title="Added"
              tone="success"
              ids={expanded.added}
              testId="drift-detail-added" />
            <DriftDetailColumn
              title="Removed"
              tone="danger"
              ids={expanded.removed}
              testId="drift-detail-removed" />
            <DriftDetailColumn
              title="Changed"
              tone="warning"
              ids={expanded.changed}
              testId="drift-detail-changed" />
          </div>
        </Panel>
      )}

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

/** One column of the per-entity drift detail grid. Shows the first 20
 *  IDs with a +N more collapse — avoids dumping 5000 dataElement UIDs
 *  into the DOM on large drifts. */
function DriftDetailColumn(
  { title, tone, ids, testId }:
    { title: string; tone: 'success' | 'danger' | 'warning';
      ids: string[]; testId: string },
): JSX.Element {
  const limit = 20;
  const shown = ids.slice(0, limit);
  const overflow = Math.max(0, ids.length - limit);
  return (
    <div className="ea-drift-detail-col" data-test={testId}>
      <div className="ea-subheading">
        <Status tone={tone}>{title}</Status>
        <span className="ea-text-muted"
              style={{ marginLeft: 6, fontSize: 11 }}>
          {ids.length}
        </span>
      </div>
      {ids.length === 0 ? (
        <p className="ea-text-muted" style={{ margin: 0, fontSize: 12 }}>
          None.
        </p>
      ) : (
        <ul className="ea-inline-list">
          {shown.map((id) => (
            <li key={id} className="ea-mono"
                data-test={`${testId}-id-${id}`}>{id}</li>
          ))}
          {overflow > 0 && (
            <li className="ea-text-muted"
                data-test={`${testId}-more`}>+{overflow} more</li>
          )}
        </ul>
      )}
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
type ConflictStrategy = 'ACCEPT' | 'REJECT' | 'REJOURNAL';

const STRATEGY_LABELS: Record<ConflictStrategy,
    { title: string; summary: string }> = {
  ACCEPT: {
    title: 'Accept local',
    summary: 'Mark the local version as applied without pushing it again. Central keeps whatever it currently has.',
  },
  REJECT: {
    title: 'Reject local',
    summary: 'Discard the local version. The record is marked as rejected and will not be retried.',
  },
  REJOURNAL: {
    title: 'Retry (re-journal)',
    summary: 'Clone this operation as a fresh PENDING entry so the sync worker tries again on the next drain tick.',
  },
};

export function AttentionDetailScreen(): JSX.Element {
  const { operationId } = useParams<{ operationId: string }>();
  const navigate = useNavigate();
  const [row, setRow] = useState<edgeApi.ConflictRow | null>(null);
  const [strategy, setStrategy] = useState<ConflictStrategy | null>(null);
  const [rationale, setRationale] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
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

  /* Rationale is required for the two finalising paths (ACCEPT/REJECT)
   * because the DB stores it on resolve for operator-audit purposes.
   * REJOURNAL ignores the rationale server-side, so we don't enforce it
   * there. Min 10 chars to force a real explanation. */
  function rationaleOk(): boolean {
    if (strategy === 'REJOURNAL') return true;
    return rationale.trim().length >= 10;
  }

  async function submit(): Promise<void> {
    if (!row || !strategy || !rationaleOk()) return;
    const label = STRATEGY_LABELS[strategy].title.toLowerCase();
    if (!window.confirm(
      `${STRATEGY_LABELS[strategy].title} on `
      + `${entityTypeLabel(row.entityType)} "${row.entityRef}"?\n\n`
      + `This resolution is recorded in the audit log and ${label} cannot be undone.`)) return;
    setBusy(true); setActionErr(null);
    try {
      if (strategy === 'REJOURNAL') {
        await edgeApi.reJournalConflict(row.operationId);
      } else {
        const outcome = strategy === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
        await edgeApi.resolveConflict(row.operationId, outcome, rationale.trim());
      }
      navigate('/sync/attention');
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
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
    <div className="ea-screen" data-test="conflict-detail">
      <BackLink to="/sync/attention" label="Back to attention list" />
      <SyncStatusBar
        tone={prio === 'High' ? 'danger' : prio === 'Medium' ? 'warning' : 'info'}
        title={`${entityTypeLabel(row.entityType)} · ${row.entityRef}`}
        statusLabel={prio + ' priority'}
        subtitle={<span>{problem.label}</span>}
        actions={
          <>
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
      </Panel>
      <Panel title="Resolution">
        {actionErr && (
          <div className="ea-callout ea-callout--danger"
               role="alert" data-test="conflict-resolve-err">{actionErr}</div>
        )}
        <fieldset className="ea-field" data-test="conflict-strategy">
          <legend className="ea-field-label">Strategy</legend>
          <div className="ea-radio-group">
            {(['ACCEPT', 'REJECT', 'REJOURNAL'] as const).map((s) => (
              <label key={s} className="ea-radio">
                <input type="radio" name="conflict-strategy"
                       data-test={`conflict-strategy-${s.toLowerCase()}`}
                       value={s} checked={strategy === s}
                       onChange={() => setStrategy(s)} />
                <span>
                  <strong>{STRATEGY_LABELS[s].title}</strong>
                  <span className="ea-text-muted" style={{ marginLeft: 8 }}>
                    — {STRATEGY_LABELS[s].summary}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {strategy && strategy !== 'REJOURNAL' && (
          <div className="ea-field">
            <label className="ea-field-label" htmlFor="conflict-rationale">
              Rationale
            </label>
            <textarea id="conflict-rationale"
                      data-test="conflict-rationale"
                      className="ea-input"
                      rows={3}
                      value={rationale}
                      maxLength={2000}
                      onChange={(e) => setRationale(e.target.value)} />
            <span className="ea-field-hint">
              {rationale.trim().length < 10
                ? `Min 10 chars (${rationale.trim().length} entered).`
                : `${rationale.trim().length} chars.`}
            </span>
          </div>
        )}

        {strategy && (
          <div className="ea-callout ea-callout--info"
               data-test="conflict-preview">
            <strong>Preview:</strong> {STRATEGY_LABELS[strategy].summary}
          </div>
        )}

        <div className="ea-mapping-form-actions">
          <button type="button" className="ea-btn ea-btn--primary"
                  data-test="conflict-submit"
                  disabled={busy || strategy == null || !rationaleOk()}
                  onClick={() => { submit().catch(() => undefined); }}>
            {busy ? 'Submitting…' : 'Resolve conflict'}
          </button>
        </div>
      </Panel>
      <TeiUidMigrationPanel row={row}
                             onMigrated={() => navigate('/sync/attention')} />
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

/** SM-3a — surfaced on attention rows whose central rejection was
 *  caused by a legacy UUID-shaped TEI UID ("UID must be an
 *  alphanumeric string of 11 characters…"). Lets the operator mint
 *  a DHIS2-shaped UID for the TEI + requeue every row that was
 *  stuck on it, without a shell / SQL trip.
 *
 *  <p>Only renders when the row's error signals the UID shape or
 *  when the TEI UID carried in the entity_ref / payload is itself
 *  a UUID. For non-TRACKED_ENTITY entity types we read teiUid from
 *  the payload (ENROLLMENT, PROGRAM_STAGE_EVENT payloads carry
 *  it).</p> */
function TeiUidMigrationPanel(
  { row, onMigrated }:
    { row: edgeApi.ConflictRow; onMigrated: () => void },
): JSX.Element | null {
  const [newUid, setNewUid] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<edgeApi.TeiMigrateResult | null>(null);

  const legacyTeiUid: string | null = (() => {
    const isLegacy = (s: string | null | undefined): boolean =>
      !!s && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s);
    if (isLegacy(row.entityRef)
        && row.entityType.toUpperCase() === 'TRACKED_ENTITY') {
      return row.entityRef;
    }
    const p = row.payload ?? {};
    const candidates = ['teiUid', 'trackedEntity', 'trackedEntityUid'];
    for (const k of candidates) {
      const v = (p as Record<string, unknown>)[k];
      if (typeof v === 'string' && isLegacy(v)) return v;
    }
    return null;
  })();

  const errorMentionsUidShape = !!row.lastError
      && /UID must be an alphanumeric string of 11 characters/i
        .test(row.lastError);

  if (!legacyTeiUid && !errorMentionsUidShape) return null;
  if (!legacyTeiUid) return null;

  async function run(): Promise<void> {
    if (!legacyTeiUid) return;
    if (!window.confirm(
        `Migrate TEI UID\n  from ${legacyTeiUid}\n  to   `
      + `${newUid.trim() || '(server-minted)'}\n\n`
      + 'This rewrites the UID across every table + journal row that '
      + 'references it, and re-queues any rows stuck on the legacy '
      + 'UID. The change is transactional but irreversible.')) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await edgeApi.migrateTeiUid(legacyTeiUid,
          newUid.trim() || undefined);
      setPreview(res);
      setTimeout(() => onMigrated(), 1500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Legacy UID migration">
      <p className="ea-text-muted" style={{ margin: '0 0 10px',
                                             fontSize: 12 }}>
        This TEI's UID is a 36-char UUID left over from a pre-fix
        install. Central rejects it on every drain. Mint a valid
        DHIS2 UID to unblock sync for this TEI and everything that
        references it.
      </p>
      <div style={{ fontSize: 12, marginBottom: 10 }}>
        <strong>Legacy UID:</strong>{' '}
        <code>{legacyTeiUid}</code>
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center',
                       flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: 12, minWidth: 100 }}>New UID</span>
        <input value={newUid}
               onChange={(e) => setNewUid(e.target.value)}
               placeholder="(leave blank to let the server mint one)"
               data-test="tei-migrate-newuid"
               style={{ flex: 1, minWidth: 220, padding: '4px 8px',
                         fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                         fontSize: 13,
                         border: '1px solid var(--der-border-soft, #cbd5e1)',
                         borderRadius: 4 }} />
      </label>
      {err && (
        <div className="ea-callout ea-callout--danger"
             role="alert"
             data-test="tei-migrate-err"
             style={{ marginBottom: 8 }}>{err}</div>
      )}
      {preview && (
        <div className="ea-callout ea-callout--info"
             data-test="tei-migrate-ok"
             style={{ marginBottom: 8 }}>
          <strong>Migrated.</strong> {preview.oldUid} → {preview.newUid}.{' '}
          {Object.entries(preview.affected).map(
            ([k, v]) => `${k}=${v}`).join(', ')}.
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button"
                className="ea-btn ea-btn--primary"
                data-test="tei-migrate-run"
                disabled={busy}
                onClick={() => { void run(); }}>
          {busy ? 'Migrating…' : 'Migrate TEI UID'}
        </button>
      </div>
    </Panel>
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
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--der-ink-700)' }}>
          <strong style={{ display: 'block', marginBottom: 4 }}>Last error:</strong>
          <ResponseBody text={central.lastError} />
        </div>
      )}
    </Panel>
  );
}

/* ─── /sync/worker ───────────────────────────────────────────────── */
/** DER Sync requirements §10. One status card + Pause/Resume + an
 *  optional queue breakdown behind "Show breakdown". */
export function WorkerHealthScreen(): JSX.Element {
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

      {w.tune && (
        <WorkerTunePanel
          current={w.tune}
          onApplied={() => { reload().catch(() => undefined); }} />
      )}
    </div>
  );
}

/** SM-3c — adjust batch size + backoff live. Values persist only
 *  until the server restarts; the env-var baselines take back over.
 *  Range hints come from the server's validation code: batchSize
 *  [1, 500], backoffBase [1, cap], backoffCap [base, 86400]. */
function WorkerTunePanel(
  { current, onApplied }: {
    current: edgeApi.WorkerTune;
    onApplied: () => void;
  },
): JSX.Element {
  const [batchSize, setBatchSize] = useState<number>(current.batchSize);
  const [base, setBase] = useState<number>(current.backoffBaseSeconds);
  const [cap, setCap] = useState<number>(current.backoffCapSeconds);
  const [saving, setSaving] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    setBatchSize(current.batchSize);
    setBase(current.backoffBaseSeconds);
    setCap(current.backoffCapSeconds);
  }, [current.batchSize, current.backoffBaseSeconds, current.backoffCapSeconds]);

  const dirty = batchSize !== current.batchSize
    || base !== current.backoffBaseSeconds
    || cap !== current.backoffCapSeconds;

  async function save(): Promise<void> {
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      const body: Partial<edgeApi.WorkerTune> = {};
      if (batchSize !== current.batchSize) body.batchSize = batchSize;
      if (base !== current.backoffBaseSeconds) body.backoffBaseSeconds = base;
      if (cap !== current.backoffCapSeconds) body.backoffCapSeconds = cap;
      await edgeApi.tuneWorker(body);
      setOk('Applied — next drain tick uses these values.');
      onApplied();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Worker tune">
      <p className="ea-text-muted" style={{ margin: '0 0 10px', fontSize: 12 }}>
        Live knobs for the drain loop. Changes apply to the next tick.
        Reset to the env-var baselines happens on server restart.
      </p>
      <div style={{ display: 'grid',
                     gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                     gap: 12 }}
           data-test="worker-tune-grid">
        <label>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>
            Batch size <span className="ea-text-muted">(1–500)</span>
          </span>
          <input type="number" min={1} max={500} value={batchSize}
                 onChange={(e) => setBatchSize(Number(e.target.value))}
                 data-test="worker-tune-batch"
                 style={{ width: '100%', padding: '6px 8px',
                           border: '1px solid var(--der-border-soft, #cbd5e1)',
                           borderRadius: 4 }} />
        </label>
        <label>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>
            Backoff base (s) <span className="ea-text-muted">(≤ cap)</span>
          </span>
          <input type="number" min={1} value={base}
                 onChange={(e) => setBase(Number(e.target.value))}
                 data-test="worker-tune-base"
                 style={{ width: '100%', padding: '6px 8px',
                           border: '1px solid var(--der-border-soft, #cbd5e1)',
                           borderRadius: 4 }} />
        </label>
        <label>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>
            Backoff cap (s) <span className="ea-text-muted">(≤ 86400)</span>
          </span>
          <input type="number" min={1} max={86400} value={cap}
                 onChange={(e) => setCap(Number(e.target.value))}
                 data-test="worker-tune-cap"
                 style={{ width: '100%', padding: '6px 8px',
                           border: '1px solid var(--der-border-soft, #cbd5e1)',
                           borderRadius: 4 }} />
        </label>
      </div>
      {err && (
        <div className="ea-toast ea-toast--err" role="alert"
             data-test="worker-tune-err"
             style={{ marginTop: 10 }}>{err}</div>
      )}
      {ok && (
        <div className="ea-toast ea-toast--ok" role="status"
             data-test="worker-tune-ok"
             style={{ marginTop: 10 }}>{ok}</div>
      )}
      <div style={{ marginTop: 12, display: 'flex',
                     justifyContent: 'flex-end' }}>
        <button type="button"
                className="ea-btn ea-btn--primary"
                data-test="worker-tune-save"
                disabled={!dirty || saving}
                onClick={() => { void save(); }}>
          {saving ? 'Saving…' : 'Apply tune'}
        </button>
      </div>
    </Panel>
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
        actions={
          <>
            <Link to="/devices/enrolment"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Access"
                  data-test="dev-fleet-open-enrolment">
              <UiIcon icon="enrollment" size={14} />
              <span>Device enrolment</span>
            </Link>
            <Link to="/devices/diagnostics"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Access"
                  data-test="dev-fleet-open-diagnostics">
              <UiIcon icon="diagnostics" size={14} />
              <span>Device diagnostics</span>
            </Link>
            <Link to="/devices/ownership"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Access"
                  data-test="dev-fleet-open-ownership">
              <UiIcon icon="worker" size={14} />
              <span>Ownership</span>
            </Link>
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
type BackupSection = 'schedule' | 'pitr' | 'verify' | 'runs';

export function MockupBackupList(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get('section');
  const activeSection: BackupSection =
    sectionParam === 'pitr' || sectionParam === 'verify' || sectionParam === 'runs'
      ? sectionParam : 'schedule';
  function goTo(section: BackupSection): void {
    const next = new URLSearchParams(searchParams);
    if (section === 'schedule') next.delete('section');
    else next.set('section', section);
    setSearchParams(next, { replace: true });
  }
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

      <nav className="ea-section-tabs"
           role="tablist"
           aria-label="Backup sections"
           data-test="backup-sections">
        <BackupSectionTab
          id="schedule" label="Schedule" icon="schedule"
          active={activeSection === 'schedule'}
          onClick={() => goTo('schedule')} />
        <BackupSectionTab
          id="pitr" label="PITR / WAL" icon="storage"
          count={wal?.segmentCount ?? undefined}
          active={activeSection === 'pitr'}
          onClick={() => goTo('pitr')} />
        <BackupSectionTab
          id="verify" label="Verification" icon="diagnostics"
          count={verifyHist.length || undefined}
          active={activeSection === 'verify'}
          onClick={() => goTo('verify')} />
        <BackupSectionTab
          id="runs" label="Runs" icon="history"
          count={rows.length || undefined}
          active={activeSection === 'runs'}
          onClick={() => goTo('runs')} />
      </nav>
      <div data-test="backup-section-body">
        {activeSection === 'schedule' && (
            <BackupScheduleEditor
              cron={cron}
              lastSuccess={lastSuccess ?? null}
              settings={settings}
              onSaved={() => { void reload(); }}
            />
          )}

          {activeSection === 'pitr' && (
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
          )}

          {activeSection === 'verify' && (
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
          )}

        {activeSection === 'runs' && (
          <Panel title="Backup runs">
            {rows.length === 0 ? (
              <p className="ea-text-muted" style={{ margin: 0 }}>No backups yet.</p>
            ) : (
              <BackupRunsTable rows={rows} />
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}

function BackupSectionTab(
  { id, label, icon, count, active, onClick }:
    { id: string; label: string;
      icon: 'schedule' | 'storage' | 'diagnostics' | 'history';
      count?: number; active: boolean; onClick: () => void },
): JSX.Element {
  return (
    <button type="button"
            role="tab"
            className={'ea-section-tab'
              + (active ? ' ea-section-tab--active' : '')}
            aria-selected={active}
            data-test={`backup-section-${id}`}
            onClick={onClick}>
      <UiIcon icon={icon} size={14} />
      <span>{label}</span>
      {count != null && count > 0 && (
        <span className="ea-text-muted" style={{ fontSize: 11 }}>· {count}</span>
      )}
    </button>
  );
}

/** Inline cron editor for the backup rotation schedule. Lives on the
 *  Backup page so admins never have to jump to the Sync scheduler to
 *  change the backup cadence; posts to the same /admin/settings
 *  endpoint but with just the backup.rotate key flipped. */
function BackupScheduleEditor(
  { cron, lastSuccess, settings, onSaved }:
    { cron: string | null;
      lastSuccess: edgeApi.BackupRow | null;
      settings: edgeApi.SettingsPayload | null;
      onSaved: () => void },
): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cron ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function startEdit(): void {
    setDraft(cron ?? '');
    setErr(null);
    setEditing(true);
  }

  async function save(): Promise<void> {
    if (!settings) return;
    setSaving(true); setErr(null);
    try {
      await edgeApi.saveSettings({
        ...settings,
        cron: { ...settings.cron, 'backup.rotate': draft.trim() },
      });
      setEditing(false);
      onSaved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  }

  return (
    <Panel title="Backup schedule"
           action={!editing && (
             <button type="button"
                     className="ea-btn ea-btn--ghost ea-btn--sm"
                     data-test="backup-schedule-edit"
                     disabled={!settings}
                     onClick={startEdit}>
               <UiIcon icon="edit" size={14} />
               <span>Edit cron</span>
             </button>
           )}>
      <dl className="ea-def-list">
        <div className="ea-def-row">
          <dt>Backup cron</dt>
          <dd>
            {editing ? (
              <div className="ea-field" style={{ margin: 0 }}>
                <input type="text"
                       className="ea-input ea-mono"
                       data-test="backup-cron-input"
                       value={draft}
                       autoFocus
                       onChange={(e) => setDraft(e.target.value)} />
                <span className="ea-field-hint">
                  <code>seconds minutes hours day-of-month month day-of-week</code>
                </span>
              </div>
            ) : (
              <span className="ea-mono" data-test="backup-cron">{cron ?? '—'}</span>
            )}
          </dd>
        </div>
        <div className="ea-def-row">
          <dt>Last successful backup</dt>
          <dd>
            {lastSuccess
              ? <>{fmtDate(lastSuccess.requestedAt)}{' '}
                  <span className="ea-text-muted">· {fmtAgo(lastSuccess.requestedAt)}</span></>
              : <span className="ea-text-muted">never</span>}
          </dd>
        </div>
      </dl>
      {err && (
        <div className="ea-callout ea-callout--danger" role="alert"
             data-test="backup-schedule-err">{err}</div>
      )}
      {editing && (
        <div className="ea-mapping-form-actions">
          <button type="button"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-test="backup-schedule-cancel"
                  disabled={saving}
                  onClick={() => setEditing(false)}>Cancel</button>
          <button type="button"
                  className="ea-btn ea-btn--primary ea-btn--sm"
                  data-test="backup-schedule-save"
                  disabled={saving || draft.trim().length === 0}
                  onClick={() => { void save(); }}>
            {saving ? 'Saving…' : 'Save schedule'}
          </button>
        </div>
      )}
    </Panel>
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
  const [backups, setBackups] = useState<edgeApi.BackupRow[]>([]);
  const [verifyHist, setVerifyHist] = useState<edgeApi.BackupVerifyRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [kind, setKind] = useState<edgeApi.RestoreKind>('LOCAL');
  const [localRunId, setLocalRunId] = useState<string>('');
  const [remoteUri, setRemoteUri] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload(): Promise<void> {
    const [a, b, c] = await Promise.allSettled([
      edgeApi.listRestores(),
      edgeApi.listBackups(),
      edgeApi.backupVerifyHistory(25),
    ]);
    if (a.status === 'fulfilled') setRows(a.value);
    else { setErr(a.reason instanceof Error ? a.reason.message : String(a.reason)); return; }
    if (b.status === 'fulfilled') setBackups(b.value);
    if (c.status === 'fulfilled') setVerifyHist(c.value);
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  /* EA-31 §"Show backup identity, version, checksum, scope,
   * verification results": restore from a LOCAL backup needs to show
   * the selected backup's run + the latest verify row for it so the
   * operator sees what they're about to replay. */
  const successBackups = backups.filter((b) => b.status === 'SUCCESS');
  const selected = successBackups.find((b) => String(b.runId) === localRunId);
  const selectedVerify = selected
    ? verifyHist.find((v) => v.backupRunId === selected.runId) ?? null
    : null;

  function canSubmit(): boolean {
    if (busy) return false;
    if (kind === 'LOCAL') return selected != null;
    if (kind === 'REMOTE') return remoteUri.trim().length > 0;
    return uploadFile != null;
  }

  async function submit(): Promise<void> {
    if (!canSubmit()) return;
    const label = kind === 'LOCAL' ? `backup run #${selected!.runId}`
      : kind === 'REMOTE' ? remoteUri.trim()
      : uploadFile!.name;
    if (!window.confirm(
      `Restore from ${label}?\n\nThis overwrites the local database.`)) return;
    setBusy(true); setMsg(null); setErr(null);
    try {
      let source: string;
      if (kind === 'UPLOAD') {
        const up = await edgeApi.uploadRestoreArchive(uploadFile!);
        source = up.uploadKey;
      } else if (kind === 'LOCAL') {
        source = `backup-run://${selected!.runId}`;
      } else {
        source = remoteUri.trim();
      }
      await edgeApi.requestRestore(kind, source);
      setMsg('Restore request recorded.');
      setRemoteUri(''); setUploadFile(null);
      await reload();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  if (err && !rows) return <ErrorBlock title="Restores failed" testId="err-restore">{err}</ErrorBlock>;
  if (!rows) return <LoadingBlock testId="loading" />;

  return (
    <div className="ea-screen" data-test="restore-tools">
      <SyncStatusBar
        tone="muted"
        title="Restore"
        statusLabel={`${rows.length} on record`}
      />

      {msg && (
        <div className="ea-callout ea-callout--success" role="status"
             data-test="restore-msg">{msg}</div>
      )}
      {err && (
        <ErrorBlock title="Restore action failed" testId="err-restore-action">{err}</ErrorBlock>
      )}

      <Panel title="Request a restore">
        <fieldset className="ea-field" data-test="restore-kind">
          <legend className="ea-field-label">Source</legend>
          <div className="ea-radio-group">
            {(['LOCAL', 'UPLOAD', 'REMOTE'] as const).map((k) => (
              <label key={k} className="ea-radio">
                <input type="radio" name="restore-kind"
                       data-test={`restore-kind-${k.toLowerCase()}`}
                       value={k} checked={kind === k}
                       onChange={() => setKind(k)} />
                <span>
                  {k === 'LOCAL' ? 'Local backup run'
                    : k === 'UPLOAD' ? 'Upload archive'
                    : 'Remote URI'}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {kind === 'LOCAL' && (
          <div className="ea-field">
            <label className="ea-field-label" htmlFor="restore-run-select">
              Backup run
            </label>
            <select id="restore-run-select"
                    className="ea-input"
                    data-test="restore-run-select"
                    value={localRunId}
                    onChange={(e) => setLocalRunId(e.target.value)}>
              <option value="">— choose —</option>
              {successBackups.map((b) => (
                <option key={b.runId} value={String(b.runId)}
                        data-test={`restore-run-opt-${b.runId}`}>
                  #{b.runId} · {b.kind} · {fmtDate(b.requestedAt)}
                </option>
              ))}
            </select>
            {successBackups.length === 0 && (
              <span className="ea-field-hint">No successful backups available.</span>
            )}
          </div>
        )}

        {kind === 'UPLOAD' && (
          <div className="ea-field">
            <label className="ea-field-label" htmlFor="restore-upload">
              Archive
            </label>
            <input type="file" id="restore-upload"
                   data-test="restore-upload"
                   onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
            {uploadFile && (
              <span className="ea-field-hint"
                    data-test="restore-upload-chosen">
                {uploadFile.name} · {Math.round(uploadFile.size / 1024)} KB
              </span>
            )}
          </div>
        )}

        {kind === 'REMOTE' && (
          <label className="ea-field">
            <span className="ea-field-label">Source URI</span>
            <input className="ea-input ea-mono"
                   data-test="restore-remote-uri"
                   value={remoteUri}
                   onChange={(e) => setRemoteUri(e.target.value)}
                   placeholder="file:///path/to/backup.tar.gz" />
          </label>
        )}

        <div className="ea-mapping-form-actions">
          <button type="button" className="ea-btn ea-btn--primary"
                  data-test="restore-submit"
                  disabled={!canSubmit()}
                  onClick={() => { submit().catch(() => undefined); }}>
            {busy ? 'Submitting…' : 'Request restore'}
          </button>
        </div>
      </Panel>

      {kind === 'LOCAL' && selected && (
        <Panel title="Selected backup"
               action={
                 <Status tone={
                   selectedVerify == null ? 'muted'
                     : selectedVerify.outcome === 'PASSED'
                       || selectedVerify.outcome === 'SUCCESS' ? 'success'
                     : 'danger'}>
                   {selectedVerify?.outcome ?? 'Never verified'}
                 </Status>
               }>
          <dl className="ea-def-list" data-test="restore-selected-backup">
            <div className="ea-def-row"><dt>Run ID</dt>
              <dd className="ea-mono">{selected.runId}</dd></div>
            <div className="ea-def-row"><dt>Kind</dt>
              <dd>{selected.kind}</dd></div>
            <div className="ea-def-row"><dt>Requested at</dt>
              <dd className="ea-mono">{fmtDate(selected.requestedAt)}</dd></div>
            <div className="ea-def-row"><dt>Last verification</dt>
              <dd>
                {selectedVerify
                  ? (
                    <>
                      <span className="ea-mono">{fmtDate(selectedVerify.verifiedAt)}</span>
                      {selectedVerify.reason && (
                        <span className="ea-text-muted" style={{ marginLeft: 8, fontSize: 12 }}>
                          · {selectedVerify.reason}
                        </span>
                      )}
                    </>
                  )
                  : <span className="ea-text-muted">
                      Not verified — restore will proceed without a round-trip proof.
                    </span>}
              </dd></div>
          </dl>
        </Panel>
      )}

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

/* ─── /access/dhis2-mappings ──────────────────────────────────────── */
/** ADR-0032 — Edge-user ↔ DHIS2-user mapping editor.
 *
 *  Server-side the mapping table is used by the attribution engine to
 *  stamp every captured record with its DHIS2-side `storedBy`. Without
 *  a mapping an edge operator captures as themselves locally but shows
 *  up as "edge-system" on Central. The editor lists every provisioned
 *  edge user, shows the current mapping (or "Unmapped"), and lets
 *  ADMINs set / clear mappings inline. Every mutation lands a
 *  USER_DHIS2_MAPPING_SET / USER_DHIS2_MAPPING_CLEARED audit event. */
export function MockupDhis2Mappings(): JSX.Element {
  const [searchParams] = useSearchParams();
  const focusUserId = searchParams.get('user');
  const [users, setUsers] = useState<edgeApi.ProvisionedUser[] | null>(null);
  const [mappings, setMappings] = useState<
    Record<string, edgeApi.EdgeUserDhis2Mapping>>({});
  const [err, setErr] = useState<string | null>(null);
  const [savingFor, setSavingFor] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<
    { edgeUserId: string; uid: string; username: string; displayName: string } | null>(null);
  const [query, setQuery] = useState('');

  async function reload(): Promise<void> {
    try {
      const [u, m] = await Promise.all([
        edgeApi.listUsers(), edgeApi.listUserDhis2Mappings(),
      ]);
      setUsers(u.users);
      const byUser: Record<string, edgeApi.EdgeUserDhis2Mapping> = {};
      for (const row of m) byUser[row.edgeUserId] = row;
      setMappings(byUser);
      // Deep-link: if ?user=<id> is set, pre-open the edit dialog for
      // that user (either an existing mapping or a fresh one).
      if (focusUserId) {
        const user = u.users.find((x) => x.userId === focusUserId);
        if (user) {
          const existing = byUser[focusUserId];
          setEditDraft({
            edgeUserId: user.userId,
            uid: existing?.dhis2UserUid ?? '',
            username: existing?.dhis2Username ?? user.username,
            displayName: existing?.dhis2DisplayName
                           ?? user.displayName ?? '',
          });
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload().catch(() => undefined); }, [focusUserId]);

  async function save(): Promise<void> {
    if (!editDraft) return;
    setSavingFor(editDraft.edgeUserId); setErr(null); setMsg(null);
    try {
      await edgeApi.setUserDhis2Mapping(editDraft.edgeUserId, {
        dhis2UserUid: editDraft.uid.trim(),
        dhis2Username: editDraft.username.trim(),
        dhis2DisplayName: editDraft.displayName.trim() || null,
      });
      setMsg(`Mapping saved for @${editDraft.username}.`);
      setEditDraft(null);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setSavingFor(null); }
  }

  async function clearFor(edgeUserId: string, username: string): Promise<void> {
    setSavingFor(edgeUserId); setErr(null); setMsg(null);
    try {
      await edgeApi.clearUserDhis2Mapping(edgeUserId);
      setMsg(`Mapping cleared for @${username}.`);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setSavingFor(null); }
  }

  if (err && !users) {
    return <ErrorBlock title="DHIS2 mappings load failed"
                        testId="err-dhis2-mappings">{err}</ErrorBlock>;
  }
  if (!users) return <LoadingBlock testId="loading" />;

  const q = query.trim().toLowerCase();
  const filtered = users.filter((u) =>
    !q || u.username.toLowerCase().includes(q)
       || (u.displayName ?? '').toLowerCase().includes(q));
  const mappedCount = Object.keys(mappings).length;
  const unmapped = users.length - mappedCount;

  return (
    <div className="ea-screen" data-test="dhis2-mappings">
      <SyncStatusBar
        tone={unmapped > 0 ? 'warning' : 'success'}
        title="DHIS2 user mappings"
        statusLabel={unmapped === 0
          ? 'All users mapped'
          : `${unmapped} unmapped`}
        subtitle={
          <>
            <span>Mapped <strong style={{ color: 'var(--der-ink-900)' }}>{mappedCount}</strong></span>
            <span>·</span>
            <span>Total <strong style={{ color: 'var(--der-ink-900)' }}>{users.length}</strong></span>
          </>
        }
        actions={
          <Link to="/provisioning/users"
                 className="ea-btn ea-btn--ghost ea-btn--sm"
                 data-cross-module="Access"
                 data-test="dhis2-mappings-open-users">
            <UiIcon icon="edit" size={14} />
            <span>Manage users</span>
          </Link>
        }
      />

      {err && <ErrorBlock title="Mapping change failed"
                            testId="err-dhis2-mappings-save">{err}</ErrorBlock>}
      {msg && <p className="ea-saved" data-test="dhis2-mappings-saved">{msg}</p>}

      <Panel title={`${filtered.length} user${filtered.length === 1 ? '' : 's'}`}
             action={
               <input className="ea-input" type="search"
                      style={{ maxWidth: 240 }}
                      placeholder="Search by name or username"
                      value={query}
                      aria-label="Search edge users"
                      data-test="dhis2-mappings-search"
                      onChange={(e) => setQuery(e.target.value)} />
             }>
        {filtered.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}
             data-test="dhis2-mappings-empty">
            {users.length === 0
              ? 'No edge users provisioned yet.'
              : 'No users match this filter.'}
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>Edge user</th>
                <th>DHIS2 UID</th>
                <th>DHIS2 username</th>
                <th>Mapped</th>
                <th style={{ width: 170 }}>
                  <span className="ea-visually-hidden">Actions</span>
                </th>
              </tr></thead>
              <tbody>
                {filtered.map((u) => {
                  const m = mappings[u.userId];
                  const saving = savingFor === u.userId;
                  return (
                    <tr key={u.userId}
                        data-test={`dhis2-mappings-row-${u.username}`}>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {u.displayName || u.username}
                        </div>
                        <div className="ea-text-muted ea-mono"
                             style={{ fontSize: 11 }}>
                          @{u.username}
                        </div>
                      </td>
                      <td className="ea-mono" style={{ fontSize: 12 }}>
                        {m
                          ? m.dhis2UserUid
                          : <span className="ea-chip ea-chip--warning"
                                  data-test={`dhis2-mappings-unmapped-${u.username}`}>
                              Unmapped
                            </span>}
                      </td>
                      <td className="ea-mono" style={{ fontSize: 12 }}>
                        {m ? m.dhis2Username : '—'}
                      </td>
                      <td className="ea-text-muted"
                          style={{ fontSize: 12 }}
                          title={m?.mappedAt}>
                        {m ? fmtAgo(m.mappedAt) : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button type="button"
                                  className="ea-btn ea-btn--ghost ea-btn--sm"
                                  disabled={saving}
                                  data-test={`dhis2-mappings-edit-${u.username}`}
                                  onClick={() => setEditDraft({
                                    edgeUserId: u.userId,
                                    uid: m?.dhis2UserUid ?? '',
                                    username: m?.dhis2Username ?? u.username,
                                    displayName: m?.dhis2DisplayName
                                                   ?? u.displayName ?? '',
                                  })}>
                            {m ? 'Edit' : 'Map'}
                          </button>
                          {m && (
                            <button type="button"
                                    className="ea-btn ea-btn--ghost ea-btn--sm ea-btn--danger"
                                    disabled={saving}
                                    data-test={`dhis2-mappings-clear-${u.username}`}
                                    onClick={() => {
                                      confirmThenRun(
                                        `Clear the DHIS2 mapping for @${u.username}? Future captured records will carry no central attribution until a new mapping is set.`,
                                        () => { clearFor(u.userId, u.username).catch(() => undefined); });
                                    }}>
                              Clear
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Audit"
             action={
               <Link to="/audit/events?eventType=USER_DHIS2_MAPPING_SET"
                      className="ea-link-btn"
                      data-cross-module="Security"
                      data-test="dhis2-mappings-open-audit">
                 View mapping audit →
               </Link>
             }>
        <p className="ea-text-muted" style={{ margin: 0, fontSize: 13 }}>
          Every save writes <code>USER_DHIS2_MAPPING_SET</code> and every
          clear writes <code>USER_DHIS2_MAPPING_CLEARED</code> to the
          security audit log.
        </p>
      </Panel>

      {editDraft && (
        <div className="ea-modal-overlay"
             data-test="dhis2-mappings-dialog"
             onClick={() => (savingFor ? undefined : setEditDraft(null))}
             style={{ position: 'fixed', inset: 0,
                       background: 'rgba(15,28,46,0.5)',
                       display: 'flex', alignItems: 'center',
                       justifyContent: 'center', zIndex: 1000 }}>
          <div className="ea-modal"
               onClick={(e) => e.stopPropagation()}
               style={{ background: 'var(--der-surface)',
                         border: '1px solid var(--der-border)',
                         padding: 24, maxWidth: 480, width: '90%',
                         boxShadow: 'var(--el-3)' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>
              {mappings[editDraft.edgeUserId] ? 'Edit' : 'Map'} DHIS2 user
            </h3>
            <p className="ea-text-muted" style={{ margin: '0 0 12px', fontSize: 12 }}>
              The DHIS2 UID is the 11-char identifier from DHIS2&apos;s
              <code> /api/users</code> endpoint. The username is the
              familiar sign-in handle.
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              <label style={{ fontSize: 12 }}>DHIS2 UID (11 chars)
                <input className="ea-input ea-mono"
                       value={editDraft.uid}
                       aria-label="DHIS2 UID"
                       data-test="dhis2-mappings-input-uid"
                       onChange={(e) => setEditDraft(
                         (d) => d && { ...d, uid: e.target.value })} />
              </label>
              <label style={{ fontSize: 12 }}>DHIS2 username
                <input className="ea-input"
                       value={editDraft.username}
                       aria-label="DHIS2 username"
                       data-test="dhis2-mappings-input-username"
                       onChange={(e) => setEditDraft(
                         (d) => d && { ...d, username: e.target.value })} />
              </label>
              <label style={{ fontSize: 12 }}>DHIS2 display name (optional)
                <input className="ea-input"
                       value={editDraft.displayName}
                       aria-label="DHIS2 display name"
                       data-test="dhis2-mappings-input-display"
                       onChange={(e) => setEditDraft(
                         (d) => d && { ...d, displayName: e.target.value })} />
              </label>
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8,
                            justifyContent: 'flex-end' }}>
              <button type="button"
                      className="ea-btn ea-btn--ghost ea-btn--sm"
                      disabled={!!savingFor}
                      onClick={() => setEditDraft(null)}>
                Cancel
              </button>
              <button type="button"
                      className="ea-btn ea-btn--primary ea-btn--sm"
                      disabled={!!savingFor
                                  || editDraft.uid.trim().length === 0
                                  || editDraft.username.trim().length === 0}
                      data-test="dhis2-mappings-save"
                      onClick={() => { save().catch(() => undefined); }}>
                {savingFor ? 'Saving…' : 'Save mapping'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── /decommission ──────────────────────────────────────────────── */
/** FR-01-10 — Edge decommissioning.
 *
 *  Terminal operation. Operators arrive at this screen deliberately
 *  (never on the default nav path) to retire this edge: disable every
 *  other user, request a final FULL backup for evidence export, and
 *  record a DECOMMISSION audit event. A typed-confirmation gate
 *  ("DECOMMISSION") prevents accidental clicks; the acting ADMIN is
 *  intentionally not disabled so they can still download the final
 *  backup afterwards.
 *
 *  After success the screen flips to a receipt view with the counts
 *  returned by the server + a deep-link to the backup list so the
 *  operator can grab the archive the moment it completes. */
const DECOMMISSION_WORD = 'DECOMMISSION';

export function MockupDecommission(): JSX.Element {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<edgeApi.DecommissionResponse | null>(null);

  async function run(): Promise<void> {
    setBusy(true); setErr(null);
    try {
      setReceipt(await edgeApi.decommissionEdge());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  const ready = typed.trim() === DECOMMISSION_WORD && !busy && !receipt;

  if (receipt) {
    return (
      <div className="ea-screen" data-test="decommission-receipt">
        <SyncStatusBar
          tone="danger"
          title="Edge decommissioned"
          statusLabel="Terminal"
          subtitle={
            <>
              <span>This edge has been retired. Download the final backup
              archive below before taking the host offline.</span>
            </>
          }
        />
        <Panel title="Decommission receipt">
          <dl className="ea-def-list">
            <div className="ea-def-row"><dt>Users disabled</dt>
              <dd className="ea-mono"
                  data-test="decommission-disabled-users">
                {receipt.disabledUsers}
              </dd></div>
            <div className="ea-def-row"><dt>Final backup requested</dt>
              <dd data-test="decommission-final-backup">
                {receipt.finalBackupRequested ? 'yes' : 'no'}
              </dd></div>
            <div className="ea-def-row"><dt>Acted by</dt>
              <dd className="ea-mono" style={{ fontSize: 12 }}>
                {receipt.actedBy}
              </dd></div>
          </dl>
        </Panel>
        <Panel title="Next steps">
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
            <li>
              Wait for the final backup to reach <code>SUCCESS</code> on the{' '}
              <Link to="/backup" data-cross-module="Backup"
                     data-test="decommission-open-backup">Backup tools page</Link>.
            </li>
            <li>Download the archive from the row&apos;s actions menu.</li>
            <li>
              Capture a <Link to="/support-bundle"
                                data-cross-module="SupportBundle"
                                data-test="decommission-open-support">
                support bundle
              </Link> for the retention record.
            </li>
            <li>
              Shut the edge down from <Link to="/admin-tasks"
                                               data-cross-module="Lifecycle"
                                               data-test="decommission-open-lifecycle">
                Admin tasks
              </Link>.
            </li>
          </ol>
        </Panel>
      </div>
    );
  }

  return (
    <div className="ea-screen" data-test="decommission">
      <SyncStatusBar
        tone="danger"
        title="Decommission this edge"
        statusLabel="Irreversible"
        subtitle={
          <>
            <span>
              Disables every other user, requests a final FULL backup as
              an evidence export, and records a <code>DECOMMISSION</code>{' '}
              audit event. Your own account is intentionally kept active so
              you can download the final backup afterwards.
            </span>
          </>
        }
      />

      {err && <ErrorBlock title="Decommission failed"
                            testId="err-decommission">{err}</ErrorBlock>}

      <Panel title="What happens">
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>All other DER users (ADMIN + OPERATOR + VIEWER) are disabled.
            They will not be able to sign in.</li>
          <li>A final <strong>FULL</strong> backup is queued for evidence
            export. The row appears in Backup tools once drained.</li>
          <li>A terminal <code>DECOMMISSION</code> audit event is written
            to the security log.</li>
          <li>The edge continues to accept inbound reads for the acting
            ADMIN account until the host is shut down manually.</li>
        </ul>
      </Panel>

      <Panel title="Confirm">
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
          Type <strong style={{ fontFamily: 'monospace' }}>
            {DECOMMISSION_WORD}
          </strong> in the box below and press <strong>Decommission</strong>{' '}
          to proceed.
        </p>
        <div style={{ marginTop: 10, display: 'flex', gap: 10,
                        alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="ea-input ea-mono" type="text"
                 placeholder={DECOMMISSION_WORD}
                 value={typed}
                 data-test="decommission-input"
                 onChange={(e) => setTyped(e.target.value)}
                 style={{ maxWidth: 240 }} />
          <button type="button"
                  className="ea-btn ea-btn--danger ea-btn--sm"
                  disabled={!ready}
                  data-test="decommission-run"
                  onClick={() => { run().catch(() => undefined); }}>
            {busy ? 'Decommissioning…' : 'Decommission'}
          </button>
        </div>
      </Panel>
    </div>
  );
}

/* ─── /site/config ────────────────────────────────────────────────── */
/** FR-01-07 — Site configuration.
 *
 *  Narrow whitelist of operator-tunable site-level settings
 *  (connectivity policies, limits, local URL, time-zone). Backed by
 *  `/edge-api/v1/site/config` which persists via admin_setting (JSONB)
 *  with audit on every write. The screen always renders every key
 *  even on a fresh install — the server returns defaults so the
 *  canvas is never blank. */
const SITE_CONFIG_LABELS: Record<string, { label: string; hint?: string }> = {
  'site.displayName':
    { label: 'Display name',
      hint: 'Shown in the admin shell topbar + support-bundle manifest.' },
  'site.localBaseUrl':
    { label: 'Local base URL',
      hint: 'How connected devices reach this edge (e.g. https://der.local).' },
  'site.timeZone':
    { label: 'Time zone',
      hint: 'IANA zone — drives report windows + scheduler cron expansion.' },
  'site.connectivity.maxConcurrentSessions':
    { label: 'Max concurrent sessions',
      hint: 'Simultaneous logged-in operators the edge accepts.' },
  'site.connectivity.maxOfflineHours':
    { label: 'Max offline hours',
      hint: 'How long the edge can run without Central before flagging staleness.' },
  'site.connectivity.onlineWindowCron':
    { label: 'Online-window cron',
      hint: 'Optional cron for scheduled WAN windows. Blank = continuous.' },
  'site.connectivity.requireVpn':
    { label: 'Require VPN',
      hint: 'When true, central-sync fails unless the WireGuard tunnel is up.' },
};

export function MockupSiteConfig(): JSX.Element {
  const [data, setData] = useState<edgeApi.SiteConfigResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function reload(): Promise<void> {
    try {
      const r = await edgeApi.readSiteConfig();
      setData(r);
      setDraft(r.values);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  async function saveKey(key: string): Promise<void> {
    setSavingKey(key); setErr(null); setMsg(null);
    try {
      await edgeApi.writeSiteConfig({ [key]: draft[key] ?? '' });
      setMsg(`${key} saved.`);
      setTimeout(() => setMsg((m) => (m?.startsWith(key) ? null : m)), 2500);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setSavingKey(null); }
  }

  if (err && !data) {
    return <ErrorBlock title="Site config load failed"
                        testId="err-site-config-load">{err}</ErrorBlock>;
  }
  if (!data) return <LoadingBlock testId="loading" />;

  const entries = Object.entries(data.values);
  const dirty = entries.filter(([k, v]) => draft[k] !== v);

  return (
    <div className="ea-screen" data-test="site-config">
      <SyncStatusBar
        tone={dirty.length > 0 ? 'warning' : 'info'}
        title="Site configuration"
        statusLabel={`${entries.length} settings`}
        subtitle={
          <>
            <span>Site-level connectivity policies, limits, local URL and time-zone.</span>
            {data.updatedAt && (<>
              <span>·</span>
              <span>Last changed <strong style={{ color: 'var(--der-ink-900)' }}>
                {fmtAgo(data.updatedAt)}
              </strong></span>
            </>)}
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

      {err && <ErrorBlock title="Save failed"
                            testId="err-site-config-save">{err}</ErrorBlock>}
      {msg && <p className="ea-saved" data-test="site-config-saved">{msg}</p>}

      <Panel title="Settings">
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense" style={{ width: '100%' }}>
            <thead><tr>
              <th>Setting</th><th>Value</th>
              <th style={{ width: 120 }}>
                <span className="ea-visually-hidden">Actions</span>
              </th>
            </tr></thead>
            <tbody>
              {entries.map(([k, current]) => {
                const next = draft[k] ?? '';
                const changed = next !== current;
                const saving = savingKey === k;
                const meta = SITE_CONFIG_LABELS[k] ?? { label: k };
                const isDefault = current === data.defaults[k];
                return (
                  <tr key={k} data-test={`site-row-${k}`}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{meta.label}</div>
                      <div className="ea-text-muted ea-mono"
                           style={{ fontSize: 11 }}>
                        {k}
                      </div>
                      {meta.hint && (
                        <div className="ea-text-muted"
                             style={{ fontSize: 12, marginTop: 2 }}>
                          {meta.hint}
                        </div>
                      )}
                    </td>
                    <td>
                      <input className="ea-input ea-mono" type="text"
                             style={{ width: '100%', fontSize: 12 }}
                             value={next}
                             aria-label={`Value for ${meta.label}`}
                             data-test={`site-input-${k}`}
                             onChange={(e) => setDraft(
                               (d) => ({ ...d, [k]: e.target.value }))} />
                      {isDefault && (
                        <span className="ea-text-muted" style={{ fontSize: 11 }}>
                          (default)
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button"
                              className="ea-btn ea-btn--primary ea-btn--sm"
                              disabled={!changed || saving}
                              data-test={`site-save-${k}`}
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

      <Panel title="Audit"
             action={
               <Link to="/audit/events?eventType=SITE_CONFIG_CHANGED"
                      className="ea-link-btn"
                      data-cross-module="Security"
                      data-test="site-config-open-audit">
                 View SITE_CONFIG_CHANGED events →
               </Link>
             }>
        <p className="ea-text-muted" style={{ margin: 0, fontSize: 13 }}>
          Every save is logged as <code>SITE_CONFIG_CHANGED</code> in the
          security audit log with the changed-key payload.
        </p>
      </Panel>
    </div>
  );
}

/* ─── /users/scope ────────────────────────────────────────────────── */
/** FR-15-06 — User scope viewer.
 *
 *  "Who can do what on this edge" with staleness + origin signals.
 *  Role matrix across the three canonical roles (ADMIN, OPERATOR,
 *  VIEWER) plus a stale-permissions cue when `permissionAgeHours`
 *  exceeds the 7-day freshness floor — that signals a user whose
 *  grant hasn't been refreshed from Central and may still be bound
 *  to a role they no longer need. */
const CANONICAL_ROLES = ['ADMIN', 'OPERATOR', 'VIEWER'] as const;
const STALE_HOURS_THRESHOLD = 24 * 7;

export function MockupUserScope(): JSX.Element {
  const [data, setData] = useState<{
    users: edgeApi.EdgeUserScopeRow[]; generatedAt: string;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  async function reload(): Promise<void> {
    setRefreshing(true);
    try {
      setData(await edgeApi.fetchUserScope());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  // Hooks must run before any early-return; compute the filtered set
  // + paginator up front so React sees a stable hook order.
  const q = query.trim().toLowerCase();
  const filtered = (data?.users ?? []).filter((u) => {
    if (q && !u.username.toLowerCase().includes(q)
         && !(u.displayName ?? '').toLowerCase().includes(q)) return false;
    if (filterRole !== 'ALL' && !u.roles.includes(filterRole)) return false;
    return true;
  });
  const paged = usePaged(filtered, 50);

  if (err && !data) {
    return <ErrorBlock title="User scope load failed"
                        testId="err-user-scope">{err}</ErrorBlock>;
  }
  if (!data) return <LoadingBlock testId="loading" />;

  const total = data.users.length;
  const active = data.users.filter((u) => !u.disabled).length;
  const admins = data.users.filter((u) => u.roles.includes('ADMIN')).length;
  const stale = data.users.filter((u) =>
    u.permissionAgeHours > STALE_HOURS_THRESHOLD).length;

  return (
    <div className="ea-screen" data-test="user-scope">
      <SyncStatusBar
        tone={stale > 0 ? 'warning' : 'info'}
        title="User scope"
        statusLabel={`${active}/${total} active`}
        subtitle={
          <>
            <span>Every user on this edge, their roles, and how recently their permissions were refreshed.</span>
            <span>·</span>
            <span>Admins <strong style={{ color: 'var(--der-ink-900)' }}>{admins}</strong></span>
            {stale > 0 && (<>
              <span>·</span>
              <span>
                <strong style={{ color: 'var(--der-warning-ink)' }}>
                  {stale} stale ({'>'}7 days)
                </strong>
              </span>
            </>)}
            <span>·</span>
            <span>Generated <strong style={{ color: 'var(--der-ink-900)' }}>
              {fmtAgo(data.generatedAt)}
            </strong></span>
          </>
        }
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    disabled={refreshing}
                    data-test="user-scope-refresh"
                    onClick={() => { reload().catch(() => undefined); }}>
              <UiIcon icon="refresh" size={14} />
              <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
            <Link to="/provisioning/users"
                   className="ea-btn ea-btn--ghost ea-btn--sm"
                   data-cross-module="Provisioning"
                   data-test="user-scope-open-provisioning">
              <UiIcon icon="edit" size={14} />
              <span>Manage users</span>
            </Link>
          </>
        }
      />

      <Panel title={`${filtered.length} user${filtered.length === 1 ? '' : 's'}`}
             action={
               <>
                 <input className="ea-input" type="search"
                        style={{ maxWidth: 220 }}
                        placeholder="Search username or display name"
                        value={query}
                        data-test="user-scope-search"
                        onChange={(e) => setQuery(e.target.value)} />
                 <select className="ea-input" style={{ maxWidth: 160 }}
                         value={filterRole}
                         aria-label="Filter users by role"
                         data-test="user-scope-role-filter"
                         onChange={(e) => setFilterRole(e.target.value)}>
                   <option value="ALL">All roles</option>
                   {CANONICAL_ROLES.map((r) =>
                     (<option key={r} value={r}>{r}</option>))}
                 </select>
               </>
             }>
        {filtered.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}
             data-test="user-scope-empty">
            No users match this filter.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>User</th><th>Origin</th>
                {CANONICAL_ROLES.map((r) => (
                  <th key={r} style={{ textAlign: 'center' }}>{r}</th>
                ))}
                <th>Other roles</th>
                <th>Permission age</th>
                <th>Status</th>
              </tr></thead>
              <tbody>
                {paged.rows.map((u) => {
                  const otherRoles = u.roles
                    .filter((r) => !(CANONICAL_ROLES as readonly string[]).includes(r));
                  const isStale = u.permissionAgeHours > STALE_HOURS_THRESHOLD;
                  return (
                    <tr key={u.userId}
                        data-test={`user-row-${u.username}`}>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {u.displayName || u.username}
                        </div>
                        <div className="ea-text-muted ea-mono"
                             style={{ fontSize: 11 }}>
                          @{u.username}
                        </div>
                      </td>
                      <td>
                        <span className="ea-chip ea-chip--info"
                              data-test={`user-origin-${u.username}`}>
                          {u.origin}
                        </span>
                      </td>
                      {CANONICAL_ROLES.map((role) => (
                        <td key={role} style={{ textAlign: 'center' }}
                            data-test={`user-${u.username}-${role}`}>
                          {u.roles.includes(role)
                            ? <span aria-label={`has ${role}`}
                                     style={{ color: 'var(--der-success-ink)',
                                              fontWeight: 600 }}>✓</span>
                            : <span aria-hidden="true"
                                     className="ea-text-muted">·</span>}
                        </td>
                      ))}
                      <td className="ea-text-muted" style={{ fontSize: 12 }}>
                        {otherRoles.length === 0 ? '—' : otherRoles.join(', ')}
                      </td>
                      <td>
                        <span className={
                          'ea-chip ea-chip--' + (isStale ? 'warning' : 'muted')}
                              title={fmtDate(u.updatedAt)}
                              data-test={`user-age-${u.username}`}>
                          {u.permissionAgeHours}h
                        </span>
                      </td>
                      <td>
                        <Status tone={u.disabled ? 'danger' : 'success'}>
                          {u.disabled ? 'Disabled' : 'Active'}
                        </Status>
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
              <th>Key</th><th>Value</th>
              <th style={{ width: 120 }}>
                <span className="ea-visually-hidden">Actions</span>
              </th>
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
                             aria-label={`Value for ${k}`}
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

/* ─── /audit/trail ──────────────────────────────────────────────────
 *
 * EA-29 Audit trail. The security_audit stream is the authoritative
 * admin audit log (hash-chained, append-only, all mutation endpoints
 * emit here). This screen is the paginated/filtered explorer with CSV
 * export; MockupAuditEvents at /audit/events stays for the lighter
 * system-activity + network-events streams.
 */
export function MockupSecurityAuditTrail(): JSX.Element {
  const [events, setEvents] = useState<edgeApi.AuditEventRow[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursors, setPrevCursors] = useState<string[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /* Filters are owned by this screen; the applied filter is the one
   * the current page was fetched with. Editing before Apply doesn't
   * refetch. */
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [draftEventTypes, setDraftEventTypes] = useState<Set<string>>(new Set());
  const [draftActor, setDraftActor] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [applied, setApplied] = useState<edgeApi.AuditEventsQuery>({});

  function load(cursor: string | null, filters: edgeApi.AuditEventsQuery): void {
    setLoading(true); setErr(null);
    edgeApi.listAuditEvents({ ...filters, cursor: cursor ?? undefined, pageSize: 100 })
      .then((r) => {
        setEvents(r.events);
        setNextCursor(r.nextCursor);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(null, applied); }, [applied]);

  function toIsoOrEmpty(local: string): string | undefined {
    if (!local) return undefined;
    /* HTML datetime-local produces 'YYYY-MM-DDTHH:MM' (no seconds, no
     * tz). Treat as local wall-clock; convert to UTC Instant. */
    const d = new Date(local);
    if (Number.isNaN(d.valueOf())) return undefined;
    return d.toISOString();
  }

  function quickRange(hours: number): void {
    const now = new Date();
    const from = new Date(now.getTime() - hours * 3600_000);
    const fmt = (d: Date): string =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
        .toISOString().slice(0, 16);
    setDraftFrom(fmt(from));
    setDraftTo(fmt(now));
  }

  function applyFilters(): void {
    const next: edgeApi.AuditEventsQuery = {
      from: toIsoOrEmpty(draftFrom),
      to: toIsoOrEmpty(draftTo),
      eventTypes: draftEventTypes.size > 0 ? Array.from(draftEventTypes) : undefined,
      actorUserId: draftActor.trim() || undefined,
      subjectUserId: draftSubject.trim() || undefined,
    };
    setPrevCursors([]); setCurrentCursor(null);
    setApplied(next);
  }

  function clearFilters(): void {
    setDraftFrom(''); setDraftTo(''); setDraftEventTypes(new Set());
    setDraftActor(''); setDraftSubject('');
    setPrevCursors([]); setCurrentCursor(null);
    setApplied({});
  }

  function toggleType(t: string): void {
    const next = new Set(draftEventTypes);
    if (next.has(t)) next.delete(t); else next.add(t);
    setDraftEventTypes(next);
  }

  function nextPage(): void {
    if (!nextCursor) return;
    setPrevCursors((prev) => [...prev, currentCursor ?? '']);
    setCurrentCursor(nextCursor);
    load(nextCursor, applied);
  }

  function prevPage(): void {
    if (prevCursors.length === 0) return;
    const prev = prevCursors[prevCursors.length - 1];
    setPrevCursors((p) => p.slice(0, -1));
    const resumeCursor = prev === '' ? null : prev;
    setCurrentCursor(resumeCursor);
    load(resumeCursor, applied);
  }

  function exportCsv(): void {
    window.location.assign(edgeApi.auditEventsCsvUrl(applied));
  }

  /* Collect the event types seen on the current page as the multiselect
   * options. For a fresh deployment this will start empty; once the page
   * populates, the operator can narrow from there. A richer version
   * would hit a dedicated /distinct-event-types endpoint. */
  const knownTypes = Array.from(new Set((events ?? []).map((e) => e.eventType))).sort();

  if (err && !events) return <ErrorBlock title="Audit trail failed"
                                          testId="err-audit-trail">{err}</ErrorBlock>;
  const activeFilterCount = [
    applied.from, applied.to, applied.actorUserId, applied.subjectUserId,
  ].filter(Boolean).length + (applied.eventTypes?.length ?? 0);

  return (
    <div className="ea-screen" data-test="audit-trail">
      <SyncStatusBar
        tone="info"
        title="Audit trail"
        statusLabel={events == null ? 'Loading…'
          : `${events.length} row${events.length === 1 ? '' : 's'} · page ${prevCursors.length + 1}`}
        subtitle={
          <>
            <span>security_audit stream · hash-chained</span>
            {activeFilterCount > 0 && (<><span>·</span>
              <span>{activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} active</span>
            </>)}
          </>
        }
        actions={
          <>
            <Link to="/audit/verify" className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Security"
                  data-test="audit-trail-open-verify">
              <UiIcon icon="audit" size={14} />
              <span>Hash chain</span>
            </Link>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                    data-test="audit-trail-export-csv"
                    onClick={exportCsv}>
              <UiIcon icon="restore" size={14} />
              <span>Export CSV</span>
            </button>
          </>
        }
      />

      <Panel title="Filters"
             action={
               <div style={{ display: 'flex', gap: 6 }}>
                 <button type="button"
                         className="ea-btn ea-btn--ghost ea-btn--sm"
                         data-test="audit-trail-quick-24h"
                         onClick={() => quickRange(24)}>Last 24h</button>
                 <button type="button"
                         className="ea-btn ea-btn--ghost ea-btn--sm"
                         data-test="audit-trail-quick-7d"
                         onClick={() => quickRange(24 * 7)}>Last 7d</button>
                 <button type="button"
                         className="ea-btn ea-btn--ghost ea-btn--sm"
                         data-test="audit-trail-quick-30d"
                         onClick={() => quickRange(24 * 30)}>Last 30d</button>
               </div>
             }>
        <div className="ea-audit-filters">
          <label className="ea-field">
            <span className="ea-field-label">From</span>
            <input type="datetime-local" className="ea-input"
                   data-test="audit-trail-from"
                   value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} />
          </label>
          <label className="ea-field">
            <span className="ea-field-label">To</span>
            <input type="datetime-local" className="ea-input"
                   data-test="audit-trail-to"
                   value={draftTo} onChange={(e) => setDraftTo(e.target.value)} />
          </label>
          <label className="ea-field">
            <span className="ea-field-label">Actor uid</span>
            <input className="ea-input ea-mono"
                   data-test="audit-trail-actor"
                   value={draftActor}
                   placeholder="UUID"
                   onChange={(e) => setDraftActor(e.target.value)} />
          </label>
          <label className="ea-field">
            <span className="ea-field-label">Subject uid</span>
            <input className="ea-input ea-mono"
                   data-test="audit-trail-subject"
                   value={draftSubject}
                   placeholder="UUID"
                   onChange={(e) => setDraftSubject(e.target.value)} />
          </label>
        </div>
        {knownTypes.length > 0 && (
          <div className="ea-field" style={{ marginTop: 8 }}>
            <span className="ea-field-label">Event types (seen on this page)</span>
            <div className="ea-inline-list" data-test="audit-trail-types">
              {knownTypes.map((t) => {
                const active = draftEventTypes.has(t);
                return (
                  <li key={t}
                      className={'ea-mono' + (active ? ' ea-chip--primary' : '')}
                      data-test={`audit-trail-type-${t}`}
                      onClick={() => toggleType(t)}
                      style={{ cursor: 'pointer',
                               background: active ? 'var(--der-primary-soft)' : undefined,
                               borderColor: active ? 'var(--der-primary)' : undefined }}>
                    {t}
                  </li>
                );
              })}
            </div>
          </div>
        )}
        <div className="ea-mapping-form-actions">
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-test="audit-trail-clear"
                  onClick={clearFilters}>Clear</button>
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  data-test="audit-trail-apply"
                  onClick={applyFilters}>Apply</button>
        </div>
      </Panel>

      {err && (
        <ErrorBlock title="Audit page failed"
                     testId="err-audit-trail-page">{err}</ErrorBlock>
      )}

      <Panel title="Events"
             action={
               <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                 <button type="button"
                         className="ea-btn ea-btn--ghost ea-btn--sm"
                         data-test="audit-trail-prev"
                         disabled={prevCursors.length === 0 || loading}
                         onClick={prevPage}>← Prev</button>
                 <button type="button"
                         className="ea-btn ea-btn--ghost ea-btn--sm"
                         data-test="audit-trail-next"
                         disabled={nextCursor == null || loading}
                         onClick={nextPage}>Next →</button>
               </div>
             }>
        {events == null
          ? <LoadingBlock testId="audit-trail-loading" />
          : events.length === 0
            ? <EmptyBlock title="No events"
                           testId="audit-trail-empty">
                No audit events match this filter.
              </EmptyBlock>
            : (
              <div className="ea-table-wrap">
                <table className="ea-table ea-table--dense"
                       data-test="audit-trail-table">
                  <thead><tr>
                    <th>Observed</th>
                    <th>Event</th>
                    <th>Outcome</th>
                    <th>Actor</th>
                    <th>Subject</th>
                    <th>Client</th>
                  </tr></thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.auditId}
                          data-test={`audit-trail-row-${e.auditId}`}>
                        <td className="ea-mono" style={{ fontSize: 12 }}>
                          {new Date(e.observedAt).toLocaleString()}
                        </td>
                        <td className="ea-mono">{e.eventType}</td>
                        <td>
                          <Status tone={e.outcome === 'SUCCESS' ? 'success'
                            : e.outcome === 'ERROR' ? 'danger' : 'warning'}>
                            {e.outcome}
                          </Status>
                        </td>
                        <td className="ea-mono ea-text-muted"
                            style={{ fontSize: 11 }}>
                          {e.actorUserId?.slice(0, 8) ?? '—'}
                        </td>
                        <td className="ea-mono ea-text-muted"
                            style={{ fontSize: 11 }}>
                          {e.subjectUserId?.slice(0, 8) ?? '—'}
                        </td>
                        <td className="ea-mono ea-text-muted"
                            style={{ fontSize: 12 }}>
                          {e.clientIp ?? '—'}
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

/* ─── /admin/metrics/operators ─────────────────────────────────────
 *
 * EA-33 Operator metrics. CapOperatorMetrics (/monitoring/metrics) is
 * job-reliability focused; this screen is operator-scoped: who's
 * capturing, who's stuck, who hasn't been mapped yet. Derived entirely
 * from existing endpoints — no new server surface.
 */
interface OperatorMetricsRow {
  userId: string;
  username: string;
  displayName: string;
  roles: string[];
  mapping: edgeApi.EdgeUserDhis2Mapping | null;
  conflictCount: number;
  rejectCount: number;
  retryCount: number;
  attentionCount: number;
}

export function MockupOperatorMetrics(): JSX.Element {
  const navigate = useNavigate();
  const [users, setUsers] = useState<edgeApi.ProvisionedUser[] | null>(null);
  const [mappings, setMappings] =
    useState<Record<string, edgeApi.EdgeUserDhis2Mapping>>({});
  const [conflicts, setConflicts] = useState<edgeApi.ConflictRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      edgeApi.listUsers(),
      edgeApi.listUserDhis2Mappings(),
      edgeApi.listConflicts(500),
    ]).then(([u, m, c]) => {
      if (u.status === 'fulfilled') setUsers(u.value.users);
      else { setErr(u.reason instanceof Error ? u.reason.message : String(u.reason)); return; }
      if (m.status === 'fulfilled') {
        const idx: Record<string, edgeApi.EdgeUserDhis2Mapping> = {};
        for (const row of m.value) idx[row.edgeUserId] = row;
        setMappings(idx);
      }
      if (c.status === 'fulfilled') setConflicts(c.value);
    });
  }, []);

  if (err && !users) return <ErrorBlock title="Metrics load failed"
                                         testId="err-operator-metrics">{err}</ErrorBlock>;
  if (!users) return <LoadingBlock testId="loading" />;

  const rows: OperatorMetricsRow[] = users.map((u) => {
    const mine = conflicts.filter((c) => c.submittedBy === u.userId);
    const conflictCount = mine.filter((c) => c.state === 'CONFLICT_REVIEW').length;
    const rejectCount = mine.filter((c) => c.state === 'CENTRAL_REJECTED').length;
    const retryCount = mine.filter((c) => c.state === 'RETRYABLE').length;
    return {
      userId: u.userId,
      username: u.username,
      displayName: u.displayName,
      roles: u.roles,
      mapping: mappings[u.userId] ?? null,
      conflictCount, rejectCount, retryCount,
      attentionCount: conflictCount + rejectCount + retryCount,
    };
  });
  const ranked = rows.slice().sort((a, b) =>
    b.attentionCount - a.attentionCount
    || a.username.localeCompare(b.username));

  const totalOperators = rows.length;
  const unmapped = rows.filter((r) => r.mapping == null).length;
  const needCredential = rows.filter(
    (r) => r.mapping != null && !r.mapping.hasCredential).length;
  const withAttention = rows.filter((r) => r.attentionCount > 0).length;
  const totalAttention = rows.reduce((a, r) => a + r.attentionCount, 0);

  const tone: 'success' | 'warning' | 'danger' =
    withAttention === 0 && unmapped === 0 ? 'success'
      : withAttention > 0 ? 'warning' : 'warning';

  return (
    <div className="ea-screen" data-test="operator-metrics">
      <SyncStatusBar
        tone={tone}
        title="Operator metrics"
        statusLabel={`${totalOperators} operator${totalOperators === 1 ? '' : 's'}`}
        subtitle={
          <>
            <span>With attention <strong style={{ color: 'var(--der-ink-900)' }}>{withAttention}</strong></span>
            <span>·</span>
            <span>Unmapped <strong style={{ color: 'var(--der-ink-900)' }}>{unmapped}</strong></span>
            <span>·</span>
            <span>Missing credential <strong style={{ color: 'var(--der-ink-900)' }}>{needCredential}</strong></span>
            <span>·</span>
            <span>Total attention items <strong style={{ color: 'var(--der-ink-900)' }}>{totalAttention}</strong></span>
          </>
        }
        actions={
          <Link to="/monitoring/metrics"
                className="ea-btn ea-btn--ghost ea-btn--sm"
                data-cross-module="Monitoring"
                data-test="operator-metrics-open-reliability">
            <UiIcon icon="analytics" size={14} />
            <span>Job reliability</span>
          </Link>
        }
      />
      <Panel title="Per-operator breakdown"
             action={
               <span className="ea-text-muted" style={{ fontSize: 12 }}>
                 Click a row for user detail
               </span>
             }>
        {rows.length === 0 ? (
          <EmptyBlock title="No operators"
                      testId="operator-metrics-empty">
            No users on this edge yet.
          </EmptyBlock>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense ea-table--selectable"
                   data-test="operator-metrics-table">
              <thead><tr>
                <th>Operator</th>
                <th>DHIS2 mapping</th>
                <th>Credential</th>
                <th style={{ textAlign: 'right' }}>Conflicts</th>
                <th style={{ textAlign: 'right' }}>Rejected</th>
                <th style={{ textAlign: 'right' }}>Retrying</th>
                <th style={{ textAlign: 'right' }}>Attention</th>
              </tr></thead>
              <tbody>
                {ranked.map((r) => (
                  <tr key={r.userId}
                      data-test={`operator-metrics-row-${r.userId}`}
                      onClick={() => navigate(
                        `/provisioning/users/${encodeURIComponent(r.userId)}`)}
                      style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{r.displayName}</div>
                      <div className="ea-mono ea-text-muted" style={{ fontSize: 12 }}>
                        @{r.username}
                      </div>
                    </td>
                    <td>
                      {r.mapping
                        ? <span className="ea-mono">@{r.mapping.dhis2Username}</span>
                        : <Status tone="warning">Unmapped</Status>}
                    </td>
                    <td>
                      {r.mapping == null
                        ? <span className="ea-text-muted">—</span>
                        : r.mapping.hasCredential
                          ? <Status tone="success">Stored</Status>
                          : <Status tone="warning">Not set</Status>}
                    </td>
                    <td className="ea-mono" style={{ textAlign: 'right',
                                                      color: r.conflictCount ? 'var(--der-warning-ink)' : undefined }}>
                      {r.conflictCount}
                    </td>
                    <td className="ea-mono" style={{ textAlign: 'right',
                                                      color: r.rejectCount ? 'var(--der-danger-ink)' : undefined }}>
                      {r.rejectCount}
                    </td>
                    <td className="ea-mono" style={{ textAlign: 'right',
                                                      color: r.retryCount ? 'var(--der-warning-ink)' : undefined }}>
                      {r.retryCount}
                    </td>
                    <td className="ea-mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                      {r.attentionCount}
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
