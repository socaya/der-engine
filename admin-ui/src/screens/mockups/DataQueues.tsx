import { useEffect, useMemo, useState } from 'react';
import * as edgeApi from '../../api/edgeApi';
import {
  OuPicker, useOuContext, Panel, SplitWithDrawer, fmtDate, fmtAgo,
} from './shared';
import { LoadingBlock } from '../../components/ScreenStates';

type Tab = 'outgoing' | 'incoming';

interface QueueItem {
  code: string;
  created: string;
  type: string;
  description: string;
  dataType: string;
  status: 'queued' | 'pending' | 'failed' | 'done';
  retry: number;
  raw: edgeApi.ConflictRow | null;
}

/** DER Data Queues — matches docs/media/ui/DER Data Queues Dashboard.png */
export function MockupDataQueues(): JSX.Element {
  const [ctx] = useOuContext();
  const [tab, setTab] = useState<Tab>('outgoing');
  const [conflicts, setConflicts] = useState<edgeApi.ConflictRow[] | null>(null);
  const [inbox, setInbox] = useState<edgeApi.ReferralInboxRow[] | null>(null);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [sel, setSel] = useState<QueueItem | null>(null);

  async function reload(): Promise<void> {
    const [a, b] = await Promise.allSettled([
      edgeApi.listConflicts(100),
      edgeApi.listReferralInbox(100),
    ]);
    if (a.status === 'fulfilled') setConflicts(a.value);
    if (b.status === 'fulfilled') setInbox(b.value.entries);
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  const outgoing = useMemo((): QueueItem[] => {
    return (conflicts ?? []).map((c) => ({
      code: c.operationId.slice(0, 8).toUpperCase(),
      created: c.createdAt,
      type: c.entityType,
      description: c.entityRef,
      dataType: c.entityType,
      status: c.state === 'RESOLVED' ? 'done' : c.attemptCount > 3 ? 'failed' : 'pending',
      retry: c.attemptCount,
      raw: c,
    }));
  }, [conflicts]);

  const incoming = useMemo((): QueueItem[] => {
    return (inbox ?? []).map((e) => ({
      code: e.inboxId.slice(0, 8).toUpperCase(),
      created: e.discoveredAt,
      type: e.kind,
      description: e.sourceRef,
      dataType: e.kind,
      status: e.status === 'ACCEPTED' ? 'done' : e.status === 'DISMISSED' ? 'failed' : 'pending',
      retry: 0,
      raw: null,
    }));
  }, [inbox]);

  const items = tab === 'outgoing' ? outgoing : incoming;
  const types = useMemo(() => Array.from(new Set(items.map((i) => i.type))).sort(), [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (q && !i.code.toLowerCase().includes(q) && !i.description.toLowerCase().includes(q)) return false;
      if (filterType !== 'ALL' && i.type !== filterType) return false;
      if (filterStatus !== 'ALL' && i.status !== filterStatus) return false;
      return true;
    });
  }, [items, query, filterType, filterStatus]);

  async function resolve(action: 'ACCEPTED' | 'REJECTED'): Promise<void> {
    if (!sel?.raw) return;
    try { await edgeApi.resolveConflict(sel.raw.operationId, action); await reload(); setSel(null); }
    catch { /* ignore */ }
  }

  if (!conflicts || !inbox) return <LoadingBlock testId="loading" />;

  return (
    <div className="ea-screen">
      <section className="ea-dash-hero">
        <div className="ea-dash-hero-left">
          <div className="ea-dash-hero-eyebrow">Office &amp; Sync › Data Queues</div>
          <h1 className="ea-dash-hero-title">Data Queues</h1>
          <p className="ea-dash-hero-sub">View pending data to be synchronised for the selected organisation unit.</p>
        </div>
      </section>

      <OuPicker ctx={ctx} />

      <div className="ea-section-tabs" style={{ marginBottom: 16 }}>
        <button type="button" onClick={() => { setTab('outgoing'); setSel(null); }}
                className={'ea-section-tab' + (tab === 'outgoing' ? ' ea-section-tab--active' : '')}>
          Outgoing (To DHIS2) · {outgoing.length}
        </button>
        <button type="button" onClick={() => { setTab('incoming'); setSel(null); }}
                className={'ea-section-tab' + (tab === 'incoming' ? ' ea-section-tab--active' : '')}>
          Incoming (From DHIS2) · {incoming.length}
        </button>
      </div>

      <SplitWithDrawer
        drawerOpen={!!sel}
        main={
          <Panel title={tab === 'outgoing' ? 'Outgoing queue' : 'Incoming queue'}
                 action={
                   <>
                     <input className="ea-input" style={{ maxWidth: 200 }} type="search"
                            placeholder="Search records"
                            value={query} onChange={(e) => setQuery(e.target.value)} />
                     <select className="ea-input" style={{ maxWidth: 140 }} value={filterType}
                             onChange={(e) => setFilterType(e.target.value)}>
                       <option value="ALL">All Types</option>
                       {types.map((t) => <option key={t} value={t}>{t}</option>)}
                     </select>
                     <select className="ea-input" style={{ maxWidth: 140 }} value={filterStatus}
                             onChange={(e) => setFilterStatus(e.target.value)}>
                       <option value="ALL">All Statuses</option>
                       <option value="queued">Queued</option>
                       <option value="pending">Pending</option>
                       <option value="failed">Failed</option>
                       <option value="done">Done</option>
                     </select>
                     <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                             onClick={() => { reload().catch(() => undefined); }}>Refresh</button>
                   </>
                 }>
            <div className="ea-table-wrap">
              <table className="ea-table ea-table--dense ea-table--selectable">
                <thead><tr>
                  <th>Code</th><th>Created</th><th>Type</th><th>Description</th><th>Data Type</th><th>Status</th><th>Retry</th>
                </tr></thead>
                <tbody>
                  {filtered.slice(0, 100).map((i) => (
                    <tr key={i.code} className={sel?.code === i.code ? 'ea-row--active' : ''}
                        onClick={() => setSel(i)}>
                      <td className="ea-mono">{i.code}</td>
                      <td className="ea-mono">{fmtDate(i.created)}</td>
                      <td>{i.type}</td>
                      <td className="ea-text-muted">{i.description}</td>
                      <td>{i.dataType}</td>
                      <td>
                        <span className={'ea-chip ea-chip--' +
                            (i.status === 'done' ? 'success' : i.status === 'failed' ? 'danger'
                              : i.status === 'pending' ? 'warning' : 'info')}>{i.status}</span>
                      </td>
                      <td className="ea-mono">{i.retry}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="ea-text-muted" style={{ padding: 24, textAlign: 'center' }}>Queue is empty.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="ea-table-footer">
              <span className="ea-text-muted">Showing 1 to {Math.min(100, filtered.length)} of {filtered.length} records</span>
            </div>
          </Panel>
        }
        drawer={
          sel ? (
            <>
              <h3 style={{ margin: 0, fontSize: 16 }}>Queue Item Details</h3>
              <dl className="ea-def-list">
                <div className="ea-def-row"><dt>Code</dt><dd className="ea-mono">{sel.code}</dd></div>
                <div className="ea-def-row"><dt>Type</dt><dd>{sel.type}</dd></div>
                <div className="ea-def-row"><dt>Status</dt>
                  <dd><span className={'ea-chip ea-chip--' + (sel.status === 'done' ? 'success' : sel.status === 'failed' ? 'danger' : 'warning')}>{sel.status}</span></dd>
                </div>
                <div className="ea-def-row"><dt>Created</dt><dd className="ea-mono">{fmtDate(sel.created)}</dd></div>
                <div className="ea-def-row"><dt>Age</dt><dd>{fmtAgo(sel.created)}</dd></div>
                <div className="ea-def-row"><dt>Description</dt><dd>{sel.description}</dd></div>
                <div className="ea-def-row"><dt>Retry count</dt><dd className="ea-mono">{sel.retry}</dd></div>
                {sel.raw && (
                  <div className="ea-def-row"><dt>Operation ID</dt><dd className="ea-mono">{sel.raw.operationId}</dd></div>
                )}
              </dl>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button type="button" className="ea-btn ea-btn--primary"
                        onClick={() => { resolve('ACCEPTED').catch(() => undefined); }}>
                  Sync This Item
                </button>
                <button type="button" className="ea-btn ea-btn--ghost">Edit Data</button>
                <button type="button" className="ea-btn ea-btn--ghost ea-btn--danger"
                        onClick={() => { resolve('REJECTED').catch(() => undefined); }}>
                  Delete From Queue
                </button>
              </div>
            </>
          ) : (
            <p className="ea-text-muted" style={{ margin: 0 }}>Select a row to inspect and act.</p>
          )
        }
      />
    </div>
  );
}
