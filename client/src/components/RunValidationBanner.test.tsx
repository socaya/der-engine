import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RunValidationBanner } from './RunValidationBanner';
import type { RunValidationState } from '../hooks/useRunValidation';
import type { ValidationIssue } from '../api/edgeApi';

function state(partial: Partial<RunValidationState> = {}): RunValidationState {
  return {
    issues: [],
    errorCount: 0,
    hiddenFields: new Set<string>(),
    assignedValues: new Map<string, string>(),
    createEventCues: [],
    loading: false,
    error: null,
    ...partial,
  };
}

function cue(id: string, message = 'schedule follow-up'): ValidationIssue {
  return {
    issueId: id, runId: 'r1', stepId: null,
    code: 'PROGRAM_RULE_CREATEEVENT', severity: 'INFO',
    message, fieldRef: null,
  };
}

function warning(id: string): ValidationIssue {
  return {
    issueId: id, runId: 'r1', stepId: null,
    code: 'PROGRAM_RULE_SHOWWARNING', severity: 'WARNING',
    message: 'heads up', fieldRef: null,
  };
}

describe('RunValidationBanner', () => {
  it('returns null while loading', () => {
    const { container } = render(
      <RunValidationBanner state={state({ loading: true })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when the run-validation call errored', () => {
    const { container } = render(
      <RunValidationBanner state={state({ error: 'boom' })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when there are no errors, warnings, or cues', () => {
    const { container } = render(<RunValidationBanner state={state()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the error count (singular copy at 1)', () => {
    render(<RunValidationBanner state={state({ errorCount: 1 })} />);
    const chip = screen.getByTestId('run-validation-banner-errors');
    expect(chip).toHaveTextContent('1 blocking issue');
    expect(chip.textContent).not.toContain('issues');
  });

  it('renders plural copy and error tone when multiple errors', () => {
    render(<RunValidationBanner state={state({ errorCount: 3 })} />);
    const chip = screen.getByTestId('run-validation-banner-errors');
    expect(chip).toHaveTextContent('3 blocking issues');
    const banner = chip.closest('aside');
    expect(banner?.className).toContain('is-error');
  });

  it('renders the warning count with singular copy at 1 and warning tone', () => {
    render(<RunValidationBanner state={state({ issues: [warning('w1')] })} />);
    const chip = screen.getByTestId('run-validation-banner-warnings');
    expect(chip).toHaveTextContent('1 warning');
    expect(chip.textContent).not.toContain('warnings');
    const banner = chip.closest('aside');
    expect(banner?.className).toContain('is-warning');
  });

  it('renders plural warnings copy', () => {
    render(
      <RunValidationBanner
        state={state({ issues: [warning('w1'), warning('w2')] })}
      />,
    );
    expect(screen.getByTestId('run-validation-banner-warnings'))
      .toHaveTextContent('2 warnings');
  });

  it('renders cues with singular copy at 1 and info tone, listing up to 3', () => {
    const cues = [cue('c1', 'first')];
    render(<RunValidationBanner state={state({ createEventCues: cues })} />);
    const chip = screen.getByTestId('run-validation-banner-cues');
    expect(chip).toHaveTextContent('1 follow-up event suggested');
    const banner = chip.closest('aside');
    expect(banner?.className).toContain('is-info');
    const list = screen.getByTestId('run-validation-banner-cue-list');
    expect(list.querySelectorAll('li')).toHaveLength(1);
  });

  it('renders plural cue copy and caps the list at 3 items', () => {
    const cues = [cue('c1', 'one'), cue('c2', 'two'),
                   cue('c3', 'three'), cue('c4', 'four')];
    render(<RunValidationBanner state={state({ createEventCues: cues })} />);
    expect(screen.getByTestId('run-validation-banner-cues'))
      .toHaveTextContent('4 follow-up events suggested');
    const list = screen.getByTestId('run-validation-banner-cue-list');
    expect(list.querySelectorAll('li')).toHaveLength(3);
  });

  it('honours the testId override', () => {
    render(
      <RunValidationBanner
        state={state({ errorCount: 1 })}
        testId="custom-banner"
      />,
    );
    expect(screen.getByTestId('custom-banner-errors')).toBeInTheDocument();
  });

  it('renders errors + warnings + cues together (error tone wins)', () => {
    render(
      <RunValidationBanner
        state={state({
          errorCount: 2,
          issues: [warning('w1')],
          createEventCues: [cue('c1')],
        })}
      />,
    );
    const banner = screen.getByTestId('run-validation-banner-errors')
      .closest('aside');
    expect(banner?.className).toContain('is-error');
    expect(screen.getByTestId('run-validation-banner-warnings'))
      .toBeInTheDocument();
    expect(screen.getByTestId('run-validation-banner-cues'))
      .toBeInTheDocument();
  });
});
