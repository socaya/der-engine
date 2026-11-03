import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import * as edgeApi from '../api/edgeApi';
import { DataTracker } from './DataTracker';

const trackerRow = {
  rowId: 'row-1',
  kind: 'TEI',
  teiUid: 'tei-1', teType: 'Patient',
  programUid: 'PROG-1', programName: 'Immunization',
  programStageUid: null,
  orgUnitUid: 'OU-1', orgUnitName: 'Clinic One',
  status: null, occurredAt: '2026-11-01T00:00:00Z',
  workflowRunId: 'wfr-1', workflowKind: 'USER',
  workflowName: 'WF', workflowBusinessKey: 'bk-1',
  workflowId: 'wf-1',
  submittedAt: '2026-11-01T00:00:00Z',
  syncState: 'PENDING', operationId: 'op-1',
  attributes: '{"name":"John Doe"}',
};

beforeEach(() => {
  vi.spyOn(edgeApi, 'listLocalTracker').mockResolvedValue({ rows: [trackerRow] } as never);
  vi.spyOn(edgeApi, 'fetchDataPullCursors').mockResolvedValue({ cursors: [] } as never);
  vi.spyOn(edgeApi, 'metadataList').mockResolvedValue({
    resource: 'programs', items: [], serverTotal: 0,
  } as never);
  vi.spyOn(edgeApi, 'listWorkflows').mockResolvedValue({ workflows: [] } as never);
});

afterEach(() => vi.restoreAllMocks());

describe('DataTracker', () => {
  it('loads and shows the row kind summary', async () => {
    renderWithProviders(<DataTracker />);
    await waitFor(() =>
      expect(screen.getByTestId('data-tracker')).toBeInTheDocument());
    // Status label says "1 tei".
    expect(screen.getByText(/1 tei/i)).toBeInTheDocument();
  });

  it('shows error on load failure', async () => {
    vi.spyOn(edgeApi, 'listLocalTracker').mockRejectedValue(new Error('BAD'));
    renderWithProviders(<DataTracker />);
    await waitFor(() =>
      expect(screen.getByTestId('err-data-tracker')).toBeInTheDocument());
  });

  it('respects ?teiUid= to scope the query', async () => {
    renderWithProviders(<DataTracker />, { route: '/data/tracker?teiUid=tei-abc' });
    await waitFor(() =>
      expect(edgeApi.listLocalTracker).toHaveBeenCalledWith(
        expect.objectContaining({ teiUid: 'tei-abc' })));
  });

  it('respects ?workflowId URL filter', async () => {
    renderWithProviders(<DataTracker />, { route: '/data/tracker?workflowId=wf-X' });
    await waitFor(() =>
      expect(edgeApi.listLocalTracker).toHaveBeenCalledWith(
        expect.objectContaining({ workflowId: 'wf-X' })));
  });
});
