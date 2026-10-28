import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import {
  OuPicker, useOuContext, Panel, fmtDate, fmtDur, fmtAgo, usePaged, TablePager,
  humaniseJob, humaniseState, humaniseTrigger, relatedLinksForJob, syncActivityShape,
  parseByType, detailEntries, entityTypeIcon, entityTypeLabel,
  DrawerTabs, JsonViewer, parseOperationIds, SyncStatusBar, BackLink, RowMenu,
  Status,
  type RowMenuItem,
} from './shared';
import { LoadingBlock } from '../../components/ScreenStates';

/** `/admin/sync/history` — full-width activity feed. */
export function MockupSyncHistory(): JSX.Element {
  const [ctx] = useOuContext();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  async function reload(): Promise<void> {
    try { setJobs(await edgeApi.listJobs(200)); } catch { /* ignore */ }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  const types = useMemo(() => Array.from(new Set((jobs ?? []).map((j) => j.jobName))).sort(), [jobs]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = dateFrom ? Date.parse(dateFrom) : -Infinity;
    const to = dateTo ? Date.parse(dateTo) + 86400_000 : Infinity;
    return (jobs ?? []).filter((j) => {
      if (q && !j.jobName.toLowerCase().includes(q) && !j.triggeredBy.toLowerCase().includes(q)) return false;
      if (filterType !== 'ALL' && j.jobName !== filterType) return false;
      if (filterStatus !== 'ALL' && j.outcome !== filterStatus) return false;
      const t = Date.parse(j.startedAt);
      if (t < from || t > to) return false;
      return true;
    });
  }, [jobs, query, filterType, filterStatus, dateFrom, dateTo]);
  const paged = usePaged(filtered, 50);

  if (!jobs) return <LoadingBlock testId="loading" />;

  function rowMenuFor(j: edgeApi.JobRun): ReadonlyArray<RowMenuItem> {
    const items: RowMenuItem[] = [
      { label: 'Open details', to: `/sync/history/${j.runId}` },
    ];
    for (const [label, to] of relatedLinksForJob(j.jobName)) {
      items.push({ label, to });
    }
    return items;
  }

  return (
    <div className="ea-screen">
      <SyncStatusBar
        tone="muted"
        title="Sync history"
        statusLabel={`${jobs.length} run${jobs.length === 1 ? '' : 's'}`}
        subtitle={<span>Every scheduled and manual sync run on this edge.</span>}
      />

      <OuPicker ctx={ctx} />

      <Panel title={`All runs · ${filtered.length}`}
             action={
               <>
                 <input className="ea-input" style={{ maxWidth: 180 }} type="search"
                        placeholder="Search" value={query}
                        onChange={(e) => setQuery(e.target.value)} />
                 <select className="ea-input" style={{ maxWidth: 160 }} value={filterType}
                         onChange={(e) => setFilterType(e.target.value)}>
                   <option value="ALL">All types</option>
                   {types.map((t) => <option key={t} value={t}>{humaniseJob(t)}</option>)}
                 </select>
                 <select className="ea-input" style={{ maxWidth: 140 }} value={filterStatus}
                         onChange={(e) => setFilterStatus(e.target.value)}>
                   <option value="ALL">All statuses</option>
                   <option value="SUCCEEDED">Succeeded</option>
                   <option value="SUCCESS">Succeeded</option>
                   <option value="FAILED">Failed</option>
                 </select>
                 <input className="ea-input" style={{ maxWidth: 140 }} type="date"
                        value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                 <input className="ea-input" style={{ maxWidth: 140 }} type="date"
                        value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                 <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                         onClick={() => { reload().catch(() => undefined); }}>Refresh</button>
               </>
             }>
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense ea-table--selectable" style={{ width: '100%' }}>
            <thead><tr>
              <th style={{ width: 32 }}></th>
              <th>What was synced</th>
              <th style={{ width: 150 }}>Direction</th>
              <th style={{ width: 110 }}>When</th>
              <th style={{ width: 70 }}>Duration</th>
              <th style={{ width: 110 }}>Status</th>
              <th style={{ width: 48 }} aria-label="Actions"></th>
            </tr></thead>
            <tbody>
              {paged.rows.map((j) => {
                const shape = syncActivityShape(j.jobName, j.detail);
                return (
                  <tr key={j.runId}
                      onClick={() => navigate(`/sync/history/${j.runId}`)}>
                    <td style={{ fontSize: 16, textAlign: 'center' }}
                        aria-hidden="true" title={shape.category}>
                      {shape.icon}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--der-ink-900)' }}>
                        {shape.category}
                      </div>
                      <div className="ea-text-muted" style={{ fontSize: 11, marginTop: 1 }}>
                        {shape.sentence}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {shape.direction === 'local' ? (
                        <span className="ea-text-muted">DER-local</span>
                      ) : (
                        <>
                          <span className="ea-mono" style={{ color: 'var(--der-ink-900)' }}>
                            {shape.directionLabel.split(' → ')[0]}
                          </span>
                          <span style={{ color: 'var(--der-primary)', margin: '0 6px', fontWeight: 700 }}>→</span>
                          <span className="ea-mono" style={{ color: 'var(--der-ink-900)' }}>
                            {shape.directionLabel.split(' → ')[1]}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="ea-text-muted" style={{ fontSize: 12 }}
                        title={fmtDate(j.startedAt)}>{fmtAgo(j.startedAt)}</td>
                    <td className="ea-mono">{fmtDur(j.durationMs)}</td>
                    <td>
                      <Status tone={
                        j.outcome === 'SUCCEEDED' || j.outcome === 'SUCCESS' ? 'success'
                        : j.outcome === 'FAILED' || j.outcome === 'FAILURE' ? 'danger' : 'info'}>
                        {humaniseState(j.outcome)}
                      </Status>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <RowMenu items={rowMenuFor(j)} />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="ea-text-muted" style={{ padding: 24, textAlign: 'center' }}>
                  No matching activity.
                </td></tr>
              )}
            </tbody>
          </table>
          <TablePager {...paged.pagerProps} />
        </div>
      </Panel>
    </div>
  );
}

/** Humanise the camelCase keys returned by metadataDiagnostics. */
function mirrorCountLabel(key: string): string {
  const map: Record<string, string> = {
    organisationUnits: 'Organisation units',
    dataElements: 'Data elements',
    dataSets: 'Data sets',
    programs: 'Programs',
    programStages: 'Program stages',
    trackedEntityTypes: 'Tracked entity types',
    trackedEntityAttributes: 'Tracked entity attributes',
    optionSets: 'Option sets',
    categoryCombos: 'Category combos',
    categoryOptionCombos: 'Category option combos',
  };
  return map[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

/** `/admin/sync/history/:runId` — per-run details page. */
export function MockupSyncHistoryDetail(): JSX.Element {
  const { runId } = useParams<{ runId: string }>();
  const [sel, setSel] = useState<edgeApi.JobRun | null>(null);
  const [tab, setTab] = useState<'overview' | 'payload' | 'related'>('overview');
  const [ops, setOps] = useState<edgeApi.JournalOperation[] | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [metaDiag, setMetaDiag] = useState<edgeApi.MetadataDiagnostics | null>(null);
  const [metaInv, setMetaInv] = useState<Awaited<ReturnType<typeof edgeApi.metadataInventory>> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const all = await edgeApi.listJobs(200);
        const match = all.find((j) => String(j.runId) === runId);
        if (!match) { setErr('Run not found.'); return; }
        setSel(match);
      } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    })();
  }, [runId]);

  useEffect(() => {
    if (!sel || tab !== 'payload') return;
    const ids = parseOperationIds(sel.detail);
    if (ids.length === 0) { setOps([]); return; }
    setOpsLoading(true);
    Promise.all(ids.slice(0, 20).map((id) => edgeApi.fetchJournalOperation(id).catch(() => null)))
      .then((rows) => setOps(rows.filter((r): r is edgeApi.JournalOperation => r !== null)))
      .finally(() => setOpsLoading(false));
  }, [sel, tab]);

  // For metadata runs, additionally pull the mirror inventory so the
  // Payload tab can show what metadata is actually present on this edge
  // (not just the pull summary).
  const isMetadataRun = sel?.jobName?.toUpperCase().includes('METADATA');
  useEffect(() => {
    if (!sel || tab !== 'payload' || !isMetadataRun) return;
    Promise.allSettled([edgeApi.metadataDiagnostics(), edgeApi.metadataInventory(1000)])
      .then(([diag, inv]) => {
        if (diag.status === 'fulfilled') setMetaDiag(diag.value);
        if (inv.status === 'fulfilled') setMetaInv(inv.value);
      });
  }, [sel, tab, isMetadataRun]);

  if (err) return (
    <div className="ea-screen">
      <BackLink to="/sync/history" label="Back to Sync history" />
      <SyncStatusBar tone="danger" title="Run not found" statusLabel="Error"
                     subtitle={<span>{err}</span>} />
    </div>
  );
  if (!sel) return <LoadingBlock testId="loading" />;

  const shape = syncActivityShape(sel.jobName, sel.detail);
  const ok = sel.outcome === 'SUCCEEDED' || sel.outcome === 'SUCCESS';
  const failed = sel.outcome === 'FAILED' || sel.outcome === 'FAILURE';
  const breakdownBadge = parseByType(sel.detail).reduce((a, [, c]) => a + c, 0) || undefined;

  return (
    <div className="ea-screen" data-test="sync-history-detail">
      <BackLink to="/sync/history" label="Back to Sync history" />
      <SyncStatusBar
        tone={ok ? 'success' : failed ? 'danger' : 'info'}
        title={`${shape.icon} ${shape.category}`}
        statusLabel={humaniseState(sel.outcome)}
        subtitle={
          <>
            <span>{shape.sentence}</span>
            <span>·</span>
            <span className="ea-mono">{shape.directionLabel}</span>
            <span>·</span>
            <span>{fmtDate(sel.startedAt)}</span>
          </>
        }
      />

      <DrawerTabs
        active={tab}
        onChange={(id) => setTab(id as 'overview' | 'payload' | 'related')}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'payload', label: 'Payload', badge: breakdownBadge },
          { id: 'related', label: 'Related',
            badge: relatedLinksForJob(sel.jobName).length || undefined },
        ]}
      />

      {tab === 'overview' && (
        <Panel title="Run">
          <dl className="ea-def-list">
            <div className="ea-def-row"><dt>Run ID</dt><dd className="ea-mono">{sel.runId}</dd></div>
            <div className="ea-def-row"><dt>Job</dt>
              <dd>{humaniseJob(sel.jobName)}
                <div className="ea-text-muted ea-mono" style={{ fontSize: 10 }}>{sel.jobName}</div>
              </dd></div>
            <div className="ea-def-row"><dt>Status</dt>
              <dd><span className={'ea-chip ea-chip--' + (ok ? 'success' : failed ? 'danger' : 'info')}>
                {humaniseState(sel.outcome)}
              </span></dd></div>
            <div className="ea-def-row"><dt>Started</dt><dd className="ea-mono">{fmtDate(sel.startedAt)}</dd></div>
            <div className="ea-def-row"><dt>Finished</dt>
              <dd className="ea-mono">{sel.finishedAt ? fmtDate(sel.finishedAt) : '—'}</dd></div>
            <div className="ea-def-row"><dt>Duration</dt><dd>{fmtDur(sel.durationMs)}</dd></div>
            <div className="ea-def-row"><dt>Age</dt><dd>{fmtAgo(sel.startedAt)}</dd></div>
            <div className="ea-def-row"><dt>Triggered by</dt><dd>{humaniseTrigger(sel.triggeredBy)}</dd></div>
          </dl>
        </Panel>
      )}

      {tab === 'payload' && (
        <>
          {isMetadataRun && metaDiag && (
            <Panel title="Metadata inventory">
              <p className="ea-text-muted" style={{ margin: '0 0 12px', fontSize: 12 }}>
                Current snapshot of what metadata this edge holds after the pull.
              </p>
              <table className="ea-table ea-table--dense" style={{ width: '100%' }}>
                <thead><tr>
                  <th>Metadata type</th>
                  <th style={{ width: 120, textAlign: 'right' }}>Records</th>
                </tr></thead>
                <tbody>
                  {Object.entries(metaDiag.mirrorCounts).map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ fontWeight: 500 }}>{mirrorCountLabel(k)}</td>
                      <td className="ea-mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                        {(v ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}

          {isMetadataRun && metaInv && (
            <Panel title="Records">
              <p className="ea-text-muted" style={{ margin: '0 0 12px', fontSize: 12 }}>
                All records across every metadata type DER mirrors. Click any
                section to expand and inspect the full payload JSON.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {([
                  ['organisationUnits', 'Organisation units'],
                  ['programs', 'Programs'],
                  ['programStages', 'Program stages'],
                  ['dataElements', 'Data elements'],
                  ['dataSets', 'Data sets'],
                  ['trackedEntityTypes', 'Tracked entity types'],
                  ['trackedEntityAttributes', 'Tracked entity attributes'],
                  ['optionSets', 'Option sets'],
                  ['categoryCombos', 'Category combos'],
                  ['programRules', 'Program rules'],
                ] as const).map(([key, label]) => {
                  const arr = (metaInv as unknown as Record<string, unknown[] | null>)[key];
                  if (!arr) return null;
                  return (
                    <details key={key}>
                      <summary style={{
                        cursor: 'pointer', padding: '10px 14px',
                        background: 'var(--der-raised)',
                        border: '1px solid var(--der-border-subtle)',
                        fontSize: 13, fontWeight: 500,
                        display: 'flex', alignItems: 'center', gap: 8,
                        listStyle: 'none',
                      }}>
                        <span>{label}</span>
                        <span className="ea-mono ea-text-muted"
                              style={{ fontSize: 11, marginLeft: 'auto' }}>
                          {arr.length.toLocaleString()} record{arr.length === 1 ? '' : 's'}
                        </span>
                      </summary>
                      <div style={{ marginTop: 10 }}>
                        {arr.length === 0 ? (
                          <p className="ea-text-muted" style={{ margin: 0, fontSize: 12 }}>
                            None mirrored.
                          </p>
                        ) : (
                          <JsonViewer value={arr} label={`${label} (${arr.length})`} maxDepth={2} />
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            </Panel>
          )}

          {parseByType(sel.detail).length > 0 && (
            <Panel title="Breakdown by data type">
              <table className="ea-table ea-table--dense" style={{ width: '100%' }}>
                <thead><tr>
                  <th style={{ width: 32 }}></th>
                  <th>Data type</th>
                  <th style={{ width: 120, textAlign: 'right' }}>Records</th>
                </tr></thead>
                <tbody>
                  {parseByType(sel.detail).map(([type, count]) => (
                    <tr key={type}>
                      <td style={{ fontSize: 16 }} aria-hidden="true">{entityTypeIcon(type)}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{entityTypeLabel(type)}</div>
                        <div className="ea-text-muted ea-mono" style={{ fontSize: 10 }}>{type}</div>
                      </td>
                      <td className="ea-mono"
                          style={{ textAlign: 'right', fontWeight: 600 }}>
                        {count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}

          {parseOperationIds(sel.detail).length > 0 && (
            <Panel title="Records">
              {opsLoading ? (
                <p className="ea-text-muted" style={{ margin: 0, fontSize: 13 }}>
                  Loading record payloads…
                </p>
              ) : (ops ?? []).length === 0 ? (
                <p className="ea-text-muted" style={{ margin: 0, fontSize: 13 }}>
                  Records were drained and are no longer in the journal.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {(ops ?? []).map((op) => (
                    <div key={op.operationId}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                                    fontSize: 13, marginBottom: 6 }}>
                        <span aria-hidden="true" style={{ fontSize: 16 }}>
                          {entityTypeIcon(op.entityType)}
                        </span>
                        <span style={{ fontWeight: 500 }}>{entityTypeLabel(op.entityType)}</span>
                        <span className="ea-text-muted ea-mono" style={{ fontSize: 11 }}>
                          {op.entityRef}
                        </span>
                        <span className="ea-chip ea-chip--info" style={{ marginLeft: 'auto' }}>
                          {humaniseState(op.state)}
                        </span>
                        <Link to={`/sync/data/${op.operationId}`} className="ea-link-btn"
                              style={{ fontSize: 11 }}>
                          Open record →
                        </Link>
                      </div>
                      <JsonViewer value={op.payload}
                                  label={`${entityTypeLabel(op.entityType)} · ${op.entityRef}`} />
                    </div>
                  ))}
                  {parseOperationIds(sel.detail).length > (ops ?? []).length && (
                    <p className="ea-text-muted" style={{ margin: 0, fontSize: 11 }}>
                      Showing first {(ops ?? []).length} of {parseOperationIds(sel.detail).length}
                      {' '}records in this run.
                    </p>
                  )}
                </div>
              )}
            </Panel>
          )}

          {/* Metadata pulls + other non-record runs ship their summary as
              the run's `detail` JSON (total, snapshotId, centralVersion…).
              Render it as the payload directly rather than hiding it
              behind "no records to show". */}
          {(() => {
            const entries = detailEntries(sel.detail);
            const hasOps = parseOperationIds(sel.detail).length > 0;
            const hasByType = parseByType(sel.detail).length > 0;
            if (entries.length === 0 || (hasOps && hasByType)) return null;
            // Build a plain-English payload from the parsed JSON keys.
            let parsed: unknown = null;
            try { parsed = sel.detail ? JSON.parse(sel.detail) : null; } catch { parsed = null; }
            if (parsed && typeof parsed === 'object') {
              const clone: Record<string, unknown> = { ...(parsed as Record<string, unknown>) };
              delete clone.byType;
              delete clone.operationIds;
              return (
                <Panel title="Payload">
                  <JsonViewer value={clone} label={`Run ${sel.runId}`} maxDepth={3} />
                </Panel>
              );
            }
            return (
              <Panel title="Payload">
                <table className="ea-table ea-table--dense" style={{ width: '100%' }}>
                  <tbody>
                    {entries.map(([k, v]) => (
                      <tr key={k}>
                        <th style={{ textAlign: 'left', width: 220,
                                     color: 'var(--der-ink-500)', fontWeight: 500 }}>
                          {humaniseJob(k)}
                        </th>
                        <td className="ea-mono">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            );
          })()}
        </>
      )}

      {tab === 'related' && (
        <Panel title="Related">
          {relatedLinksForJob(sel.jobName).length === 0 ? (
            <p className="ea-text-muted" style={{ margin: 0, fontSize: 13 }}>
              No related screens for this job type.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {relatedLinksForJob(sel.jobName).map(([label, to, hint]) => (
                <Link key={to} to={to} className="ea-link-tile" style={{ padding: 10 }}>
                  <div className="ea-link-tile-body">
                    <div className="ea-link-tile-title">{label}</div>
                    <div className="ea-link-tile-desc">{hint}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
