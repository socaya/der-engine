import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { SnapshotList } from './SnapshotList';
import type * as edgeApi from '../../api/edgeApi';

function renderList(api: {
  listSnapshots: ReturnType<typeof vi.fn>;
  retireSnapshot: ReturnType<typeof vi.fn>;
  reinstateSnapshot: ReturnType<typeof vi.fn>;
}) {
  return render(
    <MemoryRouter>
      <SnapshotList api={api as unknown as Partial<typeof edgeApi> as never} />
    </MemoryRouter>,
  );
}

function snap(id: number, overrides: Partial<edgeApi.MetadataSnapshot> = {}):
    edgeApi.MetadataSnapshot {
  return {
    snapshotId: id,
    importedFrom: 'https://central.example.org/dhis',
    importedBy: 'admin',
    importedAt: '2026-11-01T00:00:00Z',
    counts: {
      organisationUnits: 10, dataElements: 20,
      dataSets: 5, programs: 3, trackedEntityTypes: 2,
    },
    centralVersion: '2.44',
    centralRevision: 'abcdef1234',
    fingerprint: '0123456789abcdef0123',
    retiredAt: null,
    retiredBy: null,
    pinnedWorkflows: 0,
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('SnapshotList', () => {
  it('renders loading state before api resolves', () => {
    const api = {
      listSnapshots: vi.fn(() => new Promise(() => undefined)) as never,
      retireSnapshot: vi.fn(),
      reinstateSnapshot: vi.fn(),
    };
    renderList(api as never);
    expect(screen.getByTestId('snapshots-loading')).toBeInTheDocument();
  });

  it('renders error state when api rejects', async () => {
    const api = {
      listSnapshots: vi.fn().mockRejectedValue(new Error('boom')),
      retireSnapshot: vi.fn(),
      reinstateSnapshot: vi.fn(),
    };
    renderList(api as never);
    await waitFor(() => expect(screen.getByTestId('snapshots-error')).toBeInTheDocument());
    expect(screen.getByTestId('snapshots-error')).toHaveTextContent(/boom/);
  });

  it('renders error state when rejection is a non-Error value', async () => {
    const api = {
      listSnapshots: vi.fn().mockRejectedValue('plain-string'),
      retireSnapshot: vi.fn(),
      reinstateSnapshot: vi.fn(),
    };
    renderList(api as never);
    await waitFor(() => expect(screen.getByTestId('snapshots-error')).toBeInTheDocument());
    expect(screen.getByTestId('snapshots-error')).toHaveTextContent(/plain-string/);
  });

  it('renders empty state with a prompt when the list is empty', async () => {
    const api = {
      listSnapshots: vi.fn().mockResolvedValue({ snapshots: [] }),
      retireSnapshot: vi.fn(),
      reinstateSnapshot: vi.fn(),
    };
    renderList(api as never);
    await waitFor(() => expect(screen.getByTestId('snapshots-root')).toBeInTheDocument());
    expect(screen.getByText(/No snapshots yet/i)).toBeInTheDocument();
  });

  it('renders populated snapshots with totals, status pills and compare link', async () => {
    const api = {
      listSnapshots: vi.fn().mockResolvedValue({
        snapshots: [
          snap(10),
          snap(9, { status: 'RETIRED', pinnedWorkflows: 2 }),
          snap(8, { centralVersion: null, centralRevision: null, fingerprint: null }),
        ],
      }),
      retireSnapshot: vi.fn(),
      reinstateSnapshot: vi.fn(),
    };
    renderList(api as never);
    await waitFor(() => expect(screen.getByTestId('snapshot-row-10')).toBeInTheDocument());
    expect(screen.getByTestId('snapshot-row-9')).toBeInTheDocument();
    expect(screen.getByTestId('snapshot-row-8')).toBeInTheDocument();
    // Pinned marker surfaces for row 9.
    expect(screen.getByTestId('snapshot-row-9-pinned')).toHaveTextContent(/2 workflows/);
    // Compare link shows for non-latest active rows (row 8), not for latest row 10.
    expect(screen.getByTestId('snapshot-row-8-diff')).toHaveTextContent('vs #10');
    expect(screen.queryByTestId('snapshot-row-10-diff')).toBeNull();
    // Retire button on active rows, reinstate on retired.
    expect(screen.getByTestId('snapshot-row-10-retire')).toBeInTheDocument();
    expect(screen.getByTestId('snapshot-row-9-reinstate')).toBeInTheDocument();
  });

  it('renders single-workflow pinned label correctly', async () => {
    const api = {
      listSnapshots: vi.fn().mockResolvedValue({
        snapshots: [snap(1, { pinnedWorkflows: 1 })],
      }),
      retireSnapshot: vi.fn(),
      reinstateSnapshot: vi.fn(),
    };
    renderList(api as never);
    await waitFor(() => expect(screen.getByTestId('snapshot-row-1-pinned'))
      .toHaveTextContent(/1 workflow$/));
  });

  it('disables retire when any workflows are pinned', async () => {
    const api = {
      listSnapshots: vi.fn().mockResolvedValue({
        snapshots: [snap(1, { pinnedWorkflows: 3 }), snap(0)],
      }),
      retireSnapshot: vi.fn(),
      reinstateSnapshot: vi.fn(),
    };
    renderList(api as never);
    await waitFor(() => expect(screen.getByTestId('snapshot-row-1-retire')).toBeInTheDocument());
    expect(screen.getByTestId('snapshot-row-1-retire')).toBeDisabled();
  });

  it('retire action calls api and reloads the list', async () => {
    const api = {
      listSnapshots: vi.fn().mockResolvedValue({ snapshots: [snap(42), snap(41)] }),
      retireSnapshot: vi.fn().mockResolvedValue(undefined),
      reinstateSnapshot: vi.fn(),
    };
    renderList(api as never);
    await waitFor(() => expect(screen.getByTestId('snapshot-row-41-retire')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('snapshot-row-41-retire'));
    await waitFor(() => expect(api.retireSnapshot).toHaveBeenCalledWith(41));
    expect(api.listSnapshots).toHaveBeenCalledTimes(2); // initial + after retire
  });

  it('reinstate action calls api and reloads the list', async () => {
    const api = {
      listSnapshots: vi.fn().mockResolvedValue({
        snapshots: [snap(10), snap(9, { status: 'RETIRED' })],
      }),
      retireSnapshot: vi.fn(),
      reinstateSnapshot: vi.fn().mockResolvedValue(undefined),
    };
    renderList(api as never);
    await waitFor(() => expect(screen.getByTestId('snapshot-row-9-reinstate')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('snapshot-row-9-reinstate'));
    await waitFor(() => expect(api.reinstateSnapshot).toHaveBeenCalledWith(9));
    expect(api.listSnapshots).toHaveBeenCalledTimes(2);
  });

  it('surfaces retire failures as the inline error', async () => {
    const api = {
      listSnapshots: vi.fn().mockResolvedValue({ snapshots: [snap(10), snap(9)] }),
      retireSnapshot: vi.fn().mockRejectedValue(new Error('retire-failed')),
      reinstateSnapshot: vi.fn(),
    };
    renderList(api as never);
    await waitFor(() => expect(screen.getByTestId('snapshot-row-9-retire')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('snapshot-row-9-retire'));
    await waitFor(() => expect(screen.getByTestId('snapshots-error')).toBeInTheDocument());
    expect(screen.getByTestId('snapshots-error')).toHaveTextContent(/retire-failed/);
  });

  it('surfaces reinstate failures as the inline error', async () => {
    const api = {
      listSnapshots: vi.fn().mockResolvedValue({
        snapshots: [snap(1, { status: 'RETIRED' })],
      }),
      retireSnapshot: vi.fn(),
      reinstateSnapshot: vi.fn().mockRejectedValue('reinstate-boom'),
    };
    renderList(api as never);
    await waitFor(() => expect(screen.getByTestId('snapshot-row-1-reinstate')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('snapshot-row-1-reinstate'));
    await waitFor(() => expect(screen.getByTestId('snapshots-error')).toBeInTheDocument());
    expect(screen.getByTestId('snapshots-error')).toHaveTextContent(/reinstate-boom/);
  });
});
