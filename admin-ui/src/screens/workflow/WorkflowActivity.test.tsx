import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { WorkflowActivity } from './WorkflowActivity';

beforeEach(() => {
  // The referral fetch bypasses edgeApi; stub so it doesn't flake.
  vi.spyOn(globalThis, 'fetch' as never).mockImplementation(
    async () => new Response(JSON.stringify({ rows: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }));
});
afterEach(() => vi.restoreAllMocks());

const baseApi = () => ({
  listWorkflows: vi.fn().mockResolvedValue({ workflows: [] }),
  workflowQueue: vi.fn().mockResolvedValue({
    rows: [], appliedDeviceId: null, deviceScopeSource: 'NONE',
  }),
  listPendingApprovals: vi.fn().mockResolvedValue({ rows: [] }),
});

describe('WorkflowActivity', () => {
  it('loading state before resolve', () => {
    const api = baseApi();
    renderWithProviders(<WorkflowActivity api={api as never} />);
    expect(screen.getByTestId('wf-activity-loading')).toBeInTheDocument();
  });

  it('renders empty-state table body and status bar when all empty', async () => {
    const api = baseApi();
    renderWithProviders(<WorkflowActivity api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('wf-activity-catalogue'))
      .toBeInTheDocument());
    expect(screen.getByTestId('wf-activity-root')).toHaveTextContent('All clear');
    expect(screen.getByText(/No workflows defined/i)).toBeInTheDocument();
  });

  it('renders catalogue rows + queue counts', async () => {
    const api = {
      ...baseApi(),
      listWorkflows: vi.fn().mockResolvedValue({
        workflows: [
          { workflowId: 'wf-1', displayName: 'ANC',
            boundMetadataKind: 'PROGRAM', enabled: true,
            steps: [{ ordinal: 0, displayName: 'reg', ownerRole: 'OPERATOR',
                      stepKind: 'CAPTURE', fields: [] }],
            dependencies: [], updatedAt: '2026-11-01T12:00:00Z',
            version: 1, boundMetadataId: 'p1' } as never,
          { workflowId: 'wf-2', displayName: 'IPV',
            boundMetadataKind: 'DATA_SET', enabled: false,
            steps: [], dependencies: [], updatedAt: '2026-11-01T13:00:00Z',
            version: 1, boundMetadataId: 'ds1' } as never,
        ],
      }),
      workflowQueue: vi.fn().mockResolvedValue({
        rows: [
          { readiness: 'READY' }, { readiness: 'READY' }, { readiness: 'BLOCKED' },
        ] as never[], appliedDeviceId: null, deviceScopeSource: 'NONE',
      }),
      listPendingApprovals: vi.fn().mockResolvedValue({ rows: [{ id: 'a' }] }),
    };
    renderWithProviders(<WorkflowActivity api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('wf-activity-row-wf-1'))
      .toBeInTheDocument());
    expect(screen.getByTestId('wf-activity-row-wf-2')).toBeInTheDocument();
    // Attention indicator because approvals > 0.
    expect(screen.getByTestId('wf-activity-root')).toHaveTextContent(/need[s]? attention/);
  });

  it('refresh button re-invokes the api', async () => {
    const api = baseApi();
    renderWithProviders(<WorkflowActivity api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('wf-activity-refresh'))
      .toBeInTheDocument());
    const before = api.listWorkflows.mock.calls.length;
    await userEvent.click(screen.getByTestId('wf-activity-refresh'));
    await waitFor(() => expect(api.listWorkflows.mock.calls.length)
      .toBeGreaterThan(before));
  });

  it('queue-ready tone shows "ready to capture"', async () => {
    const api = {
      ...baseApi(),
      workflowQueue: vi.fn().mockResolvedValue({
        rows: [{ readiness: 'READY' }] as never[],
        appliedDeviceId: null, deviceScopeSource: 'NONE',
      }),
    };
    renderWithProviders(<WorkflowActivity api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('wf-activity-queues'))
      .toBeInTheDocument());
    expect(screen.getByTestId('wf-activity-root'))
      .toHaveTextContent(/ready to capture/);
  });

  it('queue-blocked only tone shows blocked label', async () => {
    const api = {
      ...baseApi(),
      workflowQueue: vi.fn().mockResolvedValue({
        rows: [{ readiness: 'BLOCKED' }] as never[],
        appliedDeviceId: null, deviceScopeSource: 'NONE',
      }),
    };
    renderWithProviders(<WorkflowActivity api={api as never} />);
    await waitFor(() => expect(screen.getByTestId('wf-activity-queues'))
      .toBeInTheDocument());
    expect(screen.getByTestId('wf-activity-root'))
      .toHaveTextContent(/1 blocked/);
  });

  it('listWorkflows rejection is swallowed — component stays on the empty state', async () => {
    /* All three parallel probes use Promise.allSettled so a rejection
     * doesn't set err. The catalogue still renders with 0 workflows. */
    const api = {
      ...baseApi(),
      listWorkflows: vi.fn().mockRejectedValue(new Error('load fail')),
    };
    renderWithProviders(<WorkflowActivity api={api as never} />);
    await waitFor(() =>
      expect(screen.getByTestId('wf-activity-catalogue'))
        .toBeInTheDocument());
    /* No error block — allSettled caught the rejection. */
    expect(screen.queryByTestId('wf-activity-error')).toBeNull();
  });

  it('row with null updatedAt renders em-dash fallback', async () => {
    const api = {
      ...baseApi(),
      listWorkflows: vi.fn().mockResolvedValue({
        workflows: [
          { workflowId: 'wf-null', displayName: 'No-timestamp',
            boundMetadataKind: 'PROGRAM', enabled: true,
            steps: [], dependencies: [],
            updatedAt: null,  /* em-dash fallback branch */
            version: 1, boundMetadataId: 'p1' } as never,
        ],
      }),
    };
    renderWithProviders(<WorkflowActivity api={api as never} />);
    await waitFor(() =>
      expect(screen.getByTestId('wf-activity-row-wf-null'))
        .toBeInTheDocument());
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('workflow with absent steps count defaults to 0', async () => {
    const api = {
      ...baseApi(),
      listWorkflows: vi.fn().mockResolvedValue({
        workflows: [
          { workflowId: 'wf-nostep', displayName: 'No steps',
            boundMetadataKind: 'PROGRAM', enabled: true,
            /* steps field entirely absent — ?.length ?? 0 arm. */
            dependencies: [], updatedAt: '2026-11-03T12:00:00Z',
            version: 1, boundMetadataId: 'p1' } as never,
        ],
      }),
    };
    renderWithProviders(<WorkflowActivity api={api as never} />);
    await waitFor(() =>
      expect(screen.getByTestId('wf-activity-row-wf-nostep'))
        .toBeInTheDocument());
  });

  it('more than 8 workflows are truncated via slice(0, 8)', async () => {
    const api = {
      ...baseApi(),
      listWorkflows: vi.fn().mockResolvedValue({
        workflows: Array.from({ length: 12 }, (_, i) => ({
          workflowId: `wf-${i}`, displayName: `WF ${i}`,
          boundMetadataKind: 'PROGRAM', enabled: true,
          steps: [], dependencies: [],
          updatedAt: '2026-11-03T12:00:00Z',
          version: 1, boundMetadataId: `p-${i}`,
        }) as never),
      }),
    };
    renderWithProviders(<WorkflowActivity api={api as never} />);
    await waitFor(() =>
      expect(screen.getByTestId('wf-activity-row-wf-0'))
        .toBeInTheDocument());
    /* First 8 rows surface, rest are truncated. */
    expect(screen.getByTestId('wf-activity-row-wf-7'))
      .toBeInTheDocument();
    expect(screen.queryByTestId('wf-activity-row-wf-8')).toBeNull();
  });
});
