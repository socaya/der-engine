import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { FormEngine, requiredFieldsComplete } from '../shared/FormEngine';
import type { CaptureApi, EventRow, StageOpt } from '../shared/types';
import type {
  CaptureFormSection, CaptureParseIssue,
  CaptureProgramRule, CaptureProgramRuleVariable,
} from '../shared/model';
import { parseStageForm } from '../shared/parser';
import { parseProgramRules } from '../shared/rules';
import { applyRuleEffectsToSections, evaluateRules } from '../shared/ruleEngine';
import { useDirtyGuard } from '../shared/useDirtyGuard';
import { usePublishDirty } from '../shared/DirtyContext';
import { SectionNav } from '../shared/SectionNav';
import { useAutofocusFirstField } from '../shared/useAutofocusFirstField';

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
  const [recent, setRecent] = useState<EventRow[]>([]);
  /** When set, the form is editing an existing event instead of
   *  creating a new one; submit passes event: openEventUid and
   *  reuses the DHIS2 update semantics (§TRK-INV-002 — don't
   *  fabricate a new event UID on a save of an existing one). */
  const [openEventUid, setOpenEventUid] = useState<string | null>(null);
  const [eventStatus, setEventStatus] = useState<string | null>(null);

  // Fetch stages whenever the program changes. Auto-pick when
  // the program only has one stage so the operator doesn't see
  // a one-option select.
  useEffect(() => {
    setStages([]); setStageUid('');
    setSections([]); setValues({});
    setOpenEventUid(null); setEventStatus(null);
    let cancelled = false;
    (async () => {
      try {
        const r = await api.listCaptureProgramStages(programUid);
        if (cancelled) return;
        const opts = r.stages.map((s) => ({
          id: s.stageUid, displayName: s.displayName,
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

  // Fetch the stage form schema whenever stage changes. Pipe
  // through the typed parser (G2) so the UI consumes an immutable
  // CaptureFormSection[] with explicit issue tracking instead of
  // the raw assembly shape.
  useEffect(() => {
    setSections([]); setParseIssues([]); setValues({});
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
  }, [programUid, stageUid, api]);

  // Fetch program rules + variables once per program. Both calls
  // fan out all pages; the parser sorts rules by priority
  // ascending and surfaces any non-CURRENT_EVENT variable sources
  // in a parse-issue list (§MD-005, §PR-004).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rawRules, rawVars] = await Promise.all([
          api.listProgramRules(programUid),
          api.listProgramRuleVariables(programUid),
        ]);
        if (cancelled) return;
        const parsed = parseProgramRules(rawRules, rawVars);
        setRules(parsed.rules);
        setRuleVars(parsed.variables);
        if (parsed.issues.length > 0) {
          setParseIssues((prev) => [...prev, ...parsed.issues]);
        }
      } catch {
        if (!cancelled) {
          setRules([]);
          setRuleVars([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [programUid, api]);

  // Evaluate rules on every value change — PR-002 "deterministic
  // on initial load and every relevant value/context change".
  // Memo so React reconciles only when the effect set actually
  // shifts, preserving focus + scroll (§FR-009).
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
    // Honor rule-driven required overrides + rule-hidden fields —
    // required-field completeness is evaluated against the
    // effective form, not the raw metadata.
    return requiredFieldsComplete(effectiveSections, values);
  }, [stageUid, submitState, effectiveSections, values]);

  // EventWorkflow events start from a clean slate; "dirty" means
  // the operator has typed at least one non-empty value and the
  // last submit hasn't just succeeded. The guard warns on tab
  // close + we reset it on each successful save.
  const isDirty = useMemo(() => {
    if (submitState === 'submitting' || submitState === 'ok') return false;
    return Object.values(values).some((v) => v.trim() !== '');
  }, [values, submitState]);
  useDirtyGuard(isDirty);
  usePublishDirty('event-workflow', isDirty);
  // Autofocus only on true form-open transitions: new event, new
  // stage, or opening an existing event. Not on every value edit.
  useAutofocusFirstField(effectiveSections,
    (openEventUid ?? 'new') + '|' + stageUid);

  async function openExisting(eventUid: string): Promise<void> {
    try {
      const detail = await api.getCaptureEventDetail(eventUid);
      setStageUid(detail.programStageUid);
      setOpenEventUid(eventUid);
      setValues({ ...detail.dataValues });
      setEventStatus(detail.status ?? 'ACTIVE');
      if (detail.occurredAt) {
        setOccurredAt(detail.occurredAt.slice(0, 10));
      }
      setSubmitState('idle');
      setSubmitMsg(null);
    } catch (err) {
      setSubmitState('err');
      setSubmitMsg('Failed to load event: ' + (err as Error).message);
    }
  }
  function resetToNew(): void {
    setOpenEventUid(null);
    setEventStatus(null);
    setValues({});
    setOccurredAt(new Date().toISOString().slice(0, 10));
    setSubmitState('idle');
    setSubmitMsg(null);
  }

  async function submit(targetStatus: 'ACTIVE' | 'COMPLETED' | null):
      Promise<void> {
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
        event: openEventUid ?? undefined,
        status: targetStatus ?? undefined,
      });
      setSubmitState('ok');
      // Status only changes on explicit Complete/Reopen; a plain
      // Save keeps whatever status the event currently has
      // (§TR-043 — Save and Complete are distinct transitions).
      if (targetStatus) setEventStatus(targetStatus);
      const verb = targetStatus === 'COMPLETED'
        ? 'Completed on edge'
        : targetStatus === 'ACTIVE' && eventStatus === 'COMPLETED'
        ? 'Reopened on edge'
        : 'Saved on edge';
      setSubmitMsg(`${verb} · ${dataValues.length} `
        + `value${dataValues.length === 1 ? '' : 's'}. `
        + 'Central sync is a separate step.');
      // Only clear the form for brand-new events; keep the editor
      // populated when the operator just edited an existing one so
      // they can continue tweaking without re-opening it.
      if (!openEventUid) setValues({});
      const r = await api.listCaptureProgramEvents(programUid,
        orgUnitUid, 20);
      setRecent(r.events ?? []);
    } catch (err) {
      setSubmitState('err');
      setSubmitMsg((err as Error).message ?? 'Submission failed');
    }
  }

  function onSubmitSave(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    void submit(null);
  }
  function onClickComplete(): void {
    if (!canSubmit) return;
    void submit('COMPLETED');
  }
  function onClickReopen(): void {
    void submit('ACTIVE');
  }

  return (
    <>
      {/* Stage + event-date selectors — laid out inline on the
       *  section head so they feel like extensions of the main
       *  toolbar. */}
      <div className="cap-section-head" data-test="ce-stage-head">
        <h2 className="cap-section-head__title">
          {openEventUid ? 'Edit event' : 'New event'}
        </h2>
        {eventStatus && (
          <span className="cap-chip"
                data-test="ce-event-status"
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
        {openEventUid && (
          <button type="button"
                  className="cap-btn cap-btn--secondary"
                  data-test="ce-reset-new"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={resetToNew}
                  title="Clear the form to create a new event">
            + New event
          </button>
        )}
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
                <code>{iss.code}</code>
                {' — '}{iss.message}
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
            {openEventUid && eventStatus === 'COMPLETED' && (
              <button type="button"
                      className="cap-btn cap-btn--secondary"
                      onClick={onClickReopen}
                      disabled={submitState === 'submitting'}
                      data-test="ce-reopen"
                      title="Reopen this event for further edits">
                Reopen
              </button>
            )}
            {openEventUid && eventStatus !== 'COMPLETED' && (
              <button type="button"
                      className="cap-btn cap-btn--secondary"
                      onClick={onClickComplete}
                      disabled={!canSubmit}
                      data-test="ce-complete"
                      title="Mark COMPLETED (Alt+C) — saves then transitions status, distinct from central sync">
                Complete
              </button>
            )}
            <button type="submit"
                    className="cap-btn cap-btn--primary"
                    disabled={!canSubmit}
                    data-test="ce-submit-btn"
                    title="Save this event to the facility edge (Alt+S)">
              {submitState === 'submitting' ? 'Submitting…'
                : openEventUid ? 'Save changes' : 'Save event'}
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
          {recent.map((e, i) => {
            const uid = e.eventUid ?? e.event ?? '';
            return (
              <li key={uid + i}
                  className={'cap-list__row'
                    + (uid ? ' cap-list__row--clickable' : '')
                    + (openEventUid && openEventUid === uid
                      ? ' cap-list__row--active' : '')}
                  data-test={'ce-recent-' + uid}
                  role={uid ? 'button' : undefined}
                  tabIndex={uid ? 0 : undefined}
                  onClick={uid
                    ? () => { void openExisting(uid); } : undefined}
                  onKeyDown={uid ? (ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      void openExisting(uid);
                    }
                  } : undefined}>
                <div>
                  <code>{uid || '—'}</code>
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
              </li>
            );
          })}
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
