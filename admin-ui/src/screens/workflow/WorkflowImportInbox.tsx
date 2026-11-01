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
      'listImportInbox' | 'acceptImport' | 'rejectImport'>;
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

  async function reload(): Promise<void> {
    try {
      const r = await api.listImportInbox(
        filter === 'ALL' ? undefined : filter);
      setEntries(r.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => { reload().catch(() => undefined); }, [api, filter]);

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
          <h1 data-test="inbox-heading">Workflow import inbox</h1>
          <p className="ea-screen-header-sub">
            Workflow definitions peers have pushed to this edge. Accept to
            apply the canonical doc via the normal import service, or
            reject with a note.
          </p>
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
            {entries.map((e) => (
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
              </tr>
            ))}
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
