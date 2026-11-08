import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { FormEngine, requiredFieldsComplete } from '../shared/FormEngine';
import type {
  CaptureFormSection, CaptureParseIssue,
  CaptureProgramRule, CaptureProgramRuleVariable,
} from '../shared/model';
import { parseStageForm } from '../shared/parser';
import { parseProgramRules } from '../shared/rules';
import { applyRuleEffectsToSections, evaluateRules } from '../shared/ruleEngine';
import type { CaptureApi } from '../shared/types';
import { useDirtyGuard } from '../shared/useDirtyGuard';
import { usePublishDirty } from '../shared/DirtyContext';

/**
 * Tracker stage event editor (requirements doc §8.5 TR-040 to
 * TR-045). Shares the FormEngine + rule evaluator with
 * EventWorkflow so a bug fix on either side lands once. The
 * editor is handed:
 *
 *   • A program + stage + enrolment identity (TRK-INV-001 — all
 *     three are preserved on submit; the stage UID alone is
 *     never used as event identity per §22.5 guardrail).
 *   • An optional existing event UID — when given, the form is
 *     pre-filled via getCaptureEventDetail().
 *
 * Submit calls submitEvent with the enrolment reference so the
 * edge journal associates the event with its parent enrolment.
 */
export function TrackerStageEditor(
  { api, programUid, stageUid, enrolmentUid, orgUnitUid,
    eventUid, onSaved, onCancel }: {
    api: CaptureApi;
    programUid: string;
    stageUid: string;
    enrolmentUid: string;
    orgUnitUid: string;
    eventUid: string | null;
    onSaved: () => void;
    onCancel: () => void;
  },
): JSX.Element {
  const [sections, setSections] =
    useState<readonly CaptureFormSection[]>([]);
  const [parseIssues, setParseIssues] =
    useState<readonly CaptureParseIssue[]>([]);
  const [rules, setRules] = useState<readonly CaptureProgramRule[]>([]);
  const [ruleVars, setRuleVars] =
    useState<readonly CaptureProgramRuleVariable[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [baseline, setBaseline] = useState<Record<string, string>>({});
  const [occurredAt, setOccurredAt] = useState(() =>
    new Date().toISOString().slice(0, 10));
  const [state, setState] =
    useState<'idle' | 'loading' | 'submitting' | 'ok' | 'err'>('loading');
  const [msg, setMsg] = useState<string | null>(null);
  const [eventStatus, setEventStatus] = useState<string | null>(null);

  // Load the stage schema + any pre-fill values + rules in
  // parallel so the editor opens fast.
  useEffect(() => {
    let cancelled = false;
    setState('loading');
    (async () => {
      try {
        const [form, rawRules, rawVars, detail] = await Promise.all([
          api.getCaptureStageForm(programUid, stageUid),
          api.listProgramRules(programUid),
          api.listProgramRuleVariables(programUid),
          eventUid ? api.getCaptureEventDetail(eventUid)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        const parsed = parseStageForm(stageUid, form);
        setSections(parsed.sections);
        setParseIssues(parsed.issues);
        const parsedRules = parseProgramRules(rawRules, rawVars);
        setRules(parsedRules.rules);
        setRuleVars(parsedRules.variables);
        if (detail) {
          const vals = { ...detail.dataValues };
          setValues(vals);
          setBaseline(vals);
          if (detail.occurredAt) {
            setOccurredAt(detail.occurredAt.slice(0, 10));
          }
          setEventStatus(detail.status ?? 'ACTIVE');
        } else {
          setValues({});
          setBaseline({});
          setEventStatus(null);
        }
        setState('idle');
      } catch (err) {
        if (!cancelled) {
          setState('err');
          setMsg('Failed to load the stage editor: '
            + (err as Error).message);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [api, programUid, stageUid, eventUid]);

  const ruleEffects = useMemo(
    () => evaluateRules(rules, ruleVars, values),
    [rules, ruleVars, values]);
  const effectiveSections = useMemo(
    () => applyRuleEffectsToSections(sections, ruleEffects),
    [sections, ruleEffects]);
  const canSubmit = useMemo(() => {
    if (state === 'submitting' || state === 'loading') return false;
    return requiredFieldsComplete(effectiveSections, values);
  }, [state, effectiveSections, values]);

  const isDirty = useMemo(() => {
    if (state === 'submitting' || state === 'loading') return false;
    const keys = new Set([...Object.keys(values),
      ...Object.keys(baseline)]);
    for (const k of keys) {
      if ((values[k] ?? '') !== (baseline[k] ?? '')) return true;
    }
    return false;
  }, [values, baseline, state]);
  const { confirmLeave } = useDirtyGuard(isDirty);
  usePublishDirty('tracker-stage-editor', isDirty);

  async function submit(targetStatus: 'ACTIVE' | 'COMPLETED'):
      Promise<void> {
    setState('submitting');
    setMsg(null);
    try {
      const dataValues = Object.entries(values)
        .filter(([, v]) => v.trim() !== '')
        .map(([dataElement, value]) => ({ dataElement, value }));
      await api.submitEvent({
        program: programUid, programStage: stageUid,
        orgUnit: orgUnitUid,
        occurredAt: new Date(occurredAt + 'T00:00:00Z').toISOString(),
        enrollment: enrolmentUid,
        status: targetStatus,
        event: eventUid ?? undefined,
        dataValues,
      });
      setState('ok');
      setEventStatus(targetStatus);
      // Reset the dirty baseline so the beforeunload guard stops
      // asking the operator — the save already succeeded.
      setBaseline({ ...values });
      const verb = targetStatus === 'COMPLETED'
        ? 'Completed on edge'
        : eventStatus === 'COMPLETED' ? 'Reopened on edge'
        : 'Saved on edge';
      setMsg(`${verb} · ${dataValues.length} `
        + `value${dataValues.length === 1 ? '' : 's'}. `
        + 'Central sync is a separate step.');
      onSaved();
    } catch (err) {
      setState('err');
      setMsg((err as Error).message ?? 'Submission failed');
    }
  }

  function onSubmitSave(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    void submit(eventStatus === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE');
  }
  function onClickComplete(): void {
    if (!canSubmit) return;
    void submit('COMPLETED');
  }
  function onClickReopen(): void {
    void submit('ACTIVE');
  }

  if (state === 'loading') {
    return (
      <p className="cap-sub" data-test="tr-editor-loading">
        Loading stage form…
      </p>
    );
  }
  if (sections.length === 0) {
    return (
      <>
        <p className="cap-sub">
          This stage has no data elements configured. Add elements
          to the stage sections to collect data here.
        </p>
        <button type="button"
                className="cap-btn cap-btn--secondary"
                onClick={onCancel}
                data-test="tr-editor-cancel-empty">
          Back to stage
        </button>
      </>
    );
  }

  return (
    <>
      <div className="cap-section-head" data-test="tr-editor-head">
        <h2 className="cap-section-head__title">
          {eventUid ? 'Edit event' : 'New event'}
        </h2>
        {eventStatus && (
          <span className="cap-chip"
                data-test="tr-editor-status"
                style={{
                  background: eventStatus === 'COMPLETED'
                    ? '#ecf7f0' : '#eef2f8',
                  color: eventStatus === 'COMPLETED'
                    ? '#136436' : '#0a5497',
                  borderColor: eventStatus === 'COMPLETED'
                    ? '#b7dcc7' : '#cfe1f4',
                }}>
            {eventStatus}
          </span>
        )}
        <label className="cap-input" style={{ minWidth: 150 }}>
          <span className="cap-toolbar__field-label">Event date</span>
          <input className="cap-input__ctl" type="date"
                 value={occurredAt}
                 onChange={(e) => setOccurredAt(e.target.value)}
                 data-test="tr-editor-occurred-at" />
        </label>
        <span className="cap-section-head__count">
          {effectiveSections.reduce((a, s) => a + s.fields.length, 0)}{' '}
          field{effectiveSections.reduce((a, s) =>
            a + s.fields.length, 0) === 1 ? '' : 's'}
          {rules.length > 0 && (
            <> · {rules.length} rule{rules.length === 1 ? '' : 's'}</>
          )}
        </span>
      </div>

      {parseIssues.length > 0 && (
        <div className="cap-strip cap-strip--info"
             data-test="tr-editor-parse-issues">
          <strong>Metadata notes:</strong>
          <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
            {parseIssues.map((iss, i) => (
              <li key={i} style={{ fontSize: 12 }}>
                <code>{iss.code}</code>{' — '}{iss.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {ruleEffects.warnings.length > 0 && (
        <div className="cap-strip cap-strip--info"
             data-test="tr-editor-rule-warnings">
          <strong>Program-rule notes:</strong>
          <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
            {ruleEffects.warnings.map((w, i) => (
              <li key={i} style={{ fontSize: 12,
                color: w.severity === 'error' ? '#8a2525' : '#0a5497' }}>
                {w.severity === 'error' ? '✦ ' : '• '}{w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={onSubmitSave} data-test="tr-editor-form">
        <FormEngine api={api}
                     sections={effectiveSections} values={values}
                     onChange={(k, v) => setValues((prev) =>
                       ({ ...prev, [k]: v }))} />
        <div className="cap-action-bar" data-test="tr-editor-action-bar">
          <div className="cap-action-bar__state">
            {state === 'ok' && msg && (
              <span data-test="tr-editor-saved">{msg}</span>
            )}
            {state === 'err' && msg && (
              <span data-test="tr-editor-err"
                    style={{ color: '#8a2525' }}>{msg}</span>
            )}
            {state === 'idle' && (
              <span>
                <strong>
                  {Object.values(values).filter((v) => v !== '').length}
                </strong> of {effectiveSections.reduce(
                  (a, s) => a + s.fields.length, 0)} filled
              </span>
            )}
          </div>
          <button type="button"
                  className="cap-btn cap-btn--secondary"
                  onClick={() => { if (confirmLeave()) onCancel(); }}
                  data-test="tr-editor-cancel">Cancel</button>
          {eventStatus === 'COMPLETED' ? (
            <button type="button"
                    className="cap-btn cap-btn--secondary"
                    onClick={onClickReopen}
                    disabled={state === 'submitting'}
                    data-test="tr-editor-reopen"
                    title="Reopen this event for further edits">
              Reopen
            </button>
          ) : (
            <button type="button"
                    className="cap-btn cap-btn--secondary"
                    onClick={onClickComplete}
                    disabled={!canSubmit}
                    data-test="tr-editor-complete"
                    title="Mark COMPLETED (Alt+C) — saves then transitions status, distinct from central sync">
              Complete
            </button>
          )}
          <button type="submit"
                  className="cap-btn cap-btn--primary"
                  disabled={!canSubmit}
                  data-test="tr-editor-submit"
                  title="Save this event to the facility edge (Alt+S)">
            {state === 'submitting' ? 'Saving…'
              : eventUid ? 'Save changes' : 'Save event'}
          </button>
        </div>
      </form>
    </>
  );
}
