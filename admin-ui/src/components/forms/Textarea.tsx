import type { ChangeEvent, TextareaHTMLAttributes } from 'react';
import { FieldShell, describedByFor } from './FieldShell';

/**
 * UX-B canonical textarea.
 *
 * Replaces the handful of hand-rolled `<textarea className="ea-input">`
 * sites across admin screens (cron free-form, workflow copy, device
 * notes). FieldShell owns label + hint + error.
 */
type Native = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value' | 'onChange' | 'id' | 'className'>;

export interface TextareaProps extends Native {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly hint?: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly rows?: number;
  readonly mono?: boolean;
  readonly testId?: string;
}

export function Textarea(
  { id, label, value, onChange, hint, error, required,
    rows = 4, mono, testId, ...rest }: TextareaProps,
): JSX.Element {
  return (
    <FieldShell id={id} label={label} required={required}
                 hint={hint} error={error} testId={testId}>
      <textarea
        id={id}
        value={value}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        className={mono ? 'ea-input ea-mono' : 'ea-input'}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedByFor(id, hint, error)}
        required={required}
        data-test={testId ? `${testId}-input` : undefined}
        {...rest}
      />
    </FieldShell>
  );
}
