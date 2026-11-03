import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SnapshotDiff, SnapshotDiffResources } from './SnapshotDiff';
import type * as edgeApi from '../../api/edgeApi';

function renderDiff(
  api: {
    snapshotCounterDiff: ReturnType<typeof vi.fn>;
    snapshotResourceDiff: ReturnType<typeof vi.fn>;
  },
  opts: { route?: string; aOverride?: number; bOverride?: number } = {},
) {
  const route = opts.route ?? '/metadata/snapshots/5/diff/9';
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/metadata/snapshots/:a/diff/:b"
                element={<SnapshotDiff
                  api={api as unknown as Partial<typeof edgeApi> as never}
                  aOverride={opts.aOverride}
                  bOverride={opts.bOverride}
                />} />
      </Routes>
    </MemoryRouter>,
  );
}

const emptyRows: edgeApi.SnapshotResourceDiff = {
  a: 5, b: 9, resource: 'programs',
  added: [], removed: [], changed: [],
};

function populatedResourceDiff(resource: string): edgeApi.SnapshotResourceDiff {
  return {
    a: 5, b: 9, resource,
    added: [
      { id: 'ADD-1', displayName: 'Added One' },
      { id: 'ADD-2', displayName: null },
    ],
    removed: [{ id: 'REM-1', displayName: 'Removed One' }],
    changed: [{ id: 'CHG-1', displayName: 'Changed One' }],
  };
}

function counters(): edgeApi.SnapshotDiffCounters {
  return {
    a: {
      snapshotId: 5, importedFrom: 'https://c/dhis', importedBy: null,
      importedAt: '2026-11-01T00:00:00Z',
      counts: { organisationUnits: 1, dataElements: 1, dataSets: 0, programs: 0, trackedEntityTypes: 0 },
      centralVersion: '2.44', centralRevision: null, fingerprint: null,
      retiredAt: null, retiredBy: null, pinnedWorkflows: 0, status: 'ACTIVE',
    },
    b: {
      snapshotId: 9, importedFrom: 'https://c/dhis', importedBy: null,
      importedAt: '2026-11-02T00:00:00Z',
      counts: { organisationUnits: 2, dataElements: 1, dataSets: 1, programs: 0, trackedEntityTypes: 0 },
      centralVersion: '2.44', centralRevision: null, fingerprint: null,
      retiredAt: null, retiredBy: null, pinnedWorkflows: 0, status: 'ACTIVE',
    },
    deltas: {
      programs:      { a: 2, b: 5, delta: 3 },
      dataElements:  { a: 10, b: 7, delta: -3 },
      dataSets:      { a: 4, b: 4, delta: 0 },
    },
    liveTaggedCounts: { a: {}, b: {} },
  };
}

describe('SnapshotDiff', () => {
  it('exports the resource list', () => {
    expect(SnapshotDiffResources).toContain('programs');
    expect(SnapshotDiffResources.length).toBeGreaterThan(0);
  });

  it('renders loading state before counters resolve', () => {
    const api = {
      snapshotCounterDiff: vi.fn(() => new Promise(() => undefined)) as never,
      snapshotResourceDiff: vi.fn(() => new Promise(() => undefined)) as never,
    };
    renderDiff(api as never);
    expect(screen.getByTestId('diff-loading')).toBeInTheDocument();
  });

  it('renders error when counters endpoint rejects', async () => {
    const api = {
      snapshotCounterDiff: vi.fn().mockRejectedValue(new Error('counter-fail')),
      snapshotResourceDiff: vi.fn().mockResolvedValue(emptyRows),
    };
    renderDiff(api as never);
    await waitFor(() => expect(screen.getByTestId('diff-error')).toBeInTheDocument());
    expect(screen.getByTestId('diff-error')).toHaveTextContent(/counter-fail/);
  });

  it('renders error when resource diff endpoint rejects (string)', async () => {
    const api = {
      snapshotCounterDiff: vi.fn().mockResolvedValue(counters()),
      snapshotResourceDiff: vi.fn().mockRejectedValue('res-fail'),
    };
    renderDiff(api as never);
    await waitFor(() => expect(screen.getByTestId('diff-error')).toBeInTheDocument());
    expect(screen.getByTestId('diff-error')).toHaveTextContent(/res-fail/);
  });

  it('renders empty per-UID state when all three groups are empty', async () => {
    const api = {
      snapshotCounterDiff: vi.fn().mockResolvedValue(counters()),
      snapshotResourceDiff: vi.fn().mockResolvedValue(emptyRows),
    };
    renderDiff(api as never);
    await waitFor(() => expect(screen.getByTestId('diff-empty')).toBeInTheDocument());
    expect(screen.getByTestId('diff-counters')).toBeInTheDocument();
    // Positive, negative and zero deltas all rendered.
    const counterTable = screen.getByTestId('diff-counters');
    expect(counterTable).toHaveTextContent('+3');
    expect(counterTable).toHaveTextContent('-3');
    // dataSets row shows the zero delta.
    expect(counterTable).toHaveTextContent(/dataSets/);
  });

  it('renders populated added / removed / changed groups', async () => {
    const api = {
      snapshotCounterDiff: vi.fn().mockResolvedValue(counters()),
      snapshotResourceDiff: vi.fn().mockResolvedValue(populatedResourceDiff('programs')),
    };
    renderDiff(api as never);
    await waitFor(() => expect(screen.getByTestId('diff-groups')).toBeInTheDocument());
    expect(screen.getByTestId('diff-added-section')).toBeInTheDocument();
    expect(screen.getByTestId('diff-removed-section')).toBeInTheDocument();
    expect(screen.getByTestId('diff-changed-section')).toBeInTheDocument();
    expect(screen.getByTestId('diff-added-ADD-1')).toHaveTextContent(/Added One/);
    // Null displayName renders the italic placeholder.
    expect(screen.getByTestId('diff-added-ADD-2')).toHaveTextContent(/no mirror row/i);
    expect(screen.getByTestId('diff-removed-REM-1')).toBeInTheDocument();
    expect(screen.getByTestId('diff-changed-CHG-1')).toBeInTheDocument();
  });

  it('truncates added lists over 100 items with a "more" footer', async () => {
    const big: edgeApi.SnapshotResourceDiff = {
      a: 5, b: 9, resource: 'programs',
      added: Array.from({ length: 103 }, (_, i) => ({
        id: `A-${i}`, displayName: `Name ${i}`,
      })),
      removed: [], changed: [],
    };
    const api = {
      snapshotCounterDiff: vi.fn().mockResolvedValue(counters()),
      snapshotResourceDiff: vi.fn().mockResolvedValue(big),
    };
    renderDiff(api as never);
    await waitFor(() => expect(screen.getByTestId('diff-added-section')).toBeInTheDocument());
    expect(screen.getByText(/and 3 more/)).toBeInTheDocument();
  });

  it('switching resource re-fetches the per-UID diff', async () => {
    const api = {
      snapshotCounterDiff: vi.fn().mockResolvedValue(counters()),
      snapshotResourceDiff: vi.fn().mockResolvedValue(emptyRows),
    };
    renderDiff(api as never);
    await waitFor(() => expect(screen.getByTestId('diff-resource')).toBeInTheDocument());
    // Initial call for the default 'programs' resource.
    expect(api.snapshotResourceDiff).toHaveBeenCalledWith(5, 9, 'programs');
    fireEvent.change(screen.getByTestId('diff-resource'), { target: { value: 'dataElements' } });
    await waitFor(() => expect(api.snapshotResourceDiff).toHaveBeenCalledWith(5, 9, 'dataElements'));
  });

  it('aOverride / bOverride short-circuit the route params', async () => {
    const api = {
      snapshotCounterDiff: vi.fn().mockResolvedValue(counters()),
      snapshotResourceDiff: vi.fn().mockResolvedValue(emptyRows),
    };
    renderDiff(api as never, { aOverride: 100, bOverride: 200 });
    await waitFor(() => expect(api.snapshotCounterDiff).toHaveBeenCalledWith(100, 200));
    expect(api.snapshotResourceDiff).toHaveBeenCalledWith(100, 200, 'programs');
  });

  it('skips loads when a or b are missing / NaN', () => {
    const api = {
      snapshotCounterDiff: vi.fn(),
      snapshotResourceDiff: vi.fn(),
    };
    // Route without numeric params → Number('') is 0 which is falsy.
    render(
      <MemoryRouter initialEntries={['/x']}>
        <Routes>
          <Route path="/x" element={<SnapshotDiff
            api={api as unknown as Partial<typeof edgeApi> as never} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(api.snapshotCounterDiff).not.toHaveBeenCalled();
    expect(api.snapshotResourceDiff).not.toHaveBeenCalled();
  });
});
