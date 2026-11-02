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
 * §2.3.87 R-C/2 — `/data/events`: facility-local Event / Tracker
 * event browse. Replaces the DHIS2 Event Capture launch tile with a
 * real surface that shows locally-stored events + per-row sync state
 * + capture workflow lineage.
 */
export function DataEvents(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const workflowRunId = searchParams.get('workflowRunId');
  const workflowId = searchParams.get('workflowId');
  const [rows, setRows]
    = useState<ReadonlyArray<edgeApi.LocalEventRow> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [program, setProgram] = useState('');
  const [programStage, setProgramStage] = useState('');
  // §2.3.100 R-H — DER edge is single-OU; filter dropped.
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [occurredFrom, setOccurredFrom] = useState('');
  const [occurredTo, setOccurredTo]     = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(100);
  const [pullOpen, setPullOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  async function reload(): Promise<void> {
    try {
      const r = await edgeApi.listLocalEvents({
        program: program || undefined,
        programStage: programStage || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
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
    [program, programStage, statusFilter,
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
      r.eventId.toLowerCase().includes(q)
      || r.programUid.toLowerCase().includes(q)
      || r.programName?.toLowerCase().includes(q)
      || r.programStageUid.toLowerCase().includes(q)
      || r.orgUnitUid.toLowerCase().includes(q));
  }, [rows, query]);

  const paged = usePaged(filtered, 25);

  if (err && !rows) {
    return <ErrorBlock title="Local events load failed"
                        testId="err-data-events">{err}</ErrorBlock>;
  }
  if (!rows) {
    return <LoadingBlock testId="loading" />;
  }

  return (
    <div className="ea-screen" data-test="data-events">
      <Breadcrumbs items={[
        { label: 'Data', to: '/data' },
        { label: 'Events' },
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
          hint="Shows only events produced by this workflow run."
        />
      )}
      {workflowId && !workflowRunId && (
        <ScopedFilterChip
          label={`Workflow ${workflowId.slice(0, 8)}`}
          openTo={`/workflows/${encodeURIComponent(workflowId)}`}
          openLabel="Open workflow"
          onClear={() => setWorkflowId('')}
          hint="Shows only events captured through this workflow definition (any run)."
        />
      )}
      <SyncStatusBar
        tone="info"
        title="Events"
        statusLabel={`${rows.length.toLocaleString()} row${
          rows.length === 1 ? '' : 's'} locally`}
        subtitle={
          <>
            <span>Captured locally first — synced to DHIS2 Central
              by the sync worker. Includes single-events and
              tracker-program events.</span>
          </>
        }
        actions={
          <>
            <a href="/dhis-web-event-capture/index.html"
                target="_blank" rel="noopener noreferrer"
                className="ea-btn ea-btn--primary ea-btn--sm">
              <UiIcon icon="external" size={14} />
              <span>Open DHIS2 capture</span>
            </a>
            <button type="button"
                    className="ea-btn ea-btn--ghost ea-btn--sm"
                    onClick={() => setPullOpen(true)}
                    data-test="data-events-pull-open">
              <UiIcon icon="pull" size={14} />
              <span>Pull from Central</span>
            </button>
            <button type="button"
                    className="ea-btn ea-btn--ghost ea-btn--sm"
                    onClick={() => setPreviewOpen(true)}
                    data-test="data-events-preview-open">
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
          kind="events"
          workflowId={workflowId}
          workflowRunId={workflowRunId}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {pullOpen && (
        <PullEventsFromCentralDialog
          initialProgram={program}
          initialProgramStage={programStage}
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
                    data-test="data-events-search" />
            <MetadataPicker resource="programs"
                             value={program}
                             onChange={setProgram}
                             placeholder="Any program"
                             dataTest="data-events-program" />
            <MetadataPicker resource="programStages"
                             value={programStage}
                             onChange={setProgramStage}
                             placeholder="Any stage"
                             dataTest="data-events-stage" />
            <select className="ea-input" style={{ maxWidth: 140 }}
                     value={statusFilter}
                     onChange={(e) => setStatusFilter(e.target.value)}
                     data-test="data-events-status">
              {['ALL', 'ACTIVE', 'COMPLETED', 'VISITED', 'SCHEDULE', 'OVERDUE', 'SKIPPED']
                .map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : s}</option>)}
            </select>
            <WorkflowPicker
              value={workflowId ?? ''}
              onChange={setWorkflowId}
              boundKind={[
                'PROGRAM', 'PROGRAM_STAGE', 'PROGRAM_STAGE_SECTION',
                'DATA_ELEMENT',
              ]}
              placeholder="Any workflow"
              dataTest="data-events-workflow" />
            <DateRangePicker
              from={occurredFrom}
              to={occurredTo}
              onChange={({ from, to }) => {
                setOccurredFrom(from);
                setOccurredTo(to);
              }}
              dataTest="data-events-occurred" />
            <select className="ea-input" style={{ maxWidth: 100 }}
                     value={limit}
                     onChange={(e) => setLimit(Number(e.target.value))}
                     data-test="data-events-limit">
              {[50, 100, 200, 500].map((n) =>
                <option key={n} value={n}>{n} max</option>)}
            </select>
          </>
        }
      >
        {filtered.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>
            No matching events. Try widening the filters or capturing
            events via <strong>Open DHIS2 capture</strong>.
          </p>
        ) : (
          <EventsTable rows={paged.rows} />
        )}
        <TablePager {...paged.pagerProps} />
      </Panel>
    </div>
  );
}

function EventsTable(
  { rows }: { rows: ReadonlyArray<edgeApi.LocalEventRow> }
): JSX.Element {
  const navigate = useNavigate();
  const [lineageId, setLineageId] = useState<string | null>(null);
  return (
    <div className="ea-table-wrap">
      {lineageId && (
        <PayloadLineageDrawer kind="event" rowId={lineageId}
                               onClose={() => setLineageId(null)} />
      )}
      <table className="ea-table ea-table--dense ea-table--clickable"
             data-test="data-events-table">
        <thead><tr>
          <th style={{ width: 130 }}>Occurred</th>
          <th>Program</th>
          <th>Stage</th>
          <th style={{ width: 120 }}>Org unit</th>
          <th style={{ width: 90 }}>Status</th>
          <th style={{ width: 180 }}>Workflow</th>
          <th style={{ width: 60, textAlign: 'right' }}>Vals</th>
          <th style={{ width: 60, textAlign: 'right' }}>v</th>
          <th style={{ width: 140 }}>Sync state</th>
          <th style={{ width: 90 }}></th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.eventId}
                data-test={`data-events-row-${r.eventId}`}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('a,button')) return;
                  navigate(`/data/events/${r.eventId}`);
                }}
                style={{ cursor: 'pointer' }}>
              <td className="ea-text-muted" title={r.occurredAt ?? ''}>
                {r.occurredAt ? fmtAgo(r.occurredAt) : '—'}
              </td>
              <td title={r.programUid}>
                {r.programName ? (
                  <span style={{ fontWeight: 500 }}>{r.programName}</span>
                ) : (
                  <span className="ea-mono" style={{ fontSize: 11 }}>
                    {r.programUid}
                  </span>
                )}
              </td>
              <td title={r.programStageUid}>
                {r.programStageName ? (
                  r.programStageName
                ) : (
                  <span className="ea-mono" style={{ fontSize: 11 }}>
                    {r.programStageUid}
                  </span>
                )}
              </td>
              <td className="ea-mono" style={{ fontSize: 11 }}
                  title={r.orgUnitUid}>{r.orgUnitUid}</td>
              <td>
                <span className={`ea-chip ea-chip--${chipToneForStatus(r.status)}`}>
                  {r.status}
                </span>
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
                  <span className="ea-text-muted" style={{ fontStyle: 'italic' }}>
                    untagged
                  </span>
                )}
              </td>
              <td className="ea-mono"
                  style={{ textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums' }}>
                {r.dataValueCount}
              </td>
              <td className="ea-text-muted"
                  style={{ textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums' }}>
                {r.eventVersion}
              </td>
              <td><SyncStateChip row={r} /></td>
              <td>
                <button type="button"
                         className="ea-btn ea-btn--ghost ea-btn--sm"
                         onClick={(e) => {
                           /* §2.3.120 R-AQ — see DataTracker.tsx. */
                           e.stopPropagation();
                           setLineageId(r.eventId);
                         }}
                         data-test={`data-events-lineage-${r.eventId}`}>
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

function chipToneForStatus(status: edgeApi.LocalEventRow['status']): string {
  switch (status) {
    case 'COMPLETED': return 'success';
    case 'ACTIVE':    return 'info';
    case 'OVERDUE':   return 'danger';
    case 'SKIPPED':   return 'warning';
    case 'SCHEDULE':  return 'warning';
    case 'VISITED':   return 'neutral';
    default:          return 'neutral';
  }
}

function SyncStateChip(
  { row }: { row: edgeApi.LocalEventRow }
): JSX.Element {
  const state = row.syncState;
  if (state === null || state === undefined) {
    return <span className="ea-chip ea-chip--neutral">Local only</span>;
  }
  const { tone, label, to } = chipShape(state, row.operationId);
  const chip = (
    <span className={`ea-chip ea-chip--${tone}`}
          data-test={`data-events-chip-${state}`}>
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

/** §2.3.91 R-C/2.1 — scope picker + progress for the central-DHIS2
 *  events pull. Operator supplies program / orgUnit (+ optional
 *  programStage + date window); the pulled rows land on a
 *  CENTRAL_DOWNLOAD system workflow run. */
function PullEventsFromCentralDialog(
  { initialProgram, initialProgramStage, onClose, onDone }:
    { initialProgram: string;
      initialProgramStage: string;
      onClose(): void;
      onDone(): void }
): JSX.Element {
  const [program, setProgram] = useState(initialProgram);
  const [programStage, setProgramStage] = useState(initialProgramStage);
  // §2.3.100 R-H — pull dialog's own OU picker (may differ from edge OU).
  const [orgUnit, setOrgUnit] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<edgeApi.PullEventsResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = Boolean(program.trim() && orgUnit.trim()) && !busy;

  async function run(): Promise<void> {
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await edgeApi.pullEventsFromCentral({
        program: program.trim(),
        programStage: programStage.trim() || undefined,
        orgUnit: orgUnit.trim(),
        startDate: startDate.trim() || undefined,
        endDate: endDate.trim() || undefined,
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
         aria-label="Pull events from Central DHIS2"
         data-test="pull-events-dialog"
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
        <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>Pull events from Central DHIS2</h2>
        <p className="ea-text-muted" style={{ margin: '0 0 14px', fontSize: 12 }}>
          Fetches existing events from Central for a specific
          program / orgUnit (optionally scoped by stage + date range).
          Pulled rows are tagged with a <strong>CENTRAL_DOWNLOAD</strong>
          system workflow run so you can trace them, and re-enter
          the sync pipeline as any other local write.
        </p>

        <label className="ea-field">
          <span className="ea-field-label">Program</span>
          <MetadataPicker resource="programs"
                           value={program}
                           onChange={setProgram}
                           placeholder="Search programs by name or UID"
                           dataTest="pull-events-program" />
        </label>
        <label className="ea-field">
          <span className="ea-field-label">Program stage (optional)</span>
          <MetadataPicker resource="programStages"
                           value={programStage}
                           onChange={setProgramStage}
                           placeholder="Leave blank for all stages"
                           dataTest="pull-events-stage" />
        </label>
        <label className="ea-field">
          <span className="ea-field-label">Org unit</span>
          <MetadataPicker resource="organisationUnits"
                           value={orgUnit}
                           onChange={setOrgUnit}
                           placeholder="Search org units by name or UID"
                           dataTest="pull-events-orgunit" />
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          <label className="ea-field" style={{ flex: 1 }}>
            <span className="ea-field-label">Start date</span>
            <input className="ea-input ea-mono" type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    data-test="pull-events-start" />
          </label>
          <label className="ea-field" style={{ flex: 1 }}>
            <span className="ea-field-label">End date</span>
            <input className="ea-input ea-mono" type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    data-test="pull-events-end" />
          </label>
        </div>

        {err && (
          <p data-test="pull-events-error"
             style={{ color: 'var(--der-danger-ink)', fontSize: 12,
                       margin: '10px 0 0' }}>
            {err}
          </p>
        )}

        {result && (
          <div data-test="pull-events-result"
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
                   data-test="pull-events-close">
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button type="button"
                     className="ea-btn ea-btn--primary ea-btn--sm"
                     disabled={!canSubmit}
                     onClick={() => { run().catch(() => undefined); }}
                     data-test="pull-events-submit">
              {busy ? 'Pulling…' : 'Pull'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
