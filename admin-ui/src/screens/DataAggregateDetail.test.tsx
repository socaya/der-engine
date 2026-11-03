import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import * as edgeApi from '../api/edgeApi';
import { DataAggregateDetail } from './DataAggregateDetail';

const row = {
  valueId: 'val-1',
  dataElementUid: 'DE-1', dataElementName: 'Measles doses',
  orgUnitUid: 'OU-1', orgUnitName: 'Clinic One',
  periodIso: '202411',
  categoryOptionComboUid: 'COC', attributeOptionComboUid: 'AOC',
  valueText: '42', valueVersion: 1, comment: 'cold-chain fine',
  dataSetUid: 'DS-1', dataSetName: 'Monthly report',
  workflowRunId: 'wfr-1', workflowKind: 'USER',
  workflowName: 'Monthly', workflowBusinessKey: 'bk-1',
  submittedAt: '2026-11-02T00:00:00Z',
  submittedBy: 'u1', submittedByUsername: 'alice',
};

const journalEntry = {
  operationId: 'op-xyz-9999', state: 'CENTRAL_ACCEPTED',
  attemptCount: 1, lastError: null, nextHopOrgUnitUid: null,
  updatedAt: '2026-11-02T00:00:00Z',
  createdAt: '2026-11-01T00:00:00Z',
};

beforeEach(() => {
  vi.spyOn(edgeApi, 'getLocalAggregate').mockResolvedValue({
    row, journal: [journalEntry],
  } as never);
});

afterEach(() => vi.restoreAllMocks());

describe('DataAggregateDetail', () => {
  it('shows loading, then full row data with workflow + journal', async () => {
    renderWithProviders(<DataAggregateDetail />, { route: '/data/aggregate/val-1' });
    await waitFor(() =>
      expect(screen.getByTestId('data-aggregate-detail')).toBeInTheDocument());
    expect(screen.getAllByText('Measles doses').length).toBeGreaterThan(0);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText(/cold-chain fine/)).toBeInTheDocument();
    // Journal with the one accepted entry present.
    expect(screen.getByTestId('journal-history')).toBeInTheDocument();
    expect(screen.getByText('Synced')).toBeInTheDocument();
  });

  it('renders error block on not-found', async () => {
    vi.spyOn(edgeApi, 'getLocalAggregate').mockRejectedValue(new Error('404'));
    renderWithProviders(<DataAggregateDetail />, { route: '/data/aggregate/missing' });
    await waitFor(() =>
      expect(screen.getByTestId('err-data-aggregate-detail')).toBeInTheDocument());
  });

  it('shows "no outbox entries" when journal is empty', async () => {
    vi.spyOn(edgeApi, 'getLocalAggregate').mockResolvedValue({
      row, journal: [],
    } as never);
    renderWithProviders(<DataAggregateDetail />, { route: '/data/aggregate/val-1' });
    await waitFor(() =>
      expect(screen.getByTestId('data-aggregate-detail')).toBeInTheDocument());
    expect(screen.getByText(/No outbox entries yet/)).toBeInTheDocument();
  });

  /* ──────────────────────────────────────────────────────────────
   * Depth-lift: JournalPanel + WorkflowRunLink branch arms.
   * Previously uncovered — the single journalEntry fixture only
   * exercised the CENTRAL_ACCEPTED tone + null nextHop + updatedAt
   * path.
   * ────────────────────────────────────────────────────────────── */

  it('journal with distinct states exercises every chip-tone arm', async () => {
    /* Six entries spanning CENTRAL_ACCEPTED, PENDING, IN_FLIGHT,
     * CONFLICT_REVIEW, FAILED_RETRYABLE, FAILED_TERMINAL — one
     * per tone that toneForState() emits. Also flexes the
     * nextHopOrgUnitUid alt-render on the IN_FLIGHT row and the
     * lastError fallback on the FAILED rows. */
    vi.spyOn(edgeApi, 'getLocalAggregate').mockResolvedValue({
      row,
      journal: [
        { operationId: 'op-acc', state: 'CENTRAL_ACCEPTED',
          attemptCount: 1, lastError: null, nextHopOrgUnitUid: null,
          updatedAt: '2026-11-02T00:00:00Z',
          createdAt: '2026-11-01T00:00:00Z' },
        { operationId: 'op-pending', state: 'PENDING',
          attemptCount: 0, lastError: null, nextHopOrgUnitUid: null,
          updatedAt: '2026-11-02T00:00:00Z',
          createdAt: '2026-11-01T00:00:00Z' },
        { operationId: 'op-inflight', state: 'IN_FLIGHT',
          attemptCount: 2, lastError: null,
          nextHopOrgUnitUid: 'OU-nexthop-xxxx',
          updatedAt: null,
          createdAt: '2026-11-01T00:00:00Z' },
        { operationId: 'op-conflict', state: 'CONFLICT_REVIEW',
          attemptCount: 3, lastError: 'duplicate key',
          nextHopOrgUnitUid: null,
          updatedAt: '2026-11-02T00:00:00Z',
          createdAt: '2026-11-01T00:00:00Z' },
        { operationId: 'op-retry', state: 'FAILED_RETRYABLE',
          attemptCount: 2, lastError: 'timeout',
          nextHopOrgUnitUid: null,
          updatedAt: '2026-11-02T00:00:00Z',
          createdAt: '2026-11-01T00:00:00Z' },
        { operationId: 'op-fail', state: 'FAILED_TERMINAL',
          attemptCount: 5, lastError: 'rejected by central',
          nextHopOrgUnitUid: null,
          updatedAt: null, createdAt: null },
      ],
    } as never);
    renderWithProviders(<DataAggregateDetail />,
      { route: '/data/aggregate/val-1' });
    const tbl = await screen.findByTestId('journal-history');
    expect(tbl).toBeInTheDocument();
    /* Exact body matches on the lastError / nextHopOrgUnitUid
     * fallbacks assert the branches rendered. */
    expect(screen.getByText(/duplicate key/)).toBeInTheDocument();
    expect(screen.getByText(/timeout/)).toBeInTheDocument();
    expect(screen.getByText(/rejected by central/)).toBeInTheDocument();
    expect(screen.getByText('OU-nexthop-xxxx')).toBeInTheDocument();
  });

  it('null name fallbacks render UID-only for dataElement/dataSet/orgUnit', async () => {
    /* Nulls on all three name fields trigger the "else" branch
     * in each DefRow — render the uid in mono directly instead
     * of a two-line name+uid. */
    vi.spyOn(edgeApi, 'getLocalAggregate').mockResolvedValue({
      row: {
        ...row,
        dataElementName: null,
        dataSetName: null, dataSetUid: null,
        orgUnitName: null,
        comment: null,
      },
      journal: [],
    } as never);
    renderWithProviders(<DataAggregateDetail />,
      { route: '/data/aggregate/val-1' });
    await waitFor(() =>
      expect(screen.getByTestId('data-aggregate-detail'))
        .toBeInTheDocument());
    /* dataElement UID + orgUnit UID surface as mono spans. */
    expect(screen.getAllByText('DE-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('OU-1').length).toBeGreaterThan(0);
    /* dataSetUid null → em-dash fallback. */
    expect(document.body.textContent ?? '').toMatch(/—/);
  });

  it('workflow-run lineage renders the SYS chip for SYSTEM workflows and a truncated runId when name is null', async () => {
    vi.spyOn(edgeApi, 'getLocalAggregate').mockResolvedValue({
      /* workflowKind: 'SYSTEM' + workflowName: null →
       * WorkflowRunLink shows the SYS chip + the first 8 chars
       * of the runId. */
      row: { ...row, workflowKind: 'SYSTEM', workflowName: null,
             workflowBusinessKey: null,
             workflowRunId: 'runid-abcdef12-rest-of-the-uuid' },
      journal: [],
    } as never);
    renderWithProviders(<DataAggregateDetail />,
      { route: '/data/aggregate/val-1' });
    await waitFor(() =>
      expect(screen.getByTestId('data-aggregate-detail')).toBeInTheDocument());
    /* SYS chip surfaces + the truncated runId. */
    expect(screen.getByText('SYS')).toBeInTheDocument();
    expect(screen.getByText('runid-ab')).toBeInTheDocument();
  });
});
