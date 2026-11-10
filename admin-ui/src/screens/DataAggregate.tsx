import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import {
  Breadcrumbs, LastPulledChip, LocalVsCentralBadge,
  Panel, ScopedFilterChip, SyncStatusBar,
  fmtAgo, usePaged, TablePager,
} from './shared';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';
import { UiIcon } from '../components/UiIcon';
import { MetadataPicker } from '../components/MetadataPicker';
import { WorkflowPicker } from '../components/WorkflowPicker';
import { CentralPayloadDrawer } from '../components/CentralPayloadDrawer';
import { PeriodPicker } from '../components/PeriodPicker';
import { PayloadLineageDrawer } from '../components/PayloadLineageDrawer';
import { useFocusTrap } from '../components/useFocusTrap';

/**
 * §2.3.81 R-C/1 — `/data/aggregate`: facility-local Aggregate data
 * browse. Replaces the launch-tile stub with a real surface that
 * shows (a) a pipeline strip summarising the entire local store, and
 * (b) a paginated per-row table with filterable period / orgUnit /
 * dataElement + sync-state chip. Capture itself still goes through
 * the DHIS2 web app running on the edge — the admin UI deep-links to
 * it rather than re-implementing data entry.
 */
export function DataAggregate(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const workflowRunId = searchParams.get('workflowRunId');
  const workflowId = searchParams.get('workflowId');
  const [rows, setRows]
    = useState<ReadonlyArray<edgeApi.LocalAggregateRow> | null>(null);
  const [pipeline, setPipeline]
    = useState<edgeApi.LocalAggregatePipeline | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // §2.3.99 — DER edges are single-OU, so the OU filter was always a
  // no-op. Dropped from this screen.
  const [period, setPeriod] = useState('');
  const [dataElement, setDataElement] = useState('');
  const [dataSet, setDataSet] = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(100);
  const [pullOpen, setPullOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  async function reload(): Promise<void> {
    try {
      const r = await edgeApi.listLocalAggregate({
        period: period || undefined,
        dataElement: dataElement || undefined,
        dataSet: dataSet || undefined,
        workflowRunId: workflowRunId || undefined,
        workflowId: workflowId || undefined,
        limit,
      });
      setRows(r.rows);
      setPipeline(r.pipeline);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => { reload().catch(() => undefined);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */ },
    [period, dataElement, dataSet, workflowRunId, workflowId, limit]);

  function setWorkflowId(next: string): void {
    const q = new URLSearchParams(searchParams);
    if (next) q.set('workflowId', next); else q.delete('workflowId');
    setSearchParams(q, { replace: true });
  }

  // Client-side free-text filter — server already applies the
  // structural filters, this one just narrows what the admin sees.
  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.dataElementUid.toLowerCase().includes(q)
      || r.orgUnitUid.toLowerCase().includes(q)
      || r.valueText.toLowerCase().includes(q)
      || (r.comment ?? '').toLowerCase().includes(q)
      || (r.dataSetName ?? '').toLowerCase().includes(q)
      || (r.dataSetUid ?? '').toLowerCase().includes(q));
  }, [rows, query]);

  const paged = usePaged(filtered, 25);

  if (err && !rows) {
    return <ErrorBlock title="Local aggregate load failed"
                        testId="err-data-aggregate">{err}</ErrorBlock>;
  }
  if (!rows || !pipeline) {
    return <LoadingBlock testId="loading" />;
  }

  const totalLabel = `${pipeline.captured.toLocaleString()} row${
    pipeline.captured === 1 ? '' : 's'} locally`;

  return (
    <div className="ea-screen" data-test="data-aggregate">
      <Breadcrumbs
        items={[
          { label: 'Data', to: '/data' },
          { label: 'Aggregate' },
        ]} />
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
          hint="Shows only aggregate rows produced by this workflow run."
        />
      )}
      {workflowId && !workflowRunId && (
        <ScopedFilterChip
          label={`Workflow ${workflowId.slice(0, 8)}`}
          openTo={`/workflows/${encodeURIComponent(workflowId)}`}
          openLabel="Open workflow"
          onClear={() => setWorkflowId('')}
          hint="Shows only aggregate rows captured through this workflow definition (any run)."
        />
      )}
      <SyncStatusBar
        tone="info"
        title="Aggregate data"
        statusLabel={totalLabel}
        subtitle={
          <>
            <span>Captured locally first — synced to DHIS2 Central
              by the sync worker.</span>
            {' '}<LastPulledChip entityType="AGGREGATE" />
          </>
        }
        actions={
          <>
            <a href="/dhis-web-dataentry/index.html"
                target="_blank" rel="noopener noreferrer"
                className="ea-btn ea-btn--primary ea-btn--sm">
              <UiIcon icon="external" size={14} />
              <span>Open DHIS2 capture</span>
            </a>
            <button type="button"
                    className="ea-btn ea-btn--ghost ea-btn--sm"
                    onClick={() => setPullOpen(true)}
                    data-test="data-aggregate-pull-open">
              <UiIcon icon="pull" size={14} />
              <span>Pull from Central</span>
            </button>
            <button type="button"
                    className="ea-btn ea-btn--ghost ea-btn--sm"
                    onClick={() => setPreviewOpen(true)}
                    data-test="data-aggregate-preview-open">
              <UiIcon icon="external" size={14} />
              <span>Ready for Central</span>
            </button>
            <Link to="/data/queue"
                   className="ea-btn ea-btn--ghost ea-btn--sm">
              <UiIcon icon="data-queue" size={14} />
              <span>Sync queue</span>
            </Link>
          </>
        }
      />

      {previewOpen && (
        <CentralPayloadDrawer
          kind="aggregate"
          workflowId={workflowId}
          workflowRunId={workflowRunId}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {pullOpen && (
        <PullFromCentralDialog
          initialDataSet={dataSet}
          initialPeriod={period}
          onClose={() => setPullOpen(false)}
          onDone={() => {
            setPullOpen(false);
            reload().catch(() => undefined);
          }}
        />
      )}

      <Panel
        title={`${filtered.length.toLocaleString()} row${
          filtered.length === 1 ? '' : 's'} shown`}
        action={
          <>
            <input className="ea-input" style={{ maxWidth: 160 }} type="search"
                    placeholder="Search values"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    data-test="data-aggregate-search" />
            <PeriodPicker
              value={period}
              onChange={setPeriod}
              defaultType="Monthly"
              dataTest="data-aggregate-period" />
            <MetadataPicker resource="dataSets"
                             value={dataSet}
                             onChange={setDataSet}
                             placeholder="Any dataset"
                             dataTest="data-aggregate-dataset" />
            <MetadataPicker resource="dataElements"
                             value={dataElement}
                             onChange={setDataElement}
                             placeholder="Any data element"
                             dataTest="data-aggregate-dataelement" />
            <WorkflowPicker
              value={workflowId ?? ''}
              onChange={setWorkflowId}
              boundKind={['DATA_SET', 'DATA_SET_SECTION', 'DATA_ELEMENT']}
              placeholder="Any workflow"
              dataTest="data-aggregate-workflow" />
            <select className="ea-input" style={{ maxWidth: 100 }}
                     value={limit}
                     onChange={(e) => setLimit(Number(e.target.value))}
                     data-test="data-aggregate-limit">
              {[50, 100, 200, 500].map((n) =>
                <option key={n} value={n}>{n} max</option>)}
            </select>
          </>
        }
      >
        {filtered.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>
            No matching rows. Try widening the filters or capturing data
            first via <strong>Open DHIS2 capture</strong>.
          </p>
        ) : (
          <AggregateTable rows={paged.rows} />
        )}
        <TablePager {...paged.pagerProps} />
      </Panel>
    </div>
  );
}

function AggregateTable(
  { rows }: { rows: ReadonlyArray<edgeApi.LocalAggregateRow> }
): JSX.Element {
  const navigate = useNavigate();
  const [lineageId, setLineageId] = useState<string | null>(null);
  return (
    <div className="ea-table-wrap">
      {lineageId && (
        <PayloadLineageDrawer kind="aggregate" rowId={lineageId}
                               onClose={() => setLineageId(null)} />
      )}
      <table className="ea-table ea-table--dense ea-table--clickable"
             data-test="data-aggregate-table">
        <thead><tr>
          <th style={{ width: 130 }}>Last updated</th>
          <th style={{ width: 160 }}>Dataset</th>
          <th style={{ width: 180 }}>Workflow</th>
          <th>Data element</th>
          <th style={{ width: 120 }}>Org unit</th>
          <th style={{ width: 110 }}>Period</th>
          <th style={{ width: 70, textAlign: 'right' }}>Value</th>
          <th style={{ width: 60, textAlign: 'right' }}>v</th>
          <th style={{ width: 140 }}>Sync state</th>
          <th style={{ width: 90 }}></th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.valueId}
                data-test={`data-aggregate-row-${r.valueId}`}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  // Don't swallow clicks that landed on in-row links/buttons.
                  if (target.closest('a,button')) return;
                  navigate(`/data/aggregate/${r.valueId}`);
                }}
                style={{ cursor: 'pointer' }}>
              <td className="ea-text-muted"
                  title={r.submittedAt ?? ''}>
                {r.submittedAt ? fmtAgo(r.submittedAt) : '—'}
              </td>
              <td title={r.dataSetUid ?? '(untagged — pre-V069 or ad-hoc write)'}>
                {r.dataSetName
                  ? <span style={{ fontWeight: 500 }}>{r.dataSetName}</span>
                  : r.dataSetUid
                    ? <span className="ea-mono" style={{ fontSize: 11 }}>
                        {r.dataSetUid}
                      </span>
                    : <span className="ea-text-muted" style={{ fontStyle: 'italic' }}>
                        untagged
                      </span>}
              </td>
              <td title={r.workflowRunId
                          ? `Open workflow run in Workflows module — `
                            + `${r.workflowKind ?? 'USER'} · ${r.workflowBusinessKey ?? ''}`
                          : '(no workflow run attached)'}>
                {r.workflowRunId ? (
                  /* §2.3.108 R-AC — trailing ↗ makes the cross-module
                     jump explicit; title discloses "Open workflow run
                     in Workflows module" for keyboard + screen-reader. */
                  <Link to={`/workflows/monitoring/runs/${r.workflowRunId}`}
                        data-cross-module="Workflows"
                        style={{ textDecoration: 'none',
                                  color: 'var(--der-primary-ink)',
                                  display: 'inline-flex',
                                  alignItems: 'center', gap: 4 }}>
                    {r.workflowKind === 'SYSTEM' ? (
                      <span className="ea-chip ea-chip--neutral"
                            style={{ marginRight: 2 }}>SYS</span>
                    ) : null}
                    <span style={{ fontSize: 12 }}>
                      {r.workflowName ?? r.workflowRunId.slice(0, 8)}
                    </span>
                    <span aria-hidden="true"
                          style={{ fontSize: 10,
                                    color: 'var(--der-ink-500)' }}>↗</span>
                  </Link>
                ) : (
                  <span className="ea-text-muted" style={{ fontStyle: 'italic' }}>
                    untagged
                  </span>
                )}
              </td>
              <td className="ea-mono" style={{ fontSize: 11 }}
                  title={r.dataElementUid}>
                {r.dataElementUid}
              </td>
              <td className="ea-mono" style={{ fontSize: 11 }}
                  title={r.orgUnitUid}>
                {r.orgUnitUid}
              </td>
              <td className="ea-mono" style={{ fontSize: 11 }}>{r.periodIso}</td>
              <td className="ea-mono"
                  style={{ textAlign: 'right', fontWeight: 500 }}>
                {r.valueText}
              </td>
              <td className="ea-text-muted"
                  style={{ textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums' }}>
                {r.valueVersion}
              </td>
              <td><SyncStateChip row={r} /></td>
              <td>
                <button type="button"
                         className="ea-btn ea-btn--ghost ea-btn--sm"
                         onClick={(e) => {
                           /* §2.3.120 R-AQ — see DataTracker.tsx. */
                           e.stopPropagation();
                           setLineageId(r.valueId);
                         }}
                         data-test={`data-aggregate-lineage-${r.valueId}`}>
                  Lineage
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SyncStateChip(
  { row }: { row: edgeApi.LocalAggregateRow }
): JSX.Element {
  const state = row.syncState;
  /* NFR-25 — pair every row with an unambiguous local/central badge
   * so operators don't have to decode the state-machine vocabulary. */
  const badge = <LocalVsCentralBadge state={state} size="xs" />;
  if (state === null || state === undefined) {
    return (
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        {badge}
      </span>
    );
  }
  const { tone, label, to } = chipShape(state, row.operationId);
  const chip = (
    <span className={`ea-chip ea-chip--${tone}`}
          data-test={`data-aggregate-chip-${state}`}>
      {label}
    </span>
  );
  const pair = (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center',
                     flexWrap: 'wrap' }}>
      {badge}
      {chip}
    </span>
  );
  return to
    ? <Link to={to}
            style={{ textDecoration: 'none' }}>{pair}</Link>
    : pair;
}

function chipShape(state: edgeApi.LocalDataSyncState,
                     operationId: string | null)
: { tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
    label: string; to?: string } {
  switch (state) {
    case 'PENDING':
      return { tone: 'info', label: 'Pending push', to: '/data/queue' };
    case 'IN_FLIGHT':
      return { tone: 'info', label: 'Sending…', to: '/data/queue' };
    case 'RETRYABLE':
      return { tone: 'warning', label: 'Retrying', to: '/data/queue' };
    case 'CENTRAL_ACCEPTED':
      return { tone: 'success', label: 'Synced' };
    case 'CENTRAL_REJECTED':
      return { tone: 'danger', label: 'Rejected',
               to: operationId ? `/sync/attention/${operationId}` : '/sync/attention' };
    case 'CONFLICT_REVIEW':
      return { tone: 'warning', label: 'Conflict',
               to: operationId ? `/sync/attention/${operationId}` : '/sync/attention' };
    case 'REQUIRES_APPROVAL':
      return { tone: 'warning', label: 'Approval', to: '/data/queue' };
    case 'QUARANTINED':
      return { tone: 'danger', label: 'Quarantined',
               to: operationId ? `/sync/attention/${operationId}` : '/sync/attention' };
    case 'UNKNOWN_OUTCOME':
      return { tone: 'warning', label: 'Unknown', to: '/sync/attention' };
    default:
      return { tone: 'neutral', label: state };
  }
}

/** §2.3.86 R-C/1.4 — scope picker + progress for the central-DHIS2
 *  pull. Operator supplies dataSet / orgUnit / period, server-side
 *  CENTRAL_DOWNLOAD system workflow run owns the pulled rows. */
function PullFromCentralDialog(
  { initialDataSet, initialPeriod, onClose, onDone }:
    { initialDataSet: string;
      initialPeriod: string;
      onClose(): void;
      onDone(): void }
): JSX.Element {
  const [dataSet, setDataSet] = useState(initialDataSet);
  // §2.3.99 — DER is single-OU, but the Pull-from-Central dialog
  // still needs the OU to scope the Central-side query, so it stays
  // here as a dialog-local field (defaulting to blank). The browse
  // filter above does not expose OU.
  const [orgUnit, setOrgUnit] = useState('');
  const [period, setPeriod] = useState(initialPeriod);
  const [busy, setBusy] = useState(false);
  const [result, setResult]
    = useState<edgeApi.PullAggregateResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = Boolean(dataSet.trim() && orgUnit.trim() && period.trim()) && !busy;
  /* focusContainer: true — the first focusable child is a lazy-loading
   * picker; moving focus there on mount would auto-open the dropdown
   * before the user interacts. Focus the dialog container instead. */
  const dialogRef = useFocusTrap<HTMLDivElement>({
    active: true, onClose, focusContainer: true,
  });

  async function run(): Promise<void> {
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await edgeApi.pullAggregateFromCentral({
        dataSet: dataSet.trim(),
        orgUnit: orgUnit.trim(),
        period: period.trim(),
      });
      setResult(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true"
         aria-label="Pull aggregate values from Central DHIS2"
         data-test="pull-from-central-dialog"
         ref={dialogRef}
         style={{
           position: 'fixed', inset: 0, zIndex: 1000,
           display: 'flex', alignItems: 'center', justifyContent: 'center',
           background: 'rgba(15, 23, 42, 0.45)',
         }}>
      <div style={{
             background: 'var(--der-raised)',
             borderRadius: 8, padding: 18, width: 'min(520px, 92vw)',
             boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
             border: '1px solid var(--der-border)',
           }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>Pull from Central DHIS2</h2>
        <p className="ea-text-muted" style={{ margin: '0 0 14px', fontSize: 12 }}>
          Fetches existing aggregate values from Central for a specific
          dataSet / orgUnit / period. Pulled rows are tagged with a
          <strong> CENTRAL_DOWNLOAD </strong>
          system workflow run so you can trace them, and re-enter the
          sync pipeline as any other local write would.
        </p>

        <label className="ea-field">
          <span className="ea-field-label">Dataset</span>
          <MetadataPicker resource="dataSets"
                           value={dataSet}
                           onChange={setDataSet}
                           placeholder="Search datasets by name or UID"
                           dataTest="pull-dataset" />
        </label>
        <label className="ea-field">
          <span className="ea-field-label">Org unit</span>
          <MetadataPicker resource="organisationUnits"
                           value={orgUnit}
                           onChange={setOrgUnit}
                           placeholder="Search org units by name or UID"
                           dataTest="pull-orgunit" />
        </label>
        <label className="ea-field">
          <span className="ea-field-label">Period (ISO)</span>
          <input className="ea-input ea-mono"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="e.g. 202411 or 2024Q4"
                  data-test="pull-period" />
        </label>

        {err && (
          <p data-test="pull-error"
             style={{ color: 'var(--der-danger-ink)', fontSize: 12,
                       margin: '10px 0 0' }}>
            {err}
          </p>
        )}

        {result && (
          <div data-test="pull-result"
               style={{ marginTop: 12, padding: 10,
                         background: 'var(--der-primary-wash, #eff6ff)',
                         border: '1px solid var(--der-primary-ink, #2563eb)',
                         borderRadius: 6, fontSize: 13 }}>
            <div>Imported <strong>{result.imported.toLocaleString()}</strong>,
              ignored <strong>{result.ignored.toLocaleString()}</strong>.</div>
            <div style={{ marginTop: 4 }}>
              <Link to={`/workflows/monitoring/runs/${result.runId}`}
                     style={{ fontSize: 12 }}>
                Open workflow run →
              </Link>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end',
                       gap: 8, marginTop: 16 }}>
          <button type="button"
                   className="ea-btn ea-btn--ghost ea-btn--sm"
                   onClick={result ? onDone : onClose}
                   data-test="pull-close">
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button type="button"
                     className="ea-btn ea-btn--primary ea-btn--sm"
                     disabled={!canSubmit}
                     onClick={() => { run().catch(() => undefined); }}
                     data-test="pull-submit">
              {busy ? 'Pulling…' : 'Pull'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
