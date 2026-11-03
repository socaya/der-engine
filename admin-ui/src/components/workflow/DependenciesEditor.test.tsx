import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DependenciesEditor } from './DependenciesEditor';
import type { CaptureWorkflowStep,
                CaptureWorkflowDependency } from '../../api/edgeApi';

function step(id: string, ordinal: number): CaptureWorkflowStep {
  return {
    stepId: id, ordinal, displayName: `Step ${ordinal}`,
    ownerRole: 'OPERATOR', stepKind: 'CAPTURE',
    sectionKind: 'AD_HOC', sectionRef: null,
    ownerDeviceId: null, fields: [],
  } as unknown as CaptureWorkflowStep;
}

function dep(from: string, to: string): CaptureWorkflowDependency {
  return { stepId: to, dependsOnStepId: from, kind: 'COMPLETES_BEFORE',
         } as unknown as CaptureWorkflowDependency;
}

describe('DependenciesEditor', () => {
  it('empty dependencies → placeholder message', () => {
    render(<DependenciesEditor steps={[step('a', 0)]}
             dependencies={[]} onChange={() => undefined} />);
    expect(screen.getByText(/No dependencies/)).toBeInTheDocument();
    expect(screen.getByTestId('cwf02-deps-editor')).toBeInTheDocument();
  });

  it('add button disabled when fewer than 2 steps', () => {
    render(<DependenciesEditor steps={[step('a', 0)]}
             dependencies={[]} onChange={() => undefined} />);
    expect(screen.getByTestId('cwf02-dep-add')).toBeDisabled();
  });

  it('add button enabled with 2+ steps; clicking it appends a dependency', () => {
    const onChange = vi.fn();
    render(<DependenciesEditor
             steps={[step('a', 0), step('b', 1)]}
             dependencies={[]} onChange={onChange} />);
    const addBtn = screen.getByTestId('cwf02-dep-add');
    expect(addBtn).not.toBeDisabled();
    fireEvent.click(addBtn);
    const arg = onChange.mock.calls[0][0];
    expect(arg).toHaveLength(1);
    expect(arg[0]).toMatchObject({
      stepId: 'b', dependsOnStepId: 'a', kind: 'COMPLETES_BEFORE',
    });
  });

  it('populated deps render a row per entry with both selects + Remove', () => {
    render(<DependenciesEditor
             steps={[step('a', 0), step('b', 1)]}
             dependencies={[dep('a', 'b')]}
             onChange={() => undefined} />);
    expect(screen.getByTestId('cwf02-dep-0')).toBeInTheDocument();
    expect(screen.getByTestId('cwf02-dep-0-step')).toBeInTheDocument();
    expect(screen.getByTestId('cwf02-dep-0-dependson')).toBeInTheDocument();
    expect(screen.getByTestId('cwf02-dep-0-remove')).toBeInTheDocument();
  });

  it('changing the "step" select fires onChange with the new stepId', () => {
    const onChange = vi.fn();
    render(<DependenciesEditor
             steps={[step('a', 0), step('b', 1), step('c', 2)]}
             dependencies={[dep('a', 'b')]}
             onChange={onChange} />);
    fireEvent.change(screen.getByTestId('cwf02-dep-0-step'),
                      { target: { value: 'c' } });
    expect(onChange.mock.calls[0][0][0].stepId).toBe('c');
  });

  it('changing the "depends on" select fires onChange', () => {
    const onChange = vi.fn();
    render(<DependenciesEditor
             steps={[step('a', 0), step('b', 1), step('c', 2)]}
             dependencies={[dep('a', 'b')]}
             onChange={onChange} />);
    fireEvent.change(screen.getByTestId('cwf02-dep-0-dependson'),
                      { target: { value: 'c' } });
    expect(onChange.mock.calls[0][0][0].dependsOnStepId).toBe('c');
  });

  it('Remove button drops the row from the list', () => {
    const onChange = vi.fn();
    render(<DependenciesEditor
             steps={[step('a', 0), step('b', 1)]}
             dependencies={[dep('a', 'b'), dep('b', 'a')]}
             onChange={onChange} />);
    fireEvent.click(screen.getByTestId('cwf02-dep-0-remove'));
    expect(onChange.mock.calls[0][0]).toHaveLength(1);
    expect(onChange.mock.calls[0][0][0].stepId).toBe('a');
  });

  it('steps without stepId are filtered out of the picker list', () => {
    const noIdStep = {
      ...step('ignored', 0),
      stepId: undefined,
    } as unknown as CaptureWorkflowStep;
    render(<DependenciesEditor
             steps={[noIdStep, step('b', 1), step('c', 2)]}
             dependencies={[dep('b', 'c')]}
             onChange={() => undefined} />);
    const select = screen.getByTestId('cwf02-dep-0-step') as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).not.toContain('ignored');
  });

  it('add button no-op when steps.length < 2 even if clicked (safety guard)', () => {
    /* The button is disabled in that case — this test verifies the
     * guard in the add() function itself. We render a disabled
     * button, click it via fireEvent (which bypasses the disabled
     * guard in jsdom), and assert onChange still didn't fire. */
    const onChange = vi.fn();
    render(<DependenciesEditor steps={[step('a', 0)]}
             dependencies={[]} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('cwf02-dep-add'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
