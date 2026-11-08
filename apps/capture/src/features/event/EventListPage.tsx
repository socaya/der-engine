import { useEffect, useMemo, useState } from 'react';
import type { CaptureApi, EventRow } from '../../shared/types';
import { RowActions } from '../../shared/RowActions';
import { navEvent } from '../../shared/routing';
import { openDatePicker } from '../../shared/openDatePicker';

/**
 * Event (WITHOUT_REGISTRATION) working-list page.
 *
 * <p>Columns are metadata-driven: for programs with a single stage
 * (the common event-program shape in DHIS2), we fetch the stage
 * form once and render the first few data-elements as table
 * columns with their display-name as the header. Operators see
 * actual case data at a glance instead of opaque UIDs, matching
 * the DHIS2 Capture working-list behaviour.</p>
 *
 * <p>Filters: free-text UID search, status (all / ACTIVE /
 * COMPLETED), and a from/to occurred-date range. All three
 * compose client-side. Server-side filtering by date range is a
 * follow-up when the edge endpoint grows the query params.</p>
 */
interface DerivedColumn {
  readonly dataElementUid: string;
  readonly label: string;
}

const MAX_METADATA_COLUMNS = 4;

/** Value types that read poorly in a dense table cell — we skip them
 *  from the metadata-driven column picker and let operators open the
 *  detail page to see them. Open follow-up (EV3): swap this allowlist
 *  for the authoritative {@code programStageDataElement.displayInList}
 *  flag once the metadata mirror ingests it. */
const UNRENDERABLE_IN_LIST = new Set([
  'LONG_TEXT', 'FILE_RESOURCE', 'IMAGE', 'COORDINATE', 'URL',
  'TRACKER_ASSOCIATE', 'ORGANISATION_UNIT',
]);

export function EventListPage(
  { api, programUid, orgUnitUid }: {
    api: CaptureApi; programUid: string;
    orgUnitUid: string;
  },
): JSX.Element {
  const stateKey = 'cap:ev-list:' + programUid + ':' + orgUnitUid;
  const [recent, setRecent] = useState<EventRow[]>([]);
  const [status, setStatus] =
    useState<'loading' | 'idle' | 'err'>('loading');
  const [metadataReady, setMetadataReady] = useState(true);
  const [query, setQuery] = useState<string>(() => {
    if (typeof sessionStorage === 'undefined') return '';
    return sessionStorage.getItem(stateKey) ?? '';
  });
  const [statusFilter, setStatusFilter] =
    useState<'all' | 'ACTIVE' | 'COMPLETED'>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [columns, setColumns] =
    useState<ReadonlyArray<DerivedColumn>>([]);
  /** Row-view column sort — clicking a header toggles the column
   *  between unsorted → asc → desc → unsorted. Key is either the
   *  special 'date' / 'status' literals or a dataElementUid. */
  const [sort, setSort] = useState<null | {
    key: string; direction: 'asc' | 'desc';
  }>(null);
  /** Checked event UIDs for bulk operations. */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Row density — mirrors Data Entry's compact/comfortable
   *  toggle. Persisted across sessions in localStorage under a
   *  shared key so one preference applies to every working list
   *  (event + tracker) — operators flip once, every table
   *  follows. */
  const [density, setDensity] =
    useState<'compact' | 'comfortable'>(() => {
      if (typeof localStorage === 'undefined') return 'compact';
      const v = localStorage.getItem('cap:list:density');
      return v === 'comfortable' ? 'comfortable' : 'compact';
    });
  /** Pagination — page is 1-based so the pager labels read
   *  naturally ("Page 1 of N"). Page size defaults to 25 to
   *  match the DHIS2 Capture default; persisted per-browser
   *  under a shared key (see density above for rationale). */
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof localStorage === 'undefined') return 25;
    const raw = localStorage.getItem('cap:list:pagesize');
    const n = raw ? parseInt(raw, 10) : NaN;
    return n === 10 || n === 25 || n === 50 || n === 100 ? n : 25;
  });
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(stateKey, query);
  }, [query, stateKey]);
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('cap:list:density', density);
  }, [density]);
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('cap:list:pagesize', String(pageSize));
  }, [pageSize]);

  // Load events + derive columns from the program's stage(s).
  // Event programs typically have exactly one stage; when a
  // program has multiple stages the first stage's fields drive
  // the columns and events from other stages fall back to "—"
  // in those columns (operator can open the row for full detail).
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setMetadataReady(true);
    setColumns([]);
    (async () => {
      try {
        // Parallel: event list + stage list.
        const [evRes, stageRes] = await Promise.all([
          api.listCaptureProgramEvents(programUid, orgUnitUid, 100),
          api.listCaptureProgramStages(programUid),
        ]);
        if (cancelled) return;
        setRecent(evRes.events ?? []);
        setStatus('idle');

        const firstStage = stageRes.stages[0];
        if (firstStage) {
          const form = await api.getCaptureStageForm(programUid,
            firstStage.stageUid);
          if (cancelled) return;
          const derived: DerivedColumn[] = [];
          for (const s of form.sections) {
            for (const f of s.fields) {
              if (UNRENDERABLE_IN_LIST.has(f.valueType ?? '')) continue;
              derived.push({
                dataElementUid: f.dataElementUid,
                label: f.dataElementDisplayName
                  ?? f.dataElementUid.slice(0, 8),
              });
              if (derived.length >= MAX_METADATA_COLUMNS) break;
            }
            if (derived.length >= MAX_METADATA_COLUMNS) break;
          }
          setColumns(derived);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = (err as Error).message ?? '';
          if (/METADATA_NOT_READY|not mirrored/.test(msg)) {
            setMetadataReady(false);
            setStatus('idle');
          } else {
            setRecent([]); setStatus('err');
          }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [programUid, orgUnitUid]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = fromDate.trim();
    const to = toDate.trim();
    const rows = recent.filter((e) => {
      const uid = (e.eventUid ?? e.event ?? '').toLowerCase();
      if (q !== '' && !uid.includes(q)) {
        // Allow matching value text too — operators often search
        // for a name or code that lives inside a dataValue, not
        // the event UID.
        const values = Object.values(e.dataValues ?? {})
          .join(' ').toLowerCase();
        if (!values.includes(q)) return false;
      }
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      const occurred = (e.occurredDate ?? e.occurredAt
        ?? e.eventDate ?? '').slice(0, 10);
      if (from !== '' && occurred !== '' && occurred < from) return false;
      if (to !== '' && occurred !== '' && occurred > to) return false;
      return true;
    });
    if (!sort) return rows;
    const dir = sort.direction === 'desc' ? -1 : 1;
    function val(e: EventRow): string {
      if (sort!.key === 'date') {
        return (e.occurredDate ?? e.occurredAt
          ?? e.eventDate ?? '').slice(0, 10);
      }
      if (sort!.key === 'status') return e.status ?? '';
      return (e.dataValues?.[sort!.key] ?? '').toString();
    }
    const sorted = [...rows].sort((a, b) => {
      const va = val(a); const vb = val(b);
      if (va === '' && vb === '') return 0;
      if (va === '') return 1;
      if (vb === '') return -1;
      return va.localeCompare(vb, undefined, { numeric: true }) * dir;
    });
    return sorted;
  }, [recent, query, statusFilter, fromDate, toDate, sort]);

  // Reset to the first page whenever the filter or sort set
  // changes — otherwise operators sitting on page 3 would see an
  // empty table after narrowing a filter down to five rows.
  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, fromDate, toDate, sort, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, filtered.length);
  const pageRows = filtered.slice(pageStart, pageEnd);

  function toggleSort(key: string): void {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  }
  function sortGlyphFor(key: string): string {
    if (!sort || sort.key !== key) return '↕';
    return sort.direction === 'asc' ? '↑' : '↓';
  }

  /** Download the currently filtered + sorted events as a CSV.
   *  Columns: Event UID, Date, Status, + every metadata-driven
   *  column header the list is currently rendering. */
  function exportCsv(): void {
    const header = ['Event UID', 'Date', 'Status',
      ...columns.map((c) => c.label)];
    const esc = (s: string): string => {
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const lines = [header.map(esc).join(',')];
    for (const e of filtered) {
      const uid = e.eventUid ?? e.event ?? '';
      const when = (e.occurredDate ?? e.occurredAt
        ?? e.eventDate ?? '').slice(0, 10);
      const row = [uid, when, e.status ?? ''];
      for (const c of columns) {
        row.push(e.dataValues?.[c.dataElementUid] ?? '');
      }
      lines.push(row.map(esc).join(','));
    }
    const csv = lines.join('\n');
    const blob = new Blob([csv],
      { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'events-' + programUid + '-'
      + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const activeFilterCount =
    (query.trim() !== '' ? 1 : 0)
    + (statusFilter !== 'all' ? 1 : 0)
    + (fromDate !== '' ? 1 : 0)
    + (toDate !== '' ? 1 : 0);

  if (!metadataReady) {
    return (
      <div className="cap-strip cap-strip--warn"
           data-test="ce-metadata-not-ready">
        <strong>Program metadata hasn't been synced to this
          edge yet.</strong>{' '}
        The event working list can't render until an administrator
        runs a metadata sync.
      </div>
    );
  }

  return (
    <>
      {/* Filter row — labelled inputs stacked under short labels,
       *  so the row scans like a header + controls instead of a
       *  dense toolbar strip. */}
      <div className="cap-section-head" data-test="ev-list-head">
        <h2 className="cap-section-head__title">Events</h2>
        <span className="cap-section-head__count">
          {status === 'loading' ? 'loading…'
            : status === 'err' ? 'failed to load'
            : activeFilterCount > 0
              ? `${filtered.length} of ${recent.length} shown`
              : recent.length === 0 ? 'none yet'
              : `${recent.length} loaded`}
        </span>
        <span className="cap-section-head__rule" />
        <div className="cap-view-toggle" role="group"
             aria-label="Event view mode" data-test="ev-view-toggle">
          <button type="button"
                  className="cap-view-toggle--active"
                  data-test="ev-view-rows"
                  aria-pressed="true"
                  title="Row view — one event per row with details">
            Rows
          </button>
          <button type="button"
                  data-test="ev-view-sheet"
                  aria-pressed="false"
                  title="Spreadsheet mode — all events on a single grid, cells save as you type"
                  onClick={() => navEvent.sheet(programUid)}>
            Sheet
          </button>
        </div>
        <button type="button"
                className="cap-density-btn"
                data-test="ev-density-toggle"
                aria-label={'Switch to '
                  + (density === 'compact' ? 'comfortable' : 'compact')
                  + ' density'}
                title={'Density: ' + density + '. Click to switch.'}
                onClick={() => setDensity(
                  (d) => d === 'compact' ? 'comfortable' : 'compact')}>
          {density === 'compact' ? '⇔ Compact' : '⇕ Comfortable'}
        </button>
        <button type="button"
                className="cap-btn cap-btn--secondary"
                data-test="ev-export-csv"
                style={{ padding: '4px 10px', fontSize: 12 }}
                title="Download the filtered + sorted list as CSV"
                disabled={filtered.length === 0}
                onClick={exportCsv}>
          Export CSV
        </button>
        <button type="button"
                className="cap-btn cap-btn--primary"
                data-test="ev-new"
                title="Open the new-event form"
                onClick={() => navEvent.create(programUid)}>
          + New event
        </button>
      </div>
      {selected.size > 0 && (
        <div className="cap-strip cap-strip--info"
             data-test="ev-bulk-bar"
             style={{ display: 'flex', alignItems: 'center',
               gap: 10, margin: '0 14px 10px' }}>
          <strong style={{ flex: 1 }}>
            {selected.size} selected
          </strong>
          <button type="button"
                  className="cap-btn cap-btn--secondary"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  data-test="ev-bulk-clear"
                  onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
          <button type="button"
                  className="cap-btn cap-btn--secondary"
                  style={{ padding: '4px 10px', fontSize: 12,
                    color: 'var(--der-danger)',
                    borderColor: 'var(--der-danger)' }}
                  data-test="ev-bulk-delete"
                  onClick={() => {
                    // eslint-disable-next-line no-alert
                    if (!confirm('Delete ' + selected.size
                        + ' event' + (selected.size === 1 ? '' : 's')
                        + '?\n\nMirrors DHIS2 '
                        + 'DELETE /api/events/{id} per row.')) {
                      return;
                    }
                    void (async () => {
                      const errs: string[] = [];
                      for (const uid of [...selected]) {
                        try { await api.deleteEvent(uid); }
                        catch (err) {
                          errs.push(uid + ': '
                            + ((err as Error).message
                              ?? 'unknown'));
                        }
                      }
                      setRecent((prev) => prev.filter(
                        (r) => !selected.has(
                          r.eventUid ?? r.event ?? '')));
                      setSelected(new Set());
                      if (errs.length > 0) {
                        // eslint-disable-next-line no-alert
                        alert('Some deletes failed:\n'
                          + errs.join('\n'));
                      }
                    })();
                  }}>
            Delete {selected.size} selected
          </button>
        </div>
      )}

      <div className="cap-filter-row" data-test="ev-filter-row">
        <label className="cap-input">
          <span className="cap-input__label">Search</span>
          <input className="cap-input__ctl" type="search"
                 value={query}
                 onChange={(e) => setQuery(e.target.value)}
                 placeholder="Event UID or value text"
                 data-test="ev-search-input" />
        </label>
        <label className="cap-input">
          <span className="cap-input__label">Status</span>
          <select className="cap-input__ctl"
                  value={statusFilter}
                  data-test="ev-status-filter"
                  onChange={(e) => setStatusFilter(
                    e.target.value as typeof statusFilter)}>
            <option value="all">All</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </label>
        <label className="cap-input">
          <span className="cap-input__label">From</span>
          <input className="cap-input__ctl" type="date"
                 value={fromDate}
                 onChange={(e) => setFromDate(e.target.value)}
                 onClick={openDatePicker}
                 data-test="ev-from-date" />
        </label>
        <label className="cap-input">
          <span className="cap-input__label">To</span>
          <input className="cap-input__ctl" type="date"
                 value={toDate}
                 onChange={(e) => setToDate(e.target.value)}
                 onClick={openDatePicker}
                 data-test="ev-to-date" />
        </label>
        {activeFilterCount > 0 && (
          <button type="button"
                  className="cap-btn cap-btn--secondary"
                  data-test="ev-clear-filters"
                  style={{ padding: '4px 10px', fontSize: 12,
                    alignSelf: 'flex-end' }}
                  onClick={() => { setQuery('');
                    setStatusFilter('all');
                    setFromDate(''); setToDate(''); }}>
            Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="cap-sub" style={{ marginLeft: 14 }}>
          {status === 'loading'
            ? 'Fetching events…'
            : status === 'err'
            ? 'The edge mirror could not be reached. Check the '
              + 'connection and retry.'
            : activeFilterCount > 0
            ? 'No events match these filters.'
            : 'No events recorded for this program at this '
              + 'organisation unit yet.'}
        </p>
      ) : columns.length === 0 ? (
        // Fallback: no stage metadata yet → keep the UID+status+date
        // row layout.
        <ul className="cap-list" data-test="ev-list">
          {pageRows.map((e, i) => renderBasicRow(programUid, e, i))}
        </ul>
      ) : (
        <div className="cap-table-wrap" data-test="ev-list">
          <table className={'cap-table cap-table--' + density}
                 data-test="ev-list-table">
            <thead>
              <tr>
                <th scope="col" style={{ width: 28 }}>
                  <input type="checkbox"
                         data-test="ev-list-select-all"
                         aria-label="Select every event"
                         checked={filtered.length > 0
                           && filtered.every((e) => selected.has(
                             e.eventUid ?? e.event ?? ''))}
                         onChange={(ev) => {
                           if (ev.target.checked) {
                             setSelected(new Set(filtered.map(
                               (e) => e.eventUid ?? e.event ?? '')
                               .filter((u) => u !== '')));
                           } else {
                             setSelected(new Set());
                           }
                         }} />
                </th>
                <th scope="col">
                  <button type="button"
                          className="cap-table__sortbtn"
                          data-test="ev-list-sort-date"
                          onClick={() => toggleSort('date')}>
                    Date <span aria-hidden="true">
                      {sortGlyphFor('date')}
                    </span>
                  </button>
                </th>
                {columns.map((c) => (
                  <th key={c.dataElementUid} scope="col"
                      title={c.dataElementUid}>
                    <button type="button"
                            className="cap-table__sortbtn"
                            data-test={'ev-list-sort-'
                              + c.dataElementUid}
                            onClick={() =>
                              toggleSort(c.dataElementUid)}>
                      {c.label} <span aria-hidden="true">
                        {sortGlyphFor(c.dataElementUid)}
                      </span>
                    </button>
                  </th>
                ))}
                <th scope="col">
                  <button type="button"
                          className="cap-table__sortbtn"
                          data-test="ev-list-sort-status"
                          onClick={() => toggleSort('status')}>
                    Status <span aria-hidden="true">
                      {sortGlyphFor('status')}
                    </span>
                  </button>
                </th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((e, i) => {
                const uid = e.eventUid ?? e.event ?? ('row-' + i);
                const when = e.occurredDate ?? e.occurredAt
                  ?? e.eventDate ?? '—';
                const checked = selected.has(uid);
                return (
                  <tr key={uid + i}
                      className={'cap-table__row'
                        + (checked ? ' cap-table__row--selected' : '')}
                      data-test={'ev-row-' + uid}
                      tabIndex={0}
                      role="button"
                      onClick={() => navEvent.detail(programUid, uid)}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault();
                          navEvent.detail(programUid, uid);
                        }
                      }}>
                    <td className="cap-table__cell"
                        onClick={(ev) => ev.stopPropagation()}>
                      <input type="checkbox"
                             data-test={'ev-row-check-' + uid}
                             aria-label="Select event"
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
                    <td className="cap-table__cell cap-table__cell--date">
                      {when.slice(0, 10)}
                    </td>
                    {columns.map((c) => {
                      const v = e.dataValues?.[c.dataElementUid];
                      return (
                        <td key={c.dataElementUid}
                            className="cap-table__cell">
                          {v && v.trim() !== '' ? v
                            : <span className="cap-table__empty">—</span>}
                        </td>
                      );
                    })}
                    <td className="cap-table__cell">
                      {renderStatusPill(e.status)}
                    </td>
                    <td className="cap-table__cell cap-table__cell--actions"
                        onClick={(ev) => ev.stopPropagation()}>
                      <RowActions
                        label="Event actions"
                        dataTest={'ev-row-actions-' + uid}
                        actions={[
                          { label: 'Open details',
                            onSelect: () => navEvent.detail(programUid, uid) },
                          { label: 'Edit event',
                            onSelect: () => navEvent.edit(programUid, uid) },
                          { label: 'Copy UID',
                            disabled: typeof navigator === 'undefined'
                              || !navigator.clipboard,
                            onSelect: () => {
                              navigator.clipboard?.writeText(uid)
                                .catch(() => undefined);
                            } },
                          { label: 'Delete event',
                            title: 'Remove this event from the edge '
                              + 'immediately. Mirrors DHIS2 '
                              + 'DELETE /api/events/{id}.',
                            onSelect: () => {
                              // eslint-disable-next-line no-alert
                              if (!confirm('Delete event ' + uid.slice(0, 8)
                                  + '…?\n\nThis removes the event from the '
                                  + 'edge immediately; central sync '
                                  + 'follows on the next drain.')) {
                                return;
                              }
                              void (async () => {
                                try {
                                  await api.deleteEvent(uid);
                                  setRecent((prev) => prev.filter(
                                    (r) => (r.eventUid ?? r.event) !== uid));
                                } catch (err) {
                                  // eslint-disable-next-line no-alert
                                  alert('Delete failed: '
                                    + ((err as Error).message
                                      ?? 'unknown error'));
                                }
                              })();
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
      {filtered.length > 0 && (
        <div className="cap-pager" data-test="ev-pager">
          <span data-test="ev-pager-range">
            {filtered.length === 0
              ? '0 of 0'
              : `${pageStart + 1}–${pageEnd} of ${filtered.length}`}
          </span>
          <label style={{ display: 'flex', alignItems: 'center',
                          gap: 6 }}>
            Rows per page
            <select className="cap-pager__pagesize"
                    data-test="ev-pager-pagesize"
                    value={pageSize}
                    onChange={(ev) => setPageSize(
                      parseInt(ev.target.value, 10))}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <span className="cap-pager__spacer" />
          <button type="button" className="cap-pager__btn"
                  data-test="ev-pager-first"
                  aria-label="First page"
                  disabled={safePage === 1}
                  onClick={() => setPage(1)}>«</button>
          <button type="button" className="cap-pager__btn"
                  data-test="ev-pager-prev"
                  aria-label="Previous page"
                  disabled={safePage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ‹
          </button>
          <span data-test="ev-pager-page">
            Page {safePage} of {pageCount}
          </span>
          <button type="button" className="cap-pager__btn"
                  data-test="ev-pager-next"
                  aria-label="Next page"
                  disabled={safePage === pageCount}
                  onClick={() => setPage(
                    (p) => Math.min(pageCount, p + 1))}>
            ›
          </button>
          <button type="button" className="cap-pager__btn"
                  data-test="ev-pager-last"
                  aria-label="Last page"
                  disabled={safePage === pageCount}
                  onClick={() => setPage(pageCount)}>»</button>
        </div>
      )}
    </>
  );
}

function renderStatusPill(status: string | null | undefined): JSX.Element {
  if (!status) return <span className="cap-table__empty">—</span>;
  return (
    <span className={'cap-status cap-status--'
        + (status === 'COMPLETED' ? 'ok' : 'active')}>
      {status === 'COMPLETED' ? 'Completed' : 'Active'}
    </span>
  );
}

function renderBasicRow(programUid: string, e: EventRow,
    i: number): JSX.Element | null {
  const uid = e.eventUid ?? e.event ?? '';
  if (!uid) return null;
  return (
    <li key={uid + i}
        className="cap-list__row cap-list__row--clickable"
        data-test={'ev-row-' + uid}
        role="button" tabIndex={0}
        onClick={() => navEvent.detail(programUid, uid)}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            navEvent.detail(programUid, uid);
          }
        }}>
      <div>
        <code>{uid}</code>
        {e.status && renderStatusPill(e.status)}
      </div>
      <span className="cap-list__when">
        {e.occurredDate ?? e.occurredAt ?? e.eventDate ?? '—'}
      </span>
    </li>
  );
}
