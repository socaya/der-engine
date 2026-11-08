import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { CaptureApi } from '../../shared/types';
import { navTracker } from '../../shared/routing';
import { openDatePicker } from '../../shared/openDatePicker';

const DHIS2_UID_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const DHIS2_UID_BODY_ALPHABET = DHIS2_UID_ALPHABET + '0123456789';

/** Mint a DHIS2-style 11-char UID: leading letter + 10 alphanum
 *  characters. Uses {@code crypto.getRandomValues} when available
 *  for better entropy than {@code Math.random}. */
function generateDhis2Uid(): string {
  const rand = typeof crypto !== 'undefined'
    && 'getRandomValues' in crypto
    ? (n: number) => {
        const buf = new Uint32Array(n);
        (crypto as Crypto).getRandomValues(buf);
        return buf;
      }
    : (n: number) => {
        const out = new Uint32Array(n);
        for (let i = 0; i < n; i++) {
          out[i] = Math.floor(Math.random() * 0xffffffff);
        }
        return out;
      };
  const draws = rand(11);
  const head = DHIS2_UID_ALPHABET[
    draws[0]! % DHIS2_UID_ALPHABET.length]!;
  let tail = '';
  for (let i = 1; i < 11; i++) {
    tail += DHIS2_UID_BODY_ALPHABET[
      draws[i]! % DHIS2_UID_BODY_ALPHABET.length]!;
  }
  return head + tail;
}

/**
 * Tracker enrollment form page (TR-013 / NAV-004). Full-page form
 * for creating an {@code ACTIVE} enrollment on an existing tracked
 * entity. The TEI must already exist (registration is a separate
 * route) — we fetch the TEI's existing enrolments to detect
 * duplicates in the same program (TRK-INV-004) and surface them
 * instead of silently creating a second active enrolment.
 *
 * <p>On save we navigate back to the record detail page so the
 * operator sees the new enrolment appear in the switcher.</p>
 */
export function TrackerEnrolPage(
  { api, programUid, orgUnitUid, teiId }: {
    api: CaptureApi;
    programUid: string;
    orgUnitUid: string;
    teiId: string;
  },
): JSX.Element {
  const [enrollmentDate, setEnrollmentDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10));
  const [incidentDate, setIncidentDate] = useState<string>('');
  const [existing, setExisting] = useState<ReadonlyArray<{
    enrollmentUid: string; status: string | null;
    enrollmentDate: string | null }>>([]);
  const [tetUid, setTetUid] = useState<string | null>(null);
  const [state, setState] =
    useState<'loading' | 'idle' | 'submitting' | 'ok' | 'err'>('loading');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    (async () => {
      try {
        const [enr, tet] = await Promise.all([
          api.listCaptureTeiEnrollments(teiId, programUid),
          api.getCaptureProgramTeiType(programUid).catch(() => null),
        ]);
        if (cancelled) return;
        setExisting(enr.enrollments.map((e) => ({
          enrollmentUid: e.enrollmentUid,
          status: e.status,
          enrollmentDate: e.enrollmentDate,
        })));
        setTetUid(tet?.trackedEntityTypeUid ?? null);
        setState('idle');
      } catch (err) {
        if (!cancelled) {
          setState('err');
          setMsg((err as Error).message ?? 'Failed to load TEI enrolments');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [teiId, programUid]);

  const activeExisting = useMemo(
    () => existing.filter((e) => e.status === 'ACTIVE'),
    [existing]);
  const hasActiveEnrolment = activeExisting.length > 0;

  const canSubmit = state === 'idle'
    && enrollmentDate !== ''
    && !hasActiveEnrolment;

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!canSubmit) return;
    setState('submitting');
    setMsg(null);
    try {
      // §TRK-INV-003: generate a stable DHIS2-style UID client-side
      // so the queued central submission reuses the same identity
      // as the optimistic local row. DHIS2 UIDs are 11 chars:
      // a leading letter followed by 10 alphanumeric characters.
      const enrollmentUid = generateDhis2Uid();
      const result = await api.createEnrollment({
        enrollmentUid,
        teiUid: teiId,
        programUid,
        orgUnitUid,
        enrollmentDate,
        incidentDate: incidentDate.trim() === ''
          ? undefined : incidentDate,
        status: 'ACTIVE',
      });
      setState('ok');
      setMsg(`Saved on edge · enrolment ${result.enrollmentUid.slice(0, 8)}…`
        + ' created. Central sync is a separate step.');
      setTimeout(() => navTracker.detail(programUid, teiId), 400);
    } catch (err) {
      setState('err');
      setMsg((err as Error).message ?? 'Enrolment failed');
    }
  }

  if (state === 'loading') {
    return (
      <p className="cap-sub" data-test="tr-enrol-loading">
        Loading enrolment metadata…
      </p>
    );
  }

  return (
    <>
      <div className="cap-section-head" data-test="tr-enrol-head">
        <button type="button"
                className="cap-btn cap-btn--secondary"
                data-test="tr-enrol-back"
                title="Back to the tracked-entity detail page (Alt+B)"
                onClick={() => navTracker.detail(programUid, teiId)}
                style={{ padding: '4px 10px', fontSize: 12 }}>
          ← Back to record
        </button>
        <h2 className="cap-section-head__title">Enrol in program</h2>
        <span className="cap-section-head__count">
          TEI <code>{teiId.slice(0, 11)}…</code>
          {tetUid && (<> · type <code>{tetUid.slice(0, 11)}…</code></>)}
        </span>
        <span className="cap-section-head__rule" />
      </div>

      {hasActiveEnrolment && (
        <div className="cap-strip cap-strip--warn"
             data-test="tr-enrol-already-active">
          <strong>This tracked entity already has an ACTIVE enrolment
            in this program.</strong>
          <ul style={{ margin: '4px 0 0 20px', padding: 0,
            fontSize: 12 }}>
            {activeExisting.map((e) => (
              <li key={e.enrollmentUid}>
                <code>{e.enrollmentUid}</code>
                {e.enrollmentDate && (<> · enrolled {e.enrollmentDate}</>)}
              </li>
            ))}
          </ul>
          <p style={{ margin: '6px 0 0 0', fontSize: 12 }}>
            Multiple ACTIVE enrolments in the same program are
            not supported here (§TRK-INV-004). Complete or cancel
            the existing enrolment first.
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} data-test="tr-enrol-form">
        <div className="cap-form">
          <fieldset className="cap-form-section">
            <legend className="cap-form-section__title">
              <span className="cap-form-section__title-text">
                Enrolment
              </span>
            </legend>
            <div className="cap-form-section__grid">
              <label className="cap-input" data-test="tr-enrol-date">
                <span className="cap-input__label">
                  Enrolment date<span className="cap-input__req">*</span>
                </span>
                <input type="date"
                       className="cap-input__ctl"
                       required
                       value={enrollmentDate}
                       onClick={openDatePicker}
                       onChange={(e) =>
                         setEnrollmentDate(e.target.value)} />
                <span className="cap-input__help">
                  When the person joined the program.
                </span>
              </label>
              <label className="cap-input" data-test="tr-enrol-incident">
                <span className="cap-input__label">
                  Incident date
                </span>
                <input type="date"
                       className="cap-input__ctl"
                       value={incidentDate}
                       onClick={openDatePicker}
                       onChange={(e) =>
                         setIncidentDate(e.target.value)} />
                <span className="cap-input__help">
                  Date of the event the enrolment is tracking
                  (optional — leave blank if the program doesn't
                  distinguish).
                </span>
              </label>
            </div>
          </fieldset>
        </div>

        <div className="cap-action-bar" data-test="tr-enrol-action-bar">
          <div className="cap-action-bar__state">
            {state === 'ok' && msg && (
              <span data-test="tr-enrol-saved">{msg}</span>
            )}
            {state === 'err' && msg && (
              <span data-test="tr-enrol-err"
                    style={{ color: '#8a2525' }}>
                {msg}
              </span>
            )}
            {(state === 'idle' || state === 'submitting') && (
              <span>
                {hasActiveEnrolment
                  ? 'Resolve the existing active enrolment first.'
                  : 'Creates an ACTIVE enrolment with stable identity.'}
              </span>
            )}
          </div>
          <button type="button"
                  className="cap-btn cap-btn--secondary"
                  onClick={() => navTracker.detail(programUid, teiId)}
                  data-test="tr-enrol-cancel">
            Cancel
          </button>
          <button type="submit"
                  className="cap-btn cap-btn--primary"
                  disabled={!canSubmit}
                  data-test="tr-enrol-submit">
            {state === 'submitting' ? 'Enrolling…' : 'Enrol'}
          </button>
        </div>
      </form>
    </>
  );
}
