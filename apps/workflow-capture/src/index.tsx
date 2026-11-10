import { useEffect, useState, type FormEvent } from 'react';
import {
  useAuth, useOrgUnitBinding, useOnlineStatus, useDerApi,
  ScreenCard, StatusPill,
} from '@der/app-sdk';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'starting' }
  | { kind: 'advancing' }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string };

interface WorkflowRow {
  readonly workflowId: string;
  readonly displayName: string;
  readonly enabled: boolean;
}

interface RunRow {
  readonly runId: string;
  readonly workflowId: string;
  readonly businessKey: string;
  readonly currentStepId: string | null;
  readonly state: 'OPEN' | 'AWAITING' | 'COMPLETED' | 'REJECTED';
  readonly updatedAt: string;
}

interface FormAssemblyLite {
  readonly displayName: string;
  readonly formType: string;
  readonly bindingUid: string;
  readonly ownership?: { isMyStep: boolean };
}

interface FormPrefillLite {
  readonly cells: Record<string, string>;
  readonly lastUpdatedAt: string | null;
}

/**
 * Workflow-run capture app (C-UI-5c slice 5). Replaces CaptureRunList
 * + CaptureRunForm over the slice-5 rollout. The shell screens stay
 * in place for this release; operators reach this app via the
 * launcher at `/apps/workflow-capture`.
 *
 * Slice-5 ships the dispatch path end-to-end: pick a workflow, list
 * its runs, open a run to show its current step + prefill cells, and
 * advance the run. Full field-level editing (ADR-0036 D-CAP-3/4/5
 * write paths via CaptureFormRenderer) is deferred to later
 * slice-5 follow-ups — the shell's CaptureRunForm still owns that
 * code path.
 */
export default function WorkflowCaptureApp(): JSX.Element {
  const auth = useAuth();
  const ou = useOrgUnitBinding();
  const online = useOnlineStatus();
  const api = useDerApi();

  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [workflowId, setWorkflowId] = useState('');
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [form, setForm] = useState<FormAssemblyLite | null>(null);
  const [prefill, setPrefill] = useState<FormPrefillLite | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const [startOpen, setStartOpen] = useState(false);
  const [businessKey, setBusinessKey] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.listCaptureWorkflows()
      .then((r) => { if (!cancelled) setWorkflows(r.workflows.filter((w) => w.enabled)); })
      .catch(() => { if (!cancelled) setWorkflows([]); });
    return () => { cancelled = true; };
  }, [api]);

  async function reloadRuns(): Promise<void> {
    if (workflowId === '') { setRuns([]); return; }
    setStatus({ kind: 'loading' });
    try {
      const r = await api.listCaptureRuns({ workflowId });
      setRuns(r.runs);
      setStatus({ kind: 'idle' });
    } catch (err) {
      setStatus({ kind: 'error', message: (err as Error).message ?? 'Load failed' });
    }
  }
  useEffect(() => { void reloadRuns(); setSelectedRunId(null); setForm(null);
    setPrefill(null);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [workflowId]);

  async function openRun(runId: string): Promise<void> {
    setSelectedRunId(runId);
    setForm(null);
    setPrefill(null);
    setStatus({ kind: 'loading' });
    try {
      const [f, d] = await Promise.all([
        api.getCaptureRunForm(runId) as Promise<FormAssemblyLite>,
        api.getCaptureRunData(runId) as Promise<FormPrefillLite>,
      ]);
      setForm(f);
      setPrefill(d);
      setStatus({ kind: 'idle' });
    } catch (err) {
      setStatus({ kind: 'error', message: (err as Error).message ?? 'Load failed' });
    }
  }

  async function onStart(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (workflowId === '' || businessKey.trim() === '') return;
    setStatus({ kind: 'starting' });
    try {
      const run = await api.startCaptureRun(workflowId, businessKey.trim());
      setStatus({ kind: 'ok', message: `Started run ${run.runId.slice(0, 8)}…` });
      setBusinessKey('');
      setStartOpen(false);
      void reloadRuns();
    } catch (err) {
      setStatus({ kind: 'error', message: (err as Error).message ?? 'Start failed' });
    }
  }

  async function onAdvance(): Promise<void> {
    if (!selectedRunId) return;
    setStatus({ kind: 'advancing' });
    try {
      const adv = await api.advanceCaptureRun(selectedRunId);
      setStatus({ kind: 'ok',
        message: adv.completedByThisCall
          ? 'Run completed.'
          : `Advanced to ${adv.currentStepId ?? '(no next step)'}.` });
      void reloadRuns();
      void openRun(selectedRunId);
    } catch (err) {
      setStatus({ kind: 'error', message: (err as Error).message ?? 'Advance failed' });
    }
  }

  const selectedRun = runs.find((r) => r.runId === selectedRunId) ?? null;

  return (
    <ScreenCard
      title="Workflow capture"
      actions={
        <StatusPill tone={online.isOnline ? 'success' : 'warning'}>
          {online.isOnline ? 'online' : `offline (${online.queuedCount} queued)`}
        </StatusPill>
      }
    >
      {/* Matches Data Entry's sticky toolbar treatment so the two
       *  apps share the same chrome vocabulary. */}
      <style>{`
        .der-wc-toolbar {
          position: sticky;
          top: 0;
          z-index: 5;
          margin: 0 0px 12px;
          padding: 10px 20px 10px 20px;
          background: #ffffff;
          border-bottom: 1px solid #e5e9ef;
          box-shadow: 0 1px 2px rgba(16, 26, 50, 0.04);
        }
      `}</style>
      <p style={{ margin: 0, color: '#6e7a8a', fontSize: 13 }}>
        Signed in as <strong>{auth.displayName}</strong> • Bound OU
        <code style={{ marginInline: 6 }} title={ou.orgUnitPath}>{ou.orgUnitDisplayName || ou.orgUnitUid}</code>
      </p>
      {!ou.bound && (
        <p style={{ marginTop: 12, color: '#8a2525' }}>
          Device is not bound to an organisation unit — ask an admin
          to complete provisioning before capturing workflow runs.
        </p>
      )}

      <div className="der-wc-toolbar" data-test="der-wc-toolbar">
        <div style={{ display: 'grid',
          gridTemplateColumns: '1fr auto', gap: 12,
          alignItems: 'end' }}>
          <label>Workflow
            <select value={workflowId}
                    onChange={(e) => setWorkflowId(e.target.value)}
                    style={inputStyle}>
              <option value="">— pick a workflow —</option>
              {workflows.map((w) => (
                <option key={w.workflowId} value={w.workflowId}>
                  {w.displayName}
                </option>
              ))}
            </select>
          </label>
          <button type="button"
                  onClick={() => setStartOpen(true)}
                  disabled={!ou.bound || workflowId === ''}
                  style={primaryBtn}>
            Start run
          </button>
        </div>
      </div>

      {startOpen && (
        <form onSubmit={onStart} style={{ marginTop: 12, padding: 12,
          border: '1px solid #d7dde5', borderRadius: 3,
          background: '#fafbfc' }}>
          <label>Business key
            <input value={businessKey}
                   onChange={(e) => setBusinessKey(e.target.value)}
                   placeholder="e.g. orgUnit:202611 or TEI uid"
                   style={inputStyle} />
          </label>
          <p style={{ fontSize: 12, color: '#6e7a8a', margin: '6px 0' }}>
            Identifies this run uniquely within the workflow.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit"
                    disabled={businessKey.trim() === '' || status.kind === 'starting'}
                    style={primaryBtn}>
              {status.kind === 'starting' ? 'Starting…' : 'Start'}
            </button>
            <button type="button"
                    onClick={() => setStartOpen(false)}
                    style={secondaryBtn}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {status.kind === 'ok' && (
        <div style={okStrip} data-test="wc-ok">{status.message}</div>
      )}
      {status.kind === 'error' && (
        <div style={errorStrip} data-test="wc-err">{status.message}</div>
      )}

      <h3 style={sectionHeading}>
        Runs {runs.length > 0 && `(${runs.length})`}
      </h3>
      {runs.length === 0 ? (
        <p style={{ color: '#6e7a8a', fontSize: 13 }}>
          {workflowId === ''
            ? 'Pick a workflow to list runs.'
            : status.kind === 'loading' ? 'Loading…' : 'No runs for this workflow yet.'}
        </p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {runs.map((r) => (
            <li key={r.runId}
                style={{ padding: '6px 0',
                  borderBottom: '1px solid #eef0f3',
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', gap: 8, fontSize: 13 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center',
                flex: 1, minWidth: 0 }}>
                <code style={{ color: '#2c3e50' }}>{r.runId.slice(0, 8)}…</code>
                <span style={{ color: '#6e7a8a' }}>
                  {r.businessKey}
                </span>
                <StatusPill tone={stateTone(r.state)}>{r.state}</StatusPill>
              </div>
              <button type="button"
                      onClick={() => { void openRun(r.runId); }}
                      style={selectedRunId === r.runId ? secondaryBtnActive : secondaryBtn}>
                {selectedRunId === r.runId ? 'Open' : 'Open'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedRun && (
        <section style={{ marginTop: 16, padding: 12,
          border: '1px solid #d7dde5', borderRadius: 3,
          background: '#fafbfc' }}
                 data-test="wc-run-card">
          <h4 style={{ margin: 0, fontSize: 14 }}>
            Run <code>{selectedRun.runId}</code>
          </h4>
          <p style={{ margin: '6px 0', fontSize: 13, color: '#6e7a8a' }}>
            Business key <strong>{selectedRun.businessKey}</strong>
            {' · '}state <strong>{selectedRun.state}</strong>
            {' · '}step <code>{selectedRun.currentStepId ?? '—'}</code>
          </p>
          {form && (
            <p style={{ margin: '6px 0', fontSize: 13 }}>
              Current step binding: <strong>{form.displayName}</strong>
              {' · '}
              <code>{form.formType}</code>
              {' · '}
              <code>{form.bindingUid}</code>
            </p>
          )}
          {prefill && Object.keys(prefill.cells).length > 0 && (
            <>
              <h5 style={{ margin: '12px 0 4px', fontSize: 12,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                color: '#6e7a8a' }}>
                Prefill ({Object.keys(prefill.cells).length} cells)
              </h5>
              <table style={{ width: '100%', borderCollapse: 'collapse',
                fontSize: 12 }}>
                <tbody>
                  {Object.entries(prefill.cells).map(([k, v]) => (
                    <tr key={k} style={{ borderBottom: '1px solid #eef0f3' }}>
                      <td style={{ padding: '4px 4px', color: '#6e7a8a' }}>
                        <code>{k}</code>
                      </td>
                      <td style={{ padding: '4px 4px' }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button type="button"
                    onClick={() => { void onAdvance(); }}
                    disabled={selectedRun.state === 'COMPLETED'
                      || selectedRun.state === 'REJECTED'
                      || status.kind === 'advancing'}
                    style={primaryBtn}>
              {status.kind === 'advancing' ? 'Advancing…' : 'Advance run'}
            </button>
          </div>
          <p style={{ marginTop: 10, fontSize: 12, color: '#6e7a8a' }}>
            Field-value editing lands in a later slice-5 follow-up
            — use the shell&apos;s capture-run form for full write-back today.
          </p>
        </section>
      )}
    </ScreenCard>
  );
}

function stateTone(state: RunRow['state']): 'success' | 'warning' | 'neutral' | 'danger' {
  switch (state) {
    case 'OPEN': return 'success';
    case 'AWAITING': return 'warning';
    case 'COMPLETED': return 'neutral';
    case 'REJECTED': return 'danger';
  }
}

const inputStyle = {
  display: 'block', width: '100%', marginTop: 4,
  padding: '6px 8px',
  border: '1px solid #d7dde5', borderRadius: 2,
  fontSize: 13, fontFamily: 'inherit',
};

const primaryBtn = {
  padding: '6px 16px', border: '1px solid #1f4d70',
  background: '#2c6693', color: '#fff',
  borderRadius: 2, fontSize: 13, fontWeight: 500,
  cursor: 'pointer',
};

const secondaryBtn = {
  padding: '6px 16px', border: '1px solid #d7dde5',
  background: '#fff', color: '#2c3e50',
  borderRadius: 2, fontSize: 13, fontWeight: 500,
  cursor: 'pointer',
};

const secondaryBtnActive = {
  ...secondaryBtn,
  background: '#eaf1f8',
  borderColor: '#2c6693',
  color: '#1f4d70',
};

const okStrip = {
  marginTop: 12, padding: '8px 12px',
  background: '#e8f4ee', color: '#136436',
  border: '1px solid #b7dcc7', borderRadius: 3,
};

const errorStrip = {
  marginTop: 12, padding: '8px 12px',
  background: '#fbeaea', color: '#8a2525',
  border: '1px solid #e0bcbc', borderRadius: 3,
};

const sectionHeading = {
  marginTop: 20, fontSize: 12, textTransform: 'uppercase' as const,
  letterSpacing: '0.08em', color: '#6e7a8a',
  borderBottom: '1px solid #d7dde5', paddingBottom: 6,
};
