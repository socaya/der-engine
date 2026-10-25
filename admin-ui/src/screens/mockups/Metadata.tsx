import { useEffect, useMemo, useState } from 'react';
import * as edgeApi from '../../api/edgeApi';
import {
  OuPicker, useOuContext, Panel, SplitWithDrawer, Dot, fmtDate,
} from './shared';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

/**
 * MockupMetadata — browse every mirrored DHIS2 metadata resource.
 *
 * Replaces the earlier 4-tab stub (Data Elements / Programs / OUs /
 * Other Metadata) with a complete browser over the 13 metadata
 * collections DER mirrors — core tables + V030 catalog items for the
 * long tail (optionSets, indicators, validationRules, categoryCombos).
 */

interface Resource {
  key: string;         // DHIS2 web-API collection name
  label: string;       // display label on the tab
  typeLabel: string;   // singular label for the detail panel
}

const RESOURCES: readonly Resource[] = [
  { key: 'dataElements',               label: 'Data elements',             typeLabel: 'Data element' },
  { key: 'dataSets',                   label: 'Data sets',                 typeLabel: 'Data set' },
  { key: 'dataElementGroups',          label: 'Data element groups',       typeLabel: 'Data element group' },
  { key: 'dataElementGroupSets',       label: 'Data element group sets',   typeLabel: 'Data element group set' },
  { key: 'programs',                   label: 'Programs',                  typeLabel: 'Program' },
  { key: 'programIndicators',          label: 'Program indicators',        typeLabel: 'Program indicator' },
  { key: 'programRuleVariables',       label: 'Program rule variables',    typeLabel: 'Program rule variable' },
  { key: 'programStageSections',       label: 'Program stage sections',    typeLabel: 'Program stage section' },
  { key: 'programNotificationTemplates', label: 'Program notifications',   typeLabel: 'Program notification template' },
  { key: 'trackedEntityTypes',         label: 'Tracked entity types',      typeLabel: 'Tracked entity type' },
  { key: 'relationshipTypes',          label: 'Relationship types',        typeLabel: 'Relationship type' },
  { key: 'organisationUnits',          label: 'Organisation units',        typeLabel: 'Organisation unit' },
  { key: 'organisationUnitGroups',     label: 'OU groups',                 typeLabel: 'Organisation unit group' },
  { key: 'organisationUnitGroupSets',  label: 'OU group sets',             typeLabel: 'Organisation unit group set' },
  { key: 'organisationUnitLevels',     label: 'OU levels',                 typeLabel: 'Organisation unit level' },
  { key: 'optionSets',                 label: 'Option sets',               typeLabel: 'Option set' },
  { key: 'optionGroups',               label: 'Option groups',             typeLabel: 'Option group' },
  { key: 'categoryCombos',             label: 'Category combos',           typeLabel: 'Category combo' },
  { key: 'categoryOptions',            label: 'Category options',          typeLabel: 'Category option' },
  { key: 'categoryOptionGroups',       label: 'Category option groups',    typeLabel: 'Category option group' },
  { key: 'indicators',                 label: 'Indicators',                typeLabel: 'Indicator' },
  { key: 'indicatorTypes',             label: 'Indicator types',           typeLabel: 'Indicator type' },
  { key: 'indicatorGroups',            label: 'Indicator groups',          typeLabel: 'Indicator group' },
  { key: 'validationRules',            label: 'Validation rules',          typeLabel: 'Validation rule' },
  { key: 'validationRuleGroups',       label: 'Validation rule groups',    typeLabel: 'Validation rule group' },
  { key: 'legendSets',                 label: 'Legend sets',               typeLabel: 'Legend set' },
  { key: 'constants',                  label: 'Constants',                 typeLabel: 'Constant' },
  { key: 'predictors',                 label: 'Predictors',                typeLabel: 'Predictor' },
  { key: 'attributes',                 label: 'Attributes',                typeLabel: 'Attribute' },
  { key: 'userGroups',                 label: 'User groups',               typeLabel: 'User group' },
  { key: 'userRoles',                  label: 'User roles',                typeLabel: 'User role' },
  { key: 'documents',                  label: 'Documents',                 typeLabel: 'Document' },
];

interface MetaRow {
  id: string;
  name: string;
  shortName?: string;
  type: string;
  lastUpdated?: string;
  code?: string;
  resource: string;
  raw: Record<string, unknown>;
}

export function MockupMetadata(): JSX.Element {
  const [ctx] = useOuContext();
  const [tabKey, setTabKey] = useState<string>(RESOURCES[0].key);
  const [rows, setRows] = useState<MetaRow[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState<MetaRow | null>(null);

  const activeResource = RESOURCES.find((r) => r.key === tabKey) ?? RESOURCES[0];

  // Load the active resource whenever the tab changes.
  useEffect(() => {
    let cancelled = false;
    setRows(null); setErr(null); setSel(null);
    edgeApi.metadataList(activeResource.key)
      .then((r) => {
        if (cancelled) return;
        const items = (r[activeResource.key] ?? []) as edgeApi.MetadataListItem[];
        const mapped = items.map((it) => ({
          id: it.id,
          name: it.displayName ?? '',
          shortName: (it as Record<string, unknown>).shortName as string | undefined,
          code: (it as Record<string, unknown>).code as string | undefined,
          type: activeResource.typeLabel,
          lastUpdated: (it as Record<string, unknown>).lastUpdated as string | undefined,
          resource: activeResource.key,
          raw: it as Record<string, unknown>,
        }));
        setRows(mapped);
        // Auto-focus the first row so the right drawer renders a real
        // payload instead of the "select a row…" placeholder.
        if (mapped.length > 0) {
          setSel(mapped[0]);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      });
    return () => { cancelled = true; };
  }, [tabKey, activeResource.key, activeResource.typeLabel]);

  // Load counts for every resource up-front so the tab labels show totals.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.all(RESOURCES.map(async (r) => {
        try {
          const resp = await edgeApi.metadataList(r.key, { pageSize: 1, page: 1 });
          const pager = (resp as Record<string, unknown>).pager as { total?: number } | undefined;
          return [r.key, pager?.total ?? ((resp[r.key] as unknown[])?.length ?? 0)] as const;
        } catch { return [r.key, 0] as const; }
      }));
      if (cancelled) return;
      const next: Record<string, number> = {};
      for (const [k, n] of results) next[k] = n;
      setCounts(next);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = rows ?? [];
    return q ? base.filter((r) =>
      r.name.toLowerCase().includes(q)
      || r.id.toLowerCase().includes(q)
      || (r.code ?? '').toLowerCase().includes(q)) : base;
  }, [rows, query]);

  const totalRows = rows?.length ?? 0;
  const totalMirror = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="ea-screen">
      <section className="ea-dash-hero">
        <div className="ea-dash-hero-left">
          <div className="ea-dash-hero-eyebrow">DHIS2</div>
          <h1 className="ea-dash-hero-title">Metadata browser</h1>
          <p className="ea-dash-hero-sub">
            Every DHIS2 metadata resource mirrored on this edge — core
            and long-tail catalog. Switch tabs to drill in. {totalMirror.toLocaleString()} items across {RESOURCES.length} resources.
          </p>
        </div>
      </section>

      <OuPicker ctx={ctx} />

      <section className="ea-metadata-picker" aria-label="Metadata resource">
        <label className="ea-field" style={{ maxWidth: 480 }}>
          <span className="ea-field-label">Metadata resource</span>
          <select className="ea-input" value={tabKey}
                  onChange={(e) => setTabKey(e.target.value)}
                  data-test="metadata-resource">
            {RESOURCES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label} — {counts[r.key] ?? '…'} item{counts[r.key] === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </label>
        <div className="ea-metadata-picker-meta">
          <span className="ea-chip ea-chip--info">
            {counts[tabKey] ?? '…'} mirrored
          </span>
          <span className="ea-text-muted" style={{ fontSize: 12 }}>
            resource <span className="ea-mono">{tabKey}</span>
          </span>
        </div>
      </section>

      {err && <ErrorBlock title="Could not load metadata" testId="err-meta">{err}</ErrorBlock>}
      {!rows && !err && <LoadingBlock testId="loading" />}

      {rows && (
        <SplitWithDrawer
          drawerOpen={!!sel}
          main={
            <Panel title={activeResource.label}
                   action={
                     <>
                       <input className="ea-input" style={{ maxWidth: 240 }}
                              type="search" placeholder="Search by name, ID or code"
                              value={query} onChange={(e) => setQuery(e.target.value)} />
                       <span className="ea-text-muted">
                         {filtered.length === totalRows
                           ? `${totalRows.toLocaleString()} items`
                           : `${filtered.length.toLocaleString()} of ${totalRows.toLocaleString()}`}
                       </span>
                     </>
                   }>
              <div className="ea-table-wrap">
                <table className="ea-table ea-table--dense ea-table--selectable">
                  <thead><tr>
                    <th>Name</th><th>Code</th><th>Short name</th><th>Last updated</th><th>Mirror</th>
                  </tr></thead>
                  <tbody>
                    {filtered.slice(0, 500).map((r) => (
                      <tr key={r.id} className={sel?.id === r.id ? 'ea-row--active' : ''}
                          onClick={() => setSel(r)}>
                        <td>{r.name || <span className="ea-text-muted">(unnamed)</span>}</td>
                        <td className="ea-text-muted ea-mono" style={{ fontSize: 11 }}>{r.code ?? '—'}</td>
                        <td className="ea-text-muted">{r.shortName ?? '—'}</td>
                        <td className="ea-mono">{r.lastUpdated ? fmtDate(r.lastUpdated) : '—'}</td>
                        <td><Dot tone="success" /> mirrored</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={5} className="ea-text-muted" style={{ padding: 24, textAlign: 'center' }}>
                        {query ? 'No metadata matches that search.' : 'No metadata mirrored for this resource.'}
                      </td></tr>
                    )}
                  </tbody>
                </table>
                {filtered.length > 500 && (
                  <div className="ea-table-footer">
                    <span className="ea-text-muted">
                      Showing first 500 of {filtered.length.toLocaleString()} rows. Use search to narrow further.
                    </span>
                  </div>
                )}
              </div>
            </Panel>
          }
          drawer={
            sel ? (
              <>
                <h3 style={{ margin: 0, fontSize: 16 }}>{sel.name || '(unnamed)'}</h3>
                <div className="ea-text-muted" style={{ fontSize: 12 }}>{sel.type}</div>
                <dl className="ea-def-list">
                  <div className="ea-def-row"><dt>ID</dt><dd className="ea-mono">{sel.id}</dd></div>
                  <div className="ea-def-row"><dt>Resource</dt><dd className="ea-mono">{sel.resource}</dd></div>
                  <div className="ea-def-row"><dt>Code</dt><dd className="ea-mono">{sel.code ?? '—'}</dd></div>
                  <div className="ea-def-row"><dt>Short name</dt><dd>{sel.shortName ?? '—'}</dd></div>
                  <div className="ea-def-row"><dt>Last updated</dt><dd className="ea-mono">{sel.lastUpdated ? fmtDate(sel.lastUpdated) : '—'}</dd></div>
                </dl>
                <h4 style={{ margin: '8px 0 4px', fontSize: 12, color: 'var(--der-ink-400)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Full payload
                </h4>
                <pre className="ea-log-tail" style={{ fontSize: 10, maxHeight: 320 }}>
{JSON.stringify(sel.raw, null, 2)}
                </pre>
              </>
            ) : (
              <p className="ea-text-muted" style={{ margin: 0 }}>
                Select a row to see the full mirrored payload.
              </p>
            )
          }
        />
      )}
    </div>
  );
}
