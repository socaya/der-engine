import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import {
  Panel, Dot, fmtDate, TablePager, BackLink, RowMenu,
} from './shared';
import { UiIcon } from '../components/UiIcon';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';

/**
 * MockupMetadata — browse every mirrored DHIS2 metadata resource.
 *
 * Implements §14 of DER_UI_Visibility_10_of_10_Standard:
 *  - §14.1 resources grouped by domain in a single <optgroup> picker
 *  - §14.2 metadata health summary (last sync, snapshots, drift) up top
 *  - §14.3 detail panel split into Summary / Relationships / Rules /
 *    Raw JSON — Raw JSON is a diagnostic sub-tab, not the primary view.
 */

interface Resource {
  key: string;         // DHIS2 web-API collection name
  label: string;       // display label on the tab
  typeLabel: string;   // singular label for the detail panel
}

interface DomainGroup {
  domain: string;
  resources: readonly Resource[];
}

/* §14.1 — group resources by functional domain. */
const DOMAIN_GROUPS: readonly DomainGroup[] = [
  { domain: 'Aggregate', resources: [
    { key: 'dataElements',          label: 'Data elements',          typeLabel: 'Data element' },
    { key: 'dataSets',              label: 'Data sets',              typeLabel: 'Data set' },
    { key: 'dataElementGroups',     label: 'Data element groups',    typeLabel: 'Data element group' },
    { key: 'dataElementGroupSets',  label: 'Data element group sets', typeLabel: 'Data element group set' },
    { key: 'categoryCombos',        label: 'Category combinations',  typeLabel: 'Category combo' },
    { key: 'categoryOptions',       label: 'Category options',       typeLabel: 'Category option' },
    { key: 'categoryOptionCombos',  label: 'Category option combos', typeLabel: 'Category option combo' },
  ] },
  { domain: 'Tracker', resources: [
    { key: 'programs',                   label: 'Programs',                  typeLabel: 'Program' },
    { key: 'programStages',              label: 'Program stages',            typeLabel: 'Program stage' },
    { key: 'programStageSections',       label: 'Program stage sections',    typeLabel: 'Program stage section' },
    { key: 'programNotificationTemplates', label: 'Program notifications',   typeLabel: 'Program notification template' },
    { key: 'trackedEntityTypes',         label: 'Tracked entity types',      typeLabel: 'Tracked entity type' },
    { key: 'trackedEntityAttributes',    label: 'Tracked entity attributes', typeLabel: 'Tracked entity attribute' },
    { key: 'relationshipTypes',          label: 'Relationships',             typeLabel: 'Relationship type' },
  ] },
  { domain: 'Rules & Validation', resources: [
    { key: 'programRules',          label: 'Program rules',          typeLabel: 'Program rule' },
    { key: 'programRuleVariables',  label: 'Program rule variables', typeLabel: 'Program rule variable' },
    { key: 'programRuleActions',    label: 'Program rule actions',   typeLabel: 'Program rule action' },
    { key: 'validationRules',       label: 'Validation rules',       typeLabel: 'Validation rule' },
    { key: 'validationRuleGroups',  label: 'Validation rule groups', typeLabel: 'Validation rule group' },
    { key: 'predictors',            label: 'Predictors',             typeLabel: 'Predictor' },
    { key: 'constants',             label: 'Constants',              typeLabel: 'Constant' },
  ] },
  { domain: 'Organisation', resources: [
    { key: 'organisationUnits',          label: 'Organisation units', typeLabel: 'Organisation unit' },
    { key: 'organisationUnitLevels',     label: 'OU levels',          typeLabel: 'Organisation unit level' },
    { key: 'organisationUnitGroups',     label: 'OU groups',          typeLabel: 'Organisation unit group' },
    { key: 'organisationUnitGroupSets',  label: 'OU group sets',      typeLabel: 'Organisation unit group set' },
  ] },
  { domain: 'Options', resources: [
    { key: 'optionSets',   label: 'Option sets',   typeLabel: 'Option set' },
    { key: 'optionGroups', label: 'Option groups', typeLabel: 'Option group' },
  ] },
  { domain: 'Analytics', resources: [
    { key: 'indicators',      label: 'Indicators',      typeLabel: 'Indicator' },
    { key: 'indicatorTypes',  label: 'Indicator types', typeLabel: 'Indicator type' },
    { key: 'indicatorGroups', label: 'Indicator groups', typeLabel: 'Indicator group' },
    { key: 'programIndicators', label: 'Program indicators', typeLabel: 'Program indicator' },
    { key: 'dashboards',      label: 'Dashboards',      typeLabel: 'Dashboard' },
    { key: 'visualizations',  label: 'Visualisations',  typeLabel: 'Visualization' },
    { key: 'maps',            label: 'Maps',            typeLabel: 'Map' },
    { key: 'eventReports',    label: 'Event reports',   typeLabel: 'Event report' },
    { key: 'eventCharts',     label: 'Event charts',    typeLabel: 'Event chart' },
    { key: 'reports',         label: 'Reports',         typeLabel: 'Report' },
    { key: 'legendSets',      label: 'Legend sets',     typeLabel: 'Legend set' },
  ] },
  { domain: 'Administration / Other', resources: [
    { key: 'userGroups',     label: 'User groups',     typeLabel: 'User group' },
    { key: 'userRoles',      label: 'User roles',      typeLabel: 'User role' },
    { key: 'attributes',     label: 'Attributes',      typeLabel: 'Attribute' },
    { key: 'documents',      label: 'Documents',       typeLabel: 'Document' },
    { key: 'sqlViews',       label: 'SQL views',       typeLabel: 'SQL view' },
    { key: 'dataEntryForms', label: 'Data entry forms', typeLabel: 'Data entry form' },
    { key: 'categoryOptionGroups', label: 'Category option groups', typeLabel: 'Category option group' },
  ] },
];

const RESOURCES: readonly Resource[] =
  DOMAIN_GROUPS.flatMap((g) => g.resources);

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
  const navigate = useNavigate();
  const [tabKey, setTabKey] = useState<string>(RESOURCES[0].key);
  const [activeDomain, setActiveDomain] = useState<string>(DOMAIN_GROUPS[0].domain);
  const [rows, setRows] = useState<MetaRow[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [pageTotal, setPageTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  const activeResource = RESOURCES.find((r) => r.key === tabKey) ?? RESOURCES[0];
  const activeDomainGroup = DOMAIN_GROUPS.find((g) => g.domain === activeDomain) ?? DOMAIN_GROUPS[0];

  // When domain switches, snap to the first resource in that domain if the
  // currently-selected resource isn't in it.
  useEffect(() => {
    if (!activeDomainGroup.resources.some((r) => r.key === tabKey)) {
      setTabKey(activeDomainGroup.resources[0].key);
    }
  }, [activeDomain, activeDomainGroup, tabKey]);

  // Compute per-domain item counts for the tab labels.
  const domainCounts = useMemo((): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const g of DOMAIN_GROUPS) {
      out[g.domain] = g.resources.reduce((a, r) => a + (counts[r.key] ?? 0), 0);
    }
    return out;
  }, [counts]);

  useEffect(() => { setPage(1); }, [tabKey, pageSize]);

  useEffect(() => {
    let cancelled = false;
    setRows(null); setErr(null);
    edgeApi.metadataList(activeResource.key, { page, pageSize })
      .then((r) => {
        if (cancelled) return;
        const items = (r[activeResource.key] ?? []) as edgeApi.MetadataListItem[];
        const pager = (r as Record<string, unknown>).pager as
          { total?: number; pageCount?: number } | undefined;
        setPageTotal(pager?.total ?? items.length);
        setPageCount(Math.max(1, pager?.pageCount ?? 1));
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
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      });
    return () => { cancelled = true; };
  }, [tabKey, activeResource.key, activeResource.typeLabel, page, pageSize]);

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

  const totalMirror = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="ea-screen">
      {/* §14.2 health summary + standard screen header replace the hero */}
      <MetadataHealthSummary totalMirror={totalMirror} resourceCount={RESOURCES.length} />

      {err && <ErrorBlock title="Could not load metadata" testId="err-meta">{err}</ErrorBlock>}
      {!rows && !err && <LoadingBlock testId="loading" />}

      {rows && (
        <Panel action={
          <>
            <select className="ea-input" style={{ maxWidth: 220 }}
                    value={activeDomain}
                    onChange={(e) => setActiveDomain(e.target.value)}
                    data-test="metadata-category"
                    aria-label="Metadata category">
              {DOMAIN_GROUPS.map((g) => (
                <option key={g.domain} value={g.domain}>
                  {g.domain} ({(domainCounts[g.domain] ?? 0).toLocaleString()})
                </option>
              ))}
            </select>
            <select className="ea-input" style={{ maxWidth: 260 }}
                    value={tabKey}
                    onChange={(e) => setTabKey(e.target.value)}
                    data-test="metadata-resource"
                    aria-label="Metadata resource">
              {activeDomainGroup.resources.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label} — {counts[r.key] ?? '…'}
                </option>
              ))}
            </select>
            <input className="ea-input" style={{ maxWidth: 240 }}
                   type="search" placeholder="Search by name, ID or code"
                   value={query} onChange={(e) => setQuery(e.target.value)} />
            <span className="ea-text-muted" style={{ fontSize: 12 }}>
              {query
                ? `${filtered.length.toLocaleString()} match${filtered.length === 1 ? '' : 'es'} on this page`
                : `${pageTotal.toLocaleString()} items`}
            </span>
          </>
        }>
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense ea-table--selectable">
              <thead><tr>
                <th>Name</th><th>ID</th><th>Code</th><th>Short name</th>
                <th>Last updated</th><th>Mirror</th><th style={{ width: 36 }}></th>
              </tr></thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}
                      onClick={() => navigate(`/dhis2/metadata/${r.resource}/${r.id}`)}
                      data-test={`meta-row-${r.id}`}>
                    <td>{r.name || <span className="ea-text-muted">(unnamed)</span>}</td>
                    <td className="ea-mono" style={{ fontSize: 13 }}>{r.id}</td>
                    <td className="ea-text-muted ea-mono" style={{ fontSize: 13 }}>{r.code ?? '—'}</td>
                    <td className="ea-text-muted">{r.shortName ?? '—'}</td>
                    <td className="ea-mono">{r.lastUpdated ? fmtDate(r.lastUpdated) : '—'}</td>
                    <td><Dot tone="success" /> mirrored</td>
                    <td style={{ textAlign: 'right' }}>
                      <RowMenu items={[
                        { label: 'Open details', to: `/dhis2/metadata/${r.resource}/${r.id}` },
                      ]} />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="ea-text-muted" style={{ padding: 24, textAlign: 'center' }}>
                    {query ? 'No metadata matches that search on this page.' : 'No metadata mirrored for this resource.'}
                  </td></tr>
                )}
              </tbody>
            </table>
            <TablePager
              page={page} pageCount={pageCount} pageSize={pageSize} total={pageTotal}
              onPage={setPage} onPageSize={setPageSize}
            />
          </div>
        </Panel>
      )}
    </div>
  );
}

/** `/admin/dhis2/metadata/:resource/:id` — per-record details page.
 *  Replaces the former right-side drawer. */
export function MockupMetadataDetail(): JSX.Element {
  const { resource, id } = useParams<{ resource: string; id: string }>();
  const [item, setItem] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'summary' | 'relationships' | 'rules' | 'raw'>('summary');

  useEffect(() => {
    if (!resource || !id) return;
    let cancelled = false;
    edgeApi.metadataList(resource, { page: 1, pageSize: 1000 })
      .then((r) => {
        if (cancelled) return;
        const items = (r[resource] ?? []) as edgeApi.MetadataListItem[];
        const found = items.find((x) => x.id === id);
        if (!found) { setErr('Record not found in this mirror. It may have been removed since the last metadata sync.'); return; }
        setItem(found as unknown as Record<string, unknown>);
      })
      .catch((e: unknown) => { if (!cancelled) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [resource, id]);

  const typeLabel = RESOURCES.find((r) => r.key === resource)?.typeLabel ?? resource ?? 'Record';

  if (err) return <ErrorBlock title="Could not load record" testId="err-meta-detail">{err}</ErrorBlock>;
  if (!item) return <LoadingBlock testId="loading" />;

  const name = (item.displayName ?? item.name) as string | undefined;
  const shortName = item.shortName as string | undefined;
  const code = item.code as string | undefined;
  const lastUpdated = item.lastUpdated as string | undefined;
  const sel: MetaRow = {
    id: id ?? '', name: name ?? '', shortName, code, type: typeLabel,
    lastUpdated, resource: resource ?? '', raw: item,
  };

  return (
    <div className="ea-screen" data-test="meta-detail">
      <BackLink to="/dhis2/metadata" label="Back to Metadata" />
      <header className="ea-screen-header">
        <div className="ea-screen-header-text">
          <h1 style={{ margin: 0 }}>{sel.name || '(unnamed)'}</h1>
          <div className="ea-screen-header-sub">
            <span>{typeLabel}</span>
            <span>·</span>
            <span className="ea-mono">{sel.id}</span>
          </div>
        </div>
      </header>
      <section className="ea-panel">
        <MetadataDetail sel={sel} tab={tab} setTab={setTab} />
      </section>
    </div>
  );
}

/* ─────── §14.2 Metadata health summary ─────── */
function MetadataHealthSummary(
  { totalMirror, resourceCount }: { totalMirror: number; resourceCount: number }
): JSX.Element {
  const [lastSync, setLastSync] = useState<edgeApi.JobRun | null>(null);
  const [drift, setDrift] = useState<edgeApi.DriftResponse | null>(null);
  const [compat, setCompat] = useState<edgeApi.CompatSnapshot | null>(null);

  useEffect(() => {
    edgeApi.listJobs(1, 'metadata-pull').then((rs) => setLastSync(rs[0] ?? null)).catch(() => undefined);
    edgeApi.drift(false).then(setDrift).catch(() => undefined);
    edgeApi.compat().then(setCompat).catch(() => undefined);
  }, []);

  const syncLabel = lastSync?.outcome === 'SUCCESS'
    ? `Last successful sync ${fmtDate(lastSync.startedAt)}`
    : lastSync ? `Last attempt ${fmtDate(lastSync.startedAt)} — ${lastSync.outcome}`
      : 'Never synced';
  const syncTone = lastSync?.outcome === 'SUCCESS' ? 'success'
    : lastSync ? 'warning' : 'neutral';

  const driftLabel = drift?.status === 'IN_SYNC' ? 'In sync'
    : drift?.status === 'DRIFT' ? 'Drift detected'
    : drift?.status === 'STALE' ? 'Stale'
    : drift ? drift.status ?? 'Unknown' : 'Checking…';
  const driftTone = drift?.status === 'IN_SYNC' ? 'success'
    : drift?.status === 'DRIFT' ? 'warning'
    : drift?.status === 'STALE' ? 'warning'
    : 'neutral';

  const centralSnap = drift?.snapshotTo != null ? String(drift.snapshotTo)
    : compat?.probeReachable ? 'Reachable' : '—';
  const edgeSnap = drift?.snapshotFrom != null ? String(drift.snapshotFrom) : '—';

  return (
    <header className="ea-screen-header" data-test="metadata-health">
      <div className="ea-screen-header-text">
        <h1 style={{ margin: 0 }}>Metadata</h1>
        <div className="ea-screen-header-sub">
          <span>Read-only mirror of every DHIS2 metadata resource on this edge.</span>
          <span>·</span>
          <span><strong style={{ color: 'var(--der-ink-900)' }}>{totalMirror.toLocaleString()}</strong> items across {resourceCount} resources</span>
          <span>·</span>
          <span style={{ color: toneColor(syncTone) }}>{syncLabel}</span>
          <span>·</span>
          <span>Snapshot <strong style={{ color: 'var(--der-ink-900)' }}>{centralSnap}</strong>→<strong style={{ color: 'var(--der-ink-900)' }}>{edgeSnap}</strong></span>
          <span>·</span>
          <span style={{ color: toneColor(driftTone) }}>{driftLabel}</span>
        </div>
      </div>
      <div className="ea-screen-header-right">
        <Link to="/dhis2/metadata-sync" className="ea-btn ea-btn--primary ea-btn--sm"
              data-test="metadata-action-sync">
          <UiIcon icon="pull" size={14} />
          <span>Metadata sync</span>
        </Link>
        <Link to="/dhis2/metadata-drift" className="ea-btn ea-btn--sm"
              data-test="metadata-action-drift">
          <UiIcon icon="drift" size={14} />
          <span>Metadata drift</span>
        </Link>
      </div>
    </header>
  );
}

function toneColor(t: 'success' | 'warning' | 'danger' | 'neutral'): string {
  if (t === 'success') return 'var(--der-success-ink)';
  if (t === 'warning') return 'var(--der-warning-ink)';
  if (t === 'danger') return 'var(--der-danger-ink)';
  return 'var(--der-ink-500)';
}

/* ─────── §14.3 Detail tabs: Summary / Relationships / Rules / Raw JSON ─────── */
function MetadataDetail({ sel, tab, setTab }: {
  sel: MetaRow;
  tab: 'summary' | 'relationships' | 'rules' | 'raw';
  setTab: (t: 'summary' | 'relationships' | 'rules' | 'raw') => void;
}): JSX.Element {
  const raw = sel.raw;
  const rels = extractRelationships(raw);
  const rules = extractRules(raw);
  return (
    <>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{sel.name || '(unnamed)'}</h3>
      <div className="ea-text-muted" style={{ fontSize: 13, marginBottom: 10 }}>{sel.type}</div>
      <div className="ea-section-tabs" style={{ marginBottom: 10 }}>
        <button type="button"
                className={'ea-section-tab' + (tab === 'summary' ? ' ea-section-tab--active' : '')}
                onClick={() => setTab('summary')}>Summary</button>
        <button type="button"
                className={'ea-section-tab' + (tab === 'relationships' ? ' ea-section-tab--active' : '')}
                onClick={() => setTab('relationships')}>Relationships{rels.length > 0 ? ` (${rels.length})` : ''}</button>
        <button type="button"
                className={'ea-section-tab' + (tab === 'rules' ? ' ea-section-tab--active' : '')}
                onClick={() => setTab('rules')}>Rules{rules.length > 0 ? ` (${rules.length})` : ''}</button>
        <button type="button"
                className={'ea-section-tab' + (tab === 'raw' ? ' ea-section-tab--active' : '')}
                onClick={() => setTab('raw')} title="Diagnostic — full payload">Raw JSON</button>
      </div>
      {tab === 'summary' && (
        <dl className="ea-def-list">
          <div className="ea-def-row"><dt>ID</dt><dd className="ea-mono">{sel.id}</dd></div>
          <div className="ea-def-row"><dt>Resource</dt><dd className="ea-mono">{sel.resource}</dd></div>
          <div className="ea-def-row"><dt>Code</dt><dd className="ea-mono">{sel.code ?? '—'}</dd></div>
          <div className="ea-def-row"><dt>Short name</dt><dd>{sel.shortName ?? '—'}</dd></div>
          <div className="ea-def-row"><dt>Last updated</dt>
            <dd className="ea-mono">{sel.lastUpdated ? fmtDate(sel.lastUpdated) : '—'}</dd></div>
        </dl>
      )}
      {tab === 'relationships' && (
        rels.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, fontSize: 14 }}>
            No related metadata references on this record.
          </p>
        ) : (
          <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 14 }}>
            {rels.map((r) => (
              <li key={r.field + ':' + r.id} style={{ marginBottom: 4 }}>
                <span className="ea-text-muted">{r.field}:</span>{' '}
                <span className="ea-mono" style={{ fontSize: 13 }}>{r.id}</span>
                {r.name && <> — {r.name}</>}
              </li>
            ))}
          </ul>
        )
      )}
      {tab === 'rules' && (
        rules.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, fontSize: 14 }}>
            No program rules, validation rules or rule actions on this record.
          </p>
        ) : (
          <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 14 }}>
            {rules.map((r, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                <span className="ea-text-muted">{r.kind}:</span>{' '}
                <span className="ea-mono" style={{ fontSize: 13 }}>{r.expression}</span>
              </li>
            ))}
          </ul>
        )
      )}
      {tab === 'raw' && (
        <>
          <p className="ea-text-muted" style={{ margin: '0 0 8px', fontSize: 13 }}>
            Diagnostic view of the full mirrored payload. Prefer the Summary / Relationships / Rules tabs for operator work.
          </p>
          <pre className="ea-log-tail" style={{
            fontSize: 12,
            height: 'calc(100vh - 320px)',
            minHeight: 320,
            maxHeight: 'none',
          }}>
{JSON.stringify(raw, null, 2)}
          </pre>
        </>
      )}
    </>
  );
}

interface RelRef { field: string; id: string; name?: string }

function extractRelationships(raw: Record<string, unknown>): RelRef[] {
  const out: RelRef[] = [];
  const refFields = [
    'programType', 'categoryCombo', 'trackedEntityType', 'program',
    'programStage', 'dataSet', 'optionSet', 'legendSet', 'organisationUnit',
  ];
  for (const f of refFields) {
    const v = raw[f] as Record<string, unknown> | undefined;
    if (v && typeof v === 'object' && typeof v.id === 'string') {
      out.push({ field: f, id: v.id, name: (v.displayName ?? v.name) as string | undefined });
    }
  }
  const arrFields = ['programStages', 'dataElements', 'organisationUnits',
    'trackedEntityAttributes', 'programIndicators', 'programTrackedEntityAttributes'];
  for (const f of arrFields) {
    const v = raw[f];
    if (Array.isArray(v)) {
      for (const item of v.slice(0, 10)) {
        if (item && typeof item === 'object' && 'id' in item && typeof (item as { id: unknown }).id === 'string') {
          const r = item as Record<string, unknown>;
          out.push({ field: f, id: r.id as string, name: (r.displayName ?? r.name) as string | undefined });
        }
      }
      if (v.length > 10) out.push({ field: f, id: `…${v.length - 10} more`, name: undefined });
    }
  }
  return out;
}

interface RuleRef { kind: string; expression: string }

function extractRules(raw: Record<string, unknown>): RuleRef[] {
  const out: RuleRef[] = [];
  if (typeof raw.condition === 'string') out.push({ kind: 'Condition', expression: raw.condition });
  if (typeof raw.expression === 'string') out.push({ kind: 'Expression', expression: raw.expression });
  if (typeof raw.leftSide === 'object' && raw.leftSide != null) {
    const l = raw.leftSide as { expression?: string };
    if (l.expression) out.push({ kind: 'Left', expression: l.expression });
  }
  if (typeof raw.rightSide === 'object' && raw.rightSide != null) {
    const r = raw.rightSide as { expression?: string };
    if (r.expression) out.push({ kind: 'Right', expression: r.expression });
  }
  if (Array.isArray(raw.programRuleActions)) {
    for (const a of (raw.programRuleActions as Array<Record<string, unknown>>).slice(0, 10)) {
      const kind = (a.programRuleActionType as string) ?? 'Action';
      const expr = (a.data as string) ?? (a.content as string) ?? '';
      out.push({ kind, expression: expr });
    }
  }
  return out;
}
