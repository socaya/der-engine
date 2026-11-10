import type { ChangeEvent, InputHTMLAttributes } from 'react';
import { FieldShell, describedByFor } from './FieldShell';

/**
 * UX-B canonical date picker.
 *
 * Thin wrapper over native `<input type="date">` with FieldShell
 * label + hint + error plumbing. Returns the ISO yyyy-MM-dd string
 * exactly as the browser surfaces it; callers that need a Date
 * object should convert at the boundary.
 */
type Native = Omit<InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'id' | 'className' | 'type'>;

export interface DatePickerProps extends Native {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly hint?: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly min?: string;
  readonly max?: string;
  readonly testId?: string;
}

export function DatePicker(
  { id, label, value, onChange, hint, error, required,
    min, max, testId, ...rest }: DatePickerProps,
): JSX.Element {
  return (
    <FieldShell id={id} label={label} required={required}
                 hint={hint} error={error} testId={testId}>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className="ea-input ea-mono"
        min={min}
        max={max}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedByFor(id, hint, error)}
        required={required}
        data-test={testId ? `${testId}-input` : undefined}
        {...rest}
      />
    </FieldShell>
  );
}
