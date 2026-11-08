import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { FormEngine, requiredFieldsComplete } from '../shared/FormEngine';
import type { CaptureApi } from '../shared/types';
import type { CaptureFormSection, CaptureParseIssue } from '../shared/model';
import { parseTeiAttributesForm } from '../shared/parser';
import { TrackerDashboard } from './TrackerDashboard';

interface TeiRow {
  readonly trackedEntity?: string;
  readonly trackedEntityInstance?: string;
  readonly displayName?: string;
  readonly lastUpdated?: string;
}

/**
 * Tracker (WITH_REGISTRATION) workflow inside the unified
 * Capture shell (requirements doc §8 Tracker Capture).
 *
 * Slice G4-1 ships:
 *   • Working list — program + OU-filtered tracked entities, with
 *     a search input that filters by display name (TR-001).
 *   • Search-first registration (TR-002, TR-010) — operator must
 *     search before "Register new" opens; the registration form
 *     is metadata-driven from the program's tracked-entity
 *     attributes and rendered through the shared FormEngine so
 *     typed-value and mandatory-flag fixes land once.
 *   • Honest status footer — distinguishes edge-saved from
 *     Central-acknowledged (§FR-005, §UI-008).
 *
 * Deferred to later gates:
 *   • Stage event timeline (G5)
 *   • Program-rule evaluation during registration (G5)
 *   • Relationship browser (G7)
 *   • Multiple enrolments / enrolment switcher (G5)
 */
export function TrackerWorkflow(
  { api, programUid, orgUnitUid }: {
    api: CaptureApi; programUid: string;
    orgUnitUid: string; orgUnitDisplayName: string;
    hashRoute: string;
  },
): JSX.Element {
  // Working list state.
  const [rows, setRows] = useState<TeiRow[]>([]);
  const [listStatus, setListStatus] =
    useState<'idle' | 'loading' | 'err'>('idle');
  const [query, setQuery] = useState('');
  const [openTei, setOpenTei] = useState<TeiRow | null>(null);

  // Registration state.
  const [tetUid, setTetUid] = useState<string | null>(null);
  const [regSections, setRegSections] =
    useState<readonly CaptureFormSection[]>([]);
  const [regIssues, setRegIssues] =
    useState<readonly CaptureParseIssue[]>([]);
  const [regValues, setRegValues] = useState<Record<string, string>>({});
  const [regOpen, setRegOpen] = useState(false);
  const [regState, setRegState] =
    useState<'idle' | 'submitting' | 'ok' | 'err'>('idle');
  const [regMsg, setRegMsg] = useState<string | null>(null);

  // Load working-list + registration metadata on program change.
  useEffect(() => {
    let cancelled = false;
    setListStatus('loading');
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
          const parsed = parseTeiAttributesForm(attrs.attributes);
          setRegSections(parsed.sections);
          setRegIssues(parsed.issues);
        }
      } catch {
        if (!cancelled) {
          setRows([]); setListStatus('err');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [programUid, orgUnitUid, api]);

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

  const canSubmitReg = useMemo(() => {
    if (regState === 'submitting') return false;
    if (tetUid == null) return false;
    return requiredFieldsComplete(regSections, regValues);
  }, [regState, tetUid, regSections, regValues]);

  async function onSubmitRegistration(e: FormEvent<HTMLFormElement>):
      Promise<void> {
    e.preventDefault();
    if (!tetUid) return;
    setRegState('submitting');
    setRegMsg(null);
    try {
      const attributes = Object.entries(regValues)
        .filter(([, v]) => v.trim() !== '')
        .map(([attribute, value]) => ({ attribute, value }));
      await api.enrolTei({
        program: programUid,
        orgUnit: orgUnitUid,
        trackedEntityType: tetUid,
        attributes,
      });
      setRegState('ok');
      setRegMsg(`Saved on edge · tracked entity registered with `
        + `${attributes.length} attribute`
        + `${attributes.length === 1 ? '' : 's'}.`);
      setRegValues({});
      // Reload the working list so the new row shows up.
      const r = await api.listTrackerEntities(programUid, orgUnitUid, 100);
      setRows(r.trackedEntities ?? r.instances ?? []);
      setRegOpen(false);
    } catch (err) {
      setRegState('err');
      setRegMsg((err as Error).message ?? 'Registration failed');
    }
  }

  // When a TEI is open, render the dashboard in place of the list
  // — the back button hands control back to the working list.
  if (openTei) {
    const uid = openTei.trackedEntity
      ?? openTei.trackedEntityInstance ?? '';
    return (
      <TrackerDashboard api={api} programUid={programUid}
                         orgUnitUid={orgUnitUid}
                         tei={uid}
                         displayName={openTei.displayName ?? null}
                         lastUpdated={openTei.lastUpdated ?? null}
                         onBack={() => setOpenTei(null)} />
    );
  }

  return (
    <>
      {/* Working list */}
      <div className="cap-section-head" data-test="tr-list-head">
        <h2 className="cap-section-head__title">Tracked entities</h2>
        <label className="cap-input" style={{ minWidth: 220 }}>
          <span className="cap-toolbar__field-label">Search</span>
          <input className="cap-input__ctl" type="search"
                 value={query}
                 onChange={(e) => setQuery(e.target.value)}
                 placeholder="UID or display name…"
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
                className={'cap-btn ' + (regOpen
                  ? 'cap-btn--secondary' : 'cap-btn--primary')}
                data-test="tr-register-toggle"
                disabled={tetUid == null || regSections.length === 0}
                title={tetUid == null
                  ? 'This program has no tracked-entity type assigned'
                  : regSections.length === 0
                  ? 'No registration attributes are configured'
                  : regOpen ? 'Close registration form'
                    : 'Register a new tracked entity (TR-002 search first)'}
                onClick={() => setRegOpen((v) => !v)}>
          {regOpen ? 'Close' : 'Register new'}
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
                  onClick={() => setOpenTei(r)}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenTei(r);
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
          })}
        </ul>
      )}

      {/* Registration form — only when the operator has searched
       *  first and explicitly opened it (TR-002). */}
      {regOpen && tetUid && regSections.length > 0 && (
        <>
          <div className="cap-section-head" data-test="tr-register-head">
            <h2 className="cap-section-head__title">Register new</h2>
            <span className="cap-section-head__count">
              {regSections[0]!.fields.length} attribute
              {regSections[0]!.fields.length === 1 ? '' : 's'}
            </span>
            <span className="cap-section-head__rule" />
          </div>
          {regIssues.length > 0 && (
            <div className="cap-strip cap-strip--info"
                 data-test="tr-parse-issues">
              <strong>Metadata notes:</strong>
              <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
                {regIssues.map((iss, i) => (
                  <li key={i} style={{ fontSize: 12 }}>
                    <code>{iss.code}</code>{' — '}{iss.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <form onSubmit={onSubmitRegistration} data-test="tr-reg-form">
            <FormEngine sections={regSections} values={regValues}
                         onChange={(k, v) => setRegValues((prev) =>
                           ({ ...prev, [k]: v }))} />
            <div className="cap-action-bar" data-test="tr-reg-action-bar">
              <div className="cap-action-bar__state">
                {regState === 'ok' && regMsg && (
                  <span data-test="tr-reg-saved">{regMsg}</span>
                )}
                {regState === 'err' && regMsg && (
                  <span data-test="tr-reg-err"
                        style={{ color: '#8a2525' }}>
                    {regMsg}
                  </span>
                )}
                {regState === 'idle' && (
                  <span>
                    <strong>
                      {Object.values(regValues)
                        .filter((v) => v !== '').length}
                    </strong> of {regSections[0]!.fields.length} filled
                  </span>
                )}
              </div>
              <button type="button"
                      className="cap-btn cap-btn--secondary"
                      onClick={() => { setRegOpen(false);
                        setRegValues({}); }}
                      data-test="tr-reg-cancel">
                Cancel
              </button>
              <button type="submit"
                      className="cap-btn cap-btn--primary"
                      disabled={!canSubmitReg}
                      data-test="tr-reg-submit">
                {regState === 'submitting'
                  ? 'Registering…' : 'Register'}
              </button>
            </div>
          </form>
        </>
      )}

      {regOpen && tetUid === null && (
        <div className="cap-strip cap-strip--err"
             data-test="tr-no-tet">
          This program has no tracked-entity type assigned, so
          registration cannot proceed. Ask an administrator to
          configure the program's tracked-entity type.
        </div>
      )}
    </>
  );
}
