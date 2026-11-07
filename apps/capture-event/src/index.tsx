import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  useAuth, useOrgUnitBinding, useOnlineStatus, useDerApi,
  ScreenCard, StatusPill,
} from '@der/app-sdk';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'submitting' }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string };

interface ProgramOpt {
  readonly id: string;
  readonly displayName: string;
  readonly programType: 'WITH_REGISTRATION' | 'WITHOUT_REGISTRATION';
}

interface StageOpt {
  readonly id: string;
  readonly displayName: string;
}

interface FormField {
  readonly fieldRef: string;
  readonly dataElementUid: string;
  readonly displayName: string;
  readonly valueType: string;
  readonly required: boolean;
  readonly readonly: boolean;
}

interface FormSection {
  readonly title: string;
  readonly fields: readonly FormField[];
}

interface EventRow {
  readonly event?: string;
  readonly eventUid?: string;
  readonly occurredAt?: string;
  readonly occurredDate?: string;
  readonly eventDate?: string;
  readonly programStage?: string;
  readonly programStageUid?: string;
}

/**
 * Event-program capture app (slice CE-1). Replaces the UID-pasting
 * scaffold with proper DHIS2-flavoured pickers:
 *
 *   • Program dropdown — fetched from the DER metadata mirror,
 *     filtered to {@code WITHOUT_REGISTRATION} and the bound OU.
 *   • Stage dropdown — fetched via {@code listCaptureProgramStages};
 *     auto-selected when a program only has one stage.
 *   • Dynamic form — sections + fields built from
 *     {@code getCaptureStageForm}; each field becomes a typed input
 *     respecting value-type, required/readonly flags.
 *   • Recent-events list — reuses the existing dispatch endpoint.
 */
export default function CaptureEventApp(): JSX.Element {
  const auth = useAuth();
  const ou = useOrgUnitBinding();
  const online = useOnlineStatus();
  const api = useDerApi() as unknown as CaptureApi;

  const [programs, setPrograms] = useState<ProgramOpt[]>([]);
  const [program, setProgram] = useState('');
  const [stages, setStages] = useState<StageOpt[]>([]);
  const [stage, setStage] = useState('');
  const [sections, setSections] = useState<FormSection[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [occurredAt, setOccurredAt] = useState(() =>
    new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [recent, setRecent] = useState<EventRow[]>([]);

  // Fetch programs once the OU is bound.
  useEffect(() => {
    if (!ou.bound) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listPrograms(ou.orgUnitUid);
        if (cancelled) return;
        const filtered = list
          .filter((p) => p.programType === 'WITHOUT_REGISTRATION')
          .map((p) => ({ id: p.id, displayName: p.displayName,
            programType: p.programType }));
        setPrograms(filtered);
        if (filtered.length === 1) setProgram(filtered[0].id);
      } catch (err) {
        if (!cancelled) {
          setStatus({ kind: 'error',
            message: 'Failed to load programs: ' + (err as Error).message });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [ou.bound, ou.orgUnitUid, api]);

  // Fetch stages when program changes; auto-pick the sole stage.
  useEffect(() => {
    setStages([]);
    setStage('');
    setSections([]);
    setValues({});
    if (program === '') return;
    let cancelled = false;
    (async () => {
      try {
        const r = await api.listCaptureProgramStages(program);
        if (cancelled) return;
        const opts = r.stages.map((s) => ({ id: s.programStageUid,
          displayName: s.displayName }));
        setStages(opts);
        if (opts.length === 1) setStage(opts[0].id);
      } catch (err) {
        if (!cancelled) {
          setStatus({ kind: 'error',
            message: 'Failed to load program stages: '
              + (err as Error).message });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [program, api]);

  // Fetch stage form schema once both program + stage are set.
  useEffect(() => {
    setSections([]);
    setValues({});
    if (program === '' || stage === '') return;
    let cancelled = false;
    (async () => {
      try {
        const form = await api.getCaptureStageForm(program, stage);
        if (cancelled) return;
        const next: FormSection[] = form.sections.map((s) => ({
          title: s.displayName,
          fields: s.fields.map((f) => ({
            fieldRef: f.fieldRef,
            dataElementUid: f.dataElementUid,
            displayName: f.dataElementDisplayName,
            valueType: f.valueType,
            required: f.requirement === 'REQUIRED',
            readonly: f.requirement === 'READONLY',
          })),
        }));
        setSections(next);
      } catch (err) {
        if (!cancelled) {
          setStatus({ kind: 'error',
            message: 'Failed to load stage form: ' + (err as Error).message });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [program, stage, api]);

  // Reload recent events on program change.
  useEffect(() => {
    if (!ou.bound || program === '') { setRecent([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await api.listCaptureProgramEvents(program,
          ou.orgUnitUid, 20);
        if (!cancelled) setRecent(r.events ?? []);
      } catch {
        if (!cancelled) setRecent([]);
      }
    })();
    return () => { cancelled = true; };
  }, [program, ou.bound, ou.orgUnitUid, api]);

  const canSubmit = useMemo(() => {
    if (!ou.bound || program === '' || stage === '') return false;
    if (status.kind === 'submitting') return false;
    // Required-field gate — every REQUIRED field must have a value.
    for (const s of sections) {
      for (const f of s.fields) {
        if (f.required && (values[f.dataElementUid] ?? '').trim() === '') {
          return false;
        }
      }
    }
    return true;
  }, [ou.bound, program, stage, status.kind, sections, values]);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setStatus({ kind: 'submitting' });
    try {
      const dataValues = Object.entries(values)
        .filter(([, v]) => v.trim() !== '')
        .map(([dataElement, value]) => ({ dataElement, value }));
      await api.submitEvent({
        program, programStage: stage, orgUnit: ou.orgUnitUid,
        occurredAt: new Date(occurredAt + 'T00:00:00Z').toISOString(),
        dataValues,
      });
      setStatus({ kind: 'ok',
        message: `Event submitted (${dataValues.length} value`
          + `${dataValues.length === 1 ? '' : 's'}).` });
      setValues({});
      // Re-fetch the recent list so the operator sees their new row.
      const r = await api.listCaptureProgramEvents(program, ou.orgUnitUid, 20);
      setRecent(r.events ?? []);
    } catch (err) {
      setStatus({ kind: 'error',
        message: (err as Error).message ?? 'Submission failed' });
    }
  }

  return (
    <ScreenCard
      title="Event capture"
      actions={
        <StatusPill tone={online.isOnline ? 'success' : 'warning'}>
          {online.isOnline ? 'online' : `offline (${online.queuedCount} queued)`}
        </StatusPill>
      }
    >
      <style>{CE_STYLES}</style>
      <p className="ce-sub">
        Signed in as <strong>{auth.displayName}</strong> · Bound OU{' '}
        <code className="ce-ou" title={ou.orgUnitPath}>
          {ou.orgUnitDisplayName || ou.orgUnitUid}
        </code>
      </p>
      {!ou.bound && (
        <p className="ce-warn">
          Device is not bound to an organisation unit — ask an admin to
          complete provisioning before capturing events.
        </p>
      )}

      <div className="ce-toolbar">
        <label className="ce-field">
          <span className="ce-field__label">Program</span>
          <select className="ce-field__select"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  data-test="ce-program-select"
                  disabled={!ou.bound || programs.length === 0}>
            <option value="">— select —</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
        </label>
        <label className="ce-field">
          <span className="ce-field__label">Stage</span>
          <select className="ce-field__select"
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  data-test="ce-stage-select"
                  disabled={stages.length <= 1}>
            {stages.length === 0 && <option value="">—</option>}
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.displayName}</option>
            ))}
          </select>
        </label>
        <label className="ce-field">
          <span className="ce-field__label">Event date</span>
          <input className="ce-field__input"
                 type="date"
                 value={occurredAt}
                 onChange={(e) => setOccurredAt(e.target.value)}
                 data-test="ce-occurred-at" />
        </label>
      </div>

      {sections.length > 0 && (
        <form onSubmit={onSubmit} className="ce-form"
              data-test="ce-form">
          {sections.map((s, i) => (
            <fieldset key={s.title + i} className="ce-section">
              {s.title && (
                <legend className="ce-section__title">{s.title}</legend>
              )}
              <div className="ce-section__grid">
                {s.fields.map((f) => (
                  <label key={f.fieldRef} className="ce-input"
                         data-test={'ce-field-' + f.dataElementUid}>
                    <span className="ce-input__label">
                      {f.displayName}
                      {f.required && <span className="ce-input__req">*</span>}
                    </span>
                    <FieldInput field={f}
                                value={values[f.dataElementUid] ?? ''}
                                onChange={(v) => setValues((prev) => ({
                                  ...prev, [f.dataElementUid]: v,
                                }))} />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="ce-form__actions">
            <button type="submit" disabled={!canSubmit}
                    className="ce-btn ce-btn--primary"
                    data-test="ce-submit-btn">
              {status.kind === 'submitting' ? 'Submitting…' : 'Submit event'}
            </button>
            <span className="ce-form__hint">
              Required fields marked <span className="ce-input__req">*</span>
            </span>
          </div>
        </form>
      )}

      {status.kind === 'ok' && (
        <div className="ce-strip ce-strip--ok" data-test="ce-ok">
          {status.message}
        </div>
      )}
      {status.kind === 'error' && (
        <div className="ce-strip ce-strip--err" data-test="ce-err">
          {status.message}
        </div>
      )}

      <h3 className="ce-heading">
        Recent events {recent.length > 0 && <span>({recent.length})</span>}
      </h3>
      {recent.length === 0 ? (
        <p className="ce-empty">
          {program === ''
            ? 'Pick a program to see recent events.'
            : status.kind === 'loading' ? 'Loading…' : 'No events yet.'}
        </p>
      ) : (
        <ul className="ce-list" data-test="ce-recent">
          {recent.map((e, i) => (
            <li key={(e.eventUid ?? e.event ?? '') + i} className="ce-list__row">
              <code>{e.eventUid ?? e.event ?? '—'}</code>
              <span className="ce-list__when">
                {e.occurredDate ?? e.occurredAt ?? e.eventDate ?? '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ScreenCard>
  );
}

/**
 * Typed input per DHIS2 value-type. Falls back to a plain text input
 * for anything exotic (we'll grow coverage per value-type in later
 * slices).
 */
function FieldInput({ field, value, onChange }: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
}): JSX.Element {
  const common = {
    value, onChange: (e: { target: { value: string } }) =>
      onChange(e.target.value),
    readOnly: field.readonly,
    disabled: field.readonly,
    className: 'ce-input__ctl'
      + (field.readonly ? ' ce-input__ctl--ro' : ''),
    required: field.required,
  };
  switch (field.valueType) {
    case 'INTEGER':
    case 'INTEGER_POSITIVE':
    case 'INTEGER_NEGATIVE':
    case 'INTEGER_ZERO_OR_POSITIVE':
    case 'NUMBER':
    case 'PERCENTAGE':
      return <input type="number" {...common} />;
    case 'DATE':
      return <input type="date" {...common} />;
    case 'DATETIME':
      return <input type="datetime-local" {...common} />;
    case 'TIME':
      return <input type="time" {...common} />;
    case 'BOOLEAN':
    case 'TRUE_ONLY':
      return (
        <select {...common}>
          <option value="">—</option>
          <option value="true">Yes</option>
          {field.valueType === 'BOOLEAN' && <option value="false">No</option>}
        </select>
      );
    case 'LONG_TEXT':
      return <textarea rows={3} {...common} />;
    case 'EMAIL':
      return <input type="email" {...common} />;
    case 'URL':
      return <input type="url" {...common} />;
    case 'PHONE_NUMBER':
      return <input type="tel" {...common} />;
    default:
      return <input type="text" {...common} />;
  }
}

interface CaptureApi {
  listPrograms: (orgUnit?: string) => Promise<Array<{
    id: string; displayName: string;
    programType: 'WITH_REGISTRATION' | 'WITHOUT_REGISTRATION';
  }>>;
  listCaptureProgramStages: (programUid: string) => Promise<{
    stages: Array<{ programStageUid: string; displayName: string }>;
  }>;
  getCaptureStageForm: (programUid: string, stageUid: string) => Promise<{
    sections: Array<{ displayName: string;
      fields: Array<{ fieldRef: string; dataElementUid: string;
        dataElementDisplayName: string; valueType: string;
        requirement: 'REQUIRED' | 'OPTIONAL' | 'READONLY' }>;
    }>;
  }>;
  listCaptureProgramEvents: (programUid: string, orgUnit: string,
    limit?: number) => Promise<{ events: EventRow[] }>;
  submitEvent: (body: {
    program: string; programStage?: string; orgUnit: string;
    occurredAt: string; dataValues: Array<{ dataElement: string; value: string }>;
  }) => Promise<unknown>;
}

const CE_STYLES = `
.ce-sub { margin: 0; color: #4a5768; font-size: 13px; }
.ce-ou { background: #eef2f8; padding: 1px 6px; border-radius: 4px;
         font-size: 12px; margin-inline: 4px; }
.ce-warn { margin-top: 12px; color: #8a2525;
           background: #fbeaea; border: 1px solid #e0bcbc;
           padding: 8px 12px; border-radius: 4px; }
.ce-toolbar { margin-top: 16px; display: grid;
              grid-template-columns: 2fr 2fr 1fr; gap: 12px;
              align-items: end; }
.ce-field { display: flex; flex-direction: column; gap: 4px; }
.ce-field__label { font-size: 11px; text-transform: uppercase;
                   letter-spacing: 0.06em; color: #6e7a8a; }
.ce-field__select, .ce-field__input {
  padding: 6px 8px; border: 1px solid #aaa; border-radius: 3px;
  font-size: 14px; background: #fff;
}
.ce-field__select:focus, .ce-field__input:focus {
  outline: none; border-color: #147CD7;
  box-shadow: 0 0 0 2px rgba(20,124,215,0.2);
}
.ce-form { margin-top: 16px; display: flex; flex-direction: column;
           gap: 16px; }
.ce-section { border: 1px solid #e3e8f0; border-radius: 6px;
              padding: 10px 14px; background: #fcfdfe; }
.ce-section__title { font-size: 12px; text-transform: uppercase;
                     letter-spacing: 0.06em; color: #147CD7;
                     padding: 0 6px; font-weight: 600; }
.ce-section__grid { display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: 10px 14px; margin-top: 8px; }
.ce-input { display: flex; flex-direction: column; gap: 4px; }
.ce-input__label { font-size: 12px; color: #263352; font-weight: 500; }
.ce-input__req { color: #D32F2F; margin-left: 2px; }
.ce-input__ctl {
  padding: 6px 8px; border: 1px solid #aaa; border-radius: 3px;
  font-size: 14px; background: #fff; font-family: inherit;
}
.ce-input__ctl:focus {
  outline: none; border-color: #147CD7;
  box-shadow: 0 0 0 2px rgba(20,124,215,0.2);
}
.ce-input__ctl--ro { background: #f3f5f8; color: #6e7a8a; }
.ce-form__actions { display: flex; align-items: center; gap: 12px;
                    padding-top: 4px; }
.ce-form__hint { color: #6e7a8a; font-size: 12px; }
.ce-btn {
  padding: 7px 18px; border-radius: 3px; font-size: 14px;
  font-weight: 500; cursor: pointer; border: 1px solid transparent;
}
.ce-btn--primary {
  background: #147CD7; color: #fff; border-color: #0a5497;
}
.ce-btn--primary:hover:not(:disabled) { background: #0a5497; }
.ce-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.ce-strip { margin-top: 12px; padding: 8px 12px; border-radius: 4px;
            font-size: 13px; }
.ce-strip--ok  { background: #ecf7f0; color: #136436;
                 border: 1px solid #b7dcc7; }
.ce-strip--err { background: #fbeaea; color: #8a2525;
                 border: 1px solid #e0bcbc; }
.ce-heading { margin-top: 20px; font-size: 12px; text-transform: uppercase;
              letter-spacing: 0.08em; color: #6e7a8a;
              border-bottom: 1px solid #d7dde5; padding-bottom: 6px; }
.ce-heading span { color: #94a3b8; font-weight: 400; }
.ce-empty { color: #6e7a8a; font-size: 13px; }
.ce-list { margin: 0; padding: 0; list-style: none; }
.ce-list__row { padding: 6px 0; border-bottom: 1px solid #eef0f3;
                display: flex; justify-content: space-between;
                font-size: 13px; }
.ce-list__when { color: #6e7a8a; }
`;
