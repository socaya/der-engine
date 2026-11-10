import type { ChangeEvent, InputHTMLAttributes } from 'react';
import { FieldShell, describedByFor } from './FieldShell';

/**
 * UX-B canonical text input.
 *
 * Replaces ad-hoc `<input className="ea-input">` sites across admin
 * screens. Owns the label/hint/error plumbing via FieldShell and
 * accepts the same props a native `<input>` does for type="text" |
 * "email" | "url" | "search" | "password" | "tel" — picks up the
 * `.ea-input` sizing + focus rules from the shared stylesheet.
 */
type Native = Omit<InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'id' | 'className'>;

export interface TextInputProps extends Native {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly hint?: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly mono?: boolean;
  readonly testId?: string;
}

export function TextInput(
  { id, label, value, onChange, hint, error, required, mono,
    testId, type = 'text', ...rest }: TextInputProps,
): JSX.Element {
  return (
    <FieldShell id={id} label={label} required={required}
                 hint={hint} error={error} testId={testId}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className={mono ? 'ea-input ea-mono' : 'ea-input'}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedByFor(id, hint, error)}
        required={required}
        data-test={testId ? `${testId}-input` : undefined}
        {...rest}
      />
    </FieldShell>
  );
}
