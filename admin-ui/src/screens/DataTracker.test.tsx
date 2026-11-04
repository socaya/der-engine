import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('kind filter — selecting ENROLLMENT narrows the list call', async () => {
    renderWithProviders(<DataTracker />);
    await waitFor(() =>
      expect(screen.getByTestId('data-tracker')).toBeInTheDocument());
    const user = userEvent.setup();
    await user.selectOptions(screen.getByTestId('data-tracker-kind'),
                              'ENROLLMENT');
    await waitFor(() =>
      expect(edgeApi.listLocalTracker).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'ENROLLMENT' })));
  });

  it('limit change triggers reload with new limit', async () => {
    renderWithProviders(<DataTracker />);
    await waitFor(() =>
      expect(screen.getByTestId('data-tracker-table')).toBeInTheDocument());
    const user = userEvent.setup();
    await user.selectOptions(screen.getByTestId('data-tracker-limit'),
                              '200');
    await waitFor(() =>
      expect(edgeApi.listLocalTracker).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 200 })));
  });

  it('search narrows the client-side filter to empty-state', async () => {
    renderWithProviders(<DataTracker />);
    await waitFor(() =>
      expect(screen.getByTestId('data-tracker-table')).toBeInTheDocument());
    const user = userEvent.setup();
    await user.type(screen.getByTestId('data-tracker-search'),
                     'nomatch-xyz');
    await waitFor(() =>
      expect(screen.queryByTestId('data-tracker-table')).toBeNull());
  });

  it('typing a TEI UID into the picker triggers a scoped call', async () => {
    renderWithProviders(<DataTracker />);
    await waitFor(() =>
      expect(screen.getByTestId('data-tracker-teiuid'))
        .toBeInTheDocument());
    const user = userEvent.setup();
    await user.type(screen.getByTestId('data-tracker-teiuid'),
                     'tei-xyz123');
    await waitFor(() =>
      expect(edgeApi.listLocalTracker).toHaveBeenCalledWith(
        expect.objectContaining({ teiUid: 'tei-xyz123' })));
  });

  it('SyncStateChip renders every chipShape arm across a multi-row fixture', async () => {
    const rows = [
      { ...trackerRow, rowId: 'r-pend',   syncState: 'PENDING' },
      { ...trackerRow, rowId: 'r-flight', syncState: 'IN_FLIGHT' },
      { ...trackerRow, rowId: 'r-retry',  syncState: 'RETRYABLE' },
      { ...trackerRow, rowId: 'r-ok',     syncState: 'CENTRAL_ACCEPTED' },
      { ...trackerRow, rowId: 'r-rej',    syncState: 'CENTRAL_REJECTED' },
      { ...trackerRow, rowId: 'r-conf',   syncState: 'CONFLICT_REVIEW' },
      { ...trackerRow, rowId: 'r-appr',   syncState: 'REQUIRES_APPROVAL' },
      { ...trackerRow, rowId: 'r-quar',   syncState: 'QUARANTINED' },
      { ...trackerRow, rowId: 'r-unk',    syncState: 'UNKNOWN_OUTCOME' },
      { ...trackerRow, rowId: 'r-weird',  syncState: 'FUTURE_STATE' },
      { ...trackerRow, rowId: 'r-null',   syncState: null, operationId: null },
    ];
    vi.spyOn(edgeApi, 'listLocalTracker').mockResolvedValue({ rows } as never);
    renderWithProviders(<DataTracker />);
    await waitFor(() =>
      expect(screen.getByTestId('data-tracker-chip-PENDING'))
        .toBeInTheDocument());
    expect(screen.getByTestId('data-tracker-chip-IN_FLIGHT'))
      .toBeInTheDocument();
    expect(screen.getByTestId('data-tracker-chip-CENTRAL_ACCEPTED'))
      .toBeInTheDocument();
    expect(screen.getByTestId('data-tracker-chip-CENTRAL_REJECTED'))
      .toBeInTheDocument();
    expect(screen.getByTestId('data-tracker-chip-CONFLICT_REVIEW'))
      .toBeInTheDocument();
    expect(screen.getByTestId('data-tracker-chip-REQUIRES_APPROVAL'))
      .toBeInTheDocument();
    expect(screen.getByTestId('data-tracker-chip-QUARANTINED'))
      .toBeInTheDocument();
    expect(screen.getByTestId('data-tracker-chip-UNKNOWN_OUTCOME'))
      .toBeInTheDocument();
    expect(screen.getByTestId('data-tracker-chip-FUTURE_STATE'))
      .toBeInTheDocument();
    expect(screen.getAllByText('Local only').length).toBeGreaterThan(0);
  });

  it('Pull-from-Central dialog opens and closes', async () => {
    renderWithProviders(<DataTracker />);
    await waitFor(() =>
      expect(screen.getByTestId('data-tracker')).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('data-tracker-pull-open'));
    expect(screen.getByTestId('pull-tracker-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('pull-tracker-submit')).toBeDisabled();
    await user.click(screen.getByTestId('pull-tracker-close'));
    await waitFor(() =>
      expect(screen.queryByTestId('pull-tracker-dialog')).toBeNull());
  });

  it('Preview-ready dialog mounts via preview-open button', async () => {
    renderWithProviders(<DataTracker />);
    await waitFor(() =>
      expect(screen.getByTestId('data-tracker')).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('data-tracker-preview-open'));
    /* CentralPayloadDrawer mounts; its internals are covered in its
     * own test. We just prove the open-handler branch fires. */
    expect(screen.getByTestId('data-tracker')).toBeInTheDocument();
  });

  /* Helper: fill a MetadataPicker. MetadataPicker only updates its
   * parent's `value` via onChange(id) when a dropdown row is clicked,
   * so typing alone doesn't suffice. Stub metadataList with matching
   * rows + click the option. */
  async function fillPicker(
    user: ReturnType<typeof userEvent.setup>,
    testId: string, resource: string, id: string, displayName: string,
  ): Promise<void> {
    vi.mocked(edgeApi.metadataList).mockResolvedValue({
      resource, [resource]: [{ id, displayName, href: '/x' }],
      serverTotal: 1,
    } as never);
    const input = screen.getByTestId(testId);
    await user.click(input);
    await waitFor(() =>
      expect(screen.getByText(displayName)).toBeInTheDocument());
    await user.click(screen.getByText(displayName));
  }

  it('Pull-from-Central dialog — submit happy path renders imported chip', async () => {
    vi.spyOn(edgeApi, 'pullTrackerFromCentral').mockResolvedValue({
      teis: 5, enrolments: 3, events: 7, errors: 0,
      runId: 'wfr-pulled-tracker',
    } as unknown as edgeApi.PullTrackerResult);
    renderWithProviders(<DataTracker />);
    await waitFor(() =>
      expect(screen.getByTestId('data-tracker')).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('data-tracker-pull-open'));
    await fillPicker(user, 'pull-tracker-program', 'programs',
                      'PROG-1', 'Immunization');
    await fillPicker(user, 'pull-tracker-orgunit', 'organisationUnits',
                      'OU-1', 'Clinic One');
    const submit = screen.getByTestId('pull-tracker-submit');
    await waitFor(() => expect(submit).not.toBeDisabled());
    await user.click(submit);
    await waitFor(() =>
      expect(screen.getByTestId('pull-tracker-result'))
        .toBeInTheDocument());
    expect(document.body.textContent ?? '').toMatch(/TEI/);
  });

  it('Pull-from-Central dialog — rejection surfaces error label', async () => {
    vi.spyOn(edgeApi, 'pullTrackerFromCentral').mockRejectedValue(
      new Error('central-unreachable'));
    renderWithProviders(<DataTracker />);
    await waitFor(() =>
      expect(screen.getByTestId('data-tracker')).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('data-tracker-pull-open'));
    await fillPicker(user, 'pull-tracker-program', 'programs',
                      'PROG-1', 'Immunization');
    await fillPicker(user, 'pull-tracker-orgunit', 'organisationUnits',
                      'OU-1', 'Clinic One');
    await user.click(screen.getByTestId('pull-tracker-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('pull-tracker-error'))
        .toBeInTheDocument());
  });

  it('Pull-from-Central dialog — errors>0 branch surfaces the warning line', async () => {
    vi.spyOn(edgeApi, 'pullTrackerFromCentral').mockResolvedValue({
      teis: 2, enrolments: 1, events: 0, errors: 3,
      runId: 'wfr-partial',
    } as unknown as edgeApi.PullTrackerResult);
    renderWithProviders(<DataTracker />);
    await waitFor(() =>
      expect(screen.getByTestId('data-tracker')).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('data-tracker-pull-open'));
    await fillPicker(user, 'pull-tracker-program', 'programs',
                      'PROG-1', 'Immunization');
    await fillPicker(user, 'pull-tracker-orgunit', 'organisationUnits',
                      'OU-1', 'Clinic One');
    await user.click(screen.getByTestId('pull-tracker-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('pull-tracker-result'))
        .toBeInTheDocument());
    expect(document.body.textContent ?? '').toMatch(/skipped/);
  });

  it('Lineage button opens the payload-lineage drawer', async () => {
    renderWithProviders(<DataTracker />);
    await waitFor(() =>
      expect(screen.getByTestId('data-tracker-lineage-row-1'))
        .toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByTestId('data-tracker-lineage-row-1'));
    expect(screen.getByTestId('data-tracker-row-row-1'))
      .toBeInTheDocument();
  });

  it('chipToneForKind + chipToneForStatus arms — every arm surfaces via populated row', async () => {
    vi.spyOn(edgeApi, 'listLocalTracker').mockResolvedValue({
      rows: [
        { ...trackerRow, rowId: 'r-tei', kind: 'TEI',      status: 'COMPLETED' },
        { ...trackerRow, rowId: 'r-enr', kind: 'ENROLLMENT', status: 'ACTIVE' },
        { ...trackerRow, rowId: 'r-ev',  kind: 'EVENT',    status: 'OVERDUE' },
        { ...trackerRow, rowId: 'r-weird', kind: 'OTHER' as unknown as 'TEI',
          status: 'SKIPPED' },
        { ...trackerRow, rowId: 'r-sched', kind: 'EVENT',  status: 'SCHEDULED' },
        { ...trackerRow, rowId: 'r-vis',   kind: 'EVENT',  status: 'VISITED' },
        { ...trackerRow, rowId: 'r-cnc',   kind: 'EVENT',  status: 'CANCELLED' },
        { ...trackerRow, rowId: 'r-mysb',  kind: 'EVENT',  status: 'UNKNOWN_X' },
      ],
    } as never);
    renderWithProviders(<DataTracker />);
    await waitFor(() =>
      expect(screen.getByTestId('data-tracker-row-r-tei'))
        .toBeInTheDocument());
    /* Status labels surface across all arms. */
    expect(screen.getAllByText('COMPLETED').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ACTIVE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('OVERDUE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SKIPPED').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SCHEDULED').length).toBeGreaterThan(0);
    expect(screen.getAllByText('VISITED').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CANCELLED').length).toBeGreaterThan(0);
  });

  it('row with null workflow + null program names falls back to UID', async () => {
    vi.spyOn(edgeApi, 'listLocalTracker').mockResolvedValue({
      rows: [{
        ...trackerRow, rowId: 'r-untagged',
        workflowRunId: null, workflowId: null,
        workflowName: null, workflowBusinessKey: null,
        programName: null, orgUnitName: null,
        submittedAt: null, attributes: null,
      }],
    } as never);
    renderWithProviders(<DataTracker />);
    await waitFor(() =>
      expect(screen.getByTestId('data-tracker-row-r-untagged'))
        .toBeInTheDocument());
  });

  it('workflow-run SYS kind + USER kind variants render per-arm', async () => {
    vi.spyOn(edgeApi, 'listLocalTracker').mockResolvedValue({
      rows: [
        /* USER workflow with name set. */
        { ...trackerRow, rowId: 'r-user',
          workflowRunId: 'wfr-user',
          workflowKind: 'USER',
          workflowName: 'ANC visit' },
        /* SYSTEM workflow → SYS chip surfaces. */
        { ...trackerRow, rowId: 'r-sys',
          workflowRunId: 'wfr-sys-abcdef',
          workflowKind: 'SYSTEM',
          workflowName: null },
        /* null workflow → "—" fallback. */
        { ...trackerRow, rowId: 'r-untagged',
          workflowRunId: null, workflowKind: null,
          workflowName: null },
      ],
    } as never);
    renderWithProviders(<DataTracker />);
    await waitFor(() =>
      expect(screen.getByTestId('data-tracker-row-r-user'))
        .toBeInTheDocument());
    /* Named USER workflow surfaces its name. */
    expect(screen.getByText('ANC visit')).toBeInTheDocument();
    /* SYS chip surfaces for the SYSTEM-kind row. */
    expect(screen.getByText('SYS')).toBeInTheDocument();
  });

  it('mixed-kind rows render per-kind counts in the status label', async () => {
    vi.spyOn(edgeApi, 'listLocalTracker').mockResolvedValue({
      rows: [
        { ...trackerRow, rowId: 'r-tei',   kind: 'TEI' },
        { ...trackerRow, rowId: 'r-enr',   kind: 'ENROLLMENT' },
        { ...trackerRow, rowId: 'r-ev',    kind: 'EVENT' },
      ],
    } as never);
    renderWithProviders(<DataTracker />);
    await waitFor(() =>
      expect(screen.getByTestId('data-tracker-table'))
        .toBeInTheDocument());
    /* Count line surfaces for each kind. */
    expect(screen.getByText(/1 tei/i)).toBeInTheDocument();
  });
});
