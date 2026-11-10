import type { ReactNode } from 'react';

/**
 * UX-B shared label + hint + error wrapper for every form field in
 * the admin UI.
 *
 * Form fields are the single most common affordance on these screens
 * and before UX-B every picker (Cron, DateRange, Period, Metadata,
 * Dhis2User, Workflow) rolled its own label + hint + error markup.
 * That meant five different ways to announce required / invalid / hint
 * copy to assistive tech. FieldShell owns those four slots exactly
 * once; every field component in this folder composes it.
 *
 * The visual layout is a vertical stack: label → control → hint OR
 * error. Hint is neutral copy; error overrides hint when present.
 * `id` on the control is required so the label's `for` and the
 * aria-describedby chain stay in sync.
 */
export interface FieldShellProps {
  readonly id: string;
  readonly label: string;
  readonly required?: boolean;
  readonly hint?: string;
  readonly error?: string;
  readonly children: ReactNode;
  readonly testId?: string;
}

export function FieldShell(
  { id, label, required, hint, error, children, testId }: FieldShellProps,
): JSX.Element {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="ea-field" data-test={testId}>
      <label htmlFor={id} className="ea-field-label">
        {label}
        {required && (
          <span className="ea-field-required" aria-hidden="true"> *</span>
        )}
      </label>
      {children}
      {error && (
        <span id={errorId} className="ea-field-error" role="alert"
              data-test={testId ? `${testId}-error` : undefined}>
          {error}
        </span>
      )}
      {!error && hint && (
        <span id={hintId} className="ea-field-hint"
              data-test={testId ? `${testId}-hint` : undefined}>
          {hint}
        </span>
      )}
    </div>
  );
}

/** ids for aria-describedby — exported so field components compose. */
export function describedByFor(
  id: string, hint?: string, error?: string,
): string | undefined {
  const ids: string[] = [];
  if (error) ids.push(`${id}-error`);
  else if (hint) ids.push(`${id}-hint`);
  return ids.length > 0 ? ids.join(' ') : undefined;
}
