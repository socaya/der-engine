import type { ChangeEvent, SelectHTMLAttributes } from 'react';
import { FieldShell, describedByFor } from './FieldShell';

/**
 * UX-B canonical select.
 *
 * Takes `options: readonly SelectOption[]` so callers don't repeat
 * `<option value="...">...</option>` boilerplate. For dynamic option
 * groupings (e.g. program picker with headings) pass raw children via
 * `renderOptions` instead — skips the options array and renders the
 * JSX the caller supplies inline inside a native `<select>`.
 */
export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

type Native = Omit<SelectHTMLAttributes<HTMLSelectElement>,
  'value' | 'onChange' | 'id' | 'className'>;

export interface SelectProps extends Native {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly options?: readonly SelectOption[];
  readonly renderOptions?: () => JSX.Element;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly testId?: string;
}

export function Select(
  { id, label, value, onChange, options, renderOptions, placeholder,
    hint, error, required, testId, ...rest }: SelectProps,
): JSX.Element {
  return (
    <FieldShell id={id} label={label} required={required}
                 hint={hint} error={error} testId={testId}>
      <select
        id={id}
        value={value}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
        className="ea-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedByFor(id, hint, error)}
        required={required}
        data-test={testId ? `${testId}-input` : undefined}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled={required}>{placeholder}</option>
        )}
        {renderOptions ? renderOptions() : (options ?? []).map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
