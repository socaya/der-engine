import type { RunValidationState } from '../hooks/useRunValidation';

/**
 * §2.3.30 — surface progressive-validation findings on a capture
 * screen. Renders a compact banner with error/warning counts and the
 * CREATEEVENT cues (they're not blocking, but operators should see
 * them). Returns null when there's nothing to show.
 */
export interface RunValidationBannerProps {
  state: RunValidationState;
  /** Optional override for the testid root — makes it easy to drop
   *  the banner into any capture screen without stepping on existing
   *  element ids. */
  testId?: string;
}

export function RunValidationBanner({ state, testId = 'run-validation-banner' }:
    RunValidationBannerProps): JSX.Element | null {
  if (state.loading || state.error) {
    return null;
  }
  const warnings = state.issues.filter((i) => i.severity === 'WARNING').length;
  const errors = state.errorCount;
  const cues = state.createEventCues;
  if (errors === 0 && warnings === 0 && cues.length === 0) {
    return null;
  }
  const tone = errors > 0 ? 'error' : warnings > 0 ? 'warning' : 'info';
  return (
    <aside className={`run-validation-banner is-${tone}`} data-test={testId}>
      <div className="run-validation-banner-head">
        {errors > 0 && (
          <span className="run-validation-count run-validation-count--error"
                 data-test={`${testId}-errors`}>
            {errors} blocking issue{errors === 1 ? '' : 's'}
          </span>
        )}
        {warnings > 0 && (
          <span className="run-validation-count run-validation-count--warning"
                 data-test={`${testId}-warnings`}>
            {warnings} warning{warnings === 1 ? '' : 's'}
          </span>
        )}
        {cues.length > 0 && (
          <span className="run-validation-count run-validation-count--info"
                 data-test={`${testId}-cues`}>
            {cues.length} follow-up event{cues.length === 1 ? '' : 's'} suggested
          </span>
        )}
      </div>
      {cues.length > 0 && (
        <ul className="run-validation-cues" data-test={`${testId}-cue-list`}>
          {cues.slice(0, 3).map((c) => (
            <li key={c.issueId}>{c.message}</li>
          ))}
        </ul>
      )}
    </aside>
  );
}
