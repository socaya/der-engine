import { useEffect, useState } from 'react';
import type { CaptureField } from './model';
import type { CaptureApi } from './types';
import { openDatePicker, openDatePickerOnFocus } from './openDatePicker';

/**
 * Typed cell input for the spreadsheet-mode event grid. Mirrors
 * the FormEngine's {@code FieldInput} logic (DHIS2 value-type →
 * input shape) but with chrome tuned for a dense grid: no label,
 * flat border, compact padding, inherits cell width.
 *
 * <p>Date and datetime cells pop the native calendar on both
 * {@code click} and {@code focus} so arrow / Tab navigation into
 * the cell opens the picker just like Excel / Google Sheets.</p>
 *
 * <p>Option-set cells share the FormEngine's module-level cache —
 * the options are fetched once per option-set UID and reused by
 * every row + every page.</p>
 */
export function SheetCell(
  { api, field, value, onChange, onCommit, autoFocus }: {
    api: CaptureApi;
    field: CaptureField;
    value: string;
    /** Called on every keystroke; parent debounces. */
    onChange: (v: string) => void;
    /** Called on blur/change-commit so the parent can trigger a
     *  save immediately when the operator moves to the next cell
     *  (matches Excel's enter-to-commit behaviour). */
    onCommit?: () => void;
    autoFocus?: boolean;
  },
): JSX.Element {
  const baseProps = {
    value,
    autoFocus,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    onBlur: onCommit,
    readOnly: field.readonly,
    disabled: field.readonly,
    className: 'cap-sheet__cell-input'
      + (field.readonly ? ' cap-sheet__cell-input--ro' : ''),
    required: field.required,
  };
  if (field.optionSetId) {
    return <OptionSetCell api={api} field={field}
                           value={value}
                           onChange={onChange}
                           onCommit={onCommit}
                           autoFocus={autoFocus} />;
  }
  switch (field.valueType) {
    case 'INTEGER':
    case 'INTEGER_POSITIVE':
    case 'INTEGER_NEGATIVE':
    case 'INTEGER_ZERO_OR_POSITIVE':
    case 'NUMBER':
    case 'PERCENTAGE':
      return <input type="number" {...baseProps} />;
    case 'DATE':
      return <input type="date" {...baseProps}
                     onClick={openDatePicker}
                     onFocus={openDatePickerOnFocus} />;
    case 'DATETIME':
      return <input type="datetime-local" {...baseProps}
                     onClick={openDatePicker}
                     onFocus={openDatePickerOnFocus} />;
    case 'TIME':
      return <input type="time" {...baseProps}
                     onClick={openDatePicker}
                     onFocus={openDatePickerOnFocus} />;
    case 'BOOLEAN':
      return (
        <select {...baseProps}>
          <option value="">—</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    case 'TRUE_ONLY':
      return (
        <select {...baseProps}>
          <option value="">—</option>
          <option value="true">Yes</option>
        </select>
      );
    case 'LONG_TEXT':
      return <input type="text" {...baseProps}
                     placeholder="(long text — use detail view)" />;
    case 'EMAIL':
      return <input type="email" {...baseProps} />;
    case 'URL':
      return <input type="url" {...baseProps} />;
    case 'PHONE_NUMBER':
      return <input type="tel" {...baseProps} />;
    default:
      return <input type="text" {...baseProps} />;
  }
}

/** Shared cache so every sheet row paints option-set <option>s from
 *  the same fetched array. Also shared with FormEngine when it
 *  ships here — the cache key is the option-set UID. */
const sheetOptionSetCache = new Map<string, Promise<ReadonlyArray<{
  code: string; displayName: string; sortOrder: number;
}>>>();

function OptionSetCell(
  { api, field, value, onChange, onCommit, autoFocus }: {
    api: CaptureApi; field: CaptureField; value: string;
    onChange: (v: string) => void;
    onCommit?: () => void;
    autoFocus?: boolean;
  },
): JSX.Element {
  const uid = field.optionSetId!;
  const [options, setOptions] = useState<ReadonlyArray<{
    code: string; displayName: string; sortOrder: number;
  }> | null>(null);
  useEffect(() => {
    let cancelled = false;
    let p = sheetOptionSetCache.get(uid);
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
      sheetOptionSetCache.set(uid, p);
    }
    p.then((opts) => { if (!cancelled) setOptions(opts); })
      .catch(() => { if (!cancelled) setOptions([]); });
    return () => { cancelled = true; };
  }, [uid, api]);
  if (options === null) {
    return (
      <input type="text"
             className="cap-sheet__cell-input"
             value={value}
             autoFocus={autoFocus}
             onChange={(e) => onChange(e.target.value)}
             onBlur={onCommit}
             readOnly={field.readonly}
             disabled={field.readonly}
             placeholder="loading…" />
    );
  }
  return (
    <select className="cap-sheet__cell-input"
            value={value}
            autoFocus={autoFocus}
            onChange={(e) => { onChange(e.target.value); onCommit?.(); }}
            onBlur={onCommit}
            disabled={field.readonly}
            required={field.required}>
      <option value="">—</option>
      {options.map((o) => (
        <option key={o.code} value={o.code}>{o.displayName}</option>
      ))}
    </select>
  );
}
