import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import {
  Breadcrumbs, Panel, ScopedFilterChip, SyncStatusBar,
  fmtAgo, usePaged, TablePager,
} from './shared';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';
import { UiIcon } from '../components/UiIcon';
import { MetadataPicker } from '../components/MetadataPicker';
import { WorkflowPicker } from '../components/WorkflowPicker';
import { CentralPayloadDrawer } from '../components/CentralPayloadDrawer';
import { PayloadLineageDrawer } from '../components/PayloadLineageDrawer';
import { DateRangePicker } from '../components/DateRangePicker';

/**
 * §2.3.89 R-C/3 — `/data/tracker`: facility-local Tracker browse.
 * Replaces the DHIS2 Tracker Capture launch tile with a real surface
 * combining tracked entities, enrolments, and tracker-stage events
 * into one time-ordered view with per-row workflow lineage + a
 * single-TEI zoom via `?teiUid=`.
 */
export function DataTracker(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const workflowRunId = searchParams.get('workflowRunId');
  const workflowId = searchParams.get('workflowId');
  const scopedTeiUid = searchParams.get('teiUid');
  const [rows, setRows]
    = useState<ReadonlyArray<edgeApi.LocalTrackerRow> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [kind, setKind]
    = useState<'ALL' | 'TEI' | 'ENROLLMENT' | 'EVENT'>('ALL');
  const [program, setProgram] = useState('');
  // §2.3.100 R-H — DER edge is single-OU; filter dropped.
  const [teiUidFilter, setTeiUidFilter] = useState('');
  const [occurredFrom, setOccurredFrom] = useState('');
  const [occurredTo, setOccurredTo]     = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(100);
  const [pullOpen, setPullOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  async function reload(): Promise<void> {
    try {
      const r = await edgeApi.listLocalTracker({
        kind: kind === 'ALL' ? undefined : kind,
        program: program || undefined,
        teiUid: scopedTeiUid || teiUidFilter || undefined,
        workflowRunId: workflowRunId || undefined,
        workflowId: workflowId || undefined,
        occurredFrom: occurredFrom || undefined,
        occurredTo: occurredTo || undefined,
        limit,
      });
      setRows(r.rows);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => { reload().catch(() => undefined);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */ },
    [kind, program, teiUidFilter, scopedTeiUid,
      occurredFrom, occurredTo,
      workflowRunId, workflowId, limit]);

  function setWorkflowId(next: string): void {
    const q = new URLSearchParams(searchParams);
    if (next) q.set('workflowId', next); else q.delete('workflowId');
    setSearchParams(q, { replace: true });
  }

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.rowId.toLowerCase().includes(q)
      || (r.teiUid ?? '').toLowerCase().includes(q)
      || (r.programUid ?? '').toLowerCase().includes(q)
      || (r.programName ?? '').toLowerCase().includes(q)
      || (r.orgUnitUid ?? '').toLowerCase().includes(q));
  }, [rows, query]);

  const paged = usePaged(filtered, 25);

  if (err && !rows) {
    return <ErrorBlock title="Local tracker load failed"
                        testId="err-data-tracker">{err}</ErrorBlock>;
  }
  if (!rows) {
    return <LoadingBlock testId="loading" />;
  }

  // Count by kind for the status label.
  const byKind = rows.reduce((acc, r) => {
    acc[r.kind] = (acc[r.kind] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const statusLabel = Object.entries(byKind)
    .map(([k, n]) => `${n} ${k.toLowerCase()}${n === 1 ? '' : 's'}`)
    .join(' · ') || '0 rows';

  return (
    <div className="ea-screen" data-test="data-tracker">
      <Breadcrumbs items={[
        { label: 'Data', to: '/data' },
        { label: 'Tracker' },
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
          hint="Shows only tracker rows produced by this workflow run."
        />
      )}
      {workflowId && !workflowRunId && (
        <ScopedFilterChip
          label={`Workflow ${workflowId.slice(0, 8)}`}
          openTo={`/workflows/${encodeURIComponent(workflowId)}`}
          openLabel="Open workflow"
          onClear={() => setWorkflowId('')}
          hint="Shows only tracker rows captured through this workflow definition (any run)."
        />
      )}
      {scopedTeiUid && (
        <ScopedFilterChip
          label={`TEI ${scopedTeiUid}`}
          openTo="/data/tracker"
          openLabel="Clear TEI"
          onClear={() => {
            const next = new URLSearchParams(searchParams);
            next.delete('teiUid');
            setSearchParams(next, { replace: true });
          }}
          hint="Scoped to one tracked entity (TEI + its enrolments + events)."
        />
      )}
      <SyncStatusBar
        tone="info"
        title="Tracker"
        statusLabel={statusLabel}
        subtitle={
          <>
            <span>Captured locally first — TEIs, enrolments and
              tracker-stage events, synced to DHIS2 Central by the
              sync worker.</span>
          </>
        }
        actions={
          <>
            <a href="/dhis-web-tracker-capture/index.html"
                target="_blank" rel="noopener noreferrer"
                className="ea-btn ea-btn--primary ea-btn--sm">
              <UiIcon icon="external" size={14} />
              <span>Open DHIS2 capture</span>
            </a>
            <button type="button"
                    className="ea-btn ea-btn--ghost ea-btn--sm"
                    onClick={() => setPullOpen(true)}
                    data-test="data-tracker-pull-open">
              <UiIcon icon="pull" size={14} />
              <span>Pull from Central</span>
            </button>
            <button type="button"
                    className="ea-btn ea-btn--ghost ea-btn--sm"
                    onClick={() => setPreviewOpen(true)}
                    data-test="data-tracker-preview-open">
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
          kind="tracker"
          workflowId={workflowId}
          workflowRunId={workflowRunId}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {pullOpen && (
        <PullTrackerFromCentralDialog
          initialProgram={program}
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
                    placeholder="Search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    data-test="data-tracker-search" />
            <select className="ea-input" style={{ maxWidth: 140 }}
                     value={kind}
                     onChange={(e) => setKind(e.target.value as typeof kind)}
                     data-test="data-tracker-kind">
              <option value="ALL">All kinds</option>
              <option value="TEI">TEIs</option>
              <option value="ENROLLMENT">Enrolments</option>
              <option value="EVENT">Events</option>
            </select>
            <MetadataPicker resource="programs"
                             value={program}
                             onChange={setProgram}
                             placeholder="Any program"
                             dataTest="data-tracker-program" />
            {!scopedTeiUid && (
              <input className="ea-input" style={{ maxWidth: 180 }} type="text"
                      placeholder="TEI UID"
                      value={teiUidFilter}
                      onChange={(e) => setTeiUidFilter(e.target.value)}
                      data-test="data-tracker-teiuid" />
            )}
            <WorkflowPicker
              value={workflowId ?? ''}
              onChange={setWorkflowId}
              boundKind={[
                'PROGRAM', 'PROGRAM_SECTION',
                'PROGRAM_STAGE', 'PROGRAM_STAGE_SECTION',
                'TRACKED_ENTITY_TYPE', 'TRACKED_ENTITY_ATTRIBUTE',
                'DATA_ELEMENT',
              ]}
              placeholder="Any workflow"
              dataTest="data-tracker-workflow" />
            <DateRangePicker
              from={occurredFrom}
              to={occurredTo}
              onChange={({ from, to }) => {
                setOccurredFrom(from);
                setOccurredTo(to);
              }}
              dataTest="data-tracker-occurred" />
            <select className="ea-input" style={{ maxWidth: 100 }}
                     value={limit}
                     onChange={(e) => setLimit(Number(e.target.value))}
                     data-test="data-tracker-limit">
              {[50, 100, 200, 500].map((n) =>
                <option key={n} value={n}>{n} max</option>)}
            </select>
          </>
        }
      >
        {filtered.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>
            No matching tracker rows. Try widening the filters or
            capturing data via <strong>Open DHIS2 capture</strong>.
          </p>
        ) : (
          <TrackerTable
            rows={paged.rows}
            onZoomTei={(uid) => {
              const next = new URLSearchParams(searchParams);
              next.set('teiUid', uid);
              setSearchParams(next);
            }} />
        )}
        <TablePager {...paged.pagerProps} />
      </Panel>
    </div>
  );
}

function TrackerTable(
  { rows, onZoomTei }:
    { rows: ReadonlyArray<edgeApi.LocalTrackerRow>;
      onZoomTei(teiUid: string): void }
): JSX.Element {
  const navigate = useNavigate();
  const [lineage, setLineage] = useState<{
    kind: 'tei' | 'enrollment' | 'tracker-event';
    id: string;
  } | null>(null);
  return (
    <div className="ea-table-wrap">
      {lineage && (
        <PayloadLineageDrawer kind={lineage.kind} rowId={lineage.id}
                               onClose={() => setLineage(null)} />
      )}
      <table className="ea-table ea-table--dense ea-table--clickable"
             data-test="data-tracker-table">
        <thead><tr>
          <th style={{ width: 110 }}>Updated</th>
          <th style={{ width: 90 }}>Kind</th>
          <th>Row</th>
          <th style={{ width: 140 }}>TEI</th>
          <th>Program</th>
          <th style={{ width: 100 }}>Org unit</th>
          <th style={{ width: 100 }}>Status / Date</th>
          <th style={{ width: 180 }}>Workflow</th>
          <th style={{ width: 140 }}>Sync state</th>
          <th style={{ width: 50, textAlign: 'right' }}>v</th>
          <th style={{ width: 90 }}></th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.kind}-${r.rowId}`}
                data-test={`data-tracker-row-${r.rowId}`}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('a,button')) return;
                  // Only TEI rows have a detail page today;
                  // enrolment/event rows navigate to TEI view instead.
                  const uid = r.kind === 'TEI' ? r.rowId : r.teiUid;
                  if (uid) navigate(`/data/tracker/tei/${uid}`);
                }}
                style={{ cursor: r.kind === 'TEI' || r.teiUid
                                   ? 'pointer' : 'default' }}>
              <td className="ea-text-muted" title={r.sortTs ?? ''}>
                {r.sortTs ? fmtAgo(r.sortTs) : '—'}
              </td>
              <td>
                <span className={`ea-chip ea-chip--${chipToneForKind(r.kind)}`}>
                  {r.kind}
                </span>
              </td>
              <td className="ea-mono" style={{ fontSize: 11 }}
                  title={r.rowId}>
                {r.rowId}
              </td>
              <td>
                {r.teiUid ? (
                  <button type="button"
                          className="ea-btn ea-btn--ghost ea-btn--sm"
                          style={{ fontFamily: 'var(--der-mono)',
                                     fontSize: 11 }}
                          onClick={() => onZoomTei(r.teiUid as string)}
                          title="Scope to this TEI">
                    {r.teiUid}
                  </button>
                ) : (
                  <span className="ea-text-muted">—</span>
                )}
              </td>
              <td title={r.programUid ?? ''}>
                {r.kind === 'TEI' ? (
                  <span style={{ fontWeight: 500 }}>
                    {r.teTypeName ?? r.teType ?? 'Tracked entity'}
                  </span>
                ) : r.programName ? (
                  <>
                    <div style={{ fontWeight: 500 }}>{r.programName}</div>
                    {r.programStageName && (
                      <div className="ea-text-muted"
                           style={{ fontSize: 11 }}>
                        {r.programStageName}
                      </div>
                    )}
                  </>
                ) : (
                  <span className="ea-mono" style={{ fontSize: 11 }}>
                    {r.programUid ?? '—'}
                  </span>
                )}
              </td>
              <td className="ea-mono" style={{ fontSize: 11 }}
                  title={r.orgUnitUid ?? ''}>
                {r.orgUnitUid}
              </td>
              <td>
                {r.status ? (
                  <>
                    <span className={`ea-chip ea-chip--${chipToneForStatus(r.status)}`}>
                      {r.status}
                    </span>
                    {(r.enrollmentDate || r.occurredDate) && (
                      <div className="ea-text-muted"
                           style={{ fontSize: 10, marginTop: 2 }}>
                        {r.enrollmentDate ?? r.occurredDate}
                      </div>
                    )}
                  </>
                ) : (
                  <span className="ea-text-muted">—</span>
                )}
              </td>
              <td title={r.workflowRunId
                          ? `Open workflow run in Workflows module — `
                            + `${r.workflowKind ?? 'USER'} · ${r.workflowBusinessKey ?? ''}`
                          : '(no workflow run attached)'}>
                {r.workflowRunId ? (
                  /* §2.3.108 R-AC — explicit ↗ disclosure. */
                  <Link to={`/workflows/monitoring/runs/${r.workflowRunId}`}
                        data-cross-module="Workflows"
                        style={{ textDecoration: 'none',
                                  color: 'var(--der-primary-ink)',
                                  display: 'inline-flex',
                                  alignItems: 'center', gap: 4 }}>
                    {r.workflowKind === 'SYSTEM' && (
                      <span className="ea-chip ea-chip--neutral"
                            style={{ marginRight: 2 }}>SYS</span>
                    )}
                    <span style={{ fontSize: 12 }}>
                      {r.workflowName ?? r.workflowRunId.slice(0, 8)}
                    </span>
                    <span aria-hidden="true"
                          style={{ fontSize: 10,
                                    color: 'var(--der-ink-500)' }}>↗</span>
                  </Link>
                ) : (
                  <span className="ea-text-muted"
                        style={{ fontStyle: 'italic' }}>
                    untagged
                  </span>
                )}
              </td>
              <td><TrackerSyncChip row={r} /></td>
              <td className="ea-text-muted"
                  style={{ textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums' }}>
                {r.version}
              </td>
              <td>
                <button type="button"
                         className="ea-btn ea-btn--ghost ea-btn--sm"
                         onClick={(e) => {
                           e.stopPropagation();
                           setLineage({
                             kind: r.kind === 'TEI'        ? 'tei'
                                 : r.kind === 'ENROLLMENT' ? 'enrollment'
                                 :                           'tracker-event',
                             id: r.rowId,
                           });
                         }}
                         data-test={`data-tracker-lineage-${r.rowId}`}>
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

/** §2.3.94 R-C/3.2 — same vocabulary as Aggregate / Events sync
 *  chips, parameterised by the tracker row's syncState + opId. */
function TrackerSyncChip(
  { row }: { row: edgeApi.LocalTrackerRow }
): JSX.Element {
  const state = row.syncState;
  if (state === null || state === undefined) {
    return <span className="ea-chip ea-chip--neutral">Local only</span>;
  }
  const { tone, label, to } = chipShape(state, row.operationId);
  const chip = (
    <span className={`ea-chip ea-chip--${tone}`}
          data-test={`data-tracker-chip-${state}`}>
      {label}
    </span>
  );
  return to
    ? <Link to={to} style={{ textDecoration: 'none' }}>{chip}</Link>
    : chip;
}

function chipShape(state: edgeApi.LocalDataSyncState, operationId: string | null)
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

function chipToneForKind(kind: edgeApi.LocalTrackerRow['kind']): string {
  switch (kind) {
    case 'TEI':        return 'info';
    case 'ENROLLMENT': return 'warning';
    case 'EVENT':      return 'success';
    default:           return 'neutral';
  }
}

function chipToneForStatus(status: string): string {
  switch (status) {
    case 'COMPLETED': return 'success';
    case 'ACTIVE':    return 'info';
    case 'OVERDUE':   return 'danger';
    case 'SKIPPED':   return 'warning';
    case 'SCHEDULED': return 'warning';
    case 'VISITED':   return 'neutral';
    case 'CANCELLED': return 'neutral';
    default:          return 'neutral';
  }
}

/** §2.3.93 R-C/3.1 — scope picker + progress for the tracker pull.
 *  Operator supplies program + orgUnit; the server cascades TEIs,
 *  enrolments, and stage events into the local tables under a shared
 *  CENTRAL_DOWNLOAD system workflow run. */
function PullTrackerFromCentralDialog(
  { initialProgram, onClose, onDone }:
    { initialProgram: string;
      onClose(): void;
      onDone(): void }
): JSX.Element {
  const [program, setProgram] = useState(initialProgram);
  // §2.3.100 R-H — dialog-local OU (edge is single-OU, but Central
  // pull may target a different one).
  const [orgUnit, setOrgUnit] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<edgeApi.PullTrackerResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = Boolean(program.trim() && orgUnit.trim()) && !busy;

  async function run(): Promise<void> {
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await edgeApi.pullTrackerFromCentral({
        program: program.trim(),
        orgUnit: orgUnit.trim(),
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
         aria-label="Pull tracker from Central DHIS2"
         data-test="pull-tracker-dialog"
         style={{
           position: 'fixed', inset: 0, zIndex: 1000,
           display: 'flex', alignItems: 'center', justifyContent: 'center',
           background: 'rgba(15, 23, 42, 0.45)',
         }}>
      <div style={{
             background: 'var(--der-raised)',
             borderRadius: 8, padding: 18, width: 'min(560px, 92vw)',
             boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
             border: '1px solid var(--der-border)',
           }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>Pull tracker from Central DHIS2</h2>
        <p className="ea-text-muted" style={{ margin: '0 0 14px', fontSize: 12 }}>
          Cascaded pull: tracked entities + their enrolments in the
          chosen program + any stage events underneath. Each pulled
          row is tagged with the <strong>CENTRAL_DOWNLOAD</strong>
          system workflow run so you can trace them, and re-enter the
          sync pipeline as any other local write.
        </p>

        <label className="ea-field">
          <span className="ea-field-label">Program</span>
          <MetadataPicker resource="programs"
                           value={program}
                           onChange={setProgram}
                           placeholder="Search programs by name or UID"
                           dataTest="pull-tracker-program" />
        </label>
        <label className="ea-field">
          <span className="ea-field-label">Org unit</span>
          <MetadataPicker resource="organisationUnits"
                           value={orgUnit}
                           onChange={setOrgUnit}
                           placeholder="Search org units by name or UID"
                           dataTest="pull-tracker-orgunit" />
        </label>

        {err && (
          <p data-test="pull-tracker-error"
             style={{ color: 'var(--der-danger-ink)', fontSize: 12,
                       margin: '10px 0 0' }}>
            {err}
          </p>
        )}

        {result && (
          <div data-test="pull-tracker-result"
               style={{ marginTop: 12, padding: 10,
                         background: 'var(--der-primary-wash, #eff6ff)',
                         border: '1px solid var(--der-primary-ink, #2563eb)',
                         borderRadius: 6, fontSize: 13 }}>
            <div>Imported{' '}
              <strong>{result.teis.toLocaleString()}</strong> TEIs,{' '}
              <strong>{result.enrolments.toLocaleString()}</strong> enrolments,{' '}
              <strong>{result.events.toLocaleString()}</strong> events.
            </div>
            {result.errors > 0 && (
              <div style={{ color: 'var(--der-warning-ink)', marginTop: 2 }}>
                {result.errors} row{result.errors === 1 ? '' : 's'} skipped —
                see the workflow run for details.
              </div>
            )}
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
                   data-test="pull-tracker-close">
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button type="button"
                     className="ea-btn ea-btn--primary ea-btn--sm"
                     disabled={!canSubmit}
                     onClick={() => { run().catch(() => undefined); }}
                     data-test="pull-tracker-submit">
              {busy ? 'Pulling…' : 'Pull'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
