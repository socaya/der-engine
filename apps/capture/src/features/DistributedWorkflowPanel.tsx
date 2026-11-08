import { useEffect, useMemo, useState } from 'react';
import type { CaptureApi } from '../shared/types';

interface WorkflowSummary {
  readonly workflowId: string;
  readonly displayName: string;
  readonly defaultDeviceId: string | null;
  readonly steps: ReadonlyArray<{
    readonly stepId: string;
    readonly ordinal: number;
    readonly displayName: string;
    readonly ownerRole: string | null;
    readonly ownerDeviceId: string | null;
  }>;
}

interface CapApiWithRuns extends CaptureApi {
  listCaptureRuns: (opts: { workflowId: string; state?: string })
    => Promise<{ count: number; runs: ReadonlyArray<{
      runId: string; workflowId: string; businessKey: string;
      currentStepId: string | null;
      state: 'OPEN' | 'AWAITING' | 'COMPLETED' | 'REJECTED';
      updatedAt: string;
    }> }>;
  startCaptureRun: (workflowId: string, businessKey: string)
    => Promise<{ runId: string; currentStepId: string | null;
      state: string }>;
  getCaptureRunForm: (runId: string) => Promise<{
    displayName: string;
    sections: ReadonlyArray<{ displayName: string;
      fields: ReadonlyArray<{ fieldRef: string; dataElementUid: string;
        dataElementDisplayName: string; valueType: string;
        requirement: 'REQUIRED' | 'OPTIONAL' | 'READONLY' }> }>;
    upstreamContext?: ReadonlyArray<{ stepId: string;
      stepDisplayName: string;
      fields: ReadonlyArray<{ fieldRef: string;
        dataElementUid: string; dataElementDisplayName: string;
        valueType: string;
        requirement: 'REQUIRED' | 'OPTIONAL' | 'READONLY' }> }>;
  }>;
  getCaptureRunData: (runId: string) => Promise<{
    cells: Record<string, string>; lastUpdatedAt: string | null;
  }>;
  advanceCaptureRun: (runId: string) => Promise<{
    runId: string; currentStepId: string | null;
    state: string; completedByThisCall: boolean;
  }>;
}

/**
 * Distributed-workflow mode entry. The DER server assigns individual
 * devices to specific capture steps (Registration, Stage 1, Stage 2…)
 * so that a complete record is assembled across service points. When
 * this device is step-assigned, we replace the plain tracker/event
 * capture with:
 *
 *   • A header card naming the workflow + the operator's step(s).
 *   • Per-workflow:
 *       - prior-step data as read-only context (§FR-008),
 *       - the operator's step section (editable in a follow-up
 *         slice; current slice shows the field schema + prefill),
 *       - 'Advance run' when the current step is complete.
 */
export function DistributedWorkflowPanel(
  { api, workflows, myDeviceId }: {
    api: CaptureApi;
    workflows: ReadonlyArray<WorkflowSummary>;
    myDeviceId: string;
  },
): JSX.Element {
  const runApi = api as CapApiWithRuns;

  const assignments = useMemo(() =>
    workflows.map((w) => ({
      workflow: w,
      mySteps: w.steps.filter((s) => s.ownerDeviceId === myDeviceId),
      wholeWorkflow: w.defaultDeviceId === myDeviceId,
    })).filter((a) => a.wholeWorkflow || a.mySteps.length > 0),
  [workflows, myDeviceId]);

  const [openWorkflowId, setOpenWorkflowId] = useState<string | null>(
    assignments[0]?.workflow.workflowId ?? null);

  if (assignments.length === 0) return <></>;

  return (
    <div className="cap-dwf" data-test="cap-dwf">
      <header className="cap-dwf__head">
        <span className="cap-dwf__eyebrow">Distributed workflow</span>
        <h2 className="cap-dwf__title">
          {assignments.length === 1
            ? 'Your assigned step'
            : `${assignments.length} workflows assigned to this device`}
        </h2>
        <p className="cap-dwf__sub">
          Capture below contributes to the running workflow; the
          DER server stamps each write with the step lineage so a
          complete record is assembled across all service points.
        </p>
      </header>

      {assignments.length > 1 && (
        <nav className="cap-dwf__tabs" aria-label="Assigned workflows">
          {assignments.map(({ workflow }) => (
            <button key={workflow.workflowId} type="button"
                    className={'cap-dwf__tab'
                      + (openWorkflowId === workflow.workflowId
                        ? ' cap-dwf__tab--active' : '')}
                    onClick={() => setOpenWorkflowId(workflow.workflowId)}
                    data-test={'cap-dwf-tab-' + workflow.workflowId}>
              {workflow.displayName}
            </button>
          ))}
        </nav>
      )}

      {assignments
        .filter((a) => a.workflow.workflowId === openWorkflowId)
        .map((a) => (
          <WorkflowRunView key={a.workflow.workflowId}
                           api={runApi}
                           workflow={a.workflow}
                           mySteps={a.mySteps}
                           wholeWorkflow={a.wholeWorkflow} />
        ))}
    </div>
  );
}

function WorkflowRunView(
  { api, workflow, mySteps, wholeWorkflow }: {
    api: CapApiWithRuns;
    workflow: WorkflowSummary;
    mySteps: WorkflowSummary['steps'];
    wholeWorkflow: boolean;
  },
): JSX.Element {
  const [runs, setRuns] = useState<ReadonlyArray<{ runId: string;
    businessKey: string; currentStepId: string | null;
    state: 'OPEN' | 'AWAITING' | 'COMPLETED' | 'REJECTED';
    updatedAt: string }>>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [form, setForm] = useState<Awaited<ReturnType<
    CapApiWithRuns['getCaptureRunForm']>> | null>(null);
  const [cells, setCells] = useState<Record<string, string>>({});
  const [status, setStatus] =
    useState<'idle' | 'loading' | 'advancing' | 'err'>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const [businessKey, setBusinessKey] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.listCaptureRuns({
          workflowId: workflow.workflowId });
        if (cancelled) return;
        setRuns(r.runs);
        // Auto-open the most-recent OPEN or AWAITING run so the
        // operator lands on live work immediately.
        const active = r.runs.find((x) =>
          x.state === 'OPEN' || x.state === 'AWAITING');
        setRunId(active?.runId ?? null);
      } catch {
        if (!cancelled) setRuns([]);
      }
    })();
    return () => { cancelled = true; };
  }, [workflow.workflowId]);

  useEffect(() => {
    if (!runId) { setForm(null); setCells({}); return; }
    let cancelled = false;
    setStatus('loading'); setMsg(null);
    (async () => {
      try {
        const [f, d] = await Promise.all([
          api.getCaptureRunForm(runId),
          api.getCaptureRunData(runId),
        ]);
        if (cancelled) return;
        setForm(f);
        setCells(d.cells ?? {});
        setStatus('idle');
      } catch (err) {
        if (!cancelled) {
          setStatus('err');
          setMsg((err as Error).message ?? 'Failed to load run');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [runId]);

  async function onStart(): Promise<void> {
    const key = businessKey.trim();
    if (key === '') return;
    setStatus('loading'); setMsg(null);
    try {
      const run = await api.startCaptureRun(workflow.workflowId, key);
      setBusinessKey('');
      setRunId(run.runId);
      const r = await api.listCaptureRuns({
        workflowId: workflow.workflowId });
      setRuns(r.runs);
    } catch (err) {
      setStatus('err');
      setMsg('Failed to start run: ' + ((err as Error).message
        ?? 'unknown'));
    }
  }

  async function onAdvance(): Promise<void> {
    if (!runId) return;
    setStatus('advancing'); setMsg(null);
    try {
      const adv = await api.advanceCaptureRun(runId);
      setMsg(adv.completedByThisCall
        ? 'Run completed on edge · DER server now stamps the '
          + 'complete record with the full step lineage.'
        : 'Advanced to step ' + (adv.currentStepId ?? '(last)')
          + '.');
      // Reload the run list + form so the UI reflects the new step.
      const r = await api.listCaptureRuns({
        workflowId: workflow.workflowId });
      setRuns(r.runs);
      const fresh = await api.getCaptureRunForm(runId);
      setForm(fresh);
      setStatus('idle');
    } catch (err) {
      setStatus('err');
      setMsg('Failed to advance: ' + ((err as Error).message
        ?? 'unknown'));
    }
  }

  const current = runs.find((r) => r.runId === runId) ?? null;

  return (
    <div className="cap-dwf__run" data-test={'cap-dwf-run-'
          + workflow.workflowId}>

      {/* Steps strip — highlights the operator's step(s). */}
      <ol className="cap-dwf__steps">
        {workflow.steps.map((s) => {
          const mine = wholeWorkflow
            || mySteps.some((m) => m.stepId === s.stepId);
          const isCurrent = current?.currentStepId === s.stepId;
          return (
            <li key={s.stepId}
                className={'cap-dwf__step'
                  + (mine ? ' cap-dwf__step--mine' : '')
                  + (isCurrent ? ' cap-dwf__step--current' : '')}>
              <span className="cap-dwf__step-ord">{s.ordinal + 1}</span>
              <span className="cap-dwf__step-name">{s.displayName}</span>
              {isCurrent && (
                <span className="cap-dwf__step-flag">running</span>
              )}
              {mine && !isCurrent && (
                <span className="cap-dwf__step-flag">this device</span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Active run header + start form */}
      {runs.length === 0 ? (
        <div className="cap-dwf__start">
          <label className="cap-input" style={{ minWidth: 240 }}>
            <span className="cap-toolbar__field-label">
              Start a run — business key
            </span>
            <input className="cap-input__ctl" type="text"
                   value={businessKey}
                   onChange={(e) => setBusinessKey(e.target.value)}
                   placeholder="e.g. patient UID or visit date" />
          </label>
          <button type="button"
                  className="cap-btn cap-btn--primary"
                  disabled={businessKey.trim() === ''
                    || status === 'loading'}
                  onClick={() => { void onStart(); }}
                  data-test="cap-dwf-start">
            Start run
          </button>
        </div>
      ) : (
        <div className="cap-dwf__runs">
          <span className="cap-toolbar__field-label">Runs</span>
          <select className="cap-input__ctl"
                  value={runId ?? ''}
                  onChange={(e) => setRunId(e.target.value || null)}
                  data-test="cap-dwf-run-select">
            <option value="">— select a run —</option>
            {runs.map((r) => (
              <option key={r.runId} value={r.runId}>
                {r.businessKey} · {r.state}
                {' · step '}{r.currentStepId
                  ? r.currentStepId.slice(0, 8) : '—'}
              </option>
            ))}
          </select>
          <label className="cap-input" style={{ minWidth: 200 }}>
            <span className="cap-toolbar__field-label">
              + new run
            </span>
            <input className="cap-input__ctl" type="text"
                   value={businessKey}
                   onChange={(e) => setBusinessKey(e.target.value)}
                   placeholder="new business key" />
          </label>
          <button type="button"
                  className="cap-btn cap-btn--secondary"
                  disabled={businessKey.trim() === ''
                    || status === 'loading'}
                  onClick={() => { void onStart(); }}
                  data-test="cap-dwf-start-additional">
            Start
          </button>
        </div>
      )}

      {status === 'err' && msg && (
        <div className="cap-strip cap-strip--err"
             data-test="cap-dwf-err">
          {msg}
        </div>
      )}
      {status === 'idle' && msg && (
        <div className="cap-strip cap-strip--info"
             data-test="cap-dwf-ok">
          {msg}
        </div>
      )}

      {/* Upstream context — previous-step data read-only */}
      {form && (form.upstreamContext ?? []).length > 0 && (
        <div className="cap-dwf__ctx" data-test="cap-dwf-upstream">
          <h3 className="cap-dwf__ctx-title">
            Previous data (read-only)
          </h3>
          {form.upstreamContext!.map((ctx) => (
            <section key={ctx.stepId} className="cap-dwf__ctx-step">
              <h4 className="cap-dwf__ctx-step-title">
                {ctx.stepDisplayName}
              </h4>
              <dl className="cap-dwf__ctx-grid">
                {ctx.fields.map((f) => (
                  <div key={f.fieldRef}>
                    <dt>{f.dataElementDisplayName}</dt>
                    <dd>{cells[f.dataElementUid] ?? '—'}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}

      {/* Current step — schema + prefill (write path lands in
       *  the next slice; this slice shows WHAT the operator will
       *  capture + any pre-populated values). */}
      {form && (
        <div className="cap-dwf__step-form"
             data-test="cap-dwf-step-form">
          <h3 className="cap-dwf__ctx-title">
            Your step — {form.displayName}
          </h3>
          {form.sections.map((s, i) => (
            <section key={(s.displayName ?? '') + i}
                     className="cap-dwf__ctx-step">
              {s.displayName && (
                <h4 className="cap-dwf__ctx-step-title">
                  {s.displayName}
                </h4>
              )}
              <dl className="cap-dwf__ctx-grid">
                {s.fields.map((f) => (
                  <div key={f.fieldRef}>
                    <dt>
                      {f.dataElementDisplayName}
                      {f.requirement === 'REQUIRED' && (
                        <span className="cap-input__req">*</span>
                      )}
                    </dt>
                    <dd>
                      {cells[f.dataElementUid] ?? (
                        <em style={{ color: '#9097a8' }}>empty</em>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <p className="cap-strip cap-strip--info"
             style={{ marginTop: 12, marginLeft: 0,
               marginRight: 0 }}>
            <strong>Field editing</strong> lands in slice G9-28c.
            This panel confirms your step scope + any pre-populated
            values from upstream steps today; writes still go through
            the shell's capture-run form for now. Advancing without
            edits just transitions the run state.
          </p>
          {current && current.state !== 'COMPLETED'
            && current.state !== 'REJECTED' && (
            <button type="button"
                    className="cap-btn cap-btn--primary"
                    style={{ marginTop: 10 }}
                    onClick={() => { void onAdvance(); }}
                    disabled={status === 'advancing'}
                    data-test="cap-dwf-advance">
              {status === 'advancing' ? 'Advancing…' : 'Advance run'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
