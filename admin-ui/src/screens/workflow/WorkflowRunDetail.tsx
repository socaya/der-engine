import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { Breadcrumbs, Panel, SyncStatusBar, Status, fmtAgo,
         type SyncStatusTone } from '../shared';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';
import { UiIcon } from '../../components/UiIcon';

/**
 * §2.3.66 — admin-side read-only run detail. Drill target from the
 * Monitoring blockage/issue/conflict/draft panels. One screen gives
 * admins:
 *
 *   • Run header: state + business key + ago-fmt timestamps
 *   • Steps list with per-step state chip, owner device + role,
 *     captured timestamp and (if present) the contribution payload
 *   • Open issues scoped to this run
 *   • Pending conflicts scoped to this run
 *
 * Admin never visits the operator UI to troubleshoot — this is the
 * canonical read-only drill from Monitoring.
 */
export function WorkflowRunDetail(): JSX.Element {
  const { runId = '' } = useParams();
  const [detail, setDetail] = useState<edgeApi.AdminRunDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    edgeApi.getAdminRunDetail(runId)
      .then((d) => { setDetail(d); setErr(null); })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [runId]);

  if (err) {
    return (
      <div className="ea-screen">
        <TrailCrumbs runId={runId} />
        <HeaderBar runId={runId} />
        <ErrorBlock title="Could not load run"
                     testId="wf-run-detail-error">{err}</ErrorBlock>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="ea-screen">
        <TrailCrumbs runId={runId} />
        <HeaderBar runId={runId} />
        <LoadingBlock testId="wf-run-detail-loading" />
      </div>
    );
  }

  const r = detail.run;
  let tone: SyncStatusTone;
  if (r.state === 'COMPLETED')      tone = 'success';
  else if (r.state === 'REJECTED')  tone = 'danger';
  else if (r.state === 'AWAITING')  tone = 'info';
  else                              tone = 'muted';
  const bold = (v: string | number): JSX.Element =>
    <strong style={{ color: 'var(--der-ink-900)' }}>{v}</strong>;

  const completed = detail.steps.filter((s) => s.state === 'COMPLETE').length;
  const blocked   = detail.steps.filter((s) => s.state === 'BLOCKED').length;

  return (
    <div className="ea-screen" data-test="wf-run-detail-root">
      <TrailCrumbs runId={runId} runLabel={r.workflowName ?? undefined} />
      <SyncStatusBar
        tone={tone}
        title={r.workflowName ?? 'Workflow run'}
        statusLabel={r.state}
        subtitle={
          <>
            <span>Business key {bold(r.businessKey)}</span>
            <span>·</span>
            <span>Started {bold(fmtAgo(r.createdAt))}</span>
            <span>·</span>
            <span>Updated {bold(fmtAgo(r.updatedAt))}</span>
            <span>·</span>
            <span>Steps {bold(detail.steps.length)}</span>
            <span>·</span>
            <span>Completed {bold(completed)}</span>
            {blocked > 0 && <><span>·</span><span>Blocked {bold(blocked)}</span></>}
            {detail.issues.length > 0 && (
              <><span>·</span><span>Issues {bold(detail.issues.length)}</span></>
            )}
            {detail.conflicts.length > 0 && (
              <><span>·</span><span>Conflicts {bold(detail.conflicts.length)}</span></>
            )}
          </>
        }
        actions={
          <>
            <Link to={`/workflows/${r.workflowId}`}
                   className="ea-btn ea-btn--ghost ea-btn--sm">
              <UiIcon icon="metadata" size={14} />
              <span>Workflow definition</span>
            </Link>
            {/* §2.3.80 R-B/2 — ?workflowRunId= scopes the destination
                list visually (chip surfaces at the top); server-side
                filtering lands with R-A-data when operation_journal
                grows workflow_run_id. */}
            <Link to={`/data/queue?workflowRunId=${encodeURIComponent(runId)}`}
                   className="ea-btn ea-btn--ghost ea-btn--sm"
                   title="Open Sync Data queue scoped to this run">
              <UiIcon icon="data-queue" size={14} />
              <span>Sync queue</span>
            </Link>
            <Link to={`/sync/attention?workflowRunId=${encodeURIComponent(runId)}`}
                   className="ea-btn ea-btn--ghost ea-btn--sm"
                   title="Open Sync Attention scoped to this run">
              <UiIcon icon="attention" size={14} />
              <span>Sync attention</span>
            </Link>
            {/* §2.3.80 R-B/3 + §2.3.88 R-C/2.3 — Workflows ↔ Data
                round-trips. These three now have real server-side
                filters (data tables carry workflow_run_id). */}
            <Link to={`/data/aggregate?workflowRunId=${encodeURIComponent(runId)}`}
                   className="ea-btn ea-btn--ghost ea-btn--sm"
                   title="Open Aggregate browse scoped to this run">
              <UiIcon icon="aggregate" size={14} />
              <span>Aggregate</span>
            </Link>
            <Link to={`/data/events?workflowRunId=${encodeURIComponent(runId)}`}
                   className="ea-btn ea-btn--ghost ea-btn--sm"
                   title="Open Events browse scoped to this run">
              <UiIcon icon="event" size={14} />
              <span>Events</span>
            </Link>
            <Link to={`/data/tracker?workflowRunId=${encodeURIComponent(runId)}`}
                   className="ea-btn ea-btn--ghost ea-btn--sm"
                   title="Open Tracker browse scoped to this run">
              <UiIcon icon="tei" size={14} />
              <span>Tracker</span>
            </Link>
            <Link to={`/data/drafts?workflowRunId=${encodeURIComponent(runId)}`}
                   className="ea-btn ea-btn--ghost ea-btn--sm"
                   title="Open Drafts scoped to this run">
              <UiIcon icon="activity" size={14} />
              <span>Drafts</span>
            </Link>
          </>
        }
      />

      <Panel title="Steps">
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense"
                 data-test="wf-run-detail-steps">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Step</th>
                <th style={{ width: 110 }}>State</th>
                <th style={{ width: 100 }}>Role</th>
                <th>Device</th>
                <th style={{ width: 120 }}>Last change</th>
              </tr>
            </thead>
            <tbody>
              {detail.steps.map((s) => (
                <tr key={s.stepId} data-test={`wf-run-step-${s.stepId}`}>
                  <td className="ea-text-muted"
                      style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {s.ordinal + 1}
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    {s.stepName}
                    {s.state === 'BLOCKED' && s.blockedBy.length > 0 && (
                      <div className="ea-text-muted" style={{ fontSize: 11 }}>
                        Waiting on:{' '}
                        {s.blockedBy.map((p) => p.stepName ?? p.stepId.slice(0, 8)).join(', ')}
                      </div>
                    )}
                  </td>
                  <td>
                    <Status tone={s.state === 'COMPLETE' ? 'success'
                                   : s.state === 'READY' ? 'info'
                                   : s.state === 'BLOCKED' ? 'muted' : 'info'}>
                      {s.state}
                    </Status>
                  </td>
                  <td className="ea-text-muted">{s.ownerRole}</td>
                  <td className="ea-text-muted">
                    {s.ownerDeviceName ?? (s.ownerDeviceId
                      ? s.ownerDeviceId.slice(0, 8) : 'Any')}
                  </td>
                  <td className="ea-text-muted" title={s.stateAt ?? undefined}>
                    {s.stateAt ? fmtAgo(s.stateAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Contributions"
             action={<span className="ea-text-muted" style={{ fontSize: 11 }}>
               {detail.steps.filter((s) => s.contribution).length} / {detail.steps.length}
             </span>}>
        {detail.steps.filter((s) => s.contribution).length === 0 ? (
          <p className="ea-text-muted"
             style={{ padding: 12, textAlign: 'center' }}>
            No contributions captured on this run yet.
          </p>
        ) : (
          <div className="ea-wf-run-contribs">
            {detail.steps.filter((s) => s.contribution).map((s) => (
              <div key={s.stepId} className="ea-wf-run-contrib"
                   data-test={`wf-run-contrib-${s.stepId}`}>
                <div className="ea-wf-run-contrib-head">
                  <span className="ea-wf-run-contrib-step">{s.stepName}</span>
                  <span className="ea-text-muted" style={{ fontSize: 11 }}>
                    by {s.contribution!.submittedDeviceName ?? 'unknown'} ·
                    {' ' + fmtAgo(s.contribution!.submittedAt)}
                  </span>
                </div>
                <pre className="ea-wf-run-contrib-payload"
                     data-test={`wf-run-contrib-${s.stepId}-payload`}>
                  {prettyJson(s.contribution!.payload)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {detail.issues.length > 0 && (
        <Panel title="Issues"
               action={<span className="ea-text-muted" style={{ fontSize: 11 }}>
                 {detail.issues.length} issue{detail.issues.length === 1 ? '' : 's'}
               </span>}>
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense"
                   data-test="wf-run-detail-issues">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Severity</th>
                  <th>Message</th>
                  <th>Step</th>
                  <th style={{ width: 110 }}>Field</th>
                  <th style={{ width: 110 }}>Detected</th>
                </tr>
              </thead>
              <tbody>
                {detail.issues.map((i) => (
                  <tr key={i.issueId}>
                    <td>
                      <Status tone={i.severity === 'ERROR' ? 'danger'
                                     : i.severity === 'WARNING' ? 'warning' : 'info'}>
                        {i.severity}
                      </Status>
                    </td>
                    <td>{i.message}</td>
                    <td className="ea-text-muted">{i.stepName ?? '—'}</td>
                    <td className="ea-text-muted ea-mono" style={{ fontSize: 11 }}>
                      {i.fieldRef ?? '—'}
                    </td>
                    <td className="ea-text-muted" title={i.detectedAt}>
                      {fmtAgo(i.detectedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {detail.conflicts.length > 0 && (
        <Panel title="Conflicts"
               action={<span className="ea-text-muted" style={{ fontSize: 11 }}>
                 {detail.conflicts.length} conflict{detail.conflicts.length === 1 ? '' : 's'}
               </span>}>
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense"
                   data-test="wf-run-detail-conflicts">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Identity</th>
                  <th style={{ width: 140 }}>Status</th>
                  <th style={{ width: 110 }}>Detected</th>
                </tr>
              </thead>
              <tbody>
                {detail.conflicts.map((c) => (
                  <tr key={c.conflictId}>
                    <td>{c.category}</td>
                    <td className="ea-text-muted ea-mono" style={{ fontSize: 11 }}>
                      {c.identityKey}
                    </td>
                    <td>
                      <Status tone={c.status === 'PENDING_REVIEW' ? 'warning' : 'muted'}>
                        {c.status}
                      </Status>
                    </td>
                    <td className="ea-text-muted" title={c.detectedAt}>
                      {fmtAgo(c.detectedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <OutboundBundlePanel runId={runId} />
    </div>
  );
}

/** §2.3.101 R-L — closes the loop between workflow runs and
 *  /data/queue. Lists every operation_journal row this run produced,
 *  with current state + the DHIS2 endpoint it will land on.
 *
 *  §2.3.102 R-N + R-Q — state-chip filter + inline Retry per row. */
function OutboundBundlePanel({ runId }: { runId: string }): JSX.Element {
  const [m, setM] = useState<edgeApi.WorkflowRunManifest | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // §2.3.103 R-S — chip filter is now a multi-select set.
  const [stateFilter, setStateFilter] = useState<ReadonlyArray<string>>([]);
  const [retryBusy, setRetryBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy]   = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let alive = true;
    edgeApi.workflowRunManifest(runId,
          stateFilter.length > 0 ? { state: stateFilter } : undefined)
      .then((r) => { if (alive) setM(r); })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [runId, stateFilter, refreshKey]);

  function toggleFilter(s: string): void {
    setStateFilter((prev) => prev.includes(s)
        ? prev.filter((x) => x !== s)
        : [...prev, s]);
  }

  async function doRetry(opId: string): Promise<void> {
    setRetryBusy(opId);
    try {
      await edgeApi.retryOperation(opId);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRetryBusy(null);
    }
  }

  async function doBulkRetry(): Promise<void> {
    setBulkBusy(true);
    try {
      await edgeApi.retryRun(runId,
            stateFilter.length > 0 ? stateFilter : undefined);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBulkBusy(false);
    }
  }

  // §2.3.104 R-V — guard bulk retry when the set is non-trivial.
  // Threshold of 10 keeps the one-click flow for small triage sets
  // but forces a confirm for large sweeps that'd be hard to undo.
  const BULK_RETRY_CONFIRM_THRESHOLD = 10;
  function requestBulkRetry(count: number): void {
    if (count > BULK_RETRY_CONFIRM_THRESHOLD) {
      const scope = stateFilter.length > 0
          ? stateFilter.join(', ')
          : 'all retry-eligible states';
      const ok = window.confirm(`Retry ${count} operations (${scope})?`);
      if (!ok) return;
    }
    doBulkRetry().catch(() => undefined);
  }

  if (err) {
    return (
      <Panel title="Outbound bundle">
        <p className="ea-text-muted"
           data-test="wf-run-manifest-error"
           style={{ fontSize: 12 }}>{err}</p>
      </Panel>
    );
  }
  if (!m) {
    return (
      <Panel title="Outbound bundle">
        <p className="ea-text-muted"
           style={{ fontSize: 12 }}>Loading manifest…</p>
      </Panel>
    );
  }
  if (m.total === 0) {
    return (
      <Panel title="Outbound bundle">
        <p className="ea-text-muted"
           data-test="wf-run-manifest-empty"
           style={{ fontSize: 12 }}>
          This run hasn&apos;t produced any outbox entries yet.
        </p>
      </Panel>
    );
  }

  const stateTone = (s: string): string =>
      s === 'CENTRAL_ACCEPTED' ? 'success'
    : s === 'CONFLICT_REVIEW' || s === 'CENTRAL_REJECTED'
       || s === 'QUARANTINED' ? 'danger'
    : s === 'RETRYABLE' ? 'warning'
    : 'info';

  const retryable = (s: string): boolean =>
      s === 'RETRYABLE' || s === 'CENTRAL_REJECTED'
      || s === 'CONFLICT_REVIEW' || s === 'QUARANTINED'
      || s === 'UNKNOWN_OUTCOME';

  const panelTitle = stateFilter.length > 0
    ? `Outbound bundle (${m.filteredTotal} of ${m.total} shown · ${stateFilter.join(', ')})`
    : `Outbound bundle (${m.total} operation${m.total === 1 ? '' : 's'})`;

  // §2.3.103 R-T — count how many of the currently-shown ops are
  // retry-eligible; drives the bulk-retry button's visibility + label.
  const retryEligibleShown = m.operations.filter((o) => retryable(o.state)).length;

  return (
    <Panel title={panelTitle}>
      <div data-test="wf-run-manifest"
           style={{ display: 'flex', flexWrap: 'wrap',
                     gap: 10, marginBottom: 12,
                     fontSize: 12 }}>
        {Object.entries(m.countsByEntityType).map(([k, n]) => (
          <span key={k} className="ea-chip ea-chip--neutral">
            {k}: <strong>{n}</strong>
          </span>
        ))}
        <span style={{ borderLeft: '1px solid var(--der-border)',
                        margin: '0 4px' }} />
        {Object.entries(m.countsByState).map(([s, n]) => {
          const on = stateFilter.includes(s);
          return (
            <button key={s} type="button"
                     className={`ea-chip ea-chip--${stateTone(s)}`
                       + (on ? ' ea-chip--selected' : '')}
                     onClick={() => toggleFilter(s)}
                     data-test={`wf-run-manifest-filter-${s}`}
                     style={{ cursor: 'pointer',
                               border: on
                                 ? '2px solid var(--der-primary-ink, #2563eb)'
                                 : undefined }}>
              {s}: <strong>{n}</strong>
            </button>
          );
        })}
        {stateFilter.length > 0 && (
          <button type="button"
                   className="ea-btn ea-btn--ghost ea-btn--sm"
                   onClick={() => setStateFilter([])}
                   data-test="wf-run-manifest-filter-clear">
            Clear filter
          </button>
        )}
        {retryEligibleShown > 0 && (
          <button type="button"
                   className="ea-btn ea-btn--primary ea-btn--sm"
                   style={{ marginLeft: 'auto' }}
                   onClick={() => requestBulkRetry(retryEligibleShown)}
                   disabled={bulkBusy}
                   data-test="wf-run-manifest-retry-all">
            {bulkBusy
              ? 'Retrying…'
              : `Retry ${retryEligibleShown} operation${retryEligibleShown === 1 ? '' : 's'}`}
          </button>
        )}
      </div>
      <div className="ea-table-wrap">
        <table className="ea-table ea-table--dense"
                data-test="wf-run-manifest-table">
          <thead><tr>
            <th>Entity</th>
            <th>Ref</th>
            <th>Endpoint</th>
            <th>State</th>
            <th style={{ textAlign: 'right' }}>Att.</th>
            <th>Updated</th>
            <th style={{ width: 80 }}></th>
          </tr></thead>
          <tbody>
            {m.operations.map((o) => (
              <tr key={o.operationId}>
                <td>
                  <span className="ea-chip ea-chip--neutral">
                    {o.entityType}
                  </span>
                </td>
                <td className="ea-mono" style={{ fontSize: 11 }}
                    title={o.entityRef}>
                  {o.entityRef.length > 24
                    ? o.entityRef.slice(0, 22) + '…'
                    : o.entityRef}
                </td>
                <td className="ea-mono" style={{ fontSize: 11 }}>
                  {o.endpoint ?? '—'}
                </td>
                <td>
                  <Link to={`/sync/attention/${o.operationId}`}
                         style={{ textDecoration: 'none' }}>
                    <span className={`ea-chip ea-chip--${stateTone(o.state)}`}>
                      {o.state}
                    </span>
                  </Link>
                </td>
                <td style={{ textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums' }}>
                  {o.attemptCount}
                </td>
                <td className="ea-text-muted" style={{ fontSize: 11 }}
                    title={o.updatedAt ?? ''}>
                  {o.updatedAt ? fmtAgo(o.updatedAt) : '—'}
                </td>
                <td>
                  {retryable(o.state) && (
                    <button type="button"
                             className="ea-btn ea-btn--ghost ea-btn--sm"
                             onClick={() => { doRetry(o.operationId)
                                                .catch(() => undefined); }}
                             disabled={retryBusy === o.operationId}
                             data-test={`wf-run-manifest-retry-${o.operationId}`}>
                      {retryBusy === o.operationId ? 'Retrying…' : 'Retry'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function HeaderBar({ runId }: { runId: string }): JSX.Element {
  return (
    <SyncStatusBar
      tone="muted"
      title="Workflow run"
      statusLabel={runId.slice(0, 8)}
    />
  );
}

/** Workflow run breadcrumb: Workflows › Monitoring › Run #abc.
 *  Last crumb uses the workflow name when known, falling back to
 *  the first 8 chars of the run id. */
function TrailCrumbs(
  { runId, runLabel }: { runId: string; runLabel?: string | null }
): JSX.Element {
  return (
    <Breadcrumbs
      testId="wf-run-detail-crumbs"
      items={[
        { label: 'Workflows',   to: '/workflows' },
        { label: 'Monitoring',  to: '/workflows/monitoring' },
        { label: runLabel ?? `Run ${runId.slice(0, 8)}` },
      ]}
    />
  );
}

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
