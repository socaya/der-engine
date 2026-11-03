import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import * as edgeApi from '../api/edgeApi';
import { DataTeiDetail } from './DataTeiDetail';

const tei = {
  teiUid: 'tei-1', teType: 'Patient',
  orgUnitUid: 'OU-1', orgUnitName: 'Clinic One',
  attributes: '{"firstName":"John","lastName":"Doe"}',
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-02T00:00:00Z',
  version: 1,
};

beforeEach(() => {
  vi.spyOn(edgeApi, 'getLocalTei').mockResolvedValue({
    tei,
    enrolments: [{
      enrollmentUid: 'ENR-1', programUid: 'PROG-1',
      programName: 'Immunization', status: 'ACTIVE',
      enrollmentDate: '2026-10-01', incidentDate: null,
      enrollmentVersion: 1,
      workflowRunId: null, workflowKind: null,
      workflowName: null, workflowBusinessKey: null,
    }],
    trackerEvents: [],
  } as never);
});

afterEach(() => vi.restoreAllMocks());

describe('DataTeiDetail', () => {
  it('renders tei header + attributes', async () => {
    renderWithProviders(<DataTeiDetail />, { route: '/data/tracker/tei/tei-1' });
    await waitFor(() =>
      expect(screen.getByTestId('data-tei-detail')).toBeInTheDocument());
    expect(screen.getByText('John')).toBeInTheDocument();
    expect(screen.getByText('Doe')).toBeInTheDocument();
  });

  it('404 error path', async () => {
    vi.spyOn(edgeApi, 'getLocalTei').mockRejectedValue(new Error('nope'));
    renderWithProviders(<DataTeiDetail />, { route: '/data/tracker/tei/none' });
    await waitFor(() =>
      expect(screen.getByTestId('err-data-tei-detail')).toBeInTheDocument());
  });

  it('tolerates malformed attributes JSON', async () => {
    vi.spyOn(edgeApi, 'getLocalTei').mockResolvedValue({
      tei: { ...tei, attributes: 'NOT JSON' },
      enrolments: [],
      trackerEvents: [],
    } as never);
    renderWithProviders(<DataTeiDetail />, { route: '/data/tracker/tei/tei-1' });
    await waitFor(() =>
      expect(screen.getByTestId('data-tei-detail')).toBeInTheDocument());
  });

  it('renders tracker-events table with every chipToneForStatus arm', async () => {
    /* Six event rows, each a different status so the chip-tone
     * switch (lines 373-383) is driven through every arm:
     * COMPLETED -> success, ACTIVE -> info, OVERDUE -> danger,
     * SKIPPED / SCHEDULED -> warning, VISITED -> neutral,
     * fallthrough -> neutral. */
    vi.spyOn(edgeApi, 'getLocalTei').mockResolvedValue({
      tei,
      enrolments: [],
      trackerEvents: [
        { eventUid: 'EV-done',   enrollmentUid: 'ENR-1',
          programUid: 'P1', programName: 'ANC',
          programStageUid: 'ST1', programStageName: 'Visit 1',
          status: 'COMPLETED', occurredDate: '2026-10-15',
          updatedAt: '2026-10-16T00:00:00Z', version: 2 },
        { eventUid: 'EV-active', enrollmentUid: 'ENR-1',
          programUid: 'P1', programName: null,
          programStageUid: 'ST2', programStageName: null,
          status: 'ACTIVE', occurredDate: null,
          updatedAt: null, version: 1 },
        { eventUid: 'EV-overdue', enrollmentUid: 'ENR-1',
          programUid: 'P1', programName: 'ANC',
          programStageUid: 'ST1', programStageName: 'Visit 2',
          status: 'OVERDUE', occurredDate: '2026-10-01',
          updatedAt: '2026-10-02T00:00:00Z', version: 1 },
        { eventUid: 'EV-skipped', enrollmentUid: null,
          programUid: 'P1', programName: 'ANC',
          programStageUid: 'ST1', programStageName: 'Visit 3',
          status: 'SKIPPED', occurredDate: '2026-09-15',
          updatedAt: '2026-09-16T00:00:00Z', version: 1 },
        { eventUid: 'EV-sched',  enrollmentUid: 'ENR-1',
          programUid: 'P1', programName: 'ANC',
          programStageUid: 'ST1', programStageName: 'Visit 4',
          status: 'SCHEDULED', occurredDate: '2026-11-01',
          updatedAt: '2026-11-01T00:00:00Z', version: 1 },
        { eventUid: 'EV-visited', enrollmentUid: 'ENR-1',
          programUid: 'P1', programName: 'ANC',
          programStageUid: 'ST1', programStageName: 'Visit 5',
          status: 'VISITED', occurredDate: '2026-10-20',
          updatedAt: '2026-10-21T00:00:00Z', version: 1 },
        { eventUid: 'EV-weird', enrollmentUid: 'ENR-1',
          programUid: 'P1', programName: 'ANC',
          programStageUid: 'ST1', programStageName: 'Visit 6',
          status: 'MYSTERY_STATE', occurredDate: '2026-10-20',
          updatedAt: '2026-10-21T00:00:00Z', version: 1 },
      ],
    } as never);
    renderWithProviders(<DataTeiDetail />, { route: '/data/tracker/tei/tei-1' });
    const tbl = await screen.findByTestId('tei-tracker-events');
    expect(tbl).toBeInTheDocument();
    expect(screen.getByText('EV-done')).toBeInTheDocument();
    expect(screen.getByText('EV-weird')).toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('OVERDUE')).toBeInTheDocument();
    expect(screen.getByText('VISITED')).toBeInTheDocument();
  });

  it('renders empty-state copy when trackerEvents is empty', async () => {
    vi.spyOn(edgeApi, 'getLocalTei').mockResolvedValue({
      tei,
      enrolments: [],
      trackerEvents: [],
    } as never);
    renderWithProviders(<DataTeiDetail />, { route: '/data/tracker/tei/tei-1' });
    await waitFor(() =>
      expect(screen.getByText(/no stage events recorded/i))
        .toBeInTheDocument());
  });

  it('null name fallbacks — enrolment programName null + trackerEvent programStageName null', async () => {
    /* Enrol + event rows with null program/stage names exercise the
     * else branches that render uid-only spans. */
    vi.spyOn(edgeApi, 'getLocalTei').mockResolvedValue({
      tei: { ...tei, orgUnitName: null },
      enrolments: [{
        enrollmentUid: 'ENR-null', programUid: 'PROG-null',
        programName: null, status: 'ACTIVE',
        enrollmentDate: '2026-10-01', incidentDate: null,
        enrollmentVersion: 1,
        workflowRunId: null, workflowKind: null,
        workflowName: null, workflowBusinessKey: null,
      }],
      trackerEvents: [{
        eventUid: 'EV-null', enrollmentUid: 'ENR-null',
        programUid: 'P1', programName: null,
        programStageUid: 'ST-null', programStageName: null,
        status: 'ACTIVE', occurredDate: null,
        updatedAt: null, version: 1,
      }],
    } as never);
    renderWithProviders(<DataTeiDetail />, { route: '/data/tracker/tei/tei-1' });
    await waitFor(() =>
      expect(screen.getByTestId('data-tei-detail')).toBeInTheDocument());
    /* UID fallbacks surface. */
    expect(screen.getAllByText('OU-1').length).toBeGreaterThan(0);
    expect(screen.getByText('PROG-null')).toBeInTheDocument();
    expect(screen.getByText('ST-null')).toBeInTheDocument();
  });
});
