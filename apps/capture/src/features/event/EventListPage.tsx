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

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(stateKey, query);
  }, [query, stateKey]);

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
    return recent.filter((e) => {
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
  }, [recent, query, statusFilter, fromDate, toDate]);

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
                className="cap-btn cap-btn--primary"
                data-test="ev-new"
                title="Open the new-event form"
                onClick={() => navEvent.create(programUid)}>
          + New event
        </button>
      </div>

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
          {filtered.map((e, i) => renderBasicRow(programUid, e, i))}
        </ul>
      ) : (
        <div className="cap-table-wrap" data-test="ev-list">
          <table className="cap-table" data-test="ev-list-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                {columns.map((c) => (
                  <th key={c.dataElementUid} scope="col"
                      title={c.dataElementUid}>
                    {c.label}
                  </th>
                ))}
                <th scope="col">Status</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => {
                const uid = e.eventUid ?? e.event ?? ('row-' + i);
                const when = e.occurredDate ?? e.occurredAt
                  ?? e.eventDate ?? '—';
                return (
                  <tr key={uid + i}
                      className="cap-table__row"
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
