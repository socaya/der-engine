import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineQueue } from './OfflineQueue';
import { renderWithProviders } from '../test/renderWithProviders';
import { __resetDbForTests, clearAll, enqueue, listAll } from '../offline/queue';

beforeEach(async () => {
  __resetDbForTests();
  // fake-indexeddb retains state across tests; explicitly empty the
  // store so an enqueue in one test doesn't leak into the next.
  await clearAll().catch(() => undefined);
});
afterEach(() => { vi.restoreAllMocks(); });

describe('OfflineQueue', () => {
  it('shows the empty state when the queue has no entries', async () => {
    renderWithProviders(<OfflineQueue />);
    await waitFor(() =>
      expect(screen.getByTestId('queue-empty')).toBeInTheDocument());
  });

  it('lists queued entries with kind, url and created date', async () => {
    await enqueue({ kind: 'aggregate',
      url: '/api/dataValueSets', body: { v: 1 } });
    renderWithProviders(<OfflineQueue />);
    await waitFor(() =>
      expect(screen.getByTestId('queue-table')).toBeInTheDocument());
    const rows = await screen.findAllByTestId('queue-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('aggregate');
    expect(rows[0]).toHaveTextContent('/api/dataValueSets');
  });

  it('drain button triggers drainOfflineQueue + refreshes', async () => {
    await enqueue({ kind: 'aggregate',
      url: '/api/dataValueSets', body: { v: 1 } });
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true } as Response);
    renderWithProviders(<OfflineQueue />);
    await waitFor(() =>
      expect(screen.getByTestId('queue-drain')).toBeEnabled());
    fireEvent.click(screen.getByTestId('queue-drain'));
    await waitFor(() =>
      expect(screen.getByTestId('queue-status')).toHaveTextContent('Drained 1 entry'));
    expect(fetchSpy).toHaveBeenCalledWith('/api/dataValueSets',
      expect.objectContaining({ method: 'POST' }));
  });

  it('discard button removes an entry after confirm', async () => {
    const [id1] = await Promise.all([
      enqueue({ kind: 'aggregate', url: '/api/dataValueSets', body: { v: 'A' } }),
    ]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithProviders(<OfflineQueue />);
    await waitFor(() =>
      expect(screen.getByTestId('queue-table')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('queue-discard'));
    await waitFor(async () => {
      expect(await listAll()).toHaveLength(0);
    });
    expect(id1).toEqual(expect.any(Number));
  });

  it('drain summary uses plural "entries" for n !== 1', async () => {
    await enqueue({ kind: 'aggregate', url: '/api/dataValueSets', body: { a: 1 } });
    await enqueue({ kind: 'aggregate', url: '/api/dataValueSets', body: { b: 2 } });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);
    renderWithProviders(<OfflineQueue />);
    await waitFor(() =>
      expect(screen.getByTestId('queue-drain')).toBeEnabled());
    fireEvent.click(screen.getByTestId('queue-drain'));
    await waitFor(() =>
      expect(screen.getByTestId('queue-status')).toHaveTextContent('Drained 2 entries'));
  });

  it('renders the offline StatusPill variant when navigator is offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderWithProviders(<OfflineQueue />);
    await waitFor(() =>
      expect(screen.getByTestId('queue-empty')).toBeInTheDocument());
    // StatusPill from ScreenCard renders "offline" when !online.
    expect(screen.getByText('offline')).toBeInTheDocument();
  });

  it('swallows listAll failures (defensive refresh)', async () => {
    const { listAll: real } = await import('../offline/queue');
    const mod = await import('../offline/queue');
    vi.spyOn(mod, 'listAll').mockRejectedValueOnce(new Error('idb upgrade'));
    renderWithProviders(<OfflineQueue />);
    // Component still mounts — the empty state (default) appears because
    // the failed first fetch leaves `entries` at []. No crash.
    await waitFor(() =>
      expect(screen.getByTestId('queue-empty')).toBeInTheDocument());
    // Restore so subsequent interval ticks don't keep throwing noisily.
    vi.mocked(mod.listAll).mockImplementation(real);
  });

  it('shows "Drain failed" when drainOfflineQueue itself throws', async () => {
    await enqueue({ kind: 'aggregate',
      url: '/api/dataValueSets', body: { v: 1 } });
    const replay = await import('../offline/replay');
    vi.spyOn(replay, 'drainOfflineQueue').mockRejectedValue(new Error('idb closed'));
    renderWithProviders(<OfflineQueue />);
    await waitFor(() =>
      expect(screen.getByTestId('queue-drain')).toBeEnabled());
    fireEvent.click(screen.getByTestId('queue-drain'));
    await waitFor(() =>
      expect(screen.getByTestId('queue-status')).toHaveTextContent('Drain failed'));
  });

  it('discard aborts when the operator cancels the confirm', async () => {
    await enqueue({ kind: 'aggregate',
      url: '/api/dataValueSets', body: { v: 'B' } });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWithProviders(<OfflineQueue />);
    await waitFor(() =>
      expect(screen.getByTestId('queue-table')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('queue-discard'));
    // Row stays.
    expect(await listAll()).toHaveLength(1);
  });
});
