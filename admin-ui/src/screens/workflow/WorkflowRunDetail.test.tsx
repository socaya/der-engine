import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { WorkflowRunDetail } from './WorkflowRunDetail';
import * as edgeApi from '../../api/edgeApi';
import type { AdminRunDetail, WorkflowRunManifest } from '../../api/edgeApi';

afterEach(() => vi.restoreAllMocks());

/** Mount at /workflows/runs/:runId so useParams() resolves. */
function renderAt(runId: string): void {
  renderWithProviders(
    <Routes>
      <Route path="/workflows/runs/:runId" element={<WorkflowRunDetail />} />
    </Routes>,
    { route: `/workflows/runs/${runId}` });
}

const emptyManifest = (): WorkflowRunManifest => ({
  runId: 'r-1', total: 0, filteredState: null, filteredTotal: 0,
  countsByEntityType: {}, countsByState: {}, operations: [],
});

const detail = (over: Partial<AdminRunDetail> = {}): AdminRunDetail => ({
  run: {
    runId: 'r-1', workflowId: 'wf-1', workflowName: 'ANC v1',
    workflowVersion: 1, businessKey: 'bk-1', state: 'OPEN',
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T12:00:00Z',
    createdBy: null,
  },
  steps: [
    { stepId: 's1', stepName: 'Register', ordinal: 0,
      ownerRole: 'OPERATOR', ownerDeviceId: null, ownerDeviceName: null,
      state: 'COMPLETE', stateAt: '2026-11-01T10:30:00Z',
      contribution: {
        payload: '{"name":"Jane"}',
        submittedAt: '2026-11-01T10:30:00Z',
        submittedBy: null, submittedDeviceId: null,
        submittedDeviceName: 'Clinic tablet',
      },
      blockedBy: [] },
    { stepId: 's2', stepName: 'Review', ordinal: 1,
      ownerRole: 'REVIEWER', ownerDeviceId: null, ownerDeviceName: null,
      state: 'BLOCKED', stateAt: null,
      contribution: null,
      blockedBy: [{ stepId: 's1', stepName: 'Register' }] },
  ],
  issues: [],
  conflicts: [],
  ...over,
});

describe('WorkflowRunDetail', () => {
  it('loading state while detail resolves', async () => {
    vi.spyOn(edgeApi, 'getAdminRunDetail')
      .mockReturnValue(new Promise(() => undefined));
    vi.spyOn(edgeApi, 'workflowRunManifest')
      .mockResolvedValue(emptyManifest());
    renderAt('r-1');
    expect(screen.getByTestId('wf-run-detail-loading')).toBeInTheDocument();
  });

  it('error state surfaces failure', async () => {
    vi.spyOn(edgeApi, 'getAdminRunDetail')
      .mockRejectedValue(new Error('nope'));
    vi.spyOn(edgeApi, 'workflowRunManifest')
      .mockResolvedValue(emptyManifest());
    renderAt('r-1');
    await waitFor(() => expect(screen.getByTestId('wf-run-detail-error'))
      .toBeInTheDocument());
  });

  it('populated run shows steps, contributions, breadcrumbs', async () => {
    vi.spyOn(edgeApi, 'getAdminRunDetail').mockResolvedValue(detail());
    vi.spyOn(edgeApi, 'workflowRunManifest').mockResolvedValue(emptyManifest());
    renderAt('r-1');
    await waitFor(() => expect(screen.getByTestId('wf-run-detail-root'))
      .toBeInTheDocument());
    expect(screen.getByTestId('wf-run-step-s1')).toBeInTheDocument();
    expect(screen.getByTestId('wf-run-step-s2')).toBeInTheDocument();
    expect(screen.getByTestId('wf-run-step-s2')).toHaveTextContent(/Register/);
    expect(screen.getByTestId('wf-run-contrib-s1')).toBeInTheDocument();
    expect(screen.getByTestId('wf-run-contrib-s1-payload')).toHaveTextContent('Jane');
    expect(screen.getByTestId('wf-run-detail-crumbs')).toBeInTheDocument();
  });

  it('issues panel renders when run has issues', async () => {
    vi.spyOn(edgeApi, 'getAdminRunDetail').mockResolvedValue(detail({
      issues: [{
        issueId: 'i-1', stepId: 's1', stepName: 'Register',
        code: 'MISSING', severity: 'ERROR',
        message: 'name required', fieldRef: 'name',
        detectedAt: '2026-11-01T10:30:00Z',
      }],
    }));
    vi.spyOn(edgeApi, 'workflowRunManifest').mockResolvedValue(emptyManifest());
    renderAt('r-1');
    await waitFor(() => expect(screen.getByTestId('wf-run-detail-issues'))
      .toBeInTheDocument());
    expect(screen.getByTestId('wf-run-detail-issues')).toHaveTextContent('name required');
  });

  it('conflicts panel renders when run has conflicts', async () => {
    vi.spyOn(edgeApi, 'getAdminRunDetail').mockResolvedValue(detail({
      conflicts: [{
        conflictId: 'c-1', category: 'DUPLICATE', identityKey: 'name:Jane',
        status: 'PENDING_REVIEW', detectedAt: '2026-11-01T10:30:00Z',
      }],
    }));
    vi.spyOn(edgeApi, 'workflowRunManifest').mockResolvedValue(emptyManifest());
    renderAt('r-1');
    await waitFor(() => expect(screen.getByTestId('wf-run-detail-conflicts'))
      .toBeInTheDocument());
    expect(screen.getByTestId('wf-run-detail-conflicts')).toHaveTextContent('DUPLICATE');
  });

  it('manifest empty surfaces empty block', async () => {
    vi.spyOn(edgeApi, 'getAdminRunDetail').mockResolvedValue(detail());
    vi.spyOn(edgeApi, 'workflowRunManifest').mockResolvedValue(emptyManifest());
    renderAt('r-1');
    await waitFor(() => expect(screen.getByTestId('wf-run-manifest-empty'))
      .toBeInTheDocument());
  });

  it('manifest error renders error line', async () => {
    vi.spyOn(edgeApi, 'getAdminRunDetail').mockResolvedValue(detail());
    vi.spyOn(edgeApi, 'workflowRunManifest')
      .mockRejectedValue(new Error('mani-fail'));
    renderAt('r-1');
    await waitFor(() => expect(screen.getByTestId('wf-run-manifest-error'))
      .toBeInTheDocument());
  });

  it('manifest table + state filter chip + bulk retry button', async () => {
    const manifest: WorkflowRunManifest = {
      runId: 'r-1', total: 2, filteredState: null, filteredTotal: 2,
      countsByEntityType: { EVENT: 2 },
      countsByState: { RETRYABLE: 1, CENTRAL_ACCEPTED: 1 },
      operations: [
        { operationId: 'op-1', entityType: 'EVENT',
          entityRef: 'e-ref-1', state: 'RETRYABLE',
          attemptCount: 2, lastError: 'timeout',
          createdAt: '2026-11-01T10:00:00Z',
          updatedAt: '2026-11-01T11:00:00Z',
          endpoint: '/api/events' },
        { operationId: 'op-2', entityType: 'EVENT',
          entityRef: 'e-ref-2', state: 'CENTRAL_ACCEPTED',
          attemptCount: 1, lastError: null,
          createdAt: '2026-11-01T10:00:00Z',
          updatedAt: '2026-11-01T11:00:00Z',
          endpoint: '/api/events' },
      ],
    };
    vi.spyOn(edgeApi, 'getAdminRunDetail').mockResolvedValue(detail());
    vi.spyOn(edgeApi, 'workflowRunManifest').mockResolvedValue(manifest);
    renderAt('r-1');
    await waitFor(() => expect(screen.getByTestId('wf-run-manifest-table'))
      .toBeInTheDocument());
    expect(screen.getByTestId('wf-run-manifest-retry-all'))
      .toHaveTextContent('Retry 1 operation');
    // Retry eligible op has a retry button.
    expect(screen.getByTestId('wf-run-manifest-retry-op-1')).toBeInTheDocument();
    expect(screen.queryByTestId('wf-run-manifest-retry-op-2')).toBeNull();
  });

  it('toggling a state chip filters the manifest server-side', async () => {
    vi.spyOn(edgeApi, 'getAdminRunDetail').mockResolvedValue(detail());
    const spy = vi.spyOn(edgeApi, 'workflowRunManifest')
      .mockResolvedValue({
        runId: 'r-1', total: 1, filteredState: null, filteredTotal: 1,
        countsByEntityType: {}, countsByState: { RETRYABLE: 1 },
        operations: [
          { operationId: 'op-1', entityType: 'EVENT',
            entityRef: 'e-ref-1', state: 'RETRYABLE',
            attemptCount: 1, lastError: null,
            createdAt: null, updatedAt: null, endpoint: null },
        ],
      });
    renderAt('r-1');
    await waitFor(() => expect(screen.getByTestId('wf-run-manifest-filter-RETRYABLE'))
      .toBeInTheDocument());
    await userEvent.click(screen.getByTestId('wf-run-manifest-filter-RETRYABLE'));
    await waitFor(() => expect(spy).toHaveBeenCalledWith(
      'r-1', { state: ['RETRYABLE'] }));
    // Clear filter resets.
    await userEvent.click(screen.getByTestId('wf-run-manifest-filter-clear'));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('r-1', undefined));
  });

  it('per-row retry calls retryOperation', async () => {
    vi.spyOn(edgeApi, 'getAdminRunDetail').mockResolvedValue(detail());
    vi.spyOn(edgeApi, 'workflowRunManifest').mockResolvedValue({
      runId: 'r-1', total: 1, filteredState: null, filteredTotal: 1,
      countsByEntityType: { EVENT: 1 },
      countsByState: { RETRYABLE: 1 },
      operations: [
        { operationId: 'op-1', entityType: 'EVENT',
          entityRef: 'e-ref-1', state: 'RETRYABLE',
          attemptCount: 1, lastError: null,
          createdAt: null, updatedAt: null, endpoint: null },
      ],
    });
    const retry = vi.spyOn(edgeApi, 'retryOperation')
      .mockResolvedValue({ operationId: 'op-1', state: 'PENDING' });
    renderAt('r-1');
    await waitFor(() => expect(screen.getByTestId('wf-run-manifest-retry-op-1'))
      .toBeInTheDocument());
    await userEvent.click(screen.getByTestId('wf-run-manifest-retry-op-1'));
    await waitFor(() => expect(retry).toHaveBeenCalledWith('op-1'));
  });

  it('bulk retry under threshold runs without confirm', async () => {
    vi.spyOn(edgeApi, 'getAdminRunDetail').mockResolvedValue(detail());
    vi.spyOn(edgeApi, 'workflowRunManifest').mockResolvedValue({
      runId: 'r-1', total: 2, filteredState: null, filteredTotal: 2,
      countsByEntityType: { EVENT: 2 },
      countsByState: { RETRYABLE: 2 },
      operations: [
        { operationId: 'op-1', entityType: 'EVENT',
          entityRef: 'r1', state: 'RETRYABLE', attemptCount: 1,
          lastError: null, createdAt: null, updatedAt: null, endpoint: null },
        { operationId: 'op-2', entityType: 'EVENT',
          entityRef: 'r2', state: 'RETRYABLE', attemptCount: 1,
          lastError: null, createdAt: null, updatedAt: null, endpoint: null },
      ],
    });
    const bulk = vi.spyOn(edgeApi, 'retryRun').mockResolvedValue({} as never);
    const confirm = vi.spyOn(window, 'confirm');
    renderAt('r-1');
    await waitFor(() => expect(screen.getByTestId('wf-run-manifest-retry-all'))
      .toBeInTheDocument());
    await userEvent.click(screen.getByTestId('wf-run-manifest-retry-all'));
    await waitFor(() => expect(bulk).toHaveBeenCalledWith('r-1', undefined));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('bulk retry over threshold requires confirm — rejects cancel', async () => {
    const ops = Array.from({ length: 11 }, (_, i) => ({
      operationId: `op-${i}`, entityType: 'EVENT' as const,
      entityRef: `r-${i}`, state: 'RETRYABLE' as const, attemptCount: 1,
      lastError: null, createdAt: null, updatedAt: null, endpoint: null,
    }));
    vi.spyOn(edgeApi, 'getAdminRunDetail').mockResolvedValue(detail());
    vi.spyOn(edgeApi, 'workflowRunManifest').mockResolvedValue({
      runId: 'r-1', total: 11, filteredState: null, filteredTotal: 11,
      countsByEntityType: { EVENT: 11 },
      countsByState: { RETRYABLE: 11 },
      operations: ops,
    });
    const bulk = vi.spyOn(edgeApi, 'retryRun').mockResolvedValue({} as never);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('r-1');
    await waitFor(() => expect(screen.getByTestId('wf-run-manifest-retry-all'))
      .toBeInTheDocument());
    await userEvent.click(screen.getByTestId('wf-run-manifest-retry-all'));
    expect(bulk).not.toHaveBeenCalled();
  });
});
