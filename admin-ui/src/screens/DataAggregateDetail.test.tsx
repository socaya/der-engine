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
});
