import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunValidation } from './RunValidation';
import type * as edgeApi from '../../api/edgeApi';

/* RunValidation reads one run's validator findings and groups them
 * by severity. Four display branches: loading, error, empty, and
 * populated-by-severity. */

function wrap(ui: JSX.Element, route = '/workflows/validation/run-1'): JSX.Element {
  return (
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/workflows/validation/:runId" element={ui} />
      </Routes>
    </MemoryRouter>
  );
}

function issue(overrides: Partial<edgeApi.ValidationIssue> = {})
: edgeApi.ValidationIssue {
  return {
    issueId: 'iss-1', code: 'FIELD_REQUIRED',
    severity: 'ERROR', message: 'Field required',
    fieldRef: null, suggestedValue: null,
    ...overrides,
  } as unknown as edgeApi.ValidationIssue;
}

describe('RunValidation', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('loading state before probe resolves', () => {
    const api = {
      runValidation: vi.fn(() => new Promise(() => undefined)),
    };
    render(wrap(<RunValidation api={api as never} />));
    expect(screen.getByTestId('validation-loading')).toBeInTheDocument();
  });

  it('error state when runValidation rejects', async () => {
    const api = {
      runValidation: vi.fn().mockRejectedValue(new Error('fetch fail')),
    };
    render(wrap(<RunValidation api={api as never} />));
    await waitFor(() =>
      expect(screen.getByTestId('validation-error')).toBeInTheDocument());
    expect(screen.getByTestId('validation-error'))
      .toHaveTextContent(/fetch fail/);
  });

  it('empty-state when issues list is zero-length', async () => {
    const api = {
      runValidation: vi.fn().mockResolvedValue({
        errorCount: 0, issues: [],
      }),
    };
    render(wrap(<RunValidation api={api as never} />));
    await waitFor(() =>
      expect(screen.getByTestId('validation-empty')).toBeInTheDocument());
  });

  it('populated with ERROR issue renders the Errors section', async () => {
    const api = {
      runValidation: vi.fn().mockResolvedValue({
        errorCount: 1,
        issues: [issue({ code: 'ERR1', severity: 'ERROR',
                          fieldRef: 'de-1',
                          suggestedValue: 'answer' })],
      }),
    };
    render(wrap(<RunValidation api={api as never} />));
    await waitFor(() =>
      expect(screen.getByTestId('validation-error-section'))
        .toBeInTheDocument());
    /* Suggested-value chip surfaces when non-null. */
    expect(screen.getByTestId('validation-error-err1-value'))
      .toBeInTheDocument();
    /* FieldRef hint text surfaces. */
    expect(screen.getByText(/field de-1/)).toBeInTheDocument();
  });

  it('populated with WARNING + INFO sections both render', async () => {
    const api = {
      runValidation: vi.fn().mockResolvedValue({
        errorCount: 0,
        issues: [
          issue({ issueId: 'w1', code: 'WARN1', severity: 'WARNING',
                   message: 'Warn' }),
          issue({ issueId: 'i1', code: 'INFO1', severity: 'INFO',
                   message: 'Info' }),
        ],
      }),
    };
    render(wrap(<RunValidation api={api as never} />));
    await waitFor(() =>
      expect(screen.getByTestId('validation-warning-section'))
        .toBeInTheDocument());
    expect(screen.getByTestId('validation-info-section'))
      .toBeInTheDocument();
    /* Section without issues (ERROR here) should NOT render. */
    expect(screen.queryByTestId('validation-error-section')).toBeNull();
  });

  it('issue without fieldRef / suggestedValue renders bare row', async () => {
    const api = {
      runValidation: vi.fn().mockResolvedValue({
        errorCount: 1,
        issues: [issue({ code: 'BARE', severity: 'ERROR',
                          fieldRef: null, suggestedValue: null })],
      }),
    };
    render(wrap(<RunValidation api={api as never} />));
    await waitFor(() =>
      expect(screen.getByTestId('validation-error-bare'))
        .toBeInTheDocument());
    /* No field hint, no suggested-value chip. */
    expect(screen.queryByTestId('validation-error-bare-value')).toBeNull();
  });

  it('runId from propRunId overrides URL param', async () => {
    const api = {
      runValidation: vi.fn().mockResolvedValue({
        errorCount: 0, issues: [],
      }),
    };
    render(wrap(<RunValidation api={api as never} runId="PROP-runid" />));
    await waitFor(() => expect(api.runValidation)
      .toHaveBeenCalledWith('PROP-runid'));
  });

  it('empty runId → no fetch triggered', () => {
    const api = {
      runValidation: vi.fn().mockResolvedValue({
        errorCount: 0, issues: [],
      }),
    };
    render(
      <MemoryRouter>
        <RunValidation api={api as never} runId="" />
      </MemoryRouter>,
    );
    expect(api.runValidation).not.toHaveBeenCalled();
  });
});
