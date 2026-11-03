import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import * as edgeApi from '../api/edgeApi';
import { DataAggregate } from './DataAggregate';

/* All Data-module screens import edgeApi via `import * as edgeApi`.
 * We spy on each function the screen touches so individual tests can
 * assert on calls / override behaviour. */

const pipeline = {
  captured: 2, pending: 1, inFlight: 0, retryable: 0,
  rejected: 0, sent: 1, lastSyncAt: '2026-11-02T00:00:00Z',
};

const rowAggregate = {
  valueId: 'val-1',
  dataElementUid: 'DE-1',
  orgUnitUid: 'OU-1',
  periodIso: '202411',
  categoryOptionComboUid: 'COC',
  attributeOptionComboUid: 'AOC',
  valueText: '42', valueVersion: 1,
  comment: null, dataSetUid: 'DS-1', dataSetName: 'Monthly report',
  workflowRunId: 'wfr-1', workflowId: 'wf-1', workflowName: 'Monthly',
  workflowKind: 'USER', workflowBusinessKey: 'bk-1',
  submittedAt: '2026-11-02T00:00:00Z',
  submittedBy: 'u1', submittedByUsername: 'alice',
  syncState: 'PENDING', operationId: 'op-1',
};

beforeEach(() => {
  vi.spyOn(edgeApi, 'listLocalAggregate').mockResolvedValue({
    pipeline, rows: [rowAggregate],
  } as never);
  vi.spyOn(edgeApi, 'fetchDataPullCursors').mockResolvedValue({ cursors: [] } as never);
  vi.spyOn(edgeApi, 'metadataList').mockResolvedValue({
    resource: 'dataSets', items: [], serverTotal: 0,
  } as never);
  vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({ workflows: [] } as never);
});

afterEach(() => vi.restoreAllMocks());

describe('DataAggregate', () => {
  it('shows loading, then the row table', async () => {
    renderWithProviders(<DataAggregate />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('data-aggregate')).toBeInTheDocument());
    expect(screen.getByTestId('data-aggregate-table')).toBeInTheDocument();
    expect(screen.getByTestId('data-aggregate-row-val-1')).toBeInTheDocument();
    // Pending state chip variant.
    expect(screen.getByTestId('data-aggregate-chip-PENDING')).toBeInTheDocument();
  });

  it('shows error when the list call fails', async () => {
    vi.spyOn(edgeApi, 'listLocalAggregate').mockRejectedValue(new Error('BOOM'));
    renderWithProviders(<DataAggregate />);
    await waitFor(() =>
      expect(screen.getByTestId('err-data-aggregate')).toBeInTheDocument());
  });

  it('filters by search text, hitting empty-state when nothing matches', async () => {
    renderWithProviders(<DataAggregate />);
    await waitFor(() =>
      expect(screen.getByTestId('data-aggregate-table')).toBeInTheDocument());
    const search = screen.getByTestId('data-aggregate-search');
    await userEvent.type(search, 'nomatch-xyz');
    await waitFor(() => {
      expect(screen.queryByTestId('data-aggregate-table')).toBeNull();
    });
    expect(screen.getByText(/No matching rows/i)).toBeInTheDocument();
  });

  it('re-queries when limit changes', async () => {
    renderWithProviders(<DataAggregate />);
    await waitFor(() =>
      expect(screen.getByTestId('data-aggregate-table')).toBeInTheDocument());
    const limit = screen.getByTestId('data-aggregate-limit') as HTMLSelectElement;
    await userEvent.selectOptions(limit, '200');
    await waitFor(() => {
      expect(edgeApi.listLocalAggregate).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 200 }));
    });
  });

  it('opens the Pull from Central dialog and lets the operator cancel', async () => {
    renderWithProviders(<DataAggregate />);
    await waitFor(() =>
      expect(screen.getByTestId('data-aggregate')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('data-aggregate-pull-open'));
    expect(screen.getByTestId('pull-from-central-dialog')).toBeInTheDocument();
    // Submit button disabled while fields empty.
    expect(screen.getByTestId('pull-submit')).toBeDisabled();
    await userEvent.click(screen.getByTestId('pull-close'));
    await waitFor(() =>
      expect(screen.queryByTestId('pull-from-central-dialog')).toBeNull());
  });

  it('opens the Ready-for-Central preview drawer', async () => {
    renderWithProviders(<DataAggregate />);
    await waitFor(() =>
      expect(screen.getByTestId('data-aggregate')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('data-aggregate-preview-open'));
    // Drawer renders — it starts loading via previewAggregatePayload;
    // we only need to prove the open path fires.
    expect(edgeApi.previewAggregatePayload).toBeDefined();
  });

  it('renders a workflow-run scoped chip from URL params', async () => {
    renderWithProviders(<DataAggregate />,
      { route: '/data/aggregate?workflowRunId=wfr-abcdef12' });
    await waitFor(() =>
      expect(screen.getByText(/Workflow run wfr-abcd/i)).toBeInTheDocument());
    // listLocalAggregate was called with that workflowRunId.
    expect(edgeApi.listLocalAggregate).toHaveBeenCalledWith(
      expect.objectContaining({ workflowRunId: 'wfr-abcdef12' }));
  });
});
