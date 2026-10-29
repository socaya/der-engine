import { useEffect, useState } from 'react';
import {
  Panel, fmtAgo, fmtDate, SyncStatusBar, Status, RowMenu,
} from './shared';
import { UiIcon } from '../components/UiIcon';

interface RetentionPolicy {
  category: string;
  keepDays: number;
  description: string | null;
  lastPurgeAt: string | null;
  lastPurgeRows: number;
}

interface ErasureRequest {
  requestId: string;
  subjectType: string;
  subjectId: string;
  reason: string | null;
  requestedAt: string;
  status: string;
  completedAt: string | null;
  receiptHash: string | null;
}

interface AuditAnchor {
  anchorAt: string;
  rowCount: number;
  chainHead: string;
  uploadedAt: string | null;
}

interface ResidencyRule {
  ruleId: string;
  hostPattern: string;
  allow: boolean;
  note: string | null;
  updatedAt: string;
}

async function j<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method,
    credentials: 'include',
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function Compliance(): JSX.Element {
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [requests, setRequests] = useState<ErasureRequest[]>([]);
  const [anchors, setAnchors]   = useState<AuditAnchor[]>([]);
  const [rules, setRules]       = useState<ResidencyRule[]>([]);
  const [editKey, setEditKey]   = useState<string | null>(null);
  const [editVal, setEditVal]   = useState<number>(30);
  const [showErase, setShowErase] = useState(false);

  async function reload(): Promise<void> {
    try { setPolicies((await j<{ policies: RetentionPolicy[] }>('GET', '/edge-api/v1/compliance/retention')).policies); } catch { /* */ }
    try { setRequests((await j<{ requests: ErasureRequest[] }>('GET', '/edge-api/v1/compliance/erasure?limit=50')).requests); } catch { /* */ }
    try { setAnchors((await j<{ anchors: AuditAnchor[] }>('GET', '/edge-api/v1/compliance/audit/anchors?limit=10')).anchors); } catch { /* */ }
    try { setRules((await j<{ rules: ResidencyRule[] }>('GET', '/edge-api/v1/compliance/residency')).rules); } catch { /* */ }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  async function savePolicy(category: string): Promise<void> {
    try {
      await j('POST', `/edge-api/v1/compliance/retention/${encodeURIComponent(category)}`,
               { keepDays: editVal });
      setEditKey(null);
      await reload();
    } catch { /* leave open */ }
  }

  async function anchorNow(): Promise<void> {
    try {
      await j('POST', '/edge-api/v1/compliance/audit/anchor-now');
      await reload();
    } catch { /* ignore */ }
  }

  async function completeErasure(id: string): Promise<void> {
    if (!window.confirm('Permanently erase all rows for this subject? Cannot be undone.')) return;
    try {
      await j('POST', `/edge-api/v1/compliance/erasure/${encodeURIComponent(id)}/complete`);
      await reload();
    } catch { /* leave open */ }
  }

  function exportAudit(): void {
    window.open('/edge-api/v1/compliance/audit/export', '_blank');
  }

  const pending = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="ea-screen" data-test="compliance">
      <SyncStatusBar
        tone={pending > 0 ? 'warning' : 'success'}
        title="Compliance"
        statusLabel={pending > 0 ? `${pending} pending erasure` : 'Nominal'}
        subtitle={<span>Retention policies, right-to-erasure, audit tamper-detection, and data residency.</span>}
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                    onClick={() => setShowErase(true)}>
              <UiIcon icon="trash" size={14} /><span>Request erasure</span>
            </button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm" onClick={exportAudit}>
              <UiIcon icon="download" size={14} /><span>Export audit CSV</span>
            </button>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm" onClick={anchorNow}>
              <UiIcon icon="refresh" size={14} /><span>Anchor now</span>
            </button>
          </>
        }
      />

      <Panel title={`Retention policies · ${policies.length}`}>
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense">
            <thead><tr>
              <th>Category</th><th>Keep (days)</th><th>Last purge</th>
              <th>Last removed</th><th>Description</th>
              <th style={{ width: 48 }} aria-label="Actions"></th>
            </tr></thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.category}>
                  <td className="ea-mono">{p.category}</td>
                  <td className="ea-mono">
                    {editKey === p.category ? (
                      <input className="ea-input" type="number" value={editVal}
                             onChange={(e) => setEditVal(Number(e.target.value))}
                             onKeyDown={(e) => { if (e.key === 'Enter') savePolicy(p.category); }}
                             autoFocus />
                    ) : p.keepDays}
                  </td>
                  <td className="ea-text-muted">{p.lastPurgeAt ? fmtAgo(p.lastPurgeAt) : '—'}</td>
                  <td className="ea-mono">{p.lastPurgeRows}</td>
                  <td className="ea-text-muted" style={{ fontSize: 12 }}>{p.description}</td>
                  <td style={{ textAlign: 'right' }}>
                    {editKey === p.category ? (
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                                onClick={() => savePolicy(p.category)}>Save</button>
                        <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                                onClick={() => setEditKey(null)}>Cancel</button>
                      </div>
                    ) : (
                      <RowMenu items={[
                        { label: 'Edit', onSelect: () => {
                            setEditKey(p.category);
                            setEditVal(p.keepDays);
                          } },
                      ]} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={`Erasure requests · ${requests.length}`}>
        {requests.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
            No erasure requests yet.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>Requested</th><th>Subject</th><th>Status</th>
                <th>Receipt (SHA-256)</th>
                <th style={{ width: 48 }} aria-label="Actions"></th>
              </tr></thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.requestId}>
                    <td className="ea-text-muted">{fmtAgo(r.requestedAt)}</td>
                    <td className="ea-mono" style={{ fontSize: 12 }}>
                      {r.subjectType}:{r.subjectId}
                    </td>
                    <td>
                      <Status tone={r.status === 'COMPLETED' ? 'success'
                                     : r.status === 'PENDING' ? 'warning' : 'muted'}>
                        {r.status}
                      </Status>
                    </td>
                    <td className="ea-mono" style={{ fontSize: 11 }}
                        title={r.receiptHash ?? ''}>
                      {r.receiptHash ? r.receiptHash.slice(0, 24) + '…' : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {r.status === 'PENDING' && (
                        <RowMenu items={[
                          { label: 'Complete erasure', danger: true,
                            onSelect: () => completeErasure(r.requestId) },
                        ]} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={`Audit anchors · ${anchors.length}`}>
        {anchors.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, padding: 10 }}>
            No anchors yet. Scheduled daily at 02:00. Click <strong>Anchor now</strong> to force one.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense">
              <thead><tr>
                <th>At</th><th>Rows</th><th>Chain head (SHA-256)</th><th>Uploaded</th>
              </tr></thead>
              <tbody>
                {anchors.map((a) => (
                  <tr key={a.anchorAt}>
                    <td className="ea-mono">{fmtDate(a.anchorAt)}</td>
                    <td className="ea-mono">{a.rowCount}</td>
                    <td className="ea-mono" style={{ fontSize: 11 }}
                        title={a.chainHead}>{a.chainHead.slice(0, 32)}…</td>
                    <td className="ea-text-muted">{a.uploadedAt ? fmtAgo(a.uploadedAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={`Data residency rules · ${rules.length}`}>
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense">
            <thead><tr>
              <th>Host pattern</th><th>Allow</th><th>Note</th><th>Updated</th>
            </tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.ruleId}>
                  <td className="ea-mono">{r.hostPattern}</td>
                  <td>
                    <Status tone={r.allow ? 'success' : 'danger'}>
                      {r.allow ? 'ALLOW' : 'DENY'}
                    </Status>
                  </td>
                  <td className="ea-text-muted">{r.note ?? '—'}</td>
                  <td className="ea-text-muted">{fmtAgo(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {showErase && <ErasureDialog
          onClose={() => setShowErase(false)}
          onSaved={() => { setShowErase(false); reload().catch(() => undefined); }} />}
    </div>
  );
}

function ErasureDialog({ onClose, onSaved }: {
  onClose: () => void; onSaved: () => void;
}): JSX.Element {
  const [subjectType, setSubjectType] = useState('device');
  const [subjectId, setSubjectId]     = useState('');
  const [reason, setReason]           = useState('');
  const [saving, setSaving]           = useState(false);
  const [err, setErr]                 = useState<string | null>(null);
  const [estimate, setEstimate]       = useState<Record<string, number> | null>(null);

  async function submit(): Promise<void> {
    setSaving(true); setErr(null);
    try {
      const r = await j<{ estimatedRowsAffected: Record<string, number> }>(
        'POST', '/edge-api/v1/compliance/erasure',
        { subjectType, subjectId, reason });
      setEstimate(r.estimatedRowsAffected);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="ea-modal-overlay" onClick={onClose}
         style={{ position: 'fixed', inset: 0, background: 'rgba(15,28,46,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="ea-modal" onClick={(e) => e.stopPropagation()}
           style={{ background: 'var(--der-surface)', border: '1px solid var(--der-border)',
                    padding: 24, maxWidth: 520, width: '90%', boxShadow: 'var(--el-3)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Right-to-erasure request</h3>
        <p className="ea-text-muted" style={{ margin: '0 0 12px', fontSize: 12 }}>
          Creates a PENDING request. An admin then approves via <strong>Complete erasure</strong>,
          which actually purges + stores a signed receipt hash.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ fontSize: 12 }}>Subject type
            <select className="ea-input" value={subjectType}
                    onChange={(e) => setSubjectType(e.target.value)}>
              <option value="device">device</option>
              <option value="patient">patient</option>
              <option value="user">user</option>
            </select>
          </label>
          <label style={{ fontSize: 12 }}>Subject ID
            <input className="ea-input" value={subjectId}
                   onChange={(e) => setSubjectId(e.target.value)}
                   placeholder="e.g. TAB-REG-01" />
          </label>
          <label style={{ fontSize: 12 }}>Reason (recorded in audit)
            <input className="ea-input" value={reason}
                   onChange={(e) => setReason(e.target.value)}
                   placeholder="GDPR Art. 17 · patient request · device decommission" />
          </label>
        </div>
        {estimate && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--der-raised)',
                        border: '1px solid var(--der-border)', fontSize: 13 }}>
            <strong>Estimated rows:</strong> {Object.entries(estimate).map(([k, v]) => `${k}=${v}`).join(' · ')}
            <br />
            Request is PENDING — admin must click <strong>Complete erasure</strong> to actually purge.
          </div>
        )}
        {err && <div className="ea-text-muted" style={{ marginTop: 10, fontSize: 12,
                     color: 'var(--der-danger-ink)' }}>{err}</div>}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm" onClick={onClose}>Close</button>
          {!estimate && (
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                    disabled={saving || !subjectId} onClick={submit}>
              {saving ? <span className="ea-btn-spinner" /> : <UiIcon icon="plus" size={14} />}
              <span>{saving ? 'Submitting…' : 'Submit request'}</span>
            </button>
          )}
          {estimate && (
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm" onClick={onSaved}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
