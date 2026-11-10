import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import { ErrorBlock, InlineLoading } from './ScreenStates';
import { UiIcon } from './UiIcon';

/** UI-13 — "Associated metadata" panel for the Organisation unit screen.
 *
 *  <p>The bound organisation unit on DHIS2 carries rich associations:
 *  which data sets it captures, which programs run there, which
 *  organisation-unit groups it belongs to, its parent chain, and its
 *  children. Operators previously had to open DHIS2 central in a new
 *  tab to see any of this. The admin UI already mirrors the
 *  OU record via {@code /api/organisationUnits/{id}}; this component
 *  surfaces the associations inline with resolved display names.</p>
 *
 *  <p>Resolution strategy: one bulk list per resource type
 *  (datasets, programs, OU groups) via the existing
 *  {@link edgeApi.metadataList} helper, then in-memory lookup by id.
 *  Avoids the N-round-trip trap of per-id fetches.</p>
 */

type Named = { id: string; displayName?: string; name?: string };

export function OrgUnitAssociations(
  { orgUnitId }: { orgUnitId: string | null },
): JSX.Element | null {
  const [ou, setOu] = useState<Record<string, unknown> | null>(null);
  const [dataSetsById, setDataSetsById] =
    useState<Map<string, Named> | null>(null);
  const [programsById, setProgramsById] =
    useState<Map<string, Named> | null>(null);
  const [groupsById, setGroupsById] =
    useState<Map<string, Named> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!orgUnitId) return;
    let alive = true;
    (async () => {
      try {
        const [o, ds, pr, g] = await Promise.all([
          edgeApi.getOrganisationUnit(orgUnitId) as Promise<Record<string, unknown>>,
          edgeApi.metadataList('dataSets'),
          edgeApi.metadataList('programs'),
          edgeApi.metadataList('organisationUnitGroups'),
        ]);
        if (!alive) return;
        setOu(o);
        setDataSetsById(indexById(ds.dataSets as Named[] | undefined));
        setProgramsById(indexById(pr.programs as Named[] | undefined));
        setGroupsById(indexById(g.organisationUnitGroups as Named[] | undefined));
      } catch (e) {
        if (alive) setErr((e as Error).message);
      }
    })();
    return () => { alive = false; };
  }, [orgUnitId]);

  const rows = useMemo(() => resolveRows(ou, dataSetsById, programsById, groupsById), [ou, dataSetsById, programsById, groupsById]);

  if (!orgUnitId) return null;
  if (err) {
    return (
      <ErrorBlock title="Couldn't load OU associations"
                   testId="ou-assoc-err">
        {err}
      </ErrorBlock>
    );
  }
  if (!ou || !dataSetsById || !programsById || !groupsById) {
    return <InlineLoading testId="ou-assoc-loading" />;
  }

  return (
    <div data-test="ou-assoc-root">
      {/* Meta strip: level, path */}
      <div style={{
             display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10,
             fontSize: 12, color: 'var(--der-text-muted, #6b7280)' }}>
        {typeof ou.level === 'number' && (
          <span>Level <strong style={{ color: 'var(--der-text, #0f172a)' }}>
            {String(ou.level)}
          </strong></span>
        )}
        {typeof ou.openingDate === 'string' && (
          <span>Opened <strong style={{ color: 'var(--der-text, #0f172a)' }}>
            {new Date(ou.openingDate).toLocaleDateString()}
          </strong></span>
        )}
        {ou.leaf === false && (
          <span className="ea-chip ea-chip--info">has children</span>
        )}
        {ou.leaf === true && (
          <span className="ea-chip ea-chip--muted">leaf</span>
        )}
      </div>

      <div style={{
             display: 'grid',
             gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
             gap: 10 }}>
        <AssocCard title="Data sets"
                   icon="aggregate"
                   count={rows.dataSets.length}
                   resource="dataSets"
                   items={rows.dataSets} />
        <AssocCard title="Programs"
                   icon="program"
                   count={rows.programs.length}
                   resource="programs"
                   items={rows.programs} />
        <AssocCard title="Groups"
                   icon="peer"
                   count={rows.groups.length}
                   resource="organisationUnitGroups"
                   items={rows.groups} />
      </div>

      {/* Children — the parent chain already renders as a breadcrumb
          on the main binding card, so no need to duplicate it here.
          Children on the other hand are new information. */}
      {rows.children.length > 0 && (
        <div style={{ marginTop: 14, fontSize: 12 }}
             data-test="ou-assoc-children">
          <strong style={{ fontSize: 12 }}>
            Children ({rows.children.length})
          </strong>
          <div style={{ marginTop: 6, display: 'flex',
                         flexWrap: 'wrap', gap: 4 }}>
            {rows.children.slice(0, 40).map((c) => (
              <span key={c.id}
                    className="ea-chip ea-chip--muted"
                    title={c.id}
                    style={{ fontSize: 11 }}>
                {c.name}
              </span>
            ))}
            {rows.children.length > 40 && (
              <span className="ea-text-muted" style={{ fontSize: 11 }}>
                … and {rows.children.length - 40} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AssocCard(
  { title, icon, count, resource, items }: {
    title: string;
    icon: Parameters<typeof UiIcon>[0]['icon'];
    count: number;
    resource: string;
    items: Array<{ id: string; name: string }>;
  },
): JSX.Element {
  return (
    <div className="ea-card"
         data-test={`ou-assoc-card-${resource}`}
         style={{
           border: '1px solid var(--der-border-soft, #e2e6ef)',
           borderRadius: 6,
           padding: 10,
           background: 'var(--der-surface, #fff)',
         }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                     marginBottom: 8 }}>
        <UiIcon icon={icon} size={14} />
        <strong style={{ fontSize: 13 }}>{title}</strong>
        <span className="ea-chip ea-chip--muted"
              style={{ fontSize: 11, marginLeft: 'auto' }}>
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="ea-text-muted" style={{ margin: 0, fontSize: 12 }}>
          None associated with this org unit.
        </p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none',
                      display: 'flex', flexDirection: 'column', gap: 4,
                      maxHeight: 260, overflowY: 'auto' }}>
          {items.map((it) => (
            <li key={it.id}
                data-test={`ou-assoc-item-${it.id}`}
                style={{ fontSize: 12,
                          display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <Link to={`/dhis2/metadata/${resource}/${encodeURIComponent(it.id)}`}
                    className="ea-link"
                    style={{ color: 'var(--der-text, #0f172a)',
                              textDecoration: 'none',
                              flex: 1 }}
                    title={it.id}>
                {it.name}
              </Link>
              <code style={{ fontSize: 10,
                              color: 'var(--der-text-muted, #6b7280)' }}>
                {it.id}
              </code>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function indexById(rows: Named[] | undefined): Map<string, Named> {
  const m = new Map<string, Named>();
  (rows ?? []).forEach((r) => m.set(r.id, r));
  return m;
}

function nameFor(id: string, cache: Map<string, Named>): string {
  const r = cache.get(id);
  return r?.displayName ?? r?.name ?? id;
}

interface ResolvedRows {
  dataSets: Array<{ id: string; name: string }>;
  programs: Array<{ id: string; name: string }>;
  groups: Array<{ id: string; name: string }>;
  ancestors: Array<{ id: string; name: string }>;
  children: Array<{ id: string; name: string }>;
  parent: { id: string; name: string } | null;
}

function resolveRows(ou: Record<string, unknown> | null,
                      ds: Map<string, Named> | null,
                      pr: Map<string, Named> | null,
                      g: Map<string, Named> | null): ResolvedRows {
  const empty: ResolvedRows = {
    dataSets: [], programs: [], groups: [],
    ancestors: [], children: [], parent: null,
  };
  if (!ou || !ds || !pr || !g) return empty;

  function mapRefs(arr: unknown, cache: Map<string, Named>): Array<{ id: string; name: string }> {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((it) => (typeof it === 'object' && it !== null
        ? String((it as { id?: string }).id ?? '') : ''))
      .filter((id) => id !== '')
      .map((id) => ({ id, name: nameFor(id, cache) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function resolveNamed(arr: unknown): Array<{ id: string; name: string }> {
    if (!Array.isArray(arr)) return [];
    return arr.map((it) => {
      if (typeof it !== 'object' || it === null) return { id: '', name: '' };
      const r = it as { id?: string; displayName?: string; name?: string };
      return { id: r.id ?? '', name: r.displayName ?? r.name ?? r.id ?? '' };
    }).filter((x) => x.id !== '');
  }

  const parentRaw = ou.parent as { id?: string; displayName?: string; name?: string } | undefined;
  const parent = parentRaw && parentRaw.id
    ? { id: parentRaw.id, name: parentRaw.displayName ?? parentRaw.name ?? parentRaw.id }
    : null;

  return {
    dataSets:  mapRefs(ou.dataSets, ds),
    programs:  mapRefs(ou.programs, pr),
    groups:    mapRefs(ou.organisationUnitGroups, g),
    ancestors: resolveNamed(ou.ancestors),
    children:  resolveNamed(ou.children),
    parent,
  };
}
