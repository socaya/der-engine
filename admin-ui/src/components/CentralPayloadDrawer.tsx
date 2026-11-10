import { useEffect, useState } from 'react';
import * as edgeApi from '../api/edgeApi';
import { UiIcon } from './UiIcon';
import { useFocusTrap } from './useFocusTrap';

/**
 * §2.3.97 R-E — "Ready for Central" preview drawer.
 *
 * Compiles the workflow-captured rows that haven't yet synced into the
 * exact DHIS2 2.44 JSON envelope DER would POST next. Serves two
 * audiences:
 *
 *  - Facility admin: "what will be sent on the next drain tick?"
 *  - Pilot engineer: "give me the raw payload to replay against Central".
 *
 * All three Data screens mount this with their matching entity kind
 * ({@code aggregate | events | tracker}) and the current workflow
 * scope ({@code workflowId} / {@code workflowRunId}).
 */
export function CentralPayloadDrawer(
  { kind, workflowId, workflowRunId, onClose }:
    {
      kind: 'aggregate' | 'events' | 'tracker';
      workflowId: string | null;
      workflowRunId: string | null;
      onClose(): void;
    },
): JSX.Element {
  const [body, setBody] = useState<{
    endpoint: string;
    count: number;
    counts?: Record<string, number>;
    payload: unknown;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /* UX-C: single focus-trap hook owns Escape + Tab-cycle + restore-
   * focus-on-close. Supersedes the prior window-level keydown that
   * only handled Escape. */
  const panelRef = useFocusTrap<HTMLDivElement>({
    active: true,
    onClose,
  });

  useEffect(() => {
    let alive = true;
    const opts = {
      workflowId: workflowId ?? undefined,
      workflowRunId: workflowRunId ?? undefined,
      limit: 500,
    };
    const loader
      = kind === 'aggregate' ? edgeApi.previewAggregatePayload(opts)
      : kind === 'events'    ? edgeApi.previewEventsPayload(opts)
      :                        edgeApi.previewTrackerPayload(opts);
    loader
      .then((r) => { if (alive) setBody(r); })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [kind, workflowId, workflowRunId]);

  async function copy(): Promise<void> {
    if (!body) return;
    const text = JSON.stringify(body.payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable — surface nothing */ }
  }

  const title = `Ready for Central — ${
    kind === 'aggregate' ? 'DataValueSet'
      : kind === 'events' ? 'Events'
      : 'Tracker'
  }`;

  return (
    <div role="dialog" aria-modal="true" aria-label={title}
         data-test="central-payload-drawer"
         ref={panelRef}
         style={{
           position: 'fixed', inset: 0, zIndex: 1100,
           display: 'flex', alignItems: 'stretch',
           justifyContent: 'flex-end',
           background: 'rgba(15, 23, 42, 0.45)',
         }}
         /* UX-C: Escape, Tab-cycle, and focus restoration all live in
          *   useFocusTrap. Backdrop click-to-close still intentionally
          *   omitted (§2.3.122 R-AQ/followup — chatty mice / trackpads
          *   race the open). Explicit Close button + Escape only. */
         tabIndex={-1}>
      <div style={{
             background: 'var(--der-raised)',
             width: 'min(620px, 92vw)',
             boxShadow: '-10px 0 30px rgba(0,0,0,0.2)',
             borderLeft: '1px solid var(--der-border)',
             display: 'flex', flexDirection: 'column',
           }}>
        <header style={{ padding: '12px 16px',
                          borderBottom: '1px solid var(--der-border)',
                          display: 'flex', alignItems: 'center',
                          gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 14 }}>{title}</h2>
          <span className="ea-text-muted" style={{ fontSize: 11 }}>
            {body ? `${body.count.toLocaleString()} ready to push`
                  : err ? 'load failed' : 'loading…'}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button type="button"
                     className="ea-btn ea-btn--ghost ea-btn--sm"
                     onClick={() => { copy().catch(() => undefined); }}
                     disabled={!body || body.count === 0}
                     data-test="central-payload-copy">
              <UiIcon icon="copy" size={14} />
              <span>{copied ? 'Copied' : 'Copy JSON'}</span>
            </button>
            <button type="button"
                     className="ea-btn ea-btn--ghost ea-btn--sm"
                     onClick={onClose}
                     data-test="central-payload-close">
              Close
            </button>
          </div>
        </header>
        <div style={{ padding: '10px 16px',
                       fontSize: 12,
                       color: 'var(--der-ink-500)' }}>
          {body?.endpoint && (
            <>
              <span>Will POST to </span>
              <span className="ea-mono" style={{ fontSize: 11 }}>
                {body.endpoint}
              </span>
            </>
          )}
          {body?.counts && (
            <span style={{ marginLeft: 10 }}>
              — TE: <strong>{body.counts.trackedEntities}</strong>,
              {' '}Enrol: <strong>{body.counts.enrollments}</strong>,
              {' '}Events: <strong>{body.counts.events}</strong>
            </span>
          )}
        </div>
        <div style={{ flex: '1 1 auto',
                       overflow: 'auto',
                       padding: '0 16px 16px' }}>
          {err && (
            <pre data-test="central-payload-error"
                 style={{ color: 'var(--der-danger-ink)',
                           whiteSpace: 'pre-wrap',
                           fontSize: 12 }}>
              {err}
            </pre>
          )}
          {body && body.count === 0 && (
            <p className="ea-text-muted"
               data-test="central-payload-empty"
               style={{ fontSize: 13 }}>
              Nothing is pending for this workflow — the local store is
              in sync with Central (or no rows have been captured yet).
            </p>
          )}
          {body && body.count > 0 && (
            <pre className="ea-mono"
                 data-test="central-payload-body"
                 style={{ fontSize: 11, lineHeight: 1.45,
                           background: 'var(--der-canvas, #f8fafc)',
                           padding: 12, borderRadius: 6,
                           border: '1px solid var(--der-border)',
                           whiteSpace: 'pre-wrap',
                           wordBreak: 'break-word' }}>
              {JSON.stringify(body.payload, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
