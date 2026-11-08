import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { FormEngine, requiredFieldsComplete } from '../../shared/FormEngine';
import type { CaptureApi, StageOpt } from '../../shared/types';
import type {
  CaptureFormSection, CaptureParseIssue,
  CaptureProgramRule, CaptureProgramRuleVariable,
} from '../../shared/model';
import { parseStageForm } from '../../shared/parser';
import { enrichRulesWithActions, parseProgramRules } from '../../shared/rules';
import { applyRuleEffectsToSections, evaluateRules } from '../../shared/ruleEngine';
import { useDirtyGuard } from '../../shared/useDirtyGuard';
import { usePublishDirty } from '../../shared/DirtyContext';
import { SectionNav } from '../../shared/SectionNav';
import { useAutofocusFirstField } from '../../shared/useAutofocusFirstField';
import { navEvent } from '../../shared/routing';
import { openDatePicker } from '../../shared/openDatePicker';

/**
 * Event create / edit form page (NAV-004). Full-page form with
 * metadata-driven sections, program rules and validation. On
 * save we navigate to the event detail page per NAV-006
 * ("after save, navigate to the record details page").
 */
export function EventFormPage(
  { api, programUid, orgUnitUid, eventId }: {
    api: CaptureApi;
    programUid: string;
    orgUnitUid: string;
    /** Null when creating a new event. */
    eventId: string | null;
  },
): JSX.Element {
  const [stages, setStages] = useState<StageOpt[]>([]);
  const [stageUid, setStageUid] = useState('');
  const [sections, setSections] = useState<readonly CaptureFormSection[]>([]);
  const [parseIssues, setParseIssues] =
    useState<readonly CaptureParseIssue[]>([]);
  const [rules, setRules] = useState<readonly CaptureProgramRule[]>([]);
  const [ruleVars, setRuleVars] =
    useState<readonly CaptureProgramRuleVariable[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [occurredAt, setOccurredAt] = useState(() =>
    new Date().toISOString().slice(0, 10));
  const [submitState, setSubmitState] =
    useState<'idle' | 'submitting' | 'ok' | 'err'>('idle');
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [eventStatus, setEventStatus] = useState<string | null>(null);
  const [metadataReady, setMetadataReady] = useState(true);

  // Load stages, rules, and (if editing) the existing event.
  useEffect(() => {
    setStages([]); setStageUid('');
    setSections([]); setValues({});
    setEventStatus(null);
    setMetadataReady(true);
    let cancelled = false;
    (async () => {
      try {
        const [stRes, detail] = await Promise.all([
          api.listCaptureProgramStages(programUid),
          eventId ? api.getCaptureEventDetail(eventId)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        const opts = stRes.stages.map((s) => ({
          id: s.stageUid, displayName: s.displayName,
        }));
        setStages(opts);
        if (detail) {
          setStageUid(detail.programStageUid);
          setValues({ ...detail.dataValues });
          setEventStatus(detail.status ?? 'ACTIVE');
          if (detail.occurredAt) {
            setOccurredAt(detail.occurredAt.slice(0, 10));
          }
        } else if (opts.length === 1) {
          setStageUid(opts[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = (err as Error).message ?? '';
          if (/METADATA_NOT_READY|not mirrored/.test(msg)) {
            setMetadataReady(false);
          } else {
            setSubmitState('err');
            setSubmitMsg('Failed to load: ' + msg);
          }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [programUid, eventId]);

  // Stage form metadata.
  useEffect(() => {
    setSections([]); setParseIssues([]);
    if (stageUid === '') return;
    let cancelled = false;
    (async () => {
      try {
        const form = await api.getCaptureStageForm(programUid, stageUid);
        if (cancelled) return;
        const parsed = parseStageForm(stageUid, form);
        setSections(parsed.sections);
        setParseIssues(parsed.issues);
      } catch (err) {
        if (!cancelled) {
          setSubmitState('err');
          setSubmitMsg('Failed to load stage form: '
            + (err as Error).message);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [programUid, stageUid]);

  // Program rules + variables.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rawRules, rawVars, rawActions] = await Promise.all([
          api.listProgramRules(programUid),
          api.listProgramRuleVariables(programUid),
          api.listProgramRuleActions(),
        ]);
        if (cancelled) return;
        const enriched = enrichRulesWithActions(rawRules, rawActions);
        const parsed = parseProgramRules(enriched, rawVars);
        setRules(parsed.rules);
        setRuleVars(parsed.variables);
        if (parsed.issues.length > 0) {
          setParseIssues((prev) => [...prev, ...parsed.issues]);
        }
      } catch {
        if (!cancelled) { setRules([]); setRuleVars([]); }
      }
    })();
    return () => { cancelled = true; };
  }, [programUid]);

  const ruleEffects = useMemo(
    () => evaluateRules(rules, ruleVars, values),
    [rules, ruleVars, values]);
  const effectiveSections = useMemo(
    () => applyRuleEffectsToSections(sections, ruleEffects),
    [sections, ruleEffects]);
  const warningsByField = useMemo(() => {
    const m = new Map<string, typeof ruleEffects.warnings>();
    for (const w of ruleEffects.warnings) {
      if (!w.fieldId) continue;
      const list = m.get(w.fieldId) ?? [];
      m.set(w.fieldId, [...list, w]);
    }
    return m;
  }, [ruleEffects.warnings]);

  const canSubmit = useMemo(() => {
    if (stageUid === '') return false;
    if (submitState === 'submitting') return false;
    return requiredFieldsComplete(effectiveSections, values);
  }, [stageUid, submitState, effectiveSections, values]);

  const isDirty = useMemo(() => {
    if (submitState === 'submitting' || submitState === 'ok') return false;
    return Object.values(values).some((v) => v.trim() !== '');
  }, [values, submitState]);
  useDirtyGuard(isDirty);
  usePublishDirty('event-form', isDirty);
  useAutofocusFirstField(effectiveSections,
    (eventId ?? 'new') + '|' + stageUid);

  async function submit(targetStatus: 'ACTIVE' | 'COMPLETED' | null,
      { andAnother }: { andAnother?: boolean } = {}): Promise<void> {
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
        event: eventId ?? undefined,
        status: targetStatus ?? undefined,
      });
      setSubmitState('ok');
      if (targetStatus) setEventStatus(targetStatus);
      const verb = targetStatus === 'COMPLETED'
        ? 'Completed on edge'
        : targetStatus === 'ACTIVE' && eventStatus === 'COMPLETED'
        ? 'Reopened on edge'
        : 'Saved on edge';
      setSubmitMsg(`${verb} · ${dataValues.length} `
        + `value${dataValues.length === 1 ? '' : 's'}.`);
      if (andAnother && !eventId) {
        // EV2-B — Save & add another. Reset the form in place so
        // the operator can capture the next event without a
        // round-trip through the list. Keeps occurredAt pinned
        // (same session + same day) and resets the ok banner a
        // second later so the operator sees the confirmation
        // before the next entry.
        setValues({});
        setTimeout(() => {
          setSubmitState('idle');
          setSubmitMsg(null);
        }, 1200);
        return;
      }
      // NAV-006: route to the detail page on successful save. If
      // we're creating and don't have an eventId yet, list route.
      setTimeout(() => {
        if (eventId) navEvent.detail(programUid, eventId);
        else navEvent.list(programUid);
      }, 400);
    } catch (err) {
      setSubmitState('err');
      setSubmitMsg((err as Error).message ?? 'Submission failed');
    }
  }

  function onSubmitSave(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    void submit(null);
  }

  if (!metadataReady) {
    return (
      <div className="cap-strip cap-strip--warn"
           data-test="ce-metadata-not-ready">
        <strong>Program metadata hasn't been synced to this
          edge yet.</strong>{' '}
        The capture form can't render until an administrator runs
        a metadata sync (§MD-008).
      </div>
    );
  }

  return (
    <>
      <div className="cap-section-head" data-test="ce-stage-head">
        <button type="button"
                className="cap-btn cap-btn--secondary"
                data-test="ev-form-back"
                title={eventId
                  ? 'Back to the event detail page (Alt+B)'
                  : 'Back to the events list (Alt+B)'}
                onClick={() => {
                  if (eventId) navEvent.detail(programUid, eventId);
                  else navEvent.list(programUid);
                }}
                style={{ padding: '4px 10px', fontSize: 12 }}>
          ← Back
        </button>
        <h2 className="cap-section-head__title">
          {eventId ? 'Edit event' : 'New event'}
        </h2>
        {eventStatus && (
          <span className={'cap-status cap-status--'
              + (eventStatus === 'COMPLETED' ? 'ok' : 'active')}
                data-test="ce-event-status">
            {eventStatus === 'COMPLETED' ? 'Completed' : 'Active'}
          </span>
        )}
        {stages.length > 1 && (
          <StageSelect stages={stages} value={stageUid}
                        onChange={setStageUid} />
        )}
        <label className="cap-input" style={{ minWidth: 160 }}>
          <span className="cap-toolbar__field-label">Event date</span>
          <input className="cap-input__ctl" type="date"
                 value={occurredAt}
                 onChange={(e) => setOccurredAt(e.target.value)}
                 onClick={openDatePicker}
                 data-test="ce-occurred-at" />
        </label>
        <span className="cap-section-head__count">
          {effectiveSections.reduce((acc, s) => acc + s.fields.length, 0)}{' '}
          field{effectiveSections.reduce((acc, s) => acc + s.fields.length, 0)
            === 1 ? '' : 's'}
          {rules.length > 0 && (
            <> · <span title="Program rules loaded">
              {rules.length} rule{rules.length === 1 ? '' : 's'}
            </span></>
          )}
        </span>
      </div>

      {parseIssues.length > 0 && (
        <div className="cap-strip cap-strip--info"
             data-test="ce-parse-issues">
          <strong>Metadata compatibility notes:</strong>
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
             data-test="ce-rule-warnings">
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
      {effectiveSections.length > 0 && (
        <form onSubmit={onSubmitSave} data-test="ce-form">
          <SectionNav sections={effectiveSections} />
          <FormEngine api={api}
                       sections={effectiveSections} values={values}
                       warnings={warningsByField}
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
                  </strong> of {effectiveSections.reduce(
                    (acc, s) => acc + s.fields.length, 0)} filled
                </span>
              )}
            </div>
            {eventId && eventStatus === 'COMPLETED' && (
              <button type="button"
                      className="cap-btn cap-btn--secondary"
                      onClick={() => { void submit('ACTIVE'); }}
                      disabled={submitState === 'submitting'}
                      data-test="ce-reopen"
                      title="Reopen this event for further edits">
                Reopen
              </button>
            )}
            {eventId && eventStatus !== 'COMPLETED' && (
              <button type="button"
                      className="cap-btn cap-btn--secondary"
                      onClick={() => { void submit('COMPLETED'); }}
                      disabled={!canSubmit}
                      data-test="ce-complete"
                      title="Mark COMPLETED (Alt+C)">
                Complete
              </button>
            )}
            {!eventId && (
              // EV2-B — only offered when creating. On edit the
              // "and another" semantics don't make sense: there
              // is no new blank event to roll into.
              <button type="button"
                      className="cap-btn cap-btn--secondary"
                      onClick={() => {
                        void submit(null, { andAnother: true });
                      }}
                      disabled={!canSubmit}
                      data-test="ce-save-and-another"
                      title={'Save this event and reset the form so you '
                        + 'can enter the next one without going back '
                        + 'to the list.'}>
                Save &amp; add another
              </button>
            )}
            <button type="submit"
                    className="cap-btn cap-btn--primary"
                    disabled={!canSubmit}
                    data-test="ce-submit-btn"
                    title="Save this event to the facility edge (Alt+S)">
              {submitState === 'submitting' ? 'Submitting…'
                : eventId ? 'Save changes' : 'Save event'}
            </button>
          </div>
        </form>
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
