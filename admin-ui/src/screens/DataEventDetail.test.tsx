import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import * as edgeApi from '../api/edgeApi';
import { DataEventDetail } from './DataEventDetail';

const eventRow = {
  eventId: 'ev-1-abcdef',
  programUid: 'PROG-1', programName: 'Immunization',
  programStageUid: 'PS-1', programStageName: 'Dose 1',
  orgUnitUid: 'OU-1', orgUnitName: 'Clinic One',
  status: 'COMPLETED', occurredAt: '2026-11-01T00:00:00Z',
  enrollmentId: 'ENR-1',
  workflowRunId: 'wfr-1', workflowKind: 'USER',
  workflowName: 'Workflow A', workflowBusinessKey: 'bk-1',
  eventVersion: 3,
  createdBy: 'u1', createdByUsername: 'alice',
};

beforeEach(() => {
  vi.spyOn(edgeApi, 'getLocalEvent').mockResolvedValue({
    row: eventRow,
    dataValues: [
      { dataElementUid: 'DE-1', dataElementName: 'Weight (kg)', valueText: '7.2' },
      { dataElementUid: 'DE-2', dataElementName: null, valueText: '' },
    ],
    journal: [],
  } as never);
});

afterEach(() => vi.restoreAllMocks());

describe('DataEventDetail', () => {
  it('renders event metadata + data-value table', async () => {
    renderWithProviders(<DataEventDetail />, { route: '/data/events/ev-1-abcdef' });
    await waitFor(() =>
      expect(screen.getByTestId('data-event-detail')).toBeInTheDocument());
    // Program stage title rendered.
    expect(screen.getAllByText('Dose 1').length).toBeGreaterThan(0);
    expect(screen.getByTestId('event-data-values')).toBeInTheDocument();
    expect(screen.getByText('Weight (kg)')).toBeInTheDocument();
  });

  it('404 error path', async () => {
    vi.spyOn(edgeApi, 'getLocalEvent').mockRejectedValue(new Error('nope'));
    renderWithProviders(<DataEventDetail />, { route: '/data/events/x' });
    await waitFor(() =>
      expect(screen.getByTestId('err-data-event-detail')).toBeInTheDocument());
  });

  it('shows the "no data values" message when none exist', async () => {
    vi.spyOn(edgeApi, 'getLocalEvent').mockResolvedValue({
      row: eventRow, dataValues: [], journal: [],
    } as never);
    renderWithProviders(<DataEventDetail />, { route: '/data/events/ev-1' });
    await waitFor(() =>
      expect(screen.getByText(/This event has no data values/)).toBeInTheDocument());
  });

  it('status chip switches between COMPLETED (success) and non-COMPLETED (info)', async () => {
    /* Non-COMPLETED status → ea-chip--info arm. The default
     * fixture uses COMPLETED, so this flips through to the
     * other branch. */
    vi.spyOn(edgeApi, 'getLocalEvent').mockResolvedValue({
      row: { ...eventRow, status: 'ACTIVE' },
      dataValues: [], journal: [],
    } as never);
    renderWithProviders(<DataEventDetail />, { route: '/data/events/ev-1' });
    await waitFor(() =>
      expect(screen.getAllByText('ACTIVE').length).toBeGreaterThan(0));
  });

  it('falls back to the uid-mono when programName / stageName / orgUnitName are null', async () => {
    /* The DefRow for Program / Program stage / Org unit shows a
     * two-line name+uid when the name is present, or just the
     * mono uid otherwise. Three nulls at once exercise all three
     * fallback branches in one render. */
    vi.spyOn(edgeApi, 'getLocalEvent').mockResolvedValue({
      row: { ...eventRow,
        programName: null, programStageName: null, orgUnitName: null,
        enrollmentId: null,  /* also skip the enrolment DefRow */
      },
      dataValues: [], journal: [],
    } as never);
    renderWithProviders(<DataEventDetail />, { route: '/data/events/ev-1' });
    await waitFor(() =>
      expect(screen.getByTestId('data-event-detail')).toBeInTheDocument());
    /* The uids now surface alongside their mono spans. */
    expect(screen.getAllByText('PROG-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PS-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('OU-1').length).toBeGreaterThan(0);
  });

  it('populated journal exercises the JournalPanel chip-tone arms (via DataAggregateDetail)', async () => {
    /* Three journal entries spanning CENTRAL_ACCEPTED / IN_FLIGHT /
     * CONFLICT_REVIEW drive the shared JournalPanel tone switch
     * in the context of a DataEventDetail render. */
    vi.spyOn(edgeApi, 'getLocalEvent').mockResolvedValue({
      row: eventRow, dataValues: [],
      journal: [
        { operationId: 'ev-op-1', state: 'CENTRAL_ACCEPTED',
          attemptCount: 1, lastError: null, nextHopOrgUnitUid: null,
          updatedAt: '2026-11-02T00:00:00Z',
          createdAt: '2026-11-01T00:00:00Z' },
        { operationId: 'ev-op-2', state: 'IN_FLIGHT',
          attemptCount: 2, lastError: null,
          nextHopOrgUnitUid: 'OU-nexthop',
          updatedAt: null, createdAt: '2026-11-01T00:00:00Z' },
        { operationId: 'ev-op-3', state: 'CONFLICT_REVIEW',
          attemptCount: 1, lastError: 'rule misfire',
          nextHopOrgUnitUid: null,
          updatedAt: '2026-11-02T00:00:00Z',
          createdAt: '2026-11-01T00:00:00Z' },
      ],
    } as never);
    renderWithProviders(<DataEventDetail />, { route: '/data/events/ev-1' });
    await waitFor(() =>
      expect(screen.getByTestId('journal-history')).toBeInTheDocument());
    expect(screen.getByText(/rule misfire/)).toBeInTheDocument();
    expect(screen.getByText('OU-nexthop')).toBeInTheDocument();
  });
});
