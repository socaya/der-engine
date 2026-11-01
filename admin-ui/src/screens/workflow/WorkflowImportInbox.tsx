import { useEffect, useState } from 'react';
import * as edgeApi from '../../api/edgeApi';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

/**
 * §2.3.38 — operator reviews incoming workflow pushes from peers.
 * Accept applies the canonical doc via the existing import service;
 * reject records a note.
 */
export interface WorkflowImportInboxProps {
  api?: Pick<typeof edgeApi,
      'listImportInbox' | 'acceptImport' | 'rejectImport' | 'importInboxDiff'>;
}

export function WorkflowImportInbox({ api = edgeApi }:
    WorkflowImportInboxProps = {}): JSX.Element {
  const [entries, setEntries] = useState<edgeApi.ImportInboxEntry[] | null>(null);
  const [filter, setFilter] =
    useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED'>('PENDING');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<Record<string, edgeApi.ImportInboxDiff | 'loading'>>({});

  async function reload(): Promise<void> {
    try {
      const r = await api.listImportInbox(
        filter === 'ALL' ? undefined : filter);
      setEntries(r.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    reload().catch(() => undefined);
    // §2.3.41 — SSE push on inbox arrivals/decisions.
    const es = new EventSource('/edge-api/v1/workflows/import-inbox/stream');
    es.addEventListener('inbox.updated',
      () => { reload().catch(() => undefined); });
    return () => { es.close(); };
  }, [api, filter]);

  async function accept(id: string): Promise<void> {
    setBusy(id);
    setLastResult(null);
    try {
      await api.acceptImport(id);
      setLastResult(`${id.slice(0, 8)} accepted`);
      await reload();
    } catch (err) {
      setLastResult(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }
  async function showDiff(id: string): Promise<void> {
    if (diffs[id]) {
      // toggle off
      const next = { ...diffs };
      delete next[id];
      setDiffs(next);
      return;
    }
    setDiffs({ ...diffs, [id]: 'loading' });
    try {
      const d = await api.importInboxDiff(id);
      setDiffs((prev) => ({ ...prev, [id]: d }));
    } catch (err) {
      setLastResult(err instanceof Error ? err.message : String(err));
      setDiffs((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  async function reject(id: string): Promise<void> {
    setBusy(id);
    setLastResult(null);
    try {
      await api.rejectImport(id, notes[id] ?? '');
      setLastResult(`${id.slice(0, 8)} rejected`);
      await reload();
    } catch (err) {
      setLastResult(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  if (error) {
    return <ErrorBlock title="Inbox load failed"
                        testId="inbox-error">{error}</ErrorBlock>;
  }
  if (entries == null) {
    return <LoadingBlock testId="inbox-loading" />;
  }
  return (
    <div className="ea-screen" data-test="inbox-root">
      <header className="ea-screen-header">
        <div className="ea-screen-header-text">
          <h1 data-test="inbox-heading">Inbox</h1>
        </div>
      </header>

      <div className="ea-queue-tabs" data-test="inbox-tabs">
        {(['PENDING', 'ACCEPTED', 'REJECTED', 'ALL'] as const).map((v) => (
          <button key={v} type="button"
                   className={'ea-queue-tab'
                     + (filter === v ? ' is-active' : '')}
                   data-test={`inbox-tab-${v.toLowerCase()}`}
                   onClick={() => setFilter(v)}>
            {v.charAt(0) + v.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="ea-text-muted" data-test="inbox-empty"
            style={{ margin: 0 }}>
          No entries at this filter.
        </p>
      ) : (
        <table className="ea-table ea-table--dense" data-test="inbox-table">
          <thead>
            <tr>
              <th>Workflow</th>
              <th>Peer</th>
              <th>Received</th>
              <th>Binding</th>
              <th>Status</th>
              <th>Action / Note</th>
            </tr>
          </thead>
          <tbody>
            {entries.flatMap((e) => [
              <tr key={e.importId} data-test={`inbox-row-${e.importId}`}>
                <td style={{ fontWeight: 500 }}>{e.displayName}</td>
                <td className="ea-mono" style={{ fontSize: 12 }}>
                  {e.fromLabel ?? '—'}
                </td>
                <td className="ea-text-muted" style={{ fontSize: 12 }}>
                  {new Date(e.receivedAt).toLocaleString()}
                </td>
                <td className="ea-mono" style={{ fontSize: 12 }}>
                  {e.boundKind}:{e.boundId}
                </td>
                <td>
                  <span className={'ea-pill ea-pill--'
                    + (e.status === 'ACCEPTED' ? 'success'
                    : e.status === 'REJECTED' ? 'error'
                    : 'muted')}>
                    {e.status}
                  </span>
                </td>
                <td>
                  {e.status === 'PENDING' ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center',
                                   flexWrap: 'wrap' }}>
                      <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                               data-test={`inbox-row-${e.importId}-review`}
                               onClick={() => { showDiff(e.importId).catch(() => undefined); }}>
                        {diffs[e.importId] ? 'Hide diff' : 'Review'}
                      </button>
                      <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                               data-test={`inbox-row-${e.importId}-accept`}
                               disabled={busy === e.importId}
                               onClick={() => { accept(e.importId).catch(() => undefined); }}>
                        Accept
                      </button>
                      <input className="ea-input" type="text"
                              data-test={`inbox-row-${e.importId}-note`}
                              placeholder="reject note (optional)"
                              style={{ fontSize: 12, padding: '3px 6px', width: 180 }}
                              value={notes[e.importId] ?? ''}
                              onChange={(ev) => setNotes({
                                ...notes, [e.importId]: ev.target.value,
                              })} />
                      <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                               data-test={`inbox-row-${e.importId}-reject`}
                               disabled={busy === e.importId}
                               onClick={() => { reject(e.importId).catch(() => undefined); }}>
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="ea-text-muted" style={{ fontSize: 12 }}>
                      {e.decidedAt && new Date(e.decidedAt).toLocaleString()}
                      {e.decisionNote ? ' · ' + e.decisionNote : ''}
                    </span>
                  )}
                </td>
              </tr>,
              diffs[e.importId] ? (
                <tr key={`${e.importId}-diff`}
                     data-test={`inbox-row-${e.importId}-diff`}>
                  <td colSpan={6} className="ea-wizard-fields-row">
                    {diffs[e.importId] === 'loading' ? (
                      <span className="ea-text-muted" style={{ fontSize: 12 }}>Loading diff…</span>
                    ) : (
                      <InboxDiffBlock diff={diffs[e.importId] as edgeApi.ImportInboxDiff} />
                    )}
                  </td>
                </tr>
              ) : null,
            ].filter(Boolean))}
          </tbody>
        </table>
      )}
      {lastResult && (
        <p className="ea-field-hint" data-test="inbox-last-result"
            style={{ marginTop: 'var(--sp-2)' }}>
          {lastResult}
        </p>
      )}
    </div>
  );
}

function InboxDiffBlock({ diff }: { diff: edgeApi.ImportInboxDiff }): JSX.Element {
  if (diff.summary === 'NEW_WORKFLOW') {
    return (
      <div data-test="inbox-diff-new">
        <strong style={{ fontSize: 13 }}>New workflow — nothing to compare against on this edge.</strong>
        <div className="ea-text-muted" style={{ fontSize: 12, marginTop: 2 }}>
          Incoming: {diff.incoming.displayName} · {diff.incoming.boundKind}:{diff.incoming.boundId}
          · {diff.incoming.stepCount} step{diff.incoming.stepCount === 1 ? '' : 's'}
        </div>
      </div>
    );
  }
  if (diff.summary === 'NO_CHANGES') {
    return (
      <div data-test="inbox-diff-nochange">
        <strong style={{ fontSize: 13 }}>No changes — step shape identical to the local workflow.</strong>
        <div className="ea-text-muted" style={{ fontSize: 12, marginTop: 2 }}>
          Matched via {diff.matchStrategy.toLowerCase().replace('_', ' ')}.
        </div>
      </div>
    );
  }
  return (
    <div className="ea-diff-groups" data-test="inbox-diff-replacement">
      <div className="ea-text-muted" style={{ fontSize: 12, marginBottom: 4 }}>
        Replacing local {diff.local?.displayName} (matched via{' '}
        {diff.matchStrategy.toLowerCase().replace('_', ' ')}).
      </div>
      {(diff.added ?? []).length > 0 && (
        <section className="ea-diff-group ea-diff-group--success"
                  data-test="inbox-diff-added">
          <h3>Added steps ({(diff.added ?? []).length})</h3>
          <ul>
            {(diff.added ?? []).map((s) => (
              <li key={s.ordinal}>
                <strong>#{s.ordinal}</strong> {s.displayName} ·{' '}
                <span className="ea-text-muted">
                  {s.stepKind} · {s.fieldCount} field{s.fieldCount === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(diff.removed ?? []).length > 0 && (
        <section className="ea-diff-group ea-diff-group--error"
                  data-test="inbox-diff-removed">
          <h3>Removed steps ({(diff.removed ?? []).length})</h3>
          <ul>
            {(diff.removed ?? []).map((s) => (
              <li key={s.ordinal}>
                <strong>#{s.ordinal}</strong> {s.displayName} ·{' '}
                <span className="ea-text-muted">{s.stepKind}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(diff.changed ?? []).length > 0 && (
        <section className="ea-diff-group ea-diff-group--warning"
                  data-test="inbox-diff-changed">
          <h3>Changed steps ({(diff.changed ?? []).length})</h3>
          <ul>
            {(diff.changed ?? []).map((c) => (
              <li key={c.ordinal}>
                <strong>#{c.ordinal}</strong>{' '}
                <code className="ea-mono" style={{ fontSize: 11 }}>
                  {c.local.displayName} → {c.incoming.displayName}
                </code>
                <span className="ea-text-muted" style={{ marginLeft: 6, fontSize: 11 }}>
                  {c.local.stepKind}·{c.local.fieldCount}f → {c.incoming.stepKind}·{c.incoming.fieldCount}f
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
