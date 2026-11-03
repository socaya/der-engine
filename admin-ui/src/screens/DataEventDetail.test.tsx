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
});
