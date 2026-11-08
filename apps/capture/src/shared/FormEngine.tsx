import type { CaptureField, CaptureFormSection } from './model';

/**
 * Shared metadata-driven form renderer — one implementation used
 * by both {@code EventWorkflow} and {@code TrackerWorkflow} so a
 * typed value only has to be fixed once (requirements doc §1,
 * §10 "Shared dynamic form component"). Consumes the typed
 * {@link CaptureFormSection} shape produced by the G2 parser so
 * every rendering decision maps back to a server metadata field.
 */
export function FormEngine(
  { sections, values, onChange }: {
    sections: readonly CaptureFormSection[];
    values: Record<string, string>;
    onChange: (dataElementUid: string, value: string) => void;
  },
): JSX.Element {
  return (
    <div className="cap-form" data-test="cap-form">
      {sections.map((s, i) => (
        <fieldset key={(s.id ?? s.displayName) + ':' + i}
                  className="cap-form-section">
          {s.displayName && (
            <legend className="cap-form-section__title">
              {s.displayName}
            </legend>
          )}
          <div className="cap-form-section__grid">
            {s.fields.map((f) => (
              <label key={f.fieldRef} className="cap-input"
                     data-test={'cap-field-' + f.id}>
                <span className="cap-input__label">
                  {f.label}
                  {f.required && <span className="cap-input__req">*</span>}
                </span>
                <FieldInput field={f}
                            value={values[f.id] ?? ''}
                            onChange={(v) => onChange(f.id, v)} />
                {f.description && (
                  <span className="cap-input__help">{f.description}</span>
                )}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

/**
 * Typed input per DHIS2 value-type (§10.1 FR-002). Falls back to
 * a plain text input for types that need richer UX than a native
 * control (option sets, file, image, geometry) — we'll grow the
 * matrix as G3 adds the dedicated controls.
 */
function FieldInput(
  { field, value, onChange }: {
    field: CaptureField; value: string;
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
