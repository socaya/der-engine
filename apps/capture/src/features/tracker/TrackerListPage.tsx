import { useEffect, useMemo, useState } from 'react';
import type { CaptureApi } from '../../shared/types';
import { RowActions } from '../../shared/RowActions';
import { navTracker } from '../../shared/routing';

interface TeiRow {
  readonly trackedEntity?: string;
  readonly trackedEntityInstance?: string;
  readonly displayName?: string;
  readonly lastUpdated?: string;
  readonly attributes?: Record<string, string>;
}

interface DerivedColumn {
  readonly attrUid: string;
  readonly label: string;
}

const MAX_METADATA_COLUMNS = 4;

/** Value types that read poorly in a dense table cell — skip from
 *  the metadata-driven column picker and let operators open the
 *  detail page to see them. */
const UNRENDERABLE_IN_LIST = new Set([
  'LONG_TEXT', 'FILE_RESOURCE', 'IMAGE', 'COORDINATE', 'URL',
  'ORGANISATION_UNIT',
]);

/**
 * Tracker working-list page (NAV-001). Full-page route: list only,
 * no inline registration form, no inline detail. "Register new"
 * routes to {@code #/tracker/:programId/register}; opening a row
 * routes to {@code #/tracker/:programId/records/:teiId}.
 *
 * <p>Columns are metadata-driven: the program's tracked-entity
 * attributes (picked by sortOrder, skipping unrenderable types)
 * form the data columns. Sortable headers + CSV export + row
 * checkboxes mirror the Event ROW-FINAL contract so operators
 * get one muscle memory across both program kinds.</p>
 *
 * <p>Working-list state (query, scroll) is held locally and
 * restored from {@code sessionStorage} per NAV-006 so the list
 * looks unchanged when the operator returns via Back.</p>
 */
export function TrackerListPage(
  { api, programUid, orgUnitUid }: {
    api: CaptureApi; programUid: string;
    orgUnitUid: string;
  },
): JSX.Element {
  const stateKey = 'cap:tr-list:' + programUid + ':' + orgUnitUid;
  const [rows, setRows] = useState<TeiRow[]>([]);
  const [listStatus, setListStatus] =
    useState<'idle' | 'loading' | 'err'>('idle');
  const [query, setQuery] = useState<string>(() => {
    if (typeof sessionStorage === 'undefined') return '';
    return sessionStorage.getItem(stateKey) ?? '';
  });
  const [metadataReady, setMetadataReady] = useState(true);
  const [tetUid, setTetUid] = useState<string | null>(null);
  const [regFieldCount, setRegFieldCount] = useState(0);
  const [columns, setColumns] =
    useState<ReadonlyArray<DerivedColumn>>([]);
  const [sort, setSort] = useState<null | {
    key: string; direction: 'asc' | 'desc';
  }>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(stateKey, query);
  }, [query, stateKey]);

  useEffect(() => {
    let cancelled = false;
    setListStatus('loading');
    setMetadataReady(true);
    setSelected(new Set());
    (async () => {
      try {
        const [listRes, tetRes] = await Promise.all([
          api.listTrackerEntities(programUid, orgUnitUid, 100),
          api.getCaptureProgramTeiType(programUid),
        ]);
        if (cancelled) return;
        setRows(listRes.trackedEntities ?? listRes.instances ?? []);
        setListStatus('idle');
        const tet = tetRes?.trackedEntityTypeUid ?? null;
        setTetUid(tet);
        if (tet) {
          const attrs = await api.listCaptureTeiTypeAttributes(tet);
          if (cancelled) return;
          setRegFieldCount(attrs.attributes.length);
          const sorted = [...attrs.attributes].sort(
            (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          const derived: DerivedColumn[] = [];
          for (const a of sorted) {
            if (UNRENDERABLE_IN_LIST.has(a.valueType ?? '')) continue;
            derived.push({ attrUid: a.attributeUid,
              label: a.displayName ?? a.attributeUid });
            if (derived.length >= MAX_METADATA_COLUMNS) break;
          }
          setColumns(derived);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = (err as Error).message ?? '';
          if (/METADATA_NOT_READY|not mirrored/.test(msg)) {
            setMetadataReady(false);
            setListStatus('idle');
          } else {
            setRows([]); setListStatus('err');
          }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [programUid, orgUnitUid]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = rows.filter((r) => {
      if (q === '') return true;
      const uid = (r.trackedEntity ?? r.trackedEntityInstance ?? '')
        .toLowerCase();
      const name = (r.displayName ?? '').toLowerCase();
      if (uid.includes(q) || name.includes(q)) return true;
      // Also search attribute values so operators can find a TEI by
      // any value visible in the row, not just the display label.
      const vals = Object.values(r.attributes ?? {})
        .join(' ').toLowerCase();
      return vals.includes(q);
    });
    if (!sort) return matched;
    const dir = sort.direction === 'desc' ? -1 : 1;
    const key = sort.key;
    function val(r: TeiRow): string {
      if (key === 'uid') return (r.trackedEntity
        ?? r.trackedEntityInstance ?? '').toString();
      if (key === 'updated') return r.lastUpdated ?? '';
      return (r.attributes?.[key] ?? '').toString();
    }
    return [...matched].sort((a, b) => {
      const va = val(a); const vb = val(b);
      if (va === '' && vb === '') return 0;
      if (va === '') return 1;
      if (vb === '') return -1;
      return va.localeCompare(vb,
        undefined, { numeric: true }) * dir;
    });
  }, [rows, query, sort]);

  function toggleSort(key: string): void {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  }
  function sortGlyph(key: string): string {
    if (!sort || sort.key !== key) return '↕';
    return sort.direction === 'asc' ? '↑' : '↓';
  }

  function exportCsv(): void {
    const header = ['TEI UID', 'Display name',
      ...columns.map((c) => c.label), 'Last updated'];
    const esc = (s: string): string => {
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const lines = [header.map(esc).join(',')];
    for (const r of filtered) {
      const uid = r.trackedEntity ?? r.trackedEntityInstance ?? '';
      const row = [uid, r.displayName ?? ''];
      for (const c of columns) {
        row.push(r.attributes?.[c.attrUid] ?? '');
      }
      row.push(r.lastUpdated ?? '');
      lines.push(row.map(esc).join(','));
    }
    const blob = new Blob([lines.join('\n')],
      { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tracked-entities-' + programUid + '-'
      + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (!metadataReady) {
    return (
      <div className="cap-strip cap-strip--warn"
           data-test="tr-metadata-not-ready">
        <strong>Program metadata hasn't been synced to this
          edge yet.</strong>{' '}
        The tracker working list can't render until an administrator
        runs a metadata sync (§MD-008).
      </div>
    );
  }

  const registerDisabled = tetUid == null || regFieldCount === 0;

  return (
    <>
      <div className="cap-section-head" data-test="tr-list-head">
        <h2 className="cap-section-head__title">Tracked entities</h2>
        <label className="cap-input" style={{ minWidth: 220 }}>
          <span className="cap-toolbar__field-label">Search</span>
          <input className="cap-input__ctl" type="search"
                 value={query}
                 onChange={(e) => setQuery(e.target.value)}
                 placeholder="UID, name, or any value… (Alt+F)"
                 data-test="tr-search-input" />
        </label>
        <span className="cap-section-head__count">
          {listStatus === 'loading' ? 'loading…'
            : listStatus === 'err' ? 'failed to load'
            : query !== ''
              ? `${filtered.length} of ${rows.length} shown`
              : rows.length === 0 ? 'none yet'
              : `${rows.length} loaded`}
        </span>
        <span className="cap-section-head__rule" />
        <button type="button"
                className="cap-btn cap-btn--secondary"
                data-test="tr-export-csv"
                style={{ padding: '4px 10px', fontSize: 12 }}
                disabled={filtered.length === 0}
                onClick={exportCsv}>
          Export CSV
        </button>
        <button type="button"
                className="cap-btn cap-btn--primary"
                data-test="tr-register-open"
                disabled={registerDisabled}
                title={tetUid == null
                  ? 'This program has no tracked-entity type assigned'
                  : regFieldCount === 0
                  ? 'No registration attributes are configured'
                  : query.trim() === ''
                  ? 'Search existing records first to avoid duplicates '
                    + '(TR-002). Opens the registration form.'
                    : 'Register a new tracked entity'}
                onClick={() => navTracker.register(programUid)}>
          Register new
        </button>
      </div>

      {selected.size > 0 && (
        <div className="cap-strip cap-strip--info"
             data-test="tr-bulk-bar"
             style={{ display: 'flex', alignItems: 'center',
               gap: 10, margin: '0 14px 10px' }}>
          <strong style={{ flex: 1 }}>
            {selected.size} selected
          </strong>
          <button type="button"
                  className="cap-btn cap-btn--secondary"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  data-test="tr-bulk-copy-uids"
                  disabled={typeof navigator === 'undefined'
                    || !navigator.clipboard}
                  onClick={() => {
                    const uids = [...selected].join('\n');
                    navigator.clipboard?.writeText(uids)
                      .catch(() => undefined);
                  }}>
            Copy UIDs
          </button>
          <button type="button"
                  className="cap-btn cap-btn--secondary"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  data-test="tr-bulk-clear"
                  onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="cap-sub" style={{ marginLeft: 14 }}>
          {listStatus === 'loading'
            ? 'Fetching tracked entities assigned to your OU…'
            : listStatus === 'err'
            ? 'The tracker mirror could not be reached. Check the '
              + 'edge connection and retry.'
            : query !== ''
            ? 'No tracked entities match this search. Pre-registration '
              + 'duplicate check is intentional (TR-002).'
            : 'No tracked entities yet for this program at this '
              + 'organisation unit.'}
        </p>
      ) : columns.length === 0 ? (
        <ul className="cap-list" data-test="tr-tei-list">
          {filtered.map((r, i) => renderBasicRow(programUid, r, i))}
        </ul>
      ) : (
        <div className="cap-table-wrap" data-test="tr-tei-list">
          <table className="cap-table" data-test="tr-tei-table">
            <thead>
              <tr>
                <th scope="col" style={{ width: 28 }}>
                  <input type="checkbox"
                         data-test="tr-list-select-all"
                         aria-label="Select every tracked entity"
                         checked={filtered.length > 0
                           && filtered.every((r) => selected.has(
                             r.trackedEntity
                             ?? r.trackedEntityInstance ?? ''))}
                         onChange={(ev) => {
                           if (ev.target.checked) {
                             setSelected(new Set(filtered.map((r) =>
                               r.trackedEntity
                               ?? r.trackedEntityInstance ?? '')
                               .filter((u) => u !== '')));
                           } else {
                             setSelected(new Set());
                           }
                         }} />
                </th>
                <th scope="col">
                  <button type="button"
                          className="cap-table__sortbtn"
                          data-test="tr-list-sort-uid"
                          onClick={() => toggleSort('uid')}>
                    UID <span aria-hidden="true">
                      {sortGlyph('uid')}
                    </span>
                  </button>
                </th>
                {columns.map((c) => (
                  <th key={c.attrUid} scope="col"
                      title={c.attrUid}>
                    <button type="button"
                            className="cap-table__sortbtn"
                            data-test={'tr-list-sort-' + c.attrUid}
                            onClick={() => toggleSort(c.attrUid)}>
                      {c.label} <span aria-hidden="true">
                        {sortGlyph(c.attrUid)}
                      </span>
                    </button>
                  </th>
                ))}
                <th scope="col">
                  <button type="button"
                          className="cap-table__sortbtn"
                          data-test="tr-list-sort-updated"
                          onClick={() => toggleSort('updated')}>
                    Last updated <span aria-hidden="true">
                      {sortGlyph('updated')}
                    </span>
                  </button>
                </th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const uid = r.trackedEntity
                  ?? r.trackedEntityInstance ?? ('row-' + i);
                const checked = selected.has(uid);
                return (
                  <tr key={uid + i}
                      className={'cap-table__row'
                        + (checked ? ' cap-table__row--selected'
                          : '')}
                      data-test={'tr-tei-row-' + uid}
                      tabIndex={0}
                      role="button"
                      onClick={() => navTracker.detail(programUid,
                        uid)}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault();
                          navTracker.detail(programUid, uid);
                        }
                      }}>
                    <td className="cap-table__cell"
                        onClick={(ev) => ev.stopPropagation()}>
                      <input type="checkbox"
                             data-test={'tr-row-check-' + uid}
                             aria-label="Select tracked entity"
                             checked={checked}
                             onChange={(ev) => {
                               setSelected((prev) => {
                                 const next = new Set(prev);
                                 if (ev.target.checked) next.add(uid);
                                 else next.delete(uid);
                                 return next;
                               });
                             }} />
                    </td>
                    <td className="cap-table__cell">
                      <code>{uid}</code>
                      {r.displayName && (
                        <span style={{ marginLeft: 8,
                          color: 'var(--der-text-muted)' }}>
                          {r.displayName}
                        </span>
                      )}
                    </td>
                    {columns.map((c) => {
                      const v = r.attributes?.[c.attrUid];
                      return (
                        <td key={c.attrUid}
                            className="cap-table__cell">
                          {v && v.trim() !== '' ? v
                            : <span className="cap-table__empty">
                                —
                              </span>}
                        </td>
                      );
                    })}
                    <td className="cap-table__cell
                        cap-table__cell--date">
                      {r.lastUpdated ?? '—'}
                    </td>
                    <td className="cap-table__cell
                        cap-table__cell--actions"
                        onClick={(ev) => ev.stopPropagation()}>
                      <RowActions
                        label="Tracked entity actions"
                        dataTest={'tr-tei-actions-' + uid}
                        actions={[
                          { label: 'Open dashboard',
                            title: 'Open this tracked entity\'s '
                              + 'enrolments + stage events detail '
                              + 'page.',
                            onSelect: () => navTracker.detail(
                              programUid, uid) },
                          { label: 'Copy UID',
                            disabled: typeof navigator === 'undefined'
                              || !navigator.clipboard,
                            title: 'Copy this tracked-entity UID to '
                              + 'the clipboard for sharing with '
                              + 'admins.',
                            onSelect: () => {
                              navigator.clipboard?.writeText(uid)
                                .catch(() => undefined);
                            } },
                        ]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function renderBasicRow(programUid: string, r: TeiRow,
    i: number): JSX.Element | null {
  const uid = r.trackedEntity ?? r.trackedEntityInstance
    ?? ('row-' + i);
  return (
    <li key={uid + i}
        className="cap-list__row cap-list__row--clickable"
        data-test={'tr-tei-row-' + uid}
        onClick={() => navTracker.detail(programUid, uid)}
        role="button" tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navTracker.detail(programUid, uid);
          }
        }}>
      <div>
        <code>{uid}</code>
        {r.displayName && (
          <span style={{ marginLeft: 10 }}>{r.displayName}</span>
        )}
      </div>
      <span className="cap-list__when">{r.lastUpdated ?? '—'}</span>
    </li>
  );
}
