import type { ChangeEvent, InputHTMLAttributes } from 'react';
import { FieldShell, describedByFor } from './FieldShell';

/**
 * UX-B canonical numeric input.
 *
 * Returns numbers (not strings) via onChange so callers never need to
 * parseInt at the call site. An empty field emits `null` so blank
 * state is distinguishable from 0 — important for optional cron
 * fields, batch sizes, and anything else where "unset" matters.
 */
type Native = Omit<InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'id' | 'className' | 'type'>;

export interface NumberInputProps extends Native {
  readonly id: string;
  readonly label: string;
  readonly value: number | null;
  readonly onChange: (next: number | null) => void;
  readonly hint?: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly testId?: string;
}

export function NumberInput(
  { id, label, value, onChange, hint, error, required,
    min, max, step, testId, ...rest }: NumberInputProps,
): JSX.Element {
  return (
    <FieldShell id={id} label={label} required={required}
                 hint={hint} error={error} testId={testId}>
      <input
        id={id}
        type="number"
        value={value === null ? '' : String(value)}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(null);
            return;
          }
          const n = Number(raw);
          if (!Number.isNaN(n)) onChange(n);
        }}
        className="ea-input"
        min={min}
        max={max}
        step={step}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedByFor(id, hint, error)}
        required={required}
        data-test={testId ? `${testId}-input` : undefined}
        {...rest}
      />
    </FieldShell>
  );
}
