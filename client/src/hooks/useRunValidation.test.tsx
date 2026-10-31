import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { useRunValidation } from './useRunValidation';
import * as edgeApi from '../api/edgeApi';

function Harness({ runId }: { runId: string }): JSX.Element {
  const state = useRunValidation(runId, { pollMs: 1_000_000 });
  if (state.loading) return <div>loading</div>;
  return (
    <div>
      <span data-test="err">{state.errorCount}</span>
      <span data-test="hidden">
        {[...state.hiddenFields].sort().join(',')}
      </span>
      <span data-test="assigned">
        {[...state.assignedValues.entries()].map(([k, v]) => `${k}=${v}`).sort().join(';')}
      </span>
      <span data-test="cues">{state.createEventCues.length}</span>
    </div>
  );
}

describe('useRunValidation', () => {
  beforeEach(() => {
    vi.spyOn(edgeApi, 'runValidation').mockResolvedValue({
      runId: 'r1', errorCount: 1,
      issues: [
        { issueId: 'i1', runId: 'r1', stepId: null,
          code: 'PROGRAM_RULE_SHOWERROR', severity: 'ERROR',
          message: 'blocking', fieldRef: null },
        { issueId: 'i2', runId: 'r1', stepId: null,
          code: 'PROGRAM_RULE_HIDEFIELD', severity: 'INFO',
          message: "Field 'DE_A' should be hidden", fieldRef: 'DE_A' },
        { issueId: 'i3', runId: 'r1', stepId: null,
          code: 'PROGRAM_RULE_ASSIGN', severity: 'INFO',
          message: "Rule 'X' suggests value '42' for field 'DE_B'.",
          fieldRef: 'DE_B' },
        { issueId: 'i4', runId: 'r1', stepId: null,
          code: 'PROGRAM_RULE_CREATEEVENT', severity: 'INFO',
          message: 'schedule follow-up', fieldRef: null },
      ],
    });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('exposes hiddenFields, assignedValues, createEventCues', async () => {
    render(<Harness runId="r1" />);
    await waitFor(() => expect(screen.getByTestId('err').textContent).toBe('1'));
    expect(screen.getByTestId('hidden').textContent).toBe('DE_A');
    expect(screen.getByTestId('assigned').textContent).toBe('DE_B=42');
    expect(screen.getByTestId('cues').textContent).toBe('1');
  });

  it('is idempotent on empty runId', async () => {
    render(<Harness runId="" />);
    // No fetch should happen; nothing explodes.
    await act(async () => undefined);
  });
});
