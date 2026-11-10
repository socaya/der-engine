import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { FormEngine, requiredFieldsComplete } from '../../shared/FormEngine';
import type { CaptureApi } from '../../shared/types';
import type { CaptureFormSection, CaptureParseIssue } from '../../shared/model';
import { parseTeiAttributesForm } from '../../shared/parser';
import { navTracker } from '../../shared/routing';

/**
 * Tracker registration page (NAV-001). Full-page create form —
 * the working list lives on a separate route, so an operator
 * sees only the registration form here with no list in the
 * sibling pane. On save we navigate to the new TEI's detail
 * page (NAV-006 — "after save, navigate to the record details
 * page").
 */
export function TrackerRegisterPage(
  { api, programUid, orgUnitUid }: {
    api: CaptureApi; programUid: string;
    orgUnitUid: string;
  },
): JSX.Element {
  const [tetUid, setTetUid] = useState<string | null>(null);
  const [sections, setSections] =
    useState<readonly CaptureFormSection[]>([]);
  const [issues, setIssues] =
    useState<readonly CaptureParseIssue[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] =
    useState<'loading' | 'idle' | 'submitting' | 'ok' | 'err'>('loading');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    (async () => {
      try {
        const tetRes = await api.getCaptureProgramTeiType(programUid);
        if (cancelled) return;
        const tet = tetRes?.trackedEntityTypeUid ?? null;
        setTetUid(tet);
        if (tet) {
          const attrs = await api.listCaptureTeiTypeAttributes(tet);
          if (cancelled) return;
          const parsed = parseTeiAttributesForm(attrs.attributes);
          setSections(parsed.sections);
          setIssues(parsed.issues);
        }
        setState('idle');
      } catch (err) {
        if (!cancelled) {
          setState('err');
          setMsg((err as Error).message ?? 'Failed to load metadata');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [programUid]);

  const canSubmit = useMemo(() => {
    if (state === 'submitting' || state === 'loading') return false;
    if (tetUid == null) return false;
    return requiredFieldsComplete(sections, values);
  }, [state, tetUid, sections, values]);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!tetUid) return;
    setState('submitting');
    setMsg(null);
    try {
      const attributes = Object.entries(values)
        .filter(([, v]) => v.trim() !== '')
        .map(([attribute, value]) => ({ attribute, value }));
      const result = await api.enrolTei({
        program: programUid,
        orgUnit: orgUnitUid,
        trackedEntityType: tetUid,
        attributes,
      }) as { teiUid?: string; trackedEntity?: string;
              trackedEntityUid?: string;
              trackedEntityInstance?: string } | null;
      setState('ok');
      // DER-native TrackedEntityController returns teiUid; the
      // legacy fields are belt-and-braces in case the shape ever
      // widens.
      const newUid = result?.teiUid
        ?? result?.trackedEntity
        ?? result?.trackedEntityUid
        ?? result?.trackedEntityInstance
        ?? null;
      setMsg(`Saved on edge · tracked entity registered with `
        + `${attributes.length} attribute`
        + `${attributes.length === 1 ? '' : 's'}.`);
      // NAV-006: after save, go to the new record's detail page.
      // Fall back to the list if the API didn't echo the new UID.
      setTimeout(() => {
        if (newUid) navTracker.detail(programUid, newUid);
        else navTracker.list(programUid);
      }, 400);
    } catch (err) {
      setState('err');
      setMsg((err as Error).message ?? 'Registration failed');
    }
  }

  if (state === 'loading') {
    return (
      <p className="cap-sub" data-test="tr-register-loading">
        Loading registration metadata…
      </p>
    );
  }

  if (state === 'err' && tetUid === null) {
    return (
      <div className="cap-strip cap-strip--err"
           data-test="tr-register-err">
        {msg ?? 'Failed to load registration metadata'}
      </div>
    );
  }

  if (tetUid === null) {
    return (
      <div className="cap-strip cap-strip--err"
           data-test="tr-no-tet">
        This program has no tracked-entity type assigned, so
        registration cannot proceed. Ask an administrator to
        configure the program's tracked-entity type.
      </div>
    );
  }

  return (
    <>
      <div className="cap-section-head" data-test="tr-register-head">
        <button type="button"
                className="cap-btn cap-btn--secondary"
                data-test="tr-register-back"
                title="Back to the tracked-entity working list (Alt+B)"
                onClick={() => navTracker.list(programUid)}
                style={{ padding: '4px 10px', fontSize: 13 }}>
          ← Back to list
        </button>
        <h2 className="cap-section-head__title">Register new tracked entity</h2>
        <span className="cap-section-head__count">
          {sections[0]?.fields.length ?? 0} attribute
          {(sections[0]?.fields.length ?? 0) === 1 ? '' : 's'}
        </span>
        <span className="cap-section-head__rule" />
      </div>

      {issues.length > 0 && (
        <div className="cap-strip cap-strip--info"
             data-test="tr-register-parse-issues">
          <strong>Metadata notes:</strong>
          <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
            {issues.map((iss, i) => (
              <li key={i} style={{ fontSize: 13 }}>
                <code>{iss.code}</code>{' — '}{iss.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <form onSubmit={onSubmit} data-test="tr-reg-form">
        <FormEngine api={api}
                     sections={sections} values={values}
                     onChange={(k, v) => setValues((prev) =>
                       ({ ...prev, [k]: v }))} />
        <div className="cap-action-bar" data-test="tr-reg-action-bar">
          <div className="cap-action-bar__state">
            {state === 'ok' && msg && (
              <span data-test="tr-reg-saved">{msg}</span>
            )}
            {state === 'err' && msg && (
              <span data-test="tr-reg-err"
                    style={{ color: 'var(--der-danger-ink)' }}>
                {msg}
              </span>
            )}
            {(state === 'idle' || state === 'submitting') && (
              <span>
                <strong>
                  {Object.values(values)
                    .filter((v) => v !== '').length}
                </strong> of {sections[0]?.fields.length ?? 0} filled
              </span>
            )}
          </div>
          <button type="button"
                  className="cap-btn cap-btn--secondary"
                  onClick={() => navTracker.list(programUid)}
                  data-test="tr-reg-cancel">
            Cancel
          </button>
          <button type="submit"
                  className="cap-btn cap-btn--primary"
                  disabled={!canSubmit}
                  data-test="tr-reg-submit">
            {state === 'submitting' ? 'Registering…' : 'Register'}
          </button>
        </div>
      </form>
    </>
  );
}
