import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { FormEngine, requiredFieldsComplete } from '../shared/FormEngine';
import type { CaptureApi, EventRow, FormSection, StageOpt } from
  '../shared/types';

/**
 * Event (WITHOUT_REGISTRATION) workflow inside the unified
 * Capture shell. Mirrors the Data Entry layout:
 *   • Stage + event-date selectors inline
 *   • Shared form engine for the dynamic DE grid
 *   • Sticky action bar with Save / state
 *   • Recent events chip-row below
 *
 * The parent {@code CaptureApp} already owns the program + OU
 * context; this component is handed only what it needs so the
 * same engine can be lifted into {@code TrackerWorkflow}'s
 * stage event editor later.
 */
export function EventWorkflow(
  { api, programUid, orgUnitUid }: {
    api: CaptureApi; programUid: string;
    orgUnitUid: string; orgUnitDisplayName: string;
  },
): JSX.Element {
  const [stages, setStages] = useState<StageOpt[]>([]);
  const [stageUid, setStageUid] = useState('');
  const [sections, setSections] = useState<FormSection[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [occurredAt, setOccurredAt] = useState(() =>
    new Date().toISOString().slice(0, 10));
  const [submitState, setSubmitState] =
    useState<'idle' | 'submitting' | 'ok' | 'err'>('idle');
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [recent, setRecent] = useState<EventRow[]>([]);

  // Fetch stages whenever the program changes. Auto-pick when
  // the program only has one stage so the operator doesn't see
  // a one-option select.
  useEffect(() => {
    setStages([]); setStageUid('');
    setSections([]); setValues({});
    let cancelled = false;
    (async () => {
      try {
        const r = await api.listCaptureProgramStages(programUid);
        if (cancelled) return;
        const opts = r.stages.map((s) => ({
          id: s.programStageUid, displayName: s.displayName,
        }));
        setStages(opts);
        if (opts.length === 1) setStageUid(opts[0].id);
      } catch (err) {
        if (!cancelled) {
          setSubmitState('err');
          setSubmitMsg('Failed to load stages: ' + (err as Error).message);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [programUid, api]);

  // Fetch the stage form schema whenever stage changes.
  useEffect(() => {
    setSections([]); setValues({});
    if (stageUid === '') return;
    let cancelled = false;
    (async () => {
      try {
        const form = await api.getCaptureStageForm(programUid, stageUid);
        if (cancelled) return;
        setSections(form.sections.map((s) => ({
          title: s.displayName,
          fields: s.fields.map((f) => ({
            fieldRef: f.fieldRef,
            dataElementUid: f.dataElementUid,
            displayName: f.dataElementDisplayName,
            valueType: f.valueType,
            required: f.requirement === 'REQUIRED',
            readonly: f.requirement === 'READONLY',
          })),
        })));
      } catch (err) {
        if (!cancelled) {
          setSubmitState('err');
          setSubmitMsg('Failed to load stage form: '
            + (err as Error).message);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [programUid, stageUid, api]);

  // Fetch recent events scoped to program + OU.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.listCaptureProgramEvents(programUid,
          orgUnitUid, 20);
        if (!cancelled) setRecent(r.events ?? []);
      } catch {
        if (!cancelled) setRecent([]);
      }
    })();
    return () => { cancelled = true; };
  }, [programUid, orgUnitUid, api]);

  const canSubmit = useMemo(() => {
    if (stageUid === '') return false;
    if (submitState === 'submitting') return false;
    return requiredFieldsComplete(sections, values);
  }, [stageUid, submitState, sections, values]);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setSubmitState('submitting');
    setSubmitMsg(null);
    try {
      const dataValues = Object.entries(values)
        .filter(([, v]) => v.trim() !== '')
        .map(([dataElement, value]) => ({ dataElement, value }));
      await api.submitEvent({
        program: programUid,
        programStage: stageUid,
        orgUnit: orgUnitUid,
        occurredAt: new Date(occurredAt + 'T00:00:00Z').toISOString(),
        dataValues,
      });
      setSubmitState('ok');
      setSubmitMsg(`Saved on edge · ${dataValues.length} `
        + `value${dataValues.length === 1 ? '' : 's'}.`);
      setValues({});
      const r = await api.listCaptureProgramEvents(programUid,
        orgUnitUid, 20);
      setRecent(r.events ?? []);
    } catch (err) {
      setSubmitState('err');
      setSubmitMsg((err as Error).message ?? 'Submission failed');
    }
  }

  return (
    <>
      {/* Stage + event-date selectors — laid out inline on the
       *  section head so they feel like extensions of the main
       *  toolbar. */}
      <div className="cap-section-head" data-test="ce-stage-head">
        <h2 className="cap-section-head__title">Event</h2>
        <StageSelect stages={stages} value={stageUid}
                      onChange={setStageUid} />
        <label className="cap-input" style={{ minWidth: 160 }}>
          <span className="cap-toolbar__field-label">Event date</span>
          <input className="cap-input__ctl" type="date"
                 value={occurredAt}
                 onChange={(e) => setOccurredAt(e.target.value)}
                 data-test="ce-occurred-at" />
        </label>
        <span className="cap-section-head__count">
          {sections.reduce((acc, s) => acc + s.fields.length, 0)}{' '}
          field{sections.reduce((acc, s) => acc + s.fields.length, 0)
            === 1 ? '' : 's'}
        </span>
      </div>

      {sections.length > 0 && (
        <form onSubmit={onSubmit} data-test="ce-form">
          <FormEngine sections={sections} values={values}
                       onChange={(k, v) => setValues((prev) => ({
                         ...prev, [k]: v }))} />

          <div className="cap-action-bar" data-test="ce-action-bar">
            <div className="cap-action-bar__state">
              {submitState === 'ok' && submitMsg && (
                <span data-test="ce-saved">{submitMsg}</span>
              )}
              {submitState === 'err' && submitMsg && (
                <span data-test="ce-err" style={{ color: '#8a2525' }}>
                  {submitMsg}
                </span>
              )}
              {submitState === 'idle' && (
                <span>
                  <strong>
                    {Object.values(values).filter((v) => v !== '').length}
                  </strong> of {sections.reduce(
                    (acc, s) => acc + s.fields.length, 0)} filled
                </span>
              )}
            </div>
            <button type="submit"
                    className="cap-btn cap-btn--primary"
                    disabled={!canSubmit}
                    data-test="ce-submit-btn">
              {submitState === 'submitting' ? 'Submitting…' : 'Save event'}
            </button>
          </div>
        </form>
      )}

      {/* Recent events list — small chip rows, same chrome as
       *  Data Entry's section head. */}
      <div className="cap-section-head">
        <h2 className="cap-section-head__title">Recent events</h2>
        <span className="cap-section-head__count">
          {recent.length === 0 ? 'none yet' : `${recent.length} shown`}
        </span>
        <span className="cap-section-head__rule" />
      </div>
      {recent.length === 0 ? (
        <p className="cap-sub" style={{ marginLeft: 14 }}>
          Once you save an event it will appear here.
        </p>
      ) : (
        <ul className="cap-list" data-test="ce-recent">
          {recent.map((e, i) => (
            <li key={(e.eventUid ?? e.event ?? '') + i}
                className="cap-list__row">
              <code>{e.eventUid ?? e.event ?? '—'}</code>
              <span className="cap-list__when">
                {e.occurredDate ?? e.occurredAt ?? e.eventDate ?? '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function StageSelect(
  { stages, value, onChange }: {
    stages: readonly StageOpt[];
    value: string;
    onChange: (v: string) => void;
  },
): JSX.Element {
  // Collapse to a static label when the program has exactly one
  // stage — avoids a one-option select which only wastes space.
  if (stages.length === 1) {
    return (
      <div className="cap-toolbar__ou">
        <span className="cap-toolbar__field-label">Stage</span>
        <code className="cap-toolbar__ou-code">{stages[0].displayName}</code>
      </div>
    );
  }
  return (
    <label className="cap-toolbar__field" style={{ minWidth: 220 }}>
      <span className="cap-toolbar__field-label">Stage</span>
      <select className="cap-toolbar__select"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              data-test="ce-stage-select"
              disabled={stages.length === 0}>
        {stages.length === 0 && <option value="">—</option>}
        {stages.length > 1 && <option value="">— select —</option>}
        {stages.map((s) => (
          <option key={s.id} value={s.id}>{s.displayName}</option>
        ))}
      </select>
    </label>
  );
}
