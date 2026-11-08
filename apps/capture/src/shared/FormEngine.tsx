import { useEffect, useState } from 'react';
import type { CaptureField, CaptureFormSection } from './model';
import type { CaptureApi } from './types';

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
  { api, sections, values, onChange }: {
    api: CaptureApi;
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
                <FieldInput api={api} field={f}
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
  if (field.optionSetId) {
    return <OptionSetSelect api={api} field={field}
                             value={value}
                             onChange={onChange} />;
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

/** Process-wide cache keyed by option-set UID. Hit once per app
 *  lifetime; every form on the page shares the entry. */
const optionSetCache = new Map<string, Promise<ReadonlyArray<{
  code: string; displayName: string; sortOrder: number;
}>>>();

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
