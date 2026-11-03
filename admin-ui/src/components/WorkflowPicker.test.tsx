import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowPicker } from './WorkflowPicker';
import * as edgeApi from '../api/edgeApi';

/* WorkflowPicker is a lazy type-ahead dropdown. First-focus triggers
 * listWorkflows; the result is filtered by boundKind + a query.
 * The input value flips between selectedName / value / query based on
 * open-state. Four selectable arms per row (enabled, disabled, Any,
 * loading, empty, error) plus the filtering. */

function wf(id: string, extra: Partial<edgeApi.CaptureWorkflowSummary> = {})
: edgeApi.CaptureWorkflowSummary {
  return {
    workflowId: id, displayName: `WF ${id}`,
    boundMetadataKind: 'DATA_SET',
    boundMetadataId: 'ds-' + id,
    enabled: true, version: 1,
    createdAt: 'now', updatedAt: 'now', createdBy: null,
    steps: [], dependencies: [], requiresApproval: false,
    defaultDeviceId: null,
    ...extra,
  } as unknown as edgeApi.CaptureWorkflowSummary;
}

describe('WorkflowPicker', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('shows the placeholder when closed and no value', () => {
    render(<WorkflowPicker value="" onChange={() => undefined}
             placeholder="Any workflow" />);
    const input = screen.getByTestId('workflow-picker') as HTMLInputElement;
    expect(input.placeholder).toBe('Any workflow');
    expect(input.value).toBe('');
  });

  it('first focus lazy-loads workflows and opens the dropdown', async () => {
    vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({
      workflows: [wf('wf-1'), wf('wf-2', { enabled: false })],
    } as never);
    render(<WorkflowPicker value="" onChange={() => undefined} />);
    const input = screen.getByTestId('workflow-picker');
    fireEvent.focus(input);
    /* Any-workflow row renders synchronously. */
    expect(screen.getByText('Any workflow')).toBeInTheDocument();
    /* After the listWorkflows promise resolves both rows appear. */
    await waitFor(() =>
      expect(screen.getByText('WF wf-1')).toBeInTheDocument());
    expect(screen.getByText('WF wf-2')).toBeInTheDocument();
    /* Disabled chip surfaces for the second row. */
    expect(screen.getByText('disabled')).toBeInTheDocument();
  });

  it('typing filters by workflowId / name / kind / id — "no matching" branch', async () => {
    vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({
      workflows: [wf('abc'), wf('xyz')],
    } as never);
    render(<WorkflowPicker value="" onChange={() => undefined} />);
    const input = screen.getByTestId('workflow-picker') as HTMLInputElement;
    fireEvent.focus(input);
    await waitFor(() =>
      expect(screen.getByText('WF abc')).toBeInTheDocument());
    /* Type something that matches "abc". */
    fireEvent.change(input, { target: { value: 'abc' } });
    await waitFor(() =>
      expect(screen.getByText('WF abc')).toBeInTheDocument());
    expect(screen.queryByText('WF xyz')).toBeNull();
    /* Type something that matches nothing → "No matching workflow." */
    fireEvent.change(input, { target: { value: 'nomatch' } });
    await waitFor(() =>
      expect(screen.getByText('No matching workflow.')).toBeInTheDocument());
  });

  it('clicking a row fires onChange + closes the dropdown', async () => {
    vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({
      workflows: [wf('wf-pick')],
    } as never);
    const onChange = vi.fn();
    render(<WorkflowPicker value="" onChange={onChange} />);
    const user = userEvent.setup();
    const input = screen.getByTestId('workflow-picker');
    fireEvent.focus(input);
    await waitFor(() =>
      expect(screen.getByText('WF wf-pick')).toBeInTheDocument());
    await user.click(screen.getByText('WF wf-pick'));
    expect(onChange).toHaveBeenCalledWith('wf-pick');
  });

  it('"Any workflow" row clears the selection', async () => {
    vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({
      workflows: [wf('wf-a')],
    } as never);
    const onChange = vi.fn();
    render(<WorkflowPicker value="wf-a" onChange={onChange} />);
    const input = screen.getByTestId('workflow-picker');
    fireEvent.focus(input);
    await waitFor(() =>
      expect(screen.getByText('Any workflow')).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByText('Any workflow'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('selected value renders the matching displayName when closed', async () => {
    vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({
      workflows: [wf('wf-selected')],
    } as never);
    render(<WorkflowPicker value="wf-selected"
             onChange={() => undefined} />);
    const input = screen.getByTestId('workflow-picker') as HTMLInputElement;
    /* Must open once to lazy-load items. */
    fireEvent.focus(input);
    await waitFor(() =>
      expect(screen.getByText('WF wf-selected')).toBeInTheDocument());
    /* Blur the input to close the dropdown and show the selectedName. */
    fireEvent.blur(input);
    /* Wait for the 150ms close timeout. */
    await new Promise((r) => setTimeout(r, 200));
    expect(input.value).toBe('WF wf-selected');
  });

  it('boundKind filter narrows the list', async () => {
    vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({
      workflows: [
        wf('wf-ds',    { boundMetadataKind: 'DATA_SET' }),
        wf('wf-prog',  { boundMetadataKind: 'PROGRAM' }),
      ],
    } as never);
    render(<WorkflowPicker value="" onChange={() => undefined}
             boundKind={['DATA_SET']} />);
    const input = screen.getByTestId('workflow-picker');
    fireEvent.focus(input);
    await waitFor(() =>
      expect(screen.getByText('WF wf-ds')).toBeInTheDocument());
    /* PROGRAM-bound workflow is filtered out. */
    expect(screen.queryByText('WF wf-prog')).toBeNull();
  });

  it('empty boundKind results in "No workflows match the allowed binding kinds yet."', async () => {
    vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({
      workflows: [wf('wf-prog', { boundMetadataKind: 'PROGRAM' })],
    } as never);
    render(<WorkflowPicker value="" onChange={() => undefined}
             boundKind={['DATA_SET']} />);
    const input = screen.getByTestId('workflow-picker');
    fireEvent.focus(input);
    await waitFor(() =>
      expect(screen.getByText(/No workflows match the allowed binding kinds/))
        .toBeInTheDocument());
  });

  it('listWorkflows rejection renders the error branch', async () => {
    vi.spyOn(edgeApi, 'listWorkflows').mockRejectedValue(
      new Error('fetch failed'));
    render(<WorkflowPicker value="" onChange={() => undefined} />);
    const input = screen.getByTestId('workflow-picker');
    fireEvent.focus(input);
    await waitFor(() =>
      expect(screen.getByText(/fetch failed/)).toBeInTheDocument());
  });

  it('disabled prop prevents the input from accepting focus', () => {
    render(<WorkflowPicker value="" onChange={() => undefined} disabled />);
    const input = screen.getByTestId('workflow-picker') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('custom dataTest overrides the default id', () => {
    render(<WorkflowPicker value="" onChange={() => undefined}
             dataTest="my-picker" />);
    expect(screen.getByTestId('my-picker')).toBeInTheDocument();
  });
});
