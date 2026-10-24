import { useEffect, useMemo, useState } from 'react';
import * as edgeApi from '../../api/edgeApi';
import {
  OuPicker, useOuContext, Panel, SplitWithDrawer, Dot, fmtAgo, fmtDate,
} from './shared';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

type Tab = 'dataElements' | 'programs' | 'organisationUnits' | 'other';

const TAB_LABELS: Record<Tab, string> = {
  dataElements: 'Data Elements',
  programs: 'Programs',
  organisationUnits: 'Organisation units',
  other: 'Other Metadata',
};

interface MetaRow {
  id: string;
  name: string;
  shortName?: string;
  type: string;
  lastUpdated?: string;
}

/** DER Metadata — matches docs/media/ui/DER Metadata Synchronisation Dashboard.png */
export function MockupMetadata(): JSX.Element {
  const [ctx] = useOuContext();
  const [tab, setTab] = useState<Tab>('dataElements');
  const [rows, setRows] = useState<MetaRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState<MetaRow | null>(null);

  useEffect(() => {
    setRows(null);
    setErr(null);
    const resource = {
      dataElements: 'dataElements',
      programs: 'programs',
      organisationUnits: 'organisationUnits',
      other: 'optionSets',
    }[tab];
    const typeLabel = TAB_LABELS[tab].replace(/s$/, '');
    edgeApi.metadataList(resource).then((r) => {
      const items = (r[resource] ?? []) as edgeApi.MetadataListItem[];
      setRows(items.map((it) => ({
        id: it.id,
        name: it.displayName,
        shortName: (it as Record<string, unknown>).shortName as string | undefined,
        type: typeLabel,
        lastUpdated: (it as Record<string, unknown>).lastUpdated as string | undefined,
      })));
    }).catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, [tab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = rows ?? [];
    return q ? base.filter((r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)) : base;
  }, [rows, query]);

  return (
    <div className="ea-screen">
      <section className="ea-dash-hero">
        <div className="ea-dash-hero-left">
          <div className="ea-dash-hero-eyebrow">Office &amp; Sync › Metadata</div>
          <h1 className="ea-dash-hero-title">Metadata</h1>
          <p className="ea-dash-hero-sub">View and synchronise metadata for the selected organisation unit.</p>
        </div>
      </section>

      <OuPicker ctx={ctx} />

      <div className="ea-section-tabs" style={{ marginBottom: 16 }}>
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button key={t} type="button"
                  className={'ea-section-tab' + (tab === t ? ' ea-section-tab--active' : '')}
                  onClick={() => { setTab(t); setSel(null); }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {err && <ErrorBlock title="Failed to load metadata" testId="err-meta">{err}</ErrorBlock>}
      {!rows && !err && <LoadingBlock testId="loading" />}

      {rows && (
        <SplitWithDrawer
          drawerOpen={!!sel}
          main={
            <Panel title={TAB_LABELS[tab]}
                   action={
                     <>
                       <input className="ea-input" style={{ maxWidth: 220 }}
                              type="search" placeholder="Search metadata"
                              value={query} onChange={(e) => setQuery(e.target.value)} />
                       <span className="ea-text-muted">{filtered.length} items</span>
                     </>
                   }>
              <div className="ea-table-wrap">
                <table className="ea-table ea-table--dense ea-table--selectable">
                  <thead><tr>
                    <th>Name</th><th>Short Name</th><th>Type</th><th>Last Updated</th><th>Sync Status</th>
                  </tr></thead>
                  <tbody>
                    {filtered.slice(0, 50).map((r) => (
                      <tr key={r.id} className={sel?.id === r.id ? 'ea-row--active' : ''}
                          onClick={() => setSel(r)}>
                        <td>{r.name}</td>
                        <td className="ea-text-muted">{r.shortName ?? '—'}</td>
                        <td>{r.type}</td>
                        <td className="ea-mono">{r.lastUpdated ? fmtDate(r.lastUpdated) : '—'}</td>
                        <td><Dot tone="success" /> Synced</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={5} className="ea-text-muted" style={{ padding: 24, textAlign: 'center' }}>No metadata to display.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          }
          drawer={
            sel ? (
              <>
                <h3 style={{ margin: 0, fontSize: 16 }}>Metadata Details</h3>
                <dl className="ea-def-list">
                  <div className="ea-def-row"><dt>Name</dt><dd>{sel.name}</dd></div>
                  <div className="ea-def-row"><dt>ID</dt><dd className="ea-mono">{sel.id}</dd></div>
                  <div className="ea-def-row"><dt>Short Name</dt><dd>{sel.shortName ?? '—'}</dd></div>
                  <div className="ea-def-row"><dt>Type</dt><dd>{sel.type}</dd></div>
                  <div className="ea-def-row"><dt>Last Updated</dt><dd className="ea-mono">{sel.lastUpdated ? fmtDate(sel.lastUpdated) : '—'}</dd></div>
                  <div className="ea-def-row"><dt>Sync Status</dt><dd><span className="ea-chip ea-chip--success">Synced</span></dd></div>
                  <div className="ea-def-row"><dt>Last Synced</dt><dd className="ea-mono">{fmtAgo(sel.lastUpdated)}</dd></div>
                </dl>
                <div className="ea-form-actions" style={{ borderRadius: 0, background: 'transparent', padding: 0, borderTop: 0, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                  <button type="button" className="ea-btn ea-btn--primary">Synchronise Now</button>
                  <a className="ea-btn ea-btn--ghost" href={`/api/${sel.type.toLowerCase().replace(/ /g, '')}s/${sel.id}`} target="_blank" rel="noreferrer">View in DHIS2</a>
                </div>
              </>
            ) : (
              <p className="ea-text-muted" style={{ margin: 0 }}>Select a row to view details.</p>
            )
          }
        />
      )}
    </div>
  );
}
