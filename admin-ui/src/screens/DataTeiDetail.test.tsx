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
});
