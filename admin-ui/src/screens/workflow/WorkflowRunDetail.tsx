import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { Panel, SyncStatusBar, Status, fmtAgo,
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
        <HeaderBar runId={runId} />
        <ErrorBlock title="Could not load run"
                     testId="wf-run-detail-error">{err}</ErrorBlock>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="ea-screen">
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
            <Link to="/workflows/monitoring"
                   className="ea-btn ea-btn--ghost ea-btn--sm">
              <UiIcon icon="external" size={14} />
              <span>Back to Monitoring</span>
            </Link>
            <Link to={`/workflows/${r.workflowId}`}
                   className="ea-btn ea-btn--ghost ea-btn--sm">
              <UiIcon icon="metadata" size={14} />
              <span>Workflow definition</span>
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
    </div>
  );
}

function HeaderBar({ runId }: { runId: string }): JSX.Element {
  return (
    <SyncStatusBar
      tone="muted"
      title="Workflow run"
      statusLabel={runId.slice(0, 8)}
      actions={
        <Link to="/workflows/monitoring"
               className="ea-btn ea-btn--ghost ea-btn--sm">
          <UiIcon icon="external" size={14} />
          <span>Back to Monitoring</span>
        </Link>
      }
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
