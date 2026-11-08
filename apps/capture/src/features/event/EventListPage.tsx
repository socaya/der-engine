import { useEffect, useMemo, useState } from 'react';
import type { CaptureApi, EventRow } from '../../shared/types';
import { RowActions } from '../../shared/RowActions';
import { navEvent } from '../../shared/routing';

/**
 * Event (WITHOUT_REGISTRATION) working-list page (NAV-001). Full
 * page: recent events + filter + "New event" action that routes
 * to the dedicated form page. No inline form here.
 */
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

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(stateKey, query);
  }, [query, stateKey]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setMetadataReady(true);
    (async () => {
      try {
        const r = await api.listCaptureProgramEvents(programUid,
          orgUnitUid, 100);
        if (cancelled) return;
        setRecent(r.events ?? []);
        setStatus('idle');
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
    return recent.filter((e) => {
      const uid = (e.eventUid ?? e.event ?? '').toLowerCase();
      if (q !== '' && !uid.includes(q)) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      return true;
    });
  }, [recent, query, statusFilter]);

  if (!metadataReady) {
    return (
      <div className="cap-strip cap-strip--warn"
           data-test="ce-metadata-not-ready">
        <strong>Program metadata hasn't been synced to this
          edge yet.</strong>{' '}
        The event working list can't render until an administrator
        runs a metadata sync (§MD-008).
      </div>
    );
  }

  return (
    <>
      <div className="cap-section-head" data-test="ev-list-head">
        <h2 className="cap-section-head__title">Events</h2>
        <label className="cap-input" style={{ minWidth: 200 }}>
          <span className="cap-toolbar__field-label">Search</span>
          <input className="cap-input__ctl" type="search"
                 value={query}
                 onChange={(e) => setQuery(e.target.value)}
                 placeholder="Event UID…"
                 data-test="ev-search-input" />
        </label>
        <label style={{ display: 'flex', alignItems: 'center',
          gap: 6, fontSize: 11, color: '#6e7a8a' }}>
          status
          <select className="cap-input__ctl"
                  data-test="ev-status-filter"
                  style={{ padding: '2px 6px', fontSize: 12 }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(
                    e.target.value as typeof statusFilter)}>
            <option value="all">all</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
        </label>
        <span className="cap-section-head__count">
          {status === 'loading' ? 'loading…'
            : status === 'err' ? 'failed to load'
            : query !== '' || statusFilter !== 'all'
              ? `${filtered.length} of ${recent.length} shown`
              : recent.length === 0 ? 'none yet'
              : `${recent.length} loaded`}
        </span>
        <span className="cap-section-head__rule" />
        <button type="button"
                className="cap-btn cap-btn--primary"
                data-test="ev-new"
                title="Open the new-event form"
                onClick={() => navEvent.create(programUid)}>
          + New event
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="cap-sub" style={{ marginLeft: 14 }}>
          {status === 'loading'
            ? 'Fetching events…'
            : status === 'err'
            ? 'The edge mirror could not be reached. Check the '
              + 'connection and retry.'
            : query !== '' || statusFilter !== 'all'
            ? 'No events match these filters.'
            : 'No events recorded for this program at this '
              + 'organisation unit yet.'}
        </p>
      ) : (
        <ul className="cap-list" data-test="ev-list">
          {filtered.map((e, i) => {
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
                  {e.status && (
                    <span className="cap-chip"
                          style={{
                            marginLeft: 10,
                            background: e.status === 'COMPLETED'
                              ? '#ecf7f0' : '#eef2f8',
                            color: e.status === 'COMPLETED'
                              ? '#136436' : '#0a5497',
                            borderColor: e.status === 'COMPLETED'
                              ? '#b7dcc7' : '#cfe1f4',
                          }}>
                      {e.status}
                    </span>
                  )}
                </div>
                <span className="cap-list__when">
                  {e.occurredDate ?? e.occurredAt ?? e.eventDate ?? '—'}
                </span>
                <RowActions
                  label="Event actions"
                  dataTest={'ev-row-actions-' + uid}
                  actions={[
                    { label: 'Open details',
                      title: 'Open the read-only event summary page.',
                      onSelect: () => navEvent.detail(programUid, uid) },
                    { label: 'Edit event',
                      title: 'Open the event in the edit form.',
                      onSelect: () => navEvent.edit(programUid, uid) },
                    { label: 'Copy UID',
                      disabled: typeof navigator === 'undefined'
                        || !navigator.clipboard,
                      title: 'Copy this event UID to the clipboard.',
                      onSelect: () => {
                        navigator.clipboard?.writeText(uid)
                          .catch(() => undefined);
                      } },
                  ]} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
