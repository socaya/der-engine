import { useEffect, useMemo, useState } from 'react';
import type { CaptureApi } from '../../shared/types';
import { RowActions } from '../../shared/RowActions';
import { navTracker } from '../../shared/routing';

interface TeiRow {
  readonly trackedEntity?: string;
  readonly trackedEntityInstance?: string;
  readonly displayName?: string;
  readonly lastUpdated?: string;
}

/**
 * Tracker working-list page (NAV-001). Full-page route: list only,
 * no inline registration form, no inline detail. "Register new"
 * routes to {@code #/tracker/:programId/register}; opening a row
 * routes to {@code #/tracker/:programId/records/:teiId}.
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

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(stateKey, query);
  }, [query, stateKey]);

  useEffect(() => {
    let cancelled = false;
    setListStatus('loading');
    setMetadataReady(true);
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

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return rows;
    return rows.filter((r) => {
      const uid = (r.trackedEntity ?? r.trackedEntityInstance ?? '')
        .toLowerCase();
      const name = (r.displayName ?? '').toLowerCase();
      return uid.includes(q) || name.includes(q);
    });
  }, [rows, query]);

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
                 placeholder="UID or display name… (Alt+F)"
                 data-test="tr-search-input" />
        </label>
        <span className="cap-section-head__count">
          {listStatus === 'loading' ? 'loading…'
            : listStatus === 'err' ? 'failed to load'
            : query !== ''
              ? `${filteredRows.length} of ${rows.length} shown`
              : rows.length === 0 ? 'none yet'
              : `${rows.length} loaded`}
        </span>
        <span className="cap-section-head__rule" />
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

      {filteredRows.length === 0 ? (
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
      ) : (
        <ul className="cap-list" data-test="tr-tei-list">
          {filteredRows.map((r, i) => {
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
                <RowActions
                  label="Tracked entity actions"
                  dataTest={'tr-tei-actions-' + uid}
                  actions={[
                    { label: 'Open dashboard',
                      title: 'Open this tracked entity\'s enrolments '
                        + '+ stage events detail page.',
                      onSelect: () => navTracker.detail(programUid, uid) },
                    { label: 'Copy UID',
                      disabled: typeof navigator === 'undefined'
                        || !navigator.clipboard,
                      title: 'Copy this tracked-entity UID to the '
                        + 'clipboard for sharing with admins.',
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
