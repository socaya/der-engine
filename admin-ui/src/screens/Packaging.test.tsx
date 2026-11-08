import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { Packaging } from './Packaging';

const empty = {
  summary: { appVersion: '2.3.0', artifactCount: 0, kinds: [],
              hwKits: [{ kitId: 'pi5', name: 'Pi 5',
                          specs: '8 GB · NVMe', bestFor: ['small clinic'] }] },
  artifacts: [],
};
const populated = {
  summary: { appVersion: '2.3.0', artifactCount: 3,
              kinds: [{ kind: 'DEB', count: 2, latest: '2026-11-01' }],
              hwKits: [{ kitId: 'pi5', name: 'Pi 5',
                          specs: '8 GB · NVMe',
                          bestFor: ['small clinic', 'rural'] }] },
  artifacts: [
    { artifactId: 'a1', kind: 'DEB' as const, version: '2.3.0',
      arch: 'arm64', sha256: 'deadbeef0000111122223333', sizeBytes: 2048,
      builtAt: '2026-11-01T00:00:00Z', builtBy: 'ci',
      sourceCommit: 'abcdef1234', outputPath: '/pkg/a1.deb' },
    { artifactId: 'a2', kind: 'TARBALL' as const, version: '2.3.0',
      arch: null, sha256: 'cafebabe0000111122223333', sizeBytes: 1024 * 1024,
      builtAt: '2026-11-01T00:00:00Z', builtBy: null,
      sourceCommit: null, outputPath: '/pkg/a2.tgz' },
    { artifactId: 'a3', kind: 'DEB' as const, version: '2.3.0',
      arch: 'amd64', sha256: 'ff000000', sizeBytes: 500,
      builtAt: '2026-11-01T00:00:00Z', builtBy: 'ci',
      sourceCommit: '1234abcd', outputPath: '/pkg/a3.deb' },
  ],
};

function fetchMock(body: unknown, ok = true): typeof fetch {
  return vi.fn(async () => new Response(ok ? JSON.stringify(body) : '',
    { status: ok ? 200 : 500 })) as never;
}

describe('Packaging screen', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch' as never)
      .mockImplementation(fetchMock(populated) as never) as never;
  });
  afterEach(() => { fetchSpy.mockRestore(); });

  it('mounts and shows the SyncStatusBar', async () => {
    renderWithProviders(<Packaging />);
    await waitFor(() => expect(screen.getByTestId('packaging')).toBeInTheDocument());
  });
  it('renders artefact registry rows + size formatting', async () => {
    renderWithProviders(<Packaging />);
    await waitFor(() =>
      expect(screen.getByLabelText('Artefact registry')).toBeInTheDocument());
    expect(screen.getByText('arm64')).toBeInTheDocument();
    expect(screen.getByText('amd64')).toBeInTheDocument();
    expect(screen.getByText(/v2\.3\.0 · 3 artefacts tracked/)).toBeInTheDocument();
    // size formatting: 2048 → 2.0 KB; 1 MB → 1.0 MB; 500 → 500 B
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
    expect(screen.getByText(/1\.0 MB/)).toBeInTheDocument();
    expect(screen.getByText(/500 B/)).toBeInTheDocument();
    expect(screen.getAllByText('DEB').length).toBeGreaterThan(0);
    expect(screen.getByText('TARBALL')).toBeInTheDocument();
  });
  it('renders empty artefact state', async () => {
    fetchSpy.mockImplementation(fetchMock(empty) as never);
    renderWithProviders(<Packaging />);
    // The status pill (0 artefacts tracked) and the empty-state
    // body copy both need the fetch promise to resolve; assert
    // them together inside the same waitFor so the test is
    // resilient to the two renders landing a microtask apart.
    await waitFor(() => {
      expect(screen.getByText(/No artefacts recorded yet/))
        .toBeInTheDocument();
      expect(screen.getByText(/0 artefacts tracked/))
        .toBeInTheDocument();
    });
  });
  it('shows loading status before data arrives', () => {
    // Pending fetch — status label should be `loading`.
    fetchSpy.mockImplementation(
      () => new Promise(() => undefined) as never);
    renderWithProviders(<Packaging />);
    expect(screen.getByText('loading')).toBeInTheDocument();
  });
  it('refresh click re-fetches', async () => {
    renderWithProviders(<Packaging />);
    await waitFor(() =>
      expect(screen.getByLabelText('Artefact registry')).toBeInTheDocument());
    const before = fetchSpy.mock.calls.length;
    await userEvent.click(screen.getByLabelText('Refresh packaging'));
    await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(before));
  });
});
