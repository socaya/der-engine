import { useEffect, useState } from 'react';
import type { CaptureField, CaptureFormSection } from './model';
import type { RuleWarning } from './ruleEngine';
import type { CaptureApi } from './types';
import { DerDatePicker } from './DerDatePicker';

/**
 * Shared metadata-driven form renderer — one implementation used
 * by both {@code EventWorkflow} and {@code TrackerWorkflow} so a
 * typed value only has to be fixed once (requirements doc §1,
 * §10 "Shared dynamic form component"). Consumes the typed
 * {@link CaptureFormSection} shape produced by the G2 parser so
 * every rendering decision maps back to a server metadata field.
 *
 * <p>Passing {@code api} down lets option-set fields fetch their
 * options lazily. Option sets are cached in a module-level Map
 * so repeated renders don't refetch, and every form across the
 * app shares the same cache.</p>
 */
export function FormEngine(
  { api, sections, values, onChange, warnings }: {
    api: CaptureApi;
    sections: readonly CaptureFormSection[];
    values: Record<string, string>;
    onChange: (dataElementUid: string, value: string) => void;
    /** Optional per-field rule warnings. When a field id is present
     *  as a key, its warnings are rendered inline beneath the input
     *  (§PR-005 — distinguish advisory from blocking severity). */
    warnings?: ReadonlyMap<string, readonly RuleWarning[]>;
  },
): JSX.Element {
  return (
    <div className="cap-form" data-test="cap-form">
      {sections.map((s, i) => (
        <FormSectionRenderer key={(s.id ?? s.displayName) + ':' + i}
                              api={api} section={s} index={i}
                              values={values} onChange={onChange}
                              warnings={warnings} />
      ))}
    </div>
  );
}

function FormSectionRenderer(
  { api, section: s, index: i, values, onChange, warnings }: {
    api: CaptureApi;
    section: CaptureFormSection;
    index: number;
    values: Record<string, string>;
    onChange: (dataElementUid: string, value: string) => void;
    warnings?: ReadonlyMap<string, readonly RuleWarning[]>;
  },
): JSX.Element {
  // Per-section filled count so operators see progress without
  // counting empty inputs by eye. Required-only count surfaces
  // how close they are to Save-eligible.
  let filled = 0;
  let requiredTotal = 0;
  let requiredFilled = 0;
  for (const f of s.fields) {
    const v = (values[f.id] ?? '').trim();
    if (v !== '') filled++;
    if (f.required) {
      requiredTotal++;
      if (v !== '') requiredFilled++;
    }
  }
  // SEQUENTIAL sections step through one field at a time; MATRIX
  // renders a row × col table; LISTING (default) is the responsive
  // grid every pre-Phase-1 form used.
  const [stepIdx, setStepIdx] = useState(0);
  const sectionBody = s.renderType === 'SEQUENTIAL'
    ? renderSequential()
    : s.renderType === 'MATRIX'
    ? renderMatrix()
    : renderListing();
  return (
    <fieldset className="cap-form-section"
              data-render-type={s.renderType}>
      {s.displayName && (
        <legend className="cap-form-section__title">
          <span className="cap-form-section__title-text">
            {s.displayName}
          </span>
          <span className="cap-form-section__title-count"
                data-test={'cap-form-section-count-'
                  + (s.id ?? i)}>
            {filled}/{s.fields.length} filled
            {requiredTotal > 0 && (
              <>
                {' · '}
                <span className={requiredFilled === requiredTotal
                  ? 'cap-form-section__req-ok'
                  : 'cap-form-section__req-pending'}>
                  {requiredFilled}/{requiredTotal} required
                </span>
              </>
            )}
          </span>
        </legend>
      )}
      {sectionBody}
    </fieldset>
  );

  function renderListing(): JSX.Element {
    return (
      <div className="cap-form-section__grid">
        {s.fields.map((f) => renderFieldLabel(f))}
      </div>
    );
  }

  function renderMatrix(): JSX.Element {
    // MATRIX currently renders as a compact table: one row per
    // field, columns = label, input, note. Future slice: honour
    // DHIS2's real matrix (categoryOptionCombo pivot) when the
    // mirror surfaces that shape. For today the grid-density is
    // the main visible difference vs LISTING.
    return (
      <table className="cap-form-section__matrix">
        <tbody>
          {s.fields.map((f) => {
            const fieldWarnings = warnings?.get(f.id) ?? [];
            return (
              <tr key={f.fieldRef}
                  data-test={'cap-field-' + f.id}>
                <th scope="row" className="cap-form-section__matrix-label">
                  {f.label}
                  {f.required && <span className="cap-input__req">*</span>}
                </th>
                <td className="cap-form-section__matrix-input">
                  <FieldInput api={api} field={f}
                              value={values[f.id] ?? ''}
                              onChange={(v) => onChange(f.id, v)} />
                </td>
                <td className="cap-form-section__matrix-note">
                  {f.description && (
                    <span className="cap-input__help">{f.description}</span>
                  )}
                  {fieldWarnings.map((w, wi) => (
                    <span key={wi}
                          className={'cap-field-warn'
                            + (w.severity === 'error'
                              ? ' cap-field-warn--err' : '')}
                          role={w.severity === 'error' ? 'alert' : 'status'}>
                      {w.severity === 'error' ? '✦ ' : '• '}{w.message}
                    </span>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  function renderSequential(): JSX.Element {
    if (s.fields.length === 0) {
      return <div className="cap-form-section__grid" />;
    }
    const safeIdx = Math.max(0, Math.min(stepIdx, s.fields.length - 1));
    const f = s.fields[safeIdx];
    return (
      <div className="cap-form-section__sequential">
        <div className="cap-form-section__sequential-progress"
             aria-label={'Field ' + (safeIdx + 1) + ' of '
               + s.fields.length}>
          Field {safeIdx + 1} of {s.fields.length}
        </div>
        <div className="cap-form-section__sequential-field">
          {renderFieldLabel(f)}
        </div>
        <div className="cap-form-section__sequential-nav">
          <button type="button" className="cap-btn cap-btn--secondary"
                  disabled={safeIdx === 0}
                  onClick={() => setStepIdx(safeIdx - 1)}>
            ← Previous
          </button>
          <span className="cap-form-section__sequential-dots"
                aria-hidden="true">
            {s.fields.map((_, fi) => (
              <span key={fi}
                    className={'cap-form-section__sequential-dot'
                      + (fi === safeIdx
                        ? ' cap-form-section__sequential-dot--active'
                        : '')} />
            ))}
          </span>
          <button type="button" className="cap-btn cap-btn--secondary"
                  disabled={safeIdx === s.fields.length - 1}
                  onClick={() => setStepIdx(safeIdx + 1)}>
            Next →
          </button>
        </div>
      </div>
    );
  }

  function renderFieldLabel(f: CaptureField): JSX.Element {
    const fieldWarnings = warnings?.get(f.id) ?? [];
    return (
      <label key={f.fieldRef} className="cap-input"
             data-test={'cap-field-' + f.id}>
        <span className="cap-input__label">
          {f.label}
          {f.required && <span className="cap-input__req">*</span>}
          {f.valueType === 'UNKNOWN' && (
            <span className="cap-chip cap-chip--warn"
                  data-test={'cap-field-fallback-' + f.id}
                  style={{ marginLeft: 6, fontSize: 10 }}
                  title={'Server advertised an unrecognised '
                    + 'value type; rendering as plain text. '
                    + 'Report the metadata to admin if this '
                    + 'should be a typed control.'}>
              fallback
            </span>
          )}
        </span>
        <FieldInput api={api} field={f}
                    value={values[f.id] ?? ''}
                    onChange={(v) => onChange(f.id, v)} />
        {f.description && (
          <span className="cap-input__help">{f.description}</span>
        )}
        {fieldWarnings.map((w, wi) => (
          <span key={wi}
                className={'cap-field-warn'
                  + (w.severity === 'error'
                    ? ' cap-field-warn--err' : '')}
                data-test={'cap-field-warn-' + f.id + '-' + wi}
                role={w.severity === 'error' ? 'alert' : 'status'}>
            {w.severity === 'error' ? '✦ ' : '• '}{w.message}
          </span>
        ))}
      </label>
    );
  }
}

/**
 * Typed input per DHIS2 value-type (§10.1 FR-002). Fields with
 * an {@code optionSetId} render as a select populated from the
 * server; other types use a native control appropriate for the
 * value-type.
 */
function FieldInput(
  { api, field, value, onChange }: {
    api: CaptureApi; field: CaptureField; value: string;
    onChange: (v: string) => void;
  },
): JSX.Element {
  const common = {
    value,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    readOnly: field.readonly,
    disabled: field.readonly,
    className: 'cap-input__ctl'
      + (field.readonly ? ' cap-input__ctl--ro' : ''),
    required: field.required,
  };
  // BOOLEAN / TRUE_ONLY with a TOGGLE renderType (Phase 2) — a
  // single on/off switch rather than a select. TRUE_ONLY toggles
  // between "" (unset) and "true"; BOOLEAN toggles true↔false and
  // starts from "" when unset.
  if ((field.valueType === 'BOOLEAN' || field.valueType === 'TRUE_ONLY')
      && field.renderType === 'TOGGLE') {
    return (
      <ToggleInput value={value} onChange={onChange}
                    disabled={field.readonly}
                    boolean={field.valueType === 'BOOLEAN'} />
    );
  }
  // Option-set backed fields: renderType selects the variant.
  // DROPDOWN (default) = <select>; VERTICAL / HORIZONTAL
  // RADIOBUTTONS = radio group; VERTICAL / HORIZONTAL
  // CHECKBOXES = multi-select stored as comma-separated codes.
  // AUTOCOMPLETE falls through to the select for today (future
  // slice: filterable combobox).
  if (field.optionSetId) {
    if (field.renderType === 'VERTICAL_RADIOBUTTONS'
        || field.renderType === 'HORIZONTAL_RADIOBUTTONS') {
      return <OptionSetRadioGroup api={api} field={field}
                                   value={value} onChange={onChange}
                                   horizontal={field.renderType
                                     === 'HORIZONTAL_RADIOBUTTONS'} />;
    }
    if (field.renderType === 'VERTICAL_CHECKBOXES'
        || field.renderType === 'HORIZONTAL_CHECKBOXES') {
      return <OptionSetCheckboxGroup api={api} field={field}
                                      value={value} onChange={onChange}
                                      horizontal={field.renderType
                                        === 'HORIZONTAL_CHECKBOXES'} />;
    }
    return <OptionSetSelect api={api} field={field}
                             value={value}
                             onChange={onChange} />;
  }
  // Numeric renderType hints — SLIDER / LINEAR_SCALE = range
  // slider, SPINNER = number input with increment arrows (the
  // native type="number" chrome). DEFAULT keeps the number
  // input chosen by value-type below.
  if ((field.renderType === 'SLIDER'
        || field.renderType === 'LINEAR_SCALE')
      && isNumericValueType(field.valueType)) {
    return (
      <SliderInput value={value} onChange={onChange}
                    readOnly={field.readonly}
                    valueType={field.valueType} />
    );
  }
  switch (field.valueType) {
    case 'INTEGER':
    case 'INTEGER_POSITIVE':
    case 'INTEGER_NEGATIVE':
    case 'INTEGER_ZERO_OR_POSITIVE':
    case 'NUMBER':
    case 'PERCENTAGE':
      return <input type="number" {...common} />;
    case 'DATE':
      return <DerDatePicker
                     className={common.className}
                     value={value}
                     onChange={onChange}
                     allowFuture={field.allowFutureDate}
                     required={field.required}
                     disabled={field.readonly}
                     readOnly={field.readonly} />;
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
          {field.valueType === 'BOOLEAN' && (
            <option value="false">No</option>
          )}
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

function isNumericValueType(vt: string): boolean {
  return vt === 'INTEGER' || vt === 'INTEGER_POSITIVE'
    || vt === 'INTEGER_NEGATIVE' || vt === 'INTEGER_ZERO_OR_POSITIVE'
    || vt === 'NUMBER' || vt === 'PERCENTAGE';
}

function ToggleInput(
  { value, onChange, disabled, boolean: isBoolean }: {
    value: string;
    onChange: (v: string) => void;
    disabled: boolean;
    boolean: boolean;
  },
): JSX.Element {
  const on = value === 'true';
  return (
    <button type="button"
            className={'cap-toggle'
              + (on ? ' cap-toggle--on' : '')}
            disabled={disabled}
            aria-pressed={on}
            onClick={() => {
              if (isBoolean) onChange(on ? 'false' : 'true');
              else onChange(on ? '' : 'true');
            }}>
      <span className="cap-toggle__track" aria-hidden="true">
        <span className="cap-toggle__dot" />
      </span>
      <span className="cap-toggle__label">
        {on ? 'Yes' : isBoolean && value === 'false' ? 'No' : '—'}
      </span>
    </button>
  );
}

function SliderInput(
  { value, onChange, readOnly, valueType }: {
    value: string;
    onChange: (v: string) => void;
    readOnly: boolean;
    valueType: string;
  },
): JSX.Element {
  // PERCENTAGE caps at 100; INTEGER_POSITIVE starts at 1; the rest
  // get a conservative 0–100 range that an admin can override by
  // hinting LINEAR_SCALE with explicit metadata in a future slice.
  const min = valueType === 'INTEGER_POSITIVE' ? 1
    : valueType === 'INTEGER_NEGATIVE' ? -100 : 0;
  const max = 100;
  const step = valueType === 'NUMBER' ? 1 : 1;
  const current = value === '' ? min : Number(value);
  return (
    <div className="cap-slider">
      <input type="range" className="cap-slider__range"
              min={min} max={max} step={step}
              value={Number.isFinite(current) ? current : min}
              onChange={(e) => onChange(e.target.value)}
              disabled={readOnly} />
      <input type="number" className="cap-slider__value"
              min={min} max={max} step={step}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              readOnly={readOnly} disabled={readOnly} />
    </div>
  );
}

/** Process-wide cache keyed by option-set UID. Hit once per app
 *  lifetime; every form on the page shares the entry. */
const optionSetCache = new Map<string, Promise<ReadonlyArray<{
  code: string; displayName: string; sortOrder: number;
}>>>();

function useOptionSetOptions(api: CaptureApi, uid: string): ReadonlyArray<{
  code: string; displayName: string; sortOrder: number;
}> | null {
  const [options, setOptions] = useState<ReadonlyArray<{
    code: string; displayName: string; sortOrder: number;
  }> | null>(null);
  useEffect(() => {
    let cancelled = false;
    let p = optionSetCache.get(uid);
    if (!p) {
      p = (async () => {
        const r = await api.getOptionSet(uid);
        if (!r) return [];
        return (r.options ?? [])
          .map((o, i) => ({
            code: o.code ?? o.id ?? '',
            displayName: o.displayName ?? o.name ?? o.code ?? '',
            sortOrder: o.sortOrder ?? i,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder);
      })();
      optionSetCache.set(uid, p);
    }
    p.then((opts) => { if (!cancelled) setOptions(opts); })
      .catch(() => { if (!cancelled) setOptions([]); });
    return () => { cancelled = true; };
  }, [uid, api]);
  return options;
}

function OptionSetRadioGroup(
  { api, field, value, onChange, horizontal }: {
    api: CaptureApi; field: CaptureField; value: string;
    onChange: (v: string) => void; horizontal: boolean;
  },
): JSX.Element {
  const options = useOptionSetOptions(api, field.optionSetId!);
  if (options === null) {
    return <span className="cap-input__help">loading options…</span>;
  }
  return (
    <div className={'cap-radio-group'
        + (horizontal ? ' cap-radio-group--h' : '')}
         role="radiogroup">
      {options.map((o) => (
        <label key={o.code} className="cap-radio">
          <input type="radio" name={'f-' + field.fieldRef}
                  value={o.code}
                  checked={value === o.code}
                  disabled={field.readonly}
                  onChange={(e) => onChange(e.target.value)} />
          <span>{o.displayName}</span>
        </label>
      ))}
    </div>
  );
}

function OptionSetCheckboxGroup(
  { api, field, value, onChange, horizontal }: {
    api: CaptureApi; field: CaptureField; value: string;
    onChange: (v: string) => void; horizontal: boolean;
  },
): JSX.Element {
  const options = useOptionSetOptions(api, field.optionSetId!);
  const checked = new Set(
    value === '' ? [] : value.split(',').map((s) => s.trim()));
  function toggle(code: string, on: boolean): void {
    const next = new Set(checked);
    if (on) next.add(code); else next.delete(code);
    onChange([...next].filter((c) => c !== '').join(','));
  }
  if (options === null) {
    return <span className="cap-input__help">loading options…</span>;
  }
  return (
    <div className={'cap-checkbox-group'
        + (horizontal ? ' cap-checkbox-group--h' : '')}
         role="group">
      {options.map((o) => (
        <label key={o.code} className="cap-checkbox">
          <input type="checkbox"
                  checked={checked.has(o.code)}
                  disabled={field.readonly}
                  onChange={(e) => toggle(o.code, e.target.checked)} />
          <span>{o.displayName}</span>
        </label>
      ))}
    </div>
  );
}

function OptionSetSelect(
  { api, field, value, onChange }: {
    api: CaptureApi; field: CaptureField; value: string;
    onChange: (v: string) => void;
  },
): JSX.Element {
  const uid = field.optionSetId!;
  const [options, setOptions] = useState<ReadonlyArray<{
    code: string; displayName: string; sortOrder: number;
  }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let p = optionSetCache.get(uid);
    if (!p) {
      p = (async () => {
        const r = await api.getOptionSet(uid);
        if (!r) return [];
        return (r.options ?? [])
          .map((o, i) => ({
            code: o.code ?? o.id ?? '',
            displayName: o.displayName ?? o.name ?? o.code ?? '',
            sortOrder: o.sortOrder ?? i,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder);
      })();
      optionSetCache.set(uid, p);
    }
    p.then((opts) => { if (!cancelled) setOptions(opts); })
      .catch(() => { if (!cancelled) setOptions([]); });
    return () => { cancelled = true; };
  }, [uid, api]);

  // While the option set is loading, degrade to a plain text
  // input so the operator can still type a code (§MD-006 — never
  // silently block on metadata).
  if (options === null) {
    return (
      <input type="text"
             value={value}
             onChange={(e) => onChange(e.target.value)}
             readOnly={field.readonly}
             disabled={field.readonly}
             className={'cap-input__ctl'
               + (field.readonly ? ' cap-input__ctl--ro' : '')}
             required={field.required}
             placeholder="loading options…" />
    );
  }
  return (
    <select value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={field.readonly}
            className={'cap-input__ctl'
              + (field.readonly ? ' cap-input__ctl--ro' : '')}
            required={field.required}>
      <option value="">—</option>
      {options.map((o) => (
        <option key={o.code} value={o.code}>{o.displayName}</option>
      ))}
    </select>
  );
}

/** Compute the "every REQUIRED field has a value" gate used by
 *  both workflows before enabling Save. */
export function requiredFieldsComplete(
  sections: readonly CaptureFormSection[],
  values: Record<string, string>,
): boolean {
  for (const s of sections) {
    for (const f of s.fields) {
      if (f.required && (values[f.id] ?? '').trim() === '') {
        return false;
      }
    }
  }
  return true;
}
