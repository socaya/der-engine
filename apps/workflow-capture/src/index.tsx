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
        <span className={'der-wc-heartbeat'
          + (online.isOnline ? '' : ' der-wc-heartbeat--offline')}
              aria-label={online.isOnline
                ? 'Connected to DER edge'
                : `Offline — ${online.queuedCount} queued`}
              title={online.isOnline
                ? 'Connected to DER edge'
                : `Offline — ${online.queuedCount} queued`}>
          <span className="der-wc-heartbeat__dot" aria-hidden="true" />
          {online.isOnline
            ? 'Live sync'
            : `offline (${online.queuedCount} queued)`}
        </span>
      }
    >
      {/* Matches Data Entry's sticky toolbar treatment + shared
       *  green ring-pulse heartbeat (admin /sync/settings pattern)
       *  so the two apps + Capture read as one chrome family. */}
      <style>{`
        .der-wc-toolbar {
          position: sticky;
          top: 0;
          z-index: 5;
          margin: 0 0px 12px;
          padding: 10px 20px 10px 20px;
          background: var(--der-surface);
          border-bottom: 1px solid var(--der-border);
          box-shadow: 0 1px 2px rgba(16, 26, 50, 0.04);
        }
        .der-wc-heartbeat {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 13px; color: var(--der-success-ink); font-weight: 500;
        }
        .der-wc-heartbeat--offline { color: var(--der-ink-500); }
        .der-wc-heartbeat__dot {
          position: relative;
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--der-success-ink); color: var(--der-success-ink);
          box-shadow: 0 0 0 2px rgba(17, 122, 68, 0.18);
        }
        .der-wc-heartbeat__dot::before {
          content: '';
          position: absolute;
          left: 50%; top: 50%;
          width: 8px; height: 8px;
          margin: -4px 0 0 -4px;
          border-radius: 50%;
          border: 2px solid currentColor;
          opacity: 0;
          pointer-events: none;
          animation: der-wc-pulse-ring 2.4s cubic-bezier(0.2,0.6,0.4,1) infinite;
        }
        .der-wc-heartbeat--offline .der-wc-heartbeat__dot {
          background: var(--der-ink-400); color: var(--der-ink-400);
          box-shadow: 0 0 0 2px rgba(148, 163, 184, 0.18);
        }
        .der-wc-heartbeat--offline .der-wc-heartbeat__dot::before {
          animation: none;
        }
        @keyframes der-wc-pulse-ring {
          0%  { transform: scale(1);   opacity: 0.6; }
          70% { opacity: 0; }
          100%{ transform: scale(3.2); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .der-wc-heartbeat__dot::before { animation: none; }
        }
      `}</style>
      <p style={{ margin: 0, color: 'var(--der-ink-500)', fontSize: 13 }}>
        Signed in as <strong>{auth.displayName}</strong> • Bound OU
        <code style={{ marginInline: 6 }} title={ou.orgUnitPath}>{ou.orgUnitDisplayName || ou.orgUnitUid}</code>
      </p>
      {!ou.bound && (
        <p style={{ marginTop: 12, color: 'var(--der-danger-ink)' }}>
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
          border: '1px solid var(--der-border)', borderRadius: 3,
          background: 'var(--der-surface-raised)' }}>
          <label>Business key
            <input value={businessKey}
                   onChange={(e) => setBusinessKey(e.target.value)}
                   placeholder="e.g. orgUnit:202611 or TEI uid"
                   style={inputStyle} />
          </label>
          <p style={{ fontSize: 12, color: 'var(--der-ink-500)', margin: '6px 0' }}>
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
        <p style={{ color: 'var(--der-ink-500)', fontSize: 13 }}>
          {workflowId === ''
            ? 'Pick a workflow to list runs.'
            : status.kind === 'loading' ? 'Loading…' : 'No runs for this workflow yet.'}
        </p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {runs.map((r) => (
            <li key={r.runId}
                style={{ padding: '6px 0',
                  borderBottom: '1px solid var(--der-border-subtle)',
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', gap: 8, fontSize: 13 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center',
                flex: 1, minWidth: 0 }}>
                <code style={{ color: 'var(--der-ink-800)' }}>{r.runId.slice(0, 8)}…</code>
                <span style={{ color: 'var(--der-ink-500)' }}>
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
          border: '1px solid var(--der-border)', borderRadius: 3,
          background: 'var(--der-surface-raised)' }}
                 data-test="wc-run-card">
          <h4 style={{ margin: 0, fontSize: 14 }}>
            Run <code>{selectedRun.runId}</code>
          </h4>
          <p style={{ margin: '6px 0', fontSize: 13, color: 'var(--der-ink-500)' }}>
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
                color: 'var(--der-ink-500)' }}>
                Prefill ({Object.keys(prefill.cells).length} cells)
              </h5>
              <table style={{ width: '100%', borderCollapse: 'collapse',
                fontSize: 12 }}>
                <tbody>
                  {Object.entries(prefill.cells).map(([k, v]) => (
                    <tr key={k} style={{ borderBottom: '1px solid var(--der-border-subtle)' }}>
                      <td style={{ padding: '4px 4px', color: 'var(--der-ink-500)' }}>
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
          <p style={{ marginTop: 10, fontSize: 12, color: 'var(--der-ink-500)' }}>
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
  border: '1px solid var(--der-border)', borderRadius: 2,
  fontSize: 13, fontFamily: 'inherit',
};

const primaryBtn = {
  padding: '6px 16px', border: '1px solid var(--der-primary-700)',
  background: 'var(--der-primary-ink)', color: 'var(--der-surface)',
  borderRadius: 2, fontSize: 13, fontWeight: 500,
  cursor: 'pointer',
};

const secondaryBtn = {
  padding: '6px 16px', border: '1px solid var(--der-border)',
  background: 'var(--der-surface)', color: 'var(--der-ink-800)',
  borderRadius: 2, fontSize: 13, fontWeight: 500,
  cursor: 'pointer',
};

const secondaryBtnActive = {
  ...secondaryBtn,
  background: 'var(--der-primary-50)',
  borderColor: 'var(--der-primary-ink)',
  color: 'var(--der-primary-700)',
};

const okStrip = {
  marginTop: 12, padding: '8px 12px',
  background: 'var(--der-success-soft)', color: 'var(--der-success-ink)',
  border: '1px solid var(--der-success)', borderRadius: 3,
};

const errorStrip = {
  marginTop: 12, padding: '8px 12px',
  background: 'var(--der-danger-soft)', color: 'var(--der-danger-ink)',
  border: '1px solid var(--der-danger)', borderRadius: 3,
};

const sectionHeading = {
  marginTop: 20, fontSize: 12, textTransform: 'uppercase' as const,
  letterSpacing: '0.08em', color: 'var(--der-ink-500)',
  borderBottom: '1px solid var(--der-border)', paddingBottom: 6,
};
