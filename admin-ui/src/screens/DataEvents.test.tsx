import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import * as edgeApi from '../api/edgeApi';
import { DataEvents } from './DataEvents';

const eventRow = {
  eventId: 'ev-1', programUid: 'PROG-1', programName: 'Immunization',
  programStageUid: 'PS-1', programStageName: 'Dose 1',
  orgUnitUid: 'OU-1', orgUnitName: 'Clinic One',
  status: 'COMPLETED', occurredAt: '2026-11-01T00:00:00Z',
  enrollmentId: null, workflowRunId: 'wfr-1', workflowKind: 'USER',
  workflowName: 'Workflow A', workflowBusinessKey: 'bk-1',
  workflowId: 'wf-1', eventVersion: 1,
  createdBy: 'u1', createdByUsername: 'alice',
  submittedAt: '2026-11-01T00:00:00Z',
  syncState: 'CENTRAL_ACCEPTED', operationId: 'op-ev',
};

beforeEach(() => {
  vi.spyOn(edgeApi, 'listLocalEvents').mockResolvedValue({
    rows: [eventRow],
  } as never);
  vi.spyOn(edgeApi, 'fetchDataPullCursors').mockResolvedValue({ cursors: [] } as never);
  vi.spyOn(edgeApi, 'metadataList').mockResolvedValue({
    resource: 'programs', items: [], serverTotal: 0,
  } as never);
  vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({ workflows: [] } as never);
});

afterEach(() => vi.restoreAllMocks());

describe('DataEvents', () => {
  it('loading → populated', async () => {
    renderWithProviders(<DataEvents />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('data-events')).toBeInTheDocument());
    // Row rendered.
    expect(screen.getByText('Dose 1')).toBeInTheDocument();
  });

  it('surfaces errors on load failure', async () => {
    vi.spyOn(edgeApi, 'listLocalEvents').mockRejectedValue(new Error('X'));
    renderWithProviders(<DataEvents />);
    await waitFor(() =>
      expect(screen.getByTestId('err-data-events')).toBeInTheDocument());
  });

  it('scoped by workflowRunId URL param', async () => {
    renderWithProviders(<DataEvents />,
      { route: '/data/events?workflowRunId=wfr-xy' });
    await waitFor(() =>
      expect(edgeApi.listLocalEvents).toHaveBeenCalledWith(
        expect.objectContaining({ workflowRunId: 'wfr-xy' })));
  });

  it('passes workflowId filter + lets operator clear it', async () => {
    renderWithProviders(<DataEvents />,
      { route: '/data/events?workflowId=wf-1' });
    await waitFor(() =>
      expect(edgeApi.listLocalEvents).toHaveBeenCalledWith(
        expect.objectContaining({ workflowId: 'wf-1' })));
    // Scoped chip visible with a clear button.
    const clear = await screen.findByRole('button', { name: /^Clear$/ });
    await userEvent.click(clear);
    await waitFor(() =>
      expect(edgeApi.listLocalEvents).toHaveBeenCalledWith(
        expect.not.objectContaining({ workflowId: 'wf-1' })));
  });
});
