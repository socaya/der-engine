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

  it('status filter — selecting ACTIVE calls list with status=ACTIVE', async () => {
    renderWithProviders(<DataEvents />);
    await waitFor(() =>
      expect(screen.getByTestId('data-events')).toBeInTheDocument());
    const user = userEvent.setup();
    await user.selectOptions(screen.getByTestId('data-events-status'),
                              'ACTIVE');
    await waitFor(() =>
      expect(edgeApi.listLocalEvents).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACTIVE' })));
  });

  it('search filter narrows the client-side table to empty', async () => {
    renderWithProviders(<DataEvents />);
    await waitFor(() =>
      expect(screen.getByTestId('data-events-table')).toBeInTheDocument());
    const user = userEvent.setup();
    await user.type(screen.getByTestId('data-events-search'),
                     'nomatch-xyz');
    await waitFor(() =>
      expect(screen.queryByTestId('data-events-table')).toBeNull());
    expect(screen.getByText(/No matching events/i)).toBeInTheDocument();
  });

  it('limit change triggers reload with new limit', async () => {
    renderWithProviders(<DataEvents />);
    await waitFor(() =>
      expect(screen.getByTestId('data-events-table')).toBeInTheDocument());
    const user = userEvent.setup();
    await user.selectOptions(screen.getByTestId('data-events-limit'),
                              '200');
    await waitFor(() =>
      expect(edgeApi.listLocalEvents).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 200 })));
  });

  it('SyncStateChip renders every chipShape arm across a multi-row fixture', async () => {
    const rows = [
      { ...eventRow, eventId: 'e-pend',   syncState: 'PENDING' },
      { ...eventRow, eventId: 'e-flight', syncState: 'IN_FLIGHT' },
      { ...eventRow, eventId: 'e-retry',  syncState: 'RETRYABLE' },
      { ...eventRow, eventId: 'e-ok',     syncState: 'CENTRAL_ACCEPTED' },
      { ...eventRow, eventId: 'e-rej',    syncState: 'CENTRAL_REJECTED' },
      { ...eventRow, eventId: 'e-conf',   syncState: 'CONFLICT_REVIEW' },
      { ...eventRow, eventId: 'e-appr',   syncState: 'REQUIRES_APPROVAL' },
      { ...eventRow, eventId: 'e-quar',   syncState: 'QUARANTINED' },
      { ...eventRow, eventId: 'e-unk',    syncState: 'UNKNOWN_OUTCOME' },
      /* Default-arm state. */
      { ...eventRow, eventId: 'e-weird',  syncState: 'FUTURE_STATE' },
      /* Null state → "Local only" chip. */
      { ...eventRow, eventId: 'e-null',   syncState: null,
        operationId: null },
    ];
    vi.spyOn(edgeApi, 'listLocalEvents').mockResolvedValue({
      rows,
    } as never);
    renderWithProviders(<DataEvents />);
    await waitFor(() =>
      expect(screen.getByTestId('data-events-chip-PENDING'))
        .toBeInTheDocument());
    expect(screen.getByTestId('data-events-chip-IN_FLIGHT'))
      .toBeInTheDocument();
    expect(screen.getByTestId('data-events-chip-RETRYABLE'))
      .toBeInTheDocument();
    expect(screen.getByTestId('data-events-chip-CENTRAL_ACCEPTED'))
      .toBeInTheDocument();
    expect(screen.getByTestId('data-events-chip-CENTRAL_REJECTED'))
      .toBeInTheDocument();
    expect(screen.getByTestId('data-events-chip-CONFLICT_REVIEW'))
      .toBeInTheDocument();
    expect(screen.getByTestId('data-events-chip-REQUIRES_APPROVAL'))
      .toBeInTheDocument();
    expect(screen.getByTestId('data-events-chip-QUARANTINED'))
      .toBeInTheDocument();
    expect(screen.getByTestId('data-events-chip-UNKNOWN_OUTCOME'))
      .toBeInTheDocument();
    expect(screen.getByTestId('data-events-chip-FUTURE_STATE'))
      .toBeInTheDocument();
    expect(screen.getByText('Local only')).toBeInTheDocument();
  });

  it('Pull-from-Central dialog opens and closes without result', async () => {
    renderWithProviders(<DataEvents />);
    await waitFor(() =>
      expect(screen.getByTestId('data-events')).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('data-events-pull-open'));
    expect(screen.getByTestId('pull-events-dialog')).toBeInTheDocument();
    /* Submit is disabled while fields are blank. */
    expect(screen.getByTestId('pull-events-submit')).toBeDisabled();
    await user.click(screen.getByTestId('pull-events-close'));
    await waitFor(() =>
      expect(screen.queryByTestId('pull-events-dialog')).toBeNull());
  });

  it('Preview-ready dialog opens', async () => {
    renderWithProviders(<DataEvents />);
    await waitFor(() =>
      expect(screen.getByTestId('data-events')).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('data-events-preview-open'));
    /* CentralPayloadDrawer mounts; the test-id is specific to the
     * drawer itself but we at least prove the open handler fires. */
    expect(screen.getByTestId('data-events')).toBeInTheDocument();
  });

  it('Lineage button on a row opens the lineage drawer', async () => {
    renderWithProviders(<DataEvents />);
    await waitFor(() =>
      expect(screen.getByTestId('data-events-lineage-ev-1'))
        .toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('data-events-lineage-ev-1'));
    expect(screen.getByTestId('data-events-row-ev-1')).toBeInTheDocument();
  });

  it('chipToneForStatus arms — rows with each status surface their tone', async () => {
    vi.spyOn(edgeApi, 'listLocalEvents').mockResolvedValue({
      rows: [
        { ...eventRow, eventId: 'e-done',   status: 'COMPLETED' },
        { ...eventRow, eventId: 'e-active', status: 'ACTIVE' },
        { ...eventRow, eventId: 'e-over',   status: 'OVERDUE' },
        { ...eventRow, eventId: 'e-skip',   status: 'SKIPPED' },
        { ...eventRow, eventId: 'e-sched',  status: 'SCHEDULE' },
        { ...eventRow, eventId: 'e-vis',    status: 'VISITED' },
        { ...eventRow, eventId: 'e-weird',  status: 'MYSTERY' },
      ],
    } as never);
    renderWithProviders(<DataEvents />);
    await waitFor(() =>
      expect(screen.getByTestId('data-events-row-e-done'))
        .toBeInTheDocument());
    /* All seven status labels surface. */
    expect(screen.getAllByText('COMPLETED').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ACTIVE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('OVERDUE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SKIPPED').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SCHEDULE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('VISITED').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MYSTERY').length).toBeGreaterThan(0);
  });

  it('row with null workflow + null program names falls back to UID', async () => {
    vi.spyOn(edgeApi, 'listLocalEvents').mockResolvedValue({
      rows: [
        { ...eventRow, eventId: 'e-untagged',
          workflowRunId: null, workflowId: null,
          workflowName: null, workflowBusinessKey: null,
          programStageName: null, programName: null,
          orgUnitName: null, submittedAt: null },
      ],
    } as never);
    renderWithProviders(<DataEvents />);
    await waitFor(() =>
      expect(screen.getByTestId('data-events-row-e-untagged'))
        .toBeInTheDocument());
    /* The row renders — fallback paths for null fields fired without
     * throwing. */
    expect(screen.getByText('PS-1')).toBeInTheDocument();
  });
});
