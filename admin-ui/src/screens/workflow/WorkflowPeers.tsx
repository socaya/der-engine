import { useEffect, useState } from 'react';
import * as edgeApi from '../../api/edgeApi';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

/**
 * §62–§63 — manage peer edges that this edge can push workflow
 * definitions to. Keeps the peer registry (list / add / remove) and
 * the push action per peer × workflow in one place.
 */
export interface WorkflowPeersProps {
  api?: Pick<typeof edgeApi, 'listWorkflowPeers' | 'addWorkflowPeer'
                             | 'deleteWorkflowPeer' | 'pushWorkflowToPeer'
                             | 'setWorkflowPeerCredentials'
                             | 'listWorkflows'>;
}

export function WorkflowPeers({ api = edgeApi }:
    WorkflowPeersProps = {}): JSX.Element {
  const [peers, setPeers] = useState<edgeApi.WorkflowPeer[] | null>(null);
  const [workflows, setWorkflows] = useState<edgeApi.CaptureWorkflowSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newDisplay, setNewDisplay] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newAuthUser, setNewAuthUser] = useState('');
  const [newAuthPass, setNewAuthPass] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [credEdit, setCredEdit] = useState<Record<string,
    { user: string; pass: string }>>({});
  const [chosenWorkflow, setChosenWorkflow] = useState<Record<string, string>>({});
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function reload(): Promise<void> {
    try {
      const [p, w] = await Promise.all([
        api.listWorkflowPeers(),
        api.listWorkflows(),
      ]);
      setPeers(p.peers);
      setWorkflows(w.workflows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => { reload().catch(() => undefined); }, [api]);

  async function addPeer(): Promise<void> {
    if (!newDisplay.trim() || !newUrl.trim()) return;
    setBusy('add');
    try {
      await api.addWorkflowPeer({
        displayName: newDisplay.trim(),
        baseUrl: newUrl.trim(),
        authUsername: newAuthUser.trim() || undefined,
        authPassword: newAuthPass || undefined,
      });
      setNewDisplay('');
      setNewUrl('');
      setNewAuthUser('');
      setNewAuthPass('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function saveCreds(peerId: string): Promise<void> {
    const entry = credEdit[peerId];
    if (!entry) return;
    setBusy(peerId + ':cred');
    try {
      await api.setWorkflowPeerCredentials(peerId,
        entry.user.trim(), entry.pass);
      setCredEdit({ ...credEdit, [peerId]: { user: '', pass: '' } });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function removePeer(peerId: string): Promise<void> {
    setBusy(peerId);
    try {
      await api.deleteWorkflowPeer(peerId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function pushTo(peerId: string): Promise<void> {
    const wfId = chosenWorkflow[peerId];
    if (!wfId) return;
    setBusy(peerId + ':push');
    setLastResult(null);
    try {
      const r = await api.pushWorkflowToPeer(peerId, wfId);
      setLastResult(`#${peerId.slice(0, 8)} ← ${r.status}`);
      await reload();
    } catch (err) {
      setLastResult(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  if (error) {
    return <ErrorBlock title="Peers load failed"
                        testId="peers-error">{error}</ErrorBlock>;
  }
  if (peers == null) {
    return <LoadingBlock testId="peers-loading" />;
  }
  return (
    <div className="ea-screen" data-test="peers-root">
      <header className="ea-screen-header">
        <div className="ea-screen-header-text">
          <h1 data-test="peers-heading">Workflow peers</h1>
          <p className="ea-screen-header-sub">
            Register other DER edges you want to share workflow
            definitions with. Pushing POSTs the canonical JSON to the
            peer's import endpoint.
          </p>
        </div>
      </header>

      <section className="ea-card ea-form-card">
        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>Add peer</h2>
            <p>A friendly label + the peer's base URL.</p>
          </div>
          <div className="ea-form-grid">
            <label className="ea-field">
              <span className="ea-field-label">Label</span>
              <input className="ea-input" type="text" data-test="peers-new-name"
                      value={newDisplay} placeholder="e.g. Nakivale clinic"
                      onChange={(e) => setNewDisplay(e.target.value)} />
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Base URL</span>
              <input className="ea-input" type="url" data-test="peers-new-url"
                      value={newUrl} placeholder="https://der.nakivale.local"
                      onChange={(e) => setNewUrl(e.target.value)} />
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Service-account username</span>
              <input className="ea-input" type="text" data-test="peers-new-auth-user"
                      value={newAuthUser} placeholder="der-peer"
                      autoComplete="off"
                      onChange={(e) => setNewAuthUser(e.target.value)} />
              <span className="ea-field-hint">
                Optional. Dedicated ADMIN user on the remote edge.
              </span>
            </label>
            <label className="ea-field">
              <span className="ea-field-label">Service-account password</span>
              <input className="ea-input" type="password" data-test="peers-new-auth-pass"
                      value={newAuthPass} autoComplete="new-password"
                      onChange={(e) => setNewAuthPass(e.target.value)} />
              <span className="ea-field-hint">
                Stored plaintext in the pilot DB — rotate quarterly.
              </span>
            </label>
          </div>
          <div style={{ marginTop: 'var(--sp-2)' }}>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                     data-test="peers-add"
                     disabled={busy === 'add' || !newDisplay.trim() || !newUrl.trim()}
                     onClick={() => { addPeer().catch(() => undefined); }}>
              Add peer
            </button>
          </div>
        </div>
      </section>

      <section className="ea-card ea-form-card">
        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>Registered peers</h2>
            <p>Push a workflow or remove a peer.</p>
          </div>
          {peers.length === 0 ? (
            <p className="ea-text-muted" data-test="peers-empty"
                style={{ margin: 0 }}>
              No peers registered yet.
            </p>
          ) : (
            <table className="ea-table ea-table--dense" data-test="peers-table">
              <thead>
                <tr>
                  <th>Peer</th>
                  <th>Base URL</th>
                  <th>Auth</th>
                  <th>Added</th>
                  <th>Last push</th>
                  <th>Push a workflow</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {peers.map((p) => (
                  <tr key={p.peerId} data-test={`peers-row-${p.peerId}`}>
                    <td style={{ fontWeight: 500 }}>{p.displayName}</td>
                    <td className="ea-mono" style={{ fontSize: 12 }}>{p.baseUrl}</td>
                    <td style={{ fontSize: 12 }}>
                      {p.authUsername ? (
                        <span data-test={`peers-row-${p.peerId}-auth`}>
                          <span className="ea-pill ea-pill--success">signed in</span>
                          <span className="ea-mono" style={{ marginLeft: 6 }}>
                            {p.authUsername}
                          </span>
                        </span>
                      ) : (
                        <span className="ea-pill ea-pill--muted"
                               data-test={`peers-row-${p.peerId}-auth-none`}>
                          anonymous
                        </span>
                      )}
                      <details style={{ marginTop: 4 }}>
                        <summary style={{ fontSize: 11, cursor: 'pointer',
                                           color: 'var(--der-ink-500)' }}>
                          Rotate credentials
                        </summary>
                        <div style={{ display: 'flex', gap: 4, marginTop: 4,
                                       flexWrap: 'wrap' }}>
                          <input className="ea-input" type="text"
                                  data-test={`peers-row-${p.peerId}-cred-user`}
                                  placeholder="username"
                                  style={{ fontSize: 12, padding: '3px 6px', width: 110 }}
                                  autoComplete="off"
                                  value={credEdit[p.peerId]?.user ?? ''}
                                  onChange={(e) => setCredEdit({
                                    ...credEdit,
                                    [p.peerId]: { user: e.target.value,
                                                   pass: credEdit[p.peerId]?.pass ?? '' },
                                  })} />
                          <input className="ea-input" type="password"
                                  data-test={`peers-row-${p.peerId}-cred-pass`}
                                  placeholder="password"
                                  style={{ fontSize: 12, padding: '3px 6px', width: 110 }}
                                  autoComplete="new-password"
                                  value={credEdit[p.peerId]?.pass ?? ''}
                                  onChange={(e) => setCredEdit({
                                    ...credEdit,
                                    [p.peerId]: { user: credEdit[p.peerId]?.user ?? '',
                                                   pass: e.target.value },
                                  })} />
                          <button type="button"
                                   className="ea-btn ea-btn--ghost ea-btn--sm"
                                   data-test={`peers-row-${p.peerId}-cred-save`}
                                   disabled={busy === p.peerId + ':cred'
                                              || !(credEdit[p.peerId]?.user ?? '').trim()}
                                   onClick={() => { saveCreds(p.peerId).catch(() => undefined); }}>
                            Save
                          </button>
                        </div>
                      </details>
                    </td>
                    <td className="ea-text-muted" style={{ fontSize: 12 }}>
                      {new Date(p.addedAt).toLocaleDateString()}
                    </td>
                    <td className="ea-text-muted" style={{ fontSize: 12 }}>
                      {p.lastPushAt
                        ? `${new Date(p.lastPushAt).toLocaleString()}${p.lastPushStatus ? ' · ' + p.lastPushStatus : ''}`
                        : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <select className="ea-input"
                                 data-test={`peers-row-${p.peerId}-wf`}
                                 value={chosenWorkflow[p.peerId] ?? ''}
                                 onChange={(e) =>
                                   setChosenWorkflow({ ...chosenWorkflow,
                                                        [p.peerId]: e.target.value })}>
                          <option value="">— pick workflow —</option>
                          {workflows.map((w) => (
                            <option key={w.workflowId} value={w.workflowId}>
                              {w.displayName}
                            </option>
                          ))}
                        </select>
                        <button type="button"
                                 className="ea-btn ea-btn--primary ea-btn--sm"
                                 data-test={`peers-row-${p.peerId}-push`}
                                 disabled={!chosenWorkflow[p.peerId]
                                            || busy === p.peerId + ':push'}
                                 onClick={() => { pushTo(p.peerId).catch(() => undefined); }}>
                          Push
                        </button>
                      </div>
                    </td>
                    <td>
                      <button type="button"
                               className="ea-btn ea-btn--ghost ea-btn--sm"
                               data-test={`peers-row-${p.peerId}-remove`}
                               disabled={busy === p.peerId}
                               onClick={() => { removePeer(p.peerId).catch(() => undefined); }}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {lastResult && (
            <p className="ea-field-hint" data-test="peers-last-result"
                style={{ marginTop: 'var(--sp-2)' }}>
              Last push: {lastResult}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
